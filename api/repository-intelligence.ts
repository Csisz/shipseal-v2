import type { IncomingMessage, ServerResponse } from 'node:http';
import { runRepositoryDeepIntelligence } from '../src/lib/repositoryIntelligence/deepIntelligenceExecution.js';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryIntelligenceProviderFailureCategory,
} from '../src/lib/repositoryIntelligence/productionProviderContract.js';
import {
  OpenAiCompatibleRepositoryDeepIntelligenceProvider,
  measureProductionProviderBody,
  resolveProductionProviderConfig,
  validatePreparedProductionProviderRequest,
  validateProductionProviderRequest,
  type ProductionProviderLogger,
} from './_lib/repositoryDeepIntelligenceProvider.js';
import {
  prepareProductionDeepIntelligenceContext,
  type ProductionDeepIntelligenceBudgetSummary,
  type ProductionDeepIntelligenceRedactionSummary,
} from './_lib/repositoryDeepIntelligenceContext.js';
import { stableContextFingerprint } from '../src/lib/repositoryIntelligence/contextSelection.js';
import { PRODUCT_STRATEGIST_CONTEXT_POLICY } from '../src/lib/repositoryIntelligence/productStrategistContext.js';
import type { RepositoryDeepIntelligenceRequest } from '../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';
import type { ProductionProviderPolicy } from './_lib/repositoryDeepIntelligenceProvider.js';
import { buildProductStrategistProviderPayload } from './_lib/repositoryProductStrategistPayload.js';
import type {
  RepositoryIntelligenceSafeDiagnostics,
  RepositoryIntelligenceValidationCategory,
  RepositoryIntelligenceValidationReason,
} from '../src/lib/repositoryIntelligence/productionProviderContract.js';

const MAX_BODY_BYTES = 900 * 1024;
type VercelLikeRequest = IncomingMessage & { body?: unknown };

export interface PrepareProductionRepositoryIntelligenceOptions {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  logger?: ProductionProviderLogger;
  signal?: AbortSignal;
}

export async function prepareProductionRepositoryIntelligence(
  input: unknown,
  options: PrepareProductionRepositoryIntelligenceOptions = {},
): Promise<{ status: number; body: RepositoryIntelligenceProviderApiResponse }> {
  let config;
  try { config = resolveProductionProviderConfig(options.env); } catch {
    return fallback(503, 'configuration_invalid', false);
  }
  if (!config.enabled) return fallback(200, 'provider_disabled', false);
  if (!config.apiKey || !config.model) return fallback(200, 'credentials_missing', false);
  const logger = options.logger || safeOperationalLogger;
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || (input as { version?: unknown }).version !== REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION) {
    return fallback(400, 'invalid_request', false);
  }
  const requestValidation = validateProductionProviderRequest((input as { request?: unknown }).request, config.policy, {
    allowSensitiveContent: true,
    allowConfiguredBudgetOverflow: true,
  });
  if (!requestValidation.valid) return fallback(400, 'invalid_request', false);
  const executionPolicy = resolveProductionExecutionPolicy(requestValidation.request, config.policy);
  const executionConfig = { ...config, policy: executionPolicy };
  const preparedContext = prepareProductionDeepIntelligenceContext({
    request: requestValidation.request,
    policy: executionPolicy,
    maximumOutputTokens: executionPolicy.maximumOutputTokens,
  });
  if (preparedContext.state !== 'ready') {
    const category = preparedContext.state === 'budget-exceeded' ? 'budget_exceeded' : 'redaction_failed';
    return fallback(200, category, false, diagnosticsFor(preparedContext.budget, preparedContext.redaction));
  }
  const outboundValidation = validatePreparedProductionProviderRequest(preparedContext, executionPolicy);
  if ('reason' in outboundValidation) {
    const requestId = `ri-${preparedContext.request.fingerprint.slice(0, 16)}`;
    logger({
      event: 'repository_intelligence_provider',
      requestId,
      providerId: config.provider,
      modelId: config.model,
      outcome: 'failure',
      durationMs: 0,
      requestBytes: preparedContext.budget.requestBytes,
      retryCount: 0,
      statusCategory: 'request_preflight_rejected',
      validationCategory: 'request-preflight-rejected',
      validationReason: outboundValidation.reason,
      inputTokenEstimate: preparedContext.budget.estimatedInputTokens,
    });
    return fallback(200, 'schema_validation_failed', false, diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
      requestId,
      providerType: config.provider,
      promptVersion: preparedContext.request.promptContractVersion,
      schemaVersion: preparedContext.request.responseSchemaVersion,
      contextVersion: preparedContext.request.transmission?.contextVersion,
      redactionVersion: preparedContext.request.transmission?.redactionVersion,
      durationMs: 0,
      retryCount: 0,
      validationCategory: 'request-preflight-rejected',
      validationReason: outboundValidation.reason,
      executionProfile: preparedContext.request.executionProfile,
    }));
  }
  if (preparedContext.request.executionProfile === 'product-strategist') {
    const productPayload = buildProductStrategistProviderPayload(preparedContext.request);
    if (!productPayload.evidenceIndex.length) {
      return fallback(200, 'evidence_validation_failed', false, diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
        requestId: `ri-${preparedContext.request.fingerprint.slice(0, 16)}`,
        executionProfile: 'product-strategist',
        validationCategory: 'insufficient-product-evidence',
        productUnderstandingAccepted: false,
        productUnderstandingRejectionReason: 'missing-understanding-evidence',
        parsedProductOpportunityCount: 0,
        acceptedProductOpportunityCount: 0,
        rejectedProductOpportunityCount: 0,
        compactEvidenceReferenceCount: 0,
        compactEvidenceReferenceRejectedCount: 0,
        compactCapabilityReferenceRejectedCount: 0,
        compactPathReferenceRejectedCount: 0,
        compactSupportReferenceRejectedCount: 0,
      }));
    }
  }
  let providerMeasurement;
  try {
    providerMeasurement = measureProductionProviderBody(preparedContext.request, executionConfig);
  } catch {
    return fallback(200, 'schema_validation_failed', false, diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
      executionProfile: preparedContext.request.executionProfile,
      validationCategory: 'request-preflight-rejected',
    }));
  }
  let providerRetryCount = 0;
  let providerValidationCategory: RepositoryIntelligenceValidationCategory | undefined;
  let providerValidationReason: RepositoryIntelligenceValidationReason | undefined;
  let providerResponseDiagnostics: Partial<RepositoryIntelligenceSafeDiagnostics> = {};
  const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
    config: executionConfig,
    fetcher: options.fetcher,
    logger: event => {
      providerRetryCount = Math.max(providerRetryCount, event.retryCount);
      if (event.validationCategory) providerValidationCategory = event.validationCategory;
      if (event.validationReason) providerValidationReason = event.validationReason;
      providerResponseDiagnostics = {
        ...(event.providerHttpContentType === undefined ? {} : { providerHttpContentType: event.providerHttpContentType }),
        ...(event.providerOuterJsonParsed === undefined ? {} : { providerOuterJsonParsed: event.providerOuterJsonParsed }),
        ...(event.providerChoicesCount === undefined ? {} : { providerChoicesCount: event.providerChoicesCount }),
        ...(event.providerFinishReason === undefined ? {} : { providerFinishReason: event.providerFinishReason }),
        ...(event.providerMessagePresent === undefined ? {} : { providerMessagePresent: event.providerMessagePresent }),
        ...(event.providerContentShape === undefined ? {} : { providerContentShape: event.providerContentShape }),
        ...(event.providerContentCharacters === undefined ? {} : { providerContentCharacters: event.providerContentCharacters }),
        ...(event.providerContentBytes === undefined ? {} : { providerContentBytes: event.providerContentBytes }),
        ...(event.providerRefusalPresent === undefined ? {} : { providerRefusalPresent: event.providerRefusalPresent }),
        ...(event.providerAnnotationsPresent === undefined ? {} : { providerAnnotationsPresent: event.providerAnnotationsPresent }),
        ...(event.providerToolCallsPresent === undefined ? {} : { providerToolCallsPresent: event.providerToolCallsPresent }),
        ...(event.providerPromptTokens === undefined ? {} : { providerPromptTokens: event.providerPromptTokens }),
        ...(event.providerCompletionTokens === undefined ? {} : { providerCompletionTokens: event.providerCompletionTokens }),
        ...(event.providerReasoningTokens === undefined ? {} : { providerReasoningTokens: event.providerReasoningTokens }),
        ...(event.providerTotalTokens === undefined ? {} : { providerTotalTokens: event.providerTotalTokens }),
        ...(event.providerModelId === undefined ? {} : { providerModelId: event.providerModelId }),
        ...(event.providerJsonParsingStage === undefined ? {} : { providerJsonParsingStage: event.providerJsonParsingStage }),
      };
      logger(event);
    },
  });
  const startedAt = Date.now();
  const execution = await runRepositoryDeepIntelligence({
    provider,
    request: preparedContext.request,
    signal: options.signal,
    timeoutMs: executionPolicy.timeoutMs,
  });
  const durationMs = Math.max(0, Date.now() - startedAt);
  const productStrategistExecution = preparedContext.request.executionProfile === 'product-strategist';
  const productIntelligence = execution.result?.productIntelligence;
  const productValidationDiagnostics = productIntelligence?.validationDiagnostics;
  const acceptedProductOpportunityCount = productIntelligence?.opportunities.length || 0;
  const diagnostics = diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
    requestId: `ri-${preparedContext.request.fingerprint.slice(0, 16)}`,
    reportIdentityHash: stableContextFingerprint(preparedContext.request.repository),
    providerType: config.provider,
    promptVersion: preparedContext.request.promptContractVersion,
    schemaVersion: preparedContext.request.responseSchemaVersion,
    contextVersion: preparedContext.request.transmission?.contextVersion || preparedContext.request.selectionPolicyVersion,
    redactionVersion: preparedContext.request.transmission?.redactionVersion,
    durationMs,
    retryCount: providerRetryCount,
    validationCategory: providerValidationCategory || validationCategoryForExecution(execution),
    validationReason: providerValidationReason,
    executionProfile: providerMeasurement.executionProfile,
    providerRequestBytes: providerMeasurement.providerRequestBytes,
    providerEstimatedInputTokens: providerMeasurement.providerInputTokenEstimate,
    outputTokenCap: providerMeasurement.outputTokenCap,
    selectedFileCount: providerMeasurement.selectedFileCount,
    ...(productStrategistExecution ? {
      productUnderstandingAccepted: Boolean(productIntelligence?.understanding),
      productUnderstandingRejectionReason: productIntelligence?.understandingRejectionReason
        || (execution.error?.code === 'product-understanding-schema-rejected' ? 'invalid-understanding-shape' : undefined),
      parsedProductOpportunityCount: productValidationDiagnostics?.parsedOpportunityCount || 0,
      acceptedProductOpportunityCount,
      rejectedProductOpportunityCount: productIntelligence?.rejectedOpportunities.length || 0,
      rejectedProductOpportunityReasonCounts: productValidationDiagnostics?.rejectedOpportunityReasonCounts || {},
      compactEvidenceReferenceCount: productValidationDiagnostics?.compactEvidenceReferenceCount || 0,
      compactEvidenceReferenceRejectedCount: productValidationDiagnostics?.compactEvidenceReferenceRejectedCount || 0,
      compactCapabilityReferenceRejectedCount: productValidationDiagnostics?.compactCapabilityReferenceRejectedCount || 0,
      compactPathReferenceRejectedCount: productValidationDiagnostics?.compactPathReferenceRejectedCount || 0,
      compactSupportReferenceRejectedCount: productValidationDiagnostics?.compactSupportReferenceRejectedCount || 0,
    } : {}),
    ...providerResponseDiagnostics,
  });
  const hasAcceptedExecutionOutput = productStrategistExecution
    ? acceptedProductOpportunityCount >= 3 && acceptedProductOpportunityCount <= 5
    : Boolean(execution.result?.findings.length);
  if (execution.status === 'completed' && hasAcceptedExecutionOutput) {
    const warnings = execution.result.summary.rejectedFindings + execution.result.summary.acceptedWithLimitations
      + execution.result.summary.requiringHumanReview + execution.result.metadata.providerWarnings.length
      + execution.result.summary.validationMessages.length + config.configurationWarnings.length
      + (execution.result.productIntelligence?.rejectedOpportunities.length || 0);
    const enhancedDiagnostics = {
      ...diagnostics,
      actualInputTokens: execution.result.metadata.usage?.inputUnits,
      actualOutputTokens: execution.result.metadata.usage?.outputUnits,
      outputBytes: Buffer.byteLength(JSON.stringify(execution.result), 'utf8'),
      acceptedFindingCount: execution.result.findings.length + (execution.result.productIntelligence?.opportunities.length || 0),
      rejectedFindingCount: execution.result.rejectedFindings.length,
      validationWarningCount: warnings,
    };
    logger({
      event: 'repository_intelligence_provider',
      requestId: enhancedDiagnostics.requestId || 'ri-unavailable',
      providerId: config.provider,
      modelId: config.model,
      outcome: 'validated',
      durationMs,
      requestBytes: preparedContext.budget.requestBytes,
      retryCount: enhancedDiagnostics.retryCount || 0,
      repositoryIdentityHash: enhancedDiagnostics.reportIdentityHash,
      promptVersion: enhancedDiagnostics.promptVersion,
      schemaVersion: enhancedDiagnostics.schemaVersion,
      contextVersion: enhancedDiagnostics.contextVersion,
      redactionVersion: enhancedDiagnostics.redactionVersion,
      inputTokenEstimate: enhancedDiagnostics.estimatedInputTokens,
      outputUnits: enhancedDiagnostics.actualOutputTokens,
      outputBytes: enhancedDiagnostics.outputBytes,
      resultState: warnings ? 'completed-with-warnings' : 'completed',
      acceptedFindingCount: enhancedDiagnostics.acceptedFindingCount,
      rejectedFindingCount: enhancedDiagnostics.rejectedFindingCount,
      validationWarningCount: warnings,
      executionProfile: enhancedDiagnostics.executionProfile,
      providerRequestBytes: enhancedDiagnostics.providerRequestBytes,
      providerInputTokenEstimate: enhancedDiagnostics.providerEstimatedInputTokens,
      outputTokenCap: enhancedDiagnostics.outputTokenCap,
      selectedFileCount: enhancedDiagnostics.selectedFileCount,
    });
    return {
      status: 200,
      body: {
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
        state: 'enhanced',
        result: execution.result,
        providerId: execution.result.metadata.providerId,
        modelId: execution.result.metadata.modelId,
        deepState: warnings ? 'completed-with-warnings' : 'completed',
        diagnostics: enhancedDiagnostics,
      },
    };
  }
  if (execution.status === 'completed') return fallback(200, 'evidence_validation_failed', false, {
    ...diagnostics,
    validationCategory: productStrategistExecution && acceptedProductOpportunityCount < 3
      ? 'insufficient-product-opportunities'
      : diagnostics.validationCategory,
    acceptedFindingCount: execution.result?.findings.length || 0,
    rejectedFindingCount: execution.result?.rejectedFindings.length || 0,
    validationWarningCount: execution.result?.summary.validationMessages.length || 0,
  });
  if (execution.status === 'timeout') return fallback(200, 'request_timeout', true, diagnostics);
  if (execution.status === 'cancelled') return fallback(200, 'request_cancelled', true, diagnostics);
  const category = mapExecutionError(execution.error?.code);
  return fallback(200, category, execution.error?.retryable === true, diagnostics);
}

export function resolveProductionExecutionPolicy(
  request: RepositoryDeepIntelligenceRequest,
  configured: ProductionProviderPolicy,
): ProductionProviderPolicy {
  if (request.executionProfile !== 'product-strategist') return configured;
  return {
    ...configured,
    maximumInputTokens: Math.min(configured.maximumInputTokens, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumInputTokens),
    maximumSelectedFiles: Math.min(configured.maximumSelectedFiles, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumSelectedFiles),
    maximumExcerptBytesPerFile: Math.min(configured.maximumExcerptBytesPerFile, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumExcerptBytesPerFile),
    maximumContextBytes: Math.min(configured.maximumContextBytes, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumContextBytes),
    maximumContextCharacters: Math.min(configured.maximumContextCharacters, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumContextBytes),
    maximumRequestBytes: Math.min(configured.maximumRequestBytes, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumRequestBytes),
    maximumOutputTokens: Math.min(configured.maximumOutputTokens, PRODUCT_STRATEGIST_CONTEXT_POLICY.maximumOutputTokens),
    timeoutMs: Math.min(configured.timeoutMs, PRODUCT_STRATEGIST_CONTEXT_POLICY.timeoutMs),
  };
}

function mapExecutionError(code?: string): RepositoryIntelligenceProviderFailureCategory {
  if (code === 'rate_limited' || code === 'provider_unavailable' || code === 'authentication_failed'
    || code === 'response_too_large' || code === 'request_cancelled') return code;
  if (code === 'response-too-large') return 'response_too_large';
  if (['malformed-response', 'unsupported-schema', 'provider-mismatch', 'unsafe-provider-metadata', 'invalid_response',
    'request_preflight_rejected', 'provider_http_rejected', 'provider_envelope_invalid',
    'product-understanding-schema-rejected', 'product-opportunity-schema-rejected'].includes(code || '')) {
    return 'schema_validation_failed';
  }
  if (code === 'unsupported-capability') return 'schema_validation_failed';
  return 'unknown_provider_error';
}

function validationCategoryForExecution(execution: Awaited<ReturnType<typeof runRepositoryDeepIntelligence>>): RepositoryIntelligenceValidationCategory | undefined {
  if (execution.error?.code === 'request_preflight_rejected') return 'request-preflight-rejected';
  if (execution.error?.code === 'provider_http_rejected') return 'provider-http-rejected';
  if (execution.error?.code === 'provider_envelope_invalid') return 'provider-envelope-invalid';
  if (execution.error?.code === 'product-understanding-schema-rejected') return 'product-understanding-schema-rejected';
  if (execution.error?.code === 'product-opportunity-schema-rejected') return 'product-opportunity-schema-rejected';
  if (execution.status === 'invalid-response') return 'response-schema-rejected';
  if (execution.status === 'completed' && execution.result?.productIntelligence?.rejectedOpportunities.length) {
    return 'product-opportunity-schema-rejected';
  }
  return undefined;
}

function fallback(status: number, category: RepositoryIntelligenceProviderFailureCategory, retryable: boolean, diagnostics?: RepositoryIntelligenceSafeDiagnostics): { status: number; body: RepositoryIntelligenceProviderApiResponse } {
  return {
    status,
    body: {
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback' as const,
      category,
      retryable,
      message: category === 'request_cancelled'
        ? 'Deep analysis was cancelled. Deterministic repository intelligence remains ready.'
        : 'Deep analysis is unavailable. Deterministic repository intelligence remains ready for review.',
      deepState: deepStateFor(category),
      ...(diagnostics ? { diagnostics } : {}),
    },
  };
}

function deepStateFor(category: RepositoryIntelligenceProviderFailureCategory) {
  if (category === 'provider_disabled') return 'disabled' as const;
  if (category === 'credentials_missing' || category === 'configuration_invalid') return 'unavailable' as const;
  if (category === 'request_timeout') return 'timed-out' as const;
  if (category === 'budget_exceeded') return 'budget-exceeded' as const;
  if (category === 'evidence_validation_failed' || category === 'schema_validation_failed' || category === 'invalid_response' || category === 'redaction_failed') return 'rejected' as const;
  return 'failed' as const;
}

function diagnosticsFor(
  budget: ProductionDeepIntelligenceBudgetSummary,
  redaction: ProductionDeepIntelligenceRedactionSummary,
  extra: Partial<RepositoryIntelligenceSafeDiagnostics> = {},
): RepositoryIntelligenceSafeDiagnostics {
  return {
    estimatedInputTokens: budget.estimatedInputTokens,
    selectedFiles: budget.selectedFiles,
    includedContextBytes: budget.includedContextBytes,
    redactedValueCount: redaction.redactedValueCount,
    excludedContentCount: redaction.excludedContentCount,
    costEstimate: 'unavailable',
    cacheUsed: false,
    ...extra,
  };
}

function safeOperationalLogger(event: Parameters<ProductionProviderLogger>[0]) {
  console.info(JSON.stringify(event));
}

async function readJsonBody(req: VercelLikeRequest) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) throw new Error('payload-too-large');
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
  let input: unknown;
  try { input = await readJsonBody(req); } catch (error) {
    return sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, fallback(400, 'invalid_request', false).body);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.once('aborted', abort);
  try {
    const result = await prepareProductionRepositoryIntelligence(input, { signal: controller.signal });
    return sendJson(res, result.status, result.body);
  } finally {
    req.removeListener('aborted', abort);
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { runRepositoryDeepIntelligence } from '../src/lib/repositoryIntelligence/deepIntelligenceExecution.js';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryIntelligenceProviderFailureCategory,
  type RepositoryProductExpansionStageResult,
  type RepositoryProductProviderStage,
} from '../src/lib/repositoryIntelligence/productionProviderContract.js';
import {
  OpenAiCompatibleRepositoryDeepIntelligenceProvider,
  buildProductionProviderBody,
  measureProductionProviderBody,
  resolveProductionProviderConfig,
  validatePreparedProductionProviderRequest,
  validateProductionProviderRequest,
  type ProductionProviderLogger,
} from './_lib/repositoryDeepIntelligenceProvider.js';
import { RepositoryDeepIntelligenceProviderError } from '../src/lib/repositoryIntelligence/deepIntelligenceProvider.js';
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
  RepositoryIntelligenceFailureBoundary,
  RepositoryIntelligenceOperationalFailureCategory,
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
  const logger = options.logger || safeOperationalLogger;
  const earlyMetadata = readSafeStageMetadata(input);
  const earlyRequestId = createOperationalRequestId(earlyMetadata.fingerprint || 'unvalidated', earlyMetadata.stage);
  let config;
  try { config = resolveProductionProviderConfig(options.env); } catch {
    logEarlyOperationalFailure(logger, earlyRequestId, earlyMetadata, 'configuration_invalid', 'configuration');
    return fallback(503, 'configuration_invalid', false, earlyFailureDiagnostics(earlyRequestId, earlyMetadata, 'configuration_invalid'));
  }
  if (!config.enabled) {
    logEarlyOperationalFailure(logger, earlyRequestId, earlyMetadata, 'configuration_invalid', 'configuration', config.provider, config.model);
    return fallback(200, 'provider_disabled', false, earlyFailureDiagnostics(earlyRequestId, earlyMetadata, 'configuration_invalid'));
  }
  if (!config.apiKey || !config.model) {
    logEarlyOperationalFailure(logger, earlyRequestId, earlyMetadata, 'credentials_missing', 'configuration', config.provider, config.model);
    return fallback(200, 'credentials_missing', false, earlyFailureDiagnostics(earlyRequestId, earlyMetadata, 'credentials_missing'));
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || (input as { version?: unknown }).version !== REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION) {
    return fallback(400, 'invalid_request', false);
  }
  const requestValidation = validateProductionProviderRequest((input as { request?: unknown }).request, config.policy, {
    allowSensitiveContent: true,
    allowConfiguredBudgetOverflow: true,
  });
  if (!requestValidation.valid) return fallback(400, 'invalid_request', false);
  const productStageValidation = validateProductStage(
    requestValidation.request,
    (input as { productStage?: unknown }).productStage,
  );
  if (!productStageValidation.valid) return fallback(400, 'invalid_request', false);
  const productStage = productStageValidation.stage;
  const requestId = createOperationalRequestId(productStage?.fingerprint || requestValidation.request.fingerprint, productStage?.kind);
  const executionPolicy = resolveProductionExecutionPolicy(requestValidation.request, config.policy);
  const executionConfig = {
    ...config,
    policy: productStage ? { ...executionPolicy, timeoutMs: Math.min(executionPolicy.timeoutMs, 35_000) } : executionPolicy,
  };
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
        requestId,
        requestFingerprint: productStage?.fingerprint || preparedContext.request.fingerprint,
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
    const providerBody = buildProductionProviderBody(preparedContext.request, executionConfig, { productStage });
    providerMeasurement = measureProductionProviderBody(preparedContext.request, executionConfig, providerBody);
  } catch {
    return fallback(200, 'schema_validation_failed', false, diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
      executionProfile: preparedContext.request.executionProfile,
      validationCategory: 'request-preflight-rejected',
    }));
  }
  let providerRetryCount = 0;
  let languageRepairCount = 0;
  let providerValidationCategory: RepositoryIntelligenceValidationCategory | undefined;
  let providerValidationReason: RepositoryIntelligenceValidationReason | undefined;
  let providerResponseDiagnostics: Partial<RepositoryIntelligenceSafeDiagnostics> = {};
  const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
    config: executionConfig,
    fetcher: options.fetcher,
    productStage,
    requestId,
    logger: event => {
      providerRetryCount = Math.max(providerRetryCount, event.retryCount);
      if (event.statusCategory === 'generated_language_repair') languageRepairCount += 1;
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
        ...(event.providerHttpStatusCategory === undefined ? {} : { providerHttpStatusCategory: event.providerHttpStatusCategory }),
        ...(event.operationalFailureCategory === undefined ? {} : { operationalFailureCategory: event.operationalFailureCategory }),
        ...(event.failureBoundary === undefined ? {} : { failureBoundary: event.failureBoundary }),
      };
      logger(event);
    },
  });
  const startedAt = Date.now();
  if (productStage?.kind === 'expansion') {
    return executeProductExpansionStage({
      provider,
      request: preparedContext.request,
      stage: productStage,
      timeoutMs: executionConfig.policy.timeoutMs,
      signal: options.signal,
      providerId: config.provider,
      modelId: config.model,
      logger,
      requestId,
      diagnostics: () => diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
        requestId,
        requestFingerprint: productStage.fingerprint,
        reportIdentityHash: stableContextFingerprint(preparedContext.request.repository),
        providerType: config.provider,
        promptVersion: preparedContext.request.promptContractVersion,
        schemaVersion: preparedContext.request.responseSchemaVersion,
        contextVersion: preparedContext.request.transmission?.contextVersion || preparedContext.request.selectionPolicyVersion,
        redactionVersion: preparedContext.request.transmission?.redactionVersion,
        retryCount: providerRetryCount,
        languageRepairCount,
        executionProfile: providerMeasurement.executionProfile,
        providerRequestBytes: providerMeasurement.providerRequestBytes,
        providerEstimatedInputTokens: providerMeasurement.providerInputTokenEstimate,
        outputTokenCap: providerMeasurement.outputTokenCap,
        selectedFileCount: providerMeasurement.selectedFileCount,
        productStage: 'expansion',
        stageFingerprint: productStage.fingerprint,
        expansionBatchIndex: productStage.batchIndex,
        expansionBatchCount: productStage.totalBatches,
        expansionParentFutureIds: productStage.parents.map(parent => parent.id),
        expansionParentCount: productStage.parents.length,
        ...providerResponseDiagnostics,
      }),
    });
  }
  const execution = await runRepositoryDeepIntelligence({
    provider,
    request: preparedContext.request,
    signal: options.signal,
    timeoutMs: executionConfig.policy.timeoutMs,
  });
  const durationMs = Math.max(0, Date.now() - startedAt);
  const productStrategistExecution = preparedContext.request.executionProfile === 'product-strategist';
  const productIntelligence = execution.result?.productIntelligence;
  const productValidationDiagnostics = productIntelligence?.validationDiagnostics;
  const acceptedProductOpportunityCount = productIntelligence?.opportunities.length || 0;
  const operationalFailure = operationalFailureForExecution(execution, productStage);
  const diagnostics = diagnosticsFor(preparedContext.budget, preparedContext.redaction, {
    requestId,
    requestFingerprint: productStage?.fingerprint || preparedContext.request.fingerprint,
    reportIdentityHash: stableContextFingerprint(preparedContext.request.repository),
    providerType: config.provider,
    promptVersion: preparedContext.request.promptContractVersion,
    schemaVersion: preparedContext.request.responseSchemaVersion,
    contextVersion: preparedContext.request.transmission?.contextVersion || preparedContext.request.selectionPolicyVersion,
    redactionVersion: preparedContext.request.transmission?.redactionVersion,
    durationMs,
    retryCount: providerRetryCount,
    languageRepairCount,
    validationCategory: providerValidationCategory || validationCategoryForExecution(execution),
    validationReason: providerValidationReason,
    executionProfile: providerMeasurement.executionProfile,
    providerRequestBytes: providerMeasurement.providerRequestBytes,
    providerEstimatedInputTokens: providerMeasurement.providerInputTokenEstimate,
    outputTokenCap: providerMeasurement.outputTokenCap,
    selectedFileCount: providerMeasurement.selectedFileCount,
    ...(productStage ? { productStage: productStage.kind, stageFingerprint: productStage.fingerprint } : {}),
    ...(productStrategistExecution ? {
      acceptedRootCount: acceptedProductOpportunityCount,
      rejectedRootCount: productIntelligence?.rejectedOpportunities.length || 0,
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
    ...operationalFailure,
    ...providerResponseDiagnostics,
  });
  const hasAcceptedExecutionOutput = productStrategistExecution
    ? acceptedProductOpportunityCount >= (productStage?.kind === 'roots' ? 6 : 3) && acceptedProductOpportunityCount <= 8
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
      requestFingerprint: enhancedDiagnostics.requestFingerprint,
      productStage: productStage?.kind,
      stageFingerprint: productStage?.fingerprint,
      acceptedRootCount: productStage?.kind === 'roots' ? acceptedProductOpportunityCount : undefined,
      rejectedRootCount: productStage?.kind === 'roots' ? productIntelligence?.rejectedOpportunities.length || 0 : undefined,
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
    operationalFailureCategory: 'evidence_validation_failed',
    failureBoundary: 'evidence-normalization',
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

function validateProductStage(
  request: RepositoryDeepIntelligenceRequest,
  input: unknown,
): { valid: true; stage?: RepositoryProductProviderStage } | { valid: false } {
  if (input === undefined) return { valid: true };
  if (request.executionProfile !== 'product-strategist' || !input || typeof input !== 'object' || Array.isArray(input)) return { valid: false };
  const stage = input as Partial<RepositoryProductProviderStage>;
  if (stage.kind === 'roots' && typeof stage.fingerprint === 'string') {
    const expected = stableContextFingerprint({ version: REPOSITORY_PRODUCT_PIPELINE_VERSION, report: request.fingerprint, stage: 'roots' });
    return stage.fingerprint === expected ? { valid: true, stage: stage as RepositoryProductProviderStage } : { valid: false };
  }
  if (stage.kind !== 'expansion' || typeof stage.fingerprint !== 'string'
    || !Number.isInteger(stage.batchIndex) || !Number.isInteger(stage.totalBatches)
    || (stage.batchIndex ?? -1) < 0 || (stage.totalBatches ?? 0) < 1 || (stage.batchIndex ?? 0) >= (stage.totalBatches ?? 0)
    || !Array.isArray(stage.parents) || stage.parents.length < 1 || stage.parents.length > 3) return { valid: false };
  const evidence = new Set(request.evidenceReferences.map(item => item.id));
  if (stage.parents.some(parent => !parent || typeof parent.id !== 'string' || parent.id.length < 8 || parent.id.length > 200
    || typeof parent.title !== 'string' || parent.title.length > 120
    || typeof parent.opportunityStatement !== 'string' || parent.opportunityStatement.length > 2_000
    || typeof parent.userValue !== 'string' || parent.userValue.length > 2_000
    || typeof parent.whyItFits !== 'string' || parent.whyItFits.length > 2_000
    || !Array.isArray(parent.evidenceIds) || parent.evidenceIds.some(id => !evidence.has(id)))) return { valid: false };
  const expected = stableContextFingerprint({
    version: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    report: request.fingerprint,
    stage: 'expansion',
    parents: stage.parents.map(parent => ({ id: parent.id, evidenceIds: [...parent.evidenceIds].sort() })),
  });
  return stage.fingerprint === expected ? { valid: true, stage: stage as RepositoryProductProviderStage } : { valid: false };
}

async function executeProductExpansionStage(input: {
  provider: OpenAiCompatibleRepositoryDeepIntelligenceProvider;
  request: RepositoryDeepIntelligenceRequest;
  stage: Extract<RepositoryProductProviderStage, { kind: 'expansion' }>;
  timeoutMs: number;
  signal?: AbortSignal;
  providerId: string;
  modelId: string;
  logger: ProductionProviderLogger;
  requestId: string;
  diagnostics: () => RepositoryIntelligenceSafeDiagnostics;
}): Promise<{ status: number; body: RepositoryIntelligenceProviderApiResponse }> {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  input.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, input.timeoutMs);
  const startedAt = Date.now();
  try {
    const raw = await input.provider.analyze(input.request, { signal: controller.signal });
    const result = raw as Partial<RepositoryProductExpansionStageResult>;
    if (result.pipelineVersion !== REPOSITORY_PRODUCT_PIPELINE_VERSION || result.stage !== 'expansion'
      || result.fingerprint !== input.stage.fingerprint || result.batchIndex !== input.stage.batchIndex
      || result.totalBatches !== input.stage.totalBatches || !Array.isArray(result.expansions)
      || result.expansions.length !== input.stage.parents.length) {
      const diagnostics = { ...input.diagnostics(), durationMs: Date.now() - startedAt, schemaValidationFailureCount: 1, operationalFailureCategory: 'expansion_schema_failed' as const, failureBoundary: 'schema-validation' as const };
      logExpansionValidation(input, 'failure', diagnostics, 0, 0);
      return fallback(200, 'schema_validation_failed', true, diagnostics);
    }
    const secondGeneration = result.expansions.flatMap(item => item.evolutions || []).filter(item => item.generation === 2).length;
    const thirdGeneration = result.expansions.flatMap(item => item.evolutions || []).filter(item => item.generation === 3).length;
    if (result.expansions.some(item => !input.stage.parents.some(parent => parent.id === item.parentId)
      || item.evolutions.filter(evolution => evolution.generation === 2).length < 2)) {
      const diagnostics = { ...input.diagnostics(), durationMs: Date.now() - startedAt, schemaValidationFailureCount: 1, operationalFailureCategory: 'expansion_schema_failed' as const, failureBoundary: 'schema-validation' as const };
      logExpansionValidation(input, 'failure', diagnostics, secondGeneration, thirdGeneration);
      return fallback(200, 'schema_validation_failed', true, diagnostics);
    }
    const diagnostics = {
      ...input.diagnostics(),
      durationMs: Math.max(0, Date.now() - startedAt),
      outputBytes: Buffer.byteLength(JSON.stringify(result), 'utf8'),
      acceptedSecondGenerationCount: secondGeneration,
      acceptedThirdGenerationCount: thirdGeneration,
    };
    logExpansionValidation(input, 'validated', diagnostics, secondGeneration, thirdGeneration);
    return {
      status: 200,
      body: {
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
        state: 'stage-enhanced',
        stageResult: result as RepositoryProductExpansionStageResult,
        providerId: input.providerId,
        modelId: input.modelId,
        deepState: 'completed',
        diagnostics,
      },
    };
  } catch (error) {
    const cancelled = input.signal?.aborted;
    const category = timedOut ? 'request_timeout' : cancelled ? 'request_cancelled'
      : error instanceof RepositoryDeepIntelligenceProviderError ? mapExecutionError(error.code) : 'unknown_provider_error';
    const operational = operationalFailureForProviderCategory(category, error);
    return fallback(200, category, category !== 'authentication_failed', {
      ...input.diagnostics(),
      durationMs: Math.max(0, Date.now() - startedAt),
      providerTimedOut: timedOut,
      ...operational,
    });
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', onAbort);
  }
}

function mapExecutionError(code?: string): RepositoryIntelligenceProviderFailureCategory {
  if (code === 'rate_limited' || code === 'provider_unavailable' || code === 'authentication_failed'
    || code === 'response_too_large' || code === 'request_cancelled') return code;
  if (code === 'response-too-large') return 'response_too_large';
  if (['malformed-response', 'unsupported-schema', 'provider-mismatch', 'unsafe-provider-metadata', 'invalid_response',
    'request_preflight_rejected', 'provider_http_rejected', 'provider_envelope_invalid', 'language_validation_failed',
    'product-understanding-schema-rejected', 'product-opportunity-schema-rejected'].includes(code || '')) {
    return 'schema_validation_failed';
  }
  if (code === 'unsupported-capability') return 'schema_validation_failed';
  return 'unknown_provider_error';
}

function operationalFailureForExecution(
  execution: Awaited<ReturnType<typeof runRepositoryDeepIntelligence>>,
  stage?: RepositoryProductProviderStage,
): Partial<RepositoryIntelligenceSafeDiagnostics> {
  if (execution.status === 'completed') return {};
  if (execution.status === 'timeout') return { operationalFailureCategory: 'provider_timeout', failureBoundary: 'provider-generation', providerTimedOut: true };
  if (execution.status === 'cancelled') return { operationalFailureCategory: 'cancelled', failureBoundary: 'provider-generation' };
  const code = execution.error?.code;
  if (code === 'provider_envelope_invalid') return { operationalFailureCategory: 'invalid_provider_envelope', failureBoundary: 'provider-envelope' };
  if (code === 'language_validation_failed') return { operationalFailureCategory: 'language_validation_failed', failureBoundary: 'language-validation' };
  if (code === 'rate_limited') return { operationalFailureCategory: 'provider_rate_limited', failureBoundary: 'provider-http' };
  if (code === 'provider_unavailable') return { operationalFailureCategory: 'provider_unavailable', failureBoundary: 'provider-http' };
  if (code === 'product-understanding-schema-rejected' || code === 'product-opportunity-schema-rejected'
    || execution.status === 'invalid-response') {
    return {
      operationalFailureCategory: stage?.kind === 'roots' ? 'roots_schema_failed' : 'structured_output_rejected',
      failureBoundary: 'schema-validation',
    };
  }
  return { operationalFailureCategory: 'structured_output_rejected', failureBoundary: 'schema-validation' };
}

function operationalFailureForProviderCategory(
  category: RepositoryIntelligenceProviderFailureCategory,
  error: unknown,
): Partial<RepositoryIntelligenceSafeDiagnostics> {
  if (category === 'request_timeout') return { operationalFailureCategory: 'provider_timeout', failureBoundary: 'provider-generation' };
  if (category === 'request_cancelled') return { operationalFailureCategory: 'cancelled', failureBoundary: 'provider-generation' };
  if (category === 'rate_limited') return { operationalFailureCategory: 'provider_rate_limited', failureBoundary: 'provider-http' };
  if (category === 'provider_unavailable') return { operationalFailureCategory: 'provider_unavailable', failureBoundary: 'provider-http' };
  if (error instanceof RepositoryDeepIntelligenceProviderError && error.code === 'provider_envelope_invalid') {
    return { operationalFailureCategory: 'invalid_provider_envelope', failureBoundary: 'provider-envelope' };
  }
  if (error instanceof RepositoryDeepIntelligenceProviderError && error.code === 'language_validation_failed') {
    return { operationalFailureCategory: 'language_validation_failed', failureBoundary: 'language-validation' };
  }
  return { operationalFailureCategory: 'expansion_schema_failed', failureBoundary: 'schema-validation' };
}

function logExpansionValidation(
  input: Parameters<typeof executeProductExpansionStage>[0],
  outcome: 'validated' | 'failure',
  diagnostics: RepositoryIntelligenceSafeDiagnostics,
  secondGeneration: number,
  thirdGeneration: number,
) {
  input.logger({
    event: 'repository_intelligence_provider',
    requestId: input.requestId,
    providerId: input.providerId,
    modelId: input.modelId,
    outcome,
    durationMs: diagnostics.durationMs || 0,
    requestBytes: diagnostics.providerRequestBytes || 0,
    retryCount: diagnostics.retryCount || 0,
    statusCategory: diagnostics.operationalFailureCategory,
    requestFingerprint: input.stage.fingerprint,
    productStage: 'expansion',
    stageFingerprint: input.stage.fingerprint,
    expansionBatchIndex: input.stage.batchIndex,
    expansionBatchCount: input.stage.totalBatches,
    parentFutureIds: input.stage.parents.map(parent => parent.id),
    parentFutureCount: input.stage.parents.length,
    outputBytes: diagnostics.outputBytes,
    providerRequestBytes: diagnostics.providerRequestBytes,
    providerInputTokenEstimate: diagnostics.providerEstimatedInputTokens,
    providerPromptTokens: diagnostics.providerPromptTokens,
    providerCompletionTokens: diagnostics.providerCompletionTokens,
    providerReasoningTokens: diagnostics.providerReasoningTokens,
    providerTotalTokens: diagnostics.providerTotalTokens,
    providerFinishReason: diagnostics.providerFinishReason,
    providerModelId: diagnostics.providerModelId,
    validationCategory: diagnostics.validationCategory,
    validationReason: diagnostics.validationReason,
    operationalFailureCategory: diagnostics.operationalFailureCategory,
    failureBoundary: diagnostics.failureBoundary,
    acceptedSecondGenerationCount: secondGeneration,
    acceptedThirdGenerationCount: thirdGeneration,
  });
}

function createOperationalRequestId(fingerprint: string, stage?: RepositoryProductProviderStage['kind']) {
  return `ri-${stage || 'general'}-${fingerprint.slice(0, 10)}-${randomUUID().slice(0, 8)}`;
}

function readSafeStageMetadata(input: unknown): {
  fingerprint?: string;
  stage?: RepositoryProductProviderStage['kind'];
  batchIndex?: number;
  parentIds: string[];
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { parentIds: [] };
  const candidate = input as { request?: unknown; productStage?: unknown };
  const request = candidate.request && typeof candidate.request === 'object' && !Array.isArray(candidate.request)
    ? candidate.request as { fingerprint?: unknown }
    : undefined;
  const stage = candidate.productStage && typeof candidate.productStage === 'object' && !Array.isArray(candidate.productStage)
    ? candidate.productStage as { kind?: unknown; fingerprint?: unknown; batchIndex?: unknown; parents?: unknown }
    : undefined;
  const kind = stage?.kind === 'roots' || stage?.kind === 'expansion' ? stage.kind : undefined;
  const fingerprint = typeof stage?.fingerprint === 'string' && stage.fingerprint.length <= 160
    ? stage.fingerprint
    : typeof request?.fingerprint === 'string' && request.fingerprint.length <= 160 ? request.fingerprint : undefined;
  const parentIds = Array.isArray(stage?.parents)
    ? stage.parents.flatMap(parent => {
      if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return [];
      const id = (parent as { id?: unknown }).id;
      return typeof id === 'string' && /^[a-z0-9:._-]{1,160}$/i.test(id) ? [id] : [];
    }).slice(0, 3)
    : [];
  return {
    fingerprint,
    stage: kind,
    batchIndex: typeof stage?.batchIndex === 'number' ? stage.batchIndex : undefined,
    parentIds,
  };
}

function earlyFailureDiagnostics(
  requestId: string,
  metadata: ReturnType<typeof readSafeStageMetadata>,
  category: RepositoryIntelligenceOperationalFailureCategory,
): RepositoryIntelligenceSafeDiagnostics {
  return {
    requestId,
    requestFingerprint: metadata.fingerprint,
    productStage: metadata.stage,
    stageFingerprint: metadata.fingerprint,
    expansionBatchIndex: metadata.batchIndex,
    expansionParentFutureIds: metadata.parentIds,
    expansionParentCount: metadata.parentIds.length,
    operationalFailureCategory: category,
    failureBoundary: 'configuration',
    costEstimate: 'unavailable',
  };
}

function logEarlyOperationalFailure(
  logger: ProductionProviderLogger,
  requestId: string,
  metadata: ReturnType<typeof readSafeStageMetadata>,
  category: RepositoryIntelligenceOperationalFailureCategory,
  boundary: RepositoryIntelligenceFailureBoundary,
  providerId = 'unavailable',
  modelId = 'unavailable',
) {
  logger({
    event: 'repository_intelligence_provider',
    requestId,
    providerId,
    modelId,
    outcome: 'failure',
    durationMs: 0,
    requestBytes: 0,
    retryCount: 0,
    statusCategory: category,
    requestFingerprint: metadata.fingerprint,
    productStage: metadata.stage,
    stageFingerprint: metadata.fingerprint,
    expansionBatchIndex: metadata.batchIndex,
    parentFutureIds: metadata.parentIds,
    parentFutureCount: metadata.parentIds.length,
    operationalFailureCategory: category,
    failureBoundary: boundary,
  });
}

function validationCategoryForExecution(execution: Awaited<ReturnType<typeof runRepositoryDeepIntelligence>>): RepositoryIntelligenceValidationCategory | undefined {
  if (execution.error?.code === 'request_preflight_rejected') return 'request-preflight-rejected';
  if (execution.error?.code === 'provider_http_rejected') return 'provider-http-rejected';
  if (execution.error?.code === 'provider_envelope_invalid') return 'provider-envelope-invalid';
  if (execution.error?.code === 'product-understanding-schema-rejected') return 'product-understanding-schema-rejected';
  if (execution.error?.code === 'product-opportunity-schema-rejected') return 'product-opportunity-schema-rejected';
  if (execution.error?.code === 'language_validation_failed') return 'response-schema-rejected';
  if (execution.error?.code === 'invalid_response') return 'response-schema-rejected';
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

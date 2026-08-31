import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { runRepositoryDeepIntelligence } from '../src/lib/repositoryIntelligence/deepIntelligenceExecution.js';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryIntelligenceProviderFailureCategory,
  type RepositoryProductFinalizationApiRequest,
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
import {
  REPOSITORY_FUTURES_TIMING,
  repositoryProductProviderTimeoutMs,
} from '../src/lib/repositoryIntelligence/productFuturesTiming.js';
import { buildRepositoryProductRootStageForFingerprint } from '../src/lib/repositoryIntelligence/stagedProductIntelligence.js';
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
import { AI_USAGE_DENIAL_CATEGORIES } from '../src/lib/entitlements/contract.js';
import {
  AiUsageAuthorizationService,
  AiUsageDeniedError,
  type AuthorizedAiStage,
} from './_lib/aiUsage.js';
import { readAccountSession } from './_lib/accountSession.js';

const MAX_BODY_BYTES = 900 * 1024;
type VercelLikeRequest = IncomingMessage & { body?: unknown };

type ProductionRepositoryIntelligenceResult = Awaited<ReturnType<typeof prepareProductionRepositoryIntelligence>>;

export class RepositoryIntelligenceServerStageSingleFlight {
  private readonly active = new Map<string, Promise<ProductionRepositoryIntelligenceResult>>();

  run(key: string | undefined, task: () => Promise<ProductionRepositoryIntelligenceResult>) {
    if (!key) return { duplicateSuppressed: false, promise: task() };
    const existing = this.active.get(key);
    if (existing) return { duplicateSuppressed: true, promise: existing };
    const promise = task().finally(() => {
      if (this.active.get(key) === promise) this.active.delete(key);
    });
    this.active.set(key, promise);
    return { duplicateSuppressed: false, promise };
  }
}

const serverStageSingleFlight = new RepositoryIntelligenceServerStageSingleFlight();

export function buildAuthenticatedStageSingleFlightKey(userId: string, stageAttemptKey?: string) {
  return stageAttemptKey ? stableContextFingerprint({ userId, stageAttemptKey }) : undefined;
}

export interface PrepareProductionRepositoryIntelligenceOptions {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  logger?: ProductionProviderLogger;
  signal?: AbortSignal;
  aiAuthorization?: {
    userId: string;
    service: AiUsageAuthorizationService;
    recoveryOperationId?: string;
  };
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
  // Product pipeline identity is established by the validated ShipSeal request.
  // Provider preparation is allowed to produce a different transmission fingerprint.
  const analysisFingerprint = requestValidation.request.fingerprint;
  const stageAttemptKey = readStageAttemptKey(input);
  const requestId = createOperationalRequestId(productStage?.fingerprint || requestValidation.request.fingerprint, productStage?.kind);
  const executionPolicy = resolveProductionExecutionPolicy(requestValidation.request, config.policy);
  const timedProductStage = requestValidation.request.executionProfile === 'product-strategist'
    ? productStage?.kind || 'roots'
    : undefined;
  const configuredProviderTimeoutMs = timedProductStage
    ? repositoryProductProviderTimeoutMs(timedProductStage)
    : executionPolicy.timeoutMs;
  const executionConfig = {
    ...config,
    policy: { ...executionPolicy, timeoutMs: configuredProviderTimeoutMs },
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
  const providerTransmissionFingerprint = preparedContext.request.fingerprint;
  const fingerprintDiagnostics = {
    analysisFingerprint,
    providerTransmissionFingerprint,
    ...(timedProductStage ? {
      configuredProviderTimeoutMs,
      clientDeadlineMs: REPOSITORY_FUTURES_TIMING.browserStageTimeoutMs,
      serverlessDeadlineMs: REPOSITORY_FUTURES_TIMING.functionMaxDurationMs,
    } : {}),
  } satisfies Partial<RepositoryIntelligenceSafeDiagnostics>;
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
      ...fingerprintDiagnostics,
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
        ...fingerprintDiagnostics,
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
      ...fingerprintDiagnostics,
      executionProfile: preparedContext.request.executionProfile,
      validationCategory: 'request-preflight-rejected',
    }));
  }
  let authorizedStage: AuthorizedAiStage | undefined;
  if (options.aiAuthorization) {
    try {
      authorizedStage = await options.aiAuthorization.service.authorize(
        options.aiAuthorization.userId,
        preparedContext.request,
        productStage,
        {
          analysisFingerprint: preparedContext.request.executionProfile === 'product-strategist'
            ? analysisFingerprint
            : undefined,
          recoveryOperationId: options.aiAuthorization.recoveryOperationId,
        },
      );
    } catch (error) {
      if (error instanceof AiUsageDeniedError) return usageDenialFallback(error, fingerprintDiagnostics);
      return usageDenialFallback(new AiUsageDeniedError(
        'usage_temporarily_unavailable',
        503,
        true,
        'AI usage authorization is temporarily unavailable.',
      ), fingerprintDiagnostics);
    }
    if (authorizedStage.cachedResponse) {
      return {
        status: 200,
        body: {
          ...authorizedStage.cachedResponse,
          diagnostics: {
            ...(authorizedStage.cachedResponse.diagnostics || { costEstimate: 'unavailable' as const }),
            ...fingerprintDiagnostics,
            cacheUsed: true,
            publicOperationId: authorizedStage.publicOperationId,
            stageAttempt: authorizedStage.stageAttemptCount,
            operationRecoveryAction: 'open_result',
          },
        } as RepositoryIntelligenceProviderApiResponse,
      };
    }
  }
  const completeAuthorizedStage = async (result: { status: number; body: RepositoryIntelligenceProviderApiResponse }) => {
    if (!authorizedStage || !options.aiAuthorization) return result;
    const durableResult = {
      ...result,
      body: {
        ...result.body,
        diagnostics: {
          ...(result.body.diagnostics || { costEstimate: 'unavailable' as const }),
          ...fingerprintDiagnostics,
          publicOperationId: authorizedStage.publicOperationId,
          stageAttempt: authorizedStage.stageAttemptCount,
          ...(authorizedStage.integrityRecovery ? { operationRecoveryAction: 'integrity_recovery' as const } : {}),
        },
      } as RepositoryIntelligenceProviderApiResponse,
    };
    try {
      await options.aiAuthorization.service.complete(authorizedStage, options.aiAuthorization.userId, durableResult.body);
    } catch {
      return usageDenialFallback(new AiUsageDeniedError(
        'usage_temporarily_unavailable',
        503,
        true,
        'AI usage authorization is temporarily unavailable.',
      ), fingerprintDiagnostics);
    }
    const operation = await options.aiAuthorization.service.getOperationStatus(
      options.aiAuthorization.userId,
      { publicOperationId: authorizedStage.publicOperationId },
    ).catch(() => null);
    if (!operation) return durableResult;
    return {
      ...durableResult,
      body: {
        ...durableResult.body,
        diagnostics: {
          ...(durableResult.body.diagnostics || { costEstimate: 'unavailable' as const }),
          operationRecoveryAction: operation.recoveryAction,
          operationCompletionState: operation.completionState,
          operationUserUnitState: operation.userUnitState,
          completedBatchCount: operation.completedExpansionCount,
          ...(operation.expectedExpansionCount === null ? {} : { totalBatchCount: operation.expectedExpansionCount }),
          ...(operation.leaseExpiresAt ? { operationLeaseExpiresAt: operation.leaseExpiresAt } : {}),
        },
      } as RepositoryIntelligenceProviderApiResponse,
    };
  };
  let providerRetryCount = 0;
  let languageRepairCount = 0;
  let providerValidationCategory: RepositoryIntelligenceValidationCategory | undefined;
  let providerValidationReason: RepositoryIntelligenceValidationReason | undefined;
  let providerResponseDiagnostics: Partial<RepositoryIntelligenceSafeDiagnostics> = {
    ...(stageAttemptKey ? { stageAttemptKey, duplicateSuppressed: false } : {}),
  };
  const provider = new OpenAiCompatibleRepositoryDeepIntelligenceProvider({
    config: executionConfig,
    fetcher: authorizedStage && options.aiAuthorization
      ? options.aiAuthorization.service.guardProviderFetcher(authorizedStage, options.fetcher)
      : options.fetcher,
    productStage,
    requestId,
    logger: event => {
      providerRetryCount = Math.max(providerRetryCount, event.retryCount);
      if (event.statusCategory === 'generated_language_repair') languageRepairCount += 1;
      if (event.validationCategory) providerValidationCategory = event.validationCategory;
      if (event.validationReason) providerValidationReason = event.validationReason;
      providerResponseDiagnostics = {
        ...providerResponseDiagnostics,
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
        ...(event.languageValidation === undefined ? {} : { languageValidation: event.languageValidation }),
        ...(event.expansionSchemaValidation === undefined ? {} : { expansionSchemaValidation: event.expansionSchemaValidation }),
        ...(event.expansionResponseShape === undefined ? {} : { expansionResponseShape: event.expansionResponseShape }),
        ...(event.rateLimitAttempt === undefined ? {} : { rateLimitAttempt: event.rateLimitAttempt }),
        ...(event.retryAfterMs === undefined ? {} : { retryAfterMs: event.retryAfterMs }),
        ...(event.rateLimitResetRequestsMs === undefined ? {} : { rateLimitResetRequestsMs: event.rateLimitResetRequestsMs }),
        ...(event.rateLimitResetTokensMs === undefined ? {} : { rateLimitResetTokensMs: event.rateLimitResetTokensMs }),
        ...(event.rateLimitRemainingRequests === undefined ? {} : { rateLimitRemainingRequests: event.rateLimitRemainingRequests }),
        ...(event.rateLimitRemainingTokens === undefined ? {} : { rateLimitRemainingTokens: event.rateLimitRemainingTokens }),
        ...(event.rateLimitLimitRequests === undefined ? {} : { rateLimitLimitRequests: event.rateLimitLimitRequests }),
        ...(event.rateLimitLimitTokens === undefined ? {} : { rateLimitLimitTokens: event.rateLimitLimitTokens }),
        ...(event.rateLimitType === undefined ? {} : { rateLimitType: event.rateLimitType }),
      };
      logger({ ...event, ...(stageAttemptKey ? { stageAttemptKey } : {}) });
    },
  });
  const startedAt = Date.now();
  if (productStage?.kind === 'expansion') {
    return completeAuthorizedStage(await executeProductExpansionStage({
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
        ...fingerprintDiagnostics,
        requestId,
        requestFingerprint: productStage.fingerprint,
        reportIdentityHash: stableContextFingerprint(preparedContext.request.repository),
        providerType: config.provider,
        promptVersion: preparedContext.request.promptContractVersion,
        schemaVersion: preparedContext.request.responseSchemaVersion,
        contextVersion: preparedContext.request.transmission?.contextVersion || preparedContext.request.selectionPolicyVersion,
        redactionVersion: preparedContext.request.transmission?.redactionVersion,
        retryCount: providerRetryCount,
        stageAttempt: authorizedStage?.stageAttemptCount,
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
    }));
  }
  const execution = await runRepositoryDeepIntelligence({
    provider,
    request: preparedContext.request,
    analysisFingerprint: preparedContext.request.executionProfile === 'product-strategist'
      ? analysisFingerprint
      : undefined,
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
    ...fingerprintDiagnostics,
    requestId,
    requestFingerprint: productStage?.fingerprint || preparedContext.request.fingerprint,
    reportIdentityHash: stableContextFingerprint(preparedContext.request.repository),
    providerType: config.provider,
    promptVersion: preparedContext.request.promptContractVersion,
    schemaVersion: preparedContext.request.responseSchemaVersion,
    contextVersion: preparedContext.request.transmission?.contextVersion || preparedContext.request.selectionPolicyVersion,
    redactionVersion: preparedContext.request.transmission?.redactionVersion,
    durationMs,
    elapsedMs: durationMs,
    stageAttempt: authorizedStage?.stageAttemptCount,
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
      compactOpportunityContract: productValidationDiagnostics?.compactOpportunityContract,
      compactOpportunityShapeRejectedCount: productValidationDiagnostics?.compactOpportunityShapeRejectedCount || 0,
      compactOpportunityShapeIssueFields: productValidationDiagnostics?.compactOpportunityShapeIssueFields || [],
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
    return completeAuthorizedStage({
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
    });
  }
  if (execution.status === 'completed') {
    const shapeRejectedCount = productValidationDiagnostics?.compactOpportunityShapeRejectedCount
      || productValidationDiagnostics?.rejectedOpportunityReasonCounts['invalid-shape'] || 0;
    const referenceRejectedCount = (productValidationDiagnostics?.compactEvidenceReferenceRejectedCount || 0)
      + (productValidationDiagnostics?.compactCapabilityReferenceRejectedCount || 0)
      + (productValidationDiagnostics?.compactPathReferenceRejectedCount || 0)
      + (productValidationDiagnostics?.compactSupportReferenceRejectedCount || 0);
    const responseShapeFailure = productStrategistExecution && shapeRejectedCount > 0 && referenceRejectedCount === 0;
    const failureDiagnostics: RepositoryIntelligenceSafeDiagnostics = {
      ...diagnostics,
      operationalFailureCategory: responseShapeFailure
        ? productStage?.kind === 'roots' ? 'roots_schema_failed' : 'structured_output_rejected'
        : 'evidence_validation_failed',
      failureBoundary: responseShapeFailure ? 'schema-validation' : 'evidence-normalization',
      validationCategory: responseShapeFailure
        ? 'response-schema-rejected'
        : productStrategistExecution && acceptedProductOpportunityCount < 3
          ? 'insufficient-product-opportunities'
          : diagnostics.validationCategory,
      acceptedFindingCount: execution.result?.findings.length || 0,
      rejectedFindingCount: execution.result?.rejectedFindings.length || 0,
      validationWarningCount: execution.result?.summary.validationMessages.length || 0,
    };
    logger({
      event: 'repository_intelligence_provider',
      requestId,
      providerId: config.provider,
      modelId: config.model,
      outcome: 'failure',
      durationMs,
      requestBytes: preparedContext.budget.requestBytes,
      retryCount: providerRetryCount,
      statusCategory: failureDiagnostics.operationalFailureCategory,
      validationCategory: failureDiagnostics.validationCategory,
      requestFingerprint: failureDiagnostics.requestFingerprint,
      productStage: productStage?.kind,
      stageFingerprint: productStage?.fingerprint,
      acceptedRootCount: productStage?.kind === 'roots' ? acceptedProductOpportunityCount : undefined,
      rejectedRootCount: productStage?.kind === 'roots' ? productIntelligence?.rejectedOpportunities.length || 0 : undefined,
      compactOpportunityContract: failureDiagnostics.compactOpportunityContract,
      compactOpportunityShapeRejectedCount: failureDiagnostics.compactOpportunityShapeRejectedCount,
      compactOpportunityShapeIssueFields: failureDiagnostics.compactOpportunityShapeIssueFields,
      operationalFailureCategory: failureDiagnostics.operationalFailureCategory,
      failureBoundary: failureDiagnostics.failureBoundary,
    });
    return completeAuthorizedStage(fallback(200, responseShapeFailure ? 'schema_validation_failed' : 'evidence_validation_failed', false, failureDiagnostics));
  }
  if (execution.status === 'timeout') return completeAuthorizedStage(fallback(200, 'request_timeout', true, diagnostics));
  if (execution.status === 'cancelled') return completeAuthorizedStage(fallback(200, 'request_cancelled', true, diagnostics));
  const category = mapExecutionError(execution.error?.code);
  return completeAuthorizedStage(fallback(200, category, execution.error?.retryable === true, diagnostics));
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
    timeoutMs: REPOSITORY_FUTURES_TIMING.rootProviderTimeoutMs,
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
    const expected = buildRepositoryProductRootStageForFingerprint(request.fingerprint).fingerprint;
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
      const elapsedMs = Date.now() - startedAt;
      const diagnostics = { ...input.diagnostics(), durationMs: elapsedMs, elapsedMs, schemaValidationFailureCount: 1, operationalFailureCategory: 'expansion_schema_failed' as const, failureBoundary: 'schema-validation' as const };
      logExpansionValidation(input, 'failure', diagnostics, 0, 0);
      return fallback(200, 'schema_validation_failed', true, diagnostics);
    }
    const secondGeneration = result.expansions.flatMap(item => item.evolutions || []).filter(item => item.generation === 2).length;
    const thirdGeneration = result.expansions.flatMap(item => item.evolutions || []).filter(item => item.generation === 3).length;
    if (result.expansions.some(item => !input.stage.parents.some(parent => parent.id === item.parentId)
      || item.evolutions.filter(evolution => evolution.generation === 2).length < 2)) {
      const elapsedMs = Date.now() - startedAt;
      const diagnostics = { ...input.diagnostics(), durationMs: elapsedMs, elapsedMs, schemaValidationFailureCount: 1, operationalFailureCategory: 'expansion_schema_failed' as const, failureBoundary: 'schema-validation' as const };
      logExpansionValidation(input, 'failure', diagnostics, secondGeneration, thirdGeneration);
      return fallback(200, 'schema_validation_failed', true, diagnostics);
    }
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const diagnostics = {
      ...input.diagnostics(),
      durationMs: elapsedMs,
      elapsedMs,
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
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    return fallback(200, category, category !== 'authentication_failed', {
      ...input.diagnostics(),
      durationMs: elapsedMs,
      elapsedMs,
      providerTimedOut: timedOut,
      ...operational,
    });
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', onAbort);
  }
}

function mapExecutionError(code?: string): RepositoryIntelligenceProviderFailureCategory {
  if (AI_USAGE_DENIAL_CATEGORIES.includes(code as (typeof AI_USAGE_DENIAL_CATEGORIES)[number])) {
    return code as (typeof AI_USAGE_DENIAL_CATEGORIES)[number];
  }
  if (code === 'rate_limited' || code === 'provider_unavailable' || code === 'authentication_failed'
    || code === 'response_too_large' || code === 'request_cancelled') return code;
  if (code === 'response-too-large') return 'response_too_large';
  if (['malformed-response', 'unsupported-schema', 'provider-mismatch', 'unsafe-provider-metadata', 'invalid_response',
    'request_preflight_rejected', 'provider_http_rejected', 'provider_envelope_invalid', 'language_validation_failed',
    'expansion_schema_failed', 'expansion_language_failed', 'expansion_parent_identity_failed', 'expansion_duplicate_identity_failed',
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
  if (error instanceof RepositoryDeepIntelligenceProviderError && error.code === 'expansion_language_failed') {
    return { operationalFailureCategory: 'expansion_language_failed', failureBoundary: 'language-validation' };
  }
  if (error instanceof RepositoryDeepIntelligenceProviderError && error.code === 'expansion_parent_identity_failed') {
    return { operationalFailureCategory: 'expansion_parent_identity_failed', failureBoundary: 'schema-validation' };
  }
  if (error instanceof RepositoryDeepIntelligenceProviderError && error.code === 'expansion_duplicate_identity_failed') {
    return { operationalFailureCategory: 'expansion_duplicate_identity_failed', failureBoundary: 'schema-validation' };
  }
  if (error instanceof RepositoryDeepIntelligenceProviderError && error.code === 'expansion_schema_failed') {
    return { operationalFailureCategory: 'expansion_schema_failed', failureBoundary: 'schema-validation' };
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
    languageValidation: diagnostics.languageValidation,
    expansionSchemaValidation: diagnostics.expansionSchemaValidation,
    expansionResponseShape: diagnostics.expansionResponseShape,
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
  if (execution.error?.code === 'language_validation_failed' || execution.error?.code.startsWith('expansion_')) return 'response-schema-rejected';
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

export function resolveRepositoryIntelligenceBuildIdentity(env: NodeJS.ProcessEnv = process.env) {
  const buildCommit = /^[a-f0-9]{7,40}$/i.test(env.VERCEL_GIT_COMMIT_SHA || '')
    ? env.VERCEL_GIT_COMMIT_SHA!.toLowerCase()
    : /^[a-f0-9]{7,40}$/i.test(env.SHIPSEAL_BUILD_COMMIT || '')
      ? env.SHIPSEAL_BUILD_COMMIT!.toLowerCase()
      : 'unknown';
  const buildDeployment = /^dpl_[A-Za-z0-9]{8,80}$/.test(env.VERCEL_DEPLOYMENT_ID || '')
    ? env.VERCEL_DEPLOYMENT_ID
    : undefined;
  return {
    buildCommit,
    ...(buildDeployment ? { buildDeployment } : {}),
    productPipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    rootContractVersion: REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION,
  };
}

export function attachRepositoryIntelligenceBuildIdentity(
  payload: RepositoryIntelligenceProviderApiResponse,
  env: NodeJS.ProcessEnv = process.env,
): RepositoryIntelligenceProviderApiResponse {
  const identity = resolveRepositoryIntelligenceBuildIdentity(env);
  return {
    ...payload,
    diagnostics: {
      ...(payload.diagnostics || { costEstimate: 'unavailable' as const }),
      ...identity,
    },
  } as RepositoryIntelligenceProviderApiResponse;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const identity = resolveRepositoryIntelligenceBuildIdentity();
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-ShipSeal-Build', identity.buildCommit);
  const responsePayload = payload && typeof payload === 'object' && !Array.isArray(payload)
    && (payload as { version?: unknown }).version === REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION
    ? attachRepositoryIntelligenceBuildIdentity(payload as RepositoryIntelligenceProviderApiResponse)
    : payload;
  res.end(JSON.stringify(responsePayload));
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
    let session;
    try { session = await readAccountSession(req); } catch {
      return sendJson(res, 503, usageDenialFallback(new AiUsageDeniedError(
        'usage_temporarily_unavailable', 503, true, 'AI usage authorization is temporarily unavailable.',
      )).body);
    }
    if (!session) {
      return sendJson(res, 401, usageDenialFallback(new AiUsageDeniedError(
        'authentication_required', 401, false, 'Sign in to start ShipSeal-funded AI analysis.',
      )).body);
    }
    const finalization = readProductFinalization(input);
    if (hasProductFinalization(input) && !finalization) {
      return sendJson(res, 400, fallback(400, 'invalid_request', false).body);
    }
    if (finalization) {
      const service = new AiUsageAuthorizationService();
      try {
        const body = await service.finalizeRepositoryFutures(session.user.id, {
          publicOperationId: finalization.publicOperationId,
          requestFingerprint: finalization.requestFingerprint,
          repositoryIdentity: finalization.repositoryIdentity,
        });
        return sendJson(res, 200, body);
      } catch (error) {
        return sendJson(res, error instanceof AiUsageDeniedError ? error.status : 503, usageDenialFallback(
          error instanceof AiUsageDeniedError ? error : new AiUsageDeniedError(
            'usage_temporarily_unavailable', 503, true,
            'Future completion is temporarily unavailable. Your analysis allowance was not consumed.',
          ),
        ).body);
      }
    }
    const aiAuthorization = { userId: session.user.id, service: new AiUsageAuthorizationService(), recoveryOperationId: readRecoveryOperationId(input) };
    const stageAttemptKey = readStageAttemptKey(input);
    const singleFlightKey = buildAuthenticatedStageSingleFlightKey(session.user.id, stageAttemptKey);
    const flight = serverStageSingleFlight.run(singleFlightKey, () => prepareProductionRepositoryIntelligence(input, { signal: controller.signal, aiAuthorization }));
    if (flight.duplicateSuppressed) {
      const metadata = readSafeStageMetadata(input);
      console.info(JSON.stringify({
        event: 'repository_intelligence_stage_deduplication',
        stageAttemptKey,
        stageFingerprint: metadata.fingerprint,
        productStage: metadata.stage,
        duplicateSuppressed: true,
      }));
    }
    const result = await flight.promise;
    const body = flight.duplicateSuppressed ? withDuplicateSuppressed(result.body, stageAttemptKey) : result.body;
    return sendJson(res, result.status, body);
  } finally {
    req.removeListener('aborted', abort);
  }
}

function usageDenialFallback(
  error: AiUsageDeniedError,
  diagnostics: Partial<RepositoryIntelligenceSafeDiagnostics> = {},
): { status: number; body: RepositoryIntelligenceProviderApiResponse } {
  const result = fallback(error.status, error.category, error.retryable, {
    costEstimate: 'unavailable',
    ...diagnostics,
    failureBoundary: 'authorization',
    ...error.diagnostics,
  });
  if (result.body.state !== 'fallback') return result;
  return { ...result, body: { ...result.body, message: error.message } };
}

function readStageAttemptKey(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const value = (input as { stageAttemptKey?: unknown }).stageAttemptKey;
  return typeof value === 'string' && /^[a-z0-9]{8,80}$/i.test(value) ? value : undefined;
}

function readRecoveryOperationId(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const value = (input as { recoveryOperationId?: unknown }).recoveryOperationId;
  return typeof value === 'string' && /^op_[A-Za-z0-9_-]{20,80}$/.test(value) ? value : undefined;
}

function readProductFinalization(input: unknown): RepositoryProductFinalizationApiRequest['productFinalization'] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || (input as { version?: unknown }).version !== REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION) return null;
  const value = (input as { productFinalization?: unknown }).productFinalization;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== 'complete-repository-futures'
    || typeof candidate.publicOperationId !== 'string'
    || !/^op_[A-Za-z0-9_-]{20,80}$/.test(candidate.publicOperationId)
    || typeof candidate.requestFingerprint !== 'string'
    || !/^[a-z0-9]{8,128}$/i.test(candidate.requestFingerprint)
    || typeof candidate.repositoryIdentity !== 'string'
    || !/^(?:github|upload):[A-Za-z0-9_./-]{1,220}$/i.test(candidate.repositoryIdentity)) return null;
  return candidate as unknown as RepositoryProductFinalizationApiRequest['productFinalization'];
}

function hasProductFinalization(input: unknown) {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input) && 'productFinalization' in input);
}

function withDuplicateSuppressed(
  body: RepositoryIntelligenceProviderApiResponse,
  stageAttemptKey?: string,
): RepositoryIntelligenceProviderApiResponse {
  return {
    ...body,
    diagnostics: {
      ...(body.diagnostics || { costEstimate: 'unavailable' as const }),
      ...(stageAttemptKey ? { stageAttemptKey } : {}),
      duplicateSuppressed: true,
    },
  } as RepositoryIntelligenceProviderApiResponse;
}

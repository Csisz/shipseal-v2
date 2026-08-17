import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryProductProviderStage,
  type RepositoryIntelligenceProviderApiResponse,
} from './productionProviderContract';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';
import { stableContextFingerprint } from './contextSelection';
import { calculateRepositoryRateLimitBackoffMs } from './rateLimitPolicy';
import {
  REPOSITORY_PRODUCT_EXPANSION_CONCURRENCY,
  REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS,
  REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS,
  buildRepositoryProductExpansionStages,
  buildRepositoryProductRootStage,
  mapWithBoundedConcurrency,
  mergeRepositoryProductExpansionResults,
  type RepositoryProductPipelineProgress,
} from './stagedProductIntelligence';

const activeEnhancements = new Map<string, Promise<RepositoryIntelligenceProviderApiResponse>>();
const completedEnhancements = new Map<string, RepositoryIntelligenceProviderApiResponse>();
const completedProductRoots = new Map<string, Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>>();
const completedProductBatches = new Map<string, Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>>();
const activeProductStages = new Map<string, Promise<RepositoryIntelligenceProviderApiResponse>>();

interface ProductStageRequestOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  onProgress?: (progress: RepositoryProductPipelineProgress) => void;
  random?: () => number;
  now?: () => number;
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * The provider is bounded to 45 seconds for Product Strategist requests. Keep a
 * slightly wider browser deadline so normal server validation can finish while
 * still guaranteeing that a lost proxy response cannot leave the UI pending.
 */
export const REPOSITORY_INTELLIGENCE_CLIENT_TIMEOUT_MS = 55_000;

export class RepositoryIntelligenceEnhancementSingleFlight {
  private active: Promise<void> | null = null;

  run(task: () => Promise<void>): Promise<void> {
    if (this.active) return this.active;
    const active = task().finally(() => {
      if (this.active === active) this.active = null;
    });
    this.active = active;
    return active;
  }
}

export async function requestRepositoryIntelligenceEnhancement(
  request: RepositoryDeepIntelligenceRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<RepositoryIntelligenceProviderApiResponse> {
  const cacheEligible = !options.fetcher;
  if (cacheEligible) {
    const cached = completedEnhancements.get(request.fingerprint);
    if (cached) return cached.state === 'enhanced'
      ? { ...cached, diagnostics: { ...cached.diagnostics, cacheUsed: true } }
      : { ...cached, diagnostics: { ...cached.diagnostics, costEstimate: 'unavailable', cacheUsed: true } };
  }
  const active = activeEnhancements.get(request.fingerprint);
  if (active) return active;
  const operation = performRequest(request, options).then(result => {
    // Failed and timed-out Product Strategist calls must remain genuinely
    // retryable. Only a validated enhanced result is safe to reuse.
    if (cacheEligible && result.state === 'enhanced') {
      completedEnhancements.set(request.fingerprint, result);
    }
    return result;
  }).finally(() => {
    if (activeEnhancements.get(request.fingerprint) === operation) activeEnhancements.delete(request.fingerprint);
  });
  activeEnhancements.set(request.fingerprint, operation);
  return operation;
}

export async function requestRepositoryProductIntelligenceStaged(
  request: RepositoryDeepIntelligenceRequest,
  options: ProductStageRequestOptions = {},
): Promise<RepositoryIntelligenceProviderApiResponse> {
  const cacheEligible = !options.fetcher;
  const rootsStage = buildRepositoryProductRootStage(request);
  options.onProgress?.({ stage: 'roots', completedBatches: 0, totalBatches: 0, activeBatchIndexes: [], stageAttempt: 1 });
  let roots = cacheEligible ? completedProductRoots.get(rootsStage.fingerprint) : undefined;
  if (!roots) {
    let rootFailure: RepositoryIntelligenceProviderApiResponse | undefined;
    for (let attempt = 1; attempt <= REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS; attempt += 1) {
      options.onProgress?.({ stage: 'roots', completedBatches: 0, totalBatches: 0, activeBatchIndexes: [], stageAttempt: attempt });
      let response = await performProductStageRequest(request, { ...options, timeoutMs: options.timeoutMs ?? REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS }, rootsStage, attempt);
      if (attempt > 1 && isRateLimitedResponse(rootFailure) && response.state === 'enhanced') {
        response = withRateLimitRecovery(response, rootFailure.diagnostics, 'recovered');
      }
      if (response.state === 'enhanced') {
        const opportunityCount = response.result.productIntelligence?.opportunities.length || 0;
        if (opportunityCount >= 6 && opportunityCount <= 8) {
          roots = withStageRetryCount(response, attempt - 1);
          break;
        }
        rootFailure = invalidStageResponse('Future roots did not satisfy the six-to-eight direction contract.', rootsStage, attempt - 1);
      } else {
        rootFailure = withStageRetryCount(response, attempt - 1);
      }
      if (!isRetryableStageFailure(rootFailure) || attempt === REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS) {
        return isRateLimitedResponse(rootFailure) ? withExhaustedRateLimit(rootFailure, attempt, options) : rootFailure;
      }
      if (isRateLimitedResponse(rootFailure)) {
        rootFailure = await waitForRateLimitRetry(rootFailure, attempt, options, retryAt => {
          options.onProgress?.({ stage: 'roots', completedBatches: 0, totalBatches: 0, activeBatchIndexes: [], stageAttempt: attempt, rateLimitRetryAt: retryAt, rateLimitAttempt: attempt });
        });
      }
    }
    if (!roots) return rootFailure || invalidStageResponse('Future roots could not be completed.', rootsStage);
    if (cacheEligible) completedProductRoots.set(rootsStage.fingerprint, roots);
  }
  if (!roots.result.productIntelligence) return invalidStageResponse('Product Understanding was unavailable.', rootsStage);

  const stages = buildRepositoryProductExpansionStages(request, roots.result.productIntelligence);
  let completed = stages.filter(stage => completedProductBatches.has(stage.fingerprint)).length;
  const active = new Set<number>();
  let rateLimitGate: Promise<void> | null = null;
  let releaseRateLimitGate: (() => void) | null = null;
  let terminalRateLimitFailure: RepositoryIntelligenceProviderApiResponse | null = null;
  let pendingRateLimitRecoveries = 0;
  const rateLimitRecoveryWaiters = new Set<() => void>();
  const activeChangeWaiters = new Set<() => void>();
  const notifyActiveChange = () => {
    for (const resolve of activeChangeWaiters) resolve();
    activeChangeWaiters.clear();
  };
  const waitForExpansionExclusivity = async (batchIndex: number) => {
    while ([...active].some(index => index !== batchIndex)) {
      await new Promise<void>(resolve => activeChangeWaiters.add(resolve));
    }
  };
  const waitForRateLimitRecoveries = async () => {
    while (pendingRateLimitRecoveries > 0) {
      await new Promise<void>(resolve => rateLimitRecoveryWaiters.add(resolve));
    }
  };
  options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [], stageAttempt: 1 });
  const responses = await mapWithBoundedConcurrency(stages, REPOSITORY_PRODUCT_EXPANSION_CONCURRENCY, async stage => {
    const cached = cacheEligible ? completedProductBatches.get(stage.fingerprint) : undefined;
    if (cached) return { response: cached, stage };
    if (rateLimitGate) await rateLimitGate;
    await waitForRateLimitRecoveries();
    if (terminalRateLimitFailure) return { response: terminalRateLimitFailure, stage };
    active.add(stage.batchIndex);
    options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [...active].sort(), stageAttempt: 1 });
    let response: RepositoryIntelligenceProviderApiResponse = invalidStageResponse('This pathway group could not be completed.', stage);
    let rateLimitDiagnostics: RepositoryIntelligenceProviderApiResponse['diagnostics'];
    let ownsRateLimitGate = false;
    let registeredRateLimitRecovery = false;
    for (let attempt = 1; attempt <= REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS; attempt += 1) {
      options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [...active].sort(), stageAttempt: attempt });
      response = withStageRetryCount(await performProductStageRequest(
        request,
        { ...options, timeoutMs: options.timeoutMs ?? REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS },
        stage,
        attempt,
      ), attempt - 1);
      if (attempt > 1 && response.state === 'stage-enhanced') {
        response = withRateLimitRecovery(response, rateLimitDiagnostics, 'recovered', 1);
      }
      if (response.state === 'stage-enhanced' || !isRetryableStageFailure(response)) break;
      if (attempt === REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS) {
        if (isRateLimitedResponse(response)) {
          response = withExhaustedRateLimit(response, attempt, options, 1);
          terminalRateLimitFailure = response;
        }
        break;
      }
      if (isRateLimitedResponse(response)) {
        if (!registeredRateLimitRecovery) {
          registeredRateLimitRecovery = true;
          pendingRateLimitRecoveries += 1;
        }
        const existingGate = rateLimitGate;
        if (!existingGate) {
          ownsRateLimitGate = true;
          rateLimitGate = new Promise<void>(resolve => { releaseRateLimitGate = resolve; });
        }
        const cooldown = waitForRateLimitRetry(response, attempt, options, retryAt => {
          options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [...active].sort(), stageAttempt: attempt, rateLimitRetryAt: retryAt, rateLimitAttempt: attempt });
        }, 1);
        if (existingGate) {
          active.delete(stage.batchIndex);
          notifyActiveChange();
          const [next] = await Promise.all([cooldown, existingGate]);
          response = next;
          active.add(stage.batchIndex);
        } else {
          response = await Promise.all([cooldown, waitForExpansionExclusivity(stage.batchIndex)]).then(([next]) => next);
        }
        rateLimitDiagnostics = response.diagnostics;
      }
    }
    active.delete(stage.batchIndex);
    notifyActiveChange();
    if (ownsRateLimitGate && rateLimitGate) {
      const release = releaseRateLimitGate;
      rateLimitGate = null;
      releaseRateLimitGate = null;
      release?.();
    }
    if (registeredRateLimitRecovery) {
      pendingRateLimitRecoveries -= 1;
      if (pendingRateLimitRecoveries === 0) {
        for (const resolve of rateLimitRecoveryWaiters) resolve();
        rateLimitRecoveryWaiters.clear();
      }
    }
    if (response.state === 'stage-enhanced') {
      completed += 1;
      if (cacheEligible) completedProductBatches.set(stage.fingerprint, response);
    }
    options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [...active].sort(), stageAttempt: response.diagnostics?.stageRetryCount === 1 ? 2 : 1 });
    return { response, stage };
  });
  const failed = responses.find(item => item.response.state !== 'stage-enhanced');
  if (failed) {
    const response = failed.response;
    return response.state === 'fallback'
      ? { ...response, message: response.category === 'request_timeout' ? 'Some future pathways took longer than expected.' : 'Some future pathways could not be completed.', diagnostics: { ...response.diagnostics, productStage: 'expansion', stageFingerprint: failed.stage.fingerprint, expansionBatchIndex: failed.stage.batchIndex, expansionBatchCount: failed.stage.totalBatches } }
      : invalidStageResponse('Some future pathways could not be completed.', failed.stage);
  }
  options.onProgress?.({ stage: 'merging', completedBatches: stages.length, totalBatches: stages.length, activeBatchIndexes: [], stageAttempt: 1 });
  try {
    const stageResults = responses.map(item => (item.response as Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>).stageResult);
    const result = mergeRepositoryProductExpansionResults(roots.result, stageResults);
    const secondGeneration = stageResults.flatMap(batch => batch.expansions.flatMap(item => item.evolutions)).filter(item => item.generation === 2).length;
    const thirdGeneration = stageResults.flatMap(batch => batch.expansions.flatMap(item => item.evolutions)).filter(item => item.generation === 3).length;
    const diagnostics = aggregateStagedDiagnostics(roots, responses.map(item => item.response as Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>), secondGeneration, thirdGeneration);
    return { ...roots, result, diagnostics };
  } catch {
    return {
      ...invalidStageResponse('Validated pathway groups could not be merged.', rootsStage),
      diagnostics: {
        ...invalidStageResponse('Validated pathway groups could not be merged.', rootsStage).diagnostics,
        operationalFailureCategory: 'merge_incomplete',
        failureBoundary: 'staged-merge',
      },
    };
  }
}

function aggregateStagedDiagnostics(
  roots: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>,
  batches: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>[],
  secondGeneration: number,
  thirdGeneration: number,
) {
  const all = [roots.diagnostics, ...batches.map(batch => batch.diagnostics)];
  const latestRateLimit = [...all].reverse().find(item => item.rateLimitAttempt);
  const sum = (key: 'providerRequestBytes' | 'providerPromptTokens' | 'providerCompletionTokens' | 'providerReasoningTokens' | 'providerTotalTokens' | 'outputBytes' | 'durationMs' | 'retryCount' | 'languageRepairCount' | 'stageRetryCount') => all.reduce((total, item) => total + (item[key] || 0), 0);
  return {
    ...roots.diagnostics,
    productStage: 'expansion' as const,
    expansionBatchCount: batches.length,
    acceptedSecondGenerationCount: secondGeneration,
    acceptedThirdGenerationCount: thirdGeneration,
    providerRequestBytes: sum('providerRequestBytes'),
    providerPromptTokens: sum('providerPromptTokens'),
    providerCompletionTokens: sum('providerCompletionTokens'),
    providerReasoningTokens: sum('providerReasoningTokens'),
    providerTotalTokens: sum('providerTotalTokens'),
    outputBytes: sum('outputBytes'),
    durationMs: sum('durationMs'),
    retryCount: sum('retryCount'),
    languageRepairCount: sum('languageRepairCount'),
    stageRetryCount: sum('stageRetryCount'),
    ...(latestRateLimit ? {
      rateLimitAttempt: latestRateLimit.rateLimitAttempt,
      retryAfterMs: latestRateLimit.retryAfterMs,
      backoffMs: latestRateLimit.backoffMs,
      rateLimitRetryAt: latestRateLimit.rateLimitRetryAt,
      rateLimitResetRequestsMs: latestRateLimit.rateLimitResetRequestsMs,
      rateLimitResetTokensMs: latestRateLimit.rateLimitResetTokensMs,
      rateLimitRemainingRequests: latestRateLimit.rateLimitRemainingRequests,
      rateLimitRemainingTokens: latestRateLimit.rateLimitRemainingTokens,
      rateLimitLimitRequests: latestRateLimit.rateLimitLimitRequests,
      rateLimitLimitTokens: latestRateLimit.rateLimitLimitTokens,
      rateLimitType: latestRateLimit.rateLimitType,
      expansionConcurrencyAtRetry: latestRateLimit.expansionConcurrencyAtRetry,
      rateLimitRecoveryStatus: latestRateLimit.rateLimitRecoveryStatus,
    } : {}),
    duplicateSuppressed: all.some(item => item.duplicateSuppressed),
  };
}

async function performProductStageRequest(
  request: RepositoryDeepIntelligenceRequest,
  options: ProductStageRequestOptions,
  stage: RepositoryProductProviderStage,
  stageAttempt: number,
) {
  const flightKey = `${request.fingerprint}:${stage.fingerprint}`;
  const existing = activeProductStages.get(flightKey);
  if (existing) return existing.then(response => withDuplicateSuppressed(response));
  const stageAttemptKey = stableContextFingerprint({
    reportFingerprint: request.fingerprint,
    stageFingerprint: stage.fingerprint,
    stageAttempt,
  });
  const operation = performRequest(request, options, stage, stageAttemptKey).finally(() => {
    if (activeProductStages.get(flightKey) === operation) activeProductStages.delete(flightKey);
  });
  activeProductStages.set(flightKey, operation);
  return operation;
}

async function waitForRateLimitRetry<T extends RepositoryIntelligenceProviderApiResponse>(
  response: T,
  rateLimitAttempt: number,
  options: ProductStageRequestOptions,
  onWaiting: (retryAt: number) => void,
  expansionConcurrencyAtRetry?: number,
) {
  const now = options.now || Date.now;
  const backoffMs = calculateRepositoryRateLimitBackoffMs({
    rateLimitAttempt,
    retryAfterMs: response.diagnostics?.retryAfterMs,
    random: options.random,
  });
  const rateLimitRetryAt = now() + backoffMs;
  const waiting = withRateLimitState(response, {
    rateLimitAttempt,
    backoffMs,
    rateLimitRetryAt,
    rateLimitRecoveryStatus: 'waiting',
    ...(expansionConcurrencyAtRetry === undefined ? {} : { expansionConcurrencyAtRetry }),
  });
  onWaiting(rateLimitRetryAt);
  await (options.wait || waitForDelay)(backoffMs, options.signal);
  return waiting;
}

function withExhaustedRateLimit<T extends RepositoryIntelligenceProviderApiResponse>(
  response: T,
  rateLimitAttempt: number,
  options: ProductStageRequestOptions,
  expansionConcurrencyAtRetry?: number,
) {
  const actionRequired = response.diagnostics?.rateLimitType === 'quota-or-billing';
  const backoffMs = actionRequired ? undefined : calculateRepositoryRateLimitBackoffMs({
    rateLimitAttempt,
    retryAfterMs: response.diagnostics?.retryAfterMs,
    random: options.random,
  });
  return withRateLimitState(response, {
    rateLimitAttempt,
    ...(backoffMs === undefined ? {} : { backoffMs, rateLimitRetryAt: (options.now || Date.now)() + backoffMs }),
    rateLimitRecoveryStatus: actionRequired ? 'action-required' : 'exhausted',
    ...(expansionConcurrencyAtRetry === undefined ? {} : { expansionConcurrencyAtRetry }),
  });
}

function withRateLimitRecovery<T extends RepositoryIntelligenceProviderApiResponse>(
  response: T,
  prior: RepositoryIntelligenceProviderApiResponse['diagnostics'],
  status: 'recovered',
  expansionConcurrencyAtRetry?: number,
) {
  return {
    ...response,
    diagnostics: {
      ...(prior || {}),
      ...(response.diagnostics || { costEstimate: 'unavailable' as const }),
      rateLimitRecoveryStatus: status,
      ...(expansionConcurrencyAtRetry === undefined ? {} : { expansionConcurrencyAtRetry }),
    },
  } as T;
}

function withRateLimitState<T extends RepositoryIntelligenceProviderApiResponse>(
  response: T,
  diagnostics: Partial<NonNullable<RepositoryIntelligenceProviderApiResponse['diagnostics']>>,
) {
  return {
    ...response,
    diagnostics: {
      ...(response.diagnostics || { costEstimate: 'unavailable' as const }),
      ...diagnostics,
    },
  } as T;
}

function withDuplicateSuppressed<T extends RepositoryIntelligenceProviderApiResponse>(response: T) {
  return {
    ...response,
    diagnostics: {
      ...(response.diagnostics || { costEstimate: 'unavailable' as const }),
      duplicateSuppressed: true,
    },
  } as T;
}

function waitForDelay(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, delayMs);
    function finish() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function performRequest(
  request: RepositoryDeepIntelligenceRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number },
  productStage?: RepositoryProductProviderStage,
  stageAttemptKey?: string,
): Promise<RepositoryIntelligenceProviderApiResponse> {
  if (options.signal?.aborted) return cancelledResponse();

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? REPOSITORY_INTELLIGENCE_CLIENT_TIMEOUT_MS;
  let timedOut = false;
  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
    controller.abort();
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  const requestPromise = (options.fetcher || fetch)('/api/repository-intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request, ...(productStage ? { productStage } : {}), ...(stageAttemptKey ? { stageAttemptKey } : {}) }),
    signal: controller.signal,
  }).then(validateResponse).catch(() => {
    if (timedOut) return timeoutResponse();
    if (cancelled || options.signal?.aborted) return cancelledResponse();
    return unavailableResponse();
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<RepositoryIntelligenceProviderApiResponse>(resolve => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve(timeoutResponse());
    }, Math.max(1, timeoutMs));
  });
  let cancellationListener: (() => void) | undefined;
  const cancellationPromise = new Promise<RepositoryIntelligenceProviderApiResponse>(resolve => {
    if (!options.signal) return;
    cancellationListener = () => resolve(cancelledResponse());
    if (options.signal.aborted) cancellationListener();
    else options.signal.addEventListener('abort', cancellationListener, { once: true });
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise, cancellationPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    options.signal?.removeEventListener('abort', onAbort);
    if (cancellationListener) options.signal?.removeEventListener('abort', cancellationListener);
  }
}

async function validateResponse(response: Response): Promise<RepositoryIntelligenceProviderApiResponse> {
  const payload = await response.json().catch(() => null) as Partial<RepositoryIntelligenceProviderApiResponse> | null;
  if (!response.ok || !payload || payload.version !== REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION
    || !['enhanced', 'stage-enhanced', 'fallback'].includes(payload.state || '')) {
    const rateLimited = response.status === 429;
    const authenticationFailed = response.status === 401 || response.status === 403;
    const invalidEnvelope = response.ok && !payload;
    return {
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback' as const,
      category: response.status === 413 ? 'invalid_request' : rateLimited ? 'rate_limited' : authenticationFailed ? 'authentication_failed' : invalidEnvelope ? 'invalid_response' : 'provider_unavailable',
      retryable: rateLimited || response.status >= 500 || invalidEnvelope,
      message: 'Enhanced intelligence is unavailable. Deterministic repository intelligence remains ready.',
      deepState: response.status === 413 ? 'budget-exceeded' as const : 'failed' as const,
      diagnostics: {
        costEstimate: 'unavailable',
        operationalFailureCategory: rateLimited ? 'provider_rate_limited' : invalidEnvelope ? 'invalid_provider_envelope' : 'provider_unavailable',
        failureBoundary: invalidEnvelope ? 'provider-envelope' : 'browser-network',
        providerHttpStatusCategory: authenticationFailed ? 'authentication' : rateLimited ? 'rate-limited' : response.status >= 500 ? 'server-error' : 'request-rejected',
      },
    };
  }
  return payload as RepositoryIntelligenceProviderApiResponse;
}

function timeoutResponse(): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'fallback',
    category: 'request_timeout',
    retryable: true,
    message: 'Future analysis is taking longer than expected.',
    deepState: 'timed-out',
    diagnostics: {
      costEstimate: 'unavailable',
      browserTimedOut: true,
      operationalFailureCategory: 'browser_timeout',
      failureBoundary: 'browser-network',
    },
  };
}

function invalidStageResponse(message: string, stage: RepositoryProductProviderStage, stageRetryCount = 0): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'fallback',
    category: 'schema_validation_failed',
    retryable: true,
    message,
    deepState: 'failed',
    diagnostics: {
      costEstimate: 'unavailable',
      productStage: stage.kind,
      stageFingerprint: stage.fingerprint,
      ...(stage.kind === 'expansion' ? { expansionBatchIndex: stage.batchIndex, expansionBatchCount: stage.totalBatches } : {}),
      schemaValidationFailureCount: 1,
      stageRetryCount,
      operationalFailureCategory: stage.kind === 'roots' ? 'roots_schema_failed' : 'expansion_schema_failed',
      failureBoundary: 'schema-validation',
      ...(stage.kind === 'expansion' ? {
        expansionParentFutureIds: stage.parents.map(parent => parent.id),
        expansionParentCount: stage.parents.length,
      } : {}),
    },
  };
}

function cancelledResponse(): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'fallback',
    category: 'request_cancelled',
    retryable: true,
    message: 'Future analysis was cancelled.',
    deepState: 'failed',
    diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'cancelled', failureBoundary: 'browser-network' },
  };
}

function unavailableResponse(): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'fallback',
    category: 'provider_unavailable',
    retryable: true,
    message: 'Future analysis failed. Retry when you are ready.',
    deepState: 'failed',
    diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'provider_unavailable', failureBoundary: 'browser-network' },
  };
}

function isRetryableStageFailure(response: RepositoryIntelligenceProviderApiResponse) {
  return response.state === 'fallback' && response.retryable
    && !['authentication_failed', 'configuration_invalid', 'credentials_missing', 'provider_disabled', 'request_cancelled'].includes(response.category);
}

function isRateLimitedResponse(
  response: RepositoryIntelligenceProviderApiResponse | undefined,
): response is Extract<RepositoryIntelligenceProviderApiResponse, { state: 'fallback' }> {
  return response?.state === 'fallback' && response.category === 'rate_limited';
}

function withStageRetryCount<T extends RepositoryIntelligenceProviderApiResponse>(response: T, stageRetryCount: number): T {
  if (!stageRetryCount) return response;
  return {
    ...response,
    diagnostics: {
      ...(response.diagnostics || { costEstimate: 'unavailable' as const }),
      stageRetryCount,
    },
  } as T;
}

export function clearRepositoryIntelligenceEnhancementSessionCache() {
  completedEnhancements.clear();
  activeEnhancements.clear();
  completedProductRoots.clear();
  completedProductBatches.clear();
  activeProductStages.clear();
}

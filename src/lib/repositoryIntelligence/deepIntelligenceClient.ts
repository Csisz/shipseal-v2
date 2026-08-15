import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryProductProviderStage,
  type RepositoryIntelligenceProviderApiResponse,
} from './productionProviderContract';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';
import {
  REPOSITORY_PRODUCT_EXPANSION_CONCURRENCY,
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
  options: {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    timeoutMs?: number;
    onProgress?: (progress: RepositoryProductPipelineProgress) => void;
  } = {},
): Promise<RepositoryIntelligenceProviderApiResponse> {
  const cacheEligible = !options.fetcher;
  const rootsStage = buildRepositoryProductRootStage(request);
  options.onProgress?.({ stage: 'roots', completedBatches: 0, totalBatches: 0, activeBatchIndexes: [] });
  let roots = cacheEligible ? completedProductRoots.get(rootsStage.fingerprint) : undefined;
  if (!roots) {
    const response = await performRequest(request, { ...options, timeoutMs: options.timeoutMs ?? REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS }, rootsStage);
    if (response.state !== 'enhanced') return response;
    const opportunityCount = response.result.productIntelligence?.opportunities.length || 0;
    if (opportunityCount < 6 || opportunityCount > 8) return invalidStageResponse('Future roots did not satisfy the six-to-eight direction contract.', rootsStage);
    roots = response;
    if (cacheEligible) completedProductRoots.set(rootsStage.fingerprint, response);
  }
  if (!roots.result.productIntelligence) return invalidStageResponse('Product Understanding was unavailable.', rootsStage);

  const stages = buildRepositoryProductExpansionStages(request, roots.result.productIntelligence);
  let completed = stages.filter(stage => completedProductBatches.has(stage.fingerprint)).length;
  const active = new Set<number>();
  options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [] });
  const responses = await mapWithBoundedConcurrency(stages, REPOSITORY_PRODUCT_EXPANSION_CONCURRENCY, async stage => {
    const cached = cacheEligible ? completedProductBatches.get(stage.fingerprint) : undefined;
    if (cached) return { response: cached, stage };
    active.add(stage.batchIndex);
    options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [...active].sort() });
    const response = await performRequest(request, { ...options, timeoutMs: options.timeoutMs ?? REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS }, stage);
    active.delete(stage.batchIndex);
    if (response.state === 'stage-enhanced') {
      completed += 1;
      if (cacheEligible) completedProductBatches.set(stage.fingerprint, response);
    }
    options.onProgress?.({ stage: 'expansion', completedBatches: completed, totalBatches: stages.length, activeBatchIndexes: [...active].sort() });
    return { response, stage };
  });
  const failed = responses.find(item => item.response.state !== 'stage-enhanced');
  if (failed) {
    const response = failed.response;
    return response.state === 'fallback'
      ? { ...response, message: response.category === 'request_timeout' ? 'Some future pathways took longer than expected.' : 'Some future pathways could not be completed.', diagnostics: { ...response.diagnostics, productStage: 'expansion', stageFingerprint: failed.stage.fingerprint, expansionBatchIndex: failed.stage.batchIndex, expansionBatchCount: failed.stage.totalBatches } }
      : invalidStageResponse('Some future pathways could not be completed.', failed.stage);
  }
  options.onProgress?.({ stage: 'merging', completedBatches: stages.length, totalBatches: stages.length, activeBatchIndexes: [] });
  try {
    const stageResults = responses.map(item => (item.response as Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>).stageResult);
    const result = mergeRepositoryProductExpansionResults(roots.result, stageResults);
    const secondGeneration = stageResults.flatMap(batch => batch.expansions.flatMap(item => item.evolutions)).filter(item => item.generation === 2).length;
    const thirdGeneration = stageResults.flatMap(batch => batch.expansions.flatMap(item => item.evolutions)).filter(item => item.generation === 3).length;
    const diagnostics = aggregateStagedDiagnostics(roots, responses.map(item => item.response as Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>), secondGeneration, thirdGeneration);
    return { ...roots, result, diagnostics };
  } catch {
    return invalidStageResponse('Validated pathway groups could not be merged.', rootsStage);
  }
}

function aggregateStagedDiagnostics(
  roots: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>,
  batches: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>[],
  secondGeneration: number,
  thirdGeneration: number,
) {
  const all = [roots.diagnostics, ...batches.map(batch => batch.diagnostics)];
  const sum = (key: 'providerRequestBytes' | 'providerPromptTokens' | 'providerCompletionTokens' | 'providerReasoningTokens' | 'providerTotalTokens' | 'outputBytes' | 'durationMs' | 'retryCount' | 'languageRepairCount') => all.reduce((total, item) => total + (item[key] || 0), 0);
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
  };
}

async function performRequest(
  request: RepositoryDeepIntelligenceRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number },
  productStage?: RepositoryProductProviderStage,
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
    body: JSON.stringify({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request, ...(productStage ? { productStage } : {}) }),
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
    return {
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback' as const,
      category: response.status === 413 ? 'invalid_request' : 'provider_unavailable',
      retryable: response.status >= 500,
      message: 'Enhanced intelligence is unavailable. Deterministic repository intelligence remains ready.',
      deepState: response.status === 413 ? 'budget-exceeded' as const : 'failed' as const,
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
    diagnostics: { costEstimate: 'unavailable', browserTimedOut: true },
  };
}

function invalidStageResponse(message: string, stage: RepositoryProductProviderStage): RepositoryIntelligenceProviderApiResponse {
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
  };
}

export function clearRepositoryIntelligenceEnhancementSessionCache() {
  completedEnhancements.clear();
  activeEnhancements.clear();
  completedProductRoots.clear();
  completedProductBatches.clear();
}

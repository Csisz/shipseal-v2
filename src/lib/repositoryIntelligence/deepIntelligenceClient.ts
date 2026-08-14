import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
} from './productionProviderContract';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';

const activeEnhancements = new Map<string, Promise<RepositoryIntelligenceProviderApiResponse>>();
const completedEnhancements = new Map<string, RepositoryIntelligenceProviderApiResponse>();

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

async function performRequest(
  request: RepositoryDeepIntelligenceRequest,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number },
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
    body: JSON.stringify({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }),
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
    || !['enhanced', 'fallback'].includes(payload.state || '')) {
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
}

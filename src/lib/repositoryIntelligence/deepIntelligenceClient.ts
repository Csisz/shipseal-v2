import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
} from './productionProviderContract';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';

const activeEnhancements = new Map<string, Promise<RepositoryIntelligenceProviderApiResponse>>();
const completedEnhancements = new Map<string, RepositoryIntelligenceProviderApiResponse>();

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
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
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
    if (cacheEligible && (result.state === 'enhanced' || request.executionProfile === 'product-strategist')) {
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
  options: { signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<RepositoryIntelligenceProviderApiResponse> {
  const response = await (options.fetcher || fetch)('/api/repository-intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request }),
    signal: options.signal,
  });
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

export function clearRepositoryIntelligenceEnhancementSessionCache() {
  completedEnhancements.clear();
  activeEnhancements.clear();
}

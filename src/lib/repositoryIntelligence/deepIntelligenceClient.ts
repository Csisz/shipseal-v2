import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
} from './productionProviderContract';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';

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
      state: 'fallback',
      category: response.status === 413 ? 'invalid_request' : 'provider_unavailable',
      retryable: response.status >= 500,
      message: 'Enhanced intelligence is unavailable. Deterministic repository intelligence remains ready.',
    };
  }
  return payload as RepositoryIntelligenceProviderApiResponse;
}

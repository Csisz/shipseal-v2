import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';
import type {
  RepositoryDeepIntelligenceCapabilities,
  RepositoryDeepIntelligenceProvider,
  RepositoryDeepIntelligenceRunOptions,
} from './deepIntelligenceProvider';
import type { RepositoryDeepIntelligenceCapability } from './deepIntelligenceSchema';

/** Local deterministic test support. This class is not exported through the domain index. */
export class FixtureRepositoryDeepIntelligenceProvider implements RepositoryDeepIntelligenceProvider {
  readonly providerId: string;
  readonly capabilities: RepositoryDeepIntelligenceCapabilities;

  constructor(private readonly fixture: {
    providerId?: string;
    capabilities?: RepositoryDeepIntelligenceCapability[];
    response?: unknown;
    error?: Error;
    delayMs?: number;
  }) {
    this.providerId = fixture.providerId || 'shipseal-fixture-provider';
    this.capabilities = {
      supported: [...(fixture.capabilities || ['architecture-analysis', 'responsibility-refinement', 'structured-output'])],
      structuredOutput: (fixture.capabilities || ['structured-output']).includes('structured-output'),
    };
  }

  async analyze(_request: RepositoryDeepIntelligenceRequest, options?: RepositoryDeepIntelligenceRunOptions): Promise<unknown> {
    if (this.fixture.delayMs) await abortableDelay(this.fixture.delayMs, options?.signal);
    if (options?.signal?.aborted) throw new Error('Fixture provider cancelled.');
    if (this.fixture.error) throw this.fixture.error;
    return cloneFixture(this.fixture.response);
  }
}

function abortableDelay(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Fixture provider cancelled.'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function cloneFixture<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

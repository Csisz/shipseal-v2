import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest.js';
import type {
  RepositoryDeepIntelligenceCapability,
  RepositoryDeepIntelligenceRawProviderResponse,
  RepositoryDeepIntelligenceResultPolicyOverride,
  RepositoryDeepIntelligenceValidatedResult,
} from './deepIntelligenceSchema.js';

export interface RepositoryDeepIntelligenceCapabilities {
  supported: RepositoryDeepIntelligenceCapability[];
  structuredOutput: boolean;
}

export interface RepositoryDeepIntelligenceRunOptions {
  signal?: AbortSignal;
}

export type RepositoryDeepIntelligenceProviderErrorCode =
  | 'request_cancelled'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'authentication_failed'
  | 'invalid_response'
  | 'response_too_large'
  | 'unknown_provider_error';

/** Safe cross-boundary provider failure. It must never contain response bodies or credentials. */
export class RepositoryDeepIntelligenceProviderError extends Error {
  constructor(
    public readonly code: RepositoryDeepIntelligenceProviderErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'RepositoryDeepIntelligenceProviderError';
  }
}

export interface RepositoryDeepIntelligenceProvider {
  readonly providerId: string;
  readonly capabilities: RepositoryDeepIntelligenceCapabilities;
  analyze(
    request: RepositoryDeepIntelligenceRequest,
    options?: RepositoryDeepIntelligenceRunOptions,
  ): Promise<RepositoryDeepIntelligenceRawProviderResponse>;
}

export type RepositoryDeepIntelligenceExecutionStatus =
  | 'completed'
  | 'provider-failure'
  | 'timeout'
  | 'cancelled'
  | 'invalid-response'
  | 'unsupported-capability';

export interface RepositoryDeepIntelligenceExecutionResult {
  status: RepositoryDeepIntelligenceExecutionStatus;
  result?: RepositoryDeepIntelligenceValidatedResult;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface RunRepositoryDeepIntelligenceInput {
  provider: RepositoryDeepIntelligenceProvider;
  request: RepositoryDeepIntelligenceRequest;
  signal?: AbortSignal;
  timeoutMs?: number;
  policy?: RepositoryDeepIntelligenceResultPolicyOverride;
}

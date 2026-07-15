import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';
import type {
  RepositoryDeepIntelligenceCapability,
  RepositoryDeepIntelligenceRawProviderResponse,
  RepositoryDeepIntelligenceResultPolicyOverride,
  RepositoryDeepIntelligenceValidatedResult,
} from './deepIntelligenceSchema';

export interface RepositoryDeepIntelligenceCapabilities {
  supported: RepositoryDeepIntelligenceCapability[];
  structuredOutput: boolean;
}

export interface RepositoryDeepIntelligenceRunOptions {
  signal?: AbortSignal;
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
  };
}

export interface RunRepositoryDeepIntelligenceInput {
  provider: RepositoryDeepIntelligenceProvider;
  request: RepositoryDeepIntelligenceRequest;
  signal?: AbortSignal;
  timeoutMs?: number;
  policy?: RepositoryDeepIntelligenceResultPolicyOverride;
}

import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest.js';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema.js';

export const REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION = 'shipseal.repository-intelligence-provider-api.v1' as const;

export type RepositoryIntelligenceProviderFailureCategory =
  | 'provider_disabled'
  | 'credentials_missing'
  | 'invalid_request'
  | 'request_timeout'
  | 'request_cancelled'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'authentication_failed'
  | 'invalid_response'
  | 'schema_validation_failed'
  | 'evidence_validation_failed'
  | 'response_too_large'
  | 'unknown_provider_error';

export type RepositoryIntelligenceProviderStatus =
  | { state: 'deterministic'; message: string; retryable: false }
  | { state: 'preparing'; message: string; retryable: false }
  | { state: 'enhanced'; message: string; retryable: false; providerId: string; modelId?: string }
  | { state: 'fallback'; message: string; retryable: boolean; category: RepositoryIntelligenceProviderFailureCategory }
  | { state: 'cancelled'; message: string; retryable: true; category: 'request_cancelled' };

export interface RepositoryIntelligenceProviderApiRequest {
  version: typeof REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION;
  request: RepositoryDeepIntelligenceRequest;
}

export type RepositoryIntelligenceProviderApiResponse =
  | {
    version: typeof REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION;
    state: 'enhanced';
    result: RepositoryDeepIntelligenceValidatedResult;
    providerId: string;
    modelId?: string;
  }
  | {
    version: typeof REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION;
    state: 'fallback';
    category: RepositoryIntelligenceProviderFailureCategory;
    retryable: boolean;
    message: string;
  };

export const DETERMINISTIC_REPOSITORY_INTELLIGENCE_STATUS: RepositoryIntelligenceProviderStatus = Object.freeze({
  state: 'deterministic',
  message: 'Deterministic repository intelligence is ready for review.',
  retryable: false,
});

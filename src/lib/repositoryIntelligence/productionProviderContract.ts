import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest.js';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema.js';

export const REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION = 'shipseal.repository-intelligence-provider-api.v1' as const;

export type RepositoryIntelligenceValidationCategory =
  | 'request-preflight-rejected'
  | 'provider-http-rejected'
  | 'provider-envelope-invalid'
  | 'response-schema-rejected'
  | 'product-opportunity-schema-rejected';

export type RepositoryIntelligenceValidationReason =
  | 'request-not-object'
  | 'serialization-failed'
  | 'request-bytes-exceeded'
  | 'content-safety-secret'
  | 'content-safety-absolute-path'
  | 'unsupported-request-schema'
  | 'invalid-result-policy'
  | 'unsupported-capability'
  | 'structural-limit-exceeded'
  | 'context-budget-exceeded'
  | 'duplicate-evidence-id'
  | 'invalid-context-path'
  | 'missing-supporting-evidence'
  | 'fingerprint-mismatch';

export type RepositoryDeepIntelligenceState =
  | 'disabled' | 'unavailable' | 'pending' | 'completed' | 'completed-with-warnings'
  | 'rejected' | 'failed' | 'timed-out' | 'budget-exceeded';

export interface RepositoryIntelligenceSafeDiagnostics {
  requestId?: string;
  reportIdentityHash?: string;
  providerType?: string;
  promptVersion?: string;
  schemaVersion?: string;
  contextVersion?: string;
  redactionVersion?: string;
  estimatedInputTokens?: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  outputBytes?: number;
  durationMs?: number;
  retryCount?: number;
  selectedFiles?: number;
  includedContextBytes?: number;
  redactedValueCount?: number;
  excludedContentCount?: number;
  acceptedFindingCount?: number;
  rejectedFindingCount?: number;
  validationWarningCount?: number;
  validationCategory?: RepositoryIntelligenceValidationCategory;
  validationReason?: RepositoryIntelligenceValidationReason;
  costEstimate: 'unavailable';
  cacheUsed?: boolean;
}

export interface RepositoryIntelligenceDeepInsightSummary {
  id: string;
  title: string;
  confidence: 'low' | 'medium' | 'high';
  validationState: 'accepted' | 'accepted-with-limitations' | 'requires-human-review';
  evidencePaths: string[];
  evidenceCount: number;
  heuristic: boolean;
  futureDirection?: { goal: string; verificationMethod?: string };
}

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
  | 'budget_exceeded'
  | 'redaction_failed'
  | 'configuration_invalid'
  | 'unknown_provider_error';

export type RepositoryIntelligenceProviderStatus =
  | { state: 'deterministic'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: false }
  | { state: 'preparing'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: false }
  | { state: 'enhanced'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: false; providerId: string; modelId?: string; diagnostics?: RepositoryIntelligenceSafeDiagnostics; insights?: RepositoryIntelligenceDeepInsightSummary[] }
  | { state: 'fallback'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: boolean; category: RepositoryIntelligenceProviderFailureCategory; diagnostics?: RepositoryIntelligenceSafeDiagnostics }
  | { state: 'cancelled'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: true; category: 'request_cancelled'; diagnostics?: RepositoryIntelligenceSafeDiagnostics };

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
    deepState: 'completed' | 'completed-with-warnings';
    diagnostics: RepositoryIntelligenceSafeDiagnostics;
  }
  | {
    version: typeof REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION;
    state: 'fallback';
    category: RepositoryIntelligenceProviderFailureCategory;
    retryable: boolean;
    message: string;
    deepState: Exclude<RepositoryDeepIntelligenceState, 'pending' | 'completed' | 'completed-with-warnings'>;
    diagnostics?: RepositoryIntelligenceSafeDiagnostics;
  };

export const DETERMINISTIC_REPOSITORY_INTELLIGENCE_STATUS: RepositoryIntelligenceProviderStatus = Object.freeze({
  state: 'deterministic',
  deepState: 'disabled',
  message: 'Deterministic repository intelligence is ready for review.',
  retryable: false,
});

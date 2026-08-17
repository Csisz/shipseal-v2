import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest.js';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema.js';
import type {
  RepositoryProductOpportunityRejectionReason,
  RepositoryProductUnderstandingRejectionReason,
} from './productIntelligenceSchema.js';

export const REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION = 'shipseal.repository-intelligence-provider-api.v1' as const;
export const REPOSITORY_PRODUCT_PIPELINE_VERSION = 'shipseal.repository-product-pipeline.v1' as const;
export const REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION = 'shipseal.repository-product-roots.v2' as const;

export interface RepositoryProductExpansionParent {
  id: string;
  title: string;
  opportunityStatement: string;
  userValue: string;
  whyItFits: string;
  evidenceIds: string[];
}

export type RepositoryProductProviderStage =
  | { kind: 'roots'; fingerprint: string }
  | {
    kind: 'expansion';
    fingerprint: string;
    batchIndex: number;
    totalBatches: number;
    parents: RepositoryProductExpansionParent[];
  };

export interface RepositoryProductExpansionEvolution {
  sourceId: string;
  parentSourceId?: string;
  generation: 2 | 3;
  title: string;
  description: string;
  userValue: string;
}

export interface RepositoryProductExpansionStageResult {
  pipelineVersion: typeof REPOSITORY_PRODUCT_PIPELINE_VERSION;
  stage: 'expansion';
  fingerprint: string;
  batchIndex: number;
  totalBatches: number;
  expansions: Array<{
    parentId: string;
    evolutions: RepositoryProductExpansionEvolution[];
  }>;
}

export type RepositoryIntelligenceValidationCategory =
  | 'request-preflight-rejected'
  | 'provider-http-rejected'
  | 'provider-envelope-invalid'
  | 'response-schema-rejected'
  | 'product-understanding-schema-rejected'
  | 'product-opportunity-schema-rejected'
  | 'insufficient-product-evidence'
  | 'insufficient-product-opportunities';

export type RepositoryProviderEnvelopeValidationReason =
  | 'content-type-not-json'
  | 'outer-json-invalid'
  | 'choices-missing'
  | 'message-missing'
  | 'refusal'
  | 'content-missing'
  | 'unsupported-content-shape'
  | 'completion-truncated'
  | 'content-filtered'
  | 'unsupported-finish-reason'
  | 'unsupported-response-state'
  | 'structured-content-json-invalid';

export type RepositoryProviderContentShape = 'string' | 'array' | 'null' | 'missing' | 'unsupported';
export type RepositoryProviderJsonParsingStage = 'content-type' | 'outer-json' | 'message-content' | 'structured-content' | 'complete';

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
  | 'fingerprint-mismatch'
  | RepositoryProviderEnvelopeValidationReason;

export type RepositoryDeepIntelligenceState =
  | 'disabled' | 'unavailable' | 'pending' | 'completed' | 'completed-with-warnings'
  | 'rejected' | 'failed' | 'timed-out' | 'budget-exceeded';

export type RepositoryIntelligenceOperationalFailureCategory =
  | 'configuration_invalid'
  | 'credentials_missing'
  | 'provider_unavailable'
  | 'provider_rate_limited'
  | 'provider_timeout'
  | 'browser_timeout'
  | 'invalid_provider_envelope'
  | 'structured_output_rejected'
  | 'language_validation_failed'
  | 'evidence_validation_failed'
  | 'roots_schema_failed'
  | 'expansion_schema_failed'
  | 'expansion_language_failed'
  | 'expansion_parent_identity_failed'
  | 'expansion_duplicate_identity_failed'
  | 'merge_incomplete'
  | 'cancelled';

export type RepositoryIntelligenceFailureBoundary =
  | 'configuration'
  | 'request-preflight'
  | 'provider-http'
  | 'provider-generation'
  | 'provider-envelope'
  | 'language-validation'
  | 'schema-validation'
  | 'evidence-normalization'
  | 'staged-merge'
  | 'browser-network';

export interface RepositoryIntelligenceSafeDiagnostics {
  buildCommit?: string;
  buildDeployment?: string;
  productPipelineVersion?: typeof REPOSITORY_PRODUCT_PIPELINE_VERSION;
  rootContractVersion?: typeof REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION;
  requestId?: string;
  requestFingerprint?: string;
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
  languageRepairCount?: number;
  selectedFiles?: number;
  includedContextBytes?: number;
  redactedValueCount?: number;
  excludedContentCount?: number;
  acceptedFindingCount?: number;
  rejectedFindingCount?: number;
  validationWarningCount?: number;
  validationCategory?: RepositoryIntelligenceValidationCategory;
  validationReason?: RepositoryIntelligenceValidationReason;
  executionProfile?: RepositoryDeepIntelligenceRequest['executionProfile'];
  providerRequestBytes?: number;
  providerEstimatedInputTokens?: number;
  outputTokenCap?: number;
  selectedFileCount?: number;
  productUnderstandingAccepted?: boolean;
  productUnderstandingRejectionReason?: RepositoryProductUnderstandingRejectionReason;
  parsedProductOpportunityCount?: number;
  compactOpportunityContract?: 'roots' | 'full';
  compactOpportunityShapeRejectedCount?: number;
  compactOpportunityShapeIssueFields?: string[];
  acceptedProductOpportunityCount?: number;
  rejectedProductOpportunityCount?: number;
  rejectedProductOpportunityReasonCounts?: Partial<Record<RepositoryProductOpportunityRejectionReason, number>>;
  compactEvidenceReferenceCount?: number;
  compactEvidenceReferenceRejectedCount?: number;
  compactCapabilityReferenceRejectedCount?: number;
  compactPathReferenceRejectedCount?: number;
  compactSupportReferenceRejectedCount?: number;
  providerHttpContentType?: string;
  providerOuterJsonParsed?: boolean;
  providerChoicesCount?: number;
  providerFinishReason?: string;
  providerMessagePresent?: boolean;
  providerContentShape?: RepositoryProviderContentShape;
  providerContentCharacters?: number;
  providerContentBytes?: number;
  providerRefusalPresent?: boolean;
  providerAnnotationsPresent?: boolean;
  providerToolCallsPresent?: boolean;
  providerPromptTokens?: number;
  providerCompletionTokens?: number;
  providerReasoningTokens?: number;
  providerTotalTokens?: number;
  providerModelId?: string;
  providerJsonParsingStage?: RepositoryProviderJsonParsingStage;
  costEstimate: 'unavailable';
  cacheUsed?: boolean;
  productStage?: 'roots' | 'expansion';
  stageFingerprint?: string;
  expansionBatchIndex?: number;
  expansionBatchCount?: number;
  acceptedSecondGenerationCount?: number;
  acceptedThirdGenerationCount?: number;
  schemaValidationFailureCount?: number;
  languageValidation?: {
    scriptCategories: Array<'CJK'>;
    violatingFieldCount: number;
    paths: string[];
  };
  expansionSchemaValidation?: {
    issueCount: number;
    paths: string[];
  };
  providerTimedOut?: boolean;
  browserTimedOut?: boolean;
  operationalFailureCategory?: RepositoryIntelligenceOperationalFailureCategory;
  failureBoundary?: RepositoryIntelligenceFailureBoundary;
  providerHttpStatusCategory?: string;
  expansionParentFutureIds?: string[];
  expansionParentCount?: number;
  acceptedRootCount?: number;
  rejectedRootCount?: number;
  stageRetryCount?: number;
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
  | { state: 'preparing'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: false; productStage?: 'roots' | 'expansion' | 'merging'; completedBatches?: number; totalBatches?: number; activeBatchIndexes?: number[] }
  | { state: 'enhanced'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: false; providerId: string; modelId?: string; diagnostics?: RepositoryIntelligenceSafeDiagnostics; insights?: RepositoryIntelligenceDeepInsightSummary[] }
  | { state: 'fallback'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: boolean; category: RepositoryIntelligenceProviderFailureCategory; diagnostics?: RepositoryIntelligenceSafeDiagnostics }
  | { state: 'cancelled'; deepState?: RepositoryDeepIntelligenceState; message: string; retryable: true; category: 'request_cancelled'; diagnostics?: RepositoryIntelligenceSafeDiagnostics };

export interface RepositoryIntelligenceProviderApiRequest {
  version: typeof REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION;
  request: RepositoryDeepIntelligenceRequest;
  productStage?: RepositoryProductProviderStage;
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
    state: 'stage-enhanced';
    stageResult: RepositoryProductExpansionStageResult;
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

export function repositoryFutureFailureMessage(
  category: RepositoryIntelligenceProviderFailureCategory,
  diagnostics?: RepositoryIntelligenceSafeDiagnostics,
) {
  const operational = diagnostics?.operationalFailureCategory;
  if (operational === 'provider_timeout' || operational === 'browser_timeout' || category === 'request_timeout') {
    return 'Future analysis took longer than expected.';
  }
  if (operational === 'provider_unavailable' || operational === 'provider_rate_limited'
    || category === 'provider_unavailable' || category === 'rate_limited') {
    return 'Future analysis is temporarily unavailable.';
  }
  if (operational === 'configuration_invalid' || operational === 'credentials_missing'
    || category === 'configuration_invalid' || category === 'credentials_missing' || category === 'provider_disabled') {
    return 'Future analysis is not available in this environment.';
  }
  if (operational === 'cancelled' || category === 'request_cancelled') return 'Future analysis was cancelled.';
  if (operational === 'merge_incomplete') return 'Some future pathways could not be completed.';
  return 'ShipSeal could not validate this Future analysis.';
}

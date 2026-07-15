import { z } from 'zod';
import type {
  EvidenceValidationState,
  FutureArtifactCategory,
  RepositoryRelationshipType,
  RepositoryResponsibility,
} from './evidence';

export const REPOSITORY_DEEP_INTELLIGENCE_REQUEST_VERSION = 'shipseal.deep-intelligence-request.v1' as const;
export const REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION = 'shipseal.deep-intelligence-response.v1' as const;
export const REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION = 'shipseal.deep-intelligence-result.v1' as const;
export const REPOSITORY_DEEP_INTELLIGENCE_PROMPT_CONTRACT_VERSION = 'shipseal.deep-intelligence-contract.v1' as const;
export const REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION = 'shipseal.deep-intelligence-validator.v1' as const;
export const REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY_VERSION = 'shipseal.deep-intelligence-result-policy.v1' as const;

export const REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES = [
  'architecture-analysis',
  'responsibility-refinement',
  'task-routing',
  'risk-identification',
  'documentation-conflict-detection',
  'agent-instruction-recommendations',
  'artifact-statement-generation',
  'structured-output',
] as const;
export type RepositoryDeepIntelligenceCapability = typeof REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES[number];

export const REPOSITORY_DEEP_INTELLIGENCE_FINDING_CATEGORIES = [
  'architecture-observation',
  'file-responsibility-refinement',
  'folder-responsibility-refinement',
  'critical-file',
  'critical-flow',
  'task-routing-recommendation',
  'agent-instruction-recommendation',
  'repository-specific-risk',
  'documentation-conflict',
  'verification-recommendation',
  'context-loading-recommendation',
  'unsupported-or-unavailable-conclusion',
] as const;
export type RepositoryDeepIntelligenceFindingCategory = typeof REPOSITORY_DEEP_INTELLIGENCE_FINDING_CATEGORIES[number];

export const REPOSITORY_DEEP_INTELLIGENCE_STATEMENT_TYPES = [
  'observation', 'responsibility', 'command', 'relationship', 'absence', 'recommendation',
] as const;
export type RepositoryDeepIntelligenceStatementType = typeof REPOSITORY_DEEP_INTELLIGENCE_STATEMENT_TYPES[number];

export type RepositoryDeepIntelligenceValidationState =
  | 'accepted'
  | 'accepted-with-limitations'
  | 'requires-human-review'
  | 'rejected'
  | 'unavailable';
export type RepositoryDeepIntelligenceConfidence = 'low' | 'medium' | 'high';
export type RepositoryDeepIntelligenceInferenceType = 'verified' | 'model-inference' | 'unavailable';
export type RepositoryDeepIntelligenceCommandState = 'verified' | 'inferred' | 'unsupported';
export type RepositoryDeepIntelligenceHumanReviewState = 'not-required' | 'required';
export type RepositoryDeepIntelligenceArtifactRelevance = 'create' | 'update' | 'strengthen';

export interface RepositoryDeepIntelligenceResultPolicy {
  version: typeof REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY_VERSION;
  maximumFindings: number;
  maximumPathsPerFinding: number;
  maximumEvidenceReferencesPerFinding: number;
  maximumRelationshipsPerFinding: number;
  maximumTextLengthPerField: number;
  maximumArtifactTargets: number;
  maximumWarnings: number;
  maximumRawResponseCharacters: number;
  defaultTimeoutMs: number;
  acceptedResponseSchemaVersions: Array<typeof REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION>;
}

export type RepositoryDeepIntelligenceResultPolicyOverride = Partial<Omit<RepositoryDeepIntelligenceResultPolicy, 'version'>> & {
  version?: typeof REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY_VERSION;
};

export const DEFAULT_REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY: RepositoryDeepIntelligenceResultPolicy = Object.freeze({
  version: REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY_VERSION,
  maximumFindings: 80,
  maximumPathsPerFinding: 12,
  maximumEvidenceReferencesPerFinding: 20,
  maximumRelationshipsPerFinding: 8,
  maximumTextLengthPerField: 2_000,
  maximumArtifactTargets: 8,
  maximumWarnings: 20,
  maximumRawResponseCharacters: 1_000_000,
  defaultTimeoutMs: 45_000,
  acceptedResponseSchemaVersions: [REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION],
});

export function resolveRepositoryDeepIntelligenceResultPolicy(
  override: RepositoryDeepIntelligenceResultPolicyOverride = {},
): RepositoryDeepIntelligenceResultPolicy {
  const policy: RepositoryDeepIntelligenceResultPolicy = {
    ...DEFAULT_REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY,
    ...override,
    version: REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY_VERSION,
    acceptedResponseSchemaVersions: [...(override.acceptedResponseSchemaVersions
      ?? DEFAULT_REPOSITORY_DEEP_INTELLIGENCE_RESULT_POLICY.acceptedResponseSchemaVersions)],
  };
  const integerFields: Array<keyof RepositoryDeepIntelligenceResultPolicy> = [
    'maximumFindings', 'maximumPathsPerFinding', 'maximumEvidenceReferencesPerFinding',
    'maximumRelationshipsPerFinding', 'maximumTextLengthPerField', 'maximumArtifactTargets',
    'maximumWarnings', 'maximumRawResponseCharacters', 'defaultTimeoutMs',
  ];
  for (const field of integerFields) {
    const value = policy[field];
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid deep-intelligence result policy value: ${field}`);
  }
  if (policy.maximumTextLengthPerField < 1 || policy.maximumRawResponseCharacters < 1 || policy.defaultTimeoutMs < 1) {
    throw new Error('Deep-intelligence text, raw response and timeout limits must be positive.');
  }
  if (!policy.acceptedResponseSchemaVersions.length
    || policy.acceptedResponseSchemaVersions.some(version => version !== REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION)) {
    throw new Error('Deep-intelligence accepted response schema versions are invalid.');
  }
  return policy;
}

const capabilitySchema = z.enum(REPOSITORY_DEEP_INTELLIGENCE_CAPABILITIES);
const categorySchema = z.enum(REPOSITORY_DEEP_INTELLIGENCE_FINDING_CATEGORIES);
const statementTypeSchema = z.enum(REPOSITORY_DEEP_INTELLIGENCE_STATEMENT_TYPES);
const relationshipTypeSchema = z.enum([
  'imports', 'exports-through', 'contains', 'configures', 'tests', 'documents',
  'provides-agent-instructions-for', 'route-belongs-to', 'entry-point-loads',
]);
const responsibilitySchema = z.enum([
  'application-entry-point', 'framework-bootstrap', 'route-or-page', 'ui-component', 'layout',
  'hook', 'state-management', 'api-route-or-request-handler', 'service',
  'repository-or-data-access-layer', 'schema-or-model', 'validation',
  'authentication-or-authorization-area', 'configuration', 'build-configuration',
  'test-configuration', 'test-or-fixture', 'utility', 'integration', 'export-barrel',
  'documentation', 'ai-agent-instruction', 'generated-or-vendor-content',
  'unknown-or-insufficient-evidence',
]);
const artifactTargetSchema = z.enum([
  'agents-instructions', 'architecture', 'critical-files', 'task-router', 'command-map',
  'known-risks', 'context-guide', 'repository-intelligence-manifest',
]);

const statementSchema = z.object({
  type: statementTypeSchema,
  subject: z.string(),
  predicate: z.string(),
  value: z.string(),
}).strict();

const relationshipClaimSchema = z.object({
  type: relationshipTypeSchema,
  sourcePath: z.string(),
  targetPath: z.string(),
  evidenceIds: z.array(z.string()),
}).strict();

const rawFindingSchema = z.object({
  id: z.string(),
  category: categorySchema,
  title: z.string(),
  statement: statementSchema,
  referencedPaths: z.array(z.string()),
  referencedEvidenceIds: z.array(z.string()),
  referencedSymbols: z.array(z.object({ path: z.string(), name: z.string() }).strict()).optional(),
  providerConfidence: z.number().finite().min(0).max(1),
  inferenceType: z.enum(['verified', 'model-inference', 'unavailable']),
  limitations: z.array(z.string()),
  artifactTargets: z.array(artifactTargetSchema),
  relationshipClaims: z.array(relationshipClaimSchema).optional(),
  proposedResponsibility: responsibilitySchema.optional(),
  requiresHumanReview: z.boolean().optional(),
  artifactRelevance: z.array(z.enum(['create', 'update', 'strengthen'])).optional(),
}).strict();

const usageSchema = z.object({
  inputUnits: z.number().finite().nonnegative().optional(),
  outputUnits: z.number().finite().nonnegative().optional(),
  totalUnits: z.number().finite().nonnegative().optional(),
  estimatedCost: z.number().finite().nonnegative().optional(),
  currency: z.string().optional(),
  cacheUsed: z.boolean().optional(),
}).strict();

export const repositoryDeepIntelligenceProviderResponseSchema = z.object({
  schemaVersion: z.literal(REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION),
  providerId: z.string(),
  modelId: z.string().optional(),
  providerVersion: z.string().optional(),
  returnedCapabilities: z.array(capabilitySchema),
  findings: z.array(rawFindingSchema),
  warnings: z.array(z.string()).optional(),
  usage: usageSchema.optional(),
  truncated: z.boolean().optional(),
}).strict();

export type RepositoryDeepIntelligenceNormalizedProviderResponse = z.infer<typeof repositoryDeepIntelligenceProviderResponseSchema>;
export type RepositoryDeepIntelligenceRawFinding = z.infer<typeof rawFindingSchema>;
/** Untrusted provider return value before strict schema parsing. */
export type RepositoryDeepIntelligenceRawProviderResponse = unknown;

export interface RepositoryDeepIntelligenceValidatedRelationship {
  type: RepositoryRelationshipType;
  sourcePath: string;
  targetPath: string;
  supportingEvidenceIds: string[];
  inferenceType: 'verified' | 'model-inference';
}

export interface RepositoryDeepIntelligenceValidatedFinding {
  originalProviderFindingId: string;
  id: string;
  category: RepositoryDeepIntelligenceFindingCategory;
  title: string;
  statement: RepositoryDeepIntelligenceRawFinding['statement'];
  validationState: Exclude<RepositoryDeepIntelligenceValidationState, 'rejected' | 'unavailable'>;
  acceptedConfidence: RepositoryDeepIntelligenceConfidence;
  inferenceType: RepositoryDeepIntelligenceInferenceType;
  acceptedPaths: string[];
  supportingEvidenceIds: string[];
  referencedSymbols: Array<{ path: string; name: string }>;
  proposedResponsibility?: RepositoryResponsibility;
  relationships: RepositoryDeepIntelligenceValidatedRelationship[];
  commandState?: RepositoryDeepIntelligenceCommandState;
  removedFields: string[];
  validationMessages: string[];
  limitations: string[];
  humanReviewState: RepositoryDeepIntelligenceHumanReviewState;
  eligibleForArtifactGeneration: boolean;
  permittedArtifactTargets: FutureArtifactCategory[];
  artifactRelevance: RepositoryDeepIntelligenceArtifactRelevance[];
}

export interface RepositoryDeepIntelligenceRejectedFinding {
  originalProviderFindingId?: string;
  category?: RepositoryDeepIntelligenceFindingCategory;
  state: 'rejected' | 'unavailable';
  reasonCodes: string[];
  validationMessages: string[];
}

export interface RepositoryDeepIntelligenceValidationSummary {
  receivedFindings: number;
  acceptedFindings: number;
  acceptedWithLimitations: number;
  requiringHumanReview: number;
  rejectedFindings: number;
  unavailableFindings: number;
  duplicateProviderFindingIds: number;
  confidenceDowngrades: number;
  validationMessages: string[];
}

export interface RepositoryDeepIntelligenceRunMetadata {
  providerId: string;
  modelId?: string;
  providerVersion?: string;
  responseSchemaVersion: typeof REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION;
  requestFingerprint: string;
  promptContractVersion: typeof REPOSITORY_DEEP_INTELLIGENCE_PROMPT_CONTRACT_VERSION;
  validatorVersion: typeof REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION;
  requestedCapabilities: RepositoryDeepIntelligenceCapability[];
  returnedCapabilities: RepositoryDeepIntelligenceCapability[];
  usage?: RepositoryDeepIntelligenceNormalizedProviderResponse['usage'];
  truncated: boolean;
  providerWarnings: string[];
}

export interface RepositoryDeepIntelligenceValidatedResult {
  version: typeof REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION;
  findings: RepositoryDeepIntelligenceValidatedFinding[];
  rejectedFindings: RepositoryDeepIntelligenceRejectedFinding[];
  summary: RepositoryDeepIntelligenceValidationSummary;
  metadata: RepositoryDeepIntelligenceRunMetadata;
  limitations: string[];
  fingerprint: string;
}

export interface RepositoryDeepIntelligenceEvidenceReference {
  id: string;
  path: string;
  category: string;
  extractedFact: string;
  responsibility?: RepositoryResponsibility;
  confidence: number;
  validationState: EvidenceValidationState;
  assertionState: string;
}

import type { RepoScanInput } from '../types.js';
import type { RepositoryIntelligenceContextBundle } from './contextPreparation.js';
import type { RepositoryIntelligenceEvidenceModel } from './evidence.js';
import type {
  RepositoryDeepIntelligenceConfidence,
  RepositoryDeepIntelligenceValidatedResult,
} from './deepIntelligenceSchema.js';

export const REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION = 'shipseal.repository-intelligence-artifacts.v1' as const;
export const REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION = 'shipseal.repository-intelligence-artifact-policy.v1' as const;
export const REPOSITORY_INTELLIGENCE_ARTIFACT_GENERATOR_VERSION = 'shipseal.repository-intelligence-artifact-generator.v1' as const;

export type RepositoryIntelligenceArtifactCategory =
  | 'root-agent-instructions'
  | 'folder-agent-instructions'
  | 'architecture-memory'
  | 'critical-files-memory'
  | 'command-map'
  | 'known-risks-memory'
  | 'task-router'
  | 'context-guidance'
  | 'evidence-manifest';

/** Reuses Optimization Plan action names and adds explicit non-output states required by this boundary. */
export type RepositoryIntelligenceArtifactOperation = 'create' | 'update' | 'strengthen' | 'unavailable' | 'skip';
export type RepositoryIntelligenceArtifactReviewState = 'ready-for-review' | 'requires-human-review' | 'blocked' | 'unavailable';
export type RepositoryIntelligenceExistingFileState =
  | 'missing'
  | 'shipseal-managed'
  | 'handwritten'
  | 'partial'
  | 'uninterpretable'
  | 'excluded-or-unavailable';

export type RepositoryIntelligenceArtifactStatementType =
  | 'heading'
  | 'repository-fact'
  | 'instruction'
  | 'responsibility-description'
  | 'command'
  | 'route'
  | 'relationship'
  | 'risk'
  | 'limitation'
  | 'verification-step'
  | 'context-loading-rule'
  | 'excluded-area-rule'
  | 'unavailable-information-notice';

export type RepositoryIntelligenceArtifactStatementValidationState = 'verified' | 'inferred' | 'limited' | 'unavailable';

export interface RepositoryIntelligenceArtifactStatement {
  id: string;
  type: RepositoryIntelligenceArtifactStatementType;
  artifactCategory: RepositoryIntelligenceArtifactCategory;
  section: string;
  content: {
    title?: string;
    text: string;
    label?: string;
    value?: string;
  };
  referencedPaths: string[];
  referencedSymbols: Array<{ path: string; name: string }>;
  supportingEvidenceIds: string[];
  supportingFindingIds: string[];
  acceptedConfidence: RepositoryDeepIntelligenceConfidence;
  validationState: RepositoryIntelligenceArtifactStatementValidationState;
  humanReviewRequired: boolean;
  limitations: string[];
  order: number;
  existingContentRelationship?: 'new' | 'proposed-addition' | 'managed-update' | 'already-covered';
  rescanVerificationTarget?: { kind: 'path' | 'evidence' | 'command' | 'relationship'; value: string };
}

export interface RepositoryIntelligencePlannedArtifact {
  id: string;
  category: RepositoryIntelligenceArtifactCategory;
  targetPath: string;
  operation: RepositoryIntelligenceArtifactOperation;
  operationReason: string;
  reviewState: RepositoryIntelligenceArtifactReviewState;
  existingFileState: RepositoryIntelligenceExistingFileState;
  statements: RepositoryIntelligenceArtifactStatement[];
  requiredEvidenceIds: string[];
  contributingFindingIds: string[];
  dependencies: RepositoryIntelligenceArtifactCategory[];
  blockingLimitations: string[];
  preservation: {
    mode: 'create-new' | 'replace-managed' | 'propose-additions' | 'no-change' | 'no-output';
    existingContentPreserved: boolean;
  };
  fingerprint: string;
}

export interface RepositoryIntelligenceArtifactPlanSummary {
  totalArtifacts: number;
  readyForReview: number;
  requiringHumanReview: number;
  blocked: number;
  unavailable: number;
  operationCounts: Record<RepositoryIntelligenceArtifactOperation, number>;
  statementCount: number;
  evidenceReferenceCount: number;
  findingReferenceCount: number;
}

export interface RepositoryIntelligenceArtifactPlan {
  version: typeof REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION;
  policy: RepositoryIntelligenceArtifactPolicy;
  artifacts: RepositoryIntelligencePlannedArtifact[];
  summary: RepositoryIntelligenceArtifactPlanSummary;
  limitations: string[];
  deterministicOnly: boolean;
  inputFingerprints: {
    contextBundle: string;
    deepIntelligenceResult?: string;
  };
  fingerprint: string;
}

export interface RepositoryIntelligenceArtifactPolicy {
  version: typeof REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION;
  maximumFolderAgentArtifacts: number;
  maximumStatementsPerArtifact: number;
  maximumCriticalFiles: number;
  maximumRisks: number;
  maximumTaskRoutes: number;
  maximumReferencedPathsPerStatement: number;
  maximumArtifactCharacters: number;
  minimumAcceptedConfidence: RepositoryDeepIntelligenceConfidence;
  includeHumanReviewFindings: boolean;
  deterministicOnlyFallback: boolean;
  existingFilePreservationMode: 'preserve-handwritten';
}

export type RepositoryIntelligenceArtifactPolicyOverride = Partial<Omit<RepositoryIntelligenceArtifactPolicy, 'version' | 'existingFilePreservationMode'>> & {
  version?: typeof REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION;
  existingFilePreservationMode?: 'preserve-handwritten';
};

export const DEFAULT_REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY: RepositoryIntelligenceArtifactPolicy = Object.freeze({
  version: REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION,
  maximumFolderAgentArtifacts: 5,
  maximumStatementsPerArtifact: 60,
  maximumCriticalFiles: 12,
  maximumRisks: 10,
  maximumTaskRoutes: 14,
  maximumReferencedPathsPerStatement: 8,
  maximumArtifactCharacters: 200_000,
  minimumAcceptedConfidence: 'low',
  includeHumanReviewFindings: true,
  deterministicOnlyFallback: true,
  existingFilePreservationMode: 'preserve-handwritten',
});

export function resolveRepositoryIntelligenceArtifactPolicy(
  override: RepositoryIntelligenceArtifactPolicyOverride = {},
): RepositoryIntelligenceArtifactPolicy {
  const policy = {
    ...DEFAULT_REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY,
    ...override,
    version: REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION,
    existingFilePreservationMode: 'preserve-handwritten' as const,
  };
  const integerFields: Array<keyof RepositoryIntelligenceArtifactPolicy> = [
    'maximumFolderAgentArtifacts', 'maximumStatementsPerArtifact', 'maximumCriticalFiles',
    'maximumRisks', 'maximumTaskRoutes', 'maximumReferencedPathsPerStatement', 'maximumArtifactCharacters',
  ];
  for (const field of integerFields) {
    const value = policy[field];
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid repository-intelligence artifact policy value: ${field}`);
  }
  if (policy.maximumArtifactCharacters < 1 || policy.maximumReferencedPathsPerStatement < 1) {
    throw new Error('Artifact character and referenced-path limits must be positive.');
  }
  if (!['low', 'medium', 'high'].includes(policy.minimumAcceptedConfidence)) throw new Error('Artifact minimum confidence is invalid.');
  return policy;
}

export interface PlanRepositoryIntelligenceArtifactsInput {
  scanInput: RepoScanInput;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  contextBundle: RepositoryIntelligenceContextBundle;
  deepIntelligenceResult?: RepositoryDeepIntelligenceValidatedResult;
  policy?: RepositoryIntelligenceArtifactPolicyOverride;
}

export interface RepositoryIntelligenceRenderedArtifact {
  artifactId: string;
  category: RepositoryIntelligenceArtifactCategory;
  targetPath: string;
  operation: RepositoryIntelligenceArtifactOperation;
  reviewState: RepositoryIntelligenceArtifactReviewState;
  content: string;
  fingerprint: string;
}

export interface RepositoryIntelligenceArtifactManifest {
  version: 'shipseal.repository-intelligence-evidence-manifest.v1';
  generatorVersion: typeof REPOSITORY_INTELLIGENCE_ARTIFACT_GENERATOR_VERSION;
  policyVersion: typeof REPOSITORY_INTELLIGENCE_ARTIFACT_POLICY_VERSION;
  artifactSetFingerprint: string;
  inputFingerprints: RepositoryIntelligenceArtifactPlan['inputFingerprints'];
  artifacts: Array<{
    artifactId: string;
    path: string;
    operation: RepositoryIntelligenceArtifactOperation;
    artifactFingerprint: string;
    statementIds: string[];
    statements: Array<{
      id: string;
      type: RepositoryIntelligenceArtifactStatementType;
      evidenceIds: string[];
      findingIds: string[];
      referencedPaths: string[];
      confidence: RepositoryDeepIntelligenceConfidence;
      validationState: RepositoryIntelligenceArtifactStatementValidationState;
      humanReviewRequired: boolean;
      limitations: string[];
    }>;
    reviewState: RepositoryIntelligenceArtifactReviewState;
    limitations: string[];
  }>;
  fingerprint: string;
}

export interface RepositoryIntelligenceArtifactSet {
  version: typeof REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION;
  plan: RepositoryIntelligenceArtifactPlan;
  artifacts: RepositoryIntelligenceRenderedArtifact[];
  manifest: RepositoryIntelligenceArtifactManifest;
  fingerprint: string;
}

export interface RepositoryIntelligenceArtifactValidationIssue {
  code: string;
  state: 'warning' | 'error';
  artifactId?: string;
  statementId?: string;
  message: string;
}

export interface RepositoryIntelligenceArtifactValidationResult {
  valid: boolean;
  issues: RepositoryIntelligenceArtifactValidationIssue[];
  validatedArtifactIds: string[];
  blockedArtifactIds: string[];
  summary: { artifacts: number; statements: number; errors: number; warnings: number };
}

import type { RepositoryUniverseModel } from '../repositoryUniverse.js';

export const REPOSITORY_FUTURE_GRAPH_VERSION = 'shipseal.repository-future-graph.v1' as const;
export const REPOSITORY_FUTURE_GRAPH_POLICY_VERSION = 'shipseal.repository-future-graph-policy.omega18.5b.v1' as const;

export type RepositoryFutureConfidence = 'high' | 'medium' | 'low';
export type RepositoryFutureOrigin = 'deterministic' | 'deep-intelligence' | 'verified-signal';
export type RepositoryFutureNodeKind = 'repository-entity' | 'future-goal' | 'capability' | 'artifact' | 'gate' | 'outcome';
export type RepositoryFutureCurrentness = 'current' | 'future';
export type RepositoryFutureLifecycle = 'current' | 'proposed' | 'prepared' | 'applied-unverified' | 'verified' | 'historical';
export type RepositoryFutureHumanReviewState = 'not-required' | 'required';
export type RepositoryFutureEvidenceState = 'observed-current' | 'deterministic-inference' | 'provider-suggestion' | 'verified-signal';
export type RepositoryFutureEligibility = 'eligible' | 'exploratory' | 'blocked' | 'unsupported';
export type RepositoryFutureFit = 'strong-evidence-fit' | 'supported-with-review' | 'exploratory' | 'blocked';

export const REPOSITORY_FUTURE_FIT_LABELS: Record<RepositoryFutureFit, string> = {
  'strong-evidence-fit': 'Strong evidence fit',
  'supported-with-review': 'Supported with review',
  exploratory: 'Exploratory',
  blocked: 'Blocked',
};

export type RepositoryFutureEdgeRelation =
  | 'supports'
  | 'requires'
  | 'conflicts-with'
  | 'produces'
  | 'gates'
  | 'verifies'
  | 'unlocks'
  | 'save-for-later-lineage';

export type RepositoryFutureDependencyRequirement = 'required' | 'optional';
export type RepositoryFutureDependencyState = 'satisfied' | 'missing' | 'blocked' | 'stale' | 'review-required' | 'unknown';

export type RepositoryFutureConflictKind =
  | 'goal-incompatibility'
  | 'dependency-contradiction'
  | 'dependency-cycle'
  | 'artifact-target-collision'
  | 'action-mismatch'
  | 'unsafe-sensitive-target'
  | 'insufficient-evidence'
  | 'stale-identity'
  | 'foreign-repository'
  | 'foreign-scan'
  | 'unsupported-generator'
  | 'incompatible-verification-boundary'
  | 'human-review-required';

export type RepositoryFutureConflictSeverity = 'informational' | 'review' | 'blocking';

export interface RepositoryFutureRepositoryBinding {
  repositoryId: string;
  projectId?: string;
  sourceScanId: string;
  sourceScanFingerprint: string;
  limited: boolean;
}

export interface RepositoryFutureEvidenceReference {
  id: string;
  path?: string;
  sourceScanId: string;
  sourceScanFingerprint: string;
  state: RepositoryFutureEvidenceState;
  origin: RepositoryFutureOrigin;
  confidence: RepositoryFutureConfidence;
  contractVersion?: string;
  limitation?: string;
  humanReviewRequired: boolean;
}

export interface RepositoryFutureUniverseMapping {
  universeNodeId: string;
  repositoryRelativePath?: string;
}

export interface RepositoryFutureExpectedArtifact {
  id: string;
  family: string;
  targetPath?: string;
  action?: 'create' | 'update' | 'strengthen' | 'unavailable';
  generatorId?: string;
  supported: boolean;
  contentFingerprint?: string;
  humanReviewRequired: boolean;
  limitations: string[];
}

export interface RepositoryFutureCandidateDependencyHint {
  capabilityId: string;
  requirement: RepositoryFutureDependencyRequirement;
  origin: RepositoryFutureOrigin;
  rationale: string;
  evidenceIds: string[];
  confidence: RepositoryFutureConfidence;
  state?: RepositoryFutureDependencyState;
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
}

export interface RepositoryFutureNormalizedCandidate {
  id: string;
  sourceId: string;
  sourceContractVersion: string;
  repositoryId: string;
  sourceScanId: string;
  sourceScanFingerprint: string;
  title: string;
  rationale: string;
  origin: RepositoryFutureOrigin;
  lifecycle: 'proposed';
  currentness: 'future';
  targetCapabilityId: string;
  evidence: RepositoryFutureEvidenceReference[];
  dependencies: RepositoryFutureCandidateDependencyHint[];
  expectedArtifacts: RepositoryFutureExpectedArtifact[];
  confidence: RepositoryFutureConfidence;
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
  unavailableInformation: string[];
  compatibilityHints: string[];
  incompatibleCandidateIds: string[];
  universeMappings: RepositoryFutureUniverseMapping[];
  verificationMethod?: string;
  alignment: 'direct-friction' | 'transformation' | 'workspace-evidence' | 'verified-opportunity' | 'provider-suggestion';
  eligibility: RepositoryFutureEligibility;
  fit: RepositoryFutureFit;
  contentFingerprint: string;
}

export interface RepositoryFutureCandidateRejection {
  sourceId?: string;
  origin: RepositoryFutureOrigin;
  reasonCodes: Array<'invalid-shape' | 'invalid-path' | 'missing-future-direction' | 'foreign-project' | 'ineligible-verification' | 'unsupported-signal'>;
  limitations: string[];
}

export interface RepositoryFutureCandidateAdapterResult {
  candidates: RepositoryFutureNormalizedCandidate[];
  rejected: RepositoryFutureCandidateRejection[];
}

export interface RepositoryFutureDependencyDefinition {
  id: string;
  title: string;
  rationale: string;
  requires: string[];
}

export interface RepositoryFutureDependency {
  id: string;
  capabilityId: string;
  title: string;
  requirement: RepositoryFutureDependencyRequirement;
  origin: RepositoryFutureOrigin;
  rationale: string;
  evidenceIds: string[];
  confidence: RepositoryFutureConfidence;
  state: RepositoryFutureDependencyState;
  dependentGoalIds: string[];
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
  fingerprint: string;
}

export interface RepositoryFutureDependencyCycle {
  id: string;
  dependencyIds: string[];
  capabilityIds: string[];
  affectedGoalIds: string[];
  blocking: true;
  rationale: string;
  fingerprint: string;
}

export interface RepositoryFutureNode {
  id: string;
  schemaVersion: typeof REPOSITORY_FUTURE_GRAPH_VERSION;
  kind: RepositoryFutureNodeKind;
  lifecycle: RepositoryFutureLifecycle;
  currentness: RepositoryFutureCurrentness;
  title: string;
  rationale: string;
  origin: RepositoryFutureOrigin;
  evidenceIds: string[];
  evidencePaths: string[];
  confidence: RepositoryFutureConfidence;
  humanReviewState: RepositoryFutureHumanReviewState;
  universeMappings: RepositoryFutureUniverseMapping[];
  limitations: string[];
  unavailableInformation: string[];
  contentFingerprint: string;
  candidateId?: string;
  capabilityId?: string;
  artifactId?: string;
}

export interface RepositoryFutureEdge {
  id: string;
  source: string;
  target: string;
  relation: RepositoryFutureEdgeRelation;
  origin: RepositoryFutureOrigin;
  confidence: RepositoryFutureConfidence;
  evidenceIds: string[];
  lifecycle: RepositoryFutureLifecycle;
  limitations: string[];
  fingerprint: string;
}

export interface RepositoryFutureConflict {
  id: string;
  kind: RepositoryFutureConflictKind;
  severity: RepositoryFutureConflictSeverity;
  affectedNodeIds: string[];
  affectedPaths: string[];
  evidenceIds: string[];
  rationale: string;
  blocking: boolean;
  recovery: string;
  fingerprint: string;
}

export interface RepositoryFutureGraph {
  version: typeof REPOSITORY_FUTURE_GRAPH_VERSION;
  policyVersion: typeof REPOSITORY_FUTURE_GRAPH_POLICY_VERSION;
  repository: RepositoryFutureRepositoryBinding;
  sourceUniverseFingerprint: string;
  nodes: RepositoryFutureNode[];
  edges: RepositoryFutureEdge[];
  candidates: RepositoryFutureNormalizedCandidate[];
  dependencies: RepositoryFutureDependency[];
  dependencyCycles: RepositoryFutureDependencyCycle[];
  conflicts: RepositoryFutureConflict[];
  rejectedInputs: RepositoryFutureCandidateRejection[];
  summary: {
    currentReferenceNodes: number;
    eligibleCandidates: number;
    exploratoryCandidates: number;
    blockedCandidates: number;
    unsupportedCandidates: number;
    requiredDependencies: number;
    satisfiedDependencies: number;
    blockingConflicts: number;
    limited: boolean;
  };
  limitations: string[];
  fingerprint: string;
}

export interface BuildRepositoryFutureGraphInput {
  repository: RepositoryFutureRepositoryBinding;
  universe: RepositoryUniverseModel;
  candidateResults: RepositoryFutureCandidateAdapterResult[];
  capabilityDefinitions?: RepositoryFutureDependencyDefinition[];
  satisfiedCapabilityIds?: string[];
}

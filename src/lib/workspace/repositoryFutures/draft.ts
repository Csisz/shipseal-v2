import type {
  RepositoryFutureConfidence,
  RepositoryFutureConflict,
  RepositoryFutureDependencyState,
  RepositoryFutureEvidenceReference,
  RepositoryFutureFit,
  RepositoryFutureHumanReviewState,
  RepositoryFutureNode,
  RepositoryFutureOrigin,
  RepositoryFutureRepositoryBinding,
} from './schema.js';

export const REPOSITORY_FUTURE_DRAFT_VERSION = 'shipseal.repository-future-draft.v2' as const;
export const REPOSITORY_FUTURE_SYNTHESIS_VERSION = 'shipseal.repository-future-synthesis.omega18.5.v2' as const;
export const REPOSITORY_FUTURE_QUICK_PATH_LIMIT = 24;

export type RepositoryFutureCompatibilityState =
  | 'compatible'
  | 'compatible-with-review'
  | 'incompatible'
  | 'blocked'
  | 'already-selected';

export const REPOSITORY_FUTURE_COMPATIBILITY_LABELS: Record<RepositoryFutureCompatibilityState, string> = {
  compatible: 'Compatible',
  'compatible-with-review': 'Compatible with review',
  incompatible: 'Incompatible',
  blocked: 'Blocked',
  'already-selected': 'Already selected',
};

export interface RepositoryFutureDraftSelection {
  sourceGraphFingerprint: string;
  primaryGoalIds: string[];
  supportingGoalIds: string[];
  savedGoalIds?: string[];
}

export interface RepositoryFutureDraftGoal {
  goalId: string;
  candidateId: string;
  title: string;
  rationale: string;
  origin: RepositoryFutureOrigin;
  confidence: RepositoryFutureConfidence;
  fit: RepositoryFutureFit;
  evidenceIds: string[];
  evidencePaths: string[];
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
}

export interface RepositoryFutureDraftDependency {
  id: string;
  capabilityId: string;
  title: string;
  state: RepositoryFutureDependencyState;
  origin: RepositoryFutureOrigin;
  rationale: string;
  evidenceIds: string[];
  confidence: RepositoryFutureConfidence;
  dependentGoalIds: string[];
  causeChains: string[][];
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
  sourceFingerprint: string;
  executionOrder: number;
}

export interface RepositoryFutureCompatibilityResult {
  candidateId?: string;
  goalId: string;
  state: RepositoryFutureCompatibilityState;
  affectedSelectedGoalIds: string[];
  conflictIds: string[];
  requiredReview: boolean;
  reasons: string[];
}

export type RepositoryFutureExclusionReason =
  | 'not-selected'
  | 'saved-for-later'
  | 'conflicts-with-primary'
  | 'conflicts-with-support'
  | 'support-limit-reached'
  | 'missing-required-evidence'
  | 'dependency-cycle'
  | 'unsupported-dependency'
  | 'unsafe-target'
  | 'artifact-collision'
  | 'stale-scope'
  | 'blocked'
  | 'unsupported'
  | 'exploratory';

export interface RepositoryFutureSavedAlternative {
  candidateId: string;
  goalId: string;
  sourceGraphFingerprint: string;
  title: string;
  rationale: string;
  origin: RepositoryFutureOrigin;
  fit: RepositoryFutureFit;
  evidence: RepositoryFutureEvidenceReference[];
  compatibility: RepositoryFutureCompatibilityState;
  compatibilityReasons: string[];
  conflictIds: string[];
  exclusionReasons: RepositoryFutureExclusionReason[];
  savedForLater: boolean;
  limitations: string[];
}

export interface RepositoryFutureExcludedCandidate {
  candidateId: string;
  goalId: string;
  reasons: RepositoryFutureExclusionReason[];
  conflictIds: string[];
  rationale: string[];
}

export type RepositoryFutureTradeOffCategory =
  | 'impactBreadth'
  | 'changeWeight'
  | 'verificationBurden'
  | 'reversibility'
  | 'humanReview'
  | 'knownConflicts'
  | 'unavailableInformation';

export type RepositoryFutureTradeOffValue =
  | 'focused'
  | 'cross-cutting'
  | 'small'
  | 'moderate'
  | 'broad'
  | 'low'
  | 'high'
  | 'direct'
  | 'review-dependent'
  | 'uncertain'
  | 'none'
  | 'required'
  | 'known'
  | 'limited';

export interface RepositoryFutureTradeOff {
  category: RepositoryFutureTradeOffCategory;
  value: RepositoryFutureTradeOffValue;
  rationale: string;
  evidenceIds: string[];
  nodeIds: string[];
  conflictIds: string[];
}

export interface RepositoryFutureHumanReviewRequirement {
  sourceId: string;
  sourceKind: 'goal' | 'dependency' | 'artifact' | 'gate' | 'conflict';
  rationale: string;
  evidenceIds: string[];
}

export type RepositoryFuturePreparationReadiness = 'ready' | 'review-required' | 'blocked';

export interface RepositoryFutureDraft {
  schemaVersion: typeof REPOSITORY_FUTURE_DRAFT_VERSION;
  synthesisVersion: typeof REPOSITORY_FUTURE_SYNTHESIS_VERSION;
  id: string;
  sourceGraphFingerprint: string;
  sourceRepository: RepositoryFutureRepositoryBinding;
  primaryGoal: RepositoryFutureDraftGoal;
  supportingGoals: RepositoryFutureDraftGoal[];
  savedGoalIds: string[];
  dependencies: RepositoryFutureDraftDependency[];
  dependencyExecutionOrder: string[];
  executionOrder: string[];
  compatibilityState: 'compatible' | 'compatible-with-review';
  compatibilityMatrix: RepositoryFutureCompatibilityResult[];
  conflicts: RepositoryFutureConflict[];
  savedAlternatives: RepositoryFutureSavedAlternative[];
  excludedCandidates: RepositoryFutureExcludedCandidate[];
  tradeOffs: RepositoryFutureTradeOff[];
  artifacts: RepositoryFutureNode[];
  gates: RepositoryFutureNode[];
  humanReviewRequirements: RepositoryFutureHumanReviewRequirement[];
  preparationReadiness: RepositoryFuturePreparationReadiness;
  limitations: string[];
  fingerprint: string;
}

export type RepositoryFutureSynthesisFailureCode =
  | 'invalid-graph-binding'
  | 'invalid-primary-count'
  | 'invalid-selection'
  | 'support-limit-exceeded'
  | 'blocking-conflict'
  | 'dependency-cycle'
  | 'unsupported-dependency'
  | 'no-eligible-primary';

export interface RepositoryFutureSynthesisIssue {
  code: RepositoryFutureSynthesisFailureCode | 'duplicate-selection' | 'unknown-goal' | 'ineligible-goal';
  goalIds: string[];
  conflictIds: string[];
  dependencyIds: string[];
  reason: string;
  recovery: string;
}

export type RepositoryFutureSynthesisResult =
  | { ok: true; draft: RepositoryFutureDraft }
  | {
      ok: false;
      code: RepositoryFutureSynthesisFailureCode;
      sourceGraphFingerprint: string;
      issues: RepositoryFutureSynthesisIssue[];
      limitations: string[];
    };

export interface RepositoryFutureCandidateRecommendation {
  rank: number;
  candidateId: string;
  goalId: string;
  title: string;
  fit: RepositoryFutureFit;
  compatibility: RepositoryFutureCompatibilityState;
  requiredReview: boolean;
  reasons: string[];
}

export interface RepositoryFuturePrimaryRecommendations {
  state: 'available' | 'none';
  sourceGraphFingerprint: string;
  candidates: RepositoryFutureCandidateRecommendation[];
  reasons: string[];
  limitations: string[];
}

export interface RepositoryFutureQuickPathModel {
  sourceGraphFingerprint: string;
  primaryRecommendations: RepositoryFuturePrimaryRecommendations;
  selectedPrimary?: RepositoryFutureDraftGoal;
  supportingRecommendations: RepositoryFutureCandidateRecommendation[];
  selectedSupportingGoals: RepositoryFutureDraftGoal[];
  automaticDependencies: RepositoryFutureDraftDependency[];
  compatibilityMatrix: RepositoryFutureCompatibilityResult[];
  tradeOffs: RepositoryFutureTradeOff[];
  humanReviewRequirements: RepositoryFutureHumanReviewRequirement[];
  conflicts: RepositoryFutureConflict[];
  savedAlternatives: RepositoryFutureSavedAlternative[];
  draftValidity: 'unselected' | 'valid' | 'review-required' | 'blocked';
}

export interface RepositoryFutureDraftOperationResult {
  result: RepositoryFutureSynthesisResult;
  removedGoalIds: string[];
}

export interface RepositoryFutureDependencyImpact {
  dependencyId: string;
  capabilityId: string;
  state: RepositoryFutureDependencyState;
  directDependentGoalIds: string[];
  causeChains: string[][];
  evidenceIds: string[];
  humanReviewState: RepositoryFutureHumanReviewState;
  requiredByPrimary: boolean;
  removableByRemovingSupportingGoals: boolean;
  removableSupportingGoalIds: string[];
}

export interface RepositoryFutureDependencyExclusionResult {
  allowed: boolean;
  dependencyId: string;
  dependentGoalIds: string[];
  reason: string;
}

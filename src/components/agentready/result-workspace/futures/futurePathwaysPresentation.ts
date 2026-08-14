import type { RepositoryFutureUniverseProjection } from '@/lib/workspace/repositoryFutures';

export type RepositoryFuturePathwaysMode = 'quick' | 'deep';

export interface RepositoryFutureStageCandidate {
  goalId: string;
  title: string;
  fit: string;
  role: 'candidate' | 'primary' | 'supporting' | 'saved' | 'blocked';
  origin: string;
  capabilityId: string;
  confidence: string;
  compatibility: string;
  compatibilityReasons?: string[];
  eligibleAsPrimary?: boolean;
  savedForLater?: boolean;
  humanReviewRequired: boolean;
  evidenceCount: number;
  mappedEvidenceCount: number;
  universeNodeIds: string[];
  capabilityTitle?: string;
  rationale?: string;
  evidencePaths?: string[];
  artifactLabels?: string[];
  limitations?: string[];
  candidateClass?: 'product-opportunity' | 'repository-improvement';
  opportunityOrigin?: 'evidence-backed' | 'strategic' | 'exploratory';
  /** Stable semantic horizon supplied by the graph adapter, never by plan role. */
  futureDepth?: 1 | 2 | 3;
  userValue?: string;
  whyItFits?: string;
  targetUsers?: string[];
  replaceableSupportGoalIds?: string[];
}

export interface RepositoryFutureStageDependency {
  id: string;
  title: string;
  state: string;
  dependentCount: number;
  dependentGoalIds: string[];
  executionOrder: number;
  humanReviewRequired: boolean;
  rationale?: string;
  evidencePaths?: string[];
  limitations?: string[];
}

export interface RepositoryFutureStageProjection {
  id: string;
  goalId: string;
  kind: 'capability' | 'artifact';
  title: string;
  sourceId: string;
  order: number;
  humanReviewRequired: boolean;
}

export interface RepositoryFutureStageOverlay {
  active: true;
  mode: RepositoryFuturePathwaysMode;
  phase: 'possibility' | 'choice' | 'synthesis';
  graphFingerprint: string;
  draftFingerprint?: string;
  universeProjection?: RepositoryFutureUniverseProjection;
  candidates: RepositoryFutureStageCandidate[];
  projections?: RepositoryFutureStageProjection[];
  dependencies: RepositoryFutureStageDependency[];
  artifactCount: number;
  gateCount: number;
  conflictCount: number;
  limited: boolean;
  focusedId?: string;
  activeTraceId?: string;
  tracePinned?: boolean;
  supportCount: number;
  productIntelligenceState: 'analysing' | 'enhanced' | 'deterministic-fallback' | 'unavailable';
  notice?: string;
  onModeChange: (mode: RepositoryFuturePathwaysMode) => void;
  onCandidateFocus: (goalId: string) => void;
  onCandidateSelect: (goalId: string) => void;
  onCandidateAddSupport: (goalId: string) => void;
  onCandidateRemoveSupport: (goalId: string) => void;
  onCandidateReplaceSupport: (addedGoalId: string, removedGoalId: string) => void;
  onCandidateSave: (goalId: string) => void;
  onCandidateRestore: (goalId: string) => void;
  onDependencyFocus: (dependencyId: string) => void;
  onTracePreview?: (id?: string) => void;
  onTracePin?: (id: string) => void;
  onTraceClear?: () => void;
  onOpenDomControls: () => void;
}

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

export interface RepositoryFutureStageOverlay {
  active: true;
  mode: RepositoryFuturePathwaysMode;
  phase: 'possibility' | 'choice' | 'synthesis';
  graphFingerprint: string;
  draftFingerprint?: string;
  universeProjection?: RepositoryFutureUniverseProjection;
  candidates: RepositoryFutureStageCandidate[];
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
  onModeChange: (mode: RepositoryFuturePathwaysMode) => void;
  onCandidateFocus: (goalId: string) => void;
  onCandidateSelect: (goalId: string) => void;
  onCandidateAddSupport: (goalId: string) => void;
  onCandidateRemoveSupport: (goalId: string) => void;
  onCandidateReplaceSupport: (addedGoalId: string, removedGoalId: string) => void;
  onDependencyFocus: (dependencyId: string) => void;
  onTracePreview?: (id?: string) => void;
  onTracePin?: (id: string) => void;
  onTraceClear?: () => void;
  onOpenDomControls: () => void;
}

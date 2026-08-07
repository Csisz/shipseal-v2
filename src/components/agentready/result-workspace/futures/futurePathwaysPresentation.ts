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
  candidates: RepositoryFutureStageCandidate[];
  dependencies: RepositoryFutureStageDependency[];
  artifactCount: number;
  gateCount: number;
  conflictCount: number;
  limited: boolean;
  focusedId?: string;
  activeTraceId?: string;
  tracePinned?: boolean;
  onModeChange: (mode: RepositoryFuturePathwaysMode) => void;
  onCandidateFocus: (goalId: string) => void;
  onCandidateSelect: (goalId: string) => void;
  onDependencyFocus: (dependencyId: string) => void;
  onTracePreview?: (id?: string) => void;
  onTracePin?: (id: string) => void;
  onTraceClear?: () => void;
  onOpenDomControls: () => void;
}

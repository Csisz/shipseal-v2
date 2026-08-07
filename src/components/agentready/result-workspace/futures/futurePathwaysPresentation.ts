export type RepositoryFuturePathwaysMode = 'quick' | 'deep';

export interface RepositoryFutureStageCandidate {
  goalId: string;
  title: string;
  fit: string;
  role: 'candidate' | 'primary' | 'supporting' | 'saved' | 'blocked';
  origin: string;
  evidenceCount: number;
  mappedEvidenceCount: number;
}

export interface RepositoryFutureStageDependency {
  id: string;
  title: string;
  state: string;
  dependentCount: number;
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
  onModeChange: (mode: RepositoryFuturePathwaysMode) => void;
  onCandidateFocus: (goalId: string) => void;
  onCandidateSelect: (goalId: string) => void;
  onDependencyFocus: (dependencyId: string) => void;
  onOpenDomControls: () => void;
}

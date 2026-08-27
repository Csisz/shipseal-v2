import type { RepoScanStatus } from '@/hooks/useRepoScan';
import type { RepositoryIntelligenceProviderStatus } from '@/lib/repositoryIntelligence';

export type RepositoryFormationPhase =
  | 'reading'
  | 'understanding'
  | 'directions'
  | 'pathways'
  | 'workspace'
  | 'ready';

export type RepositoryFuturePreparationState = 'idle' | 'building' | 'preparing-workspace' | 'ready' | 'failed';

export const REPOSITORY_FORMATION_PHASES: ReadonlyArray<{
  id: Exclude<RepositoryFormationPhase, 'ready'>;
  label: string;
}> = [
  { id: 'reading', label: 'Reading repository' },
  { id: 'understanding', label: 'Understanding the project' },
  { id: 'directions', label: 'Finding product directions' },
  { id: 'pathways', label: 'Building future pathways' },
  { id: 'workspace', label: 'Preparing your workspace' },
];

interface ResolveRepositoryFormationPhaseInput {
  scanStatus: RepoScanStatus;
  currentScanStep?: string | null;
  repositoryIntelligenceReady: boolean;
  productStatus: RepositoryIntelligenceProviderStatus;
  productIntelligenceReady: boolean;
  futurePreparationState: RepositoryFuturePreparationState;
}

/** Maps the displayed formation phase only from observable pipeline state. */
export function resolveRepositoryFormationPhase({
  scanStatus,
  currentScanStep,
  repositoryIntelligenceReady,
  productStatus,
  productIntelligenceReady,
  futurePreparationState,
}: ResolveRepositoryFormationPhaseInput): RepositoryFormationPhase {
  if (scanStatus === 'scanning') {
    return /building.*intelligence|preparing workspace/i.test(currentScanStep || '')
      ? 'understanding'
      : 'reading';
  }
  if (!repositoryIntelligenceReady) return 'understanding';
  if (productStatus.state === 'deterministic') return 'ready';
  if (!productIntelligenceReady) {
    return productStatus.state === 'preparing' && (productStatus.productStage === 'expansion' || productStatus.productStage === 'merging' || productStatus.productStage === 'finalizing')
      ? 'pathways'
      : 'directions';
  }
  if (futurePreparationState === 'idle' || futurePreparationState === 'building') return 'pathways';
  if (futurePreparationState === 'preparing-workspace') return 'workspace';
  if (futurePreparationState === 'ready') return 'ready';
  return 'pathways';
}

export function repositoryFormationPhaseLabel(phase: RepositoryFormationPhase) {
  return phase === 'ready'
    ? 'Ready'
    : REPOSITORY_FORMATION_PHASES.find(item => item.id === phase)?.label || 'Preparing your workspace';
}

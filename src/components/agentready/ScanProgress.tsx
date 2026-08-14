import { RepositoryFormation, type RepositoryFormationStage } from './RepositoryFormation';

interface Props {
  steps: readonly string[];
  currentStepIndex: number;
  progress: number;
  warnings?: string[];
  repositoryLabel?: string | null;
  sourceLabel?: string | null;
  discoveredFileCount?: number | null;
  analyzedFileCount?: number | null;
  onCancel?: () => void;
}

export function ScanProgress({
  steps,
  currentStepIndex,
  progress,
  warnings = [],
  repositoryLabel,
  sourceLabel,
  discoveredFileCount,
  analyzedFileCount,
  onCancel,
}: Props) {
  const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const current = steps[currentStepIndex] || steps.at(-1) || 'Reading repository evidence';
  const stage: RepositoryFormationStage = safeProgress < 38 ? 'reading' : safeProgress < 78 ? 'connecting' : 'projecting';
  const countLine = discoveredFileCount == null
    ? current
    : `${analyzedFileCount == null ? 'Reading' : analyzedFileCount.toLocaleString()} of ${discoveredFileCount.toLocaleString()} files understood`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <RepositoryFormation
        repositoryName={repositoryLabel || 'Repository'}
        sourceLabel={sourceLabel}
        stage={stage}
        title="Forming repository intelligence"
        action={countLine}
        progress={safeProgress}
        onCancel={onCancel}
      />
      {warnings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-warning">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Check, Circle, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  REPOSITORY_FORMATION_PHASES,
  type RepositoryFormationPhase,
} from '@/lib/workspace/repositoryFormationPipeline';
import { cn } from '@/lib/utils';

export type RepositoryFormationStage = RepositoryFormationPhase;

interface RepositoryFormationProps {
  repositoryName: string;
  stage: RepositoryFormationStage;
  title: string;
  action: string;
  progress?: number;
  fullScreen?: boolean;
  sourceLabel?: string | null;
  onCancel?: () => void;
  failure?: {
    message: string;
    onRetry?: () => void;
    onReturn?: () => void;
  };
}

export function RepositoryFormation({
  repositoryName,
  stage,
  title,
  action,
  progress,
  fullScreen = false,
  sourceLabel,
  onCancel,
  failure,
}: RepositoryFormationProps) {
  const [showLongRunningMessage, setShowLongRunningMessage] = useState(false);
  const safeProgress = progress == null ? undefined : Math.min(100, Math.max(0, Math.round(progress)));
  const activeIndex = stage === 'ready'
    ? REPOSITORY_FORMATION_PHASES.length
    : REPOSITORY_FORMATION_PHASES.findIndex(phase => phase.id === stage);
  const ready = stage === 'ready';
  const activeTrace = formationActiveTrace(stage);

  useEffect(() => {
    setShowLongRunningMessage(false);
    if (!['directions', 'pathways'].includes(stage) || failure) return undefined;
    const timer = window.setTimeout(() => setShowLongRunningMessage(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [failure, stage]);

  return (
    <section
      role={failure ? 'alert' : 'status'}
      aria-live="polite"
      aria-busy={!ready && !failure}
      aria-labelledby="repository-formation-title"
      data-testid="repository-formation"
      data-formation-stage={stage}
      data-formation-state={failure ? 'failed' : ready ? 'ready' : 'active'}
      className={cn(
        'repository-formation relative isolate flex w-full items-center justify-center overflow-hidden bg-workspace px-4 py-10 text-foreground',
        fullScreen ? 'min-h-screen' : 'min-h-[calc(100svh-5rem)] rounded-[1.75rem] border border-border/55',
      )}
    >
      <div aria-hidden="true" className="repository-formation-atmosphere absolute inset-0" />
      {onCancel && !failure && (
        <button type="button" onClick={onCancel} className="absolute right-5 top-5 z-20 min-h-10 rounded-full border border-border/50 bg-background/45 px-4 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
          Cancel
        </button>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <div className="max-w-full truncate font-mono text-[10px] uppercase tracking-[0.22em] text-primary-glow">
          ShipSeal intelligence {sourceLabel ? `· ${sourceLabel}` : ''}
        </div>
        <h1 id="repository-formation-title" className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          {failure ? 'Future analysis needs attention' : title}
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          {failure?.message || action}
        </p>

        <div className="repository-formation-bloom relative mt-6 size-44 sm:mt-7 sm:size-48" aria-hidden="true">
          <svg viewBox="0 0 280 280" className="absolute inset-0 h-full w-full overflow-visible" fill="none">
            <circle cx="140" cy="140" r="112" className="repository-formation-ring repository-formation-ring-outer" strokeWidth="0.7" strokeDasharray="2 12" />
            <circle cx="140" cy="140" r="76" className="repository-formation-ring repository-formation-ring-inner" strokeWidth="0.7" />
            <path pathLength="1" className="repository-formation-arc repository-formation-arc-a" d="M36 148 C74 90 104 92 140 140 C178 190 211 184 246 126" />
            <path pathLength="1" className="repository-formation-arc repository-formation-arc-b" d="M42 178 C82 152 104 158 140 140 C177 121 204 83 240 92" />
            <path pathLength="1" className="repository-formation-arc repository-formation-arc-c" d="M55 105 C91 111 111 124 140 140 C171 157 198 158 226 188" />
            {!ready && !failure && activeTrace && (
              <path pathLength="1" className="repository-formation-active-trace" d={activeTrace} />
            )}
          </svg>
          {!ready && !failure && (
            <span className="repository-formation-orbit absolute inset-[7%] rounded-full border border-primary/15">
              <span className="absolute left-1/2 top-[-3px] size-1.5 -translate-x-1/2 rounded-full bg-primary-glow shadow-[0_0_12px_hsl(var(--primary)/0.65)]" />
            </span>
          )}
          <div className={cn(
            'repository-formation-core absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-background/80 backdrop-blur-xl sm:h-24 sm:w-24',
            failure ? 'border-destructive/55' : ready ? 'border-success/55' : 'border-primary/55',
          )}>
            <div>
              {ready ? <Check className="mx-auto size-5 text-success" /> : <Network className="mx-auto size-5 text-primary-glow" />}
              <div className="mt-2 max-w-[4.5rem] truncate font-display text-[10px] font-semibold sm:max-w-[5.5rem] sm:text-[11px]">{repositoryName}</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
                {safeProgress == null ? ready ? 'Ready' : 'Active' : `${safeProgress}%`}
              </div>
            </div>
          </div>
        </div>

        <ol className="mt-5 flex w-full max-w-xs flex-col gap-1.5 text-left" aria-label="Repository formation progress">
          {REPOSITORY_FORMATION_PHASES.map((phase, index) => {
            const complete = ready || index < activeIndex;
            const active = !ready && index === activeIndex;
            return (
              <li key={phase.id} className={cn('flex min-h-6 items-center gap-3 text-sm', complete ? 'text-foreground/65' : active ? 'font-medium text-foreground' : 'text-muted-foreground/40')} aria-current={active ? 'step' : undefined}>
                {complete ? (
                  <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                ) : active ? (
                  <span className="repository-formation-active-dot size-3.5 shrink-0 rounded-full border border-primary/70 bg-primary/20" aria-hidden="true" />
                ) : (
                  <Circle className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{phase.label}</span>
              </li>
            );
          })}
        </ol>

        {showLongRunningMessage && !failure && (
          <p className="mt-4 text-xs text-muted-foreground" data-testid="formation-long-running">{stage === 'pathways' ? 'Still expanding future pathways… Completed groups remain safely retained.' : 'Still analysing… ShipSeal is waiting for the current provider response.'}</p>
        )}
        {failure && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {failure.onRetry && <Button type="button" onClick={failure.onRetry}>{failure.message.includes('pathways') ? 'Retry incomplete pathways' : 'Retry Future analysis'}</Button>}
            {failure.onReturn && <Button type="button" variant="outline" onClick={failure.onReturn}>Choose another source</Button>}
          </div>
        )}
        {safeProgress != null && (
          <div className="mt-5 h-px w-full max-w-sm overflow-hidden bg-border/55" role="progressbar" aria-label="Repository scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
            <div className="h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${safeProgress}%` }} />
          </div>
        )}
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Static analysis · repository code is never executed</p>
      </div>
    </section>
  );
}

function formationActiveTrace(stage: RepositoryFormationStage) {
  switch (stage) {
    case 'reading':
      return 'M140 28 A112 112 0 0 1 252 140';
    case 'understanding':
      return 'M36 148 C74 90 104 92 140 140 C178 190 211 184 246 126';
    case 'directions':
      return 'M42 178 C82 152 104 158 140 140 C177 121 204 83 240 92';
    case 'pathways':
      return 'M55 105 C91 111 111 124 140 140 C171 157 198 158 226 188';
    case 'workspace':
      return 'M28 140 A112 112 0 0 0 252 140';
    case 'ready':
      return undefined;
  }
}

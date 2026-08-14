import { Check, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RepositoryFormationStage = 'reading' | 'connecting' | 'projecting' | 'ready';

interface RepositoryFormationProps {
  repositoryName: string;
  stage: RepositoryFormationStage;
  title: string;
  action: string;
  progress?: number;
  fullScreen?: boolean;
  sourceLabel?: string | null;
  onCancel?: () => void;
}

const phases: Array<{ id: Exclude<RepositoryFormationStage, 'ready'>; label: string }> = [
  { id: 'reading', label: 'Read' },
  { id: 'connecting', label: 'Connect' },
  { id: 'projecting', label: 'Project' },
];

export function RepositoryFormation({
  repositoryName,
  stage,
  title,
  action,
  progress,
  fullScreen = false,
  sourceLabel,
  onCancel,
}: RepositoryFormationProps) {
  const safeProgress = progress == null ? undefined : Math.min(100, Math.max(0, Math.round(progress)));
  const activeIndex = stage === 'ready' ? phases.length : phases.findIndex(phase => phase.id === stage);
  const ready = stage === 'ready';

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy={!ready}
      aria-labelledby="repository-formation-title"
      data-testid="repository-formation"
      data-formation-stage={stage}
      className={cn(
        'repository-formation relative isolate flex w-full items-center justify-center overflow-hidden bg-workspace px-4 py-10 text-foreground',
        fullScreen ? 'min-h-screen' : 'min-h-[calc(100svh-5rem)] rounded-[1.75rem] border border-border/55',
      )}
    >
      <div aria-hidden="true" className="repository-formation-atmosphere absolute inset-0" />
      {onCancel && (
        <button type="button" onClick={onCancel} className="absolute right-5 top-5 z-20 min-h-10 rounded-full border border-border/50 bg-background/45 px-4 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
          Cancel
        </button>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary-glow">
          ShipSeal intelligence {sourceLabel ? `· ${sourceLabel}` : ''}
        </div>
        <h1 id="repository-formation-title" className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl md:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">{action}</p>

        <div className="repository-formation-bloom relative mt-8 h-64 w-64 sm:mt-10 sm:h-72 sm:w-72" aria-hidden="true">
          <svg viewBox="0 0 280 280" className="absolute inset-0 h-full w-full overflow-visible" fill="none">
            <circle cx="140" cy="140" r="112" className="stroke-border/35" strokeWidth="0.8" strokeDasharray="2 10" />
            <path pathLength="1" className="repository-formation-arc repository-formation-arc-a" d="M36 148 C74 90 104 92 140 140 C178 190 211 184 246 126" />
            <path pathLength="1" className="repository-formation-arc repository-formation-arc-b" d="M42 178 C82 152 104 158 140 140 C177 121 204 83 240 92" />
            <path pathLength="1" className="repository-formation-arc repository-formation-arc-c" d="M55 105 C91 111 111 124 140 140 C171 157 198 158 226 188" />
          </svg>
          <div className={cn('repository-formation-core absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-background/80 backdrop-blur-xl sm:h-32 sm:w-32', ready ? 'border-success/55' : 'border-primary/55')}>
            <div>
              {ready ? <Check className="mx-auto h-5 w-5 text-success" /> : <Network className="mx-auto h-5 w-5 text-primary-glow" />}
              <div className="mt-2 max-w-[7.25rem] truncate font-display text-[11px] font-semibold sm:max-w-[7.5rem] sm:text-xs">{repositoryName}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground">{ready ? 'Ready' : safeProgress == null ? 'Forming' : `${safeProgress}%`}</div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center gap-2" aria-label={`Formation phase: ${ready ? 'ready' : phases[Math.max(0, activeIndex)]?.label}`}>
          {phases.map((phase, index) => {
            const complete = ready || index < activeIndex;
            const active = !ready && index === activeIndex;
            return (
              <div key={phase.id} className="flex items-center gap-2">
                {index > 0 && <span className={cn('h-px w-7 sm:w-10', complete || active ? 'bg-primary/45' : 'bg-border/45')} />}
                <span className={cn('font-mono text-[9px] uppercase tracking-[0.16em]', complete ? 'text-foreground/70' : active ? 'text-primary-glow' : 'text-muted-foreground/45')}>{phase.label}</span>
              </div>
            );
          })}
        </div>

        {safeProgress != null && (
          <div className="mt-5 h-px w-full max-w-md overflow-hidden bg-border/55" role="progressbar" aria-label="Repository intelligence progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
            <div className="h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${safeProgress}%` }} />
          </div>
        )}
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70">Static analysis · repository code is never executed</p>
      </div>
    </section>
  );
}

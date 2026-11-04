import { Check, CircleDashed, GitBranch, RotateCcw, Sparkles } from 'lucide-react';
import type { RepositoryIntelligenceProviderStatus } from '@/lib/repositoryIntelligence';

const stages = [
  'Understanding project capabilities',
  'Discovering future directions',
  'Validating opportunities against repository evidence',
  'Expanding implementation paths',
  'Building the interactive Futures map',
  'Ready to explore',
] as const;

interface Props {
  status?: RepositoryIntelligenceProviderStatus;
  hasInitialDirections: boolean;
  repositoryName: string;
  fullScreen?: boolean;
  onResume?: () => void;
}

export function RepositoryFuturesAnalysisStatus({ status, hasInitialDirections, repositoryName, fullScreen = false, onResume }: Props) {
  const ready = status?.state === 'enhanced';
  const recoverable = status?.state === 'fallback' || status?.state === 'cancelled';
  const completedBatches = status?.state === 'preparing' ? status.completedBatches || 0 : 0;
  const totalBatches = status?.state === 'preparing' ? status.totalBatches || 0 : 0;
  const mapBuilding = status?.state === 'preparing'
    && (status.productStage === 'merging' || status.productStage === 'finalizing'
      || Boolean(totalBatches && completedBatches >= totalBatches));
  const activeIndex = ready ? 5 : mapBuilding ? 4 : hasInitialDirections ? 3 : 1;
  const completedThrough = ready ? 5 : hasInitialDirections ? 2 : 0;
  const lastConfirmed = status?.state === 'preparing' && status.lastServerConfirmedAt
    ? new Date(status.lastServerConfirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid={fullScreen ? 'repository-formation' : 'repository-futures-analysis-status'}
      data-formation-stage={fullScreen ? 'directions' : undefined}
      data-analysis-state={ready ? 'ready' : recoverable ? 'recoverable' : hasInitialDirections ? 'initial-ready' : 'running'}
      aria-busy={!ready && !recoverable}
      className={fullScreen
        ? 'relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden bg-workspace px-4 py-16'
        : 'mx-4 mb-3 rounded-2xl border border-primary/20 bg-[hsl(var(--surface-floating)/0.74)] p-4 shadow-[0_14px_44px_hsl(var(--background)/0.18)] backdrop-blur-xl sm:mx-6 lg:mx-8'}
    >
      {fullScreen && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,hsl(var(--primary)/0.13),transparent_34%),radial-gradient(circle_at_78%_62%,hsl(var(--accent)/0.07),transparent_32%)]" />}
      <div className={`relative w-full ${fullScreen ? 'max-w-3xl rounded-3xl border border-primary/20 bg-[hsl(var(--surface-floating)/0.76)] p-5 shadow-[0_24px_80px_hsl(var(--background)/0.28)] backdrop-blur-xl sm:p-8' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary-glow"><GitBranch className="h-3.5 w-3.5" aria-hidden="true" /> Repository Futures</div>
            <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {ready ? 'Ready to explore' : hasInitialDirections ? 'Initial Futures are ready' : 'Reading the opportunity network'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground"><span>{repositoryName} · </span><span>{status?.message || 'Restoring server-confirmed analysis progress.'}</span></p>
          </div>
          {hasInitialDirections && !ready && <span className="rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1.5 text-[10px] font-medium text-primary">Validated directions available</span>}
        </div>

        <ol className={`mt-5 grid gap-2 ${fullScreen ? 'sm:grid-cols-2' : 'md:grid-cols-3 xl:grid-cols-6'}`}>
          {stages.map((label, index) => {
            const complete = index <= completedThrough;
            const active = !recoverable && !complete && index === activeIndex;
            return (
              <li key={label} data-stage-state={complete ? 'complete' : active ? 'active' : recoverable && index === activeIndex ? 'recoverable' : 'pending'} className={`flex min-h-14 items-start gap-2 rounded-xl border px-3 py-2.5 ${complete ? 'border-primary/20 bg-primary/[0.055]' : active ? 'border-primary/35 bg-primary/[0.08]' : 'border-border/35 bg-background/20'}`}>
                {complete ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : active ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-primary motion-reduce:animate-none" aria-hidden="true" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/55" aria-hidden="true" />}
                <span className="text-xs leading-snug text-foreground/85">{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {totalBatches > 0 ? <span>{completedBatches} of {totalBatches} expansion batches confirmed</span> : !ready && !recoverable ? <span>Waiting for the next durable stage update</span> : null}
            {lastConfirmed && <span>Last server confirmation {lastConfirmed}</span>}
          </div>
          {recoverable && status.retryable && onResume && (
            <button type="button" onClick={onResume} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-4 font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Resume saved stages
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, GitFork, Orbit, Sparkles } from 'lucide-react';
import type { ReadinessReport } from '@/lib/types';
import {
  resolveRepositoryFutureAvailability,
  type RepositoryFutureAvailability,
  type RepositoryIntelligenceProviderStatus,
} from '@/lib/repositoryIntelligence';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useUpgradeToProAction } from '@/components/billing/useUpgradeToProAction';

export type PostScanEntryView = 'universe' | 'futures';

export function PostScanViewSelector({
  report,
  opportunityCount = 0,
  futuresAvailable = true,
  futuresStatus,
  futureAvailability: suppliedFutureAvailability,
  onRetryFutures,
  persistenceControl,
  onSelect,
}: {
  report: ReadinessReport;
  opportunityCount?: number;
  futuresAvailable?: boolean;
  futuresStatus?: RepositoryIntelligenceProviderStatus;
  futureAvailability?: RepositoryFutureAvailability;
  onRetryFutures?: () => void;
  persistenceControl?: ReactNode;
  onSelect: (view: PostScanEntryView) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const upgrade = useUpgradeToProAction();
  const fileCount = report.fileCount || report.scanSummary.filesAnalyzed || report.scanSummary.totalFilesFound;
  const futuresRetrying = futuresStatus?.state === 'preparing';
  const supportReference = futuresStatus && 'diagnostics' in futuresStatus ? futuresStatus.diagnostics?.requestId : undefined;
  const rateLimitRetryAt = futuresStatus?.state === 'preparing'
    ? futuresStatus.rateLimitRetryAt
    : futuresStatus && 'diagnostics' in futuresStatus ? futuresStatus.diagnostics?.rateLimitRetryAt : undefined;
  const cooldownSeconds = useCooldownSeconds(rateLimitRetryAt);
  const rateLimitWaiting = Boolean(rateLimitRetryAt && cooldownSeconds > 0);
  const upgradeRequired = futuresStatus?.state === 'fallback' && futuresStatus.category === 'upgrade_required';
  const futureAvailability = suppliedFutureAvailability ?? resolveRepositoryFutureAvailability(futuresStatus);
  const analysisStartable = futureAvailability === 'startable';
  const recoveryAction = futuresStatus && 'diagnostics' in futuresStatus
    ? futuresStatus.diagnostics?.operationRecoveryAction
    : undefined;
  const operationActive = futureAvailability === 'running';
  const operationResumable = futureAvailability === 'resumable';
  const temporarilyUnavailable = futureAvailability === 'temporarily-unavailable';
  const priorAnalysisReturned = recoveryAction === 'start_new_analysis'
    || (futuresStatus && 'diagnostics' in futuresStatus && futuresStatus.diagnostics?.operationCompletionState === 'refunded');
  const retryLabel = analysisStartable
    ? 'Generate Future analysis'
    : recoveryAction === 'open_result'
    ? 'Open Repository Futures'
    : recoveryAction === 'resume_stale_lease'
      || recoveryAction === 'retry_stage'
      || recoveryAction === 'integrity_recovery'
      ? 'Resume Future analysis'
      : 'Retry Future analysis';
  const futureCardAction = futuresAvailable
    ? 'Open Repository Futures'
    : upgradeRequired
      ? upgrade.label
      : analysisStartable
        ? 'Generate Future analysis'
        : operationResumable
          ? 'Resume Future analysis'
          : operationActive
            ? 'Future analysis in progress'
            : temporarilyUnavailable && rateLimitWaiting
              ? `Retry available in ${cooldownSeconds}s`
              : temporarilyUnavailable && onRetryFutures
                ? retryLabel
                : 'Repository Futures unavailable';
  const futureCardDisabled = operationActive
    || temporarilyUnavailable && rateLimitWaiting
    || !futuresAvailable && !upgradeRequired && !analysisStartable && !operationResumable && !(temporarilyUnavailable && onRetryFutures)
    || upgrade.state === 'loading';
  const activateFutureCard = () => {
    if (futuresAvailable) { onSelect('futures'); return; }
    if (upgradeRequired) { void upgrade.start(); return; }
    if ((analysisStartable || operationResumable || temporarilyUnavailable) && onRetryFutures) onRetryFutures();
  };
  const showAttentionStatus = !futuresAvailable && !analysisStartable;

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  }, []);

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      aria-labelledby="post-scan-view-selector-heading"
      data-testid="post-scan-view-selector"
      className="relative min-h-[calc(100svh-4rem)] w-full overflow-hidden bg-workspace text-foreground outline-none motion-safe:animate-fade-in motion-reduce:animate-none"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_84%_78%,hsl(var(--accent)/0.1),transparent_36%),linear-gradient(180deg,hsl(var(--background)/0.12),transparent_42%,hsl(var(--background)/0.22))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-border/70 to-transparent lg:block" />

      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1600px] flex-col px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <header className="mx-auto mb-5 max-w-2xl text-center motion-safe:animate-fade-in-up motion-reduce:animate-none md:mb-7">
          <div data-shared-repository-anchor className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-glow">
            Repository understood · {report.repoName}
          </div>
          <h1 id="post-scan-view-selector-heading" className="mt-2 font-display text-2xl font-semibold tracking-[-0.025em] sm:text-3xl md:text-4xl">
            Choose your first perspective
          </h1>
          {persistenceControl && <div className="mx-auto mt-3 max-w-md [&>div]:rounded-xl [&>div]:border-primary/10 [&>div]:bg-transparent [&>div]:p-0">{persistenceControl}</div>}
        </header>

        {showAttentionStatus && (
          <aside className={cn(
            'mx-auto mb-5 flex w-full max-w-3xl flex-col items-start gap-3 rounded-2xl px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between',
            upgradeRequired ? 'border border-primary/25 bg-primary/[0.06]' : 'border border-amber-500/25 bg-amber-500/[0.06]',
          )} role="status" data-testid="futures-degraded-status" data-future-availability={futureAvailability}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-foreground">{upgradeRequired ? 'Repository Futures' : 'Project Universe is ready'}</div>
                {upgradeRequired && <Badge variant="secondary">Pro AI analysis</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {upgradeRequired
                  ? 'Discover validated product directions, implementation pathways and executable plans. Project Universe and deterministic intelligence remain available on Free.'
                  : futuresRetrying
                  ? `${futuresStatus?.message || 'Future analysis is retrying in the background.'}${rateLimitWaiting ? ` Retrying in ${cooldownSeconds} seconds.` : ''} You can explore the repository now.`
                  : futuresStatus?.message || 'Future pathways can be retried without scanning the repository again.'}
                {!futuresRetrying && rateLimitWaiting ? ` Retry available in ${cooldownSeconds} seconds.` : ''}
              </p>
              {supportReference && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Support details</summary>
                  <div className="mt-1 font-mono">Reference: {supportReference}</div>
                </details>
              )}
              {upgrade.state === 'error' && <p role="alert" className="mt-2 text-xs text-destructive">{upgrade.message}</p>}
            </div>
          </aside>
        )}

        <div className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-2 lg:gap-0">
          <ViewChoice
            view="universe"
            index="01"
            overline="Current state"
            title="Project Universe"
            description="Explore the repository as a living map of structure, relationships and evidence."
            action="Open Project Universe"
            metadata={[`${fileCount.toLocaleString()} repository entities`, 'Evidence-grounded map']}
            motif={<UniverseMotif />}
            onActivate={() => onSelect('universe')}
          />
          <ViewChoice
            view="futures"
            index="02"
            overline="Projected state"
            title="Repository Futures"
            description={futuresAvailable ? 'Explore product directions, future pathways and what this project could become.' : analysisStartable ? priorAnalysisReturned ? 'A previous incomplete analysis was returned to your allowance. Generate a fresh evidence-backed Future Path when you are ready.' : 'Generate validated product directions, implementation pathways and an executable Future Path when you are ready.' : upgradeRequired ? 'Discover validated product directions, implementation pathways and executable plans with Pro.' : operationResumable ? 'Continue the existing evidence-backed analysis from its last durable stage.' : 'Validated Product Futures are unavailable until Future analysis completes successfully.'}
            action={futureCardAction}
            metadata={futuresAvailable
              ? [opportunityCount ? `${opportunityCount.toLocaleString()} product directions` : 'Evidence-led directions', 'Neural future pathways']
              : analysisStartable ? ['Explicit start', 'Completion-billed'] : upgradeRequired ? ['Pro feature', 'Evidence-backed AI'] : ['No incomplete Futures shown', futuresRetrying ? rateLimitWaiting ? 'Capacity cooldown' : 'Analysis running' : rateLimitWaiting ? 'Retry cooling down' : operationResumable ? 'Resume saved stages' : 'Unavailable']}
            badge={!futuresAvailable && (analysisStartable || upgradeRequired || operationResumable) ? 'Pro AI analysis' : undefined}
            footnote={analysisStartable ? 'Uses 1 Deep Analysis · charged only on completion' : operationResumable ? 'Resumes the existing analysis · no second reservation' : undefined}
            motif={<FuturesMotif />}
            onActivate={activateFutureCard}
            disabled={futureCardDisabled}
          />
        </div>
        {(analysisStartable || operationResumable) && (
          <p className="mx-auto mt-3 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
            Deep Analysis sends selected, bounded repository evidence to the configured AI provider after server-side preparation and best-effort redaction. A unit is charged only after successful durable completion. <a href="/privacy#deterministic-ai" className="text-primary hover:underline">How AI processing works</a>
          </p>
        )}
      </div>
    </section>
  );
}

function useCooldownSeconds(retryAt?: number) {
  const [seconds, setSeconds] = useState(() => cooldownSecondsUntil(retryAt));
  useEffect(() => {
    setSeconds(cooldownSecondsUntil(retryAt));
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = window.setInterval(() => setSeconds(cooldownSecondsUntil(retryAt)), 250);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  return seconds;
}

function cooldownSecondsUntil(retryAt?: number) {
  return retryAt ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000)) : 0;
}

function ViewChoice({
  view,
  index,
  overline,
  title,
  description,
  action,
  metadata,
  badge,
  footnote,
  motif,
  onActivate,
  disabled = false,
}: {
  view: PostScanEntryView;
  index: string;
  overline: string;
  title: string;
  description: string;
  action: string;
  metadata: readonly string[];
  badge?: string;
  footnote?: string;
  motif: ReactNode;
  onActivate: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={action}
      disabled={disabled}
      onClick={onActivate}
      data-view-choice={view}
      data-view-action={action}
      className={cn(
        'group relative flex min-h-[24rem] flex-col overflow-hidden rounded-[1.75rem] border border-primary/15 bg-[linear-gradient(145deg,hsl(var(--universe-surface)/0.72),hsl(var(--universe-stage-bg)/0.36))] p-6 text-left shadow-[0_24px_80px_hsl(var(--universe-stage-bg)/0.28)] transition-[border-color,background-color,box-shadow,transform] duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none sm:p-8 lg:min-h-0 lg:rounded-none lg:border-y lg:first:rounded-l-[2rem] lg:last:rounded-r-[2rem] lg:last:border-l-0',
        disabled ? 'cursor-not-allowed opacity-70' : 'hover:z-10 hover:border-primary/40 hover:shadow-[0_30px_100px_hsl(var(--primary)/0.12)] lg:hover:-translate-y-1',
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,hsl(var(--primary)/0.09),transparent_36%)] opacity-60 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
      <div className="relative flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{index} · {overline}</span>
        {view === 'universe' ? <Orbit className="h-4 w-4 text-primary-glow" /> : <Sparkles className="h-4 w-4 text-accent" />}
      </div>

      <div className="relative my-auto flex min-h-48 items-center justify-center py-5" aria-hidden="true">
        {motif}
      </div>

      <div className="relative max-w-xl">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h2>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-foreground transition-colors group-hover:border-primary/55 group-hover:bg-primary/15 group-focus-visible:border-primary/55 motion-reduce:transition-none">
          {action}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </span>
        {footnote && <span className="mt-3 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{footnote}</span>}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/45 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{metadata[0]}</span>
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-primary-glow/70" />
        <span>{metadata[1]}</span>
      </div>
    </button>
  );
}

function UniverseMotif() {
  return (
    <div className="relative h-44 w-44 motion-safe:animate-scale-in motion-reduce:animate-none sm:h-52 sm:w-52">
      <div className="absolute inset-[18%] rounded-full border border-primary/25 shadow-[0_0_50px_hsl(var(--primary)/0.12)]" />
      <div className="absolute inset-[34%] rounded-full border border-accent/30 bg-primary/10" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-glow shadow-[0_0_24px_hsl(var(--primary)/0.55)]" />
      {[
        'left-[7%] top-[43%]',
        'right-[10%] top-[28%]',
        'bottom-[12%] left-[55%]',
        'left-[28%] top-[14%]',
      ].map(position => <span key={position} className={`absolute h-2.5 w-2.5 rounded-full border border-accent/60 bg-background shadow-[0_0_16px_hsl(var(--accent)/0.25)] ${position}`} />)}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-primary-glow/35" fill="none">
        <ellipse cx="50" cy="50" rx="45" ry="27" stroke="currentColor" strokeWidth="0.7" />
        <ellipse cx="50" cy="50" rx="26" ry="45" stroke="currentColor" strokeWidth="0.7" transform="rotate(28 50 50)" />
        <path d="M14 47 50 50 82 31M50 50 58 86M50 50 31 18" stroke="currentColor" strokeWidth="0.55" strokeDasharray="2 2" />
      </svg>
    </div>
  );
}

function FuturesMotif() {
  const nodes = [
    { x: 12, y: 51, size: 7 }, { x: 31, y: 28, size: 10 }, { x: 35, y: 72, size: 6 },
    { x: 58, y: 47, size: 13 }, { x: 78, y: 24, size: 7 }, { x: 86, y: 70, size: 9 },
  ];
  return (
    <div className="relative h-44 w-full max-w-sm motion-safe:animate-scale-in motion-reduce:animate-none sm:h-52">
      <GitFork className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-primary-glow/50" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-primary-glow/35" fill="none">
        <path d="M12 51 C22 51 22 28 31 28 S46 47 58 47 S68 24 78 24" stroke="currentColor" strokeWidth="0.65" />
        <path d="M12 51 C22 51 23 72 35 72 S47 47 58 47 S73 70 86 70" stroke="currentColor" strokeWidth="0.65" />
        <path d="M31 28 C42 28 44 47 58 47" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
      </svg>
      {nodes.map(node => (
        <span
          key={`${node.x}-${node.y}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/55 bg-[hsl(var(--universe-surface-raised))] shadow-[0_0_22px_hsl(var(--primary)/0.22)]"
          style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size, height: node.size }}
        />
      ))}
    </div>
  );
}

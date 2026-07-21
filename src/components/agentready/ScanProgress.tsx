import {
  Archive,
  CheckCircle2,
  Circle,
  Github,
  Layers,
  Network,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const understanding = repositoryUnderstandingLevel(safeProgress, steps, currentStepIndex);
  const skippedFiles = skippedFileCount(discoveredFileCount, analyzedFileCount);
  const livingSignals = buildLivingSignals(safeProgress, steps, currentStepIndex);
  const activeSignal = livingSignals.find(signal => signal.active) || livingSignals.filter(signal => signal.done).at(-1) || livingSignals[0];
  const finalReveal = safeProgress >= 96;

  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-primary/25 bg-[hsl(225_28%_7%)] p-3 shadow-glow animate-scale-in md:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,hsl(var(--primary)/0.22),transparent_38%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.12),transparent_34%)] pointer-events-none" />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Network className="h-3.5 w-3.5 text-primary-glow" />
              <span>Living Repository</span>
              {sourceLabel && <span className="rounded-full border border-primary/30 px-2 py-0.5 text-primary-glow">{sourceLabel}</span>}
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold text-foreground md:text-3xl">
              {finalReveal ? 'Repository understood.' : 'The workspace is forming.'}
            </h2>
            <p className="mt-1.5 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block">
              {finalReveal
                ? 'AI Workspace created. Ready for intelligent development.'
                : 'ShipSeal is turning repository evidence into a usable AI workspace map.'}
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Github className="h-4 w-4 text-primary-glow" />
              <span className="truncate text-foreground/90">{repositoryLabel || 'Preparing repository'}</span>
            </div>
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
            </Button>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.8fr)]">
          <LivingRepositoryCanvas
            progress={safeProgress}
            understanding={understanding}
            activeSignal={activeSignal}
            signals={livingSignals}
          />

          <aside className="rounded-3xl border border-border/60 bg-secondary/15 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Understanding stream</div>
                <h3 className="mt-1 font-display text-lg font-semibold">{finalReveal ? 'AI Workspace created' : activeSignal.label}</h3>
              </div>
              <Sparkles className={cn('h-4 w-4 text-primary-glow', !finalReveal && 'animate-pulse')} />
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Repository understanding</div>
                  <div className="mt-1 text-xl font-semibold text-foreground">{understanding}</div>
                </div>
                <span className="font-mono text-xs text-primary-glow">{safeProgress}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/70">
                <div className="h-full bg-gradient-primary transition-all duration-700 ease-out" style={{ width: `${safeProgress}%` }} />
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border/60 bg-background/25 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <activeSignal.icon className="h-4 w-4 text-primary-glow" />
                <span className="text-sm font-semibold text-foreground">{finalReveal ? 'Repository understood' : activeSignal.label}</span>
                <span className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px]',
                  activeSignal.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/60 text-muted-foreground'
                )}>
                  {finalReveal ? 'Evidence-backed' : activeSignal.source}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {finalReveal ? 'ShipSeal has created the first AI workspace view from static repository evidence.' : activeSignal.detail}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5 xl:grid-cols-4">
              {livingSignals.map(signal => (
                <SignalPill key={signal.label} signal={signal} />
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <ProgressMetric label="Files found" value={discoveredFileCount == null ? 'Reading' : discoveredFileCount.toLocaleString()} />
              <ProgressMetric label="Files analyzed" value={analyzedFileCount == null ? 'Pending' : analyzedFileCount.toLocaleString()} />
              <ProgressMetric label="Context skipped" value={skippedFiles == null ? 'Pending' : skippedFiles.toLocaleString()} />
            </div>
          </aside>
        </div>

        <details className="group mt-3 rounded-xl border border-border/60 bg-secondary/15">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span>Scan boundary</span>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
          </summary>
          <div className="border-t border-border/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            ShipSeal does not execute code. It performs a structural/static scan, reads repository metadata plus key config/docs/test files, and ignores generated/vendor folders such as node_modules, dist, build, .next, and coverage.
          </div>
        </details>

        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-warning">
            {warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 px-2.5 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

interface LivingSignal {
  label: string;
  detail: string;
  source: 'Evidence';
  icon: LucideIcon;
  done: boolean;
  active: boolean;
}

function LivingRepositoryCanvas({
  progress,
  understanding,
  activeSignal,
  signals,
}: {
  progress: number;
  understanding: string;
  activeSignal: LivingSignal;
  signals: LivingSignal[];
}) {
  const complete = progress >= 96;
  const ActiveIcon = complete ? CheckCircle2 : activeSignal.icon;
  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-3xl border border-primary/20 bg-background/15 p-3 md:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.16),transparent_42%)]" />
      <div className="absolute left-1/2 top-[45%] h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
      <div className="absolute left-1/2 top-[45%] h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15" />
      <div className="absolute left-1/2 top-[45%] h-[112px] w-[112px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/25" />

      <div className="relative flex min-h-[240px] items-center justify-center">
        <div className={cn(
          'relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-full border text-center transition-all duration-700',
          complete ? 'border-success/50 bg-success/10 shadow-[0_0_70px_hsl(var(--success)/0.18)]' : 'border-primary/50 bg-primary/10 shadow-glow'
        )}>
          <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse" />
          <ActiveIcon className={cn('h-6 w-6', complete ? 'text-success' : 'text-primary-glow')} />
          <div className="mt-2 px-3 font-display text-sm font-semibold leading-tight">
            {complete ? 'Workspace created' : 'Building workspace'}
          </div>
          <div className="mt-1 px-3 text-xs leading-relaxed text-muted-foreground">{understanding}</div>
        </div>

        {signals.map((signal, index) => (
          <RepositoryNode key={signal.label} signal={signal} index={index} total={signals.length} />
        ))}
      </div>

      <div className="relative rounded-2xl border border-border/60 bg-background/35 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <activeSignal.icon className="h-4 w-4 text-primary-glow" />
          <span className="text-sm font-semibold text-foreground">{complete ? 'Repository understood' : activeSignal.label}</span>
          <span className={cn(
            'rounded-full border px-2 py-0.5 text-[10px]',
            activeSignal.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/60 text-muted-foreground'
          )}>
            {complete ? 'Evidence-backed' : activeSignal.source}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {complete ? 'ShipSeal has created the first AI workspace view from static repository evidence.' : activeSignal.detail}
        </p>
      </div>
    </div>
  );
}

function RepositoryNode({ signal, index, total }: { signal: LivingSignal; index: number; total: number }) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 40;
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  const Icon = signal.icon;

  return (
    <div
      title={`${signal.label} - ${signal.source}`}
      className={cn(
        'absolute z-20 w-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-1.5 transition-all duration-700 sm:w-28 sm:px-2.5 sm:py-2 xl:w-32',
        signal.active && 'scale-105 border-primary/55 bg-primary/15 shadow-glow',
        signal.done && !signal.active && 'border-success/35 bg-success/10',
        !signal.done && !signal.active && 'border-border/45 bg-background/30 opacity-60'
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <span className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border',
          signal.active ? 'border-primary/50 text-primary-glow' : signal.done ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground'
        )}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="hidden min-w-0 text-xs font-semibold leading-tight text-foreground sm:inline">{signal.label}</span>
      </div>
      <div className="mt-2 hidden items-center gap-1.5 sm:flex">
        {signal.done ? <CheckCircle2 className="h-3 w-3 text-success" /> : signal.active ? <Sparkles className="h-3 w-3 animate-pulse text-primary-glow" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground">{signal.source}</span>
      </div>
    </div>
  );
}

function SignalPill({ signal }: { signal: LivingSignal }) {
  const Icon = signal.icon;
  return (
    <div
      title={`${signal.label} - ${signal.source}`}
      aria-label={`${signal.label} - ${signal.source}`}
      className={cn(
        'min-w-0 rounded-xl border px-2 py-1.5 transition-all duration-500',
        signal.active && 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/10',
        signal.done && !signal.active && 'border-success/30 bg-success/5',
        !signal.done && !signal.active && 'border-border/50 bg-background/20 opacity-70'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border',
          signal.active ? 'border-primary/50 text-primary-glow' : signal.done ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground'
        )}>
          {signal.done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
        </span>
        <div className="min-w-0 flex-1 xl:hidden">
          <div className="text-[11px] font-semibold leading-tight text-foreground break-words">{signal.label}</div>
          <div className="text-[10px] text-muted-foreground">{signal.source}</div>
        </div>
      </div>
    </div>
  );
}

function repositoryUnderstandingLevel(progress: number, steps: readonly string[], currentStepIndex: number) {
  if (progress >= 96) return 'Workspace ready';
  return steps[currentStepIndex] || 'Reading repository';
}

function skippedFileCount(discoveredFileCount?: number | null, analyzedFileCount?: number | null) {
  if (discoveredFileCount == null || analyzedFileCount == null) return null;
  return Math.max(0, discoveredFileCount - analyzedFileCount);
}

function buildLivingSignals(progress: number, steps: readonly string[], currentStepIndex: number): LivingSignal[] {
  const details = [
    'Reading and validating the repository archive, then indexing the files allowed by scanner limits.',
    'Building the deterministic report and repository intelligence from the indexed evidence.',
    'Publishing scan counters and preparing bounded workspace and verification inputs.',
  ];
  const icons: LucideIcon[] = [Archive, Network, Layers];
  return steps.map((label, index) => ({
    label,
    detail: details[index] || 'Completing the current repository operation.',
    source: 'Evidence',
    icon: icons[index] || Layers,
    done: progress >= 96 || index < currentStepIndex,
    active: progress < 96 && index === currentStepIndex,
  }));
}

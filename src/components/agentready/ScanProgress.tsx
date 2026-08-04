import { Archive, Check, Github, Layers, Network, ShieldCheck, X, type LucideIcon } from 'lucide-react';
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

interface ScanSignal {
  label: string;
  icon: LucideIcon;
  state: 'complete' | 'active' | 'pending';
}

const SIGNAL_POINTS = [
  { x: 19, y: 24 },
  { x: 81, y: 24 },
  { x: 50, y: 82 },
];

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
  const complete = safeProgress >= 96;
  const signals = buildSignals(safeProgress, steps, currentStepIndex);
  const current = signals.find(signal => signal.state === 'active') || signals.filter(signal => signal.state === 'complete').at(-1) || signals[0];
  const skipped = skippedFileCount(discoveredFileCount, analyzedFileCount);

  return (
    <section className="relative mx-auto w-full max-w-5xl overflow-hidden border-y border-border/70 bg-canvas text-foreground sm:rounded-[1.75rem] sm:border" aria-labelledby="scan-progress-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,hsl(var(--primary)/0.14),transparent_30%),linear-gradient(180deg,hsl(var(--background)/0.04),transparent_65%)]" />

      <header className="relative flex items-start justify-between gap-4 border-b border-border/55 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-primary-glow">Living Repository</span>
            <span>Live scan</span>
            {sourceLabel && <span aria-label={`Source: ${sourceLabel}`} className="border-l border-border/70 pl-2 normal-case tracking-normal">{sourceLabel}</span>}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold sm:text-2xl">{safeProgress >= 96 ? 'Repository understood.' : 'The workspace is forming.'}</h2>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm">
            <Github className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{repositoryLabel || 'Preparing repository'}</span>
          </div>
        </div>
        {onCancel && <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="mr-1.5 h-3.5 w-3.5" />Cancel</Button>}
      </header>

      <div className="relative px-4 pb-5 pt-6 sm:px-6 sm:pb-6">
        <div className="relative mx-auto min-h-[270px] max-w-3xl sm:min-h-[330px]" data-testid="repository-assembly">
          <AssemblyLines signals={signals} />

          <div className="absolute left-1/2 top-[43%] z-20 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className={cn(
              'relative mx-auto flex h-32 w-32 items-center justify-center rounded-full border bg-background/75 shadow-[0_0_48px_hsl(var(--primary)/0.12)] backdrop-blur-sm transition-colors duration-500 motion-reduce:transition-none sm:h-40 sm:w-40',
              complete ? 'border-success/55' : 'border-primary/55'
            )}>
              {!complete && <span className="absolute inset-2 rounded-full border border-primary/20 motion-safe:animate-pulse" aria-hidden="true" />}
              <div>
                {complete ? <Check className="mx-auto h-5 w-5 text-success" /> : <Network className="mx-auto h-5 w-5 text-primary-glow" />}
                <div className="mt-2 font-display text-base font-semibold sm:text-lg">{safeProgress}%</div>
                <div className="mt-1 max-w-[112px] text-[11px] leading-snug text-muted-foreground sm:max-w-[132px]">{complete ? 'Repository understood' : current?.label || 'Reading repository'}</div>
              </div>
            </div>
          </div>

          <div className="hidden sm:block">
            {signals.slice(0, 3).map((signal, index) => <SignalNode key={signal.label} signal={signal} point={SIGNAL_POINTS[index]} />)}
          </div>

          <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-2 sm:hidden">
            {signals.slice(0, 3).map(signal => <CompactSignal key={signal.label} signal={signal} />)}
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-3xl">
          <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span id="scan-progress-title">{complete ? 'Workspace ready' : current?.label || 'Repository scan'}</span>
            <span>{safeProgress}% complete</span>
          </div>
          <div className="mt-2 h-px overflow-hidden bg-border/70" role="progressbar" aria-label="Repository scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
            <div className="h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${safeProgress}%` }} />
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Metric label="Files found" value={discoveredFileCount == null ? 'Reading' : discoveredFileCount.toLocaleString()} />
            <Metric label="Analyzed" value={analyzedFileCount == null ? 'Pending' : analyzedFileCount.toLocaleString()} />
            <Metric label="Skipped by boundary" value={skipped == null ? 'Pending' : skipped.toLocaleString()} />
          </dl>

          <details className="group mt-4 border-t border-border/55 pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ShieldCheck className="h-3.5 w-3.5 text-primary-glow" />
              Static scan boundary
            </summary>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">ShipSeal does not execute code. It reads allowed repository structure, metadata, configuration, documentation, and tests while excluding generated and vendor folders.</p>
          </details>

          {warnings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-warning">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        </div>
      </div>
    </section>
  );
}

function AssemblyLines({ signals }: { signals: ScanSignal[] }) {
  return (
    <svg className="absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {signals.slice(0, 3).map((signal, index) => {
        const point = SIGNAL_POINTS[index];
        return <line key={signal.label} x1={point.x} y1={point.y} x2="50" y2="43" strokeWidth="0.22" strokeDasharray={signal.state === 'active' ? '1.2 1.2' : undefined} className={cn(signal.state === 'complete' ? 'stroke-success/45' : signal.state === 'active' ? 'stroke-primary/60 motion-safe:animate-pulse' : 'stroke-border/55')} />;
      })}
    </svg>
  );
}

function SignalNode({ signal, point }: { signal: ScanSignal; point: { x: number; y: number } }) {
  const Icon = signal.icon;
  return (
    <div className={cn('absolute z-10 w-40 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 motion-reduce:transition-none', signal.state === 'pending' && 'opacity-45')} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`${signal.label}: ${signal.state}`}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background/70', signal.state === 'complete' ? 'border-success/45 text-success' : signal.state === 'active' ? 'border-primary/55 text-primary-glow motion-safe:animate-pulse' : 'border-border text-muted-foreground')}>
          {signal.state === 'complete' ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0"><div className="text-xs font-medium leading-tight">{signal.label}</div><div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{signal.state}</div></div>
      </div>
    </div>
  );
}

function CompactSignal({ signal }: { signal: ScanSignal }) {
  const Icon = signal.icon;
  return <div aria-label={`${signal.label}: ${signal.state}`} className={cn('min-w-0 border-t pt-2 text-center', signal.state === 'complete' ? 'border-success/45' : signal.state === 'active' ? 'border-primary/55' : 'border-border/55 opacity-50')}><div className="flex justify-center">{signal.state === 'complete' ? <Check className="h-3.5 w-3.5 text-success" /> : <Icon className="h-3.5 w-3.5 text-primary-glow" />}</div><div className="mt-1 truncate text-[10px]">{signal.label}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline gap-1.5"><dt>{label}</dt><dd className="font-mono text-foreground">{value}</dd></div>;
}

function skippedFileCount(discovered?: number | null, analyzed?: number | null) {
  if (discovered == null || analyzed == null) return null;
  return Math.max(0, discovered - analyzed);
}

function buildSignals(progress: number, steps: readonly string[], currentStepIndex: number): ScanSignal[] {
  const icons: LucideIcon[] = [Archive, Network, Layers];
  return steps.map((label, index) => ({
    label,
    icon: icons[index] || Layers,
    state: progress >= 96 || index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'active' : 'pending',
  }));
}

import { CheckCircle2, Loader2, Circle, X, ShieldCheck, Github, FileSearch } from 'lucide-react';
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

  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-primary/25 bg-[hsl(225_28%_8%)] p-6 shadow-glow animate-scale-in md:p-8">
      <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
      <div className="relative">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary-glow" />
            <span>ShipSeal static scan</span>
            {sourceLabel && <span className="rounded-full border border-primary/30 px-2 py-0.5 text-primary-glow">{sourceLabel}</span>}
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">Scanning repository archive</h2>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Github className="h-4 w-4 text-primary-glow" />
            <span className="truncate text-foreground/90">{repositoryLabel || 'Preparing repository'}</span>
          </div>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancel Scan
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <ProgressMetric label="Progress" value={`${safeProgress}%`} />
        <ProgressMetric label="Files discovered" value={discoveredFileCount == null ? 'Reading...' : discoveredFileCount.toLocaleString()} />
        <ProgressMetric label="Files analyzed" value={analyzedFileCount == null ? 'Pending' : analyzedFileCount.toLocaleString()} />
      </div>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-background/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSearch className="h-4 w-4 text-primary-glow" />
            <span>{steps[currentStepIndex] || 'Finalizing scan'}</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{safeProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
          <div
            className="h-full bg-gradient-primary transition-all duration-500 ease-out"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {steps.map((label, i) => {
          const done = i < currentStepIndex;
          const active = i === currentStepIndex;
          return (
            <li
              key={label}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
                done && 'border-success/25 bg-success/10 text-foreground',
                active && 'border-primary/40 bg-primary/15 text-foreground',
                !done && !active && 'border-border/50 bg-secondary/15 text-muted-foreground'
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : active ? (
                <Loader2 className="h-4 w-4 text-primary-glow animate-spin shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(done && 'text-foreground', active && 'text-foreground font-medium')}>{label}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-xl border border-border/60 bg-secondary/15 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        ShipSeal does not execute code. It performs a structural/static readiness scan, reads repository metadata plus key config/docs/test files, and ignores generated/vendor folders such as node_modules, dist, build, .next, and coverage.
      </div>

      {warnings.length > 0 && (
        <ul className="mt-5 space-y-1 text-xs text-warning">
          {warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
      </div>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

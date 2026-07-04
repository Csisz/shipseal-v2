import { CheckCircle2, Loader2, Circle, X, ShieldCheck, Github, FileSearch, Sparkles, BrainCircuit, Database, Route, Layers } from 'lucide-react';
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
  const understanding = repositoryUnderstandingLevel(safeProgress, discoveredFileCount, analyzedFileCount);
  const skippedFiles = skippedFileCount(discoveredFileCount, analyzedFileCount);
  const intelligenceStages = buildIntelligenceStages(safeProgress, steps, currentStepIndex);
  const agentTrail = buildAgentTrail(safeProgress, repositoryLabel, skippedFiles);

  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-primary/25 bg-[hsl(225_28%_8%)] p-6 shadow-glow animate-scale-in md:p-8">
      <div className="absolute inset-0 bg-gradient-glow opacity-18 pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <BrainCircuit className="h-3.5 w-3.5 text-primary-glow" />
              <span>Repository Intelligence</span>
              {sourceLabel && <span className="rounded-full border border-primary/30 px-2 py-0.5 text-primary-glow">{sourceLabel}</span>}
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold text-foreground md:text-4xl">Understanding your repository</h2>
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-primary/20 bg-background/20 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository understanding</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">{understanding}</div>
                </div>
                <span className="font-mono text-xs text-primary-glow">{safeProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                <div
                  className="h-full bg-gradient-primary transition-all duration-500 ease-out"
                  style={{ width: `${safeProgress}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ProgressMetric label="Files found" value={discoveredFileCount == null ? 'Reading' : discoveredFileCount.toLocaleString()} />
                <ProgressMetric label="Files analyzed" value={analyzedFileCount == null ? 'Pending' : analyzedFileCount.toLocaleString()} />
                <ProgressMetric label="Files skipped" value={skippedFiles == null ? 'Estimating' : skippedFiles.toLocaleString()} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {intelligenceStages.map(stage => (
                <IntelligenceStage key={stage.label} {...stage} />
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-border/60 bg-secondary/15 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Live Agent Simulator</div>
                <h3 className="mt-1 font-display text-xl font-semibold">Estimated first pass</h3>
              </div>
              <Sparkles className="h-4 w-4 text-primary-glow" />
            </div>
            <div className="space-y-3">
              {agentTrail.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    'rounded-2xl border px-4 py-3 transition-all duration-500',
                    item.active ? 'border-primary/45 bg-primary/10' : item.done ? 'border-success/30 bg-success/5' : 'border-border/50 bg-background/20 opacity-70'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]', item.done ? 'border-success/50 text-success' : item.active ? 'border-primary/60 text-primary-glow' : 'border-border/70 text-muted-foreground')}>
                      {item.done ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{item.label}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ProgressMetric label="Context saved" value={skippedFiles == null ? 'Estimating' : `${skippedFiles} skipped`} />
              <ProgressMetric label="Token reduction" value="Heuristic" />
            </div>
          </aside>
        </div>

        <details className="group mt-6 rounded-xl border border-border/60 bg-secondary/15">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span>Scan boundary</span>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
          </summary>
          <div className="border-t border-border/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            ShipSeal does not execute code. It performs a structural/static scan, reads repository metadata plus key config/docs/test files, and ignores generated/vendor folders such as node_modules, dist, build, .next, and coverage.
          </div>
        </details>

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

interface IntelligenceStageProps {
  label: string;
  detail: string;
  icon: typeof FileSearch;
  done: boolean;
  active: boolean;
}

function IntelligenceStage({ label, detail, icon: Icon, done, active }: IntelligenceStageProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all duration-500',
        active && 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/10',
        done && !active && 'border-success/30 bg-success/5',
        !done && !active && 'border-border/50 bg-secondary/15 text-muted-foreground'
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', active ? 'border-primary/50 text-primary-glow' : done ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground')}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {active && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-glow" />}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function repositoryUnderstandingLevel(progress: number, discoveredFileCount?: number | null, analyzedFileCount?: number | null) {
  if (progress >= 96) return 'Workspace model ready';
  if (progress >= 74) return 'Routing map forming';
  if (progress >= 52) return 'Architecture signals detected';
  if (progress >= 28) return 'Project shape detected';
  if (discoveredFileCount || analyzedFileCount) return 'Repository opened';
  return 'Connecting signals';
}

function skippedFileCount(discoveredFileCount?: number | null, analyzedFileCount?: number | null) {
  if (discoveredFileCount == null || analyzedFileCount == null) return null;
  return Math.max(0, discoveredFileCount - analyzedFileCount);
}

function buildIntelligenceStages(progress: number, steps: readonly string[], currentStepIndex: number) {
  const activeStep = steps[currentStepIndex] || 'Finalizing scan';
  const stages = [
    { label: 'Repository detected', detail: 'Source selected and archive boundary established.', icon: Github, threshold: 5 },
    { label: 'Structure mapped', detail: activeStep, icon: Layers, threshold: 24 },
    { label: 'Framework signals', detail: 'Looking for manifests, language markers and project commands.', icon: FileSearch, threshold: 44 },
    { label: 'Memory anchors', detail: 'Locating README, instructions, architecture notes and context files.', icon: BrainCircuit, threshold: 62 },
    { label: 'Generated folders skipped', detail: 'Reducing noise from vendor, build and coverage folders.', icon: Database, threshold: 78 },
    { label: 'Agent route prepared', detail: 'Preparing the first-pass workspace handoff.', icon: Route, threshold: 94 },
  ];

  return stages.map((stage, index) => {
    const nextThreshold = stages[index + 1]?.threshold ?? 101;
    return {
      ...stage,
      done: progress >= stage.threshold,
      active: progress >= stage.threshold && progress < nextThreshold,
    };
  });
}

function buildAgentTrail(progress: number, repositoryLabel?: string | null, skippedFiles?: number | null) {
  const items = [
    {
      label: 'Repository detected',
      detail: repositoryLabel ? `${repositoryLabel} is ready for static analysis.` : 'Waiting for repository metadata.',
      threshold: 5,
    },
    {
      label: 'Reading project entry points',
      detail: 'README, manifests and common project files are prioritized when present.',
      threshold: 28,
    },
    {
      label: 'Searching architecture and instructions',
      detail: 'Looking for architecture notes, AGENTS.md, CLAUDE.md and tool rules.',
      threshold: 52,
    },
    {
      label: 'Ignoring generated context',
      detail: skippedFiles == null ? 'Generated/vendor folders are being estimated.' : `${skippedFiles} files are outside the useful first-pass context.`,
      threshold: 72,
    },
    {
      label: 'Ready to code with context',
      detail: 'ShipSeal will show the evidence-backed workspace view when the scan completes.',
      threshold: 94,
    },
  ];

  return items.map((item, index) => {
    const nextThreshold = items[index + 1]?.threshold ?? 101;
    return {
      ...item,
      done: progress >= nextThreshold,
      active: progress >= item.threshold && progress < nextThreshold,
    };
  });
}

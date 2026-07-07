import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Archive, CheckCircle2, FileText, GitBranch, Layers, Network, Sparkles, TestTube2, Workflow, type LucideIcon } from 'lucide-react';
import type { ReadinessReport } from '@/lib/types';
import {
  buildIntelligenceRevealModel,
  INTELLIGENCE_REVEAL_REDUCED_MOTION_MS,
  INTELLIGENCE_REVEAL_TOTAL_MS,
  type IntelligenceRevealSignal,
} from '@/lib/workspace/intelligenceReveal';
import { cn } from '@/lib/utils';

interface Props {
  report: ReadinessReport;
  onComplete: () => void;
}

type RevealPhase = 'identity' | 'signals' | 'connections' | 'meaning';

const SIGNAL_LAYOUT: Record<IntelligenceRevealSignal['id'], { x: number; y: number }> = {
  structure: { x: 50, y: 16 },
  architecture: { x: 82, y: 35 },
  documentation: { x: 18, y: 35 },
  projectMemory: { x: 20, y: 72 },
  verification: { x: 80, y: 72 },
  context: { x: 50, y: 86 },
  developerWorkflow: { x: 50, y: 86 },
};

const SIGNAL_ICONS: Record<IntelligenceRevealSignal['id'], LucideIcon> = {
  structure: Layers,
  architecture: Network,
  documentation: FileText,
  projectMemory: Sparkles,
  verification: TestTube2,
  context: Archive,
  developerWorkflow: Workflow,
};

export function IntelligenceReveal({ report, onComplete }: Props) {
  const model = useMemo(() => buildIntelligenceRevealModel(report), [report]);
  const [phase, setPhase] = useState<RevealPhase>('identity');
  const prefersReducedMotion = usePrefersReducedMotion();
  const timersRef = useRef<number[]>([]);
  const completedRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const finishReveal = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTimers();
    onComplete();
  }, [clearTimers, onComplete]);

  useEffect(() => {
    completedRef.current = false;
    clearTimers();
    setPhase(prefersReducedMotion ? 'meaning' : 'identity');

    timersRef.current = prefersReducedMotion
      ? [window.setTimeout(finishReveal, INTELLIGENCE_REVEAL_REDUCED_MOTION_MS)]
      : [
          window.setTimeout(() => setPhase('signals'), 650),
          window.setTimeout(() => setPhase('connections'), 2150),
          window.setTimeout(() => setPhase('meaning'), 3450),
          window.setTimeout(finishReveal, INTELLIGENCE_REVEAL_TOTAL_MS),
        ];

    return clearTimers;
  }, [clearTimers, finishReveal, prefersReducedMotion, report.repoName, report.scannedAt]);

  const meaning = phase === 'meaning';
  const connectionsVisible = phase === 'connections' || meaning;
  const signalsVisible = phase !== 'identity';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(225_28%_5%)] px-5 py-10 text-foreground animate-fade-in motion-reduce:animate-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,hsl(var(--primary)/0.22),transparent_36%),radial-gradient(circle_at_50%_84%,hsl(var(--accent)/0.12),transparent_42%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <button
        type="button"
        onClick={finishReveal}
        className="absolute right-5 top-5 z-50 rounded-full border border-border/60 bg-background/40 px-4 py-2 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to workspace
      </button>

      <section className="relative w-full max-w-6xl" aria-label="Intelligence Reveal">
        <div className="mx-auto mb-7 max-w-3xl text-center">
          <div className="text-xs font-mono uppercase tracking-[0.28em] text-primary-glow">Repository Intelligence</div>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight md:text-5xl">
            {meaning ? 'Repository understood.' : phaseMessage(phase)}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            {meaning ? 'Your AI Workspace is ready.' : `${model.sourceLabel} - ${model.stackLabel}`}
          </p>
        </div>

        <div className="relative mx-auto min-h-[520px] max-w-5xl overflow-hidden rounded-[2rem] border border-primary/20 bg-background/15 p-4 shadow-glow md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.14),transparent_40%)]" />
          <ConnectionLayer signals={model.signals} visible={connectionsVisible} />

          <div className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-primary/45 bg-primary/10 text-center shadow-glow transition-all duration-700 motion-reduce:transition-none sm:h-36 sm:w-36 md:h-44 md:w-44">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse motion-reduce:animate-none" />
            {meaning ? <CheckCircle2 className="h-6 w-6 text-success sm:h-7 sm:w-7" /> : <GitBranch className="h-6 w-6 text-primary-glow sm:h-7 sm:w-7" />}
            <div className="mt-2 px-3 font-display text-sm font-semibold leading-tight sm:mt-3 sm:px-4 sm:text-base">{model.repositoryName}</div>
            <div className="mt-1 px-3 text-[10px] text-muted-foreground sm:px-4 sm:text-[11px]">{meaning ? 'Workspace ready' : 'Repository center'}</div>
          </div>

          {model.signals.map((signal, index) => (
            <SignalNode key={signal.id} signal={signal} index={index} visible={signalsVisible} connected={connectionsVisible} calm={meaning} />
          ))}

        </div>
      </section>
    </main>
  );
}

function ConnectionLayer({ signals, visible }: { signals: IntelligenceRevealSignal[]; visible: boolean }) {
  return (
    <svg className="absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {signals.map((signal, index) => {
        const point = SIGNAL_LAYOUT[signal.id];
        return (
          <line
            key={signal.id}
            x1="50"
            y1="50"
            x2={point.x}
            y2={point.y}
            className={cn(
              'transition-all duration-700 motion-reduce:transition-none',
              signal.kind === 'evidence' ? 'stroke-primary/45' : 'stroke-muted-foreground/35'
            )}
            strokeWidth={signal.kind === 'evidence' ? '0.28' : '0.18'}
            strokeDasharray={signal.kind === 'heuristic' ? '1.4 1.4' : undefined}
            style={{
              opacity: visible ? 1 : 0,
              transitionDelay: `${index * 130}ms`,
            }}
          />
        );
      })}
    </svg>
  );
}

function SignalNode({
  signal,
  index,
  visible,
  connected,
  calm,
}: {
  signal: IntelligenceRevealSignal;
  index: number;
  visible: boolean;
  connected: boolean;
  calm: boolean;
}) {
  const Icon = SIGNAL_ICONS[signal.id];
  const point = SIGNAL_LAYOUT[signal.id];
  return (
    <article
      className={cn(
        'absolute z-30 w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-[hsl(225_28%_7%/0.9)] p-2 text-left backdrop-blur transition-all duration-700 motion-reduce:transition-none sm:w-[210px] sm:p-3 md:w-[240px]',
        signal.kind === 'evidence' ? 'border-primary/30' : 'border-border/55',
        connected && signal.kind === 'evidence' && !calm && 'shadow-glow',
        calm && 'border-success/25'
      )}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -44%) scale(0.96)',
        transitionDelay: `${index * 190}ms`,
      } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border sm:h-9 sm:w-9',
          signal.kind === 'evidence' ? 'border-primary/45 text-primary-glow' : 'border-muted-foreground/35 text-muted-foreground'
        )}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xs font-semibold leading-tight sm:text-sm">{signal.label}</h2>
            <span className={cn(
              'rounded-full border px-2 py-0.5 text-[10px]',
              signal.kind === 'evidence' ? 'border-primary/35 text-primary-glow' : 'border-muted-foreground/35 text-muted-foreground'
            )}>
              {signal.kind === 'evidence' ? 'Evidence' : 'Heuristic'}
            </span>
          </div>
          <div className="mt-1 hidden text-[11px] uppercase tracking-wider text-muted-foreground sm:block">{signal.category}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {signal.evidence.slice(0, 2).map((item, evidenceIndex) => (
          <div key={item} className={cn(
            'truncate rounded-lg border border-border/45 bg-secondary/20 px-2 py-1.5 font-mono text-[10px] text-foreground/80 sm:px-2.5 sm:text-[11px]',
            evidenceIndex > 0 && 'hidden sm:block'
          )}>
            {item}
          </div>
        ))}
      </div>
      <p className={cn('mt-3 hidden text-xs leading-relaxed text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none sm:block', connected ? 'opacity-100' : 'opacity-0')}>
        {signal.connection}
      </p>
    </article>
  );
}

function phaseMessage(phase: RevealPhase) {
  if (phase === 'connections') return 'Connecting repository signals';
  if (phase === 'signals') return 'Reading repository evidence';
  return 'Understanding repository structure';
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);
    const onChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return prefersReducedMotion;
}

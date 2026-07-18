import { Badge } from '@/components/ui/badge';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryVerificationResult, WorkspaceStory } from '@/lib/workspace';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import type { RepositoryFriction } from './types';

export function WorkspaceStoryLead({ report, story }: { report: ReadinessReport; story: WorkspaceStory }) {
  const chapters = story.chapters.slice(0, 3);
  const evidenceCount = story.chapters.reduce((total, chapter) => total + chapter.evidenceItems.filter(item => item.state === 'evidence').length, 0);

  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5 md:p-6" aria-labelledby="workspace-story-lead-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/40 text-primary-glow">Workspace Story</Badge>
        <span className="text-xs text-muted-foreground">{evidenceCount} deterministic evidence references</span>
      </div>
      <h3 id="workspace-story-lead-heading" className="mt-3 font-display text-xl font-semibold">How this repository works</h3>
      {chapters.length ? (
        <>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            ShipSeal identified {report.stack.primary} as the primary stack and organized the available repository evidence into {story.chapters.length} connected responsibility areas.
          </p>
          <ol className="mt-5 grid gap-3 lg:grid-cols-3">
            {chapters.map(chapter => (
              <li key={chapter.id} className="rounded-2xl border border-border/55 bg-background/20 p-4">
                <div className="text-sm font-semibold text-foreground">{chapter.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{chapter.repositoryMeaning}</p>
                <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Supporting evidence</div>
                <ul className="mt-1 space-y-1 text-xs text-foreground/85">
                  {chapter.evidenceItems.slice(0, 2).map(item => <li key={`${chapter.id}-${item.label}`} className="break-words [overflow-wrap:anywhere]">{item.label}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm leading-relaxed text-warning/90">
          ShipSeal does not have enough deterministic repository evidence to form a reliable workspace story. Unavailable areas are not treated as failures.
        </p>
      )}
    </section>
  );
}

export function RepositoryFrictionProgression({ frictions }: { frictions: RepositoryFriction[] }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-background/20 p-5 md:p-6" aria-labelledby="improvement-progression-heading">
      <h3 id="improvement-progression-heading" className="font-display text-xl font-semibold">From evidence to a reviewable change</h3>
      <p className="mt-2 text-sm text-muted-foreground">Observed repository signals remain distinct from the improvements ShipSeal recommends.</p>
      <ol className="mt-5 space-y-4">
        {frictions.map((friction, index) => (
          <li key={friction.id} className="grid gap-3 rounded-2xl border border-border/55 bg-secondary/15 p-4 md:grid-cols-[42px_minmax(0,1fr)_minmax(220px,0.7fr)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/35 bg-primary/10 font-mono text-xs text-primary-glow">{index + 1}</div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Observed evidence and friction</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{friction.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{friction.evidence || friction.detail}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-primary-glow">Proposed improvement</div>
              <p className="mt-1 text-xs leading-relaxed text-foreground/85">{friction.recommendation || friction.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function VerificationNarrative({
  intelligenceBaseline,
  intelligenceResult,
  optimizationResult,
}: {
  intelligenceBaseline?: RepositoryIntelligenceVerificationBaseline | null;
  intelligenceResult?: RepositoryIntelligenceVerificationResult | null;
  optimizationResult?: RepositoryVerificationResult | null;
}) {
  const summary = intelligenceResult
    ? 'A later scan is available. Review artifact presence and statement truth separately below.'
    : optimizationResult?.status === 'matched-rescan'
      ? 'A later scan matched the saved Optimization Plan baseline. Detailed evidence remains available below.'
      : intelligenceBaseline
        ? 'A Repository Intelligence baseline is saved. Verification remains pending until a compatible later scan is available.'
        : 'No compatible verification baseline is available yet. Creating or downloading an artifact alone does not verify a repository change.';

  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5 md:p-6" aria-labelledby="verification-story-heading">
      <div className="text-xs font-mono uppercase tracking-wider text-primary-glow">Baseline to rescan</div>
      <h3 id="verification-story-heading" className="mt-2 font-display text-xl font-semibold">{intelligenceResult || optimizationResult?.status === 'matched-rescan' ? 'Rescan evidence available' : intelligenceBaseline ? 'Awaiting a compatible rescan' : 'Verification has not started'}</h3>
      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
    </section>
  );
}

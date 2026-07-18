import type { ReactNode } from 'react';
import type { ResultChapterId } from './types';

const CHAPTER_COPY: Record<ResultChapterId, { eyebrow: string; title: string; description: string }> = {
  understand: {
    eyebrow: 'Understand',
    title: 'What ShipSeal understood',
    description: 'Follow the repository story from evidence to responsibilities and relationships.',
  },
  improve: {
    eyebrow: 'Improve',
    title: 'Improve the repository',
    description: 'ShipSeal turns evidence-backed repository friction into reviewable repository-specific changes.',
  },
  verify: {
    eyebrow: 'Verify',
    title: 'Verify the repository change',
    description: 'Compare a saved baseline with a later scan before treating an improvement as applied.',
  },
  deliver: {
    eyebrow: 'Deliver',
    title: 'Deliver what ShipSeal learned',
    description: 'Create a client-ready handoff or export the repository intelligence needed by your team and AI agents.',
  },
};

export function ResultChapterShell({ chapter, active, children, labelledBy }: { chapter: ResultChapterId; active: boolean; children: ReactNode; labelledBy?: string }) {
  const copy = CHAPTER_COPY[chapter];
  const headingId = labelledBy || `result-${chapter}-heading`;

  return (
    <section hidden={!active} className="mb-6" aria-labelledby={headingId} data-result-chapter={chapter}>
      <header className="mb-5 max-w-4xl">
        <div className="text-xs font-mono uppercase tracking-wider text-primary-glow">{copy.eyebrow}</div>
        <h2 id={headingId} className="mt-1 font-display text-2xl font-semibold md:text-3xl">{copy.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">{copy.description}</p>
      </header>
      {children}
    </section>
  );
}

import type { ResultChapterId, ResultChapterStatuses } from './types';

const RESULT_CHAPTERS: Array<{ id: ResultChapterId; label: string; description: string }> = [
  { id: 'understand', label: 'Understand', description: 'What ShipSeal learned.' },
  { id: 'improve', label: 'Improve', description: 'Review repository changes.' },
  { id: 'verify', label: 'Verify', description: 'Check a later rescan.' },
  { id: 'deliver', label: 'Deliver', description: 'Handoff and exports.' },
];

export function ResultChapterNav({
  activeChapter,
  statuses,
  onChange,
}: {
  activeChapter: ResultChapterId;
  statuses: ResultChapterStatuses;
  onChange: (chapter: ResultChapterId) => void;
}) {
  return (
    <nav className="mb-5 overflow-x-auto pb-1" aria-label="Result chapters">
      <div className="grid min-w-[680px] grid-cols-4 gap-2">
        {RESULT_CHAPTERS.map(chapter => (
        <button
          key={chapter.id}
          type="button"
          aria-pressed={activeChapter === chapter.id}
          aria-current={activeChapter === chapter.id ? 'page' : undefined}
          onClick={() => onChange(chapter.id)}
          className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activeChapter === chapter.id
              ? 'border-primary/45 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
              : 'border-border/55 bg-background/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
          }`}
        >
          <div className="text-sm font-semibold">{chapter.label}</div>
          <div className="mt-1 text-xs">{chapter.description}</div>
          <div className="mt-2 text-[11px] text-muted-foreground/80">{statuses[chapter.id]}</div>
        </button>
        ))}
      </div>
    </nav>
  );
}

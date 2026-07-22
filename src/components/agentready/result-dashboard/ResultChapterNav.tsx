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
  variant = 'document',
}: {
  activeChapter: ResultChapterId;
  statuses: ResultChapterStatuses;
  onChange: (chapter: ResultChapterId) => void;
  variant?: 'document' | 'overlay';
}) {
  const stageOverlay = variant === 'overlay';
  return (
    <nav className={stageOverlay ? 'pointer-events-auto min-w-0 rounded-xl border border-border/60 bg-background/80 p-1 shadow-lg shadow-black/20 backdrop-blur-md' : 'mb-2'} aria-label="Result chapters">
      <div className={stageOverlay ? 'grid min-w-0 grid-cols-4 gap-1' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
        {RESULT_CHAPTERS.map(chapter => (
        <button
          key={chapter.id}
          type="button"
          aria-pressed={activeChapter === chapter.id}
          aria-current={activeChapter === chapter.id ? 'page' : undefined}
          onClick={() => onChange(chapter.id)}
          className={`min-h-11 min-w-0 rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${stageOverlay ? 'px-2 py-1' : 'px-3 py-1.5'} ${
            activeChapter === chapter.id
              ? 'border-primary/45 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
              : 'border-border/55 bg-background/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
          }`}
        >
          <div className={`${stageOverlay ? 'text-xs' : 'text-sm'} font-semibold`}>{chapter.label}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground/80 sm:text-[11px]">{statuses[chapter.id]}</div>
        </button>
        ))}
      </div>
    </nav>
  );
}

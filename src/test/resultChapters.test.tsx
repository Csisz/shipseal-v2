import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import { buildWorkspaceStory } from '@/lib/workspace';
import { RepositoryFrictionProgression, VerificationNarrative, WorkspaceStoryLead } from '@/components/agentready/result-dashboard/chapterContent';
import { ResultChapterNav } from '@/components/agentready/result-dashboard/ResultChapterNav';
import { ResultChapterShell } from '@/components/agentready/result-dashboard/ResultChapterShell';
import type { ResultChapterId } from '@/components/agentready/result-dashboard/types';

const statuses = {
  understand: 'Repository mapped',
  improve: 'Three next moves',
  verify: 'Needs later scan',
  deliver: 'Outputs available',
};

function ChapterHarness({ onChange = vi.fn() }: { onChange?: (chapter: ResultChapterId) => void }) {
  const [active, setActive] = useState<ResultChapterId>('understand');
  return (
    <>
      <ResultChapterNav
        activeChapter={active}
        statuses={statuses}
        onChange={chapter => {
          setActive(chapter);
          onChange(chapter);
        }}
      />
      {(['understand', 'improve', 'verify', 'deliver'] as ResultChapterId[]).map(chapter => (
        <ResultChapterShell key={chapter} chapter={chapter} active={active === chapter}>
          <p>{chapter} content</p>
        </ResultChapterShell>
      ))}
    </>
  );
}

describe('Ω.17.2 result chapters', () => {
  it('exposes exactly four accessible chapters with Understand active by default', () => {
    const onChange = vi.fn();
    render(<ChapterHarness onChange={onChange} />);

    const navigation = screen.getByRole('navigation', { name: /Result chapters/i });
    const buttons = within(navigation).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons.map(button => button.textContent)).toEqual([
      expect.stringContaining('Understand'),
      expect.stringContaining('Improve'),
      expect.stringContaining('Verify'),
      expect.stringContaining('Deliver'),
    ]);
    expect(buttons[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: /What ShipSeal understood/i })).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole('button', { name: /Verify/i }));
    expect(onChange).toHaveBeenCalledWith('verify');
    expect(within(navigation).getByRole('button', { name: /Verify/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: /Verify the repository change/i })).toBeInTheDocument();
  });

  it('leads understanding with deterministic Workspace Story evidence and a conservative fallback', () => {
    const report = buildSampleReport();
    const { rerender } = render(<WorkspaceStoryLead report={report} story={buildWorkspaceStory(report)} />);

    expect(screen.getByRole('heading', { name: /How this repository works/i })).toBeInTheDocument();
    expect(screen.getByText(/primary stack/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supporting evidence/i)).toHaveLength(3);

    rerender(<WorkspaceStoryLead report={report} story={{ initialChapterId: null, chapters: [] }} />);
    expect(screen.getByText(/does not have enough deterministic repository evidence/i)).toBeInTheDocument();
  });

  it('keeps observed friction, recommendations, and verification truth visually distinct without a score', () => {
    render(
      <>
        <RepositoryFrictionProgression frictions={[{
          id: 'friction:test',
          title: 'Verification commands are unclear',
          detail: 'No test command was detected.',
          source: 'top-action',
          evidence: 'package.json has no test script.',
          recommendation: 'Review a repository-specific command map.',
        }]} />
        <VerificationNarrative />
      </>
    );

    expect(screen.getByText('Observed evidence and friction')).toBeInTheDocument();
    expect(screen.getByText('Proposed improvement')).toBeInTheDocument();
    expect(screen.getByText(/Creating or downloading an artifact alone does not verify/i)).toBeInTheDocument();
    expect(screen.queryByText(/verification score/i)).not.toBeInTheDocument();
  });
});

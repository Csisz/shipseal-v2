import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import type { ReadinessReport } from '@/lib/types';

vi.mock('@/components/agentready/result-workspace/universe/UniverseWorkspace', () => ({
  AiWorkspaceHero: ({ activeResultChapter }: { activeResultChapter: string }) => (
    <div data-testid="universe-experience" data-active-chapter={activeResultChapter}>Existing Project Universe experience</div>
  ),
}));

vi.mock('@/components/agentready/result-dashboard/chapters/ImproveChapter', () => ({
  default: () => <div>Other improvements</div>,
}));

vi.mock('@/components/agentready/result-workspace/futures/RepositoryFuturesWorkspace', () => ({
  default: ({ repositoryModel }: { repositoryModel: { nodes: unknown[] } }) => (
    <div data-testid="futures-experience" data-repository-model-nodes={repositoryModel.nodes.length}>Existing Repository Futures experience</div>
  ),
}));

vi.mock('@/components/agentready/result-dashboard/PostScanOverview', () => ({
  PostScanOverview: () => <div data-testid="normal-post-scan-overview">Normal post-scan overview</div>,
}));

vi.mock('@/components/agentready/result-dashboard/ResultChapterNav', () => ({
  ResultChapterNav: () => <nav aria-label="Result chapters">Normal chapter rail</nav>,
}));

vi.mock('@/components/agentready/SuggestedReadinessFixPack', () => ({
  SuggestedReadinessFixPack: () => null,
}));

import { IntelligenceReveal } from '@/components/agentready/IntelligenceReveal';
import { ResultWorkspace } from '@/components/agentready/ResultWorkspace';

function reportWithIdentity(identity: string): ReadinessReport {
  return { ...buildSampleReport(), scannedAt: identity };
}

function renderWorkspace(report = reportWithIdentity('2026-08-11T10:00:00.000Z')) {
  return render(<ResultWorkspace report={report} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);
}

describe('premium post-scan view selector', () => {
  it('appears before the normal overview, chapter rail, Universe or Futures experience', () => {
    renderWorkspace();

    expect(screen.getByTestId('post-scan-view-selector')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Choose your first perspective/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Project Universe' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Open Repository Futures' })).toBeEnabled();
    expect(screen.queryByTestId('normal-post-scan-overview')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /Result chapters/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('universe-experience')).not.toBeInTheDocument();
    expect(screen.queryByTestId('futures-experience')).not.toBeInTheDocument();
  });

  it('opens Project Universe first and returns through Change view', () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Open Project Universe' }));

    expect(screen.getByTestId('universe-experience')).toHaveAttribute('data-active-chapter', 'understand');
    expect(screen.getByRole('button', { name: /Change view.*Current view: Project Universe/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Change view/i }));
    expect(screen.getByTestId('post-scan-view-selector')).toBeInTheDocument();
  });

  it('opens Repository Futures without mounting Universe and can switch to Project Universe', async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Open Repository Futures' }));

    expect(await screen.findByTestId('futures-experience')).toBeInTheDocument();
    expect(screen.getByTestId('futures-experience')).toHaveAttribute('data-repository-model-nodes');
    expect(screen.queryByTestId('universe-experience')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repository-future-impact-heading')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Change view/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Project Universe' }));
    expect(screen.getByTestId('universe-experience')).toHaveAttribute('data-active-chapter', 'understand');
  });

  it('resets the selector synchronously when a new report identity is loaded', () => {
    const first = reportWithIdentity('2026-08-11T10:00:00.000Z');
    const second = reportWithIdentity('2026-08-11T10:01:00.000Z');
    const { rerender } = render(<ResultWorkspace report={first} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Project Universe' }));
    expect(screen.getByTestId('universe-experience')).toBeInTheDocument();

    rerender(<ResultWorkspace report={second} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);

    expect(screen.getByTestId('post-scan-view-selector')).toBeInTheDocument();
    expect(screen.queryByTestId('universe-experience')).not.toBeInTheDocument();
  });

  it('supports explicit keyboard activation for both choices', async () => {
    renderWorkspace();
    const universe = screen.getByRole('button', { name: 'Open Project Universe' });
    universe.focus();
    fireEvent.keyDown(universe, { key: 'Enter' });
    expect(screen.getByTestId('universe-experience')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Change view/i }));
    const futures = screen.getByRole('button', { name: 'Open Repository Futures' });
    futures.focus();
    fireEvent.keyDown(futures, { key: ' ' });
    expect(await screen.findByTestId('futures-experience')).toBeInTheDocument();
  });

  it('hands a sample report from the unified ready formation to the selector without exposing the workspace first', () => {
    vi.useFakeTimers();
    const report = reportWithIdentity('2026-08-11T10:02:00.000Z');

    function SampleRevealHandoff() {
      const [revealing, setRevealing] = useState(true);
      return revealing
        ? <IntelligenceReveal report={report} onComplete={() => setRevealing(false)} />
        : <ResultWorkspace report={report} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />;
    }

    try {
      render(<SampleRevealHandoff />);
      expect(screen.getByRole('heading', { name: /your workspace is ready/i })).toBeInTheDocument();
      expect(screen.queryByTestId('post-scan-view-selector')).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(720));

      expect(screen.getByTestId('post-scan-view-selector')).toBeInTheDocument();
      expect(screen.queryByTestId('normal-post-scan-overview')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

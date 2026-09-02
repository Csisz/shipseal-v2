import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryProductIntelligenceResult } from '@/lib/repositoryIntelligence';

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
    expect(screen.getByTestId('post-scan-view-selector')).toHaveClass('w-full');
    expect(screen.getByTestId('post-scan-view-selector')).not.toHaveClass('w-screen');
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
    expect(screen.getByTestId('experience-shell-utility')).not.toHaveClass('sticky');
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

  it('uses native keyboard-activatable buttons for both choices', async () => {
    renderWorkspace();
    const universe = screen.getByRole('button', { name: 'Open Project Universe' });
    expect(universe.tagName).toBe('BUTTON');
    universe.focus();
    fireEvent.click(universe);
    expect(screen.getByTestId('universe-experience')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Change view/i }));
    const futures = screen.getByRole('button', { name: 'Open Repository Futures' });
    expect(futures.tagName).toBe('BUTTON');
    futures.focus();
    fireEvent.click(futures);
    expect(await screen.findByTestId('futures-experience')).toBeInTheDocument();
  });

  it('keeps Universe usable while Futures resumes and auto-enters after the explicitly requested analysis becomes ready', async () => {
    const report = reportWithIdentity('2026-08-11T10:01:30.000Z');
    const retry = vi.fn(async () => undefined);
    const onReset = vi.fn();
    const fallbackStatus = {
      state: 'fallback' as const,
      deepState: 'timed-out' as const,
      category: 'request_timeout' as const,
      retryable: true as const,
      message: 'ShipSeal can safely resume this Future analysis. Completed stages remain saved.',
      diagnostics: {
        costEstimate: 'unavailable' as const, requestId: 'ri-roots-safe-reference',
        operationalFailureCategory: 'provider_timeout' as const, operationRecoveryAction: 'retry_stage' as const,
      },
    };
    const { rerender } = render(<ResultWorkspace
      report={report}
      history={[]}
      onReset={onReset}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={fallbackStatus}
      retryRepositoryProductIntelligence={retry}
    />);

    expect(screen.getByTestId('futures-degraded-status')).toHaveTextContent('Project Universe is ready');
    expect(screen.getByRole('button', { name: 'Open Project Universe' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Resume Future analysis' })).toBeEnabled();
    expect(screen.queryByTestId('futures-experience')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Future analysis' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();

    rerender(<ResultWorkspace
      report={report}
      history={[]}
      onReset={onReset}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{ state: 'preparing', deepState: 'pending', retryable: false, productStage: 'expansion', completedBatches: 2, totalBatches: 3, message: 'Building future pathways · 2 of 3 pathway groups complete.' }}
      retryRepositoryProductIntelligence={retry}
    />);
    expect(screen.getByTestId('futures-degraded-status')).toHaveTextContent('2 of 3 pathway groups complete');
    expect(screen.getByRole('button', { name: 'Future analysis in progress' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open Project Universe' }));
    expect(screen.getByTestId('universe-experience')).toBeInTheDocument();

    const product = { opportunities: [{ id: 'future.one' }] } as unknown as RepositoryProductIntelligenceResult;
    rerender(<ResultWorkspace
      report={report}
      history={[]}
      onReset={onReset}
      onClearHistory={vi.fn()}
      repositoryProductIntelligence={product}
      repositoryProductIntelligenceStatus={{ state: 'enhanced', deepState: 'completed', retryable: false, providerId: 'fixture', message: 'Future analysis is ready.' }}
      retryRepositoryProductIntelligence={retry}
    />);
    expect(await screen.findByTestId('futures-experience')).toBeInTheDocument();
    expect(screen.queryByTestId('post-scan-view-selector')).not.toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers an explicit completion-billed Future action after a free deterministic scan', () => {
    const start = vi.fn(async () => undefined);
    render(<ResultWorkspace
      report={reportWithIdentity('2026-08-11T10:01:40.000Z')}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{ state: 'deterministic', retryable: false, message: 'Repository evidence is ready.' }}
      retryRepositoryProductIntelligence={start}
    />);

    expect(screen.getByRole('button', { name: 'Open Project Universe' })).toBeEnabled();
    expect(screen.queryByTestId('futures-degraded-status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Future analysis' })).toHaveTextContent('Uses 1 Deep Analysis · charged only on completion');
    expect(screen.getByText(/Deep Analysis sends selected, bounded repository evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /How AI processing works/i })).toHaveAttribute('href', '/privacy#deterministic-ai');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Future analysis' }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('auto-enters Futures exactly once after explicit generation completes', async () => {
    const report = reportWithIdentity('2026-08-11T10:01:41.000Z');
    const start = vi.fn(async () => undefined);
    const { rerender } = render(<ResultWorkspace
      report={report}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{ state: 'deterministic', retryable: false, message: 'Repository evidence is ready.' }}
      retryRepositoryProductIntelligence={start}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Future analysis' }));
    rerender(<ResultWorkspace
      report={report}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{ state: 'preparing', deepState: 'pending', retryable: false, productStage: 'roots', message: 'Mapping major directions.' }}
      retryRepositoryProductIntelligence={start}
    />);
    const product = { opportunities: [{ id: 'future.one' }] } as unknown as RepositoryProductIntelligenceResult;
    rerender(<ResultWorkspace
      report={report}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligence={product}
      repositoryProductIntelligenceStatus={{ state: 'enhanced', deepState: 'completed', retryable: false, providerId: 'fixture', message: 'Future analysis is ready.' }}
      retryRepositoryProductIntelligence={start}
    />);

    expect(await screen.findByTestId('futures-experience')).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('does not auto-enter a cached Future without current explicit intent', () => {
    const product = { opportunities: [{ id: 'future.cached' }] } as unknown as RepositoryProductIntelligenceResult;
    render(<ResultWorkspace
      report={reportWithIdentity('2026-08-11T10:01:41.500Z')}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligence={product}
      repositoryProductIntelligenceStatus={{ state: 'enhanced', deepState: 'completed', retryable: false, providerId: 'fixture', message: 'Future analysis is ready.' }}
    />);

    expect(screen.getByTestId('post-scan-view-selector')).toBeInTheDocument();
    expect(screen.queryByTestId('futures-experience')).not.toBeInTheDocument();
  });

  it('returns a refunded historical analysis to the clean explicit-start state', () => {
    const start = vi.fn(async () => undefined);
    render(<ResultWorkspace
      report={reportWithIdentity('2026-08-11T10:01:42.000Z')}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{
        state: 'fallback', deepState: 'failed', category: 'operation_conflict', retryable: false,
        message: 'This Future analysis cannot be resumed safely. Start again after the repository changes.',
        diagnostics: {
          costEstimate: 'unavailable',
          publicOperationId: `op_${'r'.repeat(24)}`,
          operationCompletionState: 'refunded',
          operationUserUnitState: 'refunded',
          operationRecoveryAction: 'start_new_analysis',
        },
      }}
      retryRepositoryProductIntelligence={start}
    />);

    expect(screen.queryByTestId('futures-degraded-status')).not.toBeInTheDocument();
    const futureCard = screen.getByRole('button', { name: 'Generate Future analysis' });
    expect(futureCard).toHaveTextContent('A previous incomplete analysis was returned to your allowance');
    expect(futureCard).toHaveTextContent('Uses 1 Deep Analysis · charged only on completion');
    expect(futureCard).not.toHaveTextContent('cannot be resumed safely');
    expect(futureCard).not.toHaveTextContent('repository changes');
    expect(screen.getByRole('button', { name: 'Open Project Universe' })).toBeEnabled();
    expect(futureCard).toBeEnabled();
    fireEvent.click(futureCard);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('shows a factual capacity cooldown and disables manual retry until it expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const retry = vi.fn(async () => undefined);
    try {
      render(<ResultWorkspace
        report={reportWithIdentity('2026-08-11T10:01:45.000Z')}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        repositoryProductIntelligenceStatus={{
          state: 'fallback', deepState: 'failed', category: 'rate_limited', retryable: true,
          message: 'Future analysis is waiting for AI capacity.',
          diagnostics: {
            costEstimate: 'unavailable', operationalFailureCategory: 'provider_rate_limited', failureBoundary: 'provider-http',
            retryAfterMs: 12_000, rateLimitRetryAt: 13_000, rateLimitRecoveryStatus: 'exhausted',
          },
        }}
        retryRepositoryProductIntelligence={retry}
      />);

      expect(screen.getByTestId('futures-degraded-status')).toHaveTextContent('Retry available in 12 seconds');
      expect(screen.getByRole('button', { name: 'Retry available in 12s' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Open Project Universe' })).toBeEnabled();
      act(() => vi.advanceTimersByTime(12_000));
      expect(screen.getByRole('button', { name: 'Retry Future analysis' })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'Retry Future analysis' }));
      expect(retry).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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

  it('opens Repository Futures when a verified checkout return carries the safe internal focus hint', async () => {
    window.history.pushState({}, '', '/projects/prj_safe/scans/scn_safe?open=futures');
    try {
      renderWorkspace(reportWithIdentity('2026-08-11T10:03:00.000Z'));
      expect(await screen.findByTestId('futures-experience')).toBeInTheDocument();
      expect(screen.queryByTestId('post-scan-view-selector')).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });
});

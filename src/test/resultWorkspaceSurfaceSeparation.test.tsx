import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';

const universeRendererState = vi.hoisted(() => ({ moduleLoads: 0 }));

vi.mock('@/components/agentready/RepositoryUniverse3D', () => {
  universeRendererState.moduleLoads += 1;
  return {
    default: ({ model }: { model: { summary: { representedFileNodeCount: number } } }) => (
      <div
        role="img"
        aria-label={`Repository Universe 3D graph. ${model.summary.representedFileNodeCount} analyzed file nodes represented.`}
        data-testid="separated-universe-renderer"
      />
    ),
  };
});

import { ResultWorkspace } from '@/components/agentready/ResultWorkspace';

describe('Repository Futures and Project Universe surface separation', () => {
  it('keeps the Universe renderer deferred for Futures and loads it after an explicit switch to Universe', async () => {
    render(
      <ResultWorkspace
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Repository Futures' }));

    const futures = await screen.findByTestId('repository-futures-workspace');
    expect(futures.closest('[data-view-transition="selector-to-futures"]')).toHaveClass('futures-surface-enter');
    expect(within(futures).getByTestId('repository-futures-stage')).toBeInTheDocument();
    expect(within(futures).getByTestId('repository-futures-stage')).toHaveAttribute('data-primary-surface', 'neural-canvas');
    expect(within(futures).getByTestId('future-pathways-hero-stage')).toBeInTheDocument();
    expect(within(futures).getAllByRole('group', { name: 'Future Pathways mode' })).toHaveLength(1);
    const otherImprovements = within(futures).getByText('Other improvements').closest('details');
    expect(otherImprovements).not.toHaveAttribute('open');
    expect(otherImprovements?.parentElement).toHaveAttribute('data-secondary-surface', 'other-improvements');
    expect(screen.queryByTestId('repository-universe-workspace-stage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repository-toolbar-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repository-inspector-scroll-region')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repository-future-impact-heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Repository future impact mode/i })).not.toBeInTheDocument();
    expect(universeRendererState.moduleLoads).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /Change view/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Project Universe' }));

    expect(await screen.findByTestId('separated-universe-renderer')).toBeInTheDocument();
    await waitFor(() => expect(universeRendererState.moduleLoads).toBeGreaterThan(0));
    expect(screen.queryByTestId('repository-futures-workspace')).not.toBeInTheDocument();
  });
});

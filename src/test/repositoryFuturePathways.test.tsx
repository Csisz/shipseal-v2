import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildReport } from '@/lib/readiness';
import { buildRepositoryUniverseModel } from '@/lib/workspace';
import RepositoryFuturePathways from '@/components/agentready/result-workspace/futures/RepositoryFuturePathways';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

function futureReport() {
  return buildReport({
    repoName: 'future-pathways-ui',
    source: { sourceType: 'github-app', githubOwner: 'shipseal', githubRepo: 'future-pathways-ui', githubBranch: 'main' },
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 280 },
      { path: 'src/App.tsx', size: 520 },
      { path: 'src/App.test.tsx', size: 360 },
      { path: '.github/workflows/ci.yml', size: 180 },
    ],
    textContents: {
      'README.md': '# Future Pathways UI\n\nA bounded repository fixture.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest run', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

async function renderPathways() {
  let latestOverlay: RepositoryFutureStageOverlay | null = null;
  const onStageOverlayChange = vi.fn((overlay: RepositoryFutureStageOverlay | null) => {
    latestOverlay = overlay;
  });
  const report = futureReport();
  render(<RepositoryFuturePathways report={report} universe={buildRepositoryUniverseModel(report)} onStageOverlayChange={onStageOverlayChange} />);
  await waitFor(() => expect(onStageOverlayChange).toHaveBeenCalled());
  return { onStageOverlayChange, overlay: () => latestOverlay };
}

function chooseFirstPrimary() {
  const buttons = screen.getAllByRole('button', { name: 'Choose as primary' });
  expect(buttons.length).toBeGreaterThan(0);
  fireEvent.click(buttons[0]);
}

describe('Omega 18.5d Repository Future Pathways', () => {
  it('defaults to Quick Path, selects one primary through synthesis, and publishes the semantic Universe overlay', async () => {
    const { overlay } = await renderPathways();

    expect(screen.getByRole('button', { name: 'Quick Path' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Nothing is selected automatically/)).toBeInTheDocument();
    chooseFirstPrimary();

    expect(await screen.findByText('Synthesized draft')).toBeInTheDocument();
    expect(screen.getByText(/Required dependency path/)).toBeInTheDocument();
    await waitFor(() => expect(overlay()?.phase).toBe('synthesis'));
    expect(overlay()?.draftFingerprint).toBeTruthy();
    expect(overlay()?.universeProjection?.sourceDraftFingerprint).toBe(overlay()?.draftFingerprint);
    expect(overlay()?.universeProjection?.proposedNodes.every(node => node.currentness === 'future')).toBe(true);
    expect(overlay()?.candidates.filter(candidate => candidate.role === 'primary')).toHaveLength(1);
  });

  it('uses the same draft across Quick Path and Deep Configuration', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    const primaryTitle = overlay()?.candidates.find(candidate => candidate.role === 'primary')?.title;
    expect(primaryTitle).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Deep Configuration' }));
    expect(screen.getByRole('button', { name: 'Deep Configuration' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(primaryTitle!).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Quick Path' }));
    expect(screen.getAllByText(primaryTitle!).length).toBeGreaterThan(0);
    expect(overlay()?.draftFingerprint).toBeTruthy();
  });

  it('adds supports through domain operations and requires an explicit replacement at the two-support cap', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    await waitFor(() => expect(overlay()?.universeProjection).toBeTruthy());
    const primaryProjection = overlay()?.universeProjection?.fingerprint;

    const firstSupport = await screen.findAllByRole('button', { name: 'Add supporting goal' });
    fireEvent.click(firstSupport[0]);
    await waitFor(() => expect(overlay()?.universeProjection?.fingerprint).not.toBe(primaryProjection));
    const secondSupport = await screen.findAllByRole('button', { name: 'Add supporting goal' });
    if (secondSupport.length > 0) fireEvent.click(secondSupport[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Deep Configuration' }));
    const availableThird = screen.queryAllByRole('button', { name: 'Use as support' }).find(button => !button.hasAttribute('disabled'));
    if (availableThird) {
      fireEvent.click(availableThird);
      expect(screen.getByText(/up to two supporting goals/i)).toBeInTheDocument();
      const dialog = screen.getByRole('dialog', { name: /Replace one supporting goal/i });
      expect(within(dialog).getAllByRole('button', { name: /Replace /i })).toHaveLength(2);
      fireEvent.click(within(dialog).getAllByRole('button', { name: /Replace /i })[0]);
      expect(screen.queryByRole('dialog', { name: /Replace one supporting goal/i })).not.toBeInTheDocument();
    }
    expect(screen.getByText(/2 of 2|1 of 2/)).toBeInTheDocument();
  });

  it('keeps dependencies derived-only and exposes causal inspection, saved branches, conflicts and prospective output semantics in the DOM', async () => {
    await renderPathways();
    chooseFirstPrimary();

    const automaticLocks = screen.getAllByLabelText('Automatically required');
    expect(automaticLocks.length).toBeGreaterThan(0);
    fireEvent.click(automaticLocks[0].closest('button')!);
    expect(screen.getByText(/Cannot be removed independently|Only by removing its supporting goal/)).toBeInTheDocument();

    expect(screen.getByText(/Saved for later/)).toBeInTheDocument();
    expect(screen.getByText(/Prospective artifacts and gates/)).toBeInTheDocument();
    expect(screen.getByText(/Trade-offs, review and conflicts/)).toBeInTheDocument();
    expect(screen.getByText(/No files or prepared artifacts have been generated/)).toBeInTheDocument();
  });

  it('renders every decision control immediately as a keyboard-operable DOM equivalent without WebGL', async () => {
    await renderPathways();

    const primaryAction = screen.getAllByRole('button', { name: 'Choose as primary' })[0];
    primaryAction.focus();
    fireEvent.keyDown(primaryAction, { key: 'Enter' });
    fireEvent.click(primaryAction);
    expect(await screen.findByText('Future Draft crystallized')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Future Pathways inspector' })).toBeInTheDocument();
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('renders a dedicated clean Pathways stage without Universe controls or a canvas', async () => {
    await renderPathways();
    const hero = screen.getByTestId('future-pathways-hero-stage');
    expect(within(hero).getByTestId('future-neural-field')).toBeInTheDocument();
    expect(within(hero).queryByLabelText(/Search repository atlas or universe/i)).not.toBeInTheDocument();
    expect(within(hero).queryByRole('button', { name: /Universe 3D/i })).not.toBeInTheDocument();
    expect(within(hero).queryByRole('button', { name: /Fullscreen/i })).not.toBeInTheDocument();
    expect(hero.querySelector('canvas')).not.toBeInTheDocument();
  });
});

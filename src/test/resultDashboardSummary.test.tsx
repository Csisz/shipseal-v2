import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { createEmptyScanSummary } from '@/lib/scannerLimits';

const universeMockState = vi.hoisted(() => ({
  models: [] as unknown[],
  selectedNodeIds: [] as Array<string | undefined>,
  cameraRadii: [] as number[],
  visibleNodeCounts: [] as number[],
  shouldThrow: false,
}));

vi.mock('@/components/agentready/ScoreGauge', () => ({
  ScoreGauge: ({ score }: { score: number }) => <div>Score gauge {score}</div>,
}));

vi.mock('@/components/agentready/CategoryBreakdown', () => ({
  CategoryBreakdown: () => <div>Category breakdown mock</div>,
}));

vi.mock('@/components/agentready/AgentPackTabs', () => ({
  AgentPackTabs: () => <div>Agent pack tabs mock</div>,
}));

vi.mock('@/components/agentready/DeliveryPackPreview', () => ({
  DeliveryPackPreview: ({ intakeSkipped }: { intakeSkipped?: boolean }) => (
    <div>{intakeSkipped ? 'Client report quality is limited because project intake was skipped.' : 'Delivery Pack preview mock'}</div>
  ),
}));

vi.mock('@/components/agentready/SuggestedReadinessFixPack', () => ({
  SuggestedReadinessFixPack: () => <div>Suggested Readiness Fix Pack mock</div>,
}));

vi.mock('@/components/agentready/ProjectIntakeForm', () => ({
  ProjectIntakeForm: ({ value, onChange }: { value: { clientName?: string }; onChange: (value: unknown) => void }) => (
    <label>
      Client name
      <input
        aria-label="Client name"
        value={value.clientName || ''}
        onChange={event => onChange({ ...value, clientName: event.target.value })}
      />
    </label>
  ),
}));

vi.mock('@/components/agentready/RepositoryUniverse3D', () => ({
  default: ({ model, selectedNodeId, rotationPaused, reducedMotion, visibleNodeIds, visibleEdgeIds, cameraState, animateIn, onSelectNode }: {
    model: { summary: { representedFileNodeCount: number; edgeCount: number }; nodes: { id: string; label: string }[] };
    selectedNodeId?: string;
    rotationPaused?: boolean;
    reducedMotion?: boolean;
    visibleNodeIds: string[];
    visibleEdgeIds: string[];
    cameraState: { radius: number };
    animateIn?: boolean;
    onSelectNode: (nodeId: string) => void;
  }) => {
    if (universeMockState.shouldThrow) {
      throw new Error('Simulated Repository Universe render failure');
    }
    universeMockState.models.push(model);
    universeMockState.selectedNodeIds.push(selectedNodeId);
    universeMockState.cameraRadii.push(cameraState.radius);
    universeMockState.visibleNodeCounts.push(visibleNodeIds.length);
    return (
      <div
        role="img"
        aria-label={`Repository Universe 3D graph. ${model.summary.representedFileNodeCount} analyzed file nodes represented.`}
        data-testid="repository-universe-canvas"
        data-node-count={model.summary.representedFileNodeCount}
        data-edge-count={model.summary.edgeCount}
        data-visible-node-count={visibleNodeIds.length}
        data-visible-edge-count={visibleEdgeIds.length}
        data-selected-node={selectedNodeId}
        data-camera-radius={cameraState.radius}
        data-animate-in={animateIn ? 'true' : 'false'}
        data-rotation-paused={rotationPaused || reducedMotion ? 'true' : 'false'}
      >
        <button type="button" onClick={() => model.nodes[1] && onSelectNode(model.nodes[1].id)}>
          Select universe node
        </button>
      </div>
    );
  },
}));

import { ResultDashboard } from '@/components/agentready/ResultDashboard';

function switchToAtlas2D() {
  const atlasButton = screen.getByRole('button', { name: /Atlas 2D/i });
  if (atlasButton.getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(atlasButton);
  }
}

function atlasViewport() {
  switchToAtlas2D();
  return screen.getByRole('img', { name: /Repository Atlas knowledge graph/i });
}

function dispatchAtlasWheel(target: Element, deltaY: number) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY });
  let dispatchResult = true;
  act(() => {
    dispatchResult = target.dispatchEvent(event);
  });
  return { event, prevented: !dispatchResult };
}

describe('ResultDashboard summary copy', () => {
  beforeEach(() => {
    universeMockState.models = [];
    universeMockState.selectedNodeIds = [];
    universeMockState.cameraRadii = [];
    universeMockState.visibleNodeCounts = [];
    universeMockState.shouldThrow = false;
  });

  it('uses compact Delivery Pack summary text that does not truncate the old wording', () => {
    const report = buildSampleReport();
    const folderAgentPaths = getFolderAgentSuggestionPaths(report.repoContextPack);
    const onReplayReveal = vi.fn();
    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={onReplayReveal}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Replay reveal/i }));
    expect(onReplayReveal).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Full ShipSeal package').length).toBeGreaterThan(0);
    expect(screen.getByText(`${resolveDeliveryPackFocus(['full-package'], { folderAgentPaths }).generatedPaths.length} outputs`)).toBeInTheDocument();
    expect(screen.queryByText('Full Delivery Pack: 36 required outputs')).not.toBeInTheDocument();
    expect(screen.getByText(/Everything ShipSeal can generate/i)).toBeInTheDocument();
    expect(screen.getByText(/Advanced details/i)).toBeInTheDocument();
    expect(screen.getByText(/Available ShipSeal improvements/i)).toBeInTheDocument();
  });

  it('makes visual understanding the primary dashboard summary and keeps Repository Health secondary', () => {
    const report = buildSampleReport();
    const topAction = report.repositoryHealth.topActions[0];

    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /What ShipSeal understood/i })).toBeInTheDocument();
    expect(screen.getAllByText('Repository Intelligence').length).toBeGreaterThan(0);
    expect(screen.getByText('Visual understanding')).toBeInTheDocument();
    expect(screen.getByText(/This repository has a usable AI workspace forming/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How ShipSeal understands this repository/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Mental Model semantic repository graph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Architecture: .* signal/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /AI Instructions: .* signal/i }));
    expect(screen.getByRole('heading', { name: /AI Instructions/i })).toBeInTheDocument();
    expect(screen.getAllByText('Connections').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repository DNA').length).toBeGreaterThan(0);
    expect(screen.getByText(/ShipSeal connected documentation, architecture, memory, verification and context/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /AI workspace profile/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository DNA radar profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Documentation: .*current score/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Context Efficiency:/i }));
    expect(screen.getByRole('heading', { name: /Context Efficiency/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Potential/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Evidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recommendations').length).toBeGreaterThan(0);
    expect(screen.getByText(/Signals and missing pieces/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mental model built/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Workspace metrics and next action/i)).toBeInTheDocument();
    expect(screen.getAllByText('Workspace Quality').length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${report.repositoryHealth.overall.score} / 100`).length).toBeGreaterThan(0);
    expect(screen.getByText('Workspace Overview')).toBeInTheDocument();
    expect(screen.getByText('Repository as an AI workspace')).toBeInTheDocument();
    expect(screen.getByText(`${report.repositoryHealth.overall.score} / 100`)).toBeInTheDocument();
    expect(screen.getByText(report.repositoryHealth.overall.status)).toBeInTheDocument();
    expect(screen.getAllByText(`${report.repositoryHealth.overall.confidence} confidence`).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repository Friction').length).toBeGreaterThan(0);
    expect(screen.getByText('Live Agent Simulator')).toBeInTheDocument();
    expect(screen.getByText('Agent Heatmap')).toBeInTheDocument();
    expect(screen.getByText('Context Timeline')).toBeInTheDocument();
    expect(screen.getAllByText('Coming in upcoming Workspace Optimization updates.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repository Intelligence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI Development Readiness').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent Routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delivery Confidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText(topAction.title).length).toBeGreaterThan(0);
  });

  it('syncs Workspace Story chapters across Mental Model, Repository DNA and simulator steps', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Repository shape/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /2 Knowledge and docs/i }));

    expect(screen.getByRole('heading', { name: /Knowledge and docs/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^Documentation$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Documentation connects repository identity/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Story signal').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /AI Instructions: .* signal/i }));

    expect(screen.getAllByRole('heading', { name: /Project memory/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('heading', { name: /AI Instructions/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('heading', { name: /Project Memory/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Context Efficiency:/i }));

    expect(screen.getByRole('heading', { name: /Context and workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Context Efficiency/i })).toBeInTheDocument();
    expect(screen.getAllByText(/avoid generated folders/i).length).toBeGreaterThan(0);
  });

  it('renders an interactive Repository Atlas and updates the inspector from real nodes', () => {
    const { container } = render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Explore the repository universe/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toBeInTheDocument();
    switchToAtlas2D();
    expect(screen.getByText(/Showing .* high-signal entities from .* analyzed files/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository Atlas knowledge graph/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('atlas-node-file:documentation:readme.md'));

    expect(screen.getByRole('heading', { name: 'Selected entity' })).toBeInTheDocument();
    expect(screen.getAllByText('README.md').length).toBeGreaterThan(0);
    expect(screen.getAllByText('File').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-testid^="atlas-edge-"]').length).toBeGreaterThan(0);
  });

  it('renders the result workspace when optional complete file inventory is absent', async () => {
    const legacyReport = { ...buildSampleReport() };
    delete legacyReport.analyzedFiles;

    render(
      <ResultDashboard
        report={legacyReport}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /What ShipSeal understood/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Export what the workspace produced/i })).toBeInTheDocument();
  });

  it('syncs Repository Atlas selection with Workspace Story chapters', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    switchToAtlas2D();
    fireEvent.click(screen.getByRole('button', { name: /2 Knowledge and docs/i }));
    expect(screen.getByTestId('atlas-node-concept:documentation')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('atlas-node-memory:projectMemory:agents.md'));
    expect(screen.getAllByRole('heading', { name: /Project memory/i }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('atlas-node-memory:projectMemory:agents.md')).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports Repository Atlas search, filters and reset without a new scan', () => {
    const onReset = vi.fn();
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={onReset}
        onClearHistory={vi.fn()}
      />
    );

    switchToAtlas2D();
    fireEvent.change(screen.getByLabelText(/Search repository atlas/i), { target: { value: 'README' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'README.md' })[0]);
    expect(screen.getAllByText('README.md').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    expect(screen.queryByTestId('atlas-node-file:documentation:readme.md')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reset view/i }));
    expect(screen.getByLabelText(/Search repository atlas/i)).toHaveValue('');
    expect(screen.getByTestId('atlas-node-file:documentation:readme.md')).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
  });

  it('keeps the Repository Universe model stable across selection, filters, search and zoom', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    const universe = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    const initialModel = universeMockState.models.at(-1);
    const initialVisibleCount = Number(universe.getAttribute('data-visible-node-count'));
    const initialRadius = Number(universe.getAttribute('data-camera-radius'));
    const initialSelectedNode = universe.getAttribute('data-selected-node');

    fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
    await waitFor(() => expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).not.toHaveAttribute('data-selected-node', initialSelectedNode || ''));
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    const afterFilesFilter = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    expect(Number(afterFilesFilter.getAttribute('data-visible-node-count'))).toBeLessThan(initialVisibleCount);
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.change(screen.getByLabelText(/Search repository atlas or universe/i), { target: { value: 'README' } });
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.click(screen.getByRole('button', { name: /Zoom in/i }));
    await waitFor(() => expect(Number(screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-camera-radius'))).toBeLessThan(initialRadius));
    expect(universeMockState.models.at(-1)).toBe(initialModel);
  });

  it('preserves Repository Universe selection and camera state in fullscreen', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });

    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
    fireEvent.click(screen.getByRole('button', { name: /Zoom in/i }));
    const selectedNodeId = screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-selected-node');
    const cameraRadius = screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-camera-radius');

    fireEvent.click(screen.getByRole('button', { name: /Fullscreen/i }));

    const dialog = await screen.findByRole('dialog', { name: /Repository Universe fullscreen/i });
    const fullscreenUniverse = within(dialog).getByRole('img', { name: /Repository Universe 3D graph/i });
    expect(requestFullscreen).toHaveBeenCalled();
    expect(fullscreenUniverse).toHaveAttribute('data-selected-node', selectedNodeId || '');
    expect(fullscreenUniverse).toHaveAttribute('data-camera-radius', cameraRadius || '');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Repository Universe fullscreen/i })).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-selected-node', selectedNodeId || '');
  });

  it('contains Repository Universe render failures and keeps Atlas 2D accessible', async () => {
    const onReset = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    universeMockState.shouldThrow = true;

    try {
      render(
        <ResultDashboard
          report={buildSampleReport()}
          history={[]}
          onReset={onReset}
          onClearHistory={vi.fn()}
        />
      );

      expect(await screen.findByText(/Repository Universe could not be rendered/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /What ShipSeal understood/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Export what the workspace produced/i })).toBeInTheDocument();
      expect(screen.getByText(/Your scan and repository evidence are still available/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Open Atlas 2D/i }));

      expect(screen.getByRole('img', { name: /Repository Atlas knowledge graph/i })).toBeInTheDocument();
      expect(onReset).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retries a failed Repository Universe without rerunning the scan or replacing the report', async () => {
    const onReset = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    universeMockState.shouldThrow = true;

    try {
      render(
        <ResultDashboard
          report={buildSampleReport()}
          history={[]}
          onReset={onReset}
          onClearHistory={vi.fn()}
        />
      );

      expect(await screen.findByText(/Repository Universe could not be rendered/i)).toBeInTheDocument();
      universeMockState.shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: /Retry Universe/i }));

      expect(await screen.findByRole('img', { name: /Repository Universe 3D graph/i })).toBeInTheDocument();
      expect(screen.getAllByText('sample-nextjs-app').length).toBeGreaterThan(0);
      expect(onReset).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shows the final Repository Atlas layout immediately with reduced motion', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <ResultDashboard
          report={buildSampleReport()}
          history={[]}
          onReset={vi.fn()}
          onClearHistory={vi.fn()}
        />
      );

      switchToAtlas2D();
      const atlas = screen.getByRole('img', { name: /Repository Atlas knowledge graph/i });
      expect(atlas).toHaveAttribute('data-motion', 'reduced');
      expect(atlas).toHaveAttribute('data-ready', 'true');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('keeps embedded Atlas wheel passive until navigation is deliberately active', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    const atlas = atlasViewport();
    const initialScale = atlas.getAttribute('data-scale');
    const inactiveWheel = dispatchAtlasWheel(atlas, -120);

    expect(inactiveWheel.prevented).toBe(false);
    expect(atlas).toHaveAttribute('data-navigation-active', 'false');
    expect(atlas).toHaveAttribute('data-scale', initialScale);

    fireEvent.pointerDown(atlas, { pointerId: 1, clientX: 100, clientY: 100 });

    await waitFor(() => expect(atlas).toHaveAttribute('data-navigation-active', 'true'));

    const activeWheel = dispatchAtlasWheel(atlas, -120);

    expect(activeWheel.prevented).toBe(true);
    await waitFor(() => expect(atlas.getAttribute('data-scale')).not.toBe(initialScale));
  });

  it('releases embedded Atlas navigation with Escape', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    const atlas = atlasViewport();
    fireEvent.pointerDown(atlas, { pointerId: 1, clientX: 100, clientY: 100 });
    await waitFor(() => expect(atlas).toHaveAttribute('data-navigation-active', 'true'));

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(atlas).toHaveAttribute('data-navigation-active', 'false'));
    expect(screen.getByText(/Click to explore/i)).toBeInTheDocument();
  });

  it('opens fullscreen Atlas, preserves selected node and pan/zoom state, then exits with Escape', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });

    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    switchToAtlas2D();
    fireEvent.click(screen.getByTestId('atlas-node-file:documentation:readme.md'));
    const atlas = atlasViewport();
    fireEvent.pointerDown(atlas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(atlas, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(atlas, { pointerId: 2, clientX: 130, clientY: 122 });
    fireEvent.pointerUp(atlas, { pointerId: 2, clientX: 130, clientY: 122 });
    dispatchAtlasWheel(atlas, -120);

    await waitFor(() => expect(atlas.getAttribute('data-scale')).not.toBe('0.82'));
    const zoomedScale = atlas.getAttribute('data-scale');

    fireEvent.click(screen.getByRole('button', { name: /Fullscreen/i }));

    const dialog = await screen.findByRole('dialog', { name: /Repository Atlas fullscreen/i });
    expect(requestFullscreen).toHaveBeenCalled();
    expect(within(dialog).getAllByText('README.md').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('img', { name: /Repository Atlas knowledge graph/i })).toHaveAttribute('data-scale', zoomedScale);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Repository Atlas fullscreen/i })).not.toBeInTheDocument());
    expect(screen.getByTestId('atlas-node-file:documentation:readme.md')).toHaveAttribute('aria-pressed', 'true');
    expect(atlasViewport()).toHaveAttribute('data-scale', zoomedScale);
  });

  it('keeps fullscreen reset and inspector collapse scoped to Atlas state', async () => {
    const onReset = vi.fn();
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={onReset}
        onClearHistory={vi.fn()}
      />
    );

    switchToAtlas2D();
    fireEvent.click(screen.getByRole('button', { name: /Fullscreen/i }));
    const dialog = await screen.findByRole('dialog', { name: /Repository Atlas fullscreen/i });
    const fullscreenAtlas = within(dialog).getByRole('img', { name: /Repository Atlas knowledge graph/i });

    dispatchAtlasWheel(fullscreenAtlas, -120);
    await waitFor(() => expect(fullscreenAtlas.getAttribute('data-scale')).not.toBe('0.82'));

    fireEvent.click(within(dialog).getAllByRole('button', { name: /Collapse inspector/i })[0]);
    expect(within(dialog).getAllByRole('button', { name: /Expand inspector/i }).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/relationships/i).length).toBeGreaterThan(0);

    fireEvent.click(within(dialog).getByRole('button', { name: /Reset view/i }));

    await waitFor(() => expect(fullscreenAtlas).toHaveAttribute('data-scale', '0.82'));
    expect(onReset).not.toHaveBeenCalled();
  });

  it('cleans up the Atlas wheel listener on unmount', async () => {
    const addSpy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const removeSpy = vi.spyOn(HTMLElement.prototype, 'removeEventListener');

    const { unmount } = render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    switchToAtlas2D();
    await waitFor(() => expect(addSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false }));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('wheel', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('keeps the selected Workspace Story chapter through unrelated UI changes', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /5 Verification path/i }));
    expect(screen.getByRole('heading', { name: /Verification path/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Acme' } });

    expect(screen.getByRole('heading', { name: /Verification path/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /Verification/i }).length).toBeGreaterThan(0);
  });

  it('runs the Live Agent Simulator from repository evidence without model-reasoning claims', () => {
    vi.useFakeTimers();

    try {
      render(
        <ResultDashboard
          report={buildSampleReport()}
          history={[]}
          onReset={vi.fn()}
          onClearHistory={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: /estimated repository exploration/i })).toBeInTheDocument();
      expect(screen.getByText(/Estimated repository exploration based on ShipSeal Repository Intelligence/i)).toBeInTheDocument();
      expect(screen.getByText('Repository detected')).toBeInTheDocument();
      expect(screen.getByText('Framework identified')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(7000);
      });

      expect(screen.getAllByText(/Workspace understanding complete/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Likely first files')).toBeInTheDocument();
      expect(screen.getAllByText('README.md').length).toBeGreaterThan(0);
      expect(screen.getByText('Likely ignored folders')).toBeInTheDocument();
      expect(screen.getAllByText('node_modules').length).toBeGreaterThan(0);
      expect(screen.getByText('Context reduction')).toBeInTheDocument();
      expect(screen.getByText('Routing quality')).toBeInTheDocument();
      expect(screen.getByText('Temporary heuristics')).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/internal reasoning|chain of thought|model reasoning/i);

      fireEvent.click(screen.getByRole('button', { name: /replay/i }));
      expect(screen.getByText(/Workspace understanding in progress/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(7000);
      });

      expect(screen.getAllByText(/Workspace understanding complete/i).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows insufficient evidence without synthetic dimension values', () => {
    const summary = {
      ...createEmptyScanSummary(),
      scanMode: 'limited-fallback' as const,
      limited: true,
      limitationReason: 'ZIP parsing failed before repository contents could be fully analyzed.',
      warnings: ['fallback scan'],
    };
    const report = buildReport({
      repoName: 'limited-repo',
      files: [
        { path: 'README.md', size: 100 },
        { path: 'AGENTS.md', size: 100 },
        { path: 'package.json', size: 100 },
      ],
      textContents: {
        'README.md': '# Synthetic fallback\n',
        'AGENTS.md': '# Synthetic instructions\n',
        'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      },
      scanSummary: summary,
    });

    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByText(/I need more evidence to understand this repository/i)).toBeInTheDocument();
    expect(screen.getByText(/The repository model is incomplete/i)).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Insufficient evidence').length).toBeGreaterThan(0);
    expect(screen.getByText('Low confidence')).toBeInTheDocument();
    expect(screen.getByText(/upload the complete ZIP/i)).toBeInTheDocument();
    expect(screen.queryByText('0 / 100')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Repository Intelligence' })).not.toBeInTheDocument();
  });

  it('labels high Context Waste as risk and does not imply it is positive', () => {
    const report = buildSampleReport();
    const highRiskReport = {
      ...report,
      repositoryHealth: {
        ...report.repositoryHealth,
        dimensions: {
          ...report.repositoryHealth.dimensions,
          contextWaste: {
            ...report.repositoryHealth.dimensions.contextWaste,
            riskScore: 82,
            contextEfficiencyScore: 18,
          },
        },
      },
    };

    render(
      <ResultDashboard
        report={highRiskReport}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getAllByText(/82 \/ 100/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Very high/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Higher friction means more context discovery/i)).toBeInTheDocument();
    expect(screen.queryByText(/high context waste is good/i)).not.toBeInTheDocument();
  });

  it('shows safe evidence and recommendations without raw readable content or unsupported claims', () => {
    const report = buildSampleReport();
    const evidence = report.repositoryHealth.topActions[0]?.evidence[0];

    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    if (evidence) expect(screen.getAllByText(evidence).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Potential .* improvement: up to/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/deterministic static repository estimate/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/PRIVATE_README_BODY_SHOULD_NOT_EXPORT/i)).not.toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/token-saving|financial savings|guaranteed speed/);
  });

  it('keeps delivery readiness details, package controls, and export buttons available', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByText('Delivery Outputs')).toBeInTheDocument();
    expect(screen.getByText('Export what the workspace produced')).toBeInTheDocument();
    expect(screen.getByText('Delivery readiness details')).toBeInTheDocument();
    expect(screen.getByText('Delivery readiness categories')).toBeInTheDocument();
    expect(screen.getByText('Category breakdown mock')).toBeInTheDocument();
    expect(screen.getByText('Delivery Pack preview mock')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /export score\.json/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /scan another project/i }).length).toBeGreaterThan(0);
  });

  it('renders the supplied Repository Health model without recalculating it in the UI', () => {
    const report = buildSampleReport();
    const suppliedReport = {
      ...report,
      repositoryHealth: {
        ...report.repositoryHealth,
        overall: {
          score: 41,
          status: 'High agent friction' as const,
          confidence: 'Low' as const,
        },
      },
    };

    render(
      <ResultDashboard
        report={suppliedReport}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByText('41 / 100')).toBeInTheDocument();
    expect(screen.getByText('High agent friction')).toBeInTheDocument();
    expect(screen.getByText('Low confidence')).toBeInTheDocument();
  });

  it('shows the selected goal package instead of always showing full pack', () => {
    const report = buildSampleReport();
    const folderAgentPaths = getFolderAgentSuggestionPaths(report.repoContextPack);
    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['agent-readiness']}
      />
    );

    expect(screen.getByText('Agent development pack')).toBeInTheDocument();
    expect(screen.getAllByText(`${resolveDeliveryPackFocus(['agent-readiness'], { folderAgentPaths }).generatedPaths.length} outputs`).length).toBeGreaterThan(0);
    expect(screen.getByText(/Context Compression Pack generated/i)).toBeInTheDocument();
    expect(screen.getByText(/Folder-level AGENTS suggestions generated/i)).toBeInTheDocument();
    expect(screen.getByText(/Specialized context packs generated/i)).toBeInTheDocument();
    expect(screen.getByText('Recommended operating mode')).toBeInTheDocument();
    expect(screen.getByText('Balanced Context')).toBeInTheDocument();
    expect(screen.getAllByText('Balanced context use').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recommended default').length).toBeGreaterThan(0);
    expect(screen.queryByText('Full ShipSeal package')).not.toBeInTheDocument();
    expect(screen.getByText(/AGENTS.md, CLAUDE.md, Codex guidance, repo context, role-specific context packs, agent safety notes, and tooling recommendations/i)).toBeInTheDocument();
  });

  it('shows a selected agent operating mode for AI agent development outputs', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['agent-readiness']}
        agentOperatingMode="token-saver"
      />
    );

    expect(screen.getByText('Recommended operating mode')).toBeInTheDocument();
    expect(screen.getByText('Focused Context')).toBeInTheDocument();
    expect(screen.getAllByText('Lowest context use').length).toBeGreaterThan(0);
    expect(screen.getByText(/low-risk UI tweaks and short iterations/i)).toBeInTheDocument();
  });

  it('shows long selected package labels without combining them into the compact metric value', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['safety-risk']}
      />
    );

    expect(screen.getByText('Project package')).toBeInTheDocument();
    expect(screen.getByText('Security and data pre-screen')).toBeInTheDocument();
    expect(screen.getAllByText(`${resolveDeliveryPackFocus(['safety-risk']).generatedPaths.length} outputs`).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Security and data pre-screen - 8 outputs/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Env\/secrets signals, data\/privacy checklist, red-team prompts, and risk summary/i)).toBeInTheDocument();
  });

  it('uses package-specific almost-ready copy and separates readiness status from limited scan', () => {
    render(
      <ResultDashboard
        report={{ ...buildSampleReport(), score: 52, blockers: [] }}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['safety-risk']}
      />
    );

    expect(screen.getAllByText('Partially Ready').length).toBeGreaterThan(0);
    expect(screen.getByText(/not a limited scan/i)).toBeInTheDocument();
    expect(screen.getByText(/strengthen security and data readiness/i)).toBeInTheDocument();
    expect(screen.queryByText('Almost there - improve a few areas to reach AI Coding Ready.')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Limited scan$/i)).not.toBeInTheDocument();
  });

  it('keeps AI agent development using AI coding readiness copy', () => {
    render(
      <ResultDashboard
        report={{ ...buildSampleReport(), score: 70, blockers: [] }}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['agent-readiness']}
      />
    );

    expect(screen.getByText('Almost there - improve a few areas to reach AI Coding Ready.')).toBeInTheDocument();
  });

  it('shows skipped intake warning and regenerate action after intake edits', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        intakeSkipped
      />
    );

    expect(screen.getAllByText(/Client report quality is limited because project intake was skipped/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Project context used for Delivery Outputs')).toBeInTheDocument();
    expect(screen.getByText('Edit project context')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Acme Client' } });

    expect(screen.getByText(/Project context was edited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate report with updated intake/i })).toBeEnabled();
  });
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { createEmptyScanSummary } from '@/lib/scannerLimits';
import {
  buildRepositoryAtlasModel,
  buildOptimizationApplyPlan,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryVerificationBaseline,
  buildRepositoryUniverseModel,
} from '@/lib/workspace';

const universeMockState = vi.hoisted(() => ({
  models: [] as unknown[],
  selectedNodeIds: [] as Array<string | undefined>,
  cameraRadii: [] as number[],
  cameraTargets: [] as Array<{ x: number; y: number; z: number }>,
  visibleNodeCounts: [] as number[],
  shouldThrow: false,
}));

const githubWriteMock = vi.hoisted(() => ({
  createGitHubAppReadinessPr: vi.fn(),
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
  default: ({ model, selectedNodeId, rotationPaused, reducedMotion, routeNodeIds = [], visibleNodeIds, visibleEdgeIds, cameraState, animateIn, onSelectNode, onSceneSettled, focusRequest }: {
    model: { summary: { representedFileNodeCount: number; edgeCount: number }; nodes: { id: string; label: string; position: { x: number; y: number; z: number } }[] };
    selectedNodeId?: string;
    rotationPaused?: boolean;
    reducedMotion?: boolean;
    routeNodeIds?: string[];
    visibleNodeIds: string[];
    visibleEdgeIds: string[];
    cameraState: { radius: number; target: { x: number; y: number; z: number } };
    animateIn?: boolean;
    onSelectNode: (nodeId: string) => void;
    onSceneSettled?: () => void;
    focusRequest?: { nodeId: string; sequence: number };
  }) => {
    if (universeMockState.shouldThrow) {
      throw new Error('Simulated Repository Universe render failure');
    }
    universeMockState.models.push(model);
    universeMockState.selectedNodeIds.push(selectedNodeId);
    universeMockState.cameraRadii.push(cameraState.radius);
    universeMockState.cameraTargets.push(cameraState.target);
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
        data-route-node-count={routeNodeIds.length}
        data-selected-node={selectedNodeId}
        data-camera-radius={cameraState.radius}
        data-camera-target={`${cameraState.target.x},${cameraState.target.y},${cameraState.target.z}`}
        data-focus-request={focusRequest ? `${focusRequest.sequence}:${focusRequest.nodeId}` : ''}
        data-animate-in={animateIn ? 'true' : 'false'}
        data-rotation-paused={rotationPaused || reducedMotion ? 'true' : 'false'}
      >
        <button type="button" onClick={() => model.nodes[1] && onSelectNode(model.nodes[1].id)}>
          Select universe node
        </button>
        <button type="button" onClick={() => model.nodes[2] && onSelectNode(model.nodes[2].id)}>
          Select second universe node
        </button>
        <button type="button" onClick={onSceneSettled}>Settle Universe reveal</button>
      </div>
    );
  },
}));

vi.mock('@/lib/github/write', async () => {
  const actual = await vi.importActual<typeof import('@/lib/github/write')>('@/lib/github/write');
  return {
    ...actual,
    createGitHubAppReadinessPr: githubWriteMock.createGitHubAppReadinessPr,
  };
});

import { ResultDashboard } from '@/components/agentready/ResultDashboard';

function switchToAtlas2D() {
  const atlasButton = screen.getByRole('button', { name: /Atlas 2D/i });
  if (atlasButton.getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(atlasButton);
  }
}

function switchResultChapter(label: 'Understand' | 'Improve' | 'Verify' | 'Deliver') {
  const chapterNav = screen.getByRole('navigation', { name: /Result chapters/i });
  const chapterButton = within(chapterNav).getByRole('button', { name: new RegExp(label, 'i') });
  if (chapterButton.getAttribute('aria-pressed') !== 'true') {
    fireEvent.click(chapterButton);
  }
}

function openDisclosure(title: RegExp | string) {
  const summary = screen.getAllByText(title).find(element => element.tagName.toLowerCase() === 'summary');
  if (!summary) throw new Error(`Disclosure summary not found: ${String(title)}`);
  fireEvent.click(summary);
}

function openMoreControls() {
  const trigger = screen.getByRole('button', { name: /More Universe controls/i });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  return { trigger, menu: screen.getByTestId('universe-more-controls-menu') };
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

function optimizationPlanFor(report: ReturnType<typeof buildReport>) {
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  return {
    universe,
    atlas,
    transformation,
    plan: buildRepositoryOptimizationPlan({ report, universe, atlas, transformation }),
  };
}

function optimizationDashboardReport() {
  return buildReport({
    repoName: 'optimization-dashboard',
    files: [
      { path: 'README.md', size: 240 },
      { path: 'package.json', size: 260 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/App.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 180 },
    ],
    textContents: {
      'README.md': '# Optimization Dashboard\n\nRun tests before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function optimizationDashboardReportWithFiles(files: string[], repoName = 'optimization-dashboard') {
  return buildReport({
    repoName,
    files: files.map(path => ({ path, size: 260 })),
    textContents: {
      'README.md': '# Optimization Dashboard\n\nRun tests before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

describe('Repository Universe workspace state', () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = class ImmediateIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '240px 0px';
      readonly thresholds = [0];
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
      }
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
    universeMockState.models = [];
    universeMockState.selectedNodeIds = [];
    universeMockState.cameraRadii = [];
    universeMockState.cameraTargets = [];
    universeMockState.visibleNodeCounts = [];
    universeMockState.shouldThrow = false;
    githubWriteMock.createGitHubAppReadinessPr.mockReset();
    githubWriteMock.createGitHubAppReadinessPr.mockResolvedValue({
      ok: true,
      prUrl: 'https://github.com/Csisz/shipseal-v2/pull/123',
      branchName: 'shipseal/optimization-pack',
      baseBranch: 'main',
      fileCount: 3,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:shipseal-optimization-pack'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: vi.fn(),
    });
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

    fireEvent.click(await screen.findByRole('button', { name: /Select universe node/i }));
    openMoreControls();
    fireEvent.click(screen.getByRole('menuitem', { name: /Zoom in/i }));
    const selectedNodeId = screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-selected-node');
    const cameraRadius = screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-camera-radius');
    const cameraTarget = screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-camera-target');

    fireEvent.click(screen.getByRole('button', { name: /Fullscreen/i }));

    const dialog = await screen.findByRole('dialog', { name: /Repository Universe fullscreen/i });
    const fullscreenUniverse = within(dialog).getByRole('img', { name: /Repository Universe 3D graph/i });
    expect(requestFullscreen).toHaveBeenCalled();
    expect(fullscreenUniverse).toHaveAttribute('data-animate-in', 'false');
    expect(fullscreenUniverse).toHaveAttribute('data-selected-node', selectedNodeId || '');
    expect(fullscreenUniverse).toHaveAttribute('data-camera-radius', cameraRadius || '');
    expect(fullscreenUniverse).toHaveAttribute('data-camera-target', cameraTarget || '');
    expect(within(dialog).getByTestId('fullscreen-inspector-scroll-region')).toHaveClass('overflow-y-auto');

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
      expect(screen.getByRole('heading', { name: /Explore the repository universe/i })).toBeInTheDocument();
      expect(screen.getByText(/Your scan and repository evidence are still available/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Open Atlas 2D/i }));

      expect(screen.getByRole('img', { name: /Repository Atlas knowledge graph/i })).toBeInTheDocument();
      switchResultChapter('Deliver');
      expect(await screen.findByRole('heading', { name: /Reports and Delivery Outputs/i }, { timeout: 10000 })).toBeInTheDocument();
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

      const universe = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
      expect(universe).toHaveAttribute('data-animate-in', 'false');
      expect(universe).toHaveAttribute('data-rotation-paused', 'true');
      const initialTarget = universe.getAttribute('data-camera-target');
      fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
      const focusedUniverse = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
      expect(focusedUniverse).not.toHaveAttribute('data-camera-target', initialTarget || '');
      expect(focusedUniverse.getAttribute('data-focus-request')).toMatch(/^1:/);
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

    openMoreControls();
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset view/i }));

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

  it('keeps the selected Workspace Story chapter through unrelated UI changes', async () => {
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

    switchResultChapter('Deliver');
    await screen.findByLabelText('Client name');
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Acme' } });
    switchResultChapter('Understand');

    expect(screen.getByRole('heading', { name: /Verification path/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /Verification/i }).length).toBeGreaterThan(0);
  });
});

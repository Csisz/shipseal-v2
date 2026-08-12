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

const selectorMockState = vi.hoisted(() => ({
  view: 'universe' as 'universe' | 'futures',
}));

vi.mock('@/components/agentready/result-dashboard/PostScanViewSelector', async () => {
  const React = await import('react');
  return {
    PostScanViewSelector: ({ onSelect }: { onSelect: (view: 'universe' | 'futures') => void }) => {
      React.useEffect(() => onSelect(selectorMockState.view), [onSelect]);
      return null;
    },
  };
});

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

function openMoreControls() {
  const trigger = screen.getByRole('button', { name: /More Universe controls/i });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  return { trigger, menu: screen.getByTestId('universe-more-controls-menu') };
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
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

describe('Result Workspace composition', () => {
  beforeEach(() => {
    selectorMockState.view = 'universe';
    setViewportWidth(1024);
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

  it('uses one compact mobile hierarchy while keeping every Universe control and state path reachable', async () => {
    setViewportWidth(390);
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        persistenceControl={<button type="button">Save project</button>}
      />
    );

    const stage = await screen.findByTestId('repository-universe-workspace-stage');
    await waitFor(() => expect(screen.getByTestId('repository-toolbar-overlay')).toHaveTextContent('More'));
    expect(stage).toHaveAttribute('data-mobile-viewport-contract', 'safe-dynamic');
    expect(stage).toHaveClass('h-[calc(100dvh-4rem)]', 'min-h-[calc(100svh-4rem)]', 'overflow-hidden');
    expect(screen.getAllByTestId('repository-context-overlay')).toHaveLength(1);
    expect(screen.getAllByTestId('repository-toolbar-overlay')).toHaveLength(1);
    expect(screen.getAllByTestId('result-chapter-rail-overlay')).toHaveLength(1);

    const context = screen.getByTestId('repository-context-overlay');
    expect(within(context).getByRole('heading', { name: /Repository understood/i })).toBeInTheDocument();
    expect(within(context).getAllByRole('button').filter(button => button.hasAttribute('data-mobile-primary-action'))).toHaveLength(1);
    expect(within(context).getByRole('button', { name: /Plan an agent task/i })).toBeInTheDocument();
    expect(within(context).getByRole('button', { name: /Review improvements/i })).not.toBeVisible();

    fireEvent.click(within(context).getByLabelText(/More repository actions/i));
    expect(within(context).getByRole('button', { name: /Review improvements/i })).toBeInTheDocument();
    expect(within(context).getByRole('button', { name: /Save project/i })).toBeInTheDocument();
    expect(within(context).getByRole('button', { name: /Scan another project/i })).toBeInTheDocument();

    const chapterNav = screen.getByRole('navigation', { name: /Result chapters/i });
    expect(chapterNav).toHaveAttribute('data-mobile-layout', 'two-by-two');
    for (const chapter of ['Understand', 'Improve', 'Verify', 'Deliver']) {
      expect(within(chapterNav).getByRole('button', { name: new RegExp(chapter, 'i') })).toBeInTheDocument();
    }

    const toolbar = screen.getByTestId('repository-toolbar-overlay');
    expect(within(toolbar).getByRole('button', { name: /Search repository/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /Universe 3D/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /Atlas 2D/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /More Universe controls/i })).toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: /Fullscreen/i })).not.toBeInTheDocument();

    fireEvent.click(within(toolbar).getByRole('button', { name: /Search repository/i }));
    expect(within(toolbar).getByRole('textbox', { name: /Search repository atlas or universe/i })).toBeInTheDocument();
    fireEvent.click(within(toolbar).getByRole('button', { name: /Close repository search/i }));

    fireEvent.click(within(toolbar).getByRole('button', { name: /More Universe controls/i }));
    const controlsSheet = await screen.findByTestId('mobile-universe-controls-sheet');
    expect(within(controlsSheet).getByRole('button', { name: /Fullscreen/i })).toBeInTheDocument();
    expect(within(controlsSheet).getByRole('button', { name: /Pause rotation/i })).toBeInTheDocument();
    expect(within(controlsSheet).getByRole('button', { name: /Zoom in/i })).toBeInTheDocument();
    expect(within(controlsSheet).getByRole('button', { name: /Zoom out/i })).toBeInTheDocument();
    expect(within(controlsSheet).getByRole('button', { name: /Reset view/i })).toBeInTheDocument();
    expect(within(controlsSheet).getByRole('heading', { name: /Layers and filters/i })).toBeInTheDocument();
    expect(within(controlsSheet).getByLabelText(/Repository Atlas filters/i)).toBeInTheDocument();
    expect(within(controlsSheet).getByLabelText(/Universe interaction help/i)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('mobile-universe-controls-sheet')).not.toBeInTheDocument());

    const universe = await screen.findByTestId('repository-universe-canvas');
    fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
    const selectedTarget = universe.getAttribute('data-camera-target');
    const inspector = await screen.findByTestId('repository-inspector-scroll-region');
    expect(inspector).toHaveAttribute('data-mobile-sheet', 'true');
    expect(inspector).toHaveAttribute('data-mobile-expanded', 'false');
    expect(inspector).toHaveClass('max-h-[52dvh]');
    fireEvent.click(within(inspector).getByRole('button', { name: /Expand details/i }));
    expect(inspector).toHaveAttribute('data-mobile-expanded', 'true');
    expect(inspector).toHaveClass('max-h-[82dvh]');
    fireEvent.click(within(inspector).getByRole('button', { name: /Close inspector/i }));
    expect(screen.queryByTestId('repository-inspector-scroll-region')).not.toBeInTheDocument();
    expect(screen.getByTestId('repository-universe-canvas')).toHaveAttribute('data-camera-target', selectedTarget);

    for (const chapter of ['Improve', 'Verify', 'Deliver', 'Understand'] as const) {
      switchResultChapter(chapter);
      expect(screen.getAllByRole('navigation', { name: /Result chapters/i })).toHaveLength(1);
      expect(within(screen.getByRole('navigation', { name: /Result chapters/i })).getByRole('button', { name: new RegExp(chapter, 'i') })).toHaveAttribute('aria-pressed', 'true');
      if (chapter === 'Verify') {
        const journeyScroll = screen.getByTestId('verification-journey-scroll');
        expect(journeyScroll).toHaveClass('max-w-full', 'overflow-x-auto');
        const lifecycle = screen.getByRole('list', { name: /Verification lifecycle/i });
        expect(within(lifecycle).getAllByRole('listitem')).toHaveLength(4);
        expect(within(lifecycle).getByText('Proposed').closest('li')).toHaveAttribute('aria-current', 'step');
        expect(screen.queryByLabelText(/Optimization Plan artifacts/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Prepare optimization plan/i }));
        fireEvent.click(screen.getByRole('button', { name: /With ShipSeal/i }));
        fireEvent.click(screen.getByRole('button', { name: /Review (optimization )?plan/i }));
        const reviewSheet = await screen.findByTestId('optimization-artifact-review-sheet');
        expect(reviewSheet).toHaveAttribute('data-review-presentation', 'mobile-fullscreen');
        expect(reviewSheet).toHaveClass('h-dvh', 'rounded-none', 'overflow-hidden');
        expect(within(reviewSheet).getByLabelText(/Optimization Plan artifacts/i)).toBeInTheDocument();
        const firstArtifact = within(reviewSheet).getAllByRole('option')[0];
        fireEvent.click(firstArtifact);
        expect(within(reviewSheet).getByRole('button', { name: /Back to artifacts/i })).toBeInTheDocument();
        expect(within(reviewSheet).getByLabelText(/Generated content preview/i)).toBeInTheDocument();
        fireEvent.click(within(reviewSheet).getByRole('button', { name: /Back to artifacts/i }));
        expect(within(reviewSheet).getByLabelText(/Optimization Plan artifacts/i)).toBeInTheDocument();
        fireEvent.click(within(reviewSheet).getByRole('button', { name: /Prepare selected plan/i }));
        fireEvent.click(within(reviewSheet).getByRole('button', { name: /^Close$/i }));
        switchResultChapter('Verify');
        expect(within(screen.getByRole('list', { name: /Verification lifecycle/i })).getByText('Prepared').closest('li')).toHaveAttribute('aria-current', 'step');
      }
    }
    expect(await screen.findByTestId('repository-universe-canvas')).toHaveAttribute('data-camera-target', selectedTarget);
  }, 20_000);

  it('uses compact Delivery Pack summary text that does not truncate the old wording', async () => {
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

    const resultActions = screen.getByRole('button', { name: /More result actions/i });
    fireEvent.keyDown(resultActions, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitem', { name: /Replay reveal/i }));
    expect(onReplayReveal).toHaveBeenCalledTimes(1);
    switchResultChapter('Deliver');
    fireEvent.click(await screen.findByRole('button', { name: /Open Client handoff/i }, { timeout: 10000 }));
    await screen.findByText('Delivery Pack preview mock', {}, { timeout: 10000 });
    expect(screen.getAllByText('Full ShipSeal package').length).toBeGreaterThan(0);
    expect(screen.getByText(`${resolveDeliveryPackFocus(['full-package'], { folderAgentPaths }).generatedPaths.length} outputs`)).toBeInTheDocument();
    expect(screen.queryByText('Full Delivery Pack: 36 required outputs')).not.toBeInTheDocument();
    expect(screen.getByText(/Everything ShipSeal can generate/i)).toBeInTheDocument();
    switchResultChapter('Improve');
    expect(await screen.findByText(/Secondary repository improvements/i)).toBeInTheDocument();
  });

  it('prepares product directions inside the dedicated Futures stage without mounting Universe', async () => {
    globalThis.IntersectionObserver = class DeferredIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '240px 0px';
      readonly thresholds = [0];
      constructor(_callback: IntersectionObserverCallback) {}
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;

    const prepareRepositoryProductIntelligence = vi.fn(async () => undefined);
    selectorMockState.view = 'futures';
    render(<ResultDashboard
      report={buildSampleReport()}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{ state: 'deterministic', message: 'Repository evidence is ready.', retryable: false }}
      prepareRepositoryProductIntelligence={prepareRepositoryProductIntelligence}
    />);

    expect(await screen.findByTestId('repository-futures-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('repository-futures-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('repository-universe-canvas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repository-universe-workspace-stage')).not.toBeInTheDocument();
    await waitFor(() => expect(prepareRepositoryProductIntelligence).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('future-pathways-hero-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('future-neural-field')).not.toBeInTheDocument();
    expect(universeMockState.models).toHaveLength(0);
    expect(prepareRepositoryProductIntelligence).toHaveBeenCalledTimes(1);
  });

  it('keeps Product Strategist pending state local while the workspace remains interactive', async () => {
    globalThis.IntersectionObserver = class DeferredIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '240px 0px';
      readonly thresholds = [0];
      constructor(_callback: IntersectionObserverCallback) {}
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;

    selectorMockState.view = 'futures';
    render(<ResultDashboard
      report={buildSampleReport()}
      history={[]}
      onReset={vi.fn()}
      onClearHistory={vi.fn()}
      repositoryProductIntelligenceStatus={{ state: 'preparing', message: 'Product Strategist is analysing repository evidence.', retryable: false }}
      prepareRepositoryProductIntelligence={vi.fn(async () => undefined)}
    />);

    expect((await screen.findAllByText('Analysing product opportunities')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Quick Path/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Deep Configuration/i })).toBeEnabled();
    expect(screen.getByTestId('repository-futures-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('repository-universe-canvas')).not.toBeInTheDocument();
  });

  it('opens with a simplified repository-specific entry and routes the primary action to Repository Intelligence review', async () => {
    const prepareRepositoryIntelligenceReview = vi.fn(() => new Promise<never>(() => undefined));
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        prepareRepositoryIntelligenceReview={prepareRepositoryIntelligenceReview}
      />
    );

    const chapterNav = screen.getByRole('navigation', { name: /Result chapters/i });
    expect(screen.getByRole('heading', { name: /Repository understood/i })).toBeInTheDocument();
    expect(within(chapterNav).getByRole('button', { name: /Understand/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chapterNav).getByRole('button', { name: /Improve/i })).toBeInTheDocument();
    expect(within(chapterNav).getByRole('button', { name: /Verify/i })).toBeInTheDocument();
    expect(within(chapterNav).getByRole('button', { name: /Deliver/i })).toBeInTheDocument();
    expect(screen.getByText(/areas creating agent friction/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Next best action/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Review improvements$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Plan an agent task$/i })).toBeInTheDocument();
    const universe = await screen.findByRole('img', { name: /Repository Universe 3D graph/i });
    expect(universe).toBeInTheDocument();
    const stage = screen.getByTestId('repository-universe-workspace-stage');
    const contextOverlay = screen.getByTestId('repository-context-overlay');
    const toolbarOverlay = screen.getByTestId('repository-toolbar-overlay');
    expect(stage).toContainElement(contextOverlay);
    expect(contextOverlay).toContainElement(screen.getByRole('heading', { name: /Repository understood/i }));
    expect(stage).toContainElement(chapterNav);
    expect(stage).toContainElement(toolbarOverlay);
    expect(within(toolbarOverlay).getByRole('textbox', { name: /Search repository atlas or universe/i })).toBeInTheDocument();
    expect(within(toolbarOverlay).getByRole('button', { name: /Universe 3D/i })).toBeInTheDocument();
    expect(within(toolbarOverlay).getByRole('button', { name: /Atlas 2D/i })).toBeInTheDocument();
    expect(within(toolbarOverlay).getByRole('button', { name: /Fullscreen/i })).toBeInTheDocument();
    expect(within(toolbarOverlay).getByText('More controls')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: /Result chapters/i })).toHaveLength(1);
    expect(screen.getAllByLabelText(/Search repository atlas or universe/i)).toHaveLength(1);
    expect(screen.getAllByText('More controls')).toHaveLength(1);
    expect(screen.getByTestId('result-chapter-rail-overlay')).toHaveClass('lg:col-start-1', 'lg:max-w-[23rem]');
    expect(screen.queryByText('Exports and reports')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Review improvements$/i }));

    expect(within(chapterNav).getByRole('button', { name: /Improve/i })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(prepareRepositoryIntelligenceReview).toHaveBeenCalledTimes(1), { timeout: 10000 });
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'repository-intelligence-review'), { timeout: 10000 });
    expect(screen.getByRole('heading', { name: /Preparing repository-specific artifact review/i })).toBeInTheDocument();
    expect(screen.getByTestId('repository-universe-workspace-stage')).toContainElement(universe);
    expect(screen.queryByTestId('repository-futures-workspace')).not.toBeInTheDocument();
    expect(screen.queryByTestId('future-pathways-hero-stage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('future-neural-field')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Repository future impact mode' })).not.toBeInTheDocument();
    expect(screen.getByText(/Optimization and Repository Intelligence/i)).toBeInTheDocument();
    expect(screen.queryByTestId('improve-supporting-content')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Review ShipSeal improvements/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prepare optimization package/i })).not.toBeInTheDocument();

    switchResultChapter('Understand');
    fireEvent.click(screen.getByRole('button', { name: /^Plan an agent task$/i }));
    expect(within(chapterNav).getByRole('button', { name: /Understand/i })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getAllByText(/^Plan an agent task$/i).find(element => element.tagName === 'SUMMARY')?.closest('details')).toHaveAttribute('open'));
  }, 20_000);

  it('portals More controls above the selected inspector and restores trigger focus on close', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Select universe node/i }));
    expect(screen.getByRole('button', { name: /Close inspector/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /Contextual repository details/i })).toBeInTheDocument();

    const stage = screen.getByTestId('repository-universe-workspace-stage');
    const { trigger, menu } = openMoreControls();
    expect(menu).toHaveAttribute('data-overlay-layer', 'popover');
    expect(stage).not.toContainElement(menu);
    expect(screen.getByRole('menuitem', { name: /Pause rotation/i })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /Zoom in/i })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /Zoom out/i })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /Reset view/i })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('universe-more-controls-menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    openMoreControls();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const outsideControl = screen.getByRole('button', { name: /Select universe node/i });
    fireEvent.pointerDown(outsideControl, { button: 0, pointerId: 1, pointerType: 'mouse' });
    await waitFor(() => expect(screen.queryByTestId('universe-more-controls-menu')).not.toBeInTheDocument());
  });

  it('lets page scrolling win until the selected inspector is deliberately activated', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Select universe node/i }));
    const inspectorScrollRegion = screen.getByTestId('repository-inspector-scroll-region');

    expect(inspectorScrollRegion).toHaveAttribute('data-scroll-mode', 'page');
    expect(inspectorScrollRegion).toHaveClass('overflow-hidden');

    const passiveWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    inspectorScrollRegion.dispatchEvent(passiveWheel);
    expect(passiveWheel.defaultPrevented).toBe(false);
    expect(inspectorScrollRegion).toHaveAttribute('data-scroll-mode', 'page');

    fireEvent.pointerDown(inspectorScrollRegion, { pointerId: 1, pointerType: 'mouse' });
    expect(inspectorScrollRegion).toHaveAttribute('data-scroll-mode', 'inspector');
    expect(inspectorScrollRegion).toHaveClass('overflow-y-auto');

    fireEvent.blur(inspectorScrollRegion, { relatedTarget: document.body });
    fireEvent.pointerLeave(inspectorScrollRegion);
    expect(inspectorScrollRegion).toHaveAttribute('data-scroll-mode', 'page');

    fireEvent.focus(inspectorScrollRegion);
    expect(inspectorScrollRegion).toHaveAttribute('data-scroll-mode', 'inspector');
  });

  it('keeps Understand graph-first and reveals story, DNA, Mental Model, and metrics contextually', async () => {
    const report = buildSampleReport();

    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Repository understood/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Explore the repository universe/i })).toBeInTheDocument();
    const universe = await screen.findByRole('img', { name: /Repository Universe 3D graph/i });
    expect(universe).toBeInTheDocument();
    expect(screen.getByText(/Select a node to inspect evidence/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /Contextual repository details/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Live Agent Simulator/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Agent Journey/i })).not.toBeInTheDocument();

    const { menu } = openMoreControls();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Open repository story/i }));
    expect(screen.getByRole('tab', { name: /Story/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /Knowledge and docs/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /DNA/i }));
    expect(screen.getByText(/Current and potential workspace dimensions/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Mental Model/i }));
    expect(screen.getByText(/Semantic relationships use the existing repository model/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Overview/i }));
    expect(screen.getByText(/Workspace Quality/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${report.repositoryHealth.overall.score} / 100`))).toBeInTheDocument();
  }, 20_000);

  it('preserves contextual Workspace Story state across DNA and Mental Model views', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    const { menu } = openMoreControls();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Open repository story/i }));
    fireEvent.click(screen.getByRole('button', { name: /Knowledge and docs/i }));
    expect(screen.getByRole('tab', { name: /Story/i })).toHaveAttribute('aria-selected', 'true');
    const reopened = openMoreControls();
    fireEvent.click(within(reopened.menu).getByRole('menuitem', { name: /Repository DNA/i }));
    expect(screen.getByText(/Current and potential workspace dimensions/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Mental Model/i }));
    expect(screen.getByText(/Semantic relationships use the existing repository model/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Story/i }));
    expect(screen.getByRole('button', { name: /Knowledge and docs/i })).toBeInTheDocument();
  });

  it('settles the cinematic reveal once and does not restart it after chapter navigation', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-animate-in', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Settle Universe reveal/i }));
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-animate-in', 'false');

    switchResultChapter('Improve');
    switchResultChapter('Understand');

    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-animate-in', 'false');
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

    expect(screen.getByLabelText(/Selected entity inspector/i)).toBeInTheDocument();
    expect(screen.getAllByText('README.md').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /Evidence/i })).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: /Explore the repository universe/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toBeInTheDocument();
    switchResultChapter('Deliver');
    fireEvent.click(await screen.findByRole('button', { name: /Open Client handoff/i }, { timeout: 10000 }));
    expect(await screen.findByRole('heading', { name: /Reports and Delivery Outputs/i }, { timeout: 10000 })).toBeInTheDocument();
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
    fireEvent.click(screen.getByTestId('atlas-node-concept:documentation'));
    expect(screen.getByTestId('atlas-node-concept:documentation')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Close inspector/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('atlas-node-memory:projectMemory:agents.md'));
    expect(screen.getByRole('heading', { name: /AGENTS.md/i })).toBeInTheDocument();
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

    openMoreControls();
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset view/i }));
    expect(screen.getByLabelText(/Search repository atlas/i)).toHaveValue('');
    expect(screen.getByTestId('atlas-node-file:documentation:readme.md')).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
  });
});

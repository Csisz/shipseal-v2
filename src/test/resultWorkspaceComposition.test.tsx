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

describe('Result Workspace composition', () => {
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
    await screen.findByText('Delivery Pack preview mock', {}, { timeout: 10000 });
    expect(screen.getAllByText('Full ShipSeal package').length).toBeGreaterThan(0);
    expect(screen.getByText(`${resolveDeliveryPackFocus(['full-package'], { folderAgentPaths }).generatedPaths.length} outputs`)).toBeInTheDocument();
    expect(screen.queryByText('Full Delivery Pack: 36 required outputs')).not.toBeInTheDocument();
    expect(screen.getByText(/Everything ShipSeal can generate/i)).toBeInTheDocument();
    expect(screen.getByText(/Specialist and technical exports/i)).toBeInTheDocument();
    switchResultChapter('Improve');
    expect(await screen.findByText(/Secondary repository improvements/i)).toBeInTheDocument();
  });

  it('mounts chapters on first visit, retains them, and prepares Repository Universe immediately', async () => {
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

    render(<ResultDashboard report={buildSampleReport()} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: /How this repository works/i }, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Deliver what ShipSeal learned/i })).not.toBeInTheDocument();
    await screen.findByRole('img', { name: /Repository Universe 3D graph/i }, { timeout: 10000 });
    expect(new Set(universeMockState.models).size).toBe(1);

    switchResultChapter('Deliver');
    const deliverHeading = await screen.findByRole('heading', { name: /Deliver what ShipSeal learned/i }, { timeout: 10000 });
    expect(deliverHeading).toBeVisible();
    switchResultChapter('Understand');
    expect(deliverHeading).not.toBeVisible();
    expect(new Set(universeMockState.models).size).toBe(1);
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
    expect(screen.getByRole('heading', { name: /Review ShipSeal improvements/i })).toBeInTheDocument();
    expect(screen.getByText(/Preview what ShipSeal can prepare/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prepare optimization package/i })).toBeInTheDocument();
    const improveStage = screen.getByTestId('repository-universe-workspace-stage');
    const improveSupportingContent = screen.getByTestId('improve-supporting-content');
    expect(improveStage.compareDocumentPosition(improveSupportingContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(improveSupportingContent).toContainElement(screen.getByRole('heading', { name: /Review ShipSeal improvements/i }));
    expect(improveSupportingContent).toContainElement(screen.getByRole('button', { name: /Prepare optimization package/i }));
    expect(screen.getAllByRole('heading', { name: /Review ShipSeal improvements/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Prepare optimization package/i })).toHaveLength(1);

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
    expect(screen.getByRole('heading', { name: /Selected entity/i })).toBeInTheDocument();

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

  it('makes visual understanding the primary dashboard summary and keeps Repository Health secondary', async () => {
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

    expect(screen.getByRole('heading', { name: /Repository understood/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Explore the repository universe/i })).toBeInTheDocument();
    const universe = await screen.findByRole('img', { name: /Repository Universe 3D graph/i });
    expect(universe).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Repository overview/i })).toBeInTheDocument();
    expect(screen.getByText(/ShipSeal mapped the scan boundary/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What ShipSeal understood/i })).toBeInTheDocument();
    expect(screen.getByText(/Workspace story and evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Repository models and metrics/i)).toBeInTheDocument();

    openDisclosure(/Repository models and metrics/i);
    expect(screen.getByRole('heading', { name: /How ShipSeal understands this repository/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Mental Model semantic repository graph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Architecture: .* signal/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /AI Instructions: .* signal/i }));
    expect(screen.getByRole('heading', { name: /AI Instructions/i })).toBeInTheDocument();
    expect(screen.getAllByText('Connections').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repository DNA').length).toBeGreaterThan(0);
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
    openDisclosure(/Supporting workspace views/i);
    expect(screen.getByText('Workspace Overview')).toBeInTheDocument();
    expect(screen.getByText('Repository as an AI workspace')).toBeInTheDocument();
    expect(screen.getByText(`${report.repositoryHealth.overall.score} / 100`)).toBeInTheDocument();
    expect(screen.getByText(report.repositoryHealth.overall.status)).toBeInTheDocument();
    expect(screen.getAllByText(`${report.repositoryHealth.overall.confidence} confidence`).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repository Friction').length).toBeGreaterThan(0);
    expect(screen.getByText('Live Agent Simulator')).toBeInTheDocument();
    expect(screen.queryByText('Agent Heatmap')).not.toBeInTheDocument();
    expect(screen.queryByText('Context Timeline')).not.toBeInTheDocument();
    expect(screen.getAllByText('AI Development Readiness').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent Routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delivery Confidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText(topAction.title).length).toBeGreaterThan(0);
  }, 20_000);

  it('syncs Workspace Story chapters across Mental Model, Repository DNA and simulator steps', () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    openDisclosure(/Workspace story and evidence/i);
    openDisclosure(/Repository models and metrics/i);
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

    expect(screen.getByRole('heading', { name: /Explore the repository universe/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toBeInTheDocument();
    switchResultChapter('Deliver');
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

    openDisclosure(/Workspace story and evidence/i);
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

    openMoreControls();
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset view/i }));
    expect(screen.getByLabelText(/Search repository atlas/i)).toHaveValue('');
    expect(screen.getByTestId('atlas-node-file:documentation:readme.md')).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
  });
});

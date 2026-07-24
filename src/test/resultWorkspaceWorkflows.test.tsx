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

describe('Result Workspace improvement and verification workflows', () => {
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

  it('keeps the Repository Universe model stable across selection, filters, search and zoom', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    const universe = await screen.findByRole('img', { name: /Repository Universe 3D graph/i });
    const initialModel = universeMockState.models.at(-1);
    const initialNodeCount = universe.getAttribute('data-node-count');
    const initialEdgeCount = universe.getAttribute('data-edge-count');
    const initialVisibleCount = Number(universe.getAttribute('data-visible-node-count'));
    const initialRadius = Number(universe.getAttribute('data-camera-radius'));
    const initialTarget = universe.getAttribute('data-camera-target');
    const initialSelectedNode = universe.getAttribute('data-selected-node');

    fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
    const afterSelection = await screen.findByRole('img', { name: /Repository Universe 3D graph/i });
    await waitFor(() => expect(afterSelection).not.toHaveAttribute('data-selected-node', initialSelectedNode || ''));
    expect(afterSelection).toHaveAttribute('data-node-count', initialNodeCount || '');
    expect(afterSelection).toHaveAttribute('data-edge-count', initialEdgeCount || '');
    expect(afterSelection).toHaveAttribute('data-visible-node-count', String(initialVisibleCount));
    expect(Number(afterSelection.getAttribute('data-camera-radius'))).toBeLessThanOrEqual(initialRadius);
    expect(afterSelection).not.toHaveAttribute('data-camera-target', initialTarget || '');
    const firstFocusTarget = afterSelection.getAttribute('data-camera-target');
    expect(afterSelection.getAttribute('data-focus-request')).toMatch(/^1:/);
    expect(within(screen.getByRole('navigation', { name: /Result chapters/i })).getByRole('button', { name: /Understand/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Repository Universe could not be rendered/i)).not.toBeInTheDocument();
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    const afterFilesFilter = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    expect(Number(afterFilesFilter.getAttribute('data-visible-node-count'))).toBeLessThan(initialVisibleCount);
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.change(screen.getByLabelText(/Search repository atlas or universe/i), { target: { value: 'README' } });
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
    expect(screen.getByLabelText(/Search repository atlas or universe/i)).toHaveValue('README');
    expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(screen.getByRole('navigation', { name: /Result chapters/i })).getByRole('button', { name: /Understand/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-node-count', initialNodeCount || '');
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-edge-count', initialEdgeCount || '');
    expect(screen.queryByText(/Repository Universe could not be rendered/i)).not.toBeInTheDocument();
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    openMoreControls();
    fireEvent.click(screen.getByRole('menuitem', { name: /Zoom in/i }));
    await waitFor(() => expect(Number(screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-camera-radius'))).toBeLessThan(initialRadius));
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-camera-target', firstFocusTarget || '');
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.click(screen.getByRole('button', { name: /Select second universe node/i }));
    const secondFocus = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    expect(secondFocus).not.toHaveAttribute('data-camera-target', firstFocusTarget || '');
    expect(secondFocus.getAttribute('data-focus-request')).toMatch(/^3:/);

    openMoreControls();
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset view/i }));
    const resetUniverse = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    expect(resetUniverse).toHaveAttribute('data-camera-radius', String(initialRadius));
    expect(resetUniverse).toHaveAttribute('data-camera-target', initialTarget || '');
  });

  it('renders Agent Flight Path in Understand and generates an evidence-bound route', async () => {
    const report = optimizationDashboardReportWithFiles([
      'README.md',
      'AGENTS.md',
      'package.json',
      'src/components/PricingPanel.tsx',
      'src/styles/theme.css',
      'src/lib/pdfExport.ts',
      'src/lib/reportExport.ts',
      'src/__tests__/pricing.test.tsx',
    ], 'flight-path-dashboard');
    render(<ResultDashboard report={report} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);

    expect(screen.getByRole('region', { name: /Agent Flight Path/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Describe what your AI agent should do/i), { target: { value: 'Fix the mobile pricing layout' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate flight path/i }));

    const panel = screen.getByRole('region', { name: /Agent Flight Path/i });
    expect(within(panel).getAllByText(/UI or layout work/i).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/src\/components\/PricingPanel\.tsx/i).length).toBeGreaterThan(0);
    expect(within(panel).getByRole('button', { name: /Copy prompt/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('repository-universe-canvas')).toBeInTheDocument());
    expect(Number(screen.getByTestId('repository-universe-canvas').getAttribute('data-route-node-count'))).toBeGreaterThan(0);
    expect(within(panel).queryByText(/guaranteed correct route|will fix the issue|productivity guaranteed/i)).not.toBeInTheDocument();
  });

  it('shows payment review gates without inventing Stripe files', () => {
    const report = optimizationDashboardReportWithFiles([
      'README.md',
      'AGENTS.md',
      'package.json',
      'src/api/billing.ts',
      'src/components/CheckoutPanel.tsx',
      'src/__tests__/billing.test.ts',
    ], 'billing-dashboard');
    render(<ResultDashboard report={report} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Describe what your AI agent should do/i), { target: { value: 'Add Stripe billing' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate flight path/i }));

    const panel = screen.getByRole('region', { name: /Agent Flight Path/i });
    expect(within(panel).getAllByText(/Payment and billing review/i).length).toBeGreaterThan(0);
    expect(within(panel).queryByText(/src\/stripe\.ts/i)).not.toBeInTheDocument();
  });

  it('shows low-confidence guidance for vague tasks and preserves the route across chapters', () => {
    const report = optimizationDashboardReport();
    render(<ResultDashboard report={report} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Describe what your AI agent should do/i), { target: { value: 'make it better' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate flight path/i }));

    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Clarify the task for a sharper route/i)).toBeInTheDocument();

    switchResultChapter('Improve');
    expect(screen.getByRole('button', { name: /Prepare optimization package/i })).toBeInTheDocument();
    switchResultChapter('Deliver');
    expect(screen.getByRole('heading', { name: /Deliver what ShipSeal learned/i })).toBeInTheDocument();
    switchResultChapter('Verify');
    expect(screen.getByText(/Verify after rescan/i)).toBeInTheDocument();
    switchResultChapter('Understand');
    expect(screen.getByText(/Clarify the task for a sharper route/i)).toBeInTheDocument();
    expect(screen.getByTestId('repository-universe-canvas')).toBeInTheDocument();
  });

  it('copies the generated agent prompt when clipboard is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const report = optimizationDashboardReportWithFiles([
      'README.md',
      'AGENTS.md',
      'package.json',
      'src/lib/pdfExport.ts',
      'src/lib/reportExport.ts',
      'src/__tests__/pdfExport.test.ts',
    ], 'prompt-dashboard');
    render(<ResultDashboard report={report} history={[]} onReset={vi.fn()} onClearHistory={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Describe what your AI agent should do/i), { target: { value: 'Improve PDF export' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate flight path/i }));
    fireEvent.click(screen.getByRole('button', { name: /Copy prompt/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Task: Improve PDF export')));
    expect(writeText.mock.calls[0][0]).toContain('Do not commit or push unless explicitly requested.');
  });

  it('previews With ShipSeal proposals and preserves review state without changing the current graph', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
      />
    );

    const universe = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    const currentNodeCount = universe.getAttribute('data-node-count');
    switchResultChapter('Improve');
    fireEvent.click(screen.getByRole('button', { name: /With ShipSeal/i }));
    expect(screen.getByText(/proposed artifacts/i)).toBeInTheDocument();
    expect(screen.getByText(/proposed improvements selected/i)).toBeInTheDocument();

    switchToAtlas2D();
    const proposedButtons = await screen.findAllByRole('button', { name: /Proposed With ShipSeal entity/i });
    fireEvent.click(proposedButtons[0]);
    expect(screen.getByText(/Proposed - not yet applied/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove from plan/i }));
    expect(screen.getByRole('button', { name: /Add to optimization plan/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Universe 3D/i }));
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i }).getAttribute('data-node-count')).toBe(currentNodeCount);
    expect(screen.getByText(/proposed improvements selected/i)).toBeInTheDocument();
  });

  it('docks one stateful Improve comparison surface inside the Universe stage', () => {
    render(
      <ResultDashboard
        report={optimizationDashboardReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
      />
    );

    expect(screen.queryByTestId('improve-universe-control-dock')).not.toBeInTheDocument();
    switchResultChapter('Improve');

    const stage = screen.getByTestId('repository-universe-workspace-stage');
    const dock = screen.getByTestId('improve-universe-control-dock');
    expect(stage).toContainElement(dock);
    expect(screen.getAllByTestId('improve-universe-control-dock')).toHaveLength(1);
    expect(within(dock).getByRole('heading', { name: /Improve the repository universe/i })).toBeInTheDocument();

    const current = within(dock).getByRole('button', { name: 'Current' });
    const withShipSeal = within(dock).getByRole('button', { name: 'With ShipSeal' });
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(withShipSeal).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(withShipSeal);
    expect(withShipSeal).toHaveAttribute('aria-pressed', 'true');
    expect(within(dock).getByText(/With ShipSeal · All improvements/i)).toBeInTheDocument();

    const projectMemory = within(dock).getByRole('button', { name: /Project Memory/i });
    const agentRouting = within(dock).getByRole('button', { name: /Agent Routing/i });
    const verificationPath = within(dock).getByRole('button', { name: /Verification Path/i });
    expect(within(dock).getByRole('button', { name: /All improvements/i })).toHaveAttribute('aria-pressed', 'true');
    expect(agentRouting).toBeInTheDocument();
    expect(verificationPath).toBeInTheDocument();

    fireEvent.click(projectMemory);
    expect(projectMemory).toHaveAttribute('aria-pressed', 'true');
    expect(within(dock).getByText(/With ShipSeal · Project Memory/i)).toBeInTheDocument();

    switchResultChapter('Understand');
    expect(screen.queryByTestId('improve-universe-control-dock')).not.toBeInTheDocument();
    switchResultChapter('Improve');
    expect(screen.getByTestId('repository-universe-workspace-stage')).toContainElement(screen.getByTestId('improve-universe-control-dock'));
    expect(screen.getByRole('button', { name: 'With ShipSeal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Project Memory/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the Optimization Plan and updates it from proposal include state without losing it across view switches', async () => {
    const report = optimizationDashboardReport();
    const { universe, atlas, transformation, plan } = optimizationPlanFor(report);
    const firstItem = plan.items[0];
    const firstProposalId = firstItem.proposalIds[0];
    const excludedPlan = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation,
      excludedProposalIds: [firstProposalId],
    });

    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
      />
    );

    switchResultChapter('Improve');
    fireEvent.click(screen.getByRole('button', { name: /With ShipSeal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Review optimization plan/i }));

    expect(screen.getByRole('heading', { name: /Review generator-backed artifacts/i })).toBeInTheDocument();
    expect(screen.getByText(`${plan.summary.selectedProposalCount.toLocaleString()} selected proposals`)).toBeInTheDocument();
    expect(screen.getByText(`${plan.summary.artifactCount.toLocaleString()} unique artifacts`)).toBeInTheDocument();
    expect(screen.getAllByText(/Ready for package|Review required|Blocked/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Create|Update|Strengthen/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstItem.artifact.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    expect(screen.getByText(firstItem.artifact.generatorId)).toBeInTheDocument();
    expect(screen.getByText(/Contributing proposals/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Remove from plan/i })[0]);
    expect(screen.getByText(`${excludedPlan.summary.selectedProposalCount.toLocaleString()} selected proposals`)).toBeInTheDocument();

    const applyFlow = screen.getByLabelText(/Optimization Apply Flow/i);
    expect(within(applyFlow).getAllByText(/Optimization Pack ZIP/i).length).toBeGreaterThan(0);
    expect(within(applyFlow).getByText(/GitHub PR Preview/i)).toBeInTheDocument();
    expect(within(applyFlow).getByText(/Manual fallback/i)).toBeInTheDocument();
    expect(within(applyFlow).getByText(/APPLY_INSTRUCTIONS.md/i)).toBeInTheDocument();
    expect(within(applyFlow).queryByText(/\bApplied\b|\bVerified\b/i)).not.toBeInTheDocument();

    fireEvent.click(within(applyFlow).getByRole('button', { name: /Download Optimization Pack/i }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(await within(applyFlow).findByText(/Package downloaded/i)).toBeInTheDocument();

    expect(screen.getByText(/Manifest and apply instructions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ShipSeal Delivery Pack/i).length).toBeGreaterThan(0);

    switchToAtlas2D();
    const proposedButtons = await screen.findAllByRole('button', { name: /Proposed With ShipSeal entity/i });
    fireEvent.click(proposedButtons[0]);
    expect(screen.getAllByRole('button', { name: /Add to optimization plan|Remove from plan/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Current' })[0]);
    expect(screen.getByRole('heading', { name: /Review generator-backed artifacts/i })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'With ShipSeal' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Universe 3D/i }));
    expect(screen.getByRole('heading', { name: /Review generator-backed artifacts/i })).toBeInTheDocument();
  }, 20000);

  it('previews and creates an Optimization Pack PR only after explicit GitHub App confirmation', async () => {
    const report = optimizationDashboardReport();
    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
        githubConnection={{
          connectionStatus: 'connected',
          sourceMode: 'github-app',
          owner: 'Csisz',
          repo: 'shipseal-v2',
          defaultBranch: 'main',
          installationId: 'installation-123',
          canCreatePullRequest: true,
          canListRepositories: true,
        }}
      />
    );

    switchResultChapter('Improve');
    fireEvent.click(screen.getByRole('button', { name: /With ShipSeal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Review optimization plan/i }));

    const applyFlow = screen.getByLabelText(/Optimization Apply Flow/i);
    expect(within(applyFlow).getAllByText(/^Available$/i).length).toBeGreaterThan(0);
    expect(within(applyFlow).getByText('shipseal/optimization-pack')).toBeInTheDocument();
    expect(within(applyFlow).getByRole('button', { name: /Create GitHub PR/i })).toBeDisabled();
    expect(githubWriteMock.createGitHubAppReadinessPr).not.toHaveBeenCalled();

    fireEvent.click(within(applyFlow).getByRole('checkbox'));
    fireEvent.click(within(applyFlow).getByRole('button', { name: /Create GitHub PR/i }));

    await waitFor(() => expect(githubWriteMock.createGitHubAppReadinessPr).toHaveBeenCalledTimes(1));
    const payload = githubWriteMock.createGitHubAppReadinessPr.mock.calls[0][0];
    expect(payload).toMatchObject({
      installationId: 'installation-123',
      owner: 'Csisz',
      repo: 'shipseal-v2',
      baseBranch: 'main',
      branchName: 'shipseal/optimization-pack',
      prTitle: 'Add ShipSeal optimization pack',
    });
    expect(payload.files.length).toBeGreaterThan(0);
    expect(payload.files.every((file: { path: string }) => !file.path.startsWith('ready/'))).toBe(true);
    expect(await within(applyFlow).findByText(/PR created/i)).toBeInTheDocument();
  });

  it('saves a verification baseline after Optimization Pack download and keeps verification truthful before rescan', async () => {
    const report = optimizationDashboardReport();
    const onSaveVerificationBaseline = vi.fn();

    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
        onSaveVerificationBaseline={onSaveVerificationBaseline}
      />
    );

    switchResultChapter('Improve');
    fireEvent.click(screen.getByRole('button', { name: /With ShipSeal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Review optimization plan/i }));
    const applyFlow = screen.getByLabelText(/Optimization Apply Flow/i);

    expect(within(applyFlow).getByText(/Rescan Verification/i)).toBeInTheDocument();
    expect(within(applyFlow).getByText(/Verification requires a later scan/i)).toBeInTheDocument();
    fireEvent.click(within(applyFlow).getByRole('button', { name: /Download Optimization Pack/i }));

    await waitFor(() => expect(onSaveVerificationBaseline).toHaveBeenCalledTimes(1));
    expect(onSaveVerificationBaseline.mock.calls[0][0]).toMatchObject({
      schemaVersion: 'shipseal.repository-verification-baseline.v1',
      applyMethod: 'zip-download',
    });
    expect(within(applyFlow).queryByText(/fixed|guaranteed improvement|verified improvement/i)).not.toBeInTheDocument();
  });

  it('shows after-rescan verification for a matching rescan without mutating the current graph', async () => {
    const baselineReport = optimizationDashboardReport();
    const { plan } = optimizationPlanFor(baselineReport);
    const baseline = buildRepositoryVerificationBaseline({
      report: baselineReport,
      applyPlan: buildOptimizationApplyPlan(plan),
      method: 'zip-download',
    });
    const currentReport = optimizationDashboardReportWithFiles([
      'README.md',
      'package.json',
      'src/App.tsx',
      'src/App.test.tsx',
      '.github/workflows/ci.yml',
      'AGENTS.md',
      '07-context/ARCHITECTURE.md',
    ]);

    render(
      <ResultDashboard
        report={currentReport}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
        verificationBaseline={baseline}
      />
    );

    switchResultChapter('Improve');
    const transformationMode = screen.getByLabelText(/Repository transformation preview mode/i);
    fireEvent.click(within(transformationMode).getByRole('button', { name: /After rescan/i }));
    expect(within(transformationMode).getByRole('button', { name: /After rescan/i })).toHaveAttribute('aria-pressed', 'true');
    const universe = screen.getByRole('img', { name: /Repository Universe 3D graph/i });
    const initialModel = universeMockState.models.at(-1);
    const initialNodeCount = universe.getAttribute('data-node-count');
    const initialEdgeCount = universe.getAttribute('data-edge-count');
    const initialSelectedNode = universe.getAttribute('data-selected-node');

    fireEvent.click(screen.getByRole('button', { name: /Select universe node/i }));
    await waitFor(() => expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).not.toHaveAttribute('data-selected-node', initialSelectedNode || ''));
    expect(within(transformationMode).getByRole('button', { name: /After rescan/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-node-count', initialNodeCount || '');
    expect(screen.getByRole('img', { name: /Repository Universe 3D graph/i })).toHaveAttribute('data-edge-count', initialEdgeCount || '');
    expect(screen.queryByText(/Repository Universe could not be rendered/i)).not.toBeInTheDocument();
    expect(universeMockState.models.at(-1)).toBe(initialModel);

    fireEvent.click(screen.getByRole('button', { name: /Review optimization plan/i }));
    const verification = screen.getByLabelText(/Rescan Verification/i);
    expect(within(verification).getAllByText(/^Detected after rescan$|^Content match verified$/i).length).toBeGreaterThan(0);
    expect(within(verification).getByText(/Projected before apply is separate/i)).toBeInTheDocument();
    expect(within(verification).getByText(/Observed workspace metrics/i)).toBeInTheDocument();
    expect(within(verification).queryByText(/fixed|guaranteed improvement|verified improvement/i)).not.toBeInTheDocument();
  });

  it('shows a calm mismatch state for a different repository baseline', async () => {
    const baselineReport = optimizationDashboardReport();
    const { plan } = optimizationPlanFor(baselineReport);
    const baseline = buildRepositoryVerificationBaseline({
      report: baselineReport,
      applyPlan: buildOptimizationApplyPlan(plan),
      method: 'zip-download',
    });
    const onDiscardVerificationBaseline = vi.fn();

    render(
      <ResultDashboard
        report={optimizationDashboardReportWithFiles(['README.md', 'package.json'], 'different-repository')}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        onReplayReveal={vi.fn()}
        verificationBaseline={baseline}
        onDiscardVerificationBaseline={onDiscardVerificationBaseline}
      />
    );

    switchResultChapter('Verify');
    const verification = await screen.findByLabelText(/Rescan Verification/i);
    expect(within(verification).getByText(/This scan does not match the saved optimization baseline/i)).toBeInTheDocument();
    fireEvent.click(within(verification).getByRole('button', { name: /Discard baseline/i }));
    expect(onDiscardVerificationBaseline).toHaveBeenCalledTimes(1);
  });
});

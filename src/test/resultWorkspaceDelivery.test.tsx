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

async function openDisclosureWhenReady(title: RegExp | string) {
  const summaries = await screen.findAllByText(title, {}, { timeout: 10000 });
  const summary = summaries.find(element => element.tagName.toLowerCase() === 'summary');
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

describe('Result Workspace evidence and delivery', () => {
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

      openDisclosure(/Supporting workspace views/i);
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

  it('keeps delivery readiness details, package controls, and export buttons available', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
    expect(screen.getAllByText('Exports and reports').length).toBeGreaterThan(0);
    expect(screen.getByText('Reports and Delivery Outputs')).toBeInTheDocument();
    expect(screen.getByText('Delivery readiness details')).toBeInTheDocument();
    expect(screen.getByText('Delivery readiness categories')).toBeInTheDocument();
    expect(screen.getByText('Category breakdown mock')).toBeInTheDocument();
    expect(await screen.findByText('Delivery Pack preview mock')).toBeInTheDocument();
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

  it('shows the selected goal package instead of always showing full pack', async () => {
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

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
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

  it('shows a selected agent operating mode for AI agent development outputs', async () => {
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

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
    expect(screen.getByText('Recommended operating mode')).toBeInTheDocument();
    expect(screen.getByText('Focused Context')).toBeInTheDocument();
    expect(screen.getAllByText('Lowest context use').length).toBeGreaterThan(0);
    expect(screen.getByText(/low-risk UI tweaks and short iterations/i)).toBeInTheDocument();
  });

  it('shows long selected package labels without combining them into the compact metric value', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['safety-risk']}
      />
    );

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
    expect(screen.getByText('Project package')).toBeInTheDocument();
    expect(screen.getByText('Security and data pre-screen')).toBeInTheDocument();
    expect(screen.getAllByText(`${resolveDeliveryPackFocus(['safety-risk']).generatedPaths.length} outputs`).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Security and data pre-screen - 8 outputs/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Env\/secrets signals, data\/privacy checklist, red-team prompts, and risk summary/i)).toBeInTheDocument();
  });

  it('uses package-specific almost-ready copy and separates readiness status from limited scan', async () => {
    render(
      <ResultDashboard
        report={{ ...buildSampleReport(), score: 52, blockers: [] }}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['safety-risk']}
      />
    );

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
    expect(screen.getAllByText('Partially Ready').length).toBeGreaterThan(0);
    expect(screen.getByText(/not a limited scan/i)).toBeInTheDocument();
    expect(screen.getByText(/strengthen security and data readiness/i)).toBeInTheDocument();
    expect(screen.queryByText('Almost there - improve a few areas to reach AI Coding Ready.')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Limited scan$/i)).not.toBeInTheDocument();
  });

  it('keeps AI agent development using AI coding readiness copy', async () => {
    render(
      <ResultDashboard
        report={{ ...buildSampleReport(), score: 70, blockers: [] }}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        selectedPackages={['agent-readiness']}
      />
    );

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
    expect(screen.getByText('Almost there - improve a few areas to reach AI Coding Ready.')).toBeInTheDocument();
  });

  it('shows skipped intake warning and regenerate action after intake edits', async () => {
    render(
      <ResultDashboard
        report={buildSampleReport()}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
        intakeSkipped
      />
    );

    switchResultChapter('Deliver');
    await openDisclosureWhenReady(/Exports and reports/i);
    expect(screen.getAllByText(/Client report quality is limited because project intake was skipped/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Project context used for Delivery Outputs')).toBeInTheDocument();
    expect(screen.getByText('Edit project context')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Acme Client' } });

    expect(screen.getByText(/Project context was edited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate report with updated intake/i })).toBeEnabled();
  });
});

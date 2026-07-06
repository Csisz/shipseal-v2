import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { createEmptyScanSummary } from '@/lib/scannerLimits';

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

import { ResultDashboard } from '@/components/agentready/ResultDashboard';

describe('ResultDashboard summary copy', () => {
  it('uses compact Delivery Pack summary text that does not truncate the old wording', () => {
    const report = buildSampleReport();
    const folderAgentPaths = getFolderAgentSuggestionPaths(report.repoContextPack);
    render(
      <ResultDashboard
        report={report}
        history={[]}
        onReset={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );

    expect(screen.getAllByText('Full ShipSeal package').length).toBeGreaterThan(0);
    expect(screen.getByText(`${resolveDeliveryPackFocus(['full-package'], { folderAgentPaths }).generatedPaths.length} outputs`)).toBeInTheDocument();
    expect(screen.queryByText('Full Delivery Pack: 36 required outputs')).not.toBeInTheDocument();
    expect(screen.getByText(/Everything ShipSeal can generate/i)).toBeInTheDocument();
    expect(screen.getByText(/Advanced details/i)).toBeInTheDocument();
    expect(screen.getByText(/Available ShipSeal improvements/i)).toBeInTheDocument();
  });

  it('makes Workspace Quality the primary dashboard summary and keeps Repository Health secondary', () => {
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

    expect(screen.getByRole('heading', { name: /This repository has a usable AI workspace forming/i })).toBeInTheDocument();
    expect(screen.getAllByText('Repository Intelligence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repository DNA').length).toBeGreaterThan(0);
    expect(screen.getByText(/ShipSeal connected the project shape/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /AI workspace profile/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Repository DNA radar profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Documentation:/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Context Efficiency:/i }));
    expect(screen.getByRole('heading', { name: /Context Efficiency/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Potential/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Evidence').length).toBeGreaterThan(0);
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText(/Signals and missing pieces/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mental model built/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Architecture appears modular/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Documentation connected/i).length).toBeGreaterThan(0);
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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';

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
    expect(screen.getByText(/Advanced details — full scan results and generated files/i)).toBeInTheDocument();
    expect(screen.getByText(/Improve your score — optional fixes you can add back/i)).toBeInTheDocument();
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
    expect(screen.getByText(`${resolveDeliveryPackFocus(['agent-readiness'], { folderAgentPaths }).generatedPaths.length} outputs`)).toBeInTheDocument();
    expect(screen.getByText(/Context Compression Pack generated/i)).toBeInTheDocument();
    expect(screen.getByText(/Folder-level AGENTS suggestions generated/i)).toBeInTheDocument();
    expect(screen.getByText('Recommended operating mode')).toBeInTheDocument();
    expect(screen.getByText('Balanced Productivity')).toBeInTheDocument();
    expect(screen.getAllByText('Balanced token usage').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recommended default').length).toBeGreaterThan(0);
    expect(screen.queryByText('Full ShipSeal package')).not.toBeInTheDocument();
    expect(screen.getByText(/AGENTS.md, CLAUDE.md, Codex guidance, repo context, agent safety notes, and tooling recommendations/i)).toBeInTheDocument();
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
    expect(screen.getByText('Token Saver')).toBeInTheDocument();
    expect(screen.getAllByText('Lowest token cost').length).toBeGreaterThan(0);
    expect(screen.getByText(/vibe coding, UI tweaks, Plus\/Pro limits, and short iterations/i)).toBeInTheDocument();
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
    expect(screen.getByText('7 outputs')).toBeInTheDocument();
    expect(screen.queryByText(/Security and data pre-screen - 6 outputs/i)).not.toBeInTheDocument();
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
    expect(screen.getByText('Project context used for this report')).toBeInTheDocument();
    expect(screen.getByText('Edit project context')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Acme Client' } });

    expect(screen.getByText(/Project context was edited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate report with updated intake/i })).toBeEnabled();
  });
});

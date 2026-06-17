import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeliveryPackPreview } from '@/components/agentready/DeliveryPackPreview';
import { buildSampleReport } from '@/lib/readiness';
import { createDefaultProjectIntake } from '@/lib/intake';

describe('DeliveryPackPreview', () => {
  it('renders the main preview information and export action', () => {
    const report = buildSampleReport();
    const intake = {
      ...createDefaultProjectIntake(report.repoName),
      usedInEU: true,
      generatesUserFacingContent: true,
      handlesPersonalData: true,
    };

    render(<DeliveryPackPreview report={report} intake={intake} />);

    expect(screen.getByText('ShipSeal Delivery Pack preview')).toBeInTheDocument();
    expect(screen.getByText('ShipSeal score')).toBeInTheDocument();
    expect(screen.getByText(`${report.score}/100`)).toBeInTheDocument();
    expect(screen.getByText('Go/no-go category')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download pdf report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open html report/i })).toBeInTheDocument();
    expect(screen.getByText(/PDF uses the standalone client report/i)).toBeInTheDocument();
    expect(screen.getByText(/Print \/ Save as PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Client report quality improves when project intake fields are completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download shipseal delivery pack/i })).toBeInTheDocument();
    expect(screen.getByText('AI Act readiness')).toBeInTheDocument();
    expect(screen.getByText('Testing pack')).toBeInTheDocument();
    expect(screen.getByText('Client handoff')).toBeInTheDocument();
    expect(screen.getByText('Delivery focus')).toBeInTheDocument();
    expect(screen.getByText('Full ShipSeal package')).toBeInTheDocument();
    expect(screen.getByText('01-agent-instructions/AGENTS.md')).toBeInTheDocument();
    expect(screen.getByText('06-client-handoff/CLIENT_HANDOFF_REPORT.md')).toBeInTheDocument();
    expect(screen.getByText('06-client-handoff/CLIENT_HANDOFF_REPORT.html')).toBeInTheDocument();
  });

  it('highlights selected goal outputs while keeping the complete pack visible', () => {
    const report = buildSampleReport();

    render(
      <DeliveryPackPreview
        report={report}
        intake={createDefaultProjectIntake(report.repoName)}
        selectedPackages={['testing-red-team']}
      />
    );

    expect(screen.getByText('Create tests and red-team prompts')).toBeInTheDocument();
    expect(screen.getByText(/outputs are highlighted first for this goal/i)).toBeInTheDocument();
    expect(screen.getAllByText('Focus').length).toBeGreaterThan(0);
    expect(screen.getByText('04-testing/RED_TEAM_PROMPTS.md')).toBeInTheDocument();
    expect(screen.getByText('06-client-handoff/CLIENT_HANDOFF_REPORT.md')).toBeInTheDocument();
  });

  it('shows report quality warning when intake was skipped', () => {
    const report = buildSampleReport();

    render(<DeliveryPackPreview report={report} intake={createDefaultProjectIntake(report.repoName)} intakeSkipped />);

    expect(screen.getByText(/Client report quality is limited because project intake was skipped/i)).toBeInTheDocument();
  });
});

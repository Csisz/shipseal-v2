import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Landing } from '@/components/agentready/Landing';

describe('ShipSeal landing', () => {
  it('renders the calm hero, outcome goals plus full package, steps, pricing, and no founder audit offer', () => {
    render(
      <Landing
        onSampleReport={vi.fn()}
        onScrollScan={vi.fn()}
        onPickPackage={vi.fn()}
        scanSlot={<div data-testid="scan-slot">scan input</div>}
      />
    );

    expect(screen.getByText(/Seal your AI project before you ship it/i)).toBeInTheDocument();
    expect(screen.getByText(/easier-to-handoff delivery pack/i)).toBeInTheDocument();
    // Upload / GitHub input is embedded directly in the hero.
    expect(screen.getByTestId('scan-slot')).toBeInTheDocument();

    // Outcome goals plus the distinct full package.
    expect(screen.getByText(/What do you want ShipSeal to help with\?/i)).toBeInTheDocument();
    expect(screen.getByText('Prepare for client handoff')).toBeInTheDocument();
    expect(screen.getByText('Prepare for launch or production')).toBeInTheDocument();
    expect(screen.getByText('Make it safer')).toBeInTheDocument();
    expect(screen.getByText('MCP readiness and tool integration')).toBeInTheDocument();
    expect(screen.getAllByText('Full ShipSeal package').length).toBeGreaterThan(0);

    // Guided trust-aware process.
    expect(screen.getByText('How ShipSeal works.')).toBeInTheDocument();
    expect(screen.getByText('Connect GitHub or upload ZIP')).toBeInTheDocument();
    expect(screen.getByText('ShipSeal performs static analysis')).toBeInTheDocument();
    expect(screen.getByText('Generate reports and delivery packs')).toBeInTheDocument();
    expect(screen.getByText('Optionally create a Readiness PR')).toBeInTheDocument();

    // File names stay behind the advanced-details disclosure, not in main cards.
    expect(screen.getByText(/Advanced details — explore the generated files/i)).toBeInTheDocument();

    // Demo-first sample paths.
    expect(screen.getByText(/Try ShipSeal without connecting GitHub/i)).toBeInTheDocument();
    expect(screen.queryByText('See a sample ShipSeal report')).not.toBeInTheDocument();
    expect(screen.getByText('View before/after readiness example')).toBeInTheDocument();
    expect(screen.getByText(/Scan evidence, readiness score, and next actions/i)).toBeInTheDocument();

    // Trust hints near the scan action.
    expect(screen.getByText(/Static scan only/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated\/vendor folders are ignored where possible/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub App permissions are used for repository access/i)).toBeInTheDocument();
    expect(screen.getByText('Clear scan boundaries.')).toBeInTheDocument();
    expect(screen.getByText('What ShipSeal reads')).toBeInTheDocument();
    expect(screen.getByText('What ShipSeal ignores')).toBeInTheDocument();
    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThan(0);
    expect(screen.getAllByText('node_modules').length).toBeGreaterThan(0);
    expect(screen.getByText(/ShipSeal does not merge PRs or push to your main branch/i)).toBeInTheDocument();
    expect(screen.getAllByText(/does not provide legal advice or compliance certification/i).length).toBeGreaterThan(0);

    // Simple pricing without payment integration.
    expect(screen.getByText('Free Demo')).toBeInTheDocument();
    expect(screen.getByText('Builder')).toBeInTheDocument();
    expect(screen.getByText('Pro / Agency')).toBeInTheDocument();
    expect(screen.getByText('Agent Efficiency Pro')).toBeInTheDocument();
    expect(screen.getByText('Context Packs')).toBeInTheDocument();
    expect(screen.getByText('Folder-level AGENTS')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Request access').length).toBeGreaterThan(0);
    expect(screen.queryByText(/founder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Human review option/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Expert Review Add-On/i)).not.toBeInTheDocument();

    // Non-persistent contact fallback.
    expect(screen.getByText('Contact ShipSeal.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact email')).toBeInTheDocument();
    expect(screen.getByLabelText('Company or agency')).toBeInTheDocument();
    expect(screen.getByLabelText('Project type')).toBeInTheDocument();
    expect(screen.getByLabelText('Selected interest')).toBeInTheDocument();
    expect(screen.getByText(/No backend delivery is configured in this demo/i)).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: /sample project/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Scan my project/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute('href', '/security');
  });

  it('preselects a package when a path card is clicked', () => {
    const onPickPackage = vi.fn();
    render(
      <Landing onSampleReport={vi.fn()} onScrollScan={vi.fn()} onPickPackage={onPickPackage} scanSlot={null} />
    );

    screen.getByRole('button', { name: /Prepare for client handoff/i }).click();

    expect(onPickPackage).toHaveBeenCalledWith('client-handoff');
  });

  it('prepares a mailto fallback instead of pretending to send contact form data', () => {
    render(
      <Landing onSampleReport={vi.fn()} onScrollScan={vi.fn()} onPickPackage={vi.fn()} scanSlot={null} />
    );

    fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Company or agency'), { target: { value: 'Ada Studio' } });
    fireEvent.change(screen.getByLabelText('Project type'), { target: { value: 'AI support app' } });
    fireEvent.change(screen.getByLabelText('Selected interest'), { target: { value: 'Security/data pre-screen' } });
    fireEvent.change(screen.getByLabelText('Contact message'), { target: { value: 'Please review our handoff readiness.' } });
    fireEvent.click(screen.getByRole('button', { name: /Prepare email draft/i }));

    expect(screen.getByText(/No message was sent to a server/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Open email draft/i });
    expect(link.getAttribute('href')).toContain('mailto:hello@shipseal.dev');
    expect(link.getAttribute('href')).toContain('Security%2Fdata%20pre-screen');
  });
});

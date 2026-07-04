import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Landing } from '@/components/agentready/Landing';

describe('ShipSeal landing', () => {
  it('renders the repository intelligence narrative, workflow, pricing, and no founder audit offer', () => {
    render(
      <Landing
        onSampleReport={vi.fn()}
        onScrollScan={vi.fn()}
        onPickPackage={vi.fn()}
        scanSlot={<div data-testid="scan-slot">scan input</div>}
      />
    );

    expect(screen.getByText(/Stop wasting AI context/i)).toBeInTheDocument();
    expect(screen.getByText(/prepares it for Claude Code, Codex, Cursor, Windsurf/i)).toBeInTheDocument();
    expect(screen.getByText(/Instead of rereading your entire codebase every session/i)).toBeInTheDocument();
    // Upload / GitHub input is embedded directly in the hero.
    expect(screen.getByTestId('scan-slot')).toBeInTheDocument();

    // Problem-first narrative before packages.
    expect(screen.getByText(/AI coding gets expensive when the repository has no memory/i)).toBeInTheDocument();
    expect(screen.getByText('Context waste')).toBeInTheDocument();
    expect(screen.getAllByText('Repository Intelligence').length).toBeGreaterThan(0);
    expect(screen.getByText('AI rereads the whole repository every session.')).toBeInTheDocument();
    expect(screen.getAllByText('Context Compression').length).toBeGreaterThan(0);
    expect(screen.getByText('AI edits the wrong files.')).toBeInTheDocument();
    expect(screen.getAllByText('Folder-level AGENTS').length).toBeGreaterThan(0);
    expect(screen.getByText(/missing layer between a Git repository and AI coding agents/i)).toBeInTheDocument();

    // Outcome goals plus the distinct full package remain available after the explanation.
    expect(screen.getByText(/Choose what to optimize first/i)).toBeInTheDocument();
    expect(screen.getByText('Build with AI')).toBeInTheDocument();
    expect(screen.getByText('Ship to Client')).toBeInTheDocument();
    expect(screen.getByText('Production Readiness')).toBeInTheDocument();
    expect(screen.getByText('Security Review')).toBeInTheDocument();
    expect(screen.getAllByText('Full Workspace Analysis').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Advanced goals').length).toBeGreaterThan(0);
    expect(screen.queryByText('MCP readiness and tool integration')).not.toBeInTheDocument();

    // Minimal workflow.
    expect(screen.getByText('How it works.')).toBeInTheDocument();
    expect(screen.getByText('Scan repository')).toBeInTheDocument();
    expect(screen.getByText('Generate Repository Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Optimize AI coding workflow')).toBeInTheDocument();
    expect(screen.getByText('Export delivery-ready documentation')).toBeInTheDocument();

    // Detailed outputs stay behind the advanced-details disclosure, not in main cards.
    expect(screen.getByText(/Advanced details - what Repository Intelligence can include/i)).toBeInTheDocument();

    // Demo-first sample paths.
    expect(screen.getByText(/See it on a sample repository/i)).toBeInTheDocument();
    expect(screen.queryByText('See a sample ShipSeal report')).not.toBeInTheDocument();
    expect(screen.getByText('View before/after context')).toBeInTheDocument();
    expect(screen.getByText(/Repository Intelligence, cleaner AI sessions, delivery-ready output/i)).toBeInTheDocument();

    // Trust hints near the scan action.
    expect(screen.getByText(/Static scan only/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimizes the repository, not the AI model/i)).toBeInTheDocument();
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
    expect(screen.getByText('AI Workspace Pro')).toBeInTheDocument();
    expect(screen.getByText('Agency / White-label')).toBeInTheDocument();
    expect(screen.getByText('Optimize one repository.')).toBeInTheDocument();
    expect(screen.getByText('Optimize your AI development workflow.')).toBeInTheDocument();
    expect(screen.getByText('Optimize AI development across multiple repositories.')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Request access').length).toBeGreaterThan(0);
    expect(screen.queryByText(/founder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Human review option/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Expert Review Add-On/i)).not.toBeInTheDocument();

    // Non-persistent contact fallback.
    expect(screen.getByText('Bring ShipSeal into your workflow.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact email')).toBeInTheDocument();
    expect(screen.getByLabelText('Company or agency')).toBeInTheDocument();
    expect(screen.getByLabelText('Project type')).toBeInTheDocument();
    expect(screen.getByLabelText('Selected interest')).toBeInTheDocument();
    expect(screen.getByText(/No backend delivery is configured in this demo/i)).toBeInTheDocument();

    expect(screen.getAllByText(/sample project/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scan my repository/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Privacy').closest('a')).toHaveAttribute('href', '/privacy');
    expect(screen.getByText('Security').closest('a')).toHaveAttribute('href', '/security');
  });

  it('preselects a package when a path card is clicked', () => {
    const onPickPackage = vi.fn();
    render(
      <Landing onSampleReport={vi.fn()} onScrollScan={vi.fn()} onPickPackage={onPickPackage} scanSlot={null} />
    );

    screen.getByRole('button', { name: /Ship to Client/i }).click();

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

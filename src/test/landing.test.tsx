import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Full ShipSeal package')).toBeInTheDocument();

    // Guided three-step process.
    expect(screen.getByText('Upload your project')).toBeInTheDocument();
    expect(screen.getByText('Choose your goal')).toBeInTheDocument();
    expect(screen.getByText('Download your ShipSeal pack')).toBeInTheDocument();

    // File names stay behind the advanced-details disclosure, not in main cards.
    expect(screen.getByText(/Advanced details — explore the generated files/i)).toBeInTheDocument();

    // Modular pricing without a human expert tier.
    expect(screen.getByText('Free Scan')).toBeInTheDocument();
    expect(screen.getByText('Individual Packs')).toBeInTheDocument();
    expect(screen.getByText('Full ShipSeal Package')).toBeInTheDocument();
    expect(screen.queryByText(/founder/i)).not.toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: /sample project/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Scan my project/i }).length).toBeGreaterThan(0);
  });

  it('preselects a package when a path card is clicked', () => {
    const onPickPackage = vi.fn();
    render(
      <Landing onSampleReport={vi.fn()} onScrollScan={vi.fn()} onPickPackage={onPickPackage} scanSlot={null} />
    );

    screen.getByRole('button', { name: /Prepare for client handoff/i }).click();

    expect(onPickPackage).toHaveBeenCalledWith('client-handoff');
  });
});

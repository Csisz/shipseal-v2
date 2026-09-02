import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Landing } from '@/components/agentready/Landing';

describe('ShipSeal landing', () => {
  it('keeps the first viewport focused and progressively reveals the full product story', () => {
    const { container } = render(
      <Landing
        onSampleReport={vi.fn()}
        onScrollScan={vi.fn()}
        onPickPackage={vi.fn()}
        scanSlot={<div data-testid="scan-slot">scan input</div>}
      />
    );

    const hero = container.querySelector<HTMLElement>('section#why');
    const source = container.querySelector<HTMLElement>('section#scan');
    expect(hero).not.toBeNull();
    expect(source).not.toBeNull();

    const heroView = within(hero!);
    expect(heroView.getByRole('heading', { name: 'Turn software into knowledge.' })).toBeInTheDocument();
    expect(heroView.getByText(/maps your repository, reveals agent friction/i)).toBeInTheDocument();
    expect(heroView.getAllByRole('button', { name: /Scan my repository/i })).toHaveLength(1);
    expect(heroView.getAllByRole('button', { name: /Try a sample/i })).toHaveLength(1);
    expect(heroView.getByTestId('landing-signature-visual')).toHaveAttribute(
      'aria-label',
      'Repository signals become connected workspace knowledge'
    );
    expect(heroView.getByLabelText('ShipSeal trust boundaries').children).toHaveLength(3);
    expect(heroView.queryByTestId('scan-slot')).not.toBeInTheDocument();

    expect(within(source!).getByRole('heading', { name: /Choose the source you trust/i })).toBeInTheDocument();
    expect(within(source!).getByTestId('scan-slot')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /From scattered signals to an operating map/i })).toBeInTheDocument();
    expect(screen.getByText('Understand')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByText('Verify and deliver')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Repository understanding in three steps/i })).toBeInTheDocument();
    expect(screen.getByText('Choose a source')).toBeInTheDocument();
    expect(screen.getByText('Build intelligence')).toBeInTheDocument();
    expect(screen.getByText('Act with context')).toBeInTheDocument();

    expect(screen.getByText('Build with AI')).toBeInTheDocument();
    expect(screen.getByText('Ship to Client')).toBeInTheDocument();
    expect(screen.getByText('Production Readiness')).toBeInTheDocument();
    expect(screen.getByText('Security Review')).toBeInTheDocument();
    expect(screen.getByText('Full Workspace Analysis')).toBeInTheDocument();
    expect(screen.getByText('Advanced goals')).toBeInTheDocument();
    expect(screen.queryByText('MCP readiness and tool integration')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Never execute imported code/i })).toBeInTheDocument();
    expect(screen.getByText(/This is not legal advice or compliance certification/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByText('$19/month')).toBeInTheDocument();
    expect(screen.getByText('10 Deep Analyses per billing period')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to upgrade' })).toBeEnabled();
    expect(screen.queryByText(/founder/i)).not.toBeInTheDocument();

    expect(container.querySelectorAll('section').length).toBeLessThanOrEqual(8);
    expect(screen.getByText('Contact and commercial access')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contact name')).not.toBeInTheDocument();
    expect(screen.getByText('Privacy').closest('a')).toHaveAttribute('href', '/privacy');
    expect(screen.getAllByText('Terms').some(node => node.closest('a')?.getAttribute('href') === '/terms')).toBe(true);
    expect(screen.getByText('Security').closest('a')).toHaveAttribute('href', '/security');
    expect(screen.getAllByText('Trust').some(node => node.closest('a')?.getAttribute('href') === '/trust')).toBe(true);
    expect(screen.getByText(/Stripe processes payment information/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Contact and commercial access'));
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

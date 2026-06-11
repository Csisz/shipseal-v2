import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Landing } from '@/components/agentready/Landing';

describe('ShipSeal landing', () => {
  it('renders validation landing copy, generated outputs, and pilot pricing', () => {
    render(<Landing onSampleReport={vi.fn()} onScrollScan={vi.fn()} />);

    expect(screen.getAllByText(/ShipSeal/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Seal your AI project before you ship it/i)).toBeInTheDocument();
    expect(screen.getAllByText(/AI Act readiness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Client handoff report/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pilot pricing/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Try sample project/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Generate Delivery Pack/i }).length).toBeGreaterThan(0);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Nav } from '@/components/agentready/Nav';

describe('ShipSeal navigation', () => {
  it('renders landing anchors and scan CTA', () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Generates/i })).toHaveAttribute('href', '#generates');
    expect(screen.getByRole('link', { name: /For whom/i })).toHaveAttribute('href', '#who');
    expect(screen.getByRole('link', { name: /Pricing/i })).toHaveAttribute('href', '#pricing');
    expect(screen.getByRole('link', { name: /Disclaimer/i })).toHaveAttribute('href', '#disclaimer');
    expect(screen.getByRole('link', { name: /Scan your repo/i })).toHaveAttribute('href', '#scan');
    expect(screen.getByRole('link', { name: /ShipSeal home/i })).toHaveAttribute('href', '/');
  });

  it('calls anchor navigation callback when provided', () => {
    const onNavigateAnchor = vi.fn();
    render(
      <MemoryRouter>
        <Nav onNavigateAnchor={onNavigateAnchor} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: /Pricing/i }));

    expect(onNavigateAnchor).toHaveBeenCalledWith('#pricing');
  });

  it('calls home navigation callback when the logo is clicked', () => {
    const onHome = vi.fn();
    render(
      <MemoryRouter>
        <Nav onHome={onHome} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: /ShipSeal home/i }));

    expect(onHome).toHaveBeenCalledTimes(1);
  });
});

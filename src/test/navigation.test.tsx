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

    expect(screen.getByRole('link', { name: /Packages/i })).toHaveAttribute('href', '#packages');
    expect(screen.getByRole('link', { name: /How it works/i })).toHaveAttribute('href', '#how');
    expect(screen.getByRole('link', { name: /What you get/i })).toHaveAttribute('href', '#preview');
    expect(screen.getByRole('link', { name: /Pricing/i })).toHaveAttribute('href', '#pricing');
    expect(screen.getByRole('link', { name: /Contact/i })).toHaveAttribute('href', '#contact');
    expect(screen.getByRole('link', { name: /Scan my repository/i })).toHaveAttribute('href', '#scan');
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

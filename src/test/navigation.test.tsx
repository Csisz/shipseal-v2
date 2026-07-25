import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Nav } from '@/components/agentready/Nav';

describe('ShipSeal navigation', () => {
  it('renders landing anchors and scan CTA', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Nav />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /^Product$/i })).toHaveAttribute('href', '#intelligence');
    expect(screen.getByRole('link', { name: /How it works/i })).toHaveAttribute('href', '#how');
    expect(screen.getByRole('link', { name: /Pricing/i })).toHaveAttribute('href', '#pricing');
    expect(screen.getByRole('link', { name: /Scan my repository/i })).toHaveAttribute('href', '#scan');
    expect(screen.getByRole('link', { name: /My projects/i })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: /ShipSeal home/i })).toHaveAttribute('href', '/');
  });

  it('calls anchor navigation callback when provided', () => {
    const onNavigateAnchor = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Nav onNavigateAnchor={onNavigateAnchor} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: /Pricing/i }));

    expect(onNavigateAnchor).toHaveBeenCalledWith('#pricing');
  });

  it('calls home navigation callback when the logo is clicked', () => {
    const onHome = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Nav onHome={onHome} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: /ShipSeal home/i }));

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('supports a compact keyboard-dismissible mobile menu', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Nav />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /Open navigation menu/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('navigation', { name: /Mobile navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close navigation menu/i })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: /Mobile navigation/i })).not.toBeInTheDocument();
  });
});

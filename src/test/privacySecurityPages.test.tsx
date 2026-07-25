import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Privacy from '@/pages/Privacy';
import Security from '@/pages/Security';
import NotFound from '@/pages/NotFound';

describe('Trust pages', () => {
  it('renders the Privacy page with clear processing and control language', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Privacy />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Simple privacy boundaries/i })).toBeInTheDocument();
    expect(screen.getByText('Uploaded ZIPs')).toBeInTheDocument();
    expect(screen.getByText('GitHub repositories')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Short-lived processing')).toBeInTheDocument();
    expect(screen.getByText('User control')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to ShipSeal/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Appearance theme:/i })).toHaveLength(2);
  });

  it('renders the Security page with scan boundaries and GitHub permission language', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Security />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /What ShipSeal does, and does not do/i })).toBeInTheDocument();
    expect(screen.getByText('Code is never executed')).toBeInTheDocument();
    expect(screen.getByText('Static scan only')).toBeInTheDocument();
    expect(screen.getByText('What ShipSeal reads')).toBeInTheDocument();
    expect(screen.getByText('What ShipSeal ignores')).toBeInTheDocument();
    expect(screen.getByText('README')).toBeInTheDocument();
    expect(screen.getByText('node_modules')).toBeInTheDocument();
    expect(screen.getByText('GitHub App permissions')).toBeInTheDocument();
    expect(screen.getByText(/does not provide legal advice or compliance certification/i)).toBeInTheDocument();
  });

  it('keeps Not Found inside the shared shell with clear recovery', () => {
    render(
      <MemoryRouter initialEntries={['/missing']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /This route is not part of the map/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scan a repository/i })).toHaveAttribute('href', '/#scan');
    expect(screen.getAllByRole('link', { name: /My projects/i }).some(link => link.getAttribute('href') === '/projects')).toBe(true);
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Privacy from '@/pages/Privacy';
import Security from '@/pages/Security';
import Terms from '@/pages/Terms';
import Trust from '@/pages/Trust';
import GithubPermissions from '@/pages/GithubPermissions';
import NotFound from '@/pages/NotFound';

function renderPage(node: React.ReactNode, path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{node}</MemoryRouter>);
}

describe('Trust pages', () => {
  it('renders Privacy with the actual repository, AI, storage, retention, payment, and deletion boundaries', () => {
    renderPage(<Privacy />);
    expect(screen.getByRole('heading', { name: /Repository data, explained plainly/i })).toBeInTheDocument();
    expect(screen.getByText('Local ZIP sources')).toBeInTheDocument();
    expect(screen.getByText('Private project history')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Storage, cookies, and retention/i })).toBeInTheDocument();
    expect(screen.getByText(/no implemented analytics or marketing tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe hosts Checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/does not remove GitHub repositories/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to ShipSeal/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: /Trust and legal/i })).toBeInTheDocument();
  });

  it('renders factual Security controls and rejects certification theater', () => {
    renderPage(<Security />);
    expect(screen.getByRole('heading', { name: /Implemented boundaries/i })).toBeInTheDocument();
    expect(screen.getByText(/Imported repository code is not executed/i)).toBeInTheDocument();
    expect(screen.getByText('Static evidence commonly read')).toBeInTheDocument();
    expect(screen.getByText(/does not claim SOC 2 or ISO certification/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GitHub permissions explanation/i })).toHaveAttribute('href', '/trust/github');
    expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
  });

  it('publishes Trust, Terms, and a permission-by-permission GitHub explanation', () => {
    const trust = renderPage(<Trust />);
    expect(screen.getByRole('heading', { name: /Know what crosses each boundary/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review each permission/i })).toHaveAttribute('href', '/trust/github');
    trust.unmount();

    const terms = renderPage(<Terms />);
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(/Plain-language product terms/i)).toBeInTheDocument();
    expect(screen.getAllByText(/allowance correction is not a monetary subscription refund/i)).toHaveLength(2);
    terms.unmount();

    renderPage(<GithubPermissions />);
    expect(screen.getByRole('heading', { name: /Read for scanning/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Permission' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Contents · read/i })).toBeInTheDocument();
    expect(screen.getByText(/read:user/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub's installation screen is authoritative/i)).toBeInTheDocument();
  });

  it('keeps every public trust route directly addressable with page metadata', () => {
    renderPage(
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/security" element={<Security />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/trust/github" element={<GithubPermissions />} />
      </Routes>,
      '/trust/github',
    );
    expect(screen.getByRole('heading', { name: /Read for scanning/i })).toBeInTheDocument();
    expect(document.title).toBe('GitHub permissions · ShipSeal');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.getshipseal.com/trust/github');
  });

  it('keeps Not Found inside the shared shell with clear recovery', () => {
    renderPage(<NotFound />, '/missing');
    expect(screen.getByRole('heading', { name: /This route is not part of the map/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scan a repository/i })).toHaveAttribute('href', '/#scan');
    expect(screen.getAllByRole('link', { name: /My projects/i }).some(link => link.getAttribute('href') === '/projects')).toBe(true);
  });
});

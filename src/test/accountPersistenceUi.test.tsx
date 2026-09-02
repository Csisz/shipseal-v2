import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/components/account/AccountProvider';
import { SaveProjectControl } from '@/components/account/SaveProjectControl';
import { UploadDropzone } from '@/components/agentready/UploadDropzone';
import Projects from '@/pages/Projects';
import Project from '@/pages/Project';
import { buildSampleReport } from '@/lib/readiness';
import { PERSISTENCE_SCHEMA_VERSION } from '@/lib/persistence';

const user = { id: `usr_${'a'.repeat(24)}`, email: 'owner@example.test', displayName: 'Repository Owner', avatarUrl: null };
const project = {
  version: PERSISTENCE_SCHEMA_VERSION, id: `prj_${'b'.repeat(24)}`, sourceType: 'github-public' as const,
  repositoryOwner: 'Csisz', repositoryName: 'shipseal-v2', uploadLabel: null, defaultBranch: 'main',
  githubRepositoryId: null, githubInstallationId: null, displayName: 'shipseal-v2',
  createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z', lastScanAt: '2026-07-17T08:00:00.000Z',
  archived: false, latestScanStatus: 'completed' as const, latestIntelligenceMode: 'deterministic' as const, latestVerificationState: 'not-started' as const,
  scanCount: 1,
};
const scan = {
  version: PERSISTENCE_SCHEMA_VERSION, id: `scn_${'c'.repeat(24)}`, projectId: project.id, sourceType: 'github-public' as const,
  repositoryOwner: 'Csisz', repositoryName: 'shipseal-v2', branch: 'feature/a-very-long-mobile-branch-name', status: 'completed' as const,
  startedAt: '2026-07-17T08:00:00.000Z', completedAt: '2026-07-17T08:00:00.000Z', scannerVersion: 'shipseal-browser-scanner.v1',
  deterministicRequestFingerprint: 'a'.repeat(32), discoveredFiles: 372, analyzedFiles: 359, ignoredFiles: 13,
  intelligenceMode: 'deterministic' as const, verificationState: 'not-started' as const, baselineScanId: null, safeFailureCategory: null,
};

function json(body: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })); }

afterEach(() => { vi.restoreAllMocks(); });

describe('Omega 18.1 account and persistence UI', () => {
  it('keeps an anonymous scan open and requests sign-in only when private saving is chosen', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ user: null })));
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const report = buildSampleReport();
    render(<AccountProvider><SaveProjectControl report={report} /></AccountProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in to save' })).toBeEnabled());
    expect(screen.queryByText(/An account is needed only/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to save' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/api/account/login'), 'shipseal-account', expect.any(String));
    expect(screen.getByText(/This result remains open/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to save' })).toBeEnabled();
  });

  it('surfaces a recoverable popup configuration failure without closing the scan', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ user: null })));
    render(<AccountProvider><SaveProjectControl report={buildSampleReport()} /></AccountProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in to save' })).toBeEnabled());

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'shipseal-account', status: 'unavailable', message: 'Account sign-in is unavailable. Anonymous scanning remains available.' },
      }));
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Anonymous scanning remains available');
    expect(screen.getByRole('button', { name: 'Sign in to save' })).toBeEnabled();
  });

  it('keeps anonymous ZIP and public URL sources available when account auth is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ error: { code: 'unavailable', message: 'Account sign-in is unavailable.' } }, 503)));
    render(<AccountProvider><UploadDropzone onFile={vi.fn()} onGitHubImport={vi.fn()} /></AccountProvider>);

    await waitFor(() => expect(screen.getByRole('button', { name: /Public URL/i })).toBeEnabled());
    expect(screen.getByRole('button', { name: /Upload ZIP/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Public URL/i }));
    expect(screen.getByLabelText('Public GitHub repository URL')).toBeEnabled();
  });

  it('deduplicates authenticated autosave across StrictMode effects', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/account/session') return json({ user });
      if (url === '/api/projects' && init?.method === 'POST') return json({ project, scan }, 201);
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);

    render(<StrictMode><AccountProvider><SaveProjectControl report={buildSampleReport()} /></AccountProvider></StrictMode>);

    await waitFor(() => expect(screen.getByText('Saved privately')).toBeInTheDocument());
    expect(fetcher.mock.calls.filter(call => String(call[0]) === '/api/projects' && call[1]?.method === 'POST')).toHaveLength(1);
  });

  it('autosaves once for an authenticated user and exposes the private project context', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/account/session') return json({ user });
      if (url === '/api/projects' && init?.method === 'POST') return json({ project, scan }, 201);
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    const onPersisted = vi.fn();
    render(<AccountProvider><SaveProjectControl report={buildSampleReport()} onPersisted={onPersisted} /></AccountProvider>);
    await waitFor(() => expect(screen.getByText('Saved privately')).toBeInTheDocument());
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open project history' })).toHaveAttribute('href', `/projects/${project.id}`);
    expect(onPersisted).toHaveBeenCalledWith({ projectId: project.id, scanId: scan.id });
    const posts = fetcher.mock.calls.filter(call => String(call[0]) === '/api/projects' && call[1]?.method === 'POST');
    expect(posts).toHaveLength(1);
    const post = posts[0];
    expect(String(post?.[1]?.body)).not.toMatch(/github_pat_|API_KEY=|PRIVATE KEY/);
  });

  it('renders a calm project list and account deletion confirmation without a score dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input) === '/api/account/session' ? json({ user }) : json({ projects: [project] })));
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccountProvider><Projects /></AccountProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'My Projects' })).toBeInTheDocument();
    expect(await screen.findByText('Csisz/shipseal-v2')).toBeInTheDocument();
    expect(screen.getByText('1 scan')).toBeInTheDocument();
    expect(screen.getByText('Latest completed')).toBeInTheDocument();
    expect(screen.queryByText(/readiness score/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByRole('button', { name: 'Delete my ShipSeal account' })).toBeInTheDocument();
    expect(screen.getByText(/does not cancel or erase Stripe records/i)).toBeInTheDocument();
    expect(screen.getByText(/does not.*uninstall the GitHub App/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy page' })).toHaveAttribute('href', '/privacy');
  });

  it('shows immutable scan history, long branch metadata, and explicit scan/project deletion', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/account/session') return json({ user });
      if (url.startsWith(`/api/projects/${project.id}`)) return json({ project, scans: [scan] });
      return json({ ok: true });
    }));
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/projects/${project.id}`]}><AccountProvider><Routes><Route path="/projects/:projectId" element={<Project />} /></Routes></AccountProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Scan history' })).toBeInTheDocument();
    expect(screen.getByText('feature/a-very-long-mobile-branch-name')).toBeInTheDocument();
    expect(screen.getByText(/does not rescan, call a provider, or mutate GitHub/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verify from this baseline' })).toHaveAttribute('href', `/?projectId=${project.id}&baselineScanId=${scan.id}#scan`);
    fireEvent.click(screen.getByRole('button', { name: 'Delete scan' }));
    expect(screen.getAllByRole('button', { name: 'Delete scan' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText(/all of its ShipSeal history/i)).toBeInTheDocument();
  });

  it('keeps persistence failure recoverable without removing the current scan action', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input) === '/api/account/session' ? json({ user }) : json({ error: { code: 'unavailable', message: 'unavailable' } }, 503)));
    render(<AccountProvider><SaveProjectControl report={buildSampleReport()} /></AccountProvider>);
    expect(await screen.findByText(/repository result is ready, but ShipSeal could not save it privately yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  });
});

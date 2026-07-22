import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/components/account/AccountProvider';
import { SaveProjectControl } from '@/components/account/SaveProjectControl';
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
  it('keeps an anonymous scan open and requests sign-in only when Save project is chosen', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ user: null })));
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const report = buildSampleReport();
    render(<AccountProvider><SaveProjectControl report={report} /></AccountProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save project' })).toBeEnabled());
    expect(screen.queryByText(/An account is needed only/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/api/account/login'), 'shipseal-account', expect.any(String));
    expect(screen.getByText(/This scan remains open/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save project' })).toBeEnabled();
  });

  it('saves explicitly for an authenticated user and exposes the private project link', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/account/session') return json({ user });
      if (url === '/api/projects' && init?.method === 'POST') return json({ project, scan }, 201);
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<AccountProvider><SaveProjectControl report={buildSampleReport()} /></AccountProvider>);
    await waitFor(() => expect(screen.getByText('My projects')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    await waitFor(() => expect(screen.getByText('Project and scan history saved privately.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Open saved project' })).toHaveAttribute('href', `/projects/${project.id}`);
    const post = fetcher.mock.calls.find(call => String(call[0]) === '/api/projects');
    expect(String(post?.[1]?.body)).not.toMatch(/github_pat_|API_KEY=|PRIVATE KEY/);
  });

  it('renders a calm project list and account deletion confirmation without a score dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input) === '/api/account/session' ? json({ user }) : json({ projects: [project] })));
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AccountProvider><Projects /></AccountProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Saved projects' })).toBeInTheDocument();
    expect(await screen.findByText('Csisz/shipseal-v2')).toBeInTheDocument();
    expect(screen.queryByText(/readiness score/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByRole('button', { name: 'Delete my ShipSeal account' })).toBeInTheDocument();
    expect(screen.getByText(/does not modify GitHub/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete scan' }));
    expect(screen.getAllByRole('button', { name: 'Delete scan' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText(/all of its ShipSeal history/i)).toBeInTheDocument();
  });

  it('keeps persistence failure recoverable without removing the current scan action', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input) === '/api/account/session' ? json({ user }) : json({ error: { code: 'unavailable', message: 'unavailable' } }, 503)));
    render(<AccountProvider><SaveProjectControl report={buildSampleReport()} /></AccountProvider>);
    await waitFor(() => expect(screen.getByText('My projects')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    expect(await screen.findByText(/current scan remains usable and was not rerun/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  });
});

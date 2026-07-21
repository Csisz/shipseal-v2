import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/components/account/AccountProvider';
import { buildSampleReport } from '@/lib/readiness';
import { buildSaveProjectRequest } from '@/lib/persistence/buildSnapshot';
import { PERSISTENCE_SCHEMA_VERSION } from '@/lib/persistence';

vi.mock('@/components/agentready/ResultDashboard', () => ({
  ResultDashboard: ({ report }: { report: { repoName: string } }) => <div data-testid="restored-result">Restored {report.repoName}<nav>Understand Improve Verify Deliver</nav></div>,
}));

import SavedScan from '@/pages/SavedScan';

const user = { id: `usr_${'r'.repeat(24)}`, email: null, displayName: 'Restore User', avatarUrl: null };
const projectId = `prj_${'p'.repeat(24)}`;
const scanId = `scn_${'s'.repeat(24)}`;

function json(body: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })); }

afterEach(() => vi.restoreAllMocks());

describe('Omega 18.1 saved scan restoration', () => {
  it('validates and restores a snapshot without scanner, provider, or GitHub requests', async () => {
    const snapshot = buildSaveProjectRequest({ report: buildSampleReport() }).scan.snapshot;
    const scan = {
      version: PERSISTENCE_SCHEMA_VERSION, id: scanId, projectId, sourceType: 'github-public', repositoryOwner: 'Csisz', repositoryName: 'shipseal-v2',
      branch: 'main', status: 'completed', startedAt: '2026-07-17T08:00:00.000Z', completedAt: '2026-07-17T08:00:00.000Z',
      scannerVersion: 'shipseal-browser-scanner.v1', deterministicRequestFingerprint: snapshot.deterministicRequestFingerprint,
      discoveredFiles: 10, analyzedFiles: 9, ignoredFiles: 1, intelligenceMode: 'deterministic', verificationState: 'not-started', baselineScanId: null, safeFailureCategory: null,
    };
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/account/session') return json({ user });
      if (url === `/api/scans/${scanId}`) return json({ scan, snapshot });
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/projects/${projectId}/scans/${scanId}`]}><AccountProvider><Routes><Route path="/projects/:projectId/scans/:scanId" element={<SavedScan />} /></Routes></AccountProvider></MemoryRouter>);
    expect(await screen.findByTestId('restored-result')).toHaveTextContent(`Restored ${snapshot.report.repoName}`);
    expect(screen.getByText(/Opened without rescanning, provider execution, or GitHub mutation/i)).toBeInTheDocument();
    const urls = fetcher.mock.calls.map(call => String(call[0]));
    expect(urls).toEqual(['/api/account/session', `/api/scans/${scanId}`]);
    expect(urls.join('\n')).not.toMatch(/repository-intelligence|github-app|archive|scan\/start/);
  });

  it('shows a safe unsupported-data state instead of rendering malformed history', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => String(input) === '/api/account/session'
      ? json({ user })
      : json({ scan: { id: scanId }, snapshot: { version: 'shipseal.scan-snapshot.v0' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/projects/${projectId}/scans/${scanId}`]}><AccountProvider><Routes><Route path="/projects/:projectId/scans/:scanId" element={<SavedScan />} /></Routes></AccountProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Saved scan cannot be reopened' })).toBeInTheDocument();
    expect(screen.getByText(/unsupported data version/i)).toBeInTheDocument();
  });
});

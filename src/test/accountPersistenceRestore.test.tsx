import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/components/account/AccountProvider';
import { buildSampleReport } from '@/lib/readiness';
import { buildSaveProjectRequest } from '@/lib/persistence/buildSnapshot';
import { PERSISTENCE_SCHEMA_VERSION } from '@/lib/persistence';

const savedScanMocks = vi.hoisted(() => ({
  importGitHubAppEvidence: vi.fn(),
  importPublicGitHubEvidence: vi.fn(),
  requestRepositoryProductIntelligenceStaged: vi.fn(),
}));

vi.mock('@/lib/github/githubImport', () => ({
  importGitHubAppEvidence: savedScanMocks.importGitHubAppEvidence,
  importPublicGitHubEvidence: savedScanMocks.importPublicGitHubEvidence,
}));

vi.mock('@/lib/repositoryIntelligence/deepIntelligenceClient', () => ({
  requestRepositoryProductIntelligenceStaged: savedScanMocks.requestRepositoryProductIntelligenceStaged,
}));

vi.mock('@/components/agentready/ResultDashboard', () => ({
  ResultDashboard: ({
    report,
    repositoryProductIntelligenceStatus: status,
    retryRepositoryProductIntelligence,
  }: {
    report: { repoName: string };
    repositoryProductIntelligenceStatus?: import('@/lib/repositoryIntelligence').RepositoryIntelligenceProviderStatus;
    retryRepositoryProductIntelligence?: () => Promise<void>;
  }) => {
    const recoveryAction = status && 'diagnostics' in status ? status.diagnostics?.operationRecoveryAction : undefined;
    const startable = status?.state === 'deterministic' || recoveryAction === 'start_new_analysis';
    return <div data-testid="restored-result">
      Restored {report.repoName}<nav>Understand Improve Verify Deliver</nav>
      {status?.message && <p>{status.message}</p>}
      {startable && retryRepositoryProductIntelligence && <button type="button" onClick={() => void retryRepositoryProductIntelligence()}>Generate Future analysis</button>}
    </div>;
  },
}));

import SavedScan from '@/pages/SavedScan';

const user = { id: `usr_${'r'.repeat(24)}`, email: null, displayName: 'Restore User', avatarUrl: null };
const projectId = `prj_${'p'.repeat(24)}`;
const scanId = `scn_${'s'.repeat(24)}`;
const usage = {
  plan: 'free', entitlementStatus: 'active',
  deepAnalysis: {
    limit: 0, used: 0, reserved: 0, remaining: 0,
    periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z',
  },
};

function json(body: unknown, status = 200) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })); }

afterEach(() => {
  vi.restoreAllMocks();
  savedScanMocks.importGitHubAppEvidence.mockReset();
  savedScanMocks.importPublicGitHubEvidence.mockReset();
  savedScanMocks.requestRepositoryProductIntelligenceStaged.mockReset();
});

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
      if (url === '/api/account/usage') return json(usage);
      if (url === `/api/scans/${scanId}`) return json({ scan, snapshot });
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/projects/${projectId}/scans/${scanId}`]}><AccountProvider><Routes><Route path="/projects/:projectId/scans/:scanId" element={<SavedScan />} /></Routes></AccountProvider></MemoryRouter>);
    expect(await screen.findByTestId('restored-result')).toHaveTextContent(`Restored ${snapshot.report.repoName}`);
    expect(screen.getByText(/Opened without rescanning, provider execution, or GitHub mutation/i)).toBeInTheDocument();
    const urls = fetcher.mock.calls.map(call => String(call[0]));
    expect(urls).toHaveLength(5);
    expect(urls).toEqual(expect.arrayContaining(['/api/account/session', '/api/account/usage', `/api/scans/${scanId}`]));
    expect(urls.some(url => url.startsWith('/api/account/ai-operation-result?'))).toBe(true);
    expect(urls.some(url => url.startsWith('/api/account/ai-operation-status?'))).toBe(true);
    expect(urls.join('\n')).not.toMatch(/\/api\/repository-intelligence|github-app|archive|scan\/start/);
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

  it('restores a refunded historical Future as a clean new-analysis state', async () => {
    const report = {
      ...buildSampleReport(),
      source: {
        ...buildSampleReport().source,
        sourceType: 'github-app' as const,
        githubOwner: 'Csisz', githubRepo: 'shipseal-v2', githubBranch: 'main',
        githubInstallationId: '12345',
      },
    };
    const snapshot = buildSaveProjectRequest({ report }).scan.snapshot;
    const scan = {
      version: PERSISTENCE_SCHEMA_VERSION, id: scanId, projectId, sourceType: 'github-app', repositoryOwner: 'Csisz', repositoryName: 'shipseal-v2',
      branch: 'main', status: 'completed', startedAt: '2026-07-17T08:00:00.000Z', completedAt: '2026-07-17T08:00:00.000Z',
      scannerVersion: 'shipseal-browser-scanner.v1', deterministicRequestFingerprint: snapshot.deterministicRequestFingerprint,
      discoveredFiles: 10, analyzedFiles: 9, ignoredFiles: 1, intelligenceMode: 'deterministic', verificationState: 'not-started', baselineScanId: null, safeFailureCategory: null,
    };
    const proUsage = {
      ...usage, plan: 'pro',
      deepAnalysis: { ...usage.deepAnalysis, limit: 10, remaining: 10 },
    };
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/account/session') return json({ user });
      if (url === '/api/account/usage') return json(proUsage);
      if (url === `/api/scans/${scanId}`) return json({ scan, snapshot });
      if (url.startsWith('/api/account/ai-operation-result?')) return json({ error: { code: 'not_found' } }, 404);
      if (url.startsWith('/api/account/ai-operation-status?')) return json({ operation: {
        publicOperationId: `op_${'r'.repeat(24)}`,
        operationState: 'terminal_failure', rootStageState: 'succeeded', retryable: false,
        completionState: 'refunded', cacheAvailable: false, rootCacheAvailable: true,
        completedExpansionCount: 0, expectedExpansionCount: 3, leaseExpiresAt: null,
        userUnitState: 'refunded', recoveryAction: 'start_new_analysis', integrityRecoveryAttemptsUsed: 0,
        reconciliationOutcome: 'refunded',
      } });
      return json({ error: { code: 'not_found' } }, 404);
    });
    vi.stubGlobal('fetch', fetcher);

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/projects/${projectId}/scans/${scanId}`]}><AccountProvider><Routes><Route path="/projects/:projectId/scans/:scanId" element={<SavedScan />} /></Routes></AccountProvider></MemoryRouter>);

    expect(await screen.findByRole('button', { name: 'Generate Future analysis' })).toBeEnabled();
    expect(screen.getByTestId('restored-result')).toHaveTextContent('returned to your allowance');
    expect(screen.queryByText(/cannot be resumed safely/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/repository changes/i)).not.toBeInTheDocument();
    expect(proUsage.deepAnalysis).toMatchObject({ limit: 10, used: 0, reserved: 0, remaining: 10 });
    expect(fetcher.mock.calls.map(call => String(call[0])).join('\n')).not.toMatch(/repository-intelligence|repository-evidence/);

    savedScanMocks.importGitHubAppEvidence.mockResolvedValue({
      commitSha: 'a'.repeat(40), requestCount: 3,
      scanInput: {
        repoName: 'shipseal-v2',
        source: { sourceType: 'github-app', githubOwner: 'Csisz', githubRepo: 'shipseal-v2', githubBranch: 'main', githubInstallationId: '12345' },
        files: [{ path: 'README.md', size: 52 }, { path: 'package.json', size: 48 }],
        textContents: {
          'README.md': '# ShipSeal\nRepository intelligence for software teams.',
          'package.json': '{"scripts":{"build":"vite build"}}',
        },
      },
    });
    savedScanMocks.requestRepositoryProductIntelligenceStaged.mockResolvedValue({
      version: 'shipseal.repository-intelligence-provider.v1', state: 'fallback', category: 'provider_unavailable',
      retryable: true, message: 'Temporary fixture stop.', deepState: 'failed', diagnostics: { costEstimate: 'unavailable' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate Future analysis' }));
    await waitFor(() => expect(savedScanMocks.requestRepositoryProductIntelligenceStaged).toHaveBeenCalledTimes(1));
    expect(savedScanMocks.requestRepositoryProductIntelligenceStaged.mock.calls[0]?.[1]).toEqual({ recoveryOperationId: undefined });
    expect(savedScanMocks.importGitHubAppEvidence).toHaveBeenCalledTimes(1);
  });
});

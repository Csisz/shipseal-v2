import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter as RouterMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Index from '@/pages/Index';
import type React from 'react';
import type { GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';
import { FeedbackContext } from '@/components/feedback/feedbackContext';

function MemoryRouter({ children }: { children: React.ReactNode }) {
  return <RouterMemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</RouterMemoryRouter>;
}

const scanMocks = vi.hoisted(() => ({
  startScan: vi.fn(),
  startGitHubScan: vi.fn(),
  startGitHubAppScan: vi.fn(),
  failNext: false as boolean,
  completeWithReport: false as boolean,
}));

vi.mock('@/components/agentready/Landing', () => ({
  Landing: ({ onSampleReport, scanSlot }: { onSampleReport: () => void; scanSlot?: React.ReactNode }) => (
    <div>
      <button type="button" onClick={onSampleReport}>Try sample project</button>
      {scanSlot}
    </div>
  ),
}));

vi.mock('@/components/agentready/ResultDashboard', () => ({
  ResultDashboard: ({ initialIntake, intakeSkipped, selectedPackages, agentOperatingMode, githubConnection }: {
    initialIntake?: { projectName?: string };
    intakeSkipped?: boolean;
    selectedPackages?: string[];
    agentOperatingMode?: string;
    githubConnection?: { installationId?: string; owner?: string; repo?: string; defaultBranch?: string };
  }) => (
    <div data-testid="result-dashboard">
      <span>Project: {initialIntake?.projectName}</span>
      <span>Intake skipped: {String(intakeSkipped)}</span>
      <span>Packages: {JSON.stringify(selectedPackages)}</span>
      <span>Agent mode: {agentOperatingMode}</span>
      {githubConnection && <span>Connection: {githubConnection.installationId}/{githubConnection.owner}/{githubConnection.repo}/{githubConnection.defaultBranch}</span>}
    </div>
  ),
}));

vi.mock('@/lib/workspace', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/workspace')>();
  return { ...actual, buildRepositoryUniverseModel: vi.fn(() => ({ fingerprint: 'fixture-universe' })) };
});

vi.mock('@/components/agentready/result-workspace/futures/repositoryFuturePathwaysGraph', () => ({
  buildRepositoryFuturePathwaysGraph: vi.fn(() => ({
    candidates: [{ id: 'fixture-direction', alignment: 'product-opportunity', eligibility: 'eligible' }],
    nodes: [{ id: 'fixture-goal', kind: 'future-goal', candidateId: 'fixture-direction' }],
  })),
}));

vi.mock('@/components/agentready/result-workspace/futures/RepositoryFuturesWorkspace', () => ({ default: () => null }));

vi.mock('@/hooks/useRepoScan', async () => {
  const React = await import('react');
  const { buildSampleReport } = await import('@/lib/readiness');
  return {
    useRepoScan: () => {
      const [state, setState] = React.useState({
        status: 'idle' as 'idle' | 'scanning' | 'failed' | 'cancelled' | 'completed',
        error: null as string | null,
        report: null as ReturnType<typeof buildSampleReport> | null,
      });
      const begin = () => {
        if (scanMocks.failNext) {
          scanMocks.failNext = false;
          setState({ status: 'failed', error: 'Synthetic scan failure', report: null });
        } else if (scanMocks.completeWithReport) {
          setState({ status: 'completed', error: null, report: buildSampleReport() });
        } else {
          setState({ status: 'scanning', error: null, report: null });
        }
        return Promise.resolve(null);
      };
      const repositoryProductIntelligence = React.useMemo(() => state.status === 'completed'
        ? { fingerprint: 'fixture-product', opportunities: [{ id: 'fixture-opportunity' }] }
        : null, [state.status]);
      const repositoryIntelligenceReview = React.useMemo(() => state.status === 'completed'
        ? { artifactSet: {}, review: {} }
        : null, [state.status]);
      return {
        selectedFile: null,
        ...state,
        errorCategory: state.status === 'failed' ? 'network-cors-blocked' : null,
        currentStep: state.status === 'scanning' ? 'Reading repository' : null,
        currentStepIndex: 0,
        progress: 10,
        warnings: [],
        steps: ['Reading repository'],
        activeRepositoryLabel: 'Selected repository',
        activeScanSourceLabel: 'Test source',
        discoveredFileCount: 0,
        analyzedFileCount: 0,
        repositoryProductIntelligenceStatus: {
          state: state.status === 'completed' ? 'enhanced' : 'deterministic',
          message: state.status === 'completed' ? 'Validated Product Intelligence ready.' : 'Product intelligence has not started.',
          providerId: state.status === 'completed' ? 'fixture-provider' : undefined,
        },
        repositoryIntelligenceReview,
        repositoryProductIntelligence,
        prepareRepositoryProductIntelligence: vi.fn(async () => null),
        startScan: (file: File) => { scanMocks.startScan(file); return begin(); },
        startGitHubScan: (url: string, branch?: string) => { scanMocks.startGitHubScan(url, branch); return begin(); },
        startGitHubAppScan: (source: unknown) => { scanMocks.startGitHubAppScan(source); return begin(); },
        cancelScan: vi.fn(() => setState({ status: 'cancelled', error: 'Scan cancelled', report: null })),
        resetScan: vi.fn(() => setState({ status: 'idle', error: null, report: null })),
      };
    },
  };
});

vi.mock('@/components/agentready/UploadDropzone', () => ({
  UploadDropzone: ({
    onFile,
    onGitHubImport,
    githubInstallationId,
    repositoryListStatus,
    repositories = [],
    repositoryListMessage,
    onGitHubAppRepositorySelect,
    onGitHubConnect,
    onGitHubSwitch,
    onGitHubDisconnect,
    onGitHubRepositoryRetry,
    githubLogin,
  }: {
    onFile: (file: File) => void;
    onGitHubImport?: (url: string, branch?: string) => void;
    githubInstallationId?: string;
    repositoryListStatus?: GitHubAppRepositoryListStatus;
    repositories?: GitHubAppRepository[];
    repositoryListMessage?: string;
    onGitHubAppRepositorySelect?: (repo: GitHubAppRepository) => void;
    onGitHubConnect?: () => void;
    onGitHubSwitch?: () => void;
    onGitHubDisconnect?: () => void;
    onGitHubRepositoryRetry?: () => void;
    githubLogin?: string;
  }) => (
    <div>
      <button type="button" onClick={() => {
        const file = new File(['demo'], 'real-repo.zip', { type: 'application/zip' });
        onFile(file);
        onFile(file);
      }}>Choose valid ZIP</button>
      <button type="button" onClick={() => onGitHubImport?.('https://github.com/Csisz/public-repo', 'develop')}>Accept public GitHub URL</button>
      {githubInstallationId && <div>Installation: {githubInstallationId}</div>}
      {repositoryListStatus === 'loading' && <div>GitHub App installation detected. Loading repositories...</div>}
      {(repositoryListStatus === 'not_configured' || repositoryListStatus === 'error') && <div>{repositoryListMessage}</div>}
      <button type="button" onClick={onGitHubConnect}>Connect GitHub</button>
      {githubLogin && <button type="button" onClick={onGitHubSwitch}>Switch GitHub account</button>}
      <button type="button" onClick={onGitHubRepositoryRetry}>Retry repository listing</button>
      <button type="button" onClick={onGitHubDisconnect}>Disconnect GitHub</button>
      {repositoryListStatus === 'loaded' && repositories[0] && (
        <button type="button" onClick={() => onGitHubAppRepositorySelect?.(repositories[0])}>
          Select repository: {repositories[0].fullName}
        </button>
      )}
    </div>
  ),
}));

describe('ShipSeal direct scan entry', () => {
  afterEach(() => {
    scanMocks.failNext = false;
    scanMocks.completeWithReport = false;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('starts a valid ZIP immediately without the removed confirmation screen or duplicate scans', () => {
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Choose valid ZIP/i }));

    expect(scanMocks.startScan).toHaveBeenCalledTimes(1);
    expect(scanMocks.startScan.mock.calls[0][0]).toHaveProperty('name', 'real-repo.zip');
    expect(screen.getByText(/Forming repository intelligence/i)).toBeInTheDocument();
    expect(screen.queryByText('Ready to scan')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Understand this repository/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Scan project$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scan setup progress')).not.toBeInTheDocument();
  });

  it('records one demo start and one completion when a duplicate source callback resolves the same scan', async () => {
    scanMocks.completeWithReport = true;
    const recordOutcome = vi.fn();
    render(
      <MemoryRouter>
        <FeedbackContext.Provider value={{ openFeedback: vi.fn(), recordOutcome }}>
          <Index />
        </FeedbackContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Choose valid ZIP/i }));

    await waitFor(() => expect(recordOutcome.mock.calls.filter(([event]) => event === 'scan_completed')).toHaveLength(1));
    expect(recordOutcome.mock.calls.filter(([event]) => event === 'demo_started')).toHaveLength(1);
    expect(scanMocks.startScan).toHaveBeenCalledTimes(1);
  });

  it('starts an accepted public GitHub URL immediately with its branch', () => {
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Accept public GitHub URL/i }));

    expect(scanMocks.startGitHubScan).toHaveBeenCalledTimes(1);
    expect(scanMocks.startGitHubScan).toHaveBeenCalledWith('https://github.com/Csisz/public-repo', 'develop');
    expect(screen.getByText(/Forming repository intelligence/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Scan project$/i })).not.toBeInTheDocument();
  });

  it('starts a connected GitHub scan on repository selection and preserves defaults and connection metadata', async () => {
    scanMocks.completeWithReport = true;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'connected', connection: { githubLogin: 'Csisz', selectedInstallationId: '12345', installations: [{ id: '12345', accountLogin: 'Csisz' }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          repositories: [{ id: 1, owner: 'Csisz', name: 'shipseal', fullName: 'Csisz/shipseal', defaultBranch: 'main', private: true, htmlUrl: 'https://github.com/Csisz/shipseal' }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /Select repository: Csisz\/shipseal/i }));

    expect(scanMocks.startGitHubAppScan).toHaveBeenCalledTimes(1);
    expect(scanMocks.startGitHubAppScan).toHaveBeenCalledWith({ installationId: '12345', owner: 'Csisz', repo: 'shipseal', ref: 'main' });
    expect(await screen.findByRole('heading', { name: /Your workspace is ready/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Skip to workspace/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Project: shipseal')).toBeInTheDocument();
    expect(screen.getByText('Intake skipped: true')).toBeInTheDocument();
    expect(screen.getByText('Packages: []')).toBeInTheDocument();
    expect(screen.getByText(/Agent mode:/)).not.toHaveTextContent('Agent mode: undefined');
    expect(screen.getByText('Connection: 12345/Csisz/shipseal/main')).toBeInTheDocument();
  });

  it('keeps failure recovery usable and retries the registered source once', async () => {
    scanMocks.failNext = true;
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Choose valid ZIP/i }));

    expect(await screen.findByText('Synthetic scan failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry scan/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Choose another source/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Retry scan/i }));

    expect(scanMocks.startScan).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Forming repository intelligence/i)).toBeInTheDocument();
  });

  it('keeps the sample project flow scan-free', async () => {
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Try sample project/i }));

    expect(await screen.findByRole('heading', { name: /Your workspace is ready/i })).toBeInTheDocument();
    expect(scanMocks.startScan).not.toHaveBeenCalled();
    expect(scanMocks.startGitHubScan).not.toHaveBeenCalled();
    expect(scanMocks.startGitHubAppScan).not.toHaveBeenCalled();
  });

  it('opens popup connect, receives postMessage, keeps authorization out of localStorage, retries and disconnects', async () => {
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => popup);
    let connected = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/github-app/connection' && init?.method === 'DELETE') {
        return { ok: true, status: 200, json: async () => ({ status: 'disconnected' }) };
      }
      if (url === '/api/github-app/connection') {
        return connected
          ? { ok: true, status: 200, json: async () => ({ status: 'connected', connection: { githubLogin: 'Csisz', selectedInstallationId: '777', installations: [{ id: '777', accountLogin: 'Csisz' }] } }) }
          : { ok: false, status: 401, json: async () => ({ status: 'reconnect_required' }) };
      }
      if (url === '/api/github-app/repositories?installationId=777') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', repositories: [{ id: 1, owner: 'Csisz', name: 'shipseal', fullName: 'Csisz/shipseal', defaultBranch: 'main', private: false, htmlUrl: 'https://github.com/Csisz/shipseal' }] }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><Index /></MemoryRouter>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/connection', expect.any(Object)));
    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));
    expect(openMock).toHaveBeenCalledWith('/api/github-app/login', 'shipseal-github-connect', expect.stringContaining('popup=yes'));
    connected = true;
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: popup,
      data: { source: 'shipseal-github-connect', status: 'ok', installationId: '777', installations: [{ id: '777', accountLogin: 'Csisz' }] },
    })));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/repositories?installationId=777'));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Retry repository listing/i }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/repositories?'))).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: /Disconnect GitHub/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/connection', expect.objectContaining({ method: 'DELETE' })));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBeNull();
  });

  it('synchronizes a completed popup on focus even when postMessage is missed', async () => {
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockImplementation(() => popup);
    let connected = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/github-app/connection') {
        return connected
          ? { ok: true, status: 200, json: async () => ({ status: 'connected', connection: { githubLogin: 'hvdev23', selectedInstallationId: '202', installations: [{ id: '202', accountLogin: 'hvdev23' }] } }) }
          : { ok: false, status: 401, json: async () => ({ status: 'reconnect_required' }) };
      }
      if (url === '/api/github-app/repositories?installationId=202') {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', repositories: [{ id: 2, owner: 'hvdev23', name: 'shipseal-test-repo', fullName: 'hvdev23/shipseal-test-repo', defaultBranch: 'main', private: true, htmlUrl: 'https://github.com/hvdev23/shipseal-test-repo' }] }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));
    connected = true;
    act(() => window.dispatchEvent(new Event('focus')));

    expect(await screen.findByRole('button', { name: /Select repository: hvdev23\/shipseal-test-repo/i })).toBeInTheDocument();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('adds GitHub account selection only for the explicit switch action', async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => popup);
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    let sessionId = 'session-before-switch';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/github-app/connection') {
        const responseSessionId = sessionId;
        return { ok: true, status: 200, json: async () => ({ status: 'connected', connection: { sessionId: responseSessionId, githubLogin: 'first-user', selectedInstallationId: '101', installations: [{ id: '101', accountLogin: 'first-user' }] } }) };
      }
      if (url === '/api/github-app/repositories?installationId=101') {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', repositories: [] }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /Switch GitHub account/i }));

    expect(openMock).toHaveBeenCalledWith('/api/github-app/login?prompt=select_account', 'shipseal-github-connect', expect.stringContaining('popup=yes'));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(popup.close).not.toHaveBeenCalled());

    sessionId = 'session-after-switch';
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(popup.close).toHaveBeenCalledOnce());
  });

  it('maps repository listing backend errors to actionable recovery copy', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'connected', connection: { githubLogin: 'Csisz', selectedInstallationId: '999', installations: [{ id: '999', accountLogin: 'Csisz' }] } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 501,
        json: async () => ({ status: 'not_configured', code: 'invalid_private_key_format', message: 'raw backend message' }),
      }));
    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(await screen.findByText('GitHub App private key is missing or invalid in Vercel.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Connect GitHub$/i })).toBeEnabled();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter as RouterMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Index from '@/pages/Index';
import type React from 'react';
import type { GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';

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
        repositoryProductIntelligence: null,
        repositoryProductIntelligenceStatus: {
          state: state.status === 'completed' ? 'fallback' : 'deterministic',
          message: state.status === 'completed' ? 'Grounded fallback ready.' : 'Product intelligence has not started.',
        },
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
    onGitHubDisconnect,
    onGitHubRepositoryRetry,
  }: {
    onFile: (file: File) => void;
    onGitHubImport?: (url: string, branch?: string) => void;
    githubInstallationId?: string;
    repositoryListStatus?: GitHubAppRepositoryListStatus;
    repositories?: GitHubAppRepository[];
    repositoryListMessage?: string;
    onGitHubAppRepositorySelect?: (repo: GitHubAppRepository) => void;
    onGitHubConnect?: () => void;
    onGitHubDisconnect?: () => void;
    onGitHubRepositoryRetry?: () => void;
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        repositories: [{ id: 1, owner: 'Csisz', name: 'shipseal', fullName: 'Csisz/shipseal', defaultBranch: 'main', private: true, htmlUrl: 'https://github.com/Csisz/shipseal' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/?githubInstallationId=12345');
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /Select repository: Csisz\/shipseal/i }));

    expect(scanMocks.startGitHubAppScan).toHaveBeenCalledTimes(1);
    expect(scanMocks.startGitHubAppScan).toHaveBeenCalledWith({ installationId: '12345', owner: 'Csisz', repo: 'shipseal', ref: 'main' });
    expect(await screen.findByRole('heading', { name: /Your repository intelligence is ready/i })).toBeInTheDocument();
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

  it('keeps the sample project flow scan-free', () => {
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Try sample project/i }));

    expect(screen.getByRole('heading', { name: /Your repository intelligence is ready/i })).toBeInTheDocument();
    expect(scanMocks.startScan).not.toHaveBeenCalled();
    expect(scanMocks.startGitHubScan).not.toHaveBeenCalled();
    expect(scanMocks.startGitHubAppScan).not.toHaveBeenCalled();
  });

  it('opens popup connect, receives postMessage, persists installation, retries and disconnects', async () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', repositories: [{ id: 1, owner: 'Csisz', name: 'shipseal', fullName: 'Csisz/shipseal', defaultBranch: 'main', private: false, htmlUrl: 'https://github.com/Csisz/shipseal' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><Index /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));
    expect(openMock).toHaveBeenCalledWith('/api/github-app/login', 'shipseal-github-connect', expect.stringContaining('popup=yes'));
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { source: 'shipseal-github-connect', status: 'ok', installationId: '777', installations: [{ id: '777', accountLogin: 'Csisz' }] },
    })));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/repositories?installationId=777'));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBe('777');
    fireEvent.click(screen.getByRole('button', { name: /Retry repository listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: /Disconnect GitHub/i }));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBeNull();
  });

  it('maps repository listing backend errors to actionable recovery copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'not_configured', code: 'invalid_private_key_format', message: 'raw backend message' }),
    }));
    window.localStorage.setItem('shipseal.githubInstallationId', '999');
    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(await screen.findByText('GitHub App private key is missing or invalid in Vercel.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Connect GitHub$/i })).toBeEnabled();
  });
});

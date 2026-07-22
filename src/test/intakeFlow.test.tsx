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
}));

vi.mock('@/components/agentready/Landing', () => ({
  Landing: ({ onSampleReport, onScrollScan, scanSlot }: { onSampleReport: () => void; onScrollScan: () => void; scanSlot?: React.ReactNode }) => (
    <div>
      <button type="button" onClick={onSampleReport}>Try sample project</button>
      <button type="button" onClick={onScrollScan}>Go to scan</button>
      {scanSlot}
    </div>
  ),
}));

vi.mock('@/hooks/useRepoScan', async () => {
  const React = await import('react');
  return {
    useRepoScan: () => {
      const [status, setStatus] = React.useState<'idle' | 'scanning'>('idle');
      return {
        selectedFile: null,
        status,
        currentStep: null,
        currentStepIndex: 0,
        progress: 0,
        warnings: [],
        error: null,
        errorCategory: null,
        report: null,
        steps: ['Reading repository'],
        startScan: scanMocks.startScan.mockImplementation(() => {
          setStatus('scanning');
          return Promise.resolve(null);
        }),
        startGitHubScan: scanMocks.startGitHubScan.mockImplementation(() => {
          setStatus('scanning');
          return Promise.resolve(null);
        }),
        startGitHubAppScan: scanMocks.startGitHubAppScan.mockImplementation(() => {
          setStatus('scanning');
          return Promise.resolve(null);
        }),
        cancelScan: vi.fn(),
        resetScan: vi.fn(() => setStatus('idle')),
      };
    },
  };
});

vi.mock('@/components/agentready/UploadDropzone', () => ({
  UploadDropzone: ({
    onFile,
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
      <button
        type="button"
        onClick={() => onFile(new File(['demo'], 'real-repo.zip', { type: 'application/zip' }))}
      >
        Analyze repository
      </button>
      {githubInstallationId && <div>Installation: {githubInstallationId}</div>}
      {repositoryListStatus === 'loading' && <div>GitHub App installation detected. Loading repositories...</div>}
      {repositoryListStatus === 'not_configured' && <div>{repositoryListMessage}</div>}
      {repositoryListStatus === 'error' && <div>{repositoryListMessage}</div>}
      <button type="button" onClick={onGitHubConnect}>Connect GitHub</button>
      <button type="button" onClick={onGitHubRepositoryRetry}>Retry repository listing</button>
      <button type="button" onClick={onGitHubDisconnect}>Disconnect GitHub</button>
      {repositoryListStatus === 'loaded' && (
        <button type="button" onClick={() => onGitHubAppRepositorySelect?.(repositories[0])}>
          Scan selected repository: {repositories[0]?.fullName}
        </button>
      )}
    </div>
  ),
}));

describe('ShipSeal pre-scan intake flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('shows outcome-first project context after ZIP selection', async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(screen.getByText('Step 1: Which project?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /analyze repository/i }));

    expect(screen.getByText('Step 2: What do you want?')).toBeInTheDocument();
    expect(screen.getByText('Project Source')).toBeInTheDocument();
    expect(screen.getByText('ZIP upload')).toBeInTheDocument();
    expect(screen.getByText('real-repo.zip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change project/i })).toBeInTheDocument();
    expect(screen.getByText('What do you want?')).toBeInTheDocument();
    expect(screen.getByText('Build with AI')).toBeInTheDocument();
    expect(screen.getByText('Ship to Client')).toBeInTheDocument();
    expect(screen.getByText('Production Readiness')).toBeInTheDocument();
    expect(screen.getByText('Security Review')).toBeInTheDocument();
    expect(screen.getByText('Full Workspace Analysis')).toBeInTheDocument();
    expect(screen.queryByText('MCP readiness and tool integration')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Scan project$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Ship to Client/i }));

    expect(screen.getByText('Selected: Prepare for client handoff')).toBeInTheDocument();
    expect(screen.getByText('Advanced options')).toBeInTheDocument();
    expect(screen.queryByText('Tell ShipSeal what this AI app does')).not.toBeInTheDocument();
    expect(screen.queryByText('What ShipSeal will prepare')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Scan project$/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /skip intake and scan repository only/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Advanced options'));

    expect(screen.getByText('Tell ShipSeal what this AI app does')).toBeInTheDocument();
    expect(screen.getByText(/Optional, but recommended for client-ready reports/i)).toBeInTheDocument();
    expect(screen.getByText('Advanced details')).toBeInTheDocument();
    expect(screen.getByText('What ShipSeal will prepare')).toBeInTheDocument();
    expect(screen.queryByText('Agent Cost Optimizer')).not.toBeInTheDocument();
    expect(screen.getByText('Client handoff')).toBeInTheDocument();
    expect(screen.getByText('AI agent development pack')).toBeInTheDocument();
    expect(screen.getByText(/View generated file list/)).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue('real-repo');
    expect(screen.getByLabelText('Project name')).not.toHaveValue('Customer Support RAG Assistant');

    fireEvent.click(screen.getByRole('button', { name: /^Scan project$/i }));

    expect(screen.getByText(/The workspace is forming/i)).toBeInTheDocument();
    expect(screen.getByText(/Living Repository/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Skip to workspace/i })).not.toBeInTheDocument();
  });

  it('shows Intelligence Reveal for the sample project and enters the workspace without scanning', async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Try sample project/i }));

    expect(screen.getByRole('heading', { name: /Understanding repository structure/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip to workspace/i })).toBeInTheDocument();
    expect(scanMocks.startScan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Skip to workspace/i }));

    expect(await screen.findByRole('heading', { name: /Explore the repository universe/i }, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Replay reveal/i })).toBeInTheDocument();
    fireEvent.click(await screen.findByText(/Workspace story and evidence/i, undefined, { timeout: 15000 }));
    fireEvent.click(screen.getByRole('button', { name: /2 Knowledge and docs/i }));
    expect(screen.getByRole('heading', { name: /Knowledge and docs/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Replay reveal/i }));
    expect(screen.getByRole('button', { name: /Skip to workspace/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Skip to workspace/i }));

    expect(await screen.findByRole('heading', { name: /Explore the repository universe/i }, { timeout: 15000 })).toBeInTheDocument();
    fireEvent.click(await screen.findByText(/Workspace story and evidence/i, undefined, { timeout: 15000 }));
    expect(await screen.findByRole('heading', { name: /Knowledge and docs/i }, { timeout: 5000 })).toBeInTheDocument();
  }, 30000);

  it('shows and updates Agent Operating Mode for AI Agent Development package', async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /analyze repository/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Build with AI/i }));
    fireEvent.click(screen.getByText('Advanced options'));

    expect(screen.getByText('Agent Cost Optimizer')).toBeInTheDocument();
    expect(screen.getByText('Choose how AI agents should spend attention')).toBeInTheDocument();
    expect(screen.getByText('Balanced context use')).toBeInTheDocument();
    expect(screen.getByText('Recommended default')).toBeInTheDocument();
    expect(screen.getByText('Lowest context use')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Balanced Context/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Focused Context/i }));

    expect(screen.getByRole('button', { name: /Focused Context/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Balanced Context/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('recognizes GitHub App callback query params and exposes repository listing state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        repositories: [{
          id: 1,
          owner: 'Csisz',
          name: 'shipseal',
          fullName: 'Csisz/shipseal',
          defaultBranch: 'main',
          private: false,
          htmlUrl: 'https://github.com/Csisz/shipseal',
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/?githubInstallationId=12345&githubSetupAction=install#scan');

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(screen.getByText('Installation: 12345')).toBeInTheDocument();
    expect(screen.getByText(/GitHub App installation detected. Loading repositories/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/repositories?installationId=12345'));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBe('12345');
    expect(await screen.findByRole('button', { name: /Scan selected repository: Csisz\/shipseal/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Scan selected repository: Csisz\/shipseal/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Full Workspace Analysis/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Scan project$/i }));

    expect(scanMocks.startGitHubAppScan).toHaveBeenCalledWith({
      installationId: '12345',
      owner: 'Csisz',
      repo: 'shipseal',
      ref: 'main',
    });
    expect(screen.getByText(/The workspace is forming/i)).toBeInTheDocument();
  });

  it('opens popup connect, receives postMessage, persists installation, retries and disconnects', async () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        repositories: [{
          id: 1,
          owner: 'Csisz',
          name: 'shipseal',
          fullName: 'Csisz/shipseal',
          defaultBranch: 'main',
          private: false,
          htmlUrl: 'https://github.com/Csisz/shipseal',
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));
    expect(openMock).toHaveBeenCalledWith('/api/github-app/login', 'shipseal-github-connect', expect.stringContaining('popup=yes'));

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          source: 'shipseal-github-connect',
          status: 'ok',
          installationId: '777',
          installations: [{ id: '777', accountLogin: 'Csisz' }],
        },
      }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/repositories?installationId=777'));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBe('777');
    expect(await screen.findByRole('button', { name: /Scan selected repository: Csisz\/shipseal/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry repository listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: /Disconnect GitHub/i }));
    expect(window.localStorage.getItem('shipseal.githubInstallationId')).toBeNull();
    expect(screen.queryByText('Installation: 777')).not.toBeInTheDocument();
  });

  it('maps repository listing backend errors to actionable messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        status: 'not_configured',
        code: 'invalid_private_key_format',
        message: 'raw backend message',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.setItem('shipseal.githubInstallationId', '999');

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(await screen.findByText('GitHub App private key is missing or invalid in Vercel.')).toBeInTheDocument();
    expect(screen.queryByText('Repository listing is not available yet.')).not.toBeInTheDocument();
  });

  it('keeps public GitHub URL import separate from GitHub Connect', () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(screen.getByText('Step 1: Which project?')).toBeInTheDocument();
    expect(scanMocks.startGitHubScan).not.toHaveBeenCalled();
  });
});

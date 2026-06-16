import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Index from '@/pages/Index';
import type React from 'react';
import type { GitHubAppRepository, GitHubAppRepositoryListStatus } from '@/lib/githubApp/types';

const scanMocks = vi.hoisted(() => ({
  startScan: vi.fn(),
  startGitHubScan: vi.fn(),
  startGitHubAppScan: vi.fn(),
}));

vi.mock('@/components/agentready/Landing', () => ({
  Landing: ({ onScrollScan, scanSlot }: { onScrollScan: () => void; scanSlot?: React.ReactNode }) => (
    <div>
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
        steps: ['Reading repository structure'],
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
  }: {
    onFile: (file: File) => void;
    githubInstallationId?: string;
    repositoryListStatus?: GitHubAppRepositoryListStatus;
    repositories?: GitHubAppRepository[];
    repositoryListMessage?: string;
    onGitHubAppRepositorySelect?: (repo: GitHubAppRepository) => void;
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
      {repositoryListStatus === 'loaded' && (
        <button type="button" onClick={() => onGitHubAppRepositorySelect?.(repositories[0])}>
          Select {repositories[0]?.fullName}
        </button>
      )}
    </div>
  ),
}));

describe('ShipSeal pre-scan intake flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('shows outcome-first project context after ZIP selection', async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    expect(screen.getByText('Step 1: Upload your project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /analyze repository/i }));

    expect(screen.getByText('Step 2: Choose your goal')).toBeInTheDocument();
    expect(screen.getByText('Project Source')).toBeInTheDocument();
    expect(screen.getByText('ZIP upload')).toBeInTheDocument();
    expect(screen.getByText('real-repo.zip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change project/i })).toBeInTheDocument();
    expect(screen.getByText('What do you want ShipSeal to help with?')).toBeInTheDocument();
    expect(screen.getByText('MCP readiness and tool integration')).toBeInTheDocument();
    expect(screen.queryByLabelText('Project name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Scan project$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Prepare for client handoff/i }));

    expect(screen.getByText('Tell ShipSeal what this AI app does')).toBeInTheDocument();
    expect(screen.getByText(/Optional, but recommended for client-ready reports/i)).toBeInTheDocument();
    expect(screen.getByText('Advanced details')).toBeInTheDocument();
    expect(screen.getByText('What ShipSeal will prepare')).toBeInTheDocument();
    expect(screen.getByText('Client handoff')).toBeInTheDocument();
    expect(screen.getByText('AI agent development pack')).toBeInTheDocument();
    expect(screen.getByText('View generated file list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Back$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Scan project$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip intake and scan repository only/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue('real-repo');
    expect(screen.getByLabelText('Project name')).not.toHaveValue('Customer Support RAG Assistant');

    fireEvent.click(screen.getByRole('button', { name: /^Scan project$/i }));

    expect(screen.getByText(/Scanning repository/i)).toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: /Select Csisz\/shipseal/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Select Csisz\/shipseal/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Full ShipSeal package/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Scan project$/i }));

    expect(scanMocks.startGitHubAppScan).toHaveBeenCalledWith({
      installationId: '12345',
      owner: 'Csisz',
      repo: 'shipseal',
      ref: 'main',
    });
    expect(screen.getByText(/Scanning repository/i)).toBeInTheDocument();
  });
});

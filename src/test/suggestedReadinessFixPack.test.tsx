import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateReadinessPrDialog } from '@/components/agentready/CreateReadinessPrDialog';
import { SuggestedReadinessFixPack } from '@/components/agentready/SuggestedReadinessFixPack';
import { createConnectedGitHubConnection } from '@/lib/githubConnection/types';
import { buildSampleReport } from '@/lib/readiness';
import { buildSuggestedReadinessFixPack } from '@/lib/readinessFixPack';

describe('SuggestedReadinessFixPack', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders suggested files, score mapping, and Create Readiness PR action', () => {
    render(<SuggestedReadinessFixPack report={buildSampleReport()} />);

    expect(screen.getByText('Suggested Readiness Fix Pack')).toBeInTheDocument();
    expect(screen.getByText(/ShipSeal can generate the missing repository files/i)).toBeInTheDocument();
    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CLAUDE.md').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CONTRIBUTING.md').length).toBeGreaterThan(0);
    expect(screen.getAllByText('.github/workflows/ci.yml').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI agent instruction readiness/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/These files are already included in your Delivery Pack/i)).toBeInTheDocument();
    expect(screen.getByText('Delivery Pack')).toBeInTheDocument();
    expect(screen.getByText(/Client handoff package with reports, AI Act readiness, testing pack and agent instructions/i)).toBeInTheDocument();
    expect(screen.getByText('Readiness Fix Pack')).toBeInTheDocument();
    expect(screen.getByText(/Repository files you can add back to your project to improve future scans/i)).toBeInTheDocument();
    expect(screen.getAllByText('Create Readiness PR').length).toBeGreaterThan(0);
    expect(screen.getByText('MVP write')).toBeInTheDocument();
    expect(screen.getByText(/Preview the repository changes ShipSeal would propose in a safe pull request/i)).toBeInTheDocument();
    expect(screen.getByText('shipseal/readiness-pack')).toBeInTheDocument();
    expect(screen.getByText('Add ShipSeal readiness and agent governance pack')).toBeInTheDocument();
    expect(screen.getByText(/ShipSeal will not push directly to main/i)).toBeInTheDocument();
    expect(screen.getByText(/Then open a Pull Request on GitHub/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create Readiness PR$/i })).toBeEnabled();
    expect(screen.getAllByText(/Copy manual Git steps/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Download Readiness Fix Pack/i).length).toBeGreaterThan(0);
  });

  it('opens the Create Readiness PR modal, validates token, and shows success URL', async () => {
    const report = {
      ...buildSampleReport(),
      source: {
        sourceType: 'github-url' as const,
        githubOwner: 'Csisz',
        githubRepo: 'shipseal',
        githubBranch: 'main',
        sourceUrl: 'https://github.com/Csisz/shipseal',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        pullRequestUrl: 'https://github.com/Csisz/shipseal/pull/12',
        branchName: 'shipseal/readiness-pack',
        baseBranch: 'main',
        fileCount: 8,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestedReadinessFixPack report={report} />);
    fireEvent.click(screen.getByRole('button', { name: /^Create Readiness PR$/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Step 1: Review changes/i)).toBeInTheDocument();
    expect(within(dialog).getByText('shipseal/readiness-pack')).toBeInTheDocument();
    expect(within(dialog).getByText('AGENTS.md')).toBeInTheDocument();
    expect(within(dialog).getByText('.github/workflows/ci.yml')).toBeInTheDocument();
    expect(within(dialog).getByText(/This PR includes a GitHub Actions workflow file/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText('Connect GitHub').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Connect GitHub before creating a Pull Request/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/GitHub App install is not configured in this demo/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Connect GitHub$/i })).toBeDisabled();
    expect(within(dialog).getByText('Advanced: use a temporary token')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('GitHub token')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Advanced: use a temporary token/i }));
    expect(within(dialog).getByLabelText('GitHub token')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/I understand ShipSeal will create a branch/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));
    expect(within(dialog).getByText(/GitHub token is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('GitHub token'), { target: { value: 'ghp_mock' } });
    fireEvent.click(within(dialog).getByLabelText(/I understand ShipSeal will create a branch/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/create-readiness-pr', expect.objectContaining({ method: 'POST' })));
    expect(await within(dialog).findByText(/Readiness PR created/i)).toBeInTheDocument();
    expect(within(dialog).getByText('https://github.com/Csisz/shipseal/pull/12')).toBeInTheDocument();

    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload).toMatchObject({
      owner: 'Csisz',
      repo: 'shipseal',
      baseBranch: 'main',
      branchName: 'shipseal/readiness-pack',
    });
    expect(payload.files.map((file: { path: string }) => file.path)).toContain('.github/workflows/ci.yml');
  });

  it('auto-fills owner and repo from a GitHub source URL and allows an empty base branch', async () => {
    const report = {
      ...buildSampleReport(),
      repoName: 'shipseal',
      source: {
        sourceType: 'github-url' as const,
        sourceUrl: 'https://github.com/Csisz/shipseal',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        pullRequestUrl: 'https://github.com/Csisz/shipseal/pull/12',
        branchName: 'shipseal/readiness-pack',
        baseBranch: 'main',
        fileCount: 8,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestedReadinessFixPack report={report} />);
    fireEvent.click(screen.getByRole('button', { name: /^Create Readiness PR$/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Current repository: Csisz/shipseal')).toBeInTheDocument();
    expect(within(dialog).getByText(/Connect GitHub before creating a Pull Request/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('GitHub token')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Advanced: use a temporary token/i }));
    expect(within(dialog).getByLabelText('Repository owner')).toHaveValue('Csisz');
    expect(within(dialog).getByLabelText('Repository name')).toHaveValue('shipseal');
    expect(within(dialog).getByLabelText('Base branch')).toHaveValue('');
    expect(within(dialog).getByText(/Leave empty to use the repository default branch/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/ShipSeal keeps it in memory and does not store it/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/For production use, connect GitHub at repository source selection/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Developer\/test mode. For production use, connect GitHub/i)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('GitHub token'), { target: { value: 'ghp_mock' } });
    fireEvent.click(within(dialog).getByLabelText(/I understand ShipSeal will create a branch/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/create-readiness-pr', expect.objectContaining({ method: 'POST' })));
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload).toMatchObject({
      owner: 'Csisz',
      repo: 'shipseal',
      branchName: 'shipseal/readiness-pack',
    });
    expect(payload).not.toHaveProperty('baseBranch');
  });

  it('keeps owner and repo empty but editable for ZIP uploads', () => {
    const report = {
      ...buildSampleReport(),
      repoName: 'zip-upload',
      source: {
        sourceType: 'zip-upload' as const,
      },
    };

    render(<SuggestedReadinessFixPack report={report} />);
    fireEvent.click(screen.getByRole('button', { name: /^Create Readiness PR$/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Connect GitHub before creating a Pull Request/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Advanced: use a temporary token/i }));
    const ownerInput = within(dialog).getByLabelText('Repository owner');
    const repoInput = within(dialog).getByLabelText('Repository name');

    expect(ownerInput).toHaveValue('');
    expect(repoInput).toHaveValue('');
    expect(within(dialog).getByText(/Repository owner and name are required only if you want ShipSeal to create a GitHub Pull Request/i)).toBeInTheDocument();

    fireEvent.change(ownerInput, { target: { value: 'Csisz' } });
    fireEvent.change(repoInput, { target: { value: 'shipseal' } });

    expect(ownerInput).toHaveValue('Csisz');
    expect(repoInput).toHaveValue('shipseal');
  });

  it('enables Connect GitHub and opens the GitHub App install URL when configured', () => {
    const report = buildSampleReport();
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <CreateReadinessPrDialog
        report={report}
        files={buildSuggestedReadinessFixPack(report)}
        githubAppConfig={{
          appName: 'ShipSeal Demo',
          appSlug: 'shipseal-demo',
          installUrl: 'https://github.com/apps/shipseal-demo/installations/new',
          isConfigured: true,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Create Readiness PR$/i }));

    const dialog = screen.getByRole('dialog');
    const connectButton = within(dialog).getByRole('button', { name: /^Connect GitHub$/i });
    expect(connectButton).toBeEnabled();
    expect(within(dialog).queryByText(/GitHub App install is not configured in this demo/i)).not.toBeInTheDocument();

    fireEvent.click(connectButton);

    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/apps/shipseal-demo/installations/new',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('creates a Readiness PR through the connected GitHub App without a pasted token', async () => {
    const report = buildSampleReport();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        prUrl: 'https://github.com/Csisz/shipseal/pull/33',
        branchName: 'shipseal/readiness-pack',
        baseBranch: 'main',
        fileCount: 8,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateReadinessPrDialog
        report={report}
        files={buildSuggestedReadinessFixPack(report)}
        githubConnection={createConnectedGitHubConnection({
          owner: 'Csisz',
          repo: 'shipseal',
          defaultBranch: 'main',
          installationId: '123',
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Create Readiness PR$/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Connected repository: Csisz/shipseal')).toBeInTheDocument();
    expect(within(dialog).getByText('Connected')).toBeInTheDocument();
    expect(within(dialog).getByText(/ShipSeal will create the Readiness PR through the GitHub App/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('GitHub token')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Connect GitHub before creating a Pull Request/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText('Advanced: use a temporary token')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));
    expect(within(dialog).getByText(/Confirm that ShipSeal will create a branch/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText(/I understand ShipSeal will create a branch/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/create-readiness-pr', expect.objectContaining({ method: 'POST' })));
    expect(await within(dialog).findByText(/Readiness PR created/i)).toBeInTheDocument();
    expect(within(dialog).getByText('https://github.com/Csisz/shipseal/pull/33')).toBeInTheDocument();

    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload).toMatchObject({
      installationId: '123',
      owner: 'Csisz',
      repo: 'shipseal',
      baseBranch: 'main',
      branchName: 'shipseal/readiness-pack',
    });
    expect(payload).not.toHaveProperty('githubToken');
  });
});

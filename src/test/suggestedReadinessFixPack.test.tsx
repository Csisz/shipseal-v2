import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateReadinessPrDialog } from '@/components/agentready/CreateReadinessPrDialog';
import { SuggestedReadinessFixPack } from '@/components/agentready/SuggestedReadinessFixPack';
import { createConnectedGitHubConnection } from '@/lib/githubConnection/types';
import { buildSampleReport } from '@/lib/readiness';
import { buildSuggestedReadinessFixPack } from '@/lib/readinessFixPack';
import { buildReadinessPrPlan } from '@/lib/readinessPr';

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
    expect(screen.getAllByText('docs/shipseal/CI_QUALITY_GATE.example.yml').length).toBeGreaterThan(0);
    expect(screen.queryByText('.github/workflows/ci.yml')).not.toBeInTheDocument();
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
    expect(screen.getByText('Add ShipSeal readiness pack')).toBeInTheDocument();
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
    expect(within(dialog).getByText('docs/shipseal/CI_QUALITY_GATE.example.yml')).toBeInTheDocument();
    expect(within(dialog).queryByText('.github/workflows/ci.yml')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Include active GitHub Actions workflow')).not.toBeChecked();
    expect(within(dialog).queryByText(/This PR includes a GitHub Actions workflow file/i)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('Include active GitHub Actions workflow'));
    expect(within(dialog).getByText('.github/workflows/ci.yml')).toBeInTheDocument();
    expect(within(dialog).getByText(/This PR includes a GitHub Actions workflow file/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('Include active GitHub Actions workflow'));
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
      prTitle: 'Add ShipSeal readiness pack',
    });
    expect(payload.files.map((file: { path: string }) => file.path)).not.toContain('.github/workflows/ci.yml');
    expect(payload.files.map((file: { path: string }) => file.path)).toContain('docs/shipseal/CI_QUALITY_GATE.example.yml');
    expect(payload.prBody).toContain('Readiness score:');
    expect(payload.prBody).toContain('Uploaded or imported repository code was not executed');
    expect(payload.prBody).toContain('It is not installed as an active GitHub Actions workflow');
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
    expect(within(dialog).getByText(/Temporary token mode keeps the token in memory only for this request/i)).toBeInTheDocument();
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
      prTitle: 'Add ShipSeal readiness pack',
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
    expect(within(dialog).getByText(/Repository owner and name are used only in developer\/test mode/i)).toBeInTheDocument();

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
      prTitle: 'Add ShipSeal readiness pack',
    });
    expect(payload).not.toHaveProperty('githubToken');
    expect(payload.files.map((file: { path: string }) => file.path)).toEqual(buildReadinessPrPlan().files.map(file => file.path));
    expect(payload.prBody).toContain('Readiness score:');
    expect(payload.prBody).toContain('Uploaded or imported repository code was not executed');
    expect(payload.prBody).toContain('CI workflow recommendation as an example');
  });

  it('distinguishes Agent development Delivery Pack outputs from the PR safe subset', async () => {
    const report = buildSampleReport();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        prUrl: 'https://github.com/Csisz/shipseal/pull/34',
        branchName: 'shipseal/readiness-pack',
        baseBranch: 'main',
        fileCount: 3,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateReadinessPrDialog
        report={report}
        files={buildSuggestedReadinessFixPack(report)}
        selectedPackages={['agent-readiness']}
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

    expect(within(dialog).getByText('Agent development pack')).toBeInTheDocument();
    expect(within(dialog).getByText('Delivery Pack outputs')).toBeInTheDocument();
    expect(within(dialog).getByText('11 files')).toBeInTheDocument();
    expect(within(dialog).getByText('PR safe subset')).toBeInTheDocument();
    expect(within(dialog).getByText('3 files')).toBeInTheDocument();
    expect(within(dialog).getByText(/safe reviewed subset of repository-ready files/i)).toBeInTheDocument();
    expect(within(dialog).queryByText('01-agent-instructions/CODEX_PROMPTS.md')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('.github/workflows/ci.yml')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText(/I understand ShipSeal will create a branch/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/github-app/create-readiness-pr', expect.objectContaining({ method: 'POST' })));
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(request.body);
    const paths = payload.files.map((file: { path: string }) => file.path);

    expect(paths).toEqual(['AGENTS.md', 'CLAUDE.md', 'docs/CRITICAL_FILES_POLICY.md']);
    expect(paths).not.toContain('.github/workflows/ci.yml');
    expect(payload.prBody).toContain('Selected package: Agent development pack');
    expect(payload.prBody).toContain('Delivery Pack outputs: 11');
    expect(payload.prBody).toContain('PR safe subset: 3');
    expect(payload.prBody).toContain('This PR adds a safe reviewed subset of the selected ShipSeal package');
    expect(payload.prBody).toContain('The downloadable Delivery Pack contains the full package outputs');
  });

  it('shows friendly guidance when the connected GitHub App cannot write to the selected repo', async () => {
    const report = buildSampleReport();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'GitHub App does not have permission to write to this repository.',
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
    fireEvent.click(within(dialog).getByLabelText(/I understand ShipSeal will create a branch/i));
    fireEvent.click(within(dialog).getByRole('button', { name: /Create Pull Request/i }));

    expect(await within(dialog).findByText(/GitHub App does not have permission to write to this repository/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Contents\/Pull requests permissions/i)).toBeInTheDocument();
  });
});

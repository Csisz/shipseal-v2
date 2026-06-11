import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadDropzone } from '@/components/agentready/UploadDropzone';

describe('UploadDropzone GitHub import copy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows repository source options before scanning', () => {
    render(<UploadDropzone onFile={vi.fn()} onGitHubImport={vi.fn()} />);

    expect(screen.getAllByText('Connect GitHub').length).toBeGreaterThan(0);
    expect(screen.getByText('Best for selecting repositories and creating Pull Requests.')).toBeInTheDocument();
    expect(screen.getByText('Import public GitHub URL')).toBeInTheDocument();
    expect(screen.getByText('Good for public repo scans. PR creation requires connection later.')).toBeInTheDocument();
    expect(screen.getByText('Upload ZIP')).toBeInTheDocument();
    expect(screen.getByText('Best for local/private review without GitHub access.')).toBeInTheDocument();
    expect(screen.getByLabelText('Select repository')).toHaveAttribute('placeholder', 'Connect GitHub to list repositories');
    expect(screen.getByText(/GitHub App connection is not configured in this demo/i)).toBeInTheDocument();
  });

  it('shows local MVP CORS and ZIP fallback guidance', () => {
    render(<UploadDropzone onFile={vi.fn()} onGitHubImport={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /import public github url/i }));

    expect(screen.getByText(/Paste a public GitHub repository URL/i)).toBeInTheDocument();
    expect(screen.getByText(/Public GitHub import may be blocked by browser CORS restrictions in local mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted demos can use the ShipSeal GitHub archive proxy/i)).toBeInTheDocument();
    expect(screen.getByText(/Local MVP note: if GitHub import is blocked, use Download ZIP on GitHub and upload it here/i)).toBeInTheDocument();
  });

  it('shows detected owner and repo for public GitHub URLs', () => {
    render(<UploadDropzone onFile={vi.fn()} onGitHubImport={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /import public github url/i }));
    fireEvent.change(screen.getByPlaceholderText('https://github.com/Csisz/shipseal'), {
      target: { value: 'https://github.com/Csisz/shipseal' },
    });

    expect(screen.getByText('Detected repository: Csisz/shipseal')).toBeInTheDocument();
  });

  it('opens GitHub App install when source-level Connect GitHub is configured', () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <UploadDropzone
        onFile={vi.fn()}
        onGitHubImport={vi.fn()}
        githubAppConfig={{
          appName: 'ShipSeal Demo',
          appSlug: 'shipseal-demo',
          installUrl: 'https://github.com/apps/shipseal-demo/installations/new',
          isConfigured: true,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));

    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/apps/shipseal-demo/installations/new',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders repository dropdown with loaded GitHub App repositories and selects a repo', () => {
    const onSelect = vi.fn();

    render(
      <UploadDropzone
        onFile={vi.fn()}
        onGitHubImport={vi.fn()}
        githubInstallationId="12345"
        repositoryListStatus="loaded"
        repositories={[{
          id: 1,
          owner: 'Csisz',
          name: 'shipseal',
          fullName: 'Csisz/shipseal',
          defaultBranch: 'main',
          private: false,
          htmlUrl: 'https://github.com/Csisz/shipseal',
        }]}
        onGitHubAppRepositorySelect={onSelect}
      />
    );

    fireEvent.change(screen.getByLabelText('Select repository'), { target: { value: 'Csisz/shipseal' } });

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'Csisz',
      name: 'shipseal',
      fullName: 'Csisz/shipseal',
      defaultBranch: 'main',
      private: false,
    }));
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadDropzone } from '@/components/agentready/UploadDropzone';

describe('UploadDropzone GitHub import copy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockPointerCaptureForRadixSelect = () => {
    if (!window.PointerEvent) {
      class MockPointerEvent extends MouseEvent {
        pointerId: number;
        pointerType: string;

        constructor(type: string, params: PointerEventInit = {}) {
          super(type, params);
          this.pointerId = params.pointerId ?? 1;
          this.pointerType = params.pointerType ?? 'mouse';
        }
      }

      window.PointerEvent = MockPointerEvent as typeof PointerEvent;
    }

    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    }

    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = vi.fn();
    }

    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = vi.fn();
    }

    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
  };

  it('shows repository source options before scanning', () => {
    render(<UploadDropzone onFile={vi.fn()} onGitHubImport={vi.fn()} />);

    expect(screen.getAllByText('Connect GitHub').length).toBeGreaterThan(0);
    expect(screen.getByText('Best for selecting repositories and creating Pull Requests.')).toBeInTheDocument();
    expect(screen.getByText('Import public GitHub URL')).toBeInTheDocument();
    expect(screen.getByText('Good for public repo scans. PR creation requires connection later.')).toBeInTheDocument();
    expect(screen.getByText('Upload ZIP')).toBeInTheDocument();
    expect(screen.getByText('Best for local/private review without GitHub access.')).toBeInTheDocument();
    expect(screen.getByLabelText('Select repository')).toHaveAttribute('placeholder', 'Connect GitHub to list repositories');
    expect(screen.getByRole('button', { name: /^Connect GitHub$/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Install or configure ShipSeal GitHub App/i })).not.toBeInTheDocument();
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

  it('starts popup GitHub Connect when source-level Connect GitHub is configured', () => {
    const onConnect = vi.fn();

    render(
      <UploadDropzone
        onFile={vi.fn()}
        onGitHubImport={vi.fn()}
        onGitHubConnect={onConnect}
        githubAppConfig={{
          appName: 'ShipSeal Demo',
          appSlug: 'shipseal-demo',
          installUrl: 'https://github.com/apps/shipseal-demo/installations/new',
          loginUrl: '/api/github-app/login',
          isConfigured: true,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('keeps install or configure as a separate secondary action', () => {
    const onConnect = vi.fn();
    const onInstall = vi.fn();

    render(
      <UploadDropzone
        onFile={vi.fn()}
        onGitHubImport={vi.fn()}
        onGitHubConnect={onConnect}
        onGitHubInstall={onInstall}
        githubAppConfig={{
          appName: 'ShipSeal Demo',
          appSlug: 'shipseal-demo',
          installUrl: 'https://github.com/apps/shipseal-demo/installations/new',
          loginUrl: '/api/github-app/login',
          isConfigured: true,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Connect GitHub$/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onInstall).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Install or configure ShipSeal GitHub App/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('renders a searchable repository picker and confirms a selected GitHub App repo', async () => {
    const onSelect = vi.fn();
    mockPointerCaptureForRadixSelect();

    render(
      <UploadDropzone
        onFile={vi.fn()}
        onGitHubImport={vi.fn()}
        githubInstallationId="12345"
        repositoryListStatus="loaded"
        onGitHubConnect={vi.fn()}
        repositories={[{
          id: 1,
          owner: 'Csisz',
          name: 'shipseal',
          fullName: 'Csisz/shipseal',
          defaultBranch: 'main',
          private: false,
          htmlUrl: 'https://github.com/Csisz/shipseal',
        }, {
          id: 2,
          owner: 'Csisz',
          name: 'demo-private',
          fullName: 'Csisz/demo-private',
          defaultBranch: 'develop',
          private: true,
          htmlUrl: 'https://github.com/Csisz/demo-private',
        }]}
        onGitHubAppRepositorySelect={onSelect}
      />
    );

    expect(screen.getByLabelText('Search repositories')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search repositories'), {
      target: { value: 'shipseal' },
    });

    fireEvent.pointerDown(screen.getByLabelText('Select repository', { selector: 'button' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByText('Csisz/shipseal'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getAllByText('Public').length).toBeGreaterThan(0);
    expect(screen.getAllByText('main').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /scan selected repository/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'Csisz',
      name: 'shipseal',
      fullName: 'Csisz/shipseal',
      defaultBranch: 'main',
      private: false,
    }));
  });
});

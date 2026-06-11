import { describe, expect, it } from 'vitest';
import {
  buildGitHubConnectionFromSource,
  createConnectedGitHubConnection,
  createPublicUrlConnection,
  createZipUploadConnection,
} from '@/lib/githubConnection/types';

describe('GitHub connection state', () => {
  it('marks public URL sources as scan-only for PR creation', () => {
    const state = createPublicUrlConnection('Csisz', 'shipseal', 'main');

    expect(state).toMatchObject({
      connectionStatus: 'not_connected',
      sourceMode: 'public-url',
      owner: 'Csisz',
      repo: 'shipseal',
      defaultBranch: 'main',
      canCreatePullRequest: false,
      canListRepositories: false,
    });
  });

  it('marks ZIP uploads as local scan/export only', () => {
    const state = createZipUploadConnection();

    expect(state).toMatchObject({
      connectionStatus: 'not_connected',
      sourceMode: 'zip-upload',
      canCreatePullRequest: false,
      canListRepositories: false,
    });
  });

  it('marks connected GitHub sources as PR-capable and preserves owner/repo', () => {
    const state = createConnectedGitHubConnection({
      owner: 'Csisz',
      repo: 'shipseal',
      defaultBranch: 'main',
      installationId: '123',
    });

    expect(state).toMatchObject({
      connectionStatus: 'connected',
      sourceMode: 'github-app',
      owner: 'Csisz',
      repo: 'shipseal',
      defaultBranch: 'main',
      installationId: '123',
      canCreatePullRequest: true,
      canListRepositories: true,
    });
  });

  it('derives owner and repo from public GitHub source metadata', () => {
    const state = buildGitHubConnectionFromSource({
      sourceType: 'github-url',
      sourceUrl: 'https://github.com/Csisz/shipseal',
    });

    expect(state).toMatchObject({
      sourceMode: 'public-url',
      owner: 'Csisz',
      repo: 'shipseal',
      canCreatePullRequest: false,
    });
  });
});

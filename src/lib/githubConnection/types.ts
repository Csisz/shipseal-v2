import type { ReadinessReport, ScanSourceMetadata } from '@/lib/types';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';

export type GitHubConnectionStatus = 'not_configured' | 'not_connected' | 'installation_detected' | 'connected' | 'error';
export type RepositorySourceMode = 'github-app' | 'public-url' | 'zip-upload';

export interface GitHubConnectionState {
  connectionStatus: GitHubConnectionStatus;
  sourceMode: RepositorySourceMode;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  installationId?: string;
  canCreatePullRequest: boolean;
  canListRepositories: boolean;
}

export function createZipUploadConnection(): GitHubConnectionState {
  return {
    connectionStatus: 'not_connected',
    sourceMode: 'zip-upload',
    canCreatePullRequest: false,
    canListRepositories: false,
  };
}

export function createPublicUrlConnection(owner?: string, repo?: string, defaultBranch?: string): GitHubConnectionState {
  return {
    connectionStatus: owner && repo ? 'not_connected' : 'error',
    sourceMode: 'public-url',
    owner,
    repo,
    defaultBranch,
    canCreatePullRequest: false,
    canListRepositories: false,
  };
}

export function createConnectedGitHubConnection(input: {
  owner: string;
  repo: string;
  defaultBranch?: string;
  installationId?: string;
}): GitHubConnectionState {
  return {
    connectionStatus: 'connected',
    sourceMode: 'github-app',
    owner: input.owner,
    repo: input.repo,
    defaultBranch: input.defaultBranch,
    installationId: input.installationId,
    canCreatePullRequest: true,
    canListRepositories: true,
  };
}

export function createInstallationDetectedConnection(input: {
  installationId: string;
}): GitHubConnectionState {
  return {
    connectionStatus: 'installation_detected',
    sourceMode: 'github-app',
    installationId: input.installationId,
    canCreatePullRequest: false,
    canListRepositories: false,
  };
}

export function buildGitHubConnectionFromReport(report: ReadinessReport): GitHubConnectionState {
  return buildGitHubConnectionFromSource(report.source);
}

export function buildGitHubConnectionFromSource(source: ScanSourceMetadata): GitHubConnectionState {
  if (source.sourceType === 'zip-upload') return createZipUploadConnection();

  const ownerRepo = inferOwnerRepo(source);
  if (source.githubInstallationId && ownerRepo.owner && ownerRepo.repo) {
    return createConnectedGitHubConnection({
      owner: ownerRepo.owner,
      repo: ownerRepo.repo,
      defaultBranch: source.githubDefaultBranch || source.githubBranch,
      installationId: source.githubInstallationId,
    });
  }
  return createPublicUrlConnection(ownerRepo.owner, ownerRepo.repo, source.githubDefaultBranch || source.githubBranch);
}

function inferOwnerRepo(source: ScanSourceMetadata) {
  if (source.githubOwner && source.githubRepo) {
    return { owner: source.githubOwner, repo: source.githubRepo };
  }
  if (source.sourceUrl) {
    try {
      const parsed = parseGitHubUrl(source.sourceUrl);
      return { owner: parsed.owner, repo: parsed.repo };
    } catch {
      return {};
    }
  }
  return {};
}

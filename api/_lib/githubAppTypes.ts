export interface GitHubAppServerConfig {
  appId: string;
  privateKey: string;
  apiBaseUrl: string;
}

export interface GitHubAppAuthOptions {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  now?: () => Date;
}

export interface GitHubAppRepositorySummary {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
  private: boolean;
  htmlUrl: string;
}

export class GitHubAppNotConfiguredError extends Error {
  constructor() {
    super('GitHub App server credentials are not configured yet.');
    this.name = 'GitHubAppNotConfiguredError';
  }
}

export class GitHubAppApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GitHubAppApiError';
  }
}

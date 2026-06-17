export interface GitHubAppServerConfig {
  appId: string;
  privateKey: string;
  apiBaseUrl: string;
}

export interface GitHubAppOAuthConfig {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
}

export interface GitHubAppAuthOptions {
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  now?: () => Date;
  redirectUri?: string;
}

export interface GitHubAppRepositorySummary {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
  private: boolean;
  htmlUrl: string;
  pushedAt?: string;
  updatedAt?: string;
}

export interface GitHubAppInstallationSummary {
  id: number;
  accountLogin: string;
  accountType?: string;
  htmlUrl?: string;
}

export type GitHubAppErrorCode =
  | 'missing_app_id'
  | 'missing_private_key'
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'missing_oauth_code'
  | 'github_oauth_denied'
  | 'github_oauth_error'
  | 'oauth_token_exchange_failed'
  | 'oauth_token_invalid_json'
  | 'invalid_private_key_format'
  | 'jwt_signing_failed'
  | 'installation_not_found'
  | 'user_authorization_failed'
  | 'github_api_error'
  | 'network_error';

export class GitHubAppNotConfiguredError extends Error {
  constructor(public readonly code: GitHubAppErrorCode = 'missing_app_id', message = 'GitHub App server credentials are not configured yet.') {
    super(message);
    this.name = 'GitHubAppNotConfiguredError';
  }
}

export class GitHubAppApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code: GitHubAppErrorCode = 'github_api_error') {
    super(message);
    this.name = 'GitHubAppApiError';
  }
}

export interface GitHubAppRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
  private: boolean;
  htmlUrl: string;
}

export type GitHubAppRepositoryListStatus = 'idle' | 'loading' | 'loaded' | 'not_configured' | 'error';

export interface GitHubAppInstallation {
  id: string;
  accountLogin: string;
  accountType?: string;
  htmlUrl?: string;
}

export type GitHubAppConnectionMessage =
  | {
      type?: 'shipseal:github-connected' | 'shipseal:github-installations';
      source: 'shipseal-github-connect';
      status: 'ok';
      installationId?: string;
      setupAction?: 'oauth' | string;
      installations?: GitHubAppInstallation[];
    }
  | {
      type?: 'shipseal:github-error' | 'shipseal:github-install-required';
      source: 'shipseal-github-connect';
      status: 'error';
      code?: string;
      message?: string;
    };

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
      source: 'shipseal-github-connect';
      status: 'ok';
      installationId?: string;
      installations?: GitHubAppInstallation[];
    }
  | {
      source: 'shipseal-github-connect';
      status: 'error';
      code?: string;
      message?: string;
    };

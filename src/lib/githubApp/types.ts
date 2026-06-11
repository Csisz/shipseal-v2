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

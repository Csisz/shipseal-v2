import type { GitHubAppAuthOptions, GitHubAppRepositorySummary } from './githubAppTypes.js';
import { GitHubAppApiError } from './githubAppTypes.js';
import { getInstallationAccessToken } from './githubAppAuth.js';

export class GitHubInstallationClient {
  constructor(
    private readonly token: string,
    private readonly apiBaseUrl: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async getJson<T>(path: string, options: { optional404?: boolean } = {}) {
    return this.requestJson<T>('GET', path, undefined, options);
  }

  async postJson<T>(path: string, body: unknown) {
    return this.requestJson<T>('POST', path, body);
  }

  async putJson<T>(path: string, body: unknown) {
    return this.requestJson<T>('PUT', path, body);
  }

  async getRaw(path: string) {
    const response = await this.fetcher(`${this.apiBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'follow',
    });
    if (!response.ok) throw new GitHubAppApiError(response.status, 'GitHub App archive download failed.');
    return response;
  }

  private async requestJson<T>(method: string, path: string, body?: unknown, options: { optional404?: boolean } = {}) {
    const response = await this.fetcher(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (options.optional404 && response.status === 404) return null as T;
    if (!response.ok) throw new GitHubAppApiError(response.status, `GitHub API request failed with status ${response.status}.`);
    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }
}

export async function createGitHubInstallationClient(installationId: string, options: GitHubAppAuthOptions = {}) {
  const access = await getInstallationAccessToken(installationId, options);
  return new GitHubInstallationClient(access.token, access.apiBaseUrl, options.fetcher);
}

export async function listGitHubAppRepositories(installationId: string, options: GitHubAppAuthOptions = {}): Promise<GitHubAppRepositorySummary[]> {
  const client = await createGitHubInstallationClient(installationId, options);
  const payload = await client.getJson<{ repositories?: Array<Record<string, unknown>> }>('/installation/repositories');
  return (payload.repositories || []).map(repo => {
    const owner = repo.owner && typeof repo.owner === 'object' ? repo.owner as Record<string, unknown> : {};
    return {
      id: typeof repo.id === 'number' ? repo.id : 0,
      owner: typeof owner.login === 'string' ? owner.login : '',
      name: typeof repo.name === 'string' ? repo.name : '',
      fullName: typeof repo.full_name === 'string' ? repo.full_name : '',
      defaultBranch: typeof repo.default_branch === 'string' ? repo.default_branch : undefined,
      private: repo.private === true,
      htmlUrl: typeof repo.html_url === 'string' ? repo.html_url : '',
    };
  }).filter(repo => repo.id && repo.owner && repo.name && repo.fullName);
}

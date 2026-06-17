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
    const response = await this.requestJson<T>('GET', path, undefined, options);
    return response.data;
  }

  async getJsonWithHeaders<T>(path: string, options: { optional404?: boolean } = {}) {
    return this.requestJson<T>('GET', path, undefined, options);
  }

  async postJson<T>(path: string, body: unknown) {
    const response = await this.requestJson<T>('POST', path, body);
    return response.data;
  }

  async putJson<T>(path: string, body: unknown) {
    const response = await this.requestJson<T>('PUT', path, body);
    return response.data;
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

    if (options.optional404 && response.status === 404) return { data: null as T, headers: response.headers };
    if (!response.ok) throw new GitHubAppApiError(response.status, `GitHub API request failed with status ${response.status}.`);
    if (response.status === 204) return { data: {} as T, headers: response.headers };
    return { data: await response.json() as T, headers: response.headers };
  }
}

export async function createGitHubInstallationClient(installationId: string, options: GitHubAppAuthOptions = {}) {
  const access = await getInstallationAccessToken(installationId, options);
  return new GitHubInstallationClient(access.token, access.apiBaseUrl, options.fetcher);
}

export async function listGitHubAppRepositories(installationId: string, options: GitHubAppAuthOptions = {}): Promise<GitHubAppRepositorySummary[]> {
  const client = await createGitHubInstallationClient(installationId, options);
  const repositories: Array<Record<string, unknown>> = [];
  const perPage = 100;
  let page = 1;

  while (true) {
    const response = await client.getJsonWithHeaders<{ repositories?: Array<Record<string, unknown>> }>(
      `/installation/repositories?per_page=${perPage}&page=${page}`
    );
    const pageRepositories = response.data.repositories || [];
    if (pageRepositories.length === 0) break;
    repositories.push(...pageRepositories);

    const linkHeader = getHeader(response.headers, 'link');
    const hasNextPage = linkHeader ? hasNextLink(linkHeader) : pageRepositories.length === perPage;
    if (!hasNextPage) break;
    page += 1;
  }

  return repositories.map(repo => {
    const owner = repo.owner && typeof repo.owner === 'object' ? repo.owner as Record<string, unknown> : {};
    const summary: GitHubAppRepositorySummary = {
      id: typeof repo.id === 'number' ? repo.id : 0,
      owner: typeof owner.login === 'string' ? owner.login : '',
      name: typeof repo.name === 'string' ? repo.name : '',
      fullName: typeof repo.full_name === 'string' ? repo.full_name : '',
      defaultBranch: typeof repo.default_branch === 'string' ? repo.default_branch : undefined,
      private: repo.private === true,
      htmlUrl: typeof repo.html_url === 'string' ? repo.html_url : '',
    };
    if (typeof repo.pushed_at === 'string') summary.pushedAt = repo.pushed_at;
    if (typeof repo.updated_at === 'string') summary.updatedAt = repo.updated_at;
    return {
      ...summary,
    };
  })
    .filter(repo => repo.id && repo.owner && repo.name && repo.fullName)
    .sort((a, b) => repositoryTimestamp(b) - repositoryTimestamp(a));
}

function getHeader(headers: Headers | undefined, name: string) {
  if (!headers) return '';
  return headers.get(name) || headers.get(name.toLowerCase()) || '';
}

function hasNextLink(linkHeader: string) {
  return linkHeader.split(',').some(link => /;\s*rel="next"/.test(link));
}

function repositoryTimestamp(repository: GitHubAppRepositorySummary) {
  const value = repository.pushedAt || repository.updatedAt || '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

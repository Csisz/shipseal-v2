import type { GitHubAppAuthOptions, GitHubAppInstallationSummary, GitHubAppOAuthConfig } from './githubAppTypes';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from './githubAppTypes';

export function getGitHubAppOAuthConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppOAuthConfig {
  const clientId = (env.GITHUB_APP_CLIENT_ID || '').trim();
  const clientSecret = (env.GITHUB_APP_CLIENT_SECRET || '').trim();
  const apiBaseUrl = (env.GITHUB_API_BASE_URL || 'https://api.github.com').trim().replace(/\/+$/, '');

  if (!clientId) throw new GitHubAppNotConfiguredError('missing_client_id', 'GitHub App OAuth client ID is missing.');
  if (!clientSecret) throw new GitHubAppNotConfiguredError('missing_client_secret', 'GitHub App OAuth client secret is missing.');
  return { clientId, clientSecret, apiBaseUrl };
}

export function buildGitHubOAuthAuthorizeUrl(input: { clientId: string; state?: string; redirectUri?: string }) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    scope: '',
  });
  if (input.state) params.set('state', input.state);
  if (input.redirectUri) params.set('redirect_uri', input.redirectUri);
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForUserToken(
  code: string,
  options: GitHubAppAuthOptions = {}
): Promise<{ token: string; apiBaseUrl: string }> {
  const config = getGitHubAppOAuthConfig(options.env);
  const fetcher = options.fetcher || fetch;
  let response: Response;
  try {
    response = await fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      }),
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub OAuth token request failed.', 'network_error');
  }

  if (!response.ok) {
    throw new GitHubAppApiError(response.status, 'GitHub user authorization failed.', 'user_authorization_failed');
  }

  const payload = await response.json() as { access_token?: string; error?: string };
  if (!payload.access_token || payload.error) {
    throw new GitHubAppApiError(401, 'GitHub user authorization failed.', 'user_authorization_failed');
  }

  return { token: payload.access_token, apiBaseUrl: config.apiBaseUrl };
}

export async function listUserInstallations(
  token: string,
  options: GitHubAppAuthOptions & { apiBaseUrl?: string } = {}
): Promise<GitHubAppInstallationSummary[]> {
  const fetcher = options.fetcher || fetch;
  const apiBaseUrl = (options.apiBaseUrl || options.env?.GITHUB_API_BASE_URL || 'https://api.github.com').trim().replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetcher(`${apiBaseUrl}/user/installations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub installation discovery failed.', 'network_error');
  }

  if (!response.ok) {
    throw new GitHubAppApiError(response.status, 'GitHub installation discovery failed.', 'github_api_error');
  }

  const payload = await response.json() as { installations?: Array<Record<string, unknown>> };
  return (payload.installations || []).map(installation => {
    const account = installation.account && typeof installation.account === 'object'
      ? installation.account as Record<string, unknown>
      : {};
    return {
      id: typeof installation.id === 'number' ? installation.id : 0,
      accountLogin: typeof account.login === 'string' ? account.login : '',
      accountType: typeof account.type === 'string' ? account.type : undefined,
      htmlUrl: typeof installation.html_url === 'string' ? installation.html_url : undefined,
    };
  }).filter(installation => installation.id && installation.accountLogin);
}

export async function authorizeAndListInstallations(code: string, options: GitHubAppAuthOptions = {}) {
  const access = await exchangeCodeForUserToken(code, options);
  return listUserInstallations(access.token, { ...options, apiBaseUrl: access.apiBaseUrl });
}

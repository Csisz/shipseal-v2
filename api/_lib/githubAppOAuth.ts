import type { GitHubAppAuthOptions, GitHubAppInstallationSummary, GitHubAppOAuthConfig, GitHubAppUserIdentity } from './githubAppTypes.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from './githubAppTypes.js';
import { AuthConfigurationError, getGitHubOAuthConfig as readGitHubOAuthConfig } from './authConfig.js';

export function getGitHubAppOAuthConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppOAuthConfig {
  try {
    return readGitHubOAuthConfig(env);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      const code = error.code === 'missing_client_id' || error.code === 'missing_client_secret' || error.code === 'invalid_client_id_format' || error.code === 'invalid_api_base_url'
        ? error.code
        : 'missing_client_secret';
      throw new GitHubAppNotConfiguredError(code, error.message);
    }
    throw error;
  }
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
        ...(options.redirectUri ? { redirect_uri: options.redirectUri } : {}),
      }),
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub OAuth token request failed.', 'network_error');
  }

  if (!response.ok) {
    throw new GitHubAppApiError(response.status, 'GitHub OAuth token exchange failed.', 'oauth_token_exchange_failed');
  }

  let payload: { access_token?: string; error?: string; error_description?: string };
  try {
    payload = await response.json() as { access_token?: string; error?: string; error_description?: string };
  } catch {
    throw new GitHubAppApiError(502, 'GitHub OAuth token response was not valid JSON.', 'oauth_token_invalid_json');
  }

  if (payload.error) {
    throw new GitHubAppApiError(401, 'GitHub OAuth token exchange failed.', 'github_oauth_error');
  }
  if (!payload.access_token) {
    throw new GitHubAppApiError(401, 'GitHub OAuth token exchange did not return an access token.', 'github_oauth_error');
  }

  return { token: payload.access_token, apiBaseUrl: config.apiBaseUrl };
}

export async function listUserInstallations(
  token: string,
  options: GitHubAppAuthOptions & { apiBaseUrl?: string } = {}
): Promise<GitHubAppInstallationSummary[]> {
  const fetcher = options.fetcher || fetch;
  const apiBaseUrl = (options.apiBaseUrl || options.env?.GITHUB_API_BASE_URL || 'https://api.github.com').trim().replace(/\/+$/, '');
  const discovered: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 10; page += 1) {
    let response: Response;
    try {
      response = await fetcher(`${apiBaseUrl}/user/installations?per_page=100&page=${page}`, {
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
      throw new GitHubAppApiError(response.status, 'GitHub installation discovery failed.', response.status === 401 ? 'user_authorization_failed' : 'github_api_error');
    }

    let payload: { installations?: Array<Record<string, unknown>> };
    try {
      payload = await response.json() as { installations?: Array<Record<string, unknown>> };
    } catch {
      throw new GitHubAppApiError(502, 'GitHub installation discovery response was not valid JSON.', 'github_api_error');
    }
    const pageInstallations = payload.installations || [];
    discovered.push(...pageInstallations);
    if (pageInstallations.length < 100) break;
  }
  return discovered.map(installation => {
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

export async function getGitHubUserIdentity(
  token: string,
  options: GitHubAppAuthOptions & { apiBaseUrl?: string } = {},
): Promise<GitHubAppUserIdentity> {
  const fetcher = options.fetcher || fetch;
  const apiBaseUrl = (options.apiBaseUrl || options.env?.GITHUB_API_BASE_URL || 'https://api.github.com').trim().replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetcher(`${apiBaseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub user identity lookup failed.', 'network_error');
  }
  if (!response.ok) {
    throw new GitHubAppApiError(response.status, 'GitHub user identity could not be verified.', 'user_authorization_failed');
  }
  let payload: { id?: number; login?: string };
  try {
    payload = await response.json() as { id?: number; login?: string };
  } catch {
    throw new GitHubAppApiError(502, 'GitHub user identity response was not valid JSON.', 'github_api_error');
  }
  if (!payload.id || !payload.login) {
    throw new GitHubAppApiError(502, 'GitHub user identity response was incomplete.', 'github_api_error');
  }
  return { id: payload.id, login: payload.login };
}

export async function authorizeGitHubConnection(code: string, options: GitHubAppAuthOptions = {}) {
  const access = await exchangeCodeForUserToken(code, options);
  const [user, installations] = await Promise.all([
    getGitHubUserIdentity(access.token, { ...options, apiBaseUrl: access.apiBaseUrl }),
    listUserInstallations(access.token, { ...options, apiBaseUrl: access.apiBaseUrl }),
  ]);
  return { user, installations, accessToken: access.token, apiBaseUrl: access.apiBaseUrl };
}

export async function authorizeAndListInstallations(code: string, options: GitHubAppAuthOptions = {}) {
  const access = await exchangeCodeForUserToken(code, options);
  return listUserInstallations(access.token, { ...options, apiBaseUrl: access.apiBaseUrl });
}

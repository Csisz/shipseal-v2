import { createSign } from 'node:crypto';
import type { GitHubAppAuthOptions, GitHubAppServerConfig } from './githubAppTypes.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from './githubAppTypes.js';
import { AuthConfigurationError, getGitHubInstallationConfig, normalizeGitHubPrivateKey } from './authConfig.js';

export function normalizeGitHubAppPrivateKey(value: string) {
  return normalizeGitHubPrivateKey(value);
}

export function getGitHubAppServerConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppServerConfig {
  try {
    return getGitHubInstallationConfig(env);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      const code = error.code === 'missing_app_id' || error.code === 'missing_private_key' || error.code === 'invalid_private_key_format' || error.code === 'invalid_api_base_url'
        ? error.code
        : 'invalid_private_key_format';
      throw new GitHubAppNotConfiguredError(code, error.message);
    }
    throw error;
  }
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function createGitHubAppJwt(config: GitHubAppServerConfig, now = () => new Date()) {
  const timestamp = Math.floor(now().getTime() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: timestamp - 60,
    exp: timestamp + 9 * 60,
    iss: config.appId,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  try {
    return `${unsigned}.${signer.sign(config.privateKey, 'base64url')}`;
  } catch {
    throw new GitHubAppNotConfiguredError('jwt_signing_failed', 'GitHub App private key could not sign a JWT.');
  }
}

export async function getInstallationAccessToken(installationId: string, options: GitHubAppAuthOptions = {}) {
  const config = getGitHubAppServerConfig(options.env);
  const jwt = createGitHubAppJwt(config, options.now);
  const fetcher = options.fetcher || fetch;

  let response: Response;
  try {
    response = await fetcher(`${config.apiBaseUrl}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub App installation token request failed.', 'network_error');
  }

  if (!response.ok) {
    throw new GitHubAppApiError(response.status, response.status === 404
      ? 'GitHub App installation was not found.'
      : 'GitHub App installation token request failed.', response.status === 404 ? 'installation_not_found' : 'github_api_error');
  }

  const payload = await response.json() as { token?: string };
  if (!payload.token) throw new GitHubAppApiError(502, 'GitHub App installation token response was missing a token.', 'github_api_error');
  return { token: payload.token, apiBaseUrl: config.apiBaseUrl };
}

export async function getGitHubAppInstallationSummary(installationId: string, options: GitHubAppAuthOptions = {}) {
  const config = getGitHubAppServerConfig(options.env);
  const jwt = createGitHubAppJwt(config, options.now);
  const fetcher = options.fetcher || fetch;
  let response: Response;
  try {
    response = await fetcher(`${config.apiBaseUrl}/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub App installation verification failed.', 'network_error');
  }
  if (!response.ok) {
    throw new GitHubAppApiError(response.status, 'GitHub App installation verification failed.', response.status === 404 ? 'installation_not_found' : 'github_api_error');
  }
  const payload = await response.json() as { id?: number; account?: { login?: string; type?: string }; html_url?: string };
  if (!payload.id || !payload.account?.login) {
    throw new GitHubAppApiError(502, 'GitHub App installation verification response was incomplete.', 'github_api_error');
  }
  return {
    id: payload.id,
    accountLogin: payload.account.login,
    accountType: payload.account.type,
    htmlUrl: payload.html_url,
  };
}

export async function verifyGitHubAppIdentity(options: GitHubAppAuthOptions = {}) {
  const env = options.env || process.env;
  const appConfig = getGitHubAppServerConfig(env);
  const oauthClientId = (env.GITHUB_APP_CLIENT_ID || '').trim();
  const configuredSlug = (env.GITHUB_APP_SLUG || env.VITE_GITHUB_APP_SLUG || '').trim().toLowerCase();
  const jwt = createGitHubAppJwt(appConfig, options.now);
  const fetcher = options.fetcher || fetch;
  let response: Response;
  try {
    response = await fetcher(`${appConfig.apiBaseUrl}/app`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GitHubAppApiError(502, 'GitHub App identity verification failed.', 'network_error');
  }
  if (!response.ok) throw new GitHubAppApiError(response.status, 'GitHub App identity verification failed.', 'github_api_error');
  const payload = await response.json() as { id?: number; client_id?: string; slug?: string; name?: string };
  if (!payload.id || !payload.client_id || !payload.slug) {
    throw new GitHubAppApiError(502, 'GitHub App identity verification response was incomplete.', 'github_api_error');
  }
  if (oauthClientId && payload.client_id !== oauthClientId) {
    throw new GitHubAppApiError(503, 'GitHub OAuth client ID does not belong to the configured GitHub App.', 'app_identity_mismatch');
  }
  if (configuredSlug && payload.slug.toLowerCase() !== configuredSlug) {
    throw new GitHubAppApiError(503, 'GitHub App slug does not match the configured GitHub App credentials.', 'app_slug_mismatch');
  }
  return { id: payload.id, clientId: payload.client_id, slug: payload.slug, name: payload.name || payload.slug };
}

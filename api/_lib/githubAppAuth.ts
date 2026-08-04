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

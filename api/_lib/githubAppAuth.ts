import { createSign } from 'node:crypto';
import type { GitHubAppAuthOptions, GitHubAppServerConfig } from './githubAppTypes';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from './githubAppTypes';

export function normalizeGitHubAppPrivateKey(value: string) {
  return value.trim().replace(/\\n/g, '\n');
}

export function getGitHubAppServerConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppServerConfig {
  const appId = (env.GITHUB_APP_ID || '').trim();
  const privateKey = normalizeGitHubAppPrivateKey(env.GITHUB_APP_PRIVATE_KEY || '');
  const apiBaseUrl = (env.GITHUB_API_BASE_URL || 'https://api.github.com').trim().replace(/\/+$/, '');

  if (!appId || !privateKey) throw new GitHubAppNotConfiguredError();
  return { appId, privateKey, apiBaseUrl };
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
  return `${unsigned}.${signer.sign(config.privateKey, 'base64url')}`;
}

export async function getInstallationAccessToken(installationId: string, options: GitHubAppAuthOptions = {}) {
  const config = getGitHubAppServerConfig(options.env);
  const jwt = createGitHubAppJwt(config, options.now);
  const fetcher = options.fetcher || fetch;

  const response = await fetcher(`${config.apiBaseUrl}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new GitHubAppApiError(response.status, response.status === 404
      ? 'GitHub App installation was not found.'
      : 'GitHub App installation token request failed.');
  }

  const payload = await response.json() as { token?: string };
  if (!payload.token) throw new GitHubAppApiError(502, 'GitHub App installation token response was missing a token.');
  return { token: payload.token, apiBaseUrl: config.apiBaseUrl };
}

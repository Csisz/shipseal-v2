import { existsSync, readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import startHandler from '../../api/github-app/start';
import callbackHandler from '../../api/github-app/callback';
import oauthCallbackHandler from '../../api/github-app/oauth-callback';
import installationsHandler from '../../api/github-app/installations';
import repositoriesHandler, { listInstallationRepositories } from '../../api/github-app/repositories';
import archiveHandler from '../../api/github-app/archive';
import createGitHubAppPrHandler, {
  createReadinessPrWithGitHubApp,
  validateGitHubAppPrRequest,
} from '../../api/github-app/create-readiness-pr';
import {
  createGitHubAppJwt,
  getGitHubAppServerConfig,
  normalizeGitHubAppPrivateKey,
} from '../../api/_lib/githubAppAuth';
import { GitHubAppNotConfiguredError } from '../../api/_lib/githubAppTypes';

function createResponse() {
  return {
    statusCode: 0,
    body: '',
    headers: {} as Record<string, string>,
    setHeader: vi.fn(),
    end(value = '') {
      this.body = value;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}

describe('GitHub App Connect plan', () => {
  it('/api/github-app/start redirects to GitHub OAuth authorization', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const res = createResponse();

    try {
      await startHandler({ method: 'GET', headers: { host: 'shipseal.test', 'x-forwarded-proto': 'https' } } as never, res as never);

      expect(res.statusCode).toBe(302);
      const location = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(call => call[0] === 'Location')?.[1] as string;
      expect(location).toContain('https://github.com/login/oauth/authorize?');
      expect(location).toContain('client_id=client-id');
      expect(location).toContain('redirect_uri=https%3A%2F%2Fshipseal.test%2Fapi%2Fgithub-app%2Foauth-callback');
      expect(location).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/callback rejects missing installation_id', async () => {
    const res = createResponse();

    await callbackHandler({ method: 'GET', url: '/api/github-app/callback' } as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      status: 'invalid_request',
      message: 'GitHub App callback is missing a valid installation_id.',
    });
  });

  it('/api/github-app/callback redirects installation_id back to the frontend scan flow', async () => {
    const res = createResponse();

    await callbackHandler({
      method: 'GET',
      url: '/api/github-app/callback?installation_id=12345&setup_action=install',
    } as never, res as never);

    expect(res.statusCode).toBe(302);
    expect(res.setHeader).toHaveBeenCalledWith('Location', '/?githubInstallationId=12345&githubSetupAction=install#scan');
  });

  it('/api/github-app/repositories validates installationId and reports missing server env', async () => {
    const missing = createResponse();
    await repositoriesHandler({ method: 'GET', url: '/api/github-app/repositories' } as never, missing as never);
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ status: 'invalid_request' });

    const notConfigured = await listInstallationRepositories('12345', { env: {} as NodeJS.ProcessEnv });
    expect(notConfigured).toEqual({
      status: 501,
      body: {
        status: 'not_configured',
        code: 'missing_app_id',
        message: 'GitHub App server credentials are not configured yet.',
      },
    });
  });

  it('/api/github-app/repositories returns minimized repositories with mocked GitHub API calls', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ token: 'installation-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          repositories: [
            {
              id: 1,
              owner: { login: 'Csisz' },
              name: 'shipseal',
              full_name: 'Csisz/shipseal',
              default_branch: 'main',
              private: false,
              html_url: 'https://github.com/Csisz/shipseal',
            },
          ],
        }),
      });

    const result = await listInstallationRepositories('12345', {
      fetcher: fetchMock as never,
      now: () => new Date(Date.UTC(2026, 5, 8, 8, 0)),
      env: {
        GITHUB_APP_ID: '999',
        GITHUB_APP_PRIVATE_KEY: privatePem,
      } as NodeJS.ProcessEnv,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        status: 'ok',
        repositories: [{
          owner: 'Csisz',
          id: 1,
          name: 'shipseal',
          fullName: 'Csisz/shipseal',
          defaultBranch: 'main',
          private: false,
          htmlUrl: 'https://github.com/Csisz/shipseal',
        }],
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.github.com/app/installations/12345/access_tokens', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.github.com/installation/repositories', expect.objectContaining({ method: 'GET' }));
  });

  it('normalizes GitHub App private keys and reports missing env as not configured', () => {
    expect(normalizeGitHubAppPrivateKey('-----BEGIN\\nKEY\\n-----END')).toContain('\nKEY\n');
    expect(() => getGitHubAppServerConfig({} as NodeJS.ProcessEnv)).toThrow(GitHubAppNotConfiguredError);

    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const jwt = createGitHubAppJwt({ appId: '999', privateKey: privatePem, apiBaseUrl: 'https://api.github.com' }, () => new Date(Date.UTC(2026, 5, 8, 8, 0)));
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('/api/github-app/archive validates params and returns not_configured without server env', async () => {
    const missing = createResponse();
    await archiveHandler({ method: 'GET', url: '/api/github-app/archive?installationId=123&owner=Csisz' } as never, missing as never);
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ status: 'invalid_request' });

    const notConfigured = createResponse();
    await archiveHandler({ method: 'GET', url: '/api/github-app/archive?installationId=123&owner=Csisz&repo=shipseal' } as never, notConfigured as never);
    expect(notConfigured.statusCode).toBe(501);
    expect(notConfigured.json()).toEqual({
      status: 'not_configured',
      code: 'missing_app_id',
      message: 'GitHub App server credentials are not configured yet.',
    });
  });

  it('/api/github-app/oauth-callback returns postMessage HTML for existing installations', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'user-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          installations: [{
            id: 12345,
            account: { login: 'Csisz', type: 'User' },
            html_url: 'https://github.com/settings/installations/12345',
          }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback?code=abc' } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('window.opener.postMessage');
      expect(res.body).toContain('"source":"shipseal-github-connect"');
      expect(res.body).toContain('"installationId":"12345"');
      expect(res.body).not.toContain('client-secret');
      expect(res.body).not.toContain('user-token');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/oauth-callback returns a safe error page when code is missing', async () => {
    const res = createResponse();

    await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback' } as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('user_authorization_failed');
    expect(res.body).toContain('Return to ShipSeal');
    expect(res.body).not.toContain('GITHUB_APP_CLIENT_SECRET');
    expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
  });

  it('/api/github-app/installations discovers already-installed app accounts from user authorization', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'user-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ installations: [{ id: 7, account: { login: 'Acme', type: 'Organization' } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await installationsHandler({ method: 'GET', url: '/api/github-app/installations?code=abc' } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        status: 'ok',
        installations: [{ id: '7', accountLogin: 'Acme', accountType: 'Organization', htmlUrl: undefined }],
      });
      expect(res.body).not.toContain('user-token');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/archive streams a mocked zipball without exposing tokens', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const originalEnv = process.env;
    process.env = { ...originalEnv, GITHUB_APP_ID: '999', GITHUB_APP_PRIVATE_KEY: privatePem };
    const zip = Buffer.from('PK-demo');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ token: 'installation-token' }) })
      .mockResolvedValueOnce(new Response(zip, { status: 200, headers: { 'content-length': String(zip.byteLength) } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    await archiveHandler({ method: 'GET', url: '/api/github-app/archive?installationId=123&owner=Csisz&repo=shipseal&ref=main' } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('installation-token');
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('validates GitHub App PR payload branch safety', () => {
    const base = {
      installationId: '123',
      owner: 'Csisz',
      repo: 'shipseal',
      branchName: 'shipseal/readiness-pack',
      prTitle: 'Add ShipSeal readiness and agent governance pack',
      prBody: 'Generated by ShipSeal',
      files: [{ path: 'AGENTS.md', content: 'Generated by ShipSeal' }],
    };

    expect(validateGitHubAppPrRequest({ ...base, installationId: '' }))
      .toEqual({ status: 400, error: 'A valid installationId is required.' });
    expect(validateGitHubAppPrRequest({ ...base, branchName: 'main' }))
      .toEqual({ status: 400, error: 'Target branch must use the shipseal/ prefix and must not be main, master, develop, or trunk.' });
    expect(validateGitHubAppPrRequest(base)).toMatchObject(base);
  });

  it('/api/github-app/create-readiness-pr reports missing server env as structured not_configured JSON', async () => {
    const originalEnv = process.env;
    process.env = {};
    const res = createResponse();

    try {
      await createGitHubAppPrHandler({
        method: 'POST',
        body: {
          installationId: '123',
          owner: 'Csisz',
          repo: 'shipseal',
          branchName: 'shipseal/readiness-pack',
          prTitle: 'Add ShipSeal readiness and agent governance pack',
          prBody: 'Generated by ShipSeal',
          files: [{ path: 'AGENTS.md', content: 'Generated by ShipSeal' }],
        },
      } as never, res as never);

      expect(res.statusCode).toBe(501);
      expect(res.json()).toEqual({
        status: 'not_configured',
        error: 'GitHub App server credentials are not configured yet.',
      });
    } finally {
      process.env = originalEnv;
    }
  });

  it('creates a GitHub App Readiness PR with mocked GitHub calls and no token in response', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`);
      if (url.endsWith('/access_tokens')) return { ok: true, status: 201, json: async () => ({ token: 'installation-token' }) };
      if (url.endsWith('/repos/Csisz/shipseal')) return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
      if (url.endsWith('/repos/Csisz/shipseal/git/ref/heads/main')) return { ok: true, status: 200, json: async () => ({ object: { sha: 'base-sha' } }) };
      if (url.endsWith('/repos/Csisz/shipseal/git/refs')) return { ok: true, status: 201, json: async () => ({ ref: 'refs/heads/shipseal/readiness-pack' }) };
      if (url.includes('/contents/')) {
        if ((init?.method || 'GET') === 'GET') return { ok: false, status: 404, json: async () => ({}) };
        return { ok: true, status: 201, json: async () => ({}) };
      }
      if (url.endsWith('/repos/Csisz/shipseal/pulls')) return { ok: true, status: 201, json: async () => ({ html_url: 'https://github.com/Csisz/shipseal/pull/12' }) };
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const result = await createReadinessPrWithGitHubApp({
      installationId: '123',
      owner: 'Csisz',
      repo: 'shipseal',
      branchName: 'shipseal/readiness-pack',
      prTitle: 'Add ShipSeal readiness and agent governance pack',
      prBody: 'Generated by ShipSeal',
      files: [{ path: 'AGENTS.md', content: 'Generated by ShipSeal' }],
    }, {
      fetcher: fetchMock as never,
      env: { GITHUB_APP_ID: '999', GITHUB_APP_PRIVATE_KEY: privatePem } as NodeJS.ProcessEnv,
      now: () => new Date(Date.UTC(2026, 5, 8, 8, 0)),
    });

    expect(result).toEqual({
      prUrl: 'https://github.com/Csisz/shipseal/pull/12',
      branchName: 'shipseal/readiness-pack',
      baseBranch: 'main',
      fileCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain('installation-token');
    expect(calls.some(call => call.includes('/git/ref/heads/main'))).toBe(true);
    expect(calls.some(call => call.includes('/git/refs'))).toBe(true);
    expect(calls.some(call => call.includes('/contents/AGENTS.md'))).toBe(true);
    expect(calls.some(call => call.includes('/pulls'))).toBe(true);
  });

  it('documents the GitHub App architecture and README roadmap', () => {
    expect(existsSync('docs/GITHUB_APP_CONNECT_PLAN.md')).toBe(true);

    const plan = readFileSync('docs/GITHUB_APP_CONNECT_PLAN.md', 'utf8');
    const readme = readFileSync('README.md', 'utf8');

    expect(plan).toContain('Metadata: read');
    expect(plan).toContain('Contents: read/write');
    expect(plan).toContain('Pull requests: read/write');
    expect(plan).toContain('Workflows: read/write');
    expect(plan).toContain('Repository Source Modes');
    expect(plan).toContain('GitHub App connected repo: scan + PR creation');
    expect(plan).toContain('Public GitHub URL: public archive scan + export');
    expect(plan).toContain('Never push directly to `main`');
    expect(plan).toContain('VITE_GITHUB_APP_SLUG');
    expect(plan).toContain('VITE_GITHUB_APP_INSTALL_URL');
    expect(plan).toContain('Create a GitHub App For Local/Demo Testing');
    expect(plan).toContain('GITHUB_APP_ID');
    expect(plan).toContain('GITHUB_APP_CALLBACK_URL');
    expect(readme).toContain('Connect GitHub Roadmap');
    expect(readme).toContain('Repository source modes');
    expect(readme).toContain('GitHub App connected repo: scan + PR creation');
    expect(readme).toContain('Connect GitHub` opens the GitHub App install page');
    expect(readme).toContain('Create a GitHub App for local/demo testing');
    expect(readme).toContain('temporary token mode');
    expect(readme).toContain('private repository support through GitHub App installation');
  });
});

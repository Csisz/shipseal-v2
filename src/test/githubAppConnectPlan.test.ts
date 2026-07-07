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

function githubRepositoryPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const name = typeof overrides.name === 'string' ? overrides.name : 'shipseal';
  const owner = typeof overrides.owner === 'object' ? overrides.owner : { login: 'Csisz' };
  return {
    id: 1,
    owner,
    name,
    full_name: `Csisz/${name}`,
    default_branch: 'main',
    private: false,
    html_url: `https://github.com/Csisz/${name}`,
    ...overrides,
  };
}

function jsonGitHubResponse(body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

describe('GitHub App Connect plan', () => {
  it('imports GitHub Connect serverless handlers with Vercel-compatible relative imports', async () => {
    const [loginModule, callbackModule, installationsModule, repositoriesModule] = await Promise.all([
      import('../../api/github-app/login'),
      import('../../api/github-app/oauth-callback'),
      import('../../api/github-app/installations'),
      import('../../api/github-app/repositories'),
    ]);

    expect(typeof loginModule.default).toBe('function');
    expect(typeof callbackModule.default).toBe('function');
    expect(typeof installationsModule.default).toBe('function');
    expect(typeof repositoriesModule.default).toBe('function');

    const apiFiles = [
      'api/create-readiness-pr.ts',
      'api/github-app/archive.ts',
      'api/github-app/create-readiness-pr.ts',
      'api/github-app/installations.ts',
      'api/github-app/oauth-callback.ts',
      'api/github-app/repositories.ts',
      'api/github-app/start.ts',
      'api/_lib/githubAppAuth.ts',
      'api/_lib/githubAppClient.ts',
      'api/_lib/githubAppOAuth.ts',
    ];
    for (const file of apiFiles) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"]\.{1,2}\/(?![^'"]+\.js['"])[^'"]+['"]/);
    }
  });

  it('/api/github-app/start redirects to GitHub OAuth authorization', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'Iv1.0123456789abcdef',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_INSTALL_URL: 'https://github.com/settings/installations/139037392',
    };
    const res = createResponse();

    try {
      await startHandler({ method: 'GET', headers: { host: 'shipseal.test', 'x-forwarded-proto': 'https' } } as never, res as never);

      expect(res.statusCode).toBe(302);
      const location = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(call => call[0] === 'Location')?.[1] as string;
      expect(location).toContain('https://github.com/login/oauth/authorize?');
      expect(location).toContain('client_id=Iv1.0123456789abcdef');
      expect(location).toContain('redirect_uri=https%3A%2F%2Fshipseal.test%2Fapi%2Fgithub-app%2Foauth-callback');
      expect(location).toContain('state=');
      expect(location).not.toContain('github.com/settings/installations');
      expect(location).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login accepts the deployed GitHub App client ID shape without strict prefix matching', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'cfdd8f4457f94a121791bfc9580eaec60e8050b4',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_SLUG: 'shipseal-demo',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(302);
      const location = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(call => call[0] === 'Location')?.[1] as string;
      expect(location).toContain('https://github.com/login/oauth/authorize?');
      expect(location).toContain('client_id=cfdd8f4457f94a121791bfc9580eaec60e8050b4');
      expect(location).toContain('redirect_uri=https%3A%2F%2Fshipseal-v2.vercel.app%2Fapi%2Fgithub-app%2Foauth-callback');
      expect(location).toContain('state=');
      expect(location).not.toContain('github.com/settings/installations');
      expect(location).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login returns a friendly popup error when OAuth env is missing', async () => {
    const originalEnv = process.env;
    process.env = {};
    const res = createResponse();

    try {
      await startHandler({ method: 'GET', headers: { host: 'shipseal.test' } } as never, res as never);

      expect(res.statusCode).toBe(500);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.body).toContain('GitHub login is not configured correctly.');
      expect(res.body).toContain('missing_client_id');
      expect(res.body).toContain('GITHUB_APP_CLIENT_ID');
      expect(res.body).toContain('Close and retry');
      expect(res.body).toContain('Use public GitHub URL instead');
      expect(res.body).not.toContain('client-secret');
      expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login validates configured callback URL safely', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_CALLBACK_URL: 'https://shipseal-v2.vercel.app/not-the-callback',
    };
    const res = createResponse();

    try {
      await startHandler({ method: 'GET', headers: { host: 'shipseal-v2.vercel.app' } } as never, res as never);

      expect(res.statusCode).toBe(500);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.body).toContain('invalid_callback_url');
      expect(res.body).toContain('GitHub App callback URL must point to /api/github-app/oauth-callback.');
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login?debug=1 returns safe OAuth diagnostics', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'Iv1.0123456789abcdef',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_CALLBACK_URL: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login?debug=1',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(res.json()).toMatchObject({
        ok: true,
        flow: 'oauth_authorize',
        authorizeUrlHost: 'github.com',
        authorizeUrlPath: '/login/oauth/authorize',
        clientIdPresent: true,
        clientIdLooksValid: true,
        clientSecretPresent: true,
        redirectUri: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
        redirectUriOrigin: 'https://shipseal-v2.vercel.app',
        redirectUriPathname: '/api/github-app/oauth-callback',
        requiredCallbackUrl: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
        fallbackInstallUrl: '',
        callbackUrlConfigured: true,
        callbackUrlUsable: true,
        missingEnv: [],
        invalidFields: [],
      });
      expect(res.body).not.toContain('client-secret');
      expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login?debug=1 marks inferred Vercel callback URL usable without explicit callback env', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'cfdd8f4457f94a121791bfc9580eaec60e8050b4',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_SLUG: 'shipseal-demo',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login?debug=1',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        ok: true,
        flow: 'oauth_authorize',
        clientIdPresent: true,
        clientIdLooksValid: true,
        clientSecretPresent: true,
        redirectUri: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
        requiredCallbackUrl: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
        fallbackInstallUrl: 'https://github.com/apps/shipseal-demo/installations/new',
        callbackUrlConfigured: false,
        callbackUrlUsable: true,
        missingEnv: [],
        invalidFields: [],
      });
      expect(res.body).not.toContain('client-secret');
      expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login does not silently fall back to install when OAuth config is known-bad', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: '123456',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_SLUG: 'shipseal-demo',
      GITHUB_APP_CALLBACK_URL: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(500);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.body).toContain('GitHub login is not configured correctly.');
      expect(res.body).toContain('invalid_client_id_format');
      expect(res.body).not.toContain('github.com/settings/installations');
      expect(res.body).not.toContain('github.com/apps/shipseal-demo/installations/new');
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login returns a friendly popup error when client secret is missing', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'Iv1.0123456789abcdef',
      GITHUB_APP_SLUG: 'shipseal-demo',
      GITHUB_APP_CALLBACK_URL: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(500);
      expect(res.body).toContain('missing_client_secret');
      expect(res.body).toContain('GITHUB_APP_CLIENT_SECRET');
      expect(res.body).not.toContain('github.com/settings/installations');
      expect(res.body).not.toContain('github.com/apps/shipseal-demo/installations/new');
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login?debug=1 reports OAuth config errors and install fallback URL without exposing secrets', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: '123456',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_SLUG: 'shipseal-demo',
      GITHUB_APP_CALLBACK_URL: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login?debug=1',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(500);
      expect(res.json()).toMatchObject({
        ok: false,
        flow: 'oauth_authorize',
        clientIdPresent: true,
        clientIdLooksValid: false,
        clientSecretPresent: true,
        redirectUri: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
        fallbackInstallUrl: 'https://github.com/apps/shipseal-demo/installations/new',
        callbackUrlUsable: true,
        invalidFields: ['GITHUB_APP_CLIENT_ID'],
        errorCode: 'invalid_client_id_format',
      });
      expect(res.body).not.toContain('client-secret');
      expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
    } finally {
      process.env = originalEnv;
    }
  });

  it('/api/github-app/login?flow=install opens the explicit GitHub App install/configure flow', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: '123456',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_SLUG: 'shipseal-demo',
      GITHUB_APP_CALLBACK_URL: 'https://shipseal-v2.vercel.app/api/github-app/oauth-callback',
    };
    const res = createResponse();

    try {
      await startHandler({
        method: 'GET',
        url: '/api/github-app/login?flow=install',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(302);
      expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://github.com/apps/shipseal-demo/installations/new');
      expect(res.body).not.toContain('client-secret');
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
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.github.com/installation/repositories?per_page=100&page=1', expect.objectContaining({ method: 'GET' }));
  });

  it('/api/github-app/repositories fetches multiple pages of GitHub App repositories', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ token: 'installation-token' }),
      })
      .mockResolvedValueOnce(jsonGitHubResponse({
        repositories: [githubRepositoryPayload({ id: 1, name: 'shipseal' })],
      }, {
        link: '<https://api.github.com/installation/repositories?per_page=100&page=2>; rel="next"',
      }))
      .mockResolvedValueOnce(jsonGitHubResponse({
        repositories: [githubRepositoryPayload({ id: 2, name: 'shipseal-v2' })],
      }));

    const result = await listInstallationRepositories('12345', {
      fetcher: fetchMock as never,
      now: () => new Date(Date.UTC(2026, 5, 8, 8, 0)),
      env: {
        GITHUB_APP_ID: '999',
        GITHUB_APP_PRIVATE_KEY: privatePem,
      } as NodeJS.ProcessEnv,
    });

    expect(result.status).toBe(200);
    expect((result.body.repositories as Array<{ fullName: string }>).map(repo => repo.fullName))
      .toEqual(['Csisz/shipseal', 'Csisz/shipseal-v2']);
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.github.com/installation/repositories?per_page=100&page=1', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.github.com/installation/repositories?per_page=100&page=2', expect.objectContaining({ method: 'GET' }));
  });

  it('/api/github-app/repositories includes repositories returned from page 2 in the final list', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ token: 'installation-token' }),
      })
      .mockResolvedValueOnce(jsonGitHubResponse({
        repositories: [githubRepositoryPayload({ id: 1, name: 'older-repo' })],
      }, {
        link: '<https://api.github.com/installation/repositories?per_page=100&page=2>; rel="next"',
      }))
      .mockResolvedValueOnce(jsonGitHubResponse({
        repositories: [githubRepositoryPayload({ id: 2, name: 'missing-before-pagination' })],
      }));

    const result = await listInstallationRepositories('12345', {
      fetcher: fetchMock as never,
      now: () => new Date(Date.UTC(2026, 5, 8, 8, 0)),
      env: {
        GITHUB_APP_ID: '999',
        GITHUB_APP_PRIVATE_KEY: privatePem,
      } as NodeJS.ProcessEnv,
    });

    expect(result.status).toBe(200);
    expect((result.body.repositories as Array<{ fullName: string }>).map(repo => repo.fullName))
      .toContain('Csisz/missing-before-pagination');
  });

  it('/api/github-app/repositories sorts newer pushed or updated repositories first', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ token: 'installation-token' }),
      })
      .mockResolvedValueOnce(jsonGitHubResponse({
        repositories: [
          githubRepositoryPayload({ id: 1, name: 'older', pushed_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z' }),
          githubRepositoryPayload({ id: 2, name: 'newer-updated', updated_at: '2026-06-10T10:00:00Z' }),
          githubRepositoryPayload({ id: 3, name: 'newer-pushed', pushed_at: '2026-06-15T10:00:00Z', updated_at: '2026-06-02T10:00:00Z' }),
        ],
      }));

    const result = await listInstallationRepositories('12345', {
      fetcher: fetchMock as never,
      now: () => new Date(Date.UTC(2026, 5, 8, 8, 0)),
      env: {
        GITHUB_APP_ID: '999',
        GITHUB_APP_PRIVATE_KEY: privatePem,
      } as NodeJS.ProcessEnv,
    });

    expect(result.status).toBe(200);
    expect((result.body.repositories as Array<{ name: string }>).map(repo => repo.name))
      .toEqual(['newer-pushed', 'newer-updated', 'older']);
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
      expect(res.body).toContain('"type":"shipseal:github-connected"');
      expect(res.body).toContain('"source":"shipseal-github-connect"');
      expect(res.body).toContain('"installationId":"12345"');
      expect(res.body).toContain('"setupAction":"oauth"');
      expect(res.body).not.toContain('client-secret');
      expect(res.body).not.toContain('user-token');
      const firstCall = fetchMock.mock.calls[0];
      expect(firstCall[0]).toBe('https://github.com/login/oauth/access_token');
      expect(firstCall[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      });
      expect(JSON.parse(String(firstCall[1]?.body))).toMatchObject({
        client_id: 'client-id',
        client_secret: 'client-secret',
        code: 'abc',
        redirect_uri: 'http://localhost:8080/api/github-app/oauth-callback',
      });
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/oauth-callback posts multiple installation options to the opener', async () => {
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
          installations: [
            { id: 123, account: { login: 'Personal', type: 'User' } },
            { id: 456, account: { login: 'Acme', type: 'Organization' } },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback?code=abc' } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('"type":"shipseal:github-installations"');
      expect(res.body).toContain('"status":"ok"');
      expect(res.body).toContain('"id":"123"');
      expect(res.body).toContain('"id":"456"');
      expect(res.body).not.toContain('"installationId"');
      expect(res.body).not.toContain('user-token');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/oauth-callback shows install fallback when no installations are available', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_APP_SLUG: 'shipseal-demo',
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
        json: async () => ({ installations: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback?code=abc' } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('"type":"shipseal:github-install-required"');
      expect(res.body).toContain('"status":"error"');
      expect(res.body).toContain('"code":"no_installations"');
      expect(res.body).toContain('Install ShipSeal GitHub App');
      expect(res.body).toContain('https://github.com/apps/shipseal-demo/installations/new');
      expect(res.body).not.toContain('window.setTimeout(function () { window.close(); }, 100);');
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
    expect(res.body).toContain('missing_oauth_code');
    expect(res.body).toContain('Return to ShipSeal');
    expect(res.body).not.toContain('GITHUB_APP_CLIENT_SECRET');
    expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
  });

  it('/api/github-app/oauth-callback returns a structured error page for GitHub error params', async () => {
    const res = createResponse();

    await oauthCallbackHandler({
      method: 'GET',
      url: '/api/github-app/oauth-callback?error=access_denied&error_description=The+user+cancelled+authorization',
    } as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('window.opener.postMessage');
    expect(res.body).toContain('"source":"shipseal-github-connect"');
    expect(res.body).toContain('"status":"error"');
    expect(res.body).toContain('"code":"github_oauth_denied"');
    expect(res.body).toContain('The user cancelled authorization');
    expect(res.body).not.toContain('GITHUB_APP_CLIENT_SECRET');
    expect(res.body).not.toContain('GITHUB_APP_PRIVATE_KEY');
  });

  it('/api/github-app/oauth-callback returns a friendly error when token exchange is non-200', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad_verification_code', access_token: 'leaked-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback?code=bad' } as never, res as never);

      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('"code":"oauth_token_exchange_failed"');
      expect(res.body).toContain('Return to ShipSeal');
      expect(res.body).not.toContain('bad_verification_code');
      expect(res.body).not.toContain('leaked-token');
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/oauth-callback returns a friendly error when token exchange JSON is invalid', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json raw body');
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback?code=abc' } as never, res as never);

      expect(res.statusCode).toBe(502);
      expect(res.body).toContain('"code":"oauth_token_invalid_json"');
      expect(res.body).not.toContain('not json raw body');
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/oauth-callback returns a friendly error for GitHub OAuth error payloads', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: 'redirect_uri_mismatch', error_description: 'raw mismatch details' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({ method: 'GET', url: '/api/github-app/oauth-callback?code=abc' } as never, res as never);

      expect(res.statusCode).toBe(401);
      expect(res.body).toContain('"code":"github_oauth_error"');
      expect(res.body).not.toContain('redirect_uri_mismatch');
      expect(res.body).not.toContain('raw mismatch details');
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
  });

  it('/api/github-app/oauth-callback?debug=1 returns safe diagnostics without exchanging the code', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_APP_CLIENT_ID: 'client-id',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    try {
      await oauthCallbackHandler({
        method: 'GET',
        url: '/api/github-app/oauth-callback?debug=1&code=abc',
        headers: { host: 'shipseal-v2.vercel.app', 'x-forwarded-proto': 'https' },
      } as never, res as never);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        codePresent: true,
        clientIdPresent: true,
        clientSecretPresent: true,
        callbackUrlUsable: true,
        tokenExchangeAttempted: false,
        tokenExchangeStatus: 'not_attempted',
        installationsAttempted: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(res.body).not.toContain('client-secret');
    } finally {
      process.env = originalEnv;
      vi.unstubAllGlobals();
    }
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
      prTitle: 'Add ShipSeal readiness pack',
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
          prTitle: 'Add ShipSeal readiness pack',
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
      prTitle: 'Add ShipSeal readiness pack',
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
    expect(existsSync('docs/github/GITHUB_APP_CONNECT_PLAN.md')).toBe(true);

    const plan = readFileSync('docs/github/GITHUB_APP_CONNECT_PLAN.md', 'utf8');
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
    expect(plan).toContain('GITHUB_APP_CLIENT_ID');
    expect(plan).toContain('GITHUB_APP_CALLBACK_URL');
    expect(plan).toContain('The primary `Connect GitHub` action opens `/api/github-app/login`');
    expect(readme).toContain('Connect GitHub Roadmap');
    expect(readme).toContain('Repository source modes');
    expect(readme).toContain('GitHub App connected repo: scan + PR creation');
    expect(readme).toContain('The primary `Connect GitHub` action opens `/api/github-app/login`');
    expect(readme).toContain('Install or configure ShipSeal GitHub App');
    expect(readme).toContain('Create a GitHub App for local/demo testing');
    expect(readme).toContain('temporary token mode');
    expect(readme).toContain('private repository support through GitHub App installation');
  });
});

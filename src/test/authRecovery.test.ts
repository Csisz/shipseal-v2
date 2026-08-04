import { afterEach, describe, expect, it, vi } from 'vitest';
import accountLogin from '../../api/_routes/account/login';
import githubRouter from '../../api/github-app-router';
import { getAccountOAuthConfig, inspectAuthConfiguration, safeAuthDiagnostic } from '../../api/_lib/authConfig';

function createResponse() {
  return {
    statusCode: 0,
    body: '',
    headersSent: false,
    setHeader: vi.fn(),
    end(value = '') { this.body = String(value); },
  };
}

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

describe('production auth recovery boundaries', () => {
  it('centralizes account OAuth and persistence validation without exposing values', () => {
    const secret = 'account-secret-do-not-expose';
    const env = {
      ...original,
      VERCEL_ENV: 'production',
      SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID: 'Iv1.account-client',
      SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET: secret,
      SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL: 'http://localhost/api/account/callback',
      DATABASE_URL: '',
    };

    expect(() => getAccountOAuthConfig(env)).toThrow();
    const diagnostics = inspectAuthConfiguration('account-oauth', env);
    expect(diagnostics).toMatchObject({ configured: false, persistenceConfigured: false, callbackUrlUsable: false });
    expect(JSON.stringify(diagnostics)).not.toContain(secret);
  });

  it('renders a recoverable account popup when production settings are missing', async () => {
    process.env = { ...original, VERCEL_ENV: 'production' };
    delete process.env.SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID;
    delete process.env.SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET;
    delete process.env.SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL;
    delete process.env.DATABASE_URL;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = createResponse();

    await accountLogin({ method: 'GET', url: '/api/account/login' } as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toContain('shipseal-account');
    expect(res.body).toContain('Anonymous scanning');
    expect(res.body).not.toMatch(/CLIENT_SECRET|DATABASE_URL=/);
  });

  it('keeps the shared GitHub router alive when login configuration is absent', async () => {
    process.env = { ...original, VERCEL: '1', VERCEL_ENV: 'production' };
    delete process.env.GITHUB_APP_CLIENT_ID;
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    const res = createResponse();

    await githubRouter({ method: 'GET', url: '/api/github-app/login', headers: { host: 'shipseal.test' }, query: { route: 'login' } } as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toContain('shipseal-github-connect');
    expect(res.body).toContain('Use public GitHub URL instead');
  });

  it('returns only bounded diagnostic fields for unexpected errors', () => {
    const diagnostic = safeAuthDiagnostic(new Error('token=super-secret'));
    expect(diagnostic).toEqual({ area: 'unknown', code: 'route_failure', missingEnv: [], invalidFields: [] });
    expect(JSON.stringify(diagnostic)).not.toContain('super-secret');
  });
});

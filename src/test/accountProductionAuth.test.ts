import { afterEach, describe, expect, it, vi } from 'vitest';
import accountCallback from '../../api/_routes/account/callback';
import accountLogin from '../../api/_routes/account/login';
import accountSession from '../../api/_routes/account/session';
import {
  ACCOUNT_AUTH_PROVIDER,
  ACCOUNT_OAUTH_SCOPE,
  SHIPSEAL_PRODUCTION_ORIGIN,
  AuthConfigurationError,
  getAccountOAuthConfig,
  validateAccountRequestOrigin,
} from '../../api/_lib/authConfig';
import {
  ACCOUNT_OAUTH_STATE_COOKIE,
  ACCOUNT_RETURN_COOKIE,
  ACCOUNT_SESSION_COOKIE,
  createAccountSession,
  createOAuthState,
  safeReturnPath,
} from '../../api/_lib/accountSession';
import { setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { buildSaveProjectRequest } from '@/lib/persistence/buildSnapshot';
import { buildSampleReport } from '@/lib/readiness';

const originalEnv = { ...process.env };
const productionEnv: NodeJS.ProcessEnv = {
  ...originalEnv,
  VERCEL: '1',
  VERCEL_ENV: 'production',
  NODE_ENV: 'production',
  SHIPSEAL_APP_ORIGIN: SHIPSEAL_PRODUCTION_ORIGIN,
  SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID: 'Iv1.shipseal-account',
  SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET: 'github-oauth-secret-for-tests',
  SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL: `${SHIPSEAL_PRODUCTION_ORIGIN}/api/account/callback`,
  DATABASE_URL: 'postgresql://shipseal:test@db.example.test/shipseal?sslmode=require',
};

function response() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 0,
    body: '',
    headersSent: false,
    setHeader(name: string, value: string | string[]) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
    json() { return JSON.parse(this.body) as Record<string, unknown>; },
    headers,
  };
}

function deployedHeaders(host = 'www.getshipseal.com') {
  return { host, 'x-forwarded-host': host, 'x-forwarded-proto': 'https' };
}

function expectConfigError(env: NodeJS.ProcessEnv, code: string, field: string) {
  try {
    getAccountOAuthConfig(env);
    throw new Error('Expected account configuration to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(AuthConfigurationError);
    expect(error).toMatchObject({ code, area: 'account-oauth' });
    expect([...(error as AuthConfigurationError).missingEnv, ...(error as AuthConfigurationError).invalidFields]).toContain(field);
    expect(JSON.stringify(error)).not.toContain(env.SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET || 'not-present');
  }
}

afterEach(() => {
  process.env = { ...originalEnv };
  setAccountPersistenceStoreForTests(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ShipSeal Production account configuration', () => {
  it('accepts the complete canonical Production contract', () => {
    const config = getAccountOAuthConfig(productionEnv);
    expect(config).toMatchObject({
      applicationOrigin: SHIPSEAL_PRODUCTION_ORIGIN,
      callbackUrl: `${SHIPSEAL_PRODUCTION_ORIGIN}/api/account/callback`,
      provider: ACCOUNT_AUTH_PROVIDER,
      scope: ACCOUNT_OAUTH_SCOPE,
    });
  });

  it('builds the canonical provider redirect and requested scopes from Production', async () => {
    process.env = { ...productionEnv };
    const res = response();
    await accountLogin({ method: 'GET', url: '/api/account/login?returnTo=%2Faccount%2Fcomplete', headers: deployedHeaders() } as never, res as never);

    expect(res.statusCode).toBe(302);
    const location = new URL(String(res.getHeader('Location')));
    expect(location.origin).toBe('https://github.com');
    expect(location.pathname).toBe('/login/oauth/authorize');
    expect(location.searchParams.get('redirect_uri')).toBe(`${SHIPSEAL_PRODUCTION_ORIGIN}/api/account/callback`);
    expect(location.searchParams.get('scope')).toBe(ACCOUNT_OAUTH_SCOPE);
    expect((res.getHeader('Set-Cookie') as string[]).every(value => value.includes('Secure'))).toBe(true);
  });

  it('returns typed failures for each missing persistence or OAuth value', () => {
    expectConfigError({ ...productionEnv, SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID: '' }, 'missing_account_client_id', 'SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID');
    expectConfigError({ ...productionEnv, SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET: '' }, 'missing_account_client_secret', 'SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET');
    expectConfigError({ ...productionEnv, SHIPSEAL_APP_ORIGIN: '' }, 'missing_application_origin', 'SHIPSEAL_APP_ORIGIN');
    expectConfigError({ ...productionEnv, DATABASE_URL: '' }, 'missing_database_url', 'DATABASE_URL');
  });

  it('rejects invalid callback and database URLs without returning their values', () => {
    expectConfigError({ ...productionEnv, SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL: 'https://getshipseal.com/api/account/callback' }, 'account_callback_origin_mismatch', 'SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL');
    expectConfigError({ ...productionEnv, DATABASE_URL: 'https://db.example.test/shipseal' }, 'invalid_database_url', 'DATABASE_URL');
  });

  it('rejects Preview and apex requests that do not match the canonical configured origin', () => {
    const config = getAccountOAuthConfig(productionEnv);
    expect(() => validateAccountRequestOrigin({ headers: deployedHeaders('shipseal-preview.vercel.app') } as never, config, { ...productionEnv, VERCEL_ENV: 'preview' }))
      .toThrowError(expect.objectContaining({ code: 'request_origin_mismatch' }));
    expect(() => validateAccountRequestOrigin({ headers: deployedHeaders('getshipseal.com') } as never, config, productionEnv))
      .toThrowError(expect.objectContaining({ code: 'request_origin_mismatch' }));
  });

  it('does not accept GitHub App installation credentials as account identity credentials', () => {
    const separated = {
      ...productionEnv,
      SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID: '',
      SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET: '',
      GITHUB_APP_CLIENT_ID: 'Iv1.github-app-client',
      GITHUB_APP_CLIENT_SECRET: 'github-app-secret',
    };
    expectConfigError(separated, 'missing_account_client_id', 'SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID');

    const accountOnly = { ...productionEnv, GITHUB_APP_CLIENT_ID: '', GITHUB_APP_CLIENT_SECRET: '', GITHUB_APP_ID: '', GITHUB_APP_PRIVATE_KEY: '' };
    expect(getAccountOAuthConfig(accountOnly).provider).toBe('github');
  });

  it('keeps return paths local and canonicalizes safe application paths', () => {
    expect(safeReturnPath('/account/complete?from=projects')).toBe('/account/complete?from=projects');
    expect(safeReturnPath('https://attacker.example/path')).toBe('/');
    expect(safeReturnPath('//attacker.example/path')).toBe('/');
    expect(safeReturnPath('/\\attacker.example/path')).toBe('/');
    expect(safeReturnPath('/%2f%2fattacker.example/path')).toBe('/');
    expect(safeReturnPath('/%5c%5cattacker.example/path')).toBe('/');
  });

  it('uses host-only secure cookies for OAuth state and database-backed sessions', async () => {
    const req = { headers: deployedHeaders() } as never;
    const oauthResponse = response();
    createOAuthState(oauthResponse as never, req, '/account/complete');
    const oauthCookies = oauthResponse.getHeader('Set-Cookie') as string[];
    expect(oauthCookies).toHaveLength(2);

    const store = new InMemoryAccountPersistenceStore();
    const user = await store.upsertOAuthUser({ providerSubject: 'cookie-user', email: null, displayName: 'Cookie User', avatarUrl: null });
    const sessionResponse = response();
    await createAccountSession(req, sessionResponse as never, user.id, store);
    const allCookies = [...oauthCookies, ...sessionResponse.getHeader('Set-Cookie') as string[]];
    for (const value of allCookies) {
      expect(value).toContain('Secure');
      expect(value).toContain('HttpOnly');
      expect(value).toContain('SameSite=Lax');
      expect(value).toContain('Path=/');
      expect(value).not.toMatch(/;\s*Domain=/i);
    }
  });

  it('completes mocked OAuth, establishes a session, and persists owned history and verification', async () => {
    process.env = { ...productionEnv };
    const store = new InMemoryAccountPersistenceStore();
    setAccountPersistenceStoreForTests(store);
    const state = 'oauth-state-value-that-is-long-enough';
    const cookieHeader = `${ACCOUNT_OAUTH_STATE_COOKIE}=${state}; ${ACCOUNT_RETURN_COOKIE}=${encodeURIComponent('/account/complete')}`;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'temporary-oauth-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42, login: 'shipseal-owner', name: 'ShipSeal Owner', email: 'owner@example.test', avatar_url: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const callbackResponse = response();

    await accountCallback({
      method: 'GET',
      url: `/api/account/callback?code=oauth-code&state=${state}`,
      headers: { ...deployedHeaders(), cookie: cookieHeader },
    } as never, callbackResponse as never);

    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.getHeader('Location')).toBe('/account/complete');
    const setCookies = callbackResponse.getHeader('Set-Cookie') as string[];
    const sessionCookie = setCookies.filter(value => value.startsWith(`${ACCOUNT_SESSION_COOKIE}=`)).at(-1);
    expect(sessionCookie).toBeDefined();
    expect(callbackResponse.body).not.toContain('temporary-oauth-token');

    const sessionResponse = response();
    await accountSession({ method: 'GET', headers: { cookie: sessionCookie!.split(';')[0] } } as never, sessionResponse as never);
    const user = sessionResponse.json().user as { id: string; displayName: string };
    expect(user.displayName).toBe('ShipSeal Owner');

    const baseline = await store.saveProjectAndScan(user.id, buildSaveProjectRequest({ report: buildSampleReport(), idempotencyKey: `save_${'a'.repeat(32)}` }));
    const rescanInput = buildSaveProjectRequest({ report: buildSampleReport(), idempotencyKey: `save_${'b'.repeat(32)}` });
    rescanInput.scan.verificationRelationship = {
      version: 'shipseal.verification-relationship.v1',
      baselineScanId: baseline.scan.id,
      state: 'verified',
      verifiedAt: new Date().toISOString(),
      algorithmVersion: 'shipseal.repository-intelligence-verification.v1',
      expectedArtifactIds: ['artifact-1'],
    };
    const rescan = await store.saveProjectAndScan(user.id, rescanInput);
    const repeatedRescan = await store.saveProjectAndScan(user.id, rescanInput);
    const projects = await store.listProjects(user.id, 50, 0);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id: baseline.project.id, scanCount: 2 });
    expect(await store.listScans(user.id, baseline.project.id, 50, 0)).toHaveLength(2);
    expect(repeatedRescan.scan.id).toBe(rescan.scan.id);
    expect((await store.getScan(user.id, rescan.scan.id))?.scan.baselineScanId).toBe(baseline.scan.id);
    expect(store.verifications).toEqual([expect.objectContaining({ ownerId: user.id, projectId: baseline.project.id, baselineScanId: baseline.scan.id, rescanId: rescan.scan.id })]);
  });
});

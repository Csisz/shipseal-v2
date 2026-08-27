import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import accountRouter from '../../api/account-router';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';

const root = resolve(__dirname, '..', '..');
const originalEnv = { ...process.env };

function response() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 0,
    body: '',
    headersSent: false,
    setHeader(name: string, value: string | string[]) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
  setAccountPersistenceStoreForTests(null);
  vi.restoreAllMocks();
});

describe('production server-function recovery', () => {
  it('loads every account route module and the persistence v2 schema without router fallback', async () => {
    const [login, callback, session, logout, accountDelete, persistence] = await Promise.all([
      import('../../api/_routes/account/login'),
      import('../../api/_routes/account/callback'),
      import('../../api/_routes/account/session'),
      import('../../api/_routes/account/logout'),
      import('../../api/_routes/account/delete'),
      import('@/lib/persistence/schema'),
    ]);
    expect([login, callback, session, logout, accountDelete].every(module => typeof module.default === 'function')).toBe(true);
    expect(persistence.VERIFICATION_RELATIONSHIP_SCHEMA_VERSION).toBe('shipseal.verification-relationship.v2');
  });

  it('routes a valid Production account login instead of returning account_route_unavailable', async () => {
    process.env = {
      ...originalEnv,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      NODE_ENV: 'production',
      SHIPSEAL_APP_ORIGIN: 'https://www.getshipseal.com',
      SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID: 'Iv1.shipseal-account',
      SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET: 'test-only-oauth-secret',
      SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL: 'https://www.getshipseal.com/api/account/callback',
      DATABASE_URL: 'postgresql://shipseal:test@db.example.test/shipseal?sslmode=require',
    };
    const res = response();
    await accountRouter({
      method: 'GET',
      url: '/api/account/login?returnTo=%2Fprojects',
      query: { route: 'login' },
      headers: { host: 'www.getshipseal.com', 'x-forwarded-host': 'www.getshipseal.com', 'x-forwarded-proto': 'https' },
    } as never, res as never);

    expect(res.statusCode).toBe(302);
    expect(String(res.getHeader('Location'))).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
    expect(res.body).not.toContain('account_route_unavailable');
  });

  it('invokes callback, session, logout, and delete handlers without the router-level fallback', async () => {
    setAccountPersistenceStoreForTests(new InMemoryAccountPersistenceStore());
    const cases = [
      { route: 'callback', method: 'GET', url: '/api/account/callback', expected: 302 },
      { route: 'session', method: 'GET', url: '/api/account/session', expected: 200 },
      { route: 'logout', method: 'POST', url: '/api/account/logout', expected: 200 },
      { route: 'delete', method: 'POST', url: '/api/account/delete', expected: 401 },
    ];
    for (const item of cases) {
      const res = response();
      await accountRouter({ method: item.method, url: item.url, query: { route: item.route }, headers: {} } as never, res as never);
      expect(res.statusCode, item.route).toBe(item.expected);
      expect(res.body, item.route).not.toContain('account_route_unavailable');
    }
  });

  it('loads GitHub login, callback, repository listing, and optimization PR modules without mutation', async () => {
    const modules = await Promise.all([
      import('../../api/_routes/github-app/login'),
      import('../../api/_routes/github-app/oauth-callback'),
      import('../../api/_routes/github-app/repositories'),
      import('../../api/_routes/github-app/create-optimization-pr'),
    ]);
    expect(modules.every(module => typeof module.default === 'function')).toBe(true);
  });

  it('keeps a NodeNext compilation gate in the root typecheck for every Vercel entrypoint', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const config = JSON.parse(readFileSync(resolve(root, 'tsconfig.functions.json'), 'utf8'));
    expect(packageJson.scripts['typecheck:functions']).toBe('tsc -p tsconfig.functions.json --noEmit');
    expect(packageJson.scripts.typecheck).toContain('npm run typecheck:functions');
    expect(config.compilerOptions).toMatchObject({ module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true });
    expect(config.files).toEqual([
      'api/account-router.ts',
      'api/audit-request.ts',
      'api/billing-router.ts',
      'api/create-readiness-pr.ts',
      'api/github-app-router.ts',
      'api/github-archive.ts',
      'api/persistence-router.ts',
      'api/repository-intelligence.ts',
    ]);
  });

  it('uses explicit ESM extensions in the shared modules implicated by the Vercel failure', () => {
    for (const relativePath of [
      'src/lib/workspace/repositoryVerificationRelationship.ts',
      'src/lib/workspace/repositoryOptimizationGithubApply.ts',
      'src/lib/workspace/repositoryOptimizationPreparation.ts',
      'src/lib/workspace/repositoryOptimizationPlan.ts',
    ]) {
      const source = readFileSync(resolve(root, relativePath), 'utf8');
      const specifiers = [...source.matchAll(/(?:from\s+|import\()(['"])(\.\.?\/[^'"]+)\1/g)].map(match => match[2]);
      expect(specifiers.length, relativePath).toBeGreaterThan(0);
      expect(specifiers, relativePath).toEqual(specifiers.filter(specifier => /\.js$/.test(specifier)));
    }
  });
});

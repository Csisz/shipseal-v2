import { readFileSync } from 'node:fs';
import { describe, expect, it, afterEach, vi } from 'vitest';
import sessionHandler from '../../api/_routes/account/session';
import projectsHandler from '../../api/_routes/projects/index';
import projectHandler from '../../api/_routes/projects/[projectId]';
import scanHandler from '../../api/_routes/scans/[scanId]';
import logoutHandler from '../../api/_routes/account/logout';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { createAccountSession, hashSessionToken } from '../../api/_lib/accountSession';
import { serializeSafeDatabaseJson, setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';
import { buildSampleReport } from '@/lib/readiness';
import { SAMPLE_PROJECT_REPO_INPUT } from '@/lib/demo/sampleReadiness';
import { buildSaveProjectRequest } from '@/lib/persistence/buildSnapshot';
import { saveProjectRequestSchema, scanSnapshotSchema } from '@/lib/persistence';

function response() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string | string[]) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
    json() { return JSON.parse(this.body) as Record<string, unknown>; },
    headers,
  };
}

async function setupUser(store: InMemoryAccountPersistenceStore, subject: string) {
  const user = await store.upsertOAuthUser({ providerSubject: subject, email: `${subject}@example.test`, displayName: `User ${subject}`, avatarUrl: null });
  const token = `session-${subject}-${'x'.repeat(36)}`;
  await store.createSession({ userId: user.id, tokenHash: hashSessionToken(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
  return { user, token, cookie: `__Host-shipseal_session=${token}` };
}

function request(cookie?: string, method = 'GET', body?: unknown, url = '/') {
  return { method, body, url, headers: cookie ? { cookie } : {}, query: {} };
}

function saveFixture(idempotencyKey = `save_${'a'.repeat(32)}`) {
  return buildSaveProjectRequest({ report: buildSampleReport(SAMPLE_PROJECT_REPO_INPUT), idempotencyKey });
}

afterEach(() => setAccountPersistenceStoreForTests(null));

describe('Omega 18.1 account sessions', () => {
  it('returns anonymous state without a cookie and an authenticated minimized user with a valid server session', async () => {
    const store = new InMemoryAccountPersistenceStore();
    setAccountPersistenceStoreForTests(store);
    const anonymous = response();
    await sessionHandler(request() as never, anonymous as never);
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.json()).toEqual({ user: null });

    const userA = await setupUser(store, 'a');
    const authenticated = response();
    await sessionHandler(request(userA.cookie) as never, authenticated as never);
    expect(authenticated.json()).toEqual({ user: { id: userA.user.id, email: 'a@example.test', displayName: 'User a', avatarUrl: null } });
    expect(authenticated.body).not.toContain(userA.token);
  });

  it('uses HttpOnly SameSite cookies, Secure in production, and rejects expired sessions', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await store.upsertOAuthUser({ providerSubject: 'cookie', email: null, displayName: 'Cookie', avatarUrl: null });
    const res = response();
    await createAccountSession({ headers: { 'x-forwarded-proto': 'https' } } as never, res as never, user.id, store);
    const setCookie = (res.getHeader('Set-Cookie') as string[])[0];
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Secure');

    await store.createSession({ userId: user.id, tokenHash: hashSessionToken('expired-session-token-that-is-long-enough'), createdAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z' });
    setAccountPersistenceStoreForTests(store);
    const expired = response();
    await projectsHandler(request('__Host-shipseal_session=expired-session-token-that-is-long-enough') as never, expired as never);
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toMatchObject({ error: { code: 'authentication_required' } });
  });

  it('logout revokes the server session and expires the browser cookie', async () => {
    const store = new InMemoryAccountPersistenceStore();
    setAccountPersistenceStoreForTests(store);
    const user = await setupUser(store, 'logout');
    const res = response();
    await logoutHandler(request(user.cookie, 'POST', {}) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(await store.getSession(hashSessionToken(user.token), new Date().toISOString())).toBeNull();
    expect((res.getHeader('Set-Cookie') as string[]).join(';')).toContain('Max-Age=0');
  });
});

describe('Omega 18.1 ownership and persistence', () => {
  it('deduplicates an owned repository and idempotency key while retaining immutable historic scans', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await setupUser(store, 'owner');
    const first = await store.saveProjectAndScan(user.user.id, saveFixture());
    const duplicate = await store.saveProjectAndScan(user.user.id, saveFixture());
    const second = await store.saveProjectAndScan(user.user.id, saveFixture(`save_${'b'.repeat(32)}`));
    expect(duplicate.project.id).toBe(first.project.id);
    expect(duplicate.scan.id).toBe(first.scan.id);
    expect(second.project.id).toBe(first.project.id);
    expect(second.scan.id).not.toBe(first.scan.id);
    expect(await store.listScans(user.user.id, first.project.id, 50, 0)).toHaveLength(2);
    expect((await store.getScan(user.user.id, first.scan.id))?.snapshot.report.repoName).toBe(first.project.displayName);
  });

  it('never trusts a browser user ID and returns the same safe 404 for another user resources', async () => {
    const store = new InMemoryAccountPersistenceStore();
    setAccountPersistenceStoreForTests(store);
    const userA = await setupUser(store, 'owner-a');
    const userB = await setupUser(store, 'owner-b');
    const savedB = await store.saveProjectAndScan(userB.user.id, saveFixture());

    const list = response();
    await projectsHandler({ ...request(userA.cookie), body: { userId: userB.user.id } } as never, list as never);
    expect(list.json()).toEqual({ projects: [] });

    const readOther = response();
    await projectHandler({ ...request(userA.cookie), query: { projectId: savedB.project.id } } as never, readOther as never);
    expect(readOther.statusCode).toBe(404);
    expect(readOther.body).not.toContain(userB.user.id);

    const deleteOtherScan = response();
    await scanHandler({ ...request(userA.cookie, 'DELETE'), query: { scanId: savedB.scan.id } } as never, deleteOtherScan as never);
    expect(deleteOtherScan.statusCode).toBe(404);
    expect(await store.getScan(userB.user.id, savedB.scan.id)).not.toBeNull();
  });

  it('updates only safe metadata for the authenticated owner', async () => {
    const store = new InMemoryAccountPersistenceStore();
    setAccountPersistenceStoreForTests(store);
    const user = await setupUser(store, 'metadata');
    const saved = await store.saveProjectAndScan(user.user.id, saveFixture());
    const res = response();
    await projectHandler({ ...request(user.cookie, 'PATCH', { displayName: 'Renamed project', archived: true }), query: { projectId: saved.project.id } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ project: { displayName: 'Renamed project', archived: true } });
    const unsafe = response();
    await projectHandler({ ...request(user.cookie, 'PATCH', { ownerUserId: 'attacker' }), query: { projectId: saved.project.id } } as never, unsafe as never);
    expect(unsafe.statusCode).toBe(400);
  });

  it('persists bounded provider mode and verification relationships without provider or GitHub secrets', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await setupUser(store, 'verify');
    const baseline = await store.saveProjectAndScan(user.user.id, saveFixture());
    const input = saveFixture(`save_${'c'.repeat(32)}`);
    input.scan.intelligenceMode = 'fallback';
    input.scan.snapshot.intelligenceMode = 'fallback';
    input.scan.safeFailureCategory = 'provider_unavailable';
    input.scan.verificationRelationship = {
      version: 'shipseal.verification-relationship.v1', baselineScanId: baseline.scan.id,
      state: 'partially-verified', verifiedAt: new Date().toISOString(), algorithmVersion: 'shipseal.repository-intelligence-verification.v1', expectedArtifactIds: ['artifact-1'],
    };
    const rescan = await store.saveProjectAndScan(user.user.id, input);
    expect(rescan.scan.intelligenceMode).toBe('fallback');
    expect(rescan.scan.baselineScanId).toBe(baseline.scan.id);
    expect(store.verifications).toHaveLength(1);
    const serialized = JSON.stringify(await store.getScan(user.user.id, rescan.scan.id));
    expect(serialized).not.toMatch(/api[_-]?key|github_pat_|rawProviderResponse/i);
  });
});

describe('Omega 18.1 deletion and safety', () => {
  it('deleting a baseline scan removes dependent verification but not its project or unrelated scan', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await setupUser(store, 'delete-scan');
    const baseline = await store.saveProjectAndScan(user.user.id, saveFixture());
    const input = saveFixture(`save_${'d'.repeat(32)}`);
    input.scan.verificationRelationship = { version: 'shipseal.verification-relationship.v1', baselineScanId: baseline.scan.id, state: 'verified', verifiedAt: new Date().toISOString(), algorithmVersion: 'verification.v1', expectedArtifactIds: [] };
    const rescan = await store.saveProjectAndScan(user.user.id, input);
    expect(store.verifications).toHaveLength(1);
    expect(await store.deleteScan(user.user.id, baseline.scan.id)).toBe(true);
    expect(store.verifications).toHaveLength(0);
    expect(await store.getScan(user.user.id, rescan.scan.id)).not.toBeNull();
    expect(await store.getProject(user.user.id, baseline.project.id)).not.toBeNull();
  });

  it('project and account deletion cascade through scans, relationships, and sessions without GitHub or provider calls', async () => {
    const store = new InMemoryAccountPersistenceStore();
    const user = await setupUser(store, 'delete-account');
    const saved = await store.saveProjectAndScan(user.user.id, saveFixture());
    expect(await store.deleteProject(user.user.id, saved.project.id)).toBe(true);
    expect(await store.getScan(user.user.id, saved.scan.id)).toBeNull();
    const savedAgain = await store.saveProjectAndScan(user.user.id, saveFixture(`save_${'e'.repeat(32)}`));
    expect(await store.deleteAccount(user.user.id)).toBe(true);
    expect(await store.getProject(user.user.id, savedAgain.project.id)).toBeNull();
    expect(await store.getSession(hashSessionToken(user.token), new Date().toISOString())).toBeNull();
  });

  it('rejects secret-bearing, malformed, unsupported, and oversized persisted objects', () => {
    const valid = saveFixture();
    expect(() => saveProjectRequestSchema.parse({ ...valid, version: 'shipseal.persistence.v0' })).toThrow();
    expect(() => scanSnapshotSchema.parse({ ...valid.scan.snapshot, providerRawResponse: { secret: 'x' } })).toThrow();
    const secretReport = JSON.parse(JSON.stringify(valid.scan.snapshot));
    secretReport.report.contextPack = `github_pat_${'x'.repeat(30)}`;
    expect(() => scanSnapshotSchema.parse(secretReport)).toThrow();
    expect(() => saveProjectRequestSchema.parse({ ...valid, project: { ...valid.project, displayName: 'x'.repeat(500) } })).toThrow();
  });

  it('serializes validated persistence JSON without retaining unsupported or sensitive values', () => {
    const safe = { version: 'snapshot.v1', counts: [1, 2], nested: { ready: true, note: null } };
    expect(serializeSafeDatabaseJson(safe)).toEqual(safe);
    expect(() => serializeSafeDatabaseJson({ missing: undefined })).toThrow(/cannot be stored safely/i);
    expect(() => serializeSafeDatabaseJson({ callback: () => true })).toThrow(/cannot be stored safely/i);
    expect(() => serializeSafeDatabaseJson({ createdAt: new Date() })).toThrow(/cannot be stored safely/i);
    expect(() => serializeSafeDatabaseJson({ access_token: 'not-persisted' })).toThrow(/cannot be stored safely/i);
    expect(() => serializeSafeDatabaseJson({ provider_raw: { response: 'not-persisted' } })).toThrow(/cannot be stored safely/i);
    expect(() => serializeSafeDatabaseJson({ token: `github_pat_${'x'.repeat(30)}` })).toThrow(/cannot be stored safely/i);
  });

  it('keeps server database and auth markers outside client modules and browser configuration', () => {
    const client = readFileSync('src/lib/persistence/client.ts', 'utf8');
    const envExample = readFileSync('.env.example', 'utf8');
    expect(client).not.toMatch(/DATABASE_URL|CLIENT_SECRET|postgres\(/);
    expect(envExample).not.toMatch(/^VITE_.*(?:SECRET|DATABASE|TOKEN|KEY)=/m);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import feedbackHandler from '../../api/feedback';
import adminHandler from '../../api/admin-router';
import { ACCOUNT_SESSION_COOKIE, hashSessionToken } from '../../api/_lib/accountSession';
import { setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { setProductFeedbackStoreForTests, type FeedbackSubmission, type ProductFeedbackStore, type ProductSignalSubmission } from '../../api/_lib/productFeedback';

class MemoryFeedbackStore implements ProductFeedbackStore {
  feedback: Array<{ input: FeedbackSubmission; userId: string | null }> = [];
  signals: Array<{ input: ProductSignalSubmission; userId: string | null }> = [];
  async submit(input: FeedbackSubmission, userId: string | null) { this.feedback.push({ input, userId }); }
  async signal(input: ProductSignalSubmission, userId: string | null) { this.signals.push({ input, userId }); }
}

function response() {
  const headers = new Map<string, unknown>();
  return {
    statusCode: 0, body: '', headersSent: false,
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
    json() { return JSON.parse(this.body) as Record<string, unknown>; },
  };
}

function request(body: unknown, cookie?: string) {
  return { method: 'POST', url: '/api/feedback', body, headers: { ...(cookie ? { cookie } : {}), 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` }, socket: {} };
}

const validFeedback = {
  kind: 'feedback', surface: 'repository_futures', useCase: 'plan_future', outcome: 'partly', useAgain: 'yes',
  pricingIntent: 'maybe', comment: 'The dependency explanation was useful.', contactAllowed: true,
};

describe('Early Access feedback API', () => {
  let accountStore: InMemoryAccountPersistenceStore;
  let feedbackStore: MemoryFeedbackStore;

  beforeEach(() => {
    accountStore = new InMemoryAccountPersistenceStore();
    feedbackStore = new MemoryFeedbackStore();
    setAccountPersistenceStoreForTests(accountStore);
    setProductFeedbackStoreForTests(feedbackStore);
  });
  afterEach(() => {
    setAccountPersistenceStoreForTests(null);
    setProductFeedbackStoreForTests(null);
    vi.restoreAllMocks();
  });

  it('associates an authenticated submission with the account and explicit follow-up consent', async () => {
    const user = await accountStore.upsertOAuthUser({ providerSubject: 'feedback-user', email: 'owner@example.test', displayName: 'Owner', avatarUrl: null });
    const token = 'authenticated-feedback-token-value-1234567890';
    await accountStore.createSession({ userId: user.id, tokenHash: hashSessionToken(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const res = response();
    await feedbackHandler(request(validFeedback, `${ACCOUNT_SESSION_COOKIE}=${token}`) as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(feedbackStore.feedback).toEqual([{ input: expect.objectContaining({ contactAllowed: true, comment: validFeedback.comment }), userId: user.id }]);
  });

  it('supports bounded anonymous feedback without account context or contact consent', async () => {
    const res = response();
    await feedbackHandler(request({ ...validFeedback, projectId: `prj_${'a'.repeat(24)}`, scanId: `scn_${'b'.repeat(24)}` }) as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(feedbackStore.feedback[0]).toMatchObject({ userId: null, input: { projectId: null, scanId: null, contactAllowed: false } });
  });

  it('rejects invalid enums, overlong comments, and unexpected repository-source fields', async () => {
    for (const body of [
      { ...validFeedback, outcome: 'excellent' },
      { ...validFeedback, comment: 'x'.repeat(2001) },
      { ...validFeedback, repositorySource: 'secret source code' },
    ]) {
      const res = response();
      await feedbackHandler(request(body) as never, res as never);
      expect(res.statusCode).toBe(400);
    }
    expect(feedbackStore.feedback).toHaveLength(0);
  });

  it('records only the allowlisted product signal and invokes no unrelated side-effect path', async () => {
    const res = response();
    await feedbackHandler(request({ kind: 'signal', event: 'delivery_downloaded', surface: 'delivery' }) as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(feedbackStore.signals).toEqual([{ input: expect.objectContaining({ event: 'delivery_downloaded' }), userId: null }]);
    expect(feedbackStore.feedback).toHaveLength(0);
  });

  it('does not expose Admin feedback to an authenticated non-admin', async () => {
    const user = await accountStore.upsertOAuthUser({ providerSubject: 'non-admin', email: null, displayName: 'Non Admin', avatarUrl: null });
    const token = 'non-admin-feedback-token-value-1234567890';
    await accountStore.createSession({ userId: user.id, tokenHash: hashSessionToken(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const previous = process.env.SHIPSEAL_ADMIN_USER_IDS;
    process.env.SHIPSEAL_ADMIN_USER_IDS = 'usr_someone_else';
    const res = response();
    await adminHandler({ method: 'GET', url: '/api/admin', headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${token}` } } as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Not found.' } });
    if (previous === undefined) delete process.env.SHIPSEAL_ADMIN_USER_IDS; else process.env.SHIPSEAL_ADMIN_USER_IDS = previous;
  });
});

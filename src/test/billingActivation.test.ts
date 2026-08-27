import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { Readable } from 'node:stream';
import billingRouter from '../../api/billing-router';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';
import { hashSessionToken } from '../../api/_lib/accountSession';
import {
  entitlementFromBillingResolution,
  resolveBillingEntitlement,
  setBillingPersistenceStoreForTests,
  type AccountBillingSummary,
  type BillingEventResult,
  type BillingPersistenceStore,
  type StripeSubscriptionState,
} from '../../api/_lib/billingPersistence';
import {
  BillingService,
  readRawBillingBody,
  StripeSdkBillingGateway,
  setStripeBillingGatewayForTests,
  type StripeBillingGateway,
} from '../../api/_lib/stripeBilling';
import { resolveBillingConfig } from '../../api/_lib/billingConfig';
import type { PersistedUser } from '@/lib/persistence/schema';

const originalEnv = { ...process.env };
const config = {
  appOrigin: 'https://www.getshipseal.com',
  stripeSecretKey: 'sk_test_fixture',
  stripeWebhookSecret: 'whsec_fixture',
  proPriceId: 'price_shipseal_pro',
  proDeepAnalysisLimit: 10,
};

class MemoryBillingStore implements BillingPersistenceStore {
  customers = new Map<string, string>();
  subscriptions = new Map<string, StripeSubscriptionState>();
  entitlements = new Map<string, ReturnType<typeof entitlementFromBillingResolution>>();
  events = new Set<string>();
  eventCreated = new Map<string, number>();
  usageLedger = [{ id: 'existing-usage', units: 3 }];

  async getOrCreateCustomer(userId: string, create: () => Promise<string>) {
    let stripeCustomerId = this.customers.get(userId);
    if (!stripeCustomerId) { stripeCustomerId = await create(); this.customers.set(userId, stripeCustomerId); }
    return { userId, stripeCustomerId };
  }
  async getCustomer(userId: string) {
    const stripeCustomerId = this.customers.get(userId);
    return stripeCustomerId ? { userId, stripeCustomerId } : null;
  }
  async getAccountBillingSummary(userId: string): Promise<AccountBillingSummary> {
    const subscription = this.subscriptions.get(userId);
    return {
      customerPortalAvailable: this.customers.has(userId),
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      stripeStatus: subscription?.status || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
    };
  }
  async deleteBillingProfile(userId: string) {
    this.customers.delete(userId);
    this.subscriptions.delete(userId);
    this.entitlements.delete(userId);
  }
  async synchronizeStripeEvent(input: {
    eventId: string;
    eventType: string;
    eventCreated: number;
    subscription: StripeSubscriptionState | null;
    config: typeof config;
  }): Promise<BillingEventResult> {
    if (this.events.has(input.eventId)) return { state: 'duplicate' };
    this.events.add(input.eventId);
    if (!input.subscription || input.subscription.priceId !== input.config.proPriceId) return { state: 'ignored' };
    const userId = [...this.customers].find(([, customerId]) => customerId === input.subscription?.customerId)?.[0];
    if (!userId) return { state: 'ignored' };
    const existing = this.subscriptions.get(userId);
    if ((this.eventCreated.get(userId) || -1) > input.eventCreated
      || existing && existing.subscriptionId !== input.subscription.subscriptionId
        && Date.parse(existing.subscriptionCreatedAt) >= Date.parse(input.subscription.subscriptionCreatedAt)) return { state: 'stale', userId };
    this.eventCreated.set(userId, input.eventCreated);
    this.subscriptions.set(userId, input.subscription);
    this.entitlements.set(userId, entitlementFromBillingResolution(userId, input.subscription, input.config));
    return { state: 'applied', userId };
  }
}

function gatewayFixture(subscription = subscriptionFixture()): StripeBillingGateway & {
  createCustomer: ReturnType<typeof vi.fn>;
  createCheckoutSession: ReturnType<typeof vi.fn>;
  createPortalSession: ReturnType<typeof vi.fn>;
  retrieveSubscription: ReturnType<typeof vi.fn>;
  constructWebhookEvent: ReturnType<typeof vi.fn>;
} {
  return {
    createCustomer: vi.fn(async () => 'cus_shipseal_owner'),
    createCheckoutSession: vi.fn(async () => 'https://checkout.stripe.com/c/pay/test_session'),
    createPortalSession: vi.fn(async () => 'https://billing.stripe.com/p/session/test_portal'),
    retrieveSubscription: vi.fn(async () => subscriptionFixtureAsStripe(subscription)),
    constructWebhookEvent: vi.fn(),
  };
}

function subscriptionFixture(overrides: Partial<StripeSubscriptionState> = {}): StripeSubscriptionState {
  return {
    subscriptionId: 'sub_shipseal_pro',
    customerId: 'cus_shipseal_owner',
    priceId: config.proPriceId,
    status: 'active',
    subscriptionCreatedAt: '2026-08-01T00:00:00.000Z',
    currentPeriodStart: '2026-08-01T00:00:00.000Z',
    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function subscriptionFixtureAsStripe(subscription: StripeSubscriptionState): Stripe.Subscription {
  return {
    id: subscription.subscriptionId,
    object: 'subscription',
    customer: subscription.customerId,
    status: subscription.status,
    created: Date.parse(subscription.subscriptionCreatedAt) / 1_000,
    cancel_at: null,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    items: {
      object: 'list',
      data: [{
        id: 'si_shipseal', object: 'subscription_item', current_period_start: Date.parse(subscription.currentPeriodStart) / 1_000,
        current_period_end: Date.parse(subscription.currentPeriodEnd) / 1_000, price: { id: subscription.priceId },
      }],
      has_more: false,
      url: '/v1/subscription_items',
    },
  } as unknown as Stripe.Subscription;
}

function eventFixture(subscription: StripeSubscriptionState, overrides: Partial<Stripe.Event> = {}) {
  return {
    id: 'evt_shipseal_update',
    object: 'event',
    api_version: null,
    created: 1_777_000_000,
    data: { object: subscriptionFixtureAsStripe(subscription), previous_attributes: {} },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'customer.subscription.updated',
    ...overrides,
  } as Stripe.Event;
}

function user(id = `usr_${'a'.repeat(24)}`): PersistedUser {
  return { id, email: 'owner@example.test', displayName: 'Owner', avatarUrl: null };
}

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
  };
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    SHIPSEAL_APP_ORIGIN: config.appOrigin,
    STRIPE_SECRET_KEY: config.stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: config.stripeWebhookSecret,
    SHIPSEAL_STRIPE_PRO_PRICE_ID: config.proPriceId,
    SHIPSEAL_PRO_DEEP_ANALYSIS_LIMIT: '10',
  };
});

afterEach(() => {
  process.env = { ...originalEnv };
  setAccountPersistenceStoreForTests(null);
  setBillingPersistenceStoreForTests(null);
  setStripeBillingGatewayForTests(null);
  vi.restoreAllMocks();
});

describe('Omega 19.2 billing service', () => {
  it('creates Pro Checkout for a Free account with a server-owned Price and reuses its customer', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayFixture();
    const service = new BillingService(store, config, gateway);
    await service.createCheckoutSession(user(), { plan: 'pro', returnTo: '/projects/prj_safe', checkoutAttemptId: crypto.randomUUID() });
    await service.createCheckoutSession(user(), { plan: 'pro', returnTo: '/projects/prj_safe', checkoutAttemptId: crypto.randomUUID() });
    expect(gateway.createCustomer).toHaveBeenCalledTimes(1);
    expect(gateway.createCheckoutSession).toHaveBeenCalledTimes(2);
    expect(gateway.createCheckoutSession.mock.calls[0][0]).toMatchObject({ priceId: config.proPriceId, customerId: 'cus_shipseal_owner' });
  });

  it('validates return context and never accepts an external Checkout return URL', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayFixture();
    await new BillingService(store, config, gateway).createCheckoutSession(user(), {
      plan: 'pro', returnTo: 'https://evil.example/steal', checkoutAttemptId: crypto.randomUUID(),
    });
    const input = gateway.createCheckoutSession.mock.calls[0][0];
    expect(input.successUrl).toContain('https://www.getshipseal.com/payment/success');
    expect(input.successUrl).not.toContain('evil.example');
    expect(input.cancelUrl).toMatch(/^https:\/\/www\.getshipseal\.com\//);
  });

  it('creates Portal access only for the authenticated account customer mapping', async () => {
    const store = new MemoryBillingStore();
    store.customers.set(user().id, 'cus_shipseal_owner');
    store.customers.set(`usr_${'b'.repeat(24)}`, 'cus_other_owner');
    const gateway = gatewayFixture();
    await new BillingService(store, config, gateway).createPortalSession(user(), {
      returnTo: '/projects', portalAttemptId: crypto.randomUUID(),
    });
    expect(gateway.createPortalSession.mock.calls[0][0].customerId).toBe('cus_shipseal_owner');
    expect(gateway.createPortalSession.mock.calls[0][0].customerId).not.toBe('cus_other_owner');
  });

  it.each([
    ['active', 'active', true, 10],
    ['trialing', 'trialing', true, 10],
    ['past_due', 'past_due', true, 10],
    ['canceled', 'expired', false, 0],
    ['unpaid', 'disabled', false, 0],
    ['paused', 'disabled', false, 0],
  ] as const)('maps Stripe %s deterministically', (stripeStatus, status, futures, limit) => {
    expect(resolveBillingEntitlement(subscriptionFixture({ status: stripeStatus }), config)).toMatchObject({
      plan: 'pro', status, repositoryFutures: futures, executableFuturePlan: futures, deepAnalysisLimit: limit,
    });
  });

  it('keeps cancellation-at-period-end active through the paid period', () => {
    expect(resolveBillingEntitlement(subscriptionFixture({ status: 'active', cancelAtPeriodEnd: true }), config)).toMatchObject({
      status: 'active', repositoryFutures: true,
    });
  });

  it('verifies, applies, and de-duplicates webhook subscription state without changing usage history', async () => {
    const store = new MemoryBillingStore();
    store.customers.set(user().id, 'cus_shipseal_owner');
    const subscription = subscriptionFixture();
    const gateway = gatewayFixture(subscription);
    const event = eventFixture(subscription);
    gateway.constructWebhookEvent.mockReturnValue(event);
    const service = new BillingService(store, config, gateway);
    const first = await service.handleWebhook(Buffer.from('{}'), 'valid-signature');
    const duplicate = await service.handleWebhook(Buffer.from('{}'), 'valid-signature');
    expect(first.state).toBe('applied');
    expect(duplicate.state).toBe('duplicate');
    expect(store.entitlements.get(user().id)).toMatchObject({ plan: 'pro', status: 'active', deepAnalysisLimit: 10 });
    expect(store.usageLedger).toEqual([{ id: 'existing-usage', units: 3 }]);
  });

  it('moves the allowance window with a new Stripe period while preserving prior usage records', async () => {
    const store = new MemoryBillingStore();
    store.customers.set(user().id, 'cus_shipseal_owner');
    const subscription = subscriptionFixture({
      currentPeriodStart: '2026-09-01T00:00:00.000Z',
      currentPeriodEnd: '2026-10-01T00:00:00.000Z',
    });
    const gateway = gatewayFixture(subscription);
    gateway.constructWebhookEvent.mockReturnValue(eventFixture(subscription, { id: 'evt_period_rollover', created: 1_778_000_000 }));
    await new BillingService(store, config, gateway).handleWebhook(Buffer.from('{}'), 'valid-signature');
    expect(store.entitlements.get(user().id)?.periodStart).toBe('2026-09-01T00:00:00.000Z');
    expect(store.usageLedger).toHaveLength(1);
  });

  it('does not let a delayed event from an older subscription revoke its replacement', async () => {
    const store = new MemoryBillingStore();
    store.customers.set(user().id, 'cus_shipseal_owner');
    const replacement = subscriptionFixture({
      subscriptionId: 'sub_replacement',
      subscriptionCreatedAt: '2026-09-02T00:00:00.000Z',
      currentPeriodStart: '2026-09-02T00:00:00.000Z',
      currentPeriodEnd: '2026-10-02T00:00:00.000Z',
    });
    const oldCanceled = subscriptionFixture({ status: 'canceled' });
    const gateway = gatewayFixture(replacement);
    gateway.constructWebhookEvent
      .mockReturnValueOnce(eventFixture(replacement, { id: 'evt_replacement', created: 1_778_000_000 }))
      .mockReturnValueOnce(eventFixture(oldCanceled, {
        id: 'evt_old_delayed', created: 1_779_000_000, type: 'customer.subscription.deleted',
      }));
    const service = new BillingService(store, config, gateway);
    expect((await service.handleWebhook(Buffer.from('{}'), 'valid')).state).toBe('applied');
    expect((await service.handleWebhook(Buffer.from('{}'), 'valid')).state).toBe('stale');
    expect(store.entitlements.get(user().id)).toMatchObject({ status: 'active', periodStart: '2026-09-02T00:00:00.000Z' });
  });

  it('rejects an invalid webhook signature before synchronizing state', async () => {
    const store = new MemoryBillingStore();
    const gateway = gatewayFixture();
    gateway.constructWebhookEvent.mockImplementation(() => { throw new Error('signature mismatch'); });
    await expect(new BillingService(store, config, gateway).handleWebhook(Buffer.from('{}'), 'bad')).rejects.toMatchObject({ code: 'invalid_signature' });
    expect(store.events.size).toBe(0);
  });

  it('uses Stripe SDK raw-body signature verification for valid and invalid Test Mode signatures', () => {
    const secret = 'whsec_test_signature';
    const payload = JSON.stringify(eventFixture(subscriptionFixture()));
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const gateway = new StripeSdkBillingGateway('sk_test_fixture');
    expect(gateway.constructWebhookEvent(Buffer.from(payload), header, secret).id).toBe('evt_shipseal_update');
    expect(() => gateway.constructWebhookEvent(Buffer.from(`${payload} `), header, secret)).toThrow();
  });

  it('reads webhook bytes without touching Vercel\'s lazy parsed-body helper', async () => {
    const request = Readable.from([Buffer.from('{"signed":true}')]);
    Object.defineProperty(request, 'body', { get() { throw new Error('parsed body was accessed'); } });
    await expect(readRawBillingBody(request as never)).resolves.toEqual(Buffer.from('{"signed":true}'));
  });
});

describe('Omega 19.2 billing HTTP authorization', () => {
  it('rejects anonymous Checkout before Stripe or billing configuration is used', async () => {
    setAccountPersistenceStoreForTests(new InMemoryAccountPersistenceStore());
    const res = response();
    await billingRouter({ method: 'POST', query: { route: 'create-checkout-session' }, body: {}, headers: {} } as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'authentication_required' } });
  });

  it.each([
    [{ plan: 'team', returnTo: '/', checkoutAttemptId: '20f33d6f-cd17-47a4-a92f-8767036ecab1' }, 'invalid plan'],
    [{ plan: 'pro', priceId: 'price_attacker', returnTo: '/', checkoutAttemptId: '20f33d6f-cd17-47a4-a92f-8767036ecab1' }, 'client Price ID'],
  ])('rejects %s without calling Stripe', async (body, _label) => {
    const accountStore = new InMemoryAccountPersistenceStore();
    const owner = await accountStore.upsertOAuthUser({ providerSubject: crypto.randomUUID(), email: null, displayName: 'Owner', avatarUrl: null });
    const token = `billing-session-${'x'.repeat(36)}`;
    await accountStore.createSession({ userId: owner.id, tokenHash: hashSessionToken(token), createdAt: new Date().toISOString(), expiresAt: '2030-01-01T00:00:00.000Z' });
    setAccountPersistenceStoreForTests(accountStore);
    const gateway = gatewayFixture();
    setStripeBillingGatewayForTests(gateway);
    setBillingPersistenceStoreForTests(new MemoryBillingStore());
    const res = response();
    await billingRouter({
      method: 'POST', query: { route: 'create-checkout-session' }, body,
      headers: { cookie: `__Host-shipseal_session=${token}` },
    } as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns a safe Stripe Checkout URL for an authenticated Free user', async () => {
    const accountStore = new InMemoryAccountPersistenceStore();
    const owner = await accountStore.upsertOAuthUser({ providerSubject: 'checkout-owner', email: null, displayName: 'Owner', avatarUrl: null });
    const token = `checkout-session-${'x'.repeat(36)}`;
    await accountStore.createSession({ userId: owner.id, tokenHash: hashSessionToken(token), createdAt: new Date().toISOString(), expiresAt: '2030-01-01T00:00:00.000Z' });
    setAccountPersistenceStoreForTests(accountStore);
    setBillingPersistenceStoreForTests(new MemoryBillingStore());
    setStripeBillingGatewayForTests(gatewayFixture());
    const res = response();
    await billingRouter({
      method: 'POST', query: { route: 'create-checkout-session' },
      body: { plan: 'pro', returnTo: `/projects/${owner.id}`, checkoutAttemptId: crypto.randomUUID() },
      headers: { cookie: `__Host-shipseal_session=${token}` },
    } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});

describe('billing configuration', () => {
  it('keeps the Stripe Price and allowance server-owned', () => {
    expect(resolveBillingConfig(process.env)).toMatchObject({ proPriceId: config.proPriceId, proDeepAnalysisLimit: 10 });
  });
});

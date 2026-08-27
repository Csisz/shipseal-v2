import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import Stripe from 'stripe';
import type { PersistedUser } from '../../src/lib/persistence/schema.js';
import { billingReturnPathWithFuturesFocus, safeBillingReturnPath } from '../../src/lib/billing/returnPath.js';
import { BillingConfigurationError, resolveBillingConfig, type ShipSealBillingConfig } from './billingConfig.js';
import {
  getBillingPersistenceStore,
  type BillingEventResult,
  type BillingPersistenceStore,
  type StripeSubscriptionState,
  type StripeSubscriptionStatus,
} from './billingPersistence.js';

export interface StripeBillingGateway {
  createCustomer(user: PersistedUser, idempotencyKey: string): Promise<string>;
  createCheckoutSession(input: {
    customerId: string;
    userId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }): Promise<string>;
  createPortalSession(input: { customerId: string; returnUrl: string; idempotencyKey: string }): Promise<string>;
  constructWebhookEvent(payload: Buffer, signature: string, secret: string): Stripe.Event;
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
}

export class StripeSdkBillingGateway implements StripeBillingGateway {
  private readonly stripe: Stripe;
  constructor(secretKey: string) { this.stripe = new Stripe(secretKey); }

  async createCustomer(user: PersistedUser, idempotencyKey: string) {
    const customer = await this.stripe.customers.create({
      email: user.email || undefined,
      name: user.displayName || undefined,
      metadata: { shipseal_user_id: user.id },
    }, { idempotencyKey });
    return customer.id;
  }

  async createCheckoutSession(input: {
    customerId: string;
    userId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      client_reference_id: input.userId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { shipseal_user_id: input.userId, shipseal_plan: 'pro' },
      subscription_data: { metadata: { shipseal_user_id: input.userId, shipseal_plan: 'pro' } },
    }, { idempotencyKey: input.idempotencyKey });
    if (!session.url) throw new BillingRequestError(502, 'checkout_unavailable', 'Stripe Checkout did not return a safe redirect URL.');
    return session.url;
  }

  async createPortalSession(input: { customerId: string; returnUrl: string; idempotencyKey: string }) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    }, { idempotencyKey: input.idempotencyKey });
    return session.url;
  }

  constructWebhookEvent(payload: Buffer, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  retrieveSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}

export class BillingRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'BillingRequestError';
  }
}

export class BillingService {
  constructor(
    private readonly store: BillingPersistenceStore = getBillingPersistenceStore(),
    private readonly config: ShipSealBillingConfig = resolveBillingConfig(),
    private readonly gateway: StripeBillingGateway = getStripeBillingGateway(config),
  ) {}

  async createCheckoutSession(user: PersistedUser, input: { plan: string; returnTo: string; checkoutAttemptId: string }) {
    if (input.plan !== 'pro') throw new BillingRequestError(400, 'unsupported_plan', 'Only the ShipSeal Pro plan is available for Checkout.');
    const billing = await this.store.getAccountBillingSummary(user.id);
    if (billing.stripeStatus && ['active', 'trialing', 'past_due'].includes(billing.stripeStatus)) {
      throw new BillingRequestError(409, 'subscription_exists', 'This account already has a subscription. Manage it in the billing portal.');
    }
    const customer = await this.store.getOrCreateCustomer(user.id, () => this.gateway.createCustomer(
      user,
      stableIdempotencyKey('customer', user.id),
    ));
    const returnTo = billingReturnPathWithFuturesFocus(input.returnTo);
    const successUrl = new URL('/payment/success', this.config.appOrigin);
    successUrl.searchParams.set('returnTo', returnTo);
    successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
    const cancelUrl = new URL(safeBillingReturnPath(input.returnTo), this.config.appOrigin);
    cancelUrl.searchParams.set('billing', 'cancelled');
    const url = await this.gateway.createCheckoutSession({
      customerId: customer.stripeCustomerId,
      userId: user.id,
      priceId: this.config.proPriceId,
      successUrl: successUrl.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'),
      cancelUrl: cancelUrl.toString(),
      idempotencyKey: stableIdempotencyKey('checkout', user.id, input.checkoutAttemptId),
    });
    return { url };
  }

  async createPortalSession(user: PersistedUser, input: { returnTo: string; portalAttemptId: string }) {
    const customer = await this.store.getCustomer(user.id);
    if (!customer) throw new BillingRequestError(409, 'billing_customer_missing', 'No billing account is available to manage.');
    const returnUrl = new URL(safeBillingReturnPath(input.returnTo, '/projects'), this.config.appOrigin);
    returnUrl.searchParams.set('billing', 'portal-return');
    const url = await this.gateway.createPortalSession({
      customerId: customer.stripeCustomerId,
      returnUrl: returnUrl.toString(),
      idempotencyKey: stableIdempotencyKey('portal', user.id, input.portalAttemptId),
    });
    return { url };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<BillingEventResult> {
    let event: Stripe.Event;
    try { event = this.gateway.constructWebhookEvent(payload, signature, this.config.stripeWebhookSecret); }
    catch { throw new BillingRequestError(400, 'invalid_signature', 'Stripe webhook signature verification failed.'); }
    const subscription = await subscriptionForEvent(event, this.gateway, this.config.proPriceId);
    return this.store.synchronizeStripeEvent({
      eventId: event.id,
      eventType: event.type,
      eventCreated: event.created,
      subscription,
      config: this.config,
    });
  }
}

export async function readRawBillingBody(req: IncomingMessage, maxBytes = 1_000_000) {
  // Vercel exposes req.body through a lazy parsing getter. Do not touch it here:
  // consuming the request stream is what preserves Stripe's signed byte sequence.
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new BillingRequestError(413, 'invalid_request', 'Webhook body is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function subscriptionForEvent(event: Stripe.Event, gateway: StripeBillingGateway, proPriceId: string) {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type === 'customer.subscription.deleted') {
    return normalizeSubscription(object as unknown as Stripe.Subscription, proPriceId);
  }
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const subscriptionId = typeof object.id === 'string' ? object.id : null;
    if (!subscriptionId) return null;
    return normalizeSubscription(await gateway.retrieveSubscription(subscriptionId), proPriceId);
  }
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const subscriptionId = subscriptionIdFromObject(object);
    if (!subscriptionId) return null;
    return normalizeSubscription(await gateway.retrieveSubscription(subscriptionId), proPriceId);
  }
  return null;
}

function subscriptionIdFromObject(object: Record<string, unknown>) {
  const direct = object.subscription;
  if (typeof direct === 'string') return direct;
  if (direct && typeof direct === 'object' && 'id' in direct) return String((direct as { id: unknown }).id);
  const parent = object.parent as { subscription_details?: { subscription?: string | { id?: string } | null } } | undefined;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  if (nested?.id) return nested.id;
  return null;
}

export function normalizeSubscription(subscription: Stripe.Subscription, proPriceId: string): StripeSubscriptionState {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const matchingItem = subscription.items.data.find(item => item.price.id === proPriceId);
  const item = matchingItem || subscription.items.data[0];
  const periodStartSeconds = item?.current_period_start || subscription.created;
  const periodEndSeconds = Math.max(periodStartSeconds + 1, item?.current_period_end || subscription.cancel_at || periodStartSeconds + 1);
  return {
    subscriptionId: subscription.id,
    customerId,
    priceId: matchingItem?.price.id || item?.price.id || '',
    status: subscription.status as StripeSubscriptionStatus,
    subscriptionCreatedAt: new Date(subscription.created * 1_000).toISOString(),
    currentPeriodStart: new Date(periodStartSeconds * 1_000).toISOString(),
    currentPeriodEnd: new Date(periodEndSeconds * 1_000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

function stableIdempotencyKey(...parts: string[]) {
  return `shipseal-${parts[0]}-${createHash('sha256').update(parts.slice(1).join(':')).digest('hex').slice(0, 40)}`;
}

let sharedGateway: StripeBillingGateway | null = null;
export function getStripeBillingGateway(config: ShipSealBillingConfig = resolveBillingConfig()) {
  sharedGateway ||= new StripeSdkBillingGateway(config.stripeSecretKey);
  return sharedGateway;
}

export function setStripeBillingGatewayForTests(gateway: StripeBillingGateway | null) {
  sharedGateway = gateway;
}

export function isBillingConfigurationError(error: unknown): error is BillingConfigurationError {
  return error instanceof BillingConfigurationError;
}

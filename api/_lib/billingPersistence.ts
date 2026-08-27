import postgres, { type Sql, type TransactionSql } from 'postgres';
import type { EntitlementSnapshot, EntitlementStatus } from '../../src/lib/entitlements/contract.js';
import { validateAccountDatabaseUrl } from './authConfig.js';
import type { ShipSealBillingConfig } from './billingConfig.js';

export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface StripeSubscriptionState {
  subscriptionId: string;
  customerId: string;
  priceId: string;
  status: StripeSubscriptionStatus;
  subscriptionCreatedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface BillingCustomerRecord {
  userId: string;
  stripeCustomerId: string;
}

export interface AccountBillingSummary {
  customerPortalAvailable: boolean;
  cancelAtPeriodEnd: boolean;
  stripeStatus: StripeSubscriptionStatus | null;
  currentPeriodEnd: string | null;
}

export interface BillingEventResult {
  state: 'applied' | 'duplicate' | 'ignored' | 'stale';
  userId?: string;
}

export interface BillingPersistenceStore {
  getOrCreateCustomer(userId: string, create: () => Promise<string>): Promise<BillingCustomerRecord>;
  getCustomer(userId: string): Promise<BillingCustomerRecord | null>;
  getAccountBillingSummary(userId: string): Promise<AccountBillingSummary>;
  deleteBillingProfile(userId: string): Promise<void>;
  synchronizeStripeEvent(input: {
    eventId: string;
    eventType: string;
    eventCreated: number;
    subscription: StripeSubscriptionState | null;
    config: ShipSealBillingConfig;
  }): Promise<BillingEventResult>;
  close?(): Promise<void>;
}

export interface BillingEntitlementResolution {
  plan: 'pro';
  status: EntitlementStatus;
  repositoryFutures: boolean;
  executableFuturePlan: boolean;
  deepAnalysisLimit: number;
}

export function resolveBillingEntitlement(
  subscription: StripeSubscriptionState,
  config: Pick<ShipSealBillingConfig, 'proDeepAnalysisLimit'>,
): BillingEntitlementResolution {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return {
      plan: 'pro',
      status: subscription.status,
      repositoryFutures: true,
      executableFuturePlan: true,
      deepAnalysisLimit: config.proDeepAnalysisLimit,
    };
  }
  if (subscription.status === 'past_due') {
    return {
      plan: 'pro',
      status: 'past_due',
      repositoryFutures: true,
      executableFuturePlan: true,
      deepAnalysisLimit: config.proDeepAnalysisLimit,
    };
  }
  return {
    plan: 'pro',
    status: subscription.status === 'canceled' || subscription.status === 'incomplete_expired' ? 'expired' : 'disabled',
    repositoryFutures: false,
    executableFuturePlan: false,
    deepAnalysisLimit: 0,
  };
}

export class PostgresBillingPersistenceStore implements BillingPersistenceStore {
  constructor(private readonly sql: Sql) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env) {
    const connectionString = (env.DATABASE_URL || '').trim();
    if (!connectionString) throw new Error('DATABASE_URL is not configured.');
    validateAccountDatabaseUrl(connectionString);
    return new PostgresBillingPersistenceStore(postgres(connectionString, { max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false }));
  }

  async getOrCreateCustomer(userId: string, create: () => Promise<string>) {
    return this.sql.begin(async transaction => {
      await transaction`select pg_advisory_xact_lock(hashtext(${`shipseal-billing:${userId}`}))`;
      const existing = await customerByUser(transaction, userId);
      if (existing) return existing;
      const stripeCustomerId = await create();
      const now = new Date().toISOString();
      const [row] = await transaction<Record<string, unknown>[]>`
        insert into public.shipseal_billing_customers(user_id, stripe_customer_id, created_at, updated_at)
        values (${userId}, ${stripeCustomerId}, ${now}, ${now})
        returning user_id, stripe_customer_id
      `;
      return mapCustomer(row);
    });
  }

  async getCustomer(userId: string) {
    return customerByUser(this.sql, userId);
  }

  async getAccountBillingSummary(userId: string): Promise<AccountBillingSummary> {
    const [row] = await this.sql<Record<string, unknown>[]>`
      select c.stripe_customer_id, s.status, s.cancel_at_period_end, s.current_period_end
      from public.shipseal_billing_customers c
      left join public.shipseal_billing_subscriptions s on s.user_id = c.user_id
      where c.user_id = ${userId}
      limit 1
    `;
    return {
      customerPortalAvailable: Boolean(row?.stripe_customer_id),
      cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
      stripeStatus: row?.status ? row.status as StripeSubscriptionStatus : null,
      currentPeriodEnd: row?.current_period_end ? iso(row.current_period_end) : null,
    };
  }

  async deleteBillingProfile(userId: string) {
    await this.sql`delete from public.shipseal_billing_customers where user_id = ${userId}`;
  }

  async synchronizeStripeEvent(input: {
    eventId: string;
    eventType: string;
    eventCreated: number;
    subscription: StripeSubscriptionState | null;
    config: ShipSealBillingConfig;
  }): Promise<BillingEventResult> {
    return this.sql.begin(async transaction => {
      const processedAt = new Date().toISOString();
      const inserted = await transaction<Record<string, unknown>[]>`
        insert into public.shipseal_billing_events(event_id, event_type, stripe_created_at, processed_at)
        values (${input.eventId}, ${input.eventType}, ${input.eventCreated}, ${processedAt})
        on conflict (event_id) do nothing
        returning event_id
      `;
      if (!inserted[0]) return { state: 'duplicate' };
      if (!input.subscription) return { state: 'ignored' };

      const [customer] = await transaction<Record<string, unknown>[]>`
        select user_id, stripe_customer_id from public.shipseal_billing_customers
        where stripe_customer_id = ${input.subscription.customerId}
        limit 1
      `;
      if (!customer || input.subscription.priceId !== input.config.proPriceId) return { state: 'ignored' };
      const userId = String(customer.user_id);
      await transaction`update public.shipseal_billing_events set user_id = ${userId} where event_id = ${input.eventId}`;

      const updated = await transaction<Record<string, unknown>[]>`
        insert into public.shipseal_billing_subscriptions(
          user_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status,
          subscription_created_at, current_period_start, current_period_end, cancel_at_period_end, latest_event_created,
          created_at, updated_at
        ) values (
          ${userId}, ${input.subscription.subscriptionId}, ${input.subscription.customerId}, ${input.subscription.priceId},
          ${input.subscription.status}, ${input.subscription.subscriptionCreatedAt}, ${input.subscription.currentPeriodStart}, ${input.subscription.currentPeriodEnd},
          ${input.subscription.cancelAtPeriodEnd}, ${input.eventCreated}, ${processedAt}, ${processedAt}
        ) on conflict (user_id) do update set
          stripe_subscription_id = excluded.stripe_subscription_id,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_price_id = excluded.stripe_price_id,
          status = excluded.status,
          subscription_created_at = excluded.subscription_created_at,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end,
          latest_event_created = excluded.latest_event_created,
          updated_at = excluded.updated_at
        where excluded.latest_event_created >= public.shipseal_billing_subscriptions.latest_event_created
          and (
            excluded.stripe_subscription_id = public.shipseal_billing_subscriptions.stripe_subscription_id
            or excluded.subscription_created_at > public.shipseal_billing_subscriptions.subscription_created_at
          )
        returning user_id
      `;
      if (!updated[0]) return { state: 'stale', userId };

      const entitlement = resolveBillingEntitlement(input.subscription, input.config);
      await synchronizeEntitlement(transaction, userId, input.subscription, entitlement, processedAt);
      return { state: 'applied', userId };
    });
  }

  async close() { await this.sql.end({ timeout: 5 }); }
}

async function customerByUser(sql: Sql | TransactionSql, userId: string) {
  const [row] = await sql<Record<string, unknown>[]>`
    select user_id, stripe_customer_id from public.shipseal_billing_customers where user_id = ${userId} limit 1
  `;
  return row ? mapCustomer(row) : null;
}

function mapCustomer(row: Record<string, unknown>): BillingCustomerRecord {
  return { userId: String(row.user_id), stripeCustomerId: String(row.stripe_customer_id) };
}

async function synchronizeEntitlement(
  transaction: TransactionSql,
  userId: string,
  subscription: StripeSubscriptionState,
  entitlement: BillingEntitlementResolution,
  now: string,
) {
  await transaction`
    insert into public.shipseal_entitlements(
      user_id, plan, status, repository_futures, executable_future_plan, deep_analysis_limit,
      period_start, period_end, source, created_at, updated_at
    ) values (
      ${userId}, ${entitlement.plan}, ${entitlement.status}, ${entitlement.repositoryFutures},
      ${entitlement.executableFuturePlan}, ${entitlement.deepAnalysisLimit}, ${subscription.currentPeriodStart},
      ${subscription.currentPeriodEnd}, 'billing', ${now}, ${now}
    ) on conflict (user_id) do update set
      plan = excluded.plan,
      status = excluded.status,
      repository_futures = excluded.repository_futures,
      executable_future_plan = excluded.executable_future_plan,
      deep_analysis_limit = excluded.deep_analysis_limit,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      source = 'billing',
      updated_at = excluded.updated_at
  `;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

let sharedBillingStore: BillingPersistenceStore | null = null;
export function getBillingPersistenceStore(env: NodeJS.ProcessEnv = process.env) {
  sharedBillingStore ||= PostgresBillingPersistenceStore.fromEnvironment(env);
  return sharedBillingStore;
}

export function setBillingPersistenceStoreForTests(store: BillingPersistenceStore | null) {
  sharedBillingStore = store;
}

export function entitlementFromBillingResolution(userId: string, subscription: StripeSubscriptionState, config: ShipSealBillingConfig): EntitlementSnapshot {
  const resolved = resolveBillingEntitlement(subscription, config);
  return {
    userId,
    plan: resolved.plan,
    status: resolved.status,
    capabilities: {
      repositoryFutures: resolved.repositoryFutures,
      executableFuturePlan: resolved.executableFuturePlan,
    },
    deepAnalysisLimit: resolved.deepAnalysisLimit,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    source: 'billing',
  };
}

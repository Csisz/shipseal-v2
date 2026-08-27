import { randomBytes } from 'node:crypto';
import postgres, { type JSONValue, type Sql, type TransactionSql } from 'postgres';
import { stableContextFingerprint } from '../../src/lib/repositoryIntelligence/contextSelection.js';
import {
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryProductProviderStage,
} from '../../src/lib/repositoryIntelligence/productionProviderContract.js';
import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';
import type {
  AccountAiUsageSummary,
  AiUsageDenialCategory,
  EntitlementSnapshot,
  EntitlementSource,
  EntitlementStatus,
  ShipSealPlan,
} from '../../src/lib/entitlements/contract.js';
import { validateAccountDatabaseUrl } from './authConfig.js';

export type AiOperationKind = 'repository_futures' | 'repository_deep_intelligence';
export type AiStageKind = 'analysis' | 'roots' | 'expansion';

export interface EntitlementStore {
  getEntitlement(userId: string, now: Date): Promise<EntitlementSnapshot>;
}

export interface AuthorizedAiStage {
  operationId: string;
  publicOperationId: string;
  stageId: string;
  stageKind: AiStageKind;
  stageFingerprint: string;
  leaseId: string;
  stageAttemptCount: number;
  cachedResponse?: RepositoryIntelligenceProviderApiResponse;
}

interface AuthorizeAiStageInput {
  userId: string;
  operationKind: AiOperationKind;
  logicalAnalysisFingerprint: string;
  repositoryIdentity: string;
  requestFingerprint: string;
  pipelineVersion: string;
  executionProfile: RepositoryDeepIntelligenceRequest['executionProfile'];
  stageKind: AiStageKind;
  stageFingerprint: string;
  productStage?: RepositoryProductProviderStage;
  reserveUserUnit: boolean;
  now: Date;
  leaseExpiresAt: Date;
  maximumStageAttempts: number;
}

interface CompleteAiStageInput {
  authorization: AuthorizedAiStage;
  userId: string;
  operationKind: AiOperationKind;
  response: RepositoryIntelligenceProviderApiResponse;
  now: Date;
  maximumStageAttempts: number;
}

interface AcquireProviderPermitInput {
  authorization: AuthorizedAiStage;
  now: Date;
  expiresAt: Date;
  dailyLimit: number;
  maximumInFlight: number;
  maximumProviderCallsPerStage: number;
}

interface ProviderPermit {
  id: string;
  windowKey: string;
}

export interface AiUsageStore extends EntitlementStore {
  getUsageSummary(userId: string, now: Date): Promise<AccountAiUsageSummary>;
  authorizeStage(input: AuthorizeAiStageInput): Promise<AuthorizedAiStage>;
  completeStage(input: CompleteAiStageInput): Promise<void>;
  acquireProviderPermit(input: AcquireProviderPermitInput): Promise<ProviderPermit>;
  releaseProviderPermit(permit: ProviderPermit, now: Date): Promise<void>;
  close?(): Promise<void>;
}

export class AiUsageDeniedError extends Error {
  constructor(
    public readonly category: AiUsageDenialCategory,
    public readonly status: number,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'AiUsageDeniedError';
  }
}

export interface AiCostGuardConfig {
  dailyProviderCallLimit: number;
  maximumInFlight: number;
  maximumProviderCallsPerStage: number;
  maximumStageAttempts: number;
  providerPermitTtlMs: number;
  stageLeaseTtlMs: number;
}

export function resolveAiCostGuardConfig(env: NodeJS.ProcessEnv = process.env): AiCostGuardConfig {
  const production = env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
  const dailyProviderCallLimit = boundedPositiveInteger(env.SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY, production ? undefined : 50, 1, 1_000_000);
  const maximumInFlight = boundedPositiveInteger(env.SHIPSEAL_AI_GLOBAL_MAX_IN_FLIGHT, production ? undefined : 2, 1, 1_000);
  if (!dailyProviderCallLimit || !maximumInFlight) {
    throw new AiUsageDeniedError(
      'usage_temporarily_unavailable',
      503,
      true,
      'AI usage authorization is temporarily unavailable.',
    );
  }
  return {
    dailyProviderCallLimit,
    maximumInFlight,
    maximumProviderCallsPerStage: boundedPositiveInteger(env.SHIPSEAL_AI_MAX_PROVIDER_CALLS_PER_STAGE, 4, 1, 20) || 4,
    maximumStageAttempts: boundedPositiveInteger(env.SHIPSEAL_AI_MAX_STAGE_ATTEMPTS, 2, 1, 10) || 2,
    providerPermitTtlMs: (boundedPositiveInteger(env.SHIPSEAL_AI_PROVIDER_PERMIT_TTL_SECONDS, 180, 30, 900) || 180) * 1_000,
    stageLeaseTtlMs: (boundedPositiveInteger(env.SHIPSEAL_AI_STAGE_LEASE_TTL_SECONDS, 180, 30, 900) || 180) * 1_000,
  };
}

export function buildLogicalAiOperationIdentity(userId: string, request: RepositoryDeepIntelligenceRequest) {
  const operationKind: AiOperationKind = request.executionProfile === 'product-strategist'
    ? 'repository_futures'
    : 'repository_deep_intelligence';
  const repositoryIdentity = trustedRepositoryIdentity(request.repository);
  const logicalAnalysisFingerprint = stableContextFingerprint({
    userId,
    operationKind,
    repositoryIdentity,
    requestFingerprint: request.fingerprint,
    pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    rootContractVersion: REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION,
    executionProfile: request.executionProfile,
  });
  return { operationKind, repositoryIdentity, logicalAnalysisFingerprint };
}

export class AiUsageAuthorizationService {
  constructor(
    private readonly store: AiUsageStore = getAiUsageStore(),
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getUsageSummary(userId: string) {
    return this.store.getUsageSummary(userId, this.now());
  }

  async authorize(
    userId: string,
    request: RepositoryDeepIntelligenceRequest,
    productStage?: RepositoryProductProviderStage,
  ): Promise<AuthorizedAiStage> {
    const maximumStageAttempts = boundedPositiveInteger(this.env.SHIPSEAL_AI_MAX_STAGE_ATTEMPTS, 2, 1, 10) || 2;
    const stageLeaseTtlMs = (boundedPositiveInteger(this.env.SHIPSEAL_AI_STAGE_LEASE_TTL_SECONDS, 180, 30, 900) || 180) * 1_000;
    const identity = buildLogicalAiOperationIdentity(userId, request);
    const stageKind: AiStageKind = productStage?.kind
      || (request.executionProfile === 'product-strategist' ? 'roots' : 'analysis');
    const stageFingerprint = productStage?.fingerprint || (request.executionProfile === 'product-strategist'
      ? stableContextFingerprint({ version: REPOSITORY_PRODUCT_PIPELINE_VERSION, report: request.fingerprint, stage: 'roots' })
      : request.fingerprint);
    const now = this.now();
    return this.store.authorizeStage({
      userId,
      ...identity,
      requestFingerprint: request.fingerprint,
      pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
      executionProfile: request.executionProfile,
      stageKind,
      stageFingerprint,
      productStage,
      reserveUserUnit: identity.operationKind === 'repository_futures' && stageKind === 'roots',
      now,
      leaseExpiresAt: new Date(now.getTime() + stageLeaseTtlMs),
      maximumStageAttempts,
    });
  }

  guardProviderFetcher(authorization: AuthorizedAiStage, fetcher: typeof fetch = fetch): typeof fetch {
    return async (input, init) => {
      const config = resolveAiCostGuardConfig(this.env);
      const now = this.now();
      const permit = await this.store.acquireProviderPermit({
        authorization,
        now,
        expiresAt: new Date(now.getTime() + config.providerPermitTtlMs),
        dailyLimit: config.dailyProviderCallLimit,
        maximumInFlight: config.maximumInFlight,
        maximumProviderCallsPerStage: config.maximumProviderCallsPerStage,
      });
      try {
        return await fetcher(input, init);
      } finally {
        await this.store.releaseProviderPermit(permit, this.now()).catch(() => undefined);
      }
    };
  }

  async complete(
    authorization: AuthorizedAiStage,
    userId: string,
    response: RepositoryIntelligenceProviderApiResponse,
  ) {
    if (authorization.cachedResponse) return;
    const maximumStageAttempts = boundedPositiveInteger(this.env.SHIPSEAL_AI_MAX_STAGE_ATTEMPTS, 2, 1, 10) || 2;
    await this.store.completeStage({
      authorization,
      userId,
      operationKind: response.state === 'stage-enhanced' || response.diagnostics?.executionProfile === 'product-strategist'
        ? 'repository_futures'
        : authorization.stageKind === 'roots' || authorization.stageKind === 'expansion'
          ? 'repository_futures'
          : 'repository_deep_intelligence',
      response,
      now: this.now(),
      maximumStageAttempts,
    });
  }
}

export class PostgresAiUsageStore implements AiUsageStore {
  constructor(private readonly sql: Sql) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env) {
    const connectionString = (env.DATABASE_URL || '').trim();
    if (!connectionString) throw temporaryUsageError();
    try { validateAccountDatabaseUrl(connectionString); } catch { throw temporaryUsageError(); }
    return new PostgresAiUsageStore(postgres(connectionString, { max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false }));
  }

  async getEntitlement(userId: string, now: Date) {
    return this.sql.begin(async transaction => this.resolveEntitlement(transaction, userId, now, false));
  }

  async getUsageSummary(userId: string, now: Date): Promise<AccountAiUsageSummary> {
    return this.sql.begin(async transaction => {
      const entitlement = await this.resolveEntitlement(transaction, userId, now, false);
      const [usage] = await transaction<Record<string, unknown>[]>`
        select
          coalesce(sum(consumed_user_units), 0)::integer as used,
          coalesce(sum(reserved_user_units), 0)::integer as reserved
        from public.shipseal_ai_operations
        where owner_user_id = ${userId}
          and created_at >= ${entitlement.periodStart}
          and created_at < ${entitlement.periodEnd}
      `;
      const used = Number(usage?.used || 0);
      const reserved = Number(usage?.reserved || 0);
      const [billing] = await transaction<Record<string, unknown>[]>`
        select c.stripe_customer_id, s.status, s.cancel_at_period_end, s.current_period_end
        from public.shipseal_billing_customers c
        left join public.shipseal_billing_subscriptions s on s.user_id = c.user_id
        where c.user_id = ${userId}
        limit 1
      `;
      return {
        plan: entitlement.plan,
        entitlementStatus: entitlement.status,
        capabilities: entitlement.capabilities,
        deepAnalysis: {
          limit: entitlement.deepAnalysisLimit,
          used,
          reserved,
          remaining: Math.max(0, entitlement.deepAnalysisLimit - used - reserved),
          periodStart: entitlement.periodStart,
          periodEnd: entitlement.periodEnd,
        },
        billing: {
          customerPortalAvailable: Boolean(billing?.stripe_customer_id),
          cancelAtPeriodEnd: Boolean(billing?.cancel_at_period_end),
          stripeStatus: billing?.status ? String(billing.status) : null,
          currentPeriodEnd: billing?.current_period_end ? asIsoDate(billing.current_period_end) : null,
        },
      };
    });
  }

  async authorizeStage(input: AuthorizeAiStageInput): Promise<AuthorizedAiStage> {
    return this.sql.begin(async transaction => {
      const existingOperationRows = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operations
        where owner_user_id = ${input.userId}
          and operation_kind = ${input.operationKind}
          and logical_analysis_fingerprint = ${input.logicalAnalysisFingerprint}
        limit 1 for update
      `;
      const existingOperation = existingOperationRows[0];
      let operation = existingOperation;
      if (existingOperation) {
        const cached = await this.cachedStage(transaction, String(existingOperation.id), input.stageFingerprint);
        if (cached) return cached;
      }

      const entitlement = await this.resolveEntitlement(transaction, input.userId, input.now, true);
      assertEntitlementAllowsProvider(entitlement);

      if (!operation) {
        const repeated = await transaction<Record<string, unknown>[]>`
          select * from public.shipseal_ai_operations
          where owner_user_id = ${input.userId}
            and operation_kind = ${input.operationKind}
            and logical_analysis_fingerprint = ${input.logicalAnalysisFingerprint}
          limit 1 for update
        `;
        operation = repeated[0];
        if (operation) {
          const cached = await this.cachedStage(transaction, String(operation.id), input.stageFingerprint);
          if (cached) return cached;
        }
      }

      if (!operation) {
        if (input.stageKind === 'expansion') throw operationConflict(false, 'Future expansion is not attached to an authorized root analysis.');
        if (input.reserveUserUnit) {
          const [usage] = await transaction<Record<string, unknown>[]>`
            select
              coalesce(sum(consumed_user_units), 0)::integer as used,
              coalesce(sum(reserved_user_units), 0)::integer as reserved
            from public.shipseal_ai_operations
            where owner_user_id = ${input.userId}
              and created_at >= ${entitlement.periodStart}
              and created_at < ${entitlement.periodEnd}
          `;
          if (Number(usage?.used || 0) + Number(usage?.reserved || 0) >= entitlement.deepAnalysisLimit) {
            throw new AiUsageDeniedError('allowance_exhausted', 429, false, 'Your current Deep Analysis allowance has been used.');
          }
        }
        const operationId = createAiId('aop');
        const publicOperationId = createAiId('op');
        const projectId = await this.resolveOwnedProjectId(transaction, input.userId, input.repositoryIdentity);
        const inserted = await transaction<Record<string, unknown>[]>`
          insert into public.shipseal_ai_operations (
            id, public_operation_id, owner_user_id, project_id, operation_kind, logical_analysis_fingerprint,
            repository_identity, request_fingerprint, pipeline_version, execution_profile, state,
            reserved_user_units, consumed_user_units, created_at, updated_at
          ) values (
            ${operationId}, ${publicOperationId}, ${input.userId}, ${projectId}, ${input.operationKind}, ${input.logicalAnalysisFingerprint},
            ${input.repositoryIdentity}, ${input.requestFingerprint}, ${input.pipelineVersion}, ${input.executionProfile},
            ${input.reserveUserUnit ? 'reserved' : 'running'}, ${input.reserveUserUnit ? 1 : 0}, 0, ${input.now.toISOString()}, ${input.now.toISOString()}
          ) returning *
        `;
        operation = inserted[0];
        if (input.reserveUserUnit) {
          await this.insertLedger(transaction, input.userId, operationId, 'reservation', 1, 0, 'new-logical-deep-analysis', input.now);
        }
      }

      if (String(operation.request_fingerprint) !== input.requestFingerprint
        || String(operation.repository_identity) !== input.repositoryIdentity) {
        throw operationConflict(false, 'The logical analysis identity conflicts with an existing operation.');
      }
      if (operation.state === 'terminal_failure') throw operationConflict(false, 'This analysis reached a terminal failure and cannot create another provider attempt.');
      if (operation.state === 'succeeded' && input.stageKind === 'roots') {
        throw operationConflict(true, 'The analysis already succeeded, but its reusable result is temporarily unavailable.');
      }
      if (input.stageKind === 'expansion' && operation.state !== 'succeeded') {
        throw operationConflict(true, 'Future expansion is waiting for the authorized root analysis.');
      }
      if (input.stageKind === 'expansion') {
        await assertExpansionBelongsToValidatedRoot(transaction, operationIdFor(operation), input.requestFingerprint, input.productStage);
      }

      const operationId = String(operation.id);
      const stageRows = await transaction<Record<string, unknown>[]>`
        insert into public.shipseal_ai_operation_stages (
          id, operation_id, stage_kind, stage_fingerprint, state, created_at, updated_at
        ) values (
          ${createAiId('ast')}, ${operationId}, ${input.stageKind}, ${input.stageFingerprint}, 'authorized', ${input.now.toISOString()}, ${input.now.toISOString()}
        ) on conflict (operation_id, stage_fingerprint) do nothing
        returning *
      `;
      const stage = stageRows[0] || (await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operation_stages
        where operation_id = ${operationId} and stage_fingerprint = ${input.stageFingerprint}
        limit 1 for update
      `)[0];
      if (!stage) throw temporaryUsageError();
      if (stage.state === 'succeeded' && stage.cached_response) return mapCachedAuthorization(operation, stage);
      const leaseActive = stage.state === 'running' && stage.lease_expires_at && new Date(String(stage.lease_expires_at)).getTime() > input.now.getTime();
      if (leaseActive) throw operationConflict(true, 'This analysis stage is already running.');
      if (stage.state === 'terminal_failure' || Number(stage.attempt_count) >= input.maximumStageAttempts) {
        if (input.stageKind === 'roots') await this.releaseRootReservation(transaction, operation, input.userId, 'stage-attempt-limit', input.now);
        throw operationConflict(false, 'This analysis stage reached its provider-attempt limit.');
      }
      const leaseId = createAiId('lease');
      const [authorizedStage] = await transaction<Record<string, unknown>[]>`
        update public.shipseal_ai_operation_stages set
          state = 'running', attempt_count = attempt_count + 1, lease_id = ${leaseId},
          lease_expires_at = ${input.leaseExpiresAt.toISOString()}, updated_at = ${input.now.toISOString()}
        where id = ${String(stage.id)} returning *
      `;
      await transaction`
        update public.shipseal_ai_operations set
          state = case when state = 'succeeded' then state else 'running' end,
          last_attempt_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
        where id = ${operationId}
      `;
      return mapAuthorization(operation, authorizedStage, leaseId);
    });
  }

  async completeStage(input: CompleteAiStageInput) {
    await this.sql.begin(async transaction => {
      const operationRows = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operations
        where id = ${input.authorization.operationId} and owner_user_id = ${input.userId}
        limit 1 for update
      `;
      const operation = operationRows[0];
      const stageRows = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operation_stages
        where id = ${input.authorization.stageId} and operation_id = ${input.authorization.operationId}
        limit 1 for update
      `;
      const stage = stageRows[0];
      if (!operation || !stage || stage.lease_id !== input.authorization.leaseId) return;
      const success = input.response.state === 'enhanced' || input.response.state === 'stage-enhanced';
      if (success) {
        await transaction`
          update public.shipseal_ai_operation_stages set
            state = 'succeeded', cached_response = ${transaction.json(asJson(input.response))},
            lease_id = null, lease_expires_at = null, last_failure_category = null,
            succeeded_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
          where id = ${input.authorization.stageId}
        `;
        if (input.authorization.stageKind === 'roots' || input.authorization.stageKind === 'analysis') {
          if (Number(operation.reserved_user_units) === 1) {
            await transaction`
              update public.shipseal_ai_operations set
                state = 'succeeded', reserved_user_units = 0, consumed_user_units = 1,
                succeeded_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
              where id = ${input.authorization.operationId}
            `;
            await this.insertLedger(transaction, input.userId, input.authorization.operationId, 'consumption', -1, 1, 'validated-root-result', input.now);
          } else {
            await transaction`
              update public.shipseal_ai_operations set state = 'succeeded', succeeded_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
              where id = ${input.authorization.operationId}
            `;
          }
        }
        return;
      }

      const retryable = input.response.state === 'fallback' && input.response.retryable;
      const failureCategory = input.response.state === 'fallback' ? input.response.category : 'invalid_response';
      const didNotReachProvider = [
        'usage_temporarily_unavailable',
        'global_ai_budget_exhausted',
        'global_ai_capacity_reached',
        'operation_conflict',
      ].includes(failureCategory);
      const attemptsExhausted = !didNotReachProvider && Number(stage.attempt_count) >= input.maximumStageAttempts;
      const terminal = !retryable || attemptsExhausted;
      await transaction`
        update public.shipseal_ai_operation_stages set
          state = ${terminal ? 'terminal_failure' : 'retryable_failure'},
          attempt_count = greatest(0, attempt_count - ${didNotReachProvider ? 1 : 0}),
          lease_id = null, lease_expires_at = null,
          last_failure_category = ${failureCategory},
          updated_at = ${input.now.toISOString()}
        where id = ${input.authorization.stageId}
      `;
      if (input.authorization.stageKind === 'roots') {
        if (terminal) {
          await this.releaseRootReservation(
            transaction,
            operation,
            input.userId,
            input.response.state === 'fallback' ? input.response.category : 'invalid-response',
            input.now,
          );
        } else {
          await transaction`
            update public.shipseal_ai_operations set state = 'retryable_failure', updated_at = ${input.now.toISOString()}
            where id = ${input.authorization.operationId}
          `;
        }
      }
    });
  }

  async acquireProviderPermit(input: AcquireProviderPermitInput): Promise<ProviderPermit> {
    return this.sql.begin(async transaction => {
      const stageRows = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operation_stages
        where id = ${input.authorization.stageId} and operation_id = ${input.authorization.operationId}
        limit 1 for update
      `;
      const stage = stageRows[0];
      if (!stage || stage.state !== 'running' || stage.lease_id !== input.authorization.leaseId) {
        throw operationConflict(true, 'The provider-call authorization is no longer active.');
      }
      if (Number(stage.provider_call_count) >= input.maximumProviderCallsPerStage) {
        throw operationConflict(false, 'This analysis stage reached its provider-call limit.');
      }

      const windowKey = utcWindowKey(input.now);
      await transaction`
        insert into public.shipseal_ai_budget_windows (
          window_key, provider_call_limit, provider_call_count, in_flight_count, created_at, updated_at
        ) values (${windowKey}, ${input.dailyLimit}, 0, 0, ${input.now.toISOString()}, ${input.now.toISOString()})
        on conflict (window_key) do update set
          provider_call_limit = excluded.provider_call_limit,
          updated_at = excluded.updated_at
      `;
      const [window] = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_budget_windows where window_key = ${windowKey} for update
      `;
      const [expired] = await transaction<Record<string, unknown>[]>`
        select count(*)::integer as count from public.shipseal_ai_provider_permits
        where window_key = ${windowKey} and state = 'acquired' and expires_at <= ${input.now.toISOString()}
      `;
      const expiredCount = Number(expired?.count || 0);
      if (expiredCount) {
        await transaction`
          update public.shipseal_ai_provider_permits set state = 'expired'
          where window_key = ${windowKey} and state = 'acquired' and expires_at <= ${input.now.toISOString()}
        `;
        await transaction`
          update public.shipseal_ai_budget_windows set
            in_flight_count = greatest(0, in_flight_count - ${expiredCount}), updated_at = ${input.now.toISOString()}
          where window_key = ${windowKey}
        `;
      }
      const callCount = Number(window.provider_call_count || 0);
      const inFlight = Math.max(0, Number(window.in_flight_count || 0) - expiredCount);
      if (callCount >= input.dailyLimit) {
        throw new AiUsageDeniedError('global_ai_budget_exhausted', 503, true, 'ShipSeal AI capacity is unavailable for the rest of this budget window.');
      }
      if (inFlight >= input.maximumInFlight) {
        throw new AiUsageDeniedError('global_ai_capacity_reached', 503, true, 'ShipSeal AI capacity is temporarily full.');
      }

      const permitId = createAiId('prm');
      await transaction`
        insert into public.shipseal_ai_provider_permits (
          id, window_key, operation_id, stage_id, state, acquired_at, expires_at
        ) values (
          ${permitId}, ${windowKey}, ${input.authorization.operationId}, ${input.authorization.stageId},
          'acquired', ${input.now.toISOString()}, ${input.expiresAt.toISOString()}
        )
      `;
      await transaction`
        update public.shipseal_ai_budget_windows set
          provider_call_count = provider_call_count + 1,
          in_flight_count = in_flight_count + 1,
          updated_at = ${input.now.toISOString()}
        where window_key = ${windowKey}
      `;
      await transaction`
        update public.shipseal_ai_operation_stages set provider_call_count = provider_call_count + 1, updated_at = ${input.now.toISOString()}
        where id = ${input.authorization.stageId}
      `;
      await transaction`
        update public.shipseal_ai_operations set provider_attempt_count = provider_attempt_count + 1,
          last_attempt_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
        where id = ${input.authorization.operationId}
      `;
      return { id: permitId, windowKey };
    });
  }

  async releaseProviderPermit(permit: ProviderPermit, now: Date) {
    await this.sql.begin(async transaction => {
      const rows = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_provider_permits where id = ${permit.id} limit 1 for update
      `;
      if (!rows[0] || rows[0].state !== 'acquired') return;
      await transaction`
        update public.shipseal_ai_provider_permits set state = 'released', released_at = ${now.toISOString()} where id = ${permit.id}
      `;
      await transaction`
        update public.shipseal_ai_budget_windows set in_flight_count = greatest(0, in_flight_count - 1), updated_at = ${now.toISOString()}
        where window_key = ${permit.windowKey}
      `;
    });
  }

  async close() { await this.sql.end({ timeout: 5 }); }

  private async resolveEntitlement(transaction: TransactionSql, userId: string, now: Date, lock: boolean): Promise<EntitlementSnapshot> {
    const period = defaultUtcMonthPeriod(now);
    await transaction`
      insert into public.shipseal_entitlements (
        user_id, plan, status, repository_futures, executable_future_plan, deep_analysis_limit,
        period_start, period_end, source, created_at, updated_at
      ) values (
        ${userId}, 'free', 'active', false, true, 0,
        ${period.start}, ${period.end}, 'default', ${now.toISOString()}, ${now.toISOString()}
      ) on conflict (user_id) do nothing
    `;
    let rows = await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_entitlements where user_id = ${userId} limit 1 ${lock ? transaction.unsafe('for update') : transaction.unsafe('')}
    `;
    let row = rows[0];
    if (!row) throw temporaryUsageError();
    if (row.source === 'default' && (new Date(String(row.period_start)).getTime() > now.getTime()
      || new Date(String(row.period_end)).getTime() <= now.getTime())) {
      rows = await transaction<Record<string, unknown>[]>`
        update public.shipseal_entitlements set
          plan = 'free', status = 'active', repository_futures = false, executable_future_plan = true,
          deep_analysis_limit = 0, period_start = ${period.start}, period_end = ${period.end}, updated_at = ${now.toISOString()}
        where user_id = ${userId} returning *
      `;
      row = rows[0];
    }
    const entitlement = mapEntitlement(row);
    if (entitlement.source !== 'default'
      && (now.getTime() < Date.parse(entitlement.periodStart) || now.getTime() >= Date.parse(entitlement.periodEnd))) {
      return { ...entitlement, status: 'expired' };
    }
    return entitlement;
  }

  private async cachedStage(transaction: TransactionSql, operationId: string, stageFingerprint: string) {
    const rows = await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operation_stages
      where operation_id = ${operationId} and stage_fingerprint = ${stageFingerprint}
      limit 1 for update
    `;
    if (rows[0]?.state !== 'succeeded' || !rows[0].cached_response) return null;
    const [operation] = await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operations where id = ${operationId} limit 1
    `;
    return mapCachedAuthorization(operation, rows[0]);
  }

  private async resolveOwnedProjectId(transaction: TransactionSql, userId: string, repositoryIdentity: string) {
    const rows = await transaction<Record<string, unknown>[]>`
      select id from public.shipseal_projects
      where owner_user_id = ${userId} and repository_identity = ${repositoryIdentity} and deleted_at is null
      limit 1
    `;
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  private async insertLedger(
    transaction: TransactionSql,
    userId: string,
    operationId: string,
    kind: 'reservation' | 'consumption' | 'release',
    reservedDelta: number,
    consumedDelta: number,
    reason: string,
    now: Date,
  ) {
    await transaction`
      insert into public.shipseal_ai_usage_ledger (
        id, owner_user_id, operation_id, entry_kind, reserved_unit_delta, consumed_unit_delta, reason, created_at
      ) values (
        ${createAiId('ald')}, ${userId}, ${operationId}, ${kind}, ${reservedDelta}, ${consumedDelta}, ${reason}, ${now.toISOString()}
      )
    `;
  }

  private async releaseRootReservation(transaction: TransactionSql, operation: Record<string, unknown>, userId: string, reason: string, now: Date) {
    if (Number(operation.reserved_user_units) === 1) {
      await this.insertLedger(transaction, userId, String(operation.id), 'release', -1, 0, reason, now);
    }
    await transaction`
      update public.shipseal_ai_operations set
        state = 'terminal_failure', reserved_user_units = 0, terminal_failure_category = ${reason},
        released_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
      where id = ${String(operation.id)}
    `;
  }
}

async function assertExpansionBelongsToValidatedRoot(
  transaction: TransactionSql,
  operationId: string,
  requestFingerprint: string,
  productStage?: RepositoryProductProviderStage,
) {
  if (productStage?.kind !== 'expansion') throw operationConflict(false, 'Future expansion is invalid.');
  const rootFingerprint = stableContextFingerprint({
    version: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    report: requestFingerprint,
    stage: 'roots',
  });
  const rows = await transaction<Record<string, unknown>[]>`
    select cached_response from public.shipseal_ai_operation_stages
    where operation_id = ${operationId} and stage_fingerprint = ${rootFingerprint} and state = 'succeeded'
    limit 1
  `;
  const response = rows[0]?.cached_response as RepositoryIntelligenceProviderApiResponse | undefined;
  const opportunities = response?.state === 'enhanced' ? response.result.productIntelligence?.opportunities : undefined;
  if (!opportunities?.length) throw operationConflict(true, 'Validated Future roots are not available for this expansion.');
  const expectedTotalBatches = Math.ceil(opportunities.length / 3);
  const expectedParents = opportunities.slice(productStage.batchIndex * 3, productStage.batchIndex * 3 + 3).map(opportunity => ({
    id: opportunity.id,
    title: opportunity.title,
    opportunityStatement: opportunity.opportunityStatement,
    userValue: opportunity.userValue,
    whyItFits: opportunity.whyItFits,
    evidenceIds: [...opportunity.evidenceIds].sort(),
  }));
  const expectedFingerprint = stableContextFingerprint({
    version: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    report: requestFingerprint,
    stage: 'expansion',
    parents: expectedParents.map(parent => ({ id: parent.id, evidenceIds: parent.evidenceIds })),
  });
  if (productStage.totalBatches !== expectedTotalBatches
    || productStage.fingerprint !== expectedFingerprint
    || JSON.stringify(productStage.parents.map(parent => ({ ...parent, evidenceIds: [...parent.evidenceIds].sort() }))) !== JSON.stringify(expectedParents)) {
    throw operationConflict(false, 'Future expansion does not match the validated root analysis.');
  }
}

function operationIdFor(operation: Record<string, unknown>) {
  return String(operation.id);
}

function assertEntitlementAllowsProvider(entitlement: EntitlementSnapshot) {
  if (!['active', 'trialing'].includes(entitlement.status)) {
    throw new AiUsageDeniedError('entitlement_inactive', 403, false, 'Your AI entitlement is not active.');
  }
  if (!entitlement.capabilities.repositoryFutures) {
    throw new AiUsageDeniedError('upgrade_required', 403, false, 'Full Repository Futures is a paid AI feature.');
  }
}

function mapEntitlement(row: Record<string, unknown>): EntitlementSnapshot {
  return {
    userId: String(row.user_id),
    plan: row.plan as ShipSealPlan,
    status: row.status as EntitlementStatus,
    capabilities: {
      repositoryFutures: Boolean(row.repository_futures),
      executableFuturePlan: Boolean(row.executable_future_plan),
    },
    deepAnalysisLimit: Number(row.deep_analysis_limit),
    periodStart: asIsoDate(row.period_start),
    periodEnd: asIsoDate(row.period_end),
    source: row.source as EntitlementSource,
  };
}

function mapAuthorization(operation: Record<string, unknown>, stage: Record<string, unknown>, leaseId: string): AuthorizedAiStage {
  return {
    operationId: String(operation.id),
    publicOperationId: String(operation.public_operation_id),
    stageId: String(stage.id),
    stageKind: stage.stage_kind as AiStageKind,
    stageFingerprint: String(stage.stage_fingerprint),
    leaseId,
    stageAttemptCount: Number(stage.attempt_count),
  };
}

function mapCachedAuthorization(operation: Record<string, unknown>, stage: Record<string, unknown>): AuthorizedAiStage {
  return {
    ...mapAuthorization(operation, stage, ''),
    cachedResponse: stage.cached_response as RepositoryIntelligenceProviderApiResponse,
  };
}

function trustedRepositoryIdentity(repository: RepositoryDeepIntelligenceRequest['repository']) {
  if (repository.fullName && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.fullName)) {
    return `github:${repository.fullName.toLowerCase()}`;
  }
  return `upload:${repository.name.trim().toLowerCase()}`;
}

function defaultUtcMonthPeriod(now: Date) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
}

function utcWindowKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

function asIsoDate(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function asJson(value: unknown): JSONValue {
  return JSON.parse(JSON.stringify(value)) as JSONValue;
}

function createAiId(prefix: string) {
  return `${prefix}_${randomBytes(18).toString('base64url')}`;
}

function boundedPositiveInteger(value: string | undefined, fallback: number | undefined, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function operationConflict(retryable: boolean, message: string) {
  return new AiUsageDeniedError('operation_conflict', 409, retryable, message);
}

function temporaryUsageError() {
  return new AiUsageDeniedError('usage_temporarily_unavailable', 503, true, 'AI usage authorization is temporarily unavailable.');
}

let sharedAiUsageStore: AiUsageStore | null = null;

export function getAiUsageStore(env: NodeJS.ProcessEnv = process.env) {
  sharedAiUsageStore ||= PostgresAiUsageStore.fromEnvironment(env);
  return sharedAiUsageStore;
}

export function setAiUsageStoreForTests(store: AiUsageStore | null) {
  sharedAiUsageStore = store;
}

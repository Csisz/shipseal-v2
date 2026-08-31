import { randomBytes } from 'node:crypto';
import postgres, { type JSONValue, type Sql, type TransactionSql } from 'postgres';
import { stableContextFingerprint } from '../../src/lib/repositoryIntelligence/contextSelection.js';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  REPOSITORY_PRODUCT_COMPLETE_CONTRACT_VERSION,
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryIntelligenceSafeDiagnostics,
  type RepositoryProductProviderStage,
} from '../../src/lib/repositoryIntelligence/productionProviderContract.js';
import {
  buildRepositoryProductExpansionStagesForFingerprint,
  buildRepositoryProductRootStageForFingerprint,
  isCompleteRepositoryProductIntelligenceResult,
  mergeRepositoryProductExpansionResults,
} from '../../src/lib/repositoryIntelligence/stagedProductIntelligence.js';
import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';
import type { RepositoryProductIntelligenceResult } from '../../src/lib/repositoryIntelligence/productIntelligenceSchema.js';
import type {
  AccountAiUsageSummary,
  AiUsageDenialCategory,
  EntitlementSnapshot,
  EntitlementSource,
  EntitlementStatus,
  ShipSealPlan,
} from '../../src/lib/entitlements/contract.js';
import { validateAccountDatabaseUrl } from './authConfig.js';
import type {
  AiOperationLookup,
  AiUsageReconciliationReport,
  AiOperationStatusSnapshot,
  PersistedRepositoryFutureResult,
} from '../../src/lib/aiOperationRecoveryContract.js';

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
  integrityRecovery?: boolean;
  cachedResponse?: RepositoryIntelligenceProviderApiResponse;
}

interface AuthorizeAiStageInput {
  userId: string;
  operationKind: AiOperationKind;
  logicalAnalysisFingerprint: string;
  repositoryIdentity: string;
  analysisFingerprint: string;
  providerTransmissionFingerprint: string;
  pipelineVersion: string;
  executionProfile: RepositoryDeepIntelligenceRequest['executionProfile'];
  stageKind: AiStageKind;
  stageFingerprint: string;
  productStage?: RepositoryProductProviderStage;
  reserveUserUnit: boolean;
  now: Date;
  leaseExpiresAt: Date;
  maximumStageAttempts: number;
  recoveryOperationId?: string;
}

interface CompleteAiStageInput {
  authorization: AuthorizedAiStage;
  userId: string;
  operationKind: AiOperationKind;
  response: RepositoryIntelligenceProviderApiResponse;
  now: Date;
  maximumStageAttempts: number;
}

interface FinalizeRepositoryFuturesInput {
  userId: string;
  lookup: AiOperationLookup;
  now: Date;
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
  finalizeRepositoryFutures(input: FinalizeRepositoryFuturesInput): Promise<Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>>;
  reconcileBillingIntegrity(userId: string, now: Date): Promise<AiUsageReconciliationReport>;
  acquireProviderPermit(input: AcquireProviderPermitInput): Promise<ProviderPermit>;
  releaseProviderPermit(permit: ProviderPermit, now: Date): Promise<void>;
  getOperationStatus(userId: string, lookup: AiOperationLookup, now: Date): Promise<AiOperationStatusSnapshot | null>;
  getOperationResult(userId: string, lookup: AiOperationLookup, now: Date): Promise<PersistedRepositoryFutureResult | null>;
  close?(): Promise<void>;
}

export class AiUsageDeniedError extends Error {
  constructor(
    public readonly category: AiUsageDenialCategory,
    public readonly status: number,
    public readonly retryable: boolean,
    message: string,
    public readonly diagnostics?: Pick<RepositoryIntelligenceSafeDiagnostics,
      | 'publicOperationId'
      | 'operationRecoveryAction'
      | 'operationLeaseExpiresAt'
      | 'analysisFingerprint'
      | 'providerTransmissionFingerprint'
      | 'expectedStageFingerprint'
      | 'receivedStageFingerprint'
      | 'analysisFingerprintMismatch'
      | 'stageFingerprintMismatch'
      | 'parentSetMismatch'
      | 'batchMetadataMismatch'
      | 'stageOwnershipFailureReason'
      | 'operationalFailureCategory'
      | 'failureBoundary'
    >,
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

export function buildLogicalAiOperationIdentity(
  userId: string,
  request: RepositoryDeepIntelligenceRequest,
  analysisFingerprint = request.fingerprint,
) {
  const operationKind: AiOperationKind = request.executionProfile === 'product-strategist'
    ? 'repository_futures'
    : 'repository_deep_intelligence';
  const repositoryIdentity = trustedRepositoryIdentity(request.repository);
  const logicalAnalysisFingerprint = stableContextFingerprint({
    userId,
    operationKind,
    repositoryIdentity,
    requestFingerprint: analysisFingerprint,
    pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    rootContractVersion: REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION,
    executionProfile: request.executionProfile,
  });
  return { operationKind, repositoryIdentity, logicalAnalysisFingerprint };
}

export interface AiUsageAuthorizationOptions {
  recoveryOperationId?: string;
  /** Original validated ShipSeal request identity, before provider preparation. */
  analysisFingerprint?: string;
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

  async getOperationStatus(userId: string, lookup: AiOperationLookup) {
    return this.store.getOperationStatus(userId, lookup, this.now());
  }

  async getOperationResult(userId: string, lookup: AiOperationLookup) {
    return this.store.getOperationResult(userId, lookup, this.now());
  }

  async finalizeRepositoryFutures(userId: string, lookup: AiOperationLookup) {
    return this.store.finalizeRepositoryFutures({ userId, lookup, now: this.now() });
  }

  async reconcileBillingIntegrity(userId: string) {
    return this.store.reconcileBillingIntegrity(userId, this.now());
  }

  async authorize(
    userId: string,
    providerRequest: RepositoryDeepIntelligenceRequest,
    productStage?: RepositoryProductProviderStage,
    options: AiUsageAuthorizationOptions = {},
  ): Promise<AuthorizedAiStage> {
    const maximumStageAttempts = boundedPositiveInteger(this.env.SHIPSEAL_AI_MAX_STAGE_ATTEMPTS, 2, 1, 10) || 2;
    const stageLeaseTtlMs = (boundedPositiveInteger(this.env.SHIPSEAL_AI_STAGE_LEASE_TTL_SECONDS, 180, 30, 900) || 180) * 1_000;
    const analysisFingerprint = options.analysisFingerprint ?? providerRequest.fingerprint;
    const identity = buildLogicalAiOperationIdentity(userId, providerRequest, analysisFingerprint);
    const stageKind: AiStageKind = productStage?.kind
      || (providerRequest.executionProfile === 'product-strategist' ? 'roots' : 'analysis');
    const stageFingerprint = productStage?.fingerprint || (providerRequest.executionProfile === 'product-strategist'
      ? buildRepositoryProductRootStageForFingerprint(analysisFingerprint).fingerprint
      : analysisFingerprint);
    const now = this.now();
    return this.store.authorizeStage({
      userId,
      ...identity,
      analysisFingerprint,
      providerTransmissionFingerprint: providerRequest.fingerprint,
      pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
      executionProfile: providerRequest.executionProfile,
      stageKind,
      stageFingerprint,
      productStage,
      reserveUserUnit: identity.operationKind === 'repository_futures' && stageKind === 'roots',
      now,
      leaseExpiresAt: new Date(now.getTime() + stageLeaseTtlMs),
      maximumStageAttempts,
      recoveryOperationId: options.recoveryOperationId,
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
      await this.reconcileHistoricalOperations(transaction, userId, now);
      const [usage] = await transaction<Record<string, unknown>[]>`
        select
          coalesce(sum(consumed_user_units - refunded_user_units), 0)::integer as used,
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

  async getOperationStatus(userId: string, lookup: AiOperationLookup, now: Date): Promise<AiOperationStatusSnapshot | null> {
    return this.sql.begin(async transaction => {
      await this.reconcileHistoricalOperations(transaction, userId, now);
      const operation = await this.findOwnedOperation(transaction, userId, lookup, false);
      if (!operation) return null;
      const stages = await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operation_stages
        where operation_id = ${String(operation.id)} order by created_at asc
      `;
      return mapOperationStatus(operation, stages, now);
    });
  }

  async getOperationResult(userId: string, lookup: AiOperationLookup, now: Date): Promise<PersistedRepositoryFutureResult | null> {
    return this.sql.begin(async transaction => {
      await this.reconcileHistoricalOperations(transaction, userId, now);
      const operation = await this.findOwnedOperation(transaction, userId, lookup, false);
      if (!operation) return null;
      const complete = reusableCompleteResponse(operation.canonical_complete_response, String(operation.request_fingerprint));
      if (!complete || !operation.completed_at || operation.refunded_user_units) return null;
      return {
        publicOperationId: String(operation.public_operation_id),
        complete,
        completionVersion: String(operation.complete_contract_version || REPOSITORY_PRODUCT_COMPLETE_CONTRACT_VERSION),
        completedAt: asIsoDate(operation.completed_at),
      };
    });
  }

  async reconcileBillingIntegrity(userId: string, now: Date): Promise<AiUsageReconciliationReport> {
    return this.sql.begin(transaction => this.reconcileHistoricalOperations(transaction, userId, now));
  }

  async finalizeRepositoryFutures(input: FinalizeRepositoryFuturesInput) {
    const outcome = await this.sql.begin(async transaction => {
      const operation = await this.findOwnedOperation(transaction, input.userId, input.lookup, true);
      if (!operation || operation.operation_kind !== 'repository_futures') {
        throw operationConflict(false, 'The Future analysis operation is unavailable for this account.', { operationRecoveryAction: 'terminal_failure' });
      }
      if (input.lookup.requestFingerprint !== String(operation.request_fingerprint)
        || input.lookup.repositoryIdentity !== String(operation.repository_identity)) {
        throw operationConflict(false, 'The Future completion identity does not match the authorized analysis.', {
          publicOperationId: String(operation.public_operation_id), operationRecoveryAction: 'terminal_failure',
        });
      }
      const existing = reusableCompleteResponse(operation.canonical_complete_response, String(operation.request_fingerprint));
      if (existing && Number(operation.refunded_user_units || 0) === 0) return { response: existing } as const;
      if (Number(operation.refunded_user_units || 0) === 1) {
        throw operationConflict(true, 'The incomplete historical analysis was refunded. Start a new Future analysis.', {
          publicOperationId: String(operation.public_operation_id), operationRecoveryAction: 'start_new_analysis',
        });
      }
      if (Number(operation.reserved_user_units || 0) !== 1 && Number(operation.consumed_user_units || 0) !== 1) {
        throw operationConflict(false, 'The Future analysis has no authorized billing reservation.', {
          publicOperationId: String(operation.public_operation_id), operationRecoveryAction: 'terminal_failure',
        });
      }
      const reconstruction = await reconstructCompleteFuture(transaction, operation);
      if (reconstruction.state === 'incomplete') {
        throw operationConflict(true, 'Future pathway groups are not complete yet.', {
          publicOperationId: String(operation.public_operation_id), operationRecoveryAction: 'retry_stage',
        });
      }
      if (reconstruction.state === 'ambiguous') {
        await this.releaseRootReservation(transaction, operation, input.userId, 'complete-future-validation-failed', input.now);
        return {
          error: operationConflict(false, 'Repository Futures could not be completed. Your Deep Analysis allowance was not used.', {
            publicOperationId: String(operation.public_operation_id), operationRecoveryAction: 'terminal_failure',
          }),
        } as const;
      }
      await persistCompleteFuture(transaction, operation, reconstruction.response, input.now);
      if (Number(operation.reserved_user_units) === 1) {
        await this.insertLedger(transaction, input.userId, String(operation.id), 'consumption', -1, 1, 'validated-complete-future-result', input.now);
      }
      return { response: reconstruction.response } as const;
    });
    if ('error' in outcome) throw outcome.error;
    return outcome.response;
  }

  private async reconcileHistoricalOperations(
    transaction: TransactionSql,
    userId: string,
    now: Date,
  ): Promise<AiUsageReconciliationReport> {
    const report: AiUsageReconciliationReport = {
      inspected: 0,
      reconstructed: 0,
      refunded: 0,
      reviewRequired: 0,
      unchanged: 0,
    };
    const operations = await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operations
      where owner_user_id = ${userId}
        and operation_kind = 'repository_futures'
        and consumed_user_units = 1
        and refunded_user_units = 0
      order by created_at asc
      for update
    `;
    for (const operation of operations) {
      report.inspected += 1;
      const complete = reusableCompleteResponse(
        operation.canonical_complete_response,
        String(operation.request_fingerprint),
      );
      if (complete && operation.completed_at) {
        report.unchanged += 1;
        if (!operation.reconciliation_outcome) {
          await transaction`
            update public.shipseal_ai_operations set
              reconciliation_outcome = 'not-required', reconciled_at = ${now.toISOString()},
              updated_at = ${now.toISOString()}
            where id = ${String(operation.id)}
          `;
        }
        continue;
      }
      const reconstruction = await reconstructCompleteFuture(transaction, operation);
      if (reconstruction.state === 'complete') {
        await persistCompleteFuture(transaction, operation, reconstruction.response, now, 'reconstructed');
        report.reconstructed += 1;
        continue;
      }
      if (reconstruction.state === 'ambiguous') {
        await transaction`
          update public.shipseal_ai_operations set
            reconciliation_outcome = 'review-required', reconciled_at = ${now.toISOString()},
            updated_at = ${now.toISOString()}
          where id = ${String(operation.id)}
        `;
        report.reviewRequired += 1;
        continue;
      }
      await transaction`
        insert into public.shipseal_ai_usage_adjustments (
          id, owner_user_id, operation_id, entry_kind, user_unit_delta, reason, created_at
        ) values (
          ${createAiId('adj')}, ${userId}, ${String(operation.id)}, 'refund', -1,
          'historical-incomplete-repository-futures', ${now.toISOString()}
        ) on conflict (operation_id, entry_kind) do nothing
      `;
      await transaction`
        update public.shipseal_ai_operations set
          refunded_user_units = 1, reserved_user_units = 0, state = 'terminal_failure',
          terminal_failure_category = 'historical-incomplete-future-refunded',
          reconciliation_outcome = 'refunded', reconciled_at = ${now.toISOString()},
          released_at = coalesce(released_at, ${now.toISOString()}), updated_at = ${now.toISOString()}
        where id = ${String(operation.id)} and refunded_user_units = 0
      `;
      report.refunded += 1;
    }
    return report;
  }

  async authorizeStage(input: AuthorizeAiStageInput): Promise<AuthorizedAiStage> {
    const outcome = await this.sql.begin(async transaction => {
      await this.reconcileHistoricalOperations(transaction, input.userId, input.now);
      const requestedRecoveryRows = input.recoveryOperationId && /^op_[A-Za-z0-9_-]{20,80}$/.test(input.recoveryOperationId)
        ? await transaction<Record<string, unknown>[]>`
          select * from public.shipseal_ai_operations
          where owner_user_id = ${input.userId} and public_operation_id = ${input.recoveryOperationId}
            and operation_kind = ${input.operationKind} and repository_identity = ${input.repositoryIdentity}
            and refunded_user_units = 0 and state <> 'terminal_failure'
          limit 1 for update
        `
        : [];
      if (input.recoveryOperationId && requestedRecoveryRows.length === 0) {
        throw operationConflict(false, 'The requested Future recovery operation is unavailable for this account.', {
          operationRecoveryAction: 'terminal_failure',
        });
      }
      const existingOperationRows = requestedRecoveryRows.length ? requestedRecoveryRows : await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operations
        where owner_user_id = ${input.userId}
          and operation_kind = ${input.operationKind}
          and logical_analysis_fingerprint = ${input.logicalAnalysisFingerprint}
          and state <> 'terminal_failure'
          and refunded_user_units = 0
        order by created_at desc limit 1 for update
      `;
      const existingOperation = existingOperationRows[0];
      let operation = existingOperation;
      if (existingOperation) {
        const cached = await this.cachedStage(transaction, String(existingOperation.id), input.stageFingerprint);
        if (cached) return cached;
        const reusable = await this.recoverReusableRoot(transaction, existingOperation, input);
        if (reusable) return reusable;
      }

      const entitlement = await this.resolveEntitlement(transaction, input.userId, input.now, true);
      assertEntitlementAllowsProvider(entitlement);

      if (!operation) {
        const repeated = await transaction<Record<string, unknown>[]>`
          select * from public.shipseal_ai_operations
          where owner_user_id = ${input.userId}
            and operation_kind = ${input.operationKind}
            and logical_analysis_fingerprint = ${input.logicalAnalysisFingerprint}
            and state <> 'terminal_failure'
            and refunded_user_units = 0
          order by created_at desc limit 1 for update
        `;
        operation = repeated[0];
        if (operation) {
          const cached = await this.cachedStage(transaction, String(operation.id), input.stageFingerprint);
          if (cached) return cached;
          const reusable = await this.recoverReusableRoot(transaction, operation, input);
          if (reusable) return reusable;
        }
      }

      // Pipeline/stage presentation versions may evolve while the immutable
      // repository request remains the same. A previously consumed compatible
      // operation remains the billing and recovery authority across deploys.
      if (!operation && input.stageKind === 'roots') {
        const compatibleRows = await transaction<Record<string, unknown>[]>`
          select * from public.shipseal_ai_operations
          where owner_user_id = ${input.userId}
            and operation_kind = ${input.operationKind}
            and repository_identity = ${input.repositoryIdentity}
            and request_fingerprint = ${input.analysisFingerprint}
            and execution_profile = ${input.executionProfile}
            and state <> 'terminal_failure' and refunded_user_units = 0
          order by succeeded_at desc nulls last, created_at desc
          limit 1 for update
        `;
        operation = compatibleRows[0];
        if (operation) {
          const cached = await this.cachedStage(transaction, String(operation.id), input.stageFingerprint);
          if (cached) return cached;
          const reusable = await this.recoverReusableRoot(transaction, operation, input);
          if (reusable) return reusable;
        }
      }

      if (!operation) {
        if (input.stageKind === 'expansion') throw operationConflict(false, 'Future expansion is not attached to an authorized root analysis.');
        if (input.reserveUserUnit) {
          const [usage] = await transaction<Record<string, unknown>[]>`
            select
              coalesce(sum(consumed_user_units - refunded_user_units), 0)::integer as used,
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
            ${input.repositoryIdentity}, ${input.analysisFingerprint}, ${input.pipelineVersion}, ${input.executionProfile},
            ${input.reserveUserUnit ? 'reserved' : 'running'}, ${input.reserveUserUnit ? 1 : 0}, 0, ${input.now.toISOString()}, ${input.now.toISOString()}
          ) returning *
        `;
        operation = inserted[0];
        if (input.reserveUserUnit) {
          await this.insertLedger(transaction, input.userId, operationId, 'reservation', 1, 0, 'new-logical-deep-analysis', input.now);
        }
      }

      if ((!input.recoveryOperationId && String(operation.request_fingerprint) !== input.analysisFingerprint)
        || String(operation.repository_identity) !== input.repositoryIdentity) {
        throw operationConflict(false, 'The logical analysis identity conflicts with an existing operation.', {
          analysisFingerprint: input.analysisFingerprint,
          providerTransmissionFingerprint: input.providerTransmissionFingerprint,
          analysisFingerprintMismatch: String(operation.request_fingerprint) !== input.analysisFingerprint,
          operationalFailureCategory: 'expansion_stage_ownership_failed',
          failureBoundary: 'authorization',
          stageOwnershipFailureReason: 'analysis-fingerprint-mismatch',
        });
      }
      if (operation.state === 'terminal_failure') throw operationConflict(false, 'This analysis reached a terminal failure and cannot create another provider attempt.');
      if (operation.state === 'succeeded' && input.stageKind === 'roots') {
        return this.authorizeIntegrityRecovery(transaction, operation, input);
      }
      if (input.stageKind === 'expansion') {
        await assertExpansionBelongsToValidatedRoot(
          transaction,
          operationIdFor(operation),
          input.analysisFingerprint,
          input.providerTransmissionFingerprint,
          input.productStage,
        );
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
      if (leaseActive) throw operationConflict(true, 'This analysis stage is already running.', {
        publicOperationId: String(operation.public_operation_id),
        operationRecoveryAction: 'wait_for_active_lease',
        operationLeaseExpiresAt: asIsoDate(stage.lease_expires_at),
      });
      if (stage.state === 'terminal_failure' || Number(stage.attempt_count) >= input.maximumStageAttempts) {
        await this.releaseRootReservation(transaction, operation, input.userId, 'stage-attempt-limit', input.now);
        return {
          billingIntegrityDenial: operationConflict(false, 'This analysis stage reached its provider-attempt limit.', {
            publicOperationId: String(operation.public_operation_id), operationRecoveryAction: 'terminal_failure',
          }),
        } as const;
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
          state = 'running',
          last_attempt_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
        where id = ${operationId}
      `;
      return mapAuthorization(operation, authorizedStage, leaseId);
    });
    if ('billingIntegrityDenial' in outcome) throw outcome.billingIntegrityDenial;
    return outcome;
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
      const success = input.authorization.stageKind === 'expansion'
        ? input.response.state === 'stage-enhanced'
        : input.authorization.stageKind === 'roots'
          ? Boolean(reusableRootResponse(input.response))
          : input.response.state === 'enhanced';
      if (success) {
        await transaction`
          update public.shipseal_ai_operation_stages set
            state = 'succeeded', cached_response = ${transaction.json(asJson(input.response))},
            lease_id = null, lease_expires_at = null, last_failure_category = null,
            succeeded_at = ${input.now.toISOString()}, updated_at = ${input.now.toISOString()}
          where id = ${input.authorization.stageId}
        `;
        if (input.authorization.stageKind === 'roots' || input.authorization.stageKind === 'analysis') {
          if (input.authorization.stageKind === 'roots') {
            await transaction`
              update public.shipseal_ai_operations set
                canonical_root_response = ${transaction.json(asJson(input.response))},
                canonical_root_stage_fingerprint = ${input.authorization.stageFingerprint},
                canonical_root_contract_version = ${REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION},
                integrity_recovered_at = case when ${Boolean(input.authorization.integrityRecovery)} then ${input.now.toISOString()} else integrity_recovered_at end,
                updated_at = ${input.now.toISOString()}
              where id = ${input.authorization.operationId}
            `;
            await transaction`
              update public.shipseal_ai_operations set state = 'running', updated_at = ${input.now.toISOString()}
              where id = ${input.authorization.operationId}
            `;
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
      if (input.authorization.stageKind === 'roots' || input.authorization.stageKind === 'expansion') {
        if (input.authorization.integrityRecovery) return;
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

  private async recoverReusableRoot(
    transaction: TransactionSql,
    operation: Record<string, unknown>,
    input: AuthorizeAiStageInput,
  ): Promise<AuthorizedAiStage | null> {
    if (input.stageKind !== 'roots' || operation.state === 'terminal_failure') return null;
    const canonical = reusableRootResponse(operation.canonical_root_response);
    if (canonical) {
      return {
        operationId: String(operation.id),
        publicOperationId: String(operation.public_operation_id),
        stageId: `canonical_${String(operation.id)}`,
        stageKind: 'roots',
        stageFingerprint: String(operation.canonical_root_stage_fingerprint || input.stageFingerprint),
        leaseId: '',
        stageAttemptCount: 0,
        cachedResponse: canonical,
      };
    }
    const compatible = await this.latestReusableRootStage(transaction, String(operation.id), true);
    const response = reusableRootResponse(compatible?.cached_response);
    if (!compatible || !response) return null;
    await transaction`
      update public.shipseal_ai_operations set
        canonical_root_response = ${transaction.json(asJson(response))},
        canonical_root_stage_fingerprint = ${String(compatible.stage_fingerprint)},
        canonical_root_contract_version = ${REPOSITORY_PRODUCT_ROOT_CONTRACT_VERSION},
        integrity_recovered_at = coalesce(integrity_recovered_at, ${input.now.toISOString()}),
        updated_at = ${input.now.toISOString()}
      where id = ${String(operation.id)}
    `;
    return mapCachedAuthorization(operation, compatible);
  }

  private async authorizeIntegrityRecovery(
    transaction: TransactionSql,
    operation: Record<string, unknown>,
    input: AuthorizeAiStageInput,
  ): Promise<AuthorizedAiStage> {
    if (Number(operation.consumed_user_units) !== 1) {
      throw operationConflict(false, 'The succeeded analysis does not have a recoverable paid result.', {
        publicOperationId: String(operation.public_operation_id),
        operationRecoveryAction: 'terminal_failure',
      });
    }
    const recoveryFingerprint = stableContextFingerprint({
      version: 'shipseal.ai-integrity-recovery.v1',
      operationId: String(operation.id),
      requestedRootFingerprint: input.stageFingerprint,
    });
    let recovery = (await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operation_stages
      where operation_id = ${String(operation.id)} and integrity_recovery = true
      limit 1 for update
    `)[0];
    if (recovery) {
      const active = recovery.state === 'running' && recovery.lease_expires_at
        && new Date(String(recovery.lease_expires_at)).getTime() > input.now.getTime();
      if (active) {
        throw operationConflict(true, 'Integrity recovery is already running.', {
          publicOperationId: String(operation.public_operation_id),
          operationRecoveryAction: 'wait_for_active_lease',
          operationLeaseExpiresAt: asIsoDate(recovery.lease_expires_at),
        });
      }
      if (Number(recovery.provider_call_count) > 0 || recovery.state === 'terminal_failure' || recovery.state === 'succeeded') {
        throw operationConflict(false, 'The bounded integrity recovery attempt has already been used.', {
          publicOperationId: String(operation.public_operation_id),
          operationRecoveryAction: 'terminal_failure',
        });
      }
    } else {
      if (Number(operation.integrity_recovery_attempt_count) >= 1) {
        throw operationConflict(false, 'The bounded integrity recovery attempt has already been used.', {
          publicOperationId: String(operation.public_operation_id),
          operationRecoveryAction: 'terminal_failure',
        });
      }
      [recovery] = await transaction<Record<string, unknown>[]>`
        insert into public.shipseal_ai_operation_stages (
          id, operation_id, stage_kind, stage_fingerprint, state, integrity_recovery, created_at, updated_at
        ) values (
          ${createAiId('ast')}, ${String(operation.id)}, 'roots', ${recoveryFingerprint}, 'authorized', true,
          ${input.now.toISOString()}, ${input.now.toISOString()}
        ) returning *
      `;
      await transaction`
        update public.shipseal_ai_operations set
          integrity_recovery_attempt_count = 1,
          integrity_recovery_started_at = ${input.now.toISOString()},
          updated_at = ${input.now.toISOString()}
        where id = ${String(operation.id)}
      `;
    }
    const leaseId = createAiId('lease');
    const [authorized] = await transaction<Record<string, unknown>[]>`
      update public.shipseal_ai_operation_stages set
        state = 'running', attempt_count = attempt_count + 1, lease_id = ${leaseId},
        lease_expires_at = ${input.leaseExpiresAt.toISOString()}, updated_at = ${input.now.toISOString()}
      where id = ${String(recovery.id)} returning *
    `;
    return { ...mapAuthorization(operation, authorized, leaseId), integrityRecovery: true };
  }

  private async findOwnedOperation(
    transaction: TransactionSql,
    userId: string,
    lookup: AiOperationLookup,
    lock: boolean,
  ) {
    const suffix = lock ? transaction.unsafe('for update') : transaction.unsafe('');
    if (lookup.publicOperationId && /^op_[A-Za-z0-9_-]{20,80}$/.test(lookup.publicOperationId)) {
      return (await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operations
        where owner_user_id = ${userId} and public_operation_id = ${lookup.publicOperationId}
        limit 1 ${suffix}
      `)[0];
    }
    const repositoryIdentity = validRepositoryLookupIdentity(lookup.repositoryIdentity);
    const requestFingerprint = validFingerprint(lookup.requestFingerprint);
    if (!repositoryIdentity && !requestFingerprint) return undefined;
    if (repositoryIdentity && requestFingerprint) {
      return (await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operations
        where owner_user_id = ${userId} and operation_kind = 'repository_futures'
          and repository_identity = ${repositoryIdentity} and request_fingerprint = ${requestFingerprint}
        order by
          (canonical_complete_response is not null and refunded_user_units = 0) desc,
          (state <> 'terminal_failure') desc,
          created_at desc limit 1 ${suffix}
      `)[0];
    }
    if (repositoryIdentity) {
      return (await transaction<Record<string, unknown>[]>`
        select * from public.shipseal_ai_operations
        where owner_user_id = ${userId} and operation_kind = 'repository_futures'
          and repository_identity = ${repositoryIdentity}
        order by
          (canonical_complete_response is not null and refunded_user_units = 0) desc,
          (state <> 'terminal_failure') desc,
          succeeded_at desc nulls last, created_at desc limit 1 ${suffix}
      `)[0];
    }
    return (await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operations
      where owner_user_id = ${userId} and operation_kind = 'repository_futures'
        and request_fingerprint = ${requestFingerprint!}
      order by
        (canonical_complete_response is not null and refunded_user_units = 0) desc,
        (state <> 'terminal_failure') desc,
        created_at desc limit 1 ${suffix}
    `)[0];
  }

  private async latestRootStage(transaction: TransactionSql, operationId: string, lock: boolean) {
    const suffix = lock ? transaction.unsafe('for update') : transaction.unsafe('');
    return (await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operation_stages
      where operation_id = ${operationId} and stage_kind = 'roots'
      order by integrity_recovery desc, updated_at desc limit 1 ${suffix}
    `)[0];
  }

  private async latestReusableRootStage(transaction: TransactionSql, operationId: string, lock: boolean) {
    const suffix = lock ? transaction.unsafe('for update') : transaction.unsafe('');
    const rows = await transaction<Record<string, unknown>[]>`
      select * from public.shipseal_ai_operation_stages
      where operation_id = ${operationId} and stage_kind = 'roots'
        and state = 'succeeded' and cached_response is not null
      order by succeeded_at desc nulls last, updated_at desc ${suffix}
    `;
    return rows.find(row => reusableRootResponse(row.cached_response));
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
  providerTransmissionFingerprint: string,
  productStage?: RepositoryProductProviderStage,
) {
  if (productStage?.kind !== 'expansion') throw operationConflict(false, 'Future expansion is invalid.', {
    analysisFingerprint: requestFingerprint,
    providerTransmissionFingerprint,
    operationalFailureCategory: 'expansion_stage_ownership_failed',
    failureBoundary: 'stage-ownership-validation',
    batchMetadataMismatch: true,
    stageOwnershipFailureReason: 'batch-metadata-mismatch',
  });
  const rootFingerprint = buildRepositoryProductRootStageForFingerprint(requestFingerprint).fingerprint;
  const rows = await transaction<Record<string, unknown>[]>`
    select s.cached_response, o.canonical_root_response
    from public.shipseal_ai_operations o
    left join public.shipseal_ai_operation_stages s
      on s.operation_id = o.id and s.stage_fingerprint = ${rootFingerprint} and s.state = 'succeeded'
    where o.id = ${operationId}
    limit 1
  `;
  const response = reusableRootResponse(rows[0]?.cached_response)
    || reusableRootResponse(rows[0]?.canonical_root_response)
    || undefined;
  const product = response?.state === 'enhanced' ? response.result.productIntelligence : undefined;
  if (!product?.opportunities.length) throw operationConflict(true, 'Validated Future roots are not available for this expansion.', {
    analysisFingerprint: requestFingerprint,
    providerTransmissionFingerprint,
    operationalFailureCategory: 'expansion_stage_ownership_failed',
    failureBoundary: 'stage-ownership-validation',
    stageOwnershipFailureReason: 'validated-root-unavailable',
  });
  const ownership = validateRepositoryProductExpansionOwnership(requestFingerprint, product, productStage);
  if (ownership.valid === false) {
    throw operationConflict(false, 'Future expansion does not match the validated root analysis.', {
      analysisFingerprint: requestFingerprint,
      providerTransmissionFingerprint,
      expectedStageFingerprint: ownership.expectedStageFingerprint,
      receivedStageFingerprint: productStage.fingerprint,
      analysisFingerprintMismatch: ownership.reason === 'analysis-fingerprint-mismatch',
      stageFingerprintMismatch: ownership.reason === 'stage-fingerprint-mismatch',
      parentSetMismatch: ownership.reason === 'parent-set-mismatch',
      batchMetadataMismatch: ownership.reason === 'batch-metadata-mismatch',
      stageOwnershipFailureReason: ownership.reason,
      operationalFailureCategory: 'expansion_stage_ownership_failed',
      failureBoundary: 'stage-ownership-validation',
    });
  }
}

export type RepositoryProductExpansionOwnershipFailureReason =
  | 'analysis-fingerprint-mismatch'
  | 'stage-fingerprint-mismatch'
  | 'parent-set-mismatch'
  | 'batch-metadata-mismatch';

export function validateRepositoryProductExpansionOwnership(
  analysisFingerprint: string,
  product: RepositoryProductIntelligenceResult,
  stage: Extract<RepositoryProductProviderStage, { kind: 'expansion' }>,
): { valid: true } | {
  valid: false;
  reason: RepositoryProductExpansionOwnershipFailureReason;
  expectedStageFingerprint?: string;
} {
  if (product.sourceAnalysisFingerprint !== analysisFingerprint) {
    return { valid: false, reason: 'analysis-fingerprint-mismatch' };
  }
  const expectedStages = buildRepositoryProductExpansionStagesForFingerprint(analysisFingerprint, product);
  const expected = expectedStages[stage.batchIndex];
  if (!expected || stage.batchIndex < 0 || stage.totalBatches !== expectedStages.length) {
    return { valid: false, reason: 'batch-metadata-mismatch', expectedStageFingerprint: expected?.fingerprint };
  }
  if (!sameExpansionParents(stage.parents, expected.parents)) {
    return { valid: false, reason: 'parent-set-mismatch', expectedStageFingerprint: expected.fingerprint };
  }
  if (stage.fingerprint !== expected.fingerprint) {
    return { valid: false, reason: 'stage-fingerprint-mismatch', expectedStageFingerprint: expected.fingerprint };
  }
  return { valid: true };
}

function sameExpansionParents(
  received: Extract<RepositoryProductProviderStage, { kind: 'expansion' }>['parents'],
  expected: Extract<RepositoryProductProviderStage, { kind: 'expansion' }>['parents'],
) {
  if (received.length !== expected.length) return false;
  return received.every((parent, index) => {
    const canonical = expected[index];
    return parent.id === canonical.id
      && parent.title === canonical.title
      && parent.opportunityStatement === canonical.opportunityStatement
      && parent.userValue === canonical.userValue
      && parent.whyItFits === canonical.whyItFits
      && sameOrderedStrings([...parent.evidenceIds].sort(), [...canonical.evidenceIds].sort());
  });
}

function sameOrderedStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
    integrityRecovery: Boolean(stage.integrity_recovery),
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

function reusableRootResponse(value: unknown): Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Partial<Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>>;
  const opportunities = response.state === 'enhanced' ? response.result?.productIntelligence?.opportunities : undefined;
  return response.version === REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION
    && Array.isArray(opportunities) && opportunities.length >= 6 && opportunities.length <= 8
    ? response as Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>
    : null;
}

function isReusableExpansionResponse(value: unknown): value is Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Partial<Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>>;
  return response.version === REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION
    && response.state === 'stage-enhanced'
    && Boolean(response.stageResult && Array.isArray(response.stageResult.expansions));
}

export type CompleteFutureReconstruction =
  | { state: 'complete'; response: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }> }
  | { state: 'incomplete' }
  | { state: 'ambiguous' };

function reusableCompleteResponse(
  value: unknown,
  requestFingerprint: string,
): Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }> | null {
  const response = reusableRootResponse(value);
  return response && isCompleteRepositoryProductIntelligenceResult(
    response.result.productIntelligence,
    requestFingerprint,
  ) ? response : null;
}

async function reconstructCompleteFuture(
  transaction: TransactionSql,
  operation: Record<string, unknown>,
): Promise<CompleteFutureReconstruction> {
  const stages = await transaction<Record<string, unknown>[]>`
    select * from public.shipseal_ai_operation_stages
    where operation_id = ${String(operation.id)}
    order by created_at asc
  `;
  return reconstructCompleteFutureFromRecords(operation, stages);
}

export function reconstructCompleteFutureFromRecords(
  operation: Record<string, unknown>,
  stages: Record<string, unknown>[],
): CompleteFutureReconstruction {
  const requestFingerprint = String(operation.request_fingerprint);
  const persistedComplete = reusableCompleteResponse(operation.canonical_complete_response, requestFingerprint);
  if (persistedComplete) return { state: 'complete', response: persistedComplete };

  const rootCandidates = [
    operation.canonical_root_response,
    ...stages.filter(stage => stage.stage_kind === 'roots' && stage.state === 'succeeded')
      .map(stage => stage.cached_response),
  ];
  const root = rootCandidates.map(reusableRootResponse).find(Boolean) || null;
  if (!root?.result.productIntelligence) return { state: 'incomplete' };

  const expectedStages = buildRepositoryProductExpansionStagesForFingerprint(
    requestFingerprint,
    root.result.productIntelligence,
  );
  const batches = [];
  for (const expected of expectedStages) {
    const matching = stages.find(stage => stage.stage_kind === 'expansion'
      && stage.stage_fingerprint === expected.fingerprint
      && stage.state === 'succeeded'
      && isReusableExpansionResponse(stage.cached_response));
    if (!matching || !isReusableExpansionResponse(matching.cached_response)) return { state: 'incomplete' };
    const stageResult = matching.cached_response.stageResult;
    if (stageResult.fingerprint !== expected.fingerprint
      || stageResult.batchIndex !== expected.batchIndex
      || stageResult.totalBatches !== expected.totalBatches
      || !sameStringSet(stageResult.expansions.map(item => item.parentId), expected.parents.map(parent => parent.id))) {
      return { state: 'ambiguous' };
    }
    batches.push(stageResult);
  }
  try {
    const mergedResult = mergeRepositoryProductExpansionResults(root.result, batches);
    if (!isCompleteRepositoryProductIntelligenceResult(mergedResult.productIntelligence, requestFingerprint)) {
      return { state: 'ambiguous' };
    }
    return {
      state: 'complete',
      response: {
        ...root,
        result: mergedResult,
        diagnostics: {
          ...root.diagnostics,
          cacheUsed: stages.some(stage => stage.cached_response != null),
          expansionBatchCount: expectedStages.length,
          acceptedSecondGenerationCount: mergedResult.productIntelligence?.opportunities
            .flatMap(opportunity => opportunity.futureEvolutions)
            .filter(evolution => evolution.generation === 2).length,
          acceptedThirdGenerationCount: mergedResult.productIntelligence?.opportunities
            .flatMap(opportunity => opportunity.futureEvolutions)
            .filter(evolution => evolution.generation === 3).length,
        },
      },
    };
  } catch {
    return { state: 'ambiguous' };
  }
}

async function persistCompleteFuture(
  transaction: TransactionSql,
  operation: Record<string, unknown>,
  response: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>,
  now: Date,
  reconciliationOutcome: 'not-required' | 'reconstructed' = 'not-required',
) {
  const finalFingerprint = response.result.productIntelligence?.fingerprint || response.result.fingerprint;
  await transaction`
    update public.shipseal_ai_operations set
      canonical_complete_response = ${transaction.json(asJson(response))},
      canonical_complete_fingerprint = ${finalFingerprint},
      complete_contract_version = ${REPOSITORY_PRODUCT_COMPLETE_CONTRACT_VERSION},
      completed_at = coalesce(completed_at, ${now.toISOString()}),
      state = 'succeeded', reserved_user_units = 0, consumed_user_units = 1,
      succeeded_at = coalesce(succeeded_at, ${now.toISOString()}),
      reconciliation_outcome = ${reconciliationOutcome}, reconciled_at = ${now.toISOString()},
      terminal_failure_category = null, released_at = null, updated_at = ${now.toISOString()}
    where id = ${String(operation.id)}
  `;
}

function sameStringSet(left: string[], right: string[]) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((value, index) => value === sortedRight[index]);
}

function mapOperationStatus(
  operation: Record<string, unknown>,
  stages: Record<string, unknown>[],
  now: Date,
): AiOperationStatusSnapshot {
  const root = stages.filter(stage => stage.stage_kind === 'roots')
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))[0];
  const rootResponse = reusableRootResponse(operation.canonical_root_response)
    || reusableRootResponse(root?.cached_response);
  const rootCacheAvailable = Boolean(rootResponse);
  const cacheAvailable = Boolean(reusableCompleteResponse(
    operation.canonical_complete_response,
    String(operation.request_fingerprint),
  ) && operation.completed_at && Number(operation.refunded_user_units || 0) === 0);
  const expectedExpansionCount = rootResponse?.result.productIntelligence
    ? buildRepositoryProductExpansionStagesForFingerprint(
      String(operation.request_fingerprint),
      rootResponse.result.productIntelligence,
    ).length
    : null;
  const completedExpansionCount = stages.filter(stage => stage.stage_kind === 'expansion'
    && stage.state === 'succeeded' && isReusableExpansionResponse(stage.cached_response)).length;
  const runningStages = stages.filter(stage => stage.state === 'running');
  const activeStage = runningStages.find(stage => stage.lease_expires_at
    && new Date(String(stage.lease_expires_at)).getTime() > now.getTime());
  const staleStage = runningStages.find(stage => !stage.lease_expires_at
    || new Date(String(stage.lease_expires_at)).getTime() <= now.getTime());
  const retryableStage = stages.find(stage => stage.state === 'retryable_failure');
  const leaseExpiresAt = activeStage?.lease_expires_at ? asIsoDate(activeStage.lease_expires_at) : null;
  const consumed = Number(operation.consumed_user_units) === 1;
  const refunded = Number(operation.refunded_user_units) === 1;
  const reserved = Number(operation.reserved_user_units) === 1;
  const released = Boolean(operation.released_at);
  let recoveryAction: AiOperationStatusSnapshot['recoveryAction'];
  if (cacheAvailable) recoveryAction = 'open_result';
  else if (refunded) recoveryAction = 'start_new_analysis';
  else if (activeStage) recoveryAction = 'wait_for_active_lease';
  else if (staleStage) recoveryAction = 'resume_stale_lease';
  else if (retryableStage) recoveryAction = 'retry_stage';
  else if (reserved && rootCacheAvailable) recoveryAction = 'retry_stage';
  else if (operation.state === 'terminal_failure') recoveryAction = 'terminal_failure';
  else recoveryAction = 'start_new_analysis';
  const completionState: AiOperationStatusSnapshot['completionState'] = cacheAvailable
    ? 'ready'
    : refunded
      ? 'refunded'
      : activeStage
        ? 'running'
        : staleStage || retryableStage
          ? 'retryable'
          : rootCacheAvailable || completedExpansionCount > 0
            ? 'incomplete'
            : operation.state === 'terminal_failure'
              ? 'terminal'
              : 'incomplete';
  return {
    publicOperationId: String(operation.public_operation_id),
    operationState: operation.state as AiOperationStatusSnapshot['operationState'],
    rootStageState: root?.state as AiOperationStatusSnapshot['rootStageState'] || 'missing',
    retryable: ['resume_stale_lease', 'retry_stage', 'integrity_recovery'].includes(recoveryAction),
    completionState,
    cacheAvailable,
    rootCacheAvailable,
    completedExpansionCount,
    expectedExpansionCount,
    leaseExpiresAt,
    userUnitState: refunded ? 'refunded' : consumed ? 'consumed' : reserved ? 'reserved' : released ? 'released' : 'none',
    recoveryAction,
    integrityRecoveryAttemptsUsed: Number(operation.integrity_recovery_attempt_count || 0),
    reconciliationOutcome: (operation.reconciliation_outcome || 'not-required') as AiOperationStatusSnapshot['reconciliationOutcome'],
  };
}

function validFingerprint(value: string | undefined) {
  return value && /^[a-z0-9]{8,128}$/i.test(value) ? value : undefined;
}

function validRepositoryLookupIdentity(value: string | undefined) {
  return value && /^(?:github|upload):[A-Za-z0-9_./-]{1,220}$/i.test(value) ? value.toLowerCase() : undefined;
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

function operationConflict(retryable: boolean, message: string, diagnostics?: AiUsageDeniedError['diagnostics']) {
  return new AiUsageDeniedError('operation_conflict', 409, retryable, message, diagnostics);
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

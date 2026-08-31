import { describe, expect, it, vi } from 'vitest';
import {
  AiUsageAuthorizationService,
  AiUsageDeniedError,
  type AiUsageStore,
  type AuthorizedAiStage,
} from '../../api/_lib/aiUsage';
import type { EntitlementSnapshot } from '@/lib/entitlements/contract';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
  type RepositoryProductProviderStage,
} from '@/lib/repositoryIntelligence/productionProviderContract';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';
import type { RepositoryDeepIntelligenceRequest } from '@/lib/repositoryIntelligence/deepIntelligenceRequest';

const NOW = new Date('2026-08-24T12:00:00.000Z');
const ENV = {
  NODE_ENV: 'test',
  SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: '20',
  SHIPSEAL_AI_GLOBAL_MAX_IN_FLIGHT: '2',
};

type AuthorizeInput = Parameters<AiUsageStore['authorizeStage']>[0];
type CompleteInput = Parameters<AiUsageStore['completeStage']>[0];
type PermitInput = Parameters<AiUsageStore['acquireProviderPermit']>[0];
type Permit = Awaited<ReturnType<AiUsageStore['acquireProviderPermit']>>;

interface FixtureStage {
  id: string;
  kind: AuthorizedAiStage['stageKind'];
  fingerprint: string;
  leaseId: string;
  attemptCount: number;
  providerCalls: number;
  state: 'running' | 'retryable_failure' | 'terminal_failure' | 'succeeded';
  cached?: RepositoryIntelligenceProviderApiResponse;
  integrityRecovery?: boolean;
}

interface FixtureOperation {
  id: string;
  publicId: string;
  ownerUserId: string;
  identity: string;
  reserved: number;
  consumed: number;
  refunded: number;
  state: 'running' | 'retryable_failure' | 'terminal_failure' | 'succeeded';
  stages: Map<string, FixtureStage>;
  integrityRecoveryAttempts: number;
  complete?: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>;
}

class TransactionalFixtureAiUsageStore implements AiUsageStore {
  readonly entitlements = new Map<string, EntitlementSnapshot>();
  readonly operations = new Map<string, FixtureOperation>();
  providerCallCount = 0;
  inFlightCount = 0;
  maximumObservedInFlight = 0;
  private permitSequence = 0;
  private operationSequence = 0;
  private stageSequence = 0;
  private lockTail: Promise<void> = Promise.resolve();

  setEntitlement(userId: string, limit: number, repositoryFutures = true) {
    this.entitlements.set(userId, {
      userId,
      plan: repositoryFutures ? 'internal' : 'free',
      status: 'active',
      capabilities: { repositoryFutures, executableFuturePlan: true },
      deepAnalysisLimit: limit,
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-09-01T00:00:00.000Z',
      source: repositoryFutures ? 'internal' : 'default',
    });
  }

  async getEntitlement(userId: string) {
    return this.entitlements.get(userId) || freeEntitlement(userId);
  }

  async getUsageSummary(userId: string) {
    const entitlement = await this.getEntitlement(userId);
    const owned = [...this.operations.values()].filter(operation => operation.ownerUserId === userId);
    const used = owned.reduce((sum, operation) => sum + operation.consumed - operation.refunded, 0);
    const reserved = owned.reduce((sum, operation) => sum + operation.reserved, 0);
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
    };
  }

  async getOperationStatus(userId: string, lookup: { publicOperationId?: string }) {
    const operation = [...this.operations.values()].find(candidate =>
      candidate.ownerUserId === userId
      && (!lookup.publicOperationId || candidate.publicId === lookup.publicOperationId),
    );
    if (!operation) return null;
    const root = [...operation.stages.values()].find(stage => stage.kind === 'roots' || stage.kind === 'analysis');
    const cacheAvailable = Boolean(root?.state === 'succeeded' && root.cached);
    const completeAvailable = Boolean(operation.complete && !operation.refunded);
    return {
      publicOperationId: operation.publicId,
      operationState: operation.state,
      rootStageState: root?.state || 'missing' as const,
      retryable: root?.state === 'retryable_failure',
      completionState: completeAvailable ? 'ready' as const : operation.refunded ? 'refunded' as const : operation.state === 'running' ? 'running' as const : 'incomplete' as const,
      cacheAvailable: completeAvailable,
      rootCacheAvailable: cacheAvailable,
      completedExpansionCount: [...operation.stages.values()].filter(stage => stage.kind === 'expansion' && stage.state === 'succeeded').length,
      expectedExpansionCount: null,
      leaseExpiresAt: null,
      userUnitState: operation.refunded ? 'refunded' as const : operation.consumed ? 'consumed' as const : operation.reserved ? 'reserved' as const : 'released' as const,
      recoveryAction: completeAvailable ? 'open_result' as const : operation.refunded ? 'start_new_analysis' as const : 'retry_stage' as const,
      integrityRecoveryAttemptsUsed: operation.integrityRecoveryAttempts,
      reconciliationOutcome: operation.refunded ? 'refunded' as const : 'not-required' as const,
    };
  }

  async getOperationResult(userId: string, lookup: { publicOperationId?: string }) {
    const operation = [...this.operations.values()].find(candidate =>
      candidate.ownerUserId === userId
      && (!lookup.publicOperationId || candidate.publicId === lookup.publicOperationId),
    );
    if (!operation?.complete || operation.refunded) return null;
    return { publicOperationId: operation.publicId, complete: operation.complete, completionVersion: 'fixture.v1', completedAt: NOW.toISOString() };
  }

  finalizeRepositoryFutures(input: Parameters<AiUsageStore['finalizeRepositoryFutures']>[0]) {
    return this.locked(() => {
      const operation = [...this.operations.values()].find(candidate => candidate.ownerUserId === input.userId
        && (!input.lookup.publicOperationId || candidate.publicId === input.lookup.publicOperationId));
      if (!operation) throw conflict('operation missing');
      const complete = enhanced() as Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>;
      operation.complete = complete;
      operation.consumed += operation.reserved;
      operation.reserved = 0;
      operation.state = 'succeeded';
      return complete;
    });
  }

  reconcileBillingIntegrity(userId: string) {
    return this.locked(() => {
      const report = { inspected: 0, reconstructed: 0, refunded: 0, reviewRequired: 0, unchanged: 0 };
      for (const operation of this.operations.values()) {
        if (operation.ownerUserId !== userId || !operation.consumed || operation.refunded) continue;
        report.inspected += 1;
        if (operation.complete) report.unchanged += 1;
        else { operation.refunded = 1; operation.state = 'terminal_failure'; report.refunded += 1; }
      }
      return report;
    });
  }

  authorizeStage(input: AuthorizeInput) {
    return this.locked(() => {
      const key = `${input.userId}:${input.logicalAnalysisFingerprint}`;
      const requestedRecovery = input.recoveryOperationId
        ? [...this.operations.values()].find(candidate => candidate.publicId === input.recoveryOperationId)
        : undefined;
      if (input.recoveryOperationId && (
        requestedRecovery?.ownerUserId !== input.userId
        || requestedRecovery.refunded > 0
        || requestedRecovery.state === 'terminal_failure'
      )) {
        throw conflict('Recovery operation is unavailable for this account.');
      }
      const currentOperation = this.operations.get(key);
      let operation = requestedRecovery || (currentOperation?.refunded === 0 && currentOperation.state !== 'terminal_failure'
        ? currentOperation
        : undefined);
      const cachedStage = operation?.stages.get(input.stageFingerprint);
      if (cachedStage?.state === 'succeeded' && cachedStage.cached) {
        return authorization(operation!, cachedStage, cachedStage.cached);
      }
      const compatibleRoot = operation?.state === 'succeeded' && input.stageKind === 'roots'
        ? [...operation.stages.values()].find(stage => stage.kind === 'roots' && stage.state === 'succeeded' && stage.cached)
        : undefined;
      if (operation && compatibleRoot?.cached) return authorization(operation, compatibleRoot, compatibleRoot.cached);
      const entitlement = this.entitlements.get(input.userId) || freeEntitlement(input.userId);
      if (!['active', 'trialing'].includes(entitlement.status)) {
        throw new AiUsageDeniedError('entitlement_inactive', 403, false, 'inactive');
      }
      if (!entitlement.capabilities.repositoryFutures) {
        throw new AiUsageDeniedError('upgrade_required', 403, false, 'upgrade');
      }
      if (!operation) {
        if (input.stageKind === 'expansion') throw conflict('Expansion has no owned root.');
        const committed = [...this.operations.values()]
          .filter(candidate => candidate.ownerUserId === input.userId)
          .reduce((sum, candidate) => sum + candidate.reserved + candidate.consumed - candidate.refunded, 0);
        if (input.reserveUserUnit && committed >= entitlement.deepAnalysisLimit) {
          throw new AiUsageDeniedError('allowance_exhausted', 429, false, 'exhausted');
        }
        this.operationSequence += 1;
        operation = {
          id: `aop_${this.operationSequence}`,
          publicId: `op_${this.operationSequence}`,
          ownerUserId: input.userId,
          identity: input.logicalAnalysisFingerprint,
          reserved: input.reserveUserUnit ? 1 : 0,
          consumed: 0,
          refunded: 0,
          state: 'running',
          stages: new Map(),
          integrityRecoveryAttempts: 0,
        };
        this.operations.set(key, operation);
      }
      if (input.stageKind === 'expansion' && ![...operation.stages.values()].some(stage => stage.kind === 'roots' && stage.state === 'succeeded')) throw conflict('Root is not ready.');
      if (input.stageKind === 'roots' && operation.state === 'succeeded' && operation.consumed === 1 && !operation.complete) {
        if (operation.integrityRecoveryAttempts >= 1) throw conflict('Integrity recovery already used.');
        operation.integrityRecoveryAttempts += 1;
        this.stageSequence += 1;
        const recovery: FixtureStage = {
          id: `ast_${this.stageSequence}`,
          kind: 'roots',
          fingerprint: `integrity-${operation.publicId}`,
          leaseId: `lease_integrity_${operation.publicId}`,
          attemptCount: 1,
          providerCalls: 0,
          state: 'running',
          integrityRecovery: true,
        };
        operation.stages.set(recovery.fingerprint, recovery);
        return authorization(operation, recovery);
      }
      let stage = operation.stages.get(input.stageFingerprint);
      if (stage?.state === 'running') throw conflict('Stage is already running.');
      if (stage?.state === 'terminal_failure') throw conflict('Stage is terminal.');
      if (!stage) {
        this.stageSequence += 1;
        stage = {
          id: `ast_${this.stageSequence}`,
          kind: input.stageKind,
          fingerprint: input.stageFingerprint,
          leaseId: '',
          attemptCount: 0,
          providerCalls: 0,
          state: 'running',
        };
        operation.stages.set(input.stageFingerprint, stage);
      }
      stage.state = 'running';
      stage.attemptCount += 1;
      stage.leaseId = `lease_${stage.id}_${stage.attemptCount}`;
      return authorization(operation, stage);
    });
  }

  completeStage(input: CompleteInput) {
    return this.locked(() => {
      const operation = [...this.operations.values()].find(candidate => candidate.id === input.authorization.operationId);
      const stage = operation?.stages.get(input.authorization.stageFingerprint);
      if (!operation || operation.ownerUserId !== input.userId || !stage || stage.leaseId !== input.authorization.leaseId) return;
      if (input.response.state === 'enhanced' || input.response.state === 'stage-enhanced') {
        stage.state = 'succeeded';
        stage.cached = input.response;
        if (stage.kind === 'analysis') {
          operation.consumed += operation.reserved;
          operation.reserved = 0;
          operation.state = 'succeeded';
        } else {
          operation.state = 'running';
        }
        return;
      }
      if (input.response.retryable) {
        stage.state = 'retryable_failure';
        if (!stage.integrityRecovery) operation.state = 'retryable_failure';
      } else {
        stage.state = 'terminal_failure';
        if (!stage.integrityRecovery) {
          operation.reserved = 0;
          operation.state = 'terminal_failure';
        }
      }
    });
  }

  acquireProviderPermit(input: PermitInput) {
    return this.locked(() => {
      const operation = [...this.operations.values()].find(candidate => candidate.id === input.authorization.operationId);
      const stage = operation?.stages.get(input.authorization.stageFingerprint);
      if (!stage || stage.state !== 'running' || stage.leaseId !== input.authorization.leaseId) throw conflict('authorization expired');
      if (this.providerCallCount >= input.dailyLimit) {
        throw new AiUsageDeniedError('global_ai_budget_exhausted', 503, true, 'daily limit');
      }
      if (this.inFlightCount >= input.maximumInFlight) {
        throw new AiUsageDeniedError('global_ai_capacity_reached', 503, true, 'capacity');
      }
      if (stage.providerCalls >= input.maximumProviderCallsPerStage) throw conflict('stage call limit');
      this.providerCallCount += 1;
      this.inFlightCount += 1;
      this.maximumObservedInFlight = Math.max(this.maximumObservedInFlight, this.inFlightCount);
      stage.providerCalls += 1;
      this.permitSequence += 1;
      return { id: `prm_${this.permitSequence}`, windowKey: '2026-08-24' };
    });
  }

  releaseProviderPermit(_permit: Permit) {
    return this.locked(() => { this.inFlightCount = Math.max(0, this.inFlightCount - 1); });
  }

  operationFor(userId: string, request: RepositoryDeepIntelligenceRequest) {
    const identity = stableContextFingerprint({
      userId,
      operationKind: 'repository_futures',
      repositoryIdentity: 'github:csisz/shipseal-v2',
      requestFingerprint: request.fingerprint,
      pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
      rootContractVersion: 'shipseal.repository-product-roots.v2',
      executionProfile: 'product-strategist',
    });
    return this.operations.get(`${userId}:${identity}`);
  }

  private locked<T>(work: () => T | Promise<T>): Promise<T> {
    const result = this.lockTail.then(work, work);
    this.lockTail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function request(fingerprint: string): RepositoryDeepIntelligenceRequest {
  return {
    executionProfile: 'product-strategist',
    repository: { name: 'ShipSeal', fullName: 'Csisz/shipseal-v2', sourceType: 'github', ref: 'main' },
    fingerprint,
  } as unknown as RepositoryDeepIntelligenceRequest;
}

function roots(value: RepositoryDeepIntelligenceRequest): RepositoryProductProviderStage {
  return {
    kind: 'roots',
    fingerprint: stableContextFingerprint({ version: REPOSITORY_PRODUCT_PIPELINE_VERSION, report: value.fingerprint, stage: 'roots' }),
  };
}

function expansion(value: RepositoryDeepIntelligenceRequest, batchIndex: number): RepositoryProductProviderStage {
  return { kind: 'expansion', fingerprint: `expansion-${batchIndex}`, batchIndex, totalBatches: 2, parents: [] };
}

function enhanced(): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'enhanced',
    result: {} as never,
    providerId: 'fixture-provider',
    deepState: 'completed',
    diagnostics: { costEstimate: 'unavailable' },
  };
}

function stageEnhanced(): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'stage-enhanced',
    stageResult: {} as never,
    providerId: 'fixture-provider',
    deepState: 'completed',
    diagnostics: { costEstimate: 'unavailable' },
  };
}

function fallback(retryable: boolean): RepositoryIntelligenceProviderApiResponse {
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'fallback',
    category: retryable ? 'provider_unavailable' : 'schema_validation_failed',
    retryable,
    message: 'safe failure',
    deepState: 'failed',
    diagnostics: { costEstimate: 'unavailable' },
  };
}

function authorization(operation: FixtureOperation, stage: FixtureStage, cachedResponse?: RepositoryIntelligenceProviderApiResponse): AuthorizedAiStage {
  return {
    operationId: operation.id,
    publicOperationId: operation.publicId,
    stageId: stage.id,
    stageKind: stage.kind,
    stageFingerprint: stage.fingerprint,
    leaseId: stage.leaseId,
    stageAttemptCount: stage.attemptCount,
    ...(stage.integrityRecovery ? { integrityRecovery: true } : {}),
    ...(cachedResponse ? { cachedResponse } : {}),
  };
}

function freeEntitlement(userId: string): EntitlementSnapshot {
  return {
    userId,
    plan: 'free',
    status: 'active',
    capabilities: { repositoryFutures: false, executableFuturePlan: true },
    deepAnalysisLimit: 0,
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    source: 'default',
  };
}

function conflict(message: string) {
  return new AiUsageDeniedError('operation_conflict', 409, true, message);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

describe('Omega 19.1 transactional Deep Analysis lifecycle', () => {
  it('keeps one unit reserved after root success and consumes only after complete Future finalization', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('paid-success');
    const authorization = await service.authorize('paid', input, roots(input));
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 1, remaining: 1 });
    const outbound = vi.fn(async () => new Response('{}'));
    await service.guardProviderFetcher(authorization, outbound as typeof fetch)('https://api.openai.test');
    await service.complete(authorization, 'paid', enhanced());
    expect(outbound).toHaveBeenCalledTimes(1);
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 1, remaining: 1 });
    await service.finalizeRepositoryFutures('paid', { publicOperationId: authorization.publicOperationId });
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 1, reserved: 0, remaining: 1 });
  });

  it('attaches multiple expansion batches to the consumed root with zero additional user units', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('expansion');
    const root = await service.authorize('paid', input, roots(input));
    await service.complete(root, 'paid', enhanced());
    for (let batch = 0; batch < 2; batch += 1) {
      const child = await service.authorize('paid', input, expansion(input, batch));
      await service.complete(child, 'paid', stageEnhanced());
    }
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 1, remaining: 0 });
    await service.finalizeRepositoryFutures('paid', { publicOperationId: root.publicOperationId });
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 1, reserved: 0, remaining: 0 });
  });

  it('retries the same failed stage without a second reservation or charge', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('retry');
    const first = await service.authorize('paid', input, roots(input));
    await service.complete(first, 'paid', fallback(true));
    const retry = await service.authorize('paid', input, roots(input));
    expect(retry.operationId).toBe(first.operationId);
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 1 });
  });

  it('converges concurrent duplicate roots on one logical operation and one reservation', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('duplicate');
    const results = await Promise.allSettled([
      service.authorize('paid', input, roots(input)),
      service.authorize('paid', input, roots(input)),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(store.operations).toHaveLength(1);
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ reserved: 1, used: 0 });
  });

  it('serializes distinct analyses so one remaining allowance cannot be overspent', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const first = request('distinct-a');
    const second = request('distinct-b');
    const results = await Promise.allSettled([
      service.authorize('paid', first, roots(first)),
      service.authorize('paid', second, roots(second)),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const denial = results.find(result => result.status === 'rejected');
    expect(denial).toMatchObject({ reason: { category: 'allowance_exhausted' } });
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ reserved: 1, remaining: 0 });
  });

  it('returns a reusable cached root without a new unit or provider call', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('cached');
    const first = await service.authorize('paid', input, roots(input));
    await service.complete(first, 'paid', enhanced());
    await service.finalizeRepositoryFutures('paid', { publicOperationId: first.publicOperationId });
    const cached = await service.authorize('paid', input, roots(input));
    const outbound = vi.fn();
    if (!cached.cachedResponse) await service.guardProviderFetcher(cached, outbound as typeof fetch)('https://api.openai.test');
    expect(cached.cachedResponse?.state).toBe('enhanced');
    expect(outbound).not.toHaveBeenCalled();
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 1, reserved: 0 });
  });

  it('restores a consumed durable root through the owner-scoped result contract after reload', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 10);
    const firstInstance = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('reload-durable-root');
    const root = await firstInstance.authorize('paid', input, roots(input));
    await firstInstance.complete(root, 'paid', enhanced());
    await firstInstance.finalizeRepositoryFutures('paid', { publicOperationId: root.publicOperationId });

    const reloadedInstance = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const status = await reloadedInstance.getOperationStatus('paid', { publicOperationId: root.publicOperationId });
    const persisted = await reloadedInstance.getOperationResult('paid', { publicOperationId: root.publicOperationId });
    expect(status).toMatchObject({ cacheAvailable: true, recoveryAction: 'open_result', userUnitState: 'consumed' });
    expect(persisted?.complete.state).toBe('enhanced');
    expect((await reloadedInstance.getUsageSummary('paid')).deepAnalysis).toMatchObject({ limit: 10, used: 1, reserved: 0, remaining: 9 });
    await expect(reloadedInstance.getOperationResult('another-user', { publicOperationId: root.publicOperationId })).resolves.toBeNull();
  });

  it('refunds a historical consumed operation that has no complete durable result', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('integrity-recovery');
    const first = await service.authorize('paid', input, roots(input));
    await service.complete(first, 'paid', enhanced());
    const historical = store.operationFor('paid', input)!;
    historical.consumed = 1; historical.reserved = 0; historical.state = 'succeeded';
    historical.stages.get(first.stageFingerprint)!.cached = undefined;
    const report = await service.reconcileBillingIntegrity('paid');
    expect(report).toMatchObject({ inspected: 1, refunded: 1 });
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 0, remaining: 2 });
  });

  it('makes historical refunds idempotent and does not create free provider retries', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('integrity-abuse');
    const first = await service.authorize('paid', input, roots(input));
    await service.complete(first, 'paid', enhanced());
    const historical = store.operationFor('paid', input)!;
    historical.consumed = 1; historical.reserved = 0; historical.state = 'succeeded';
    historical.stages.get(first.stageFingerprint)!.cached = undefined;
    await service.reconcileBillingIntegrity('paid');
    const repeated = await service.reconcileBillingIntegrity('paid');
    expect(repeated).toMatchObject({ inspected: 0, refunded: 0 });
    expect(store.providerCallCount).toBe(0);
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 0 });
  });

  it('starts a new owned operation after refund without attaching to the historical operation', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('refunded-new-analysis');
    const first = await service.authorize('paid', input, roots(input));
    await service.complete(first, 'paid', enhanced());
    const historical = store.operationFor('paid', input)!;
    historical.consumed = 1; historical.reserved = 0; historical.state = 'succeeded';
    historical.stages.get(first.stageFingerprint)!.cached = undefined;
    await service.reconcileBillingIntegrity('paid');

    const status = await service.getOperationStatus('paid', { publicOperationId: first.publicOperationId });
    expect(status).toMatchObject({
      completionState: 'refunded', userUnitState: 'refunded',
      recoveryAction: 'start_new_analysis', retryable: false,
    });

    const next = await service.authorize('paid', input, roots(input));
    expect(next.publicOperationId).not.toBe(first.publicOperationId);
    expect(historical).toMatchObject({ publicId: first.publicOperationId, refunded: 1, consumed: 1, state: 'terminal_failure' });
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 1, remaining: 1 });

    const outbound = vi.fn(async () => new Response('{}'));
    await service.guardProviderFetcher(next, outbound as typeof fetch)('https://api.openai.test');
    expect(outbound).toHaveBeenCalledTimes(1);
    await expect(service.authorize('paid', input, roots(input), { recoveryOperationId: first.publicOperationId })).rejects.toMatchObject({ category: 'operation_conflict' });
  });

  it('denies an exhausted allowance before a provider permit can be requested', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 0);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('exhausted');
    await expect(service.authorize('paid', input, roots(input))).rejects.toMatchObject({ category: 'allowance_exhausted' });
    expect(store.providerCallCount).toBe(0);
  });

  it('retains one reservation after retryable failure and releases it on terminal failure', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('failure-lifecycle');
    const first = await service.authorize('paid', input, roots(input));
    await service.complete(first, 'paid', fallback(true));
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 1 });
    const retry = await service.authorize('paid', input, roots(input));
    await service.complete(retry, 'paid', fallback(false));
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 0, reserved: 0, remaining: 1 });
    expect(store.operationFor('paid', input)?.state).toBe('terminal_failure');
  });

  it('does not let another owner attach an expansion to an existing operation', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('owner-a', 1);
    store.setEntitlement('owner-b', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('owned-analysis');
    const root = await service.authorize('owner-a', input, roots(input));
    await service.complete(root, 'owner-a', enhanced());
    await expect(service.authorize('owner-b', input, expansion(input, 0))).rejects.toMatchObject({ category: 'operation_conflict' });
    expect(store.operationFor('owner-b', input)).toBeUndefined();
  });

  it('does not let another owner claim an explicit integrity-recovery operation id', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('owner-a', 1);
    store.setEntitlement('owner-b', 1);
    const service = new AiUsageAuthorizationService(store, ENV, () => NOW);
    const input = request('owned-integrity-recovery');
    const root = await service.authorize('owner-a', input, roots(input));
    await service.complete(root, 'owner-a', enhanced());
    store.operationFor('owner-a', input)!.stages.get(root.stageFingerprint)!.cached = undefined;

    await expect(service.authorize('owner-b', input, roots(input), { recoveryOperationId: root.publicOperationId }))
      .rejects.toMatchObject({ category: 'operation_conflict' });
    expect(store.operationFor('owner-b', input)).toBeUndefined();
    expect((await service.getUsageSummary('owner-b')).deepAnalysis).toMatchObject({ used: 0, reserved: 0 });
  });
});

describe('Omega 19.1 persisted global provider-call policy', () => {
  it('does not start provider fetch when the daily provider-call budget is exhausted', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    store.providerCallCount = 1;
    const service = new AiUsageAuthorizationService(store, {
      ...ENV,
      SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: '1',
    }, () => NOW);
    const input = request('daily-cap');
    const root = await service.authorize('paid', input, roots(input));
    const outbound = vi.fn();
    await expect(service.guardProviderFetcher(root, outbound as typeof fetch)('https://api.openai.test'))
      .rejects.toMatchObject({ category: 'global_ai_budget_exhausted' });
    expect(outbound).not.toHaveBeenCalled();
  });

  it('bounds parallel provider requests at the configured global in-flight maximum', async () => {
    const store = new TransactionalFixtureAiUsageStore();
    store.setEntitlement('paid', 2);
    const service = new AiUsageAuthorizationService(store, {
      ...ENV,
      SHIPSEAL_AI_GLOBAL_MAX_IN_FLIGHT: '1',
    }, () => NOW);
    const firstInput = request('capacity-a');
    const secondInput = request('capacity-b');
    const first = await service.authorize('paid', firstInput, roots(firstInput));
    const second = await service.authorize('paid', secondInput, roots(secondInput));
    const pending = deferred<Response>();
    const firstFetch = service.guardProviderFetcher(first, vi.fn(() => pending.promise) as typeof fetch)('https://api.openai.test');
    await Promise.resolve();
    const secondOutbound = vi.fn();
    await expect(service.guardProviderFetcher(second, secondOutbound as typeof fetch)('https://api.openai.test'))
      .rejects.toMatchObject({ category: 'global_ai_capacity_reached' });
    expect(secondOutbound).not.toHaveBeenCalled();
    expect(store.maximumObservedInFlight).toBe(1);
    pending.resolve(new Response('{}'));
    await firstFetch;
    expect(store.inFlightCount).toBe(0);
  });
});

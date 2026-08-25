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
}

interface FixtureOperation {
  id: string;
  publicId: string;
  ownerUserId: string;
  identity: string;
  reserved: number;
  consumed: number;
  state: 'running' | 'retryable_failure' | 'terminal_failure' | 'succeeded';
  stages: Map<string, FixtureStage>;
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
    const used = owned.reduce((sum, operation) => sum + operation.consumed, 0);
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

  authorizeStage(input: AuthorizeInput) {
    return this.locked(() => {
      const key = `${input.userId}:${input.logicalAnalysisFingerprint}`;
      let operation = this.operations.get(key);
      const cachedStage = operation?.stages.get(input.stageFingerprint);
      if (cachedStage?.state === 'succeeded' && cachedStage.cached) {
        return authorization(operation!, cachedStage, cachedStage.cached);
      }
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
          .reduce((sum, candidate) => sum + candidate.reserved + candidate.consumed, 0);
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
          state: 'running',
          stages: new Map(),
        };
        this.operations.set(key, operation);
      }
      if (input.stageKind === 'expansion' && operation.state !== 'succeeded') throw conflict('Root is not ready.');
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
        if (stage.kind === 'roots' || stage.kind === 'analysis') {
          operation.consumed += operation.reserved;
          operation.reserved = 0;
          operation.state = 'succeeded';
        }
        return;
      }
      if (input.response.retryable) {
        stage.state = 'retryable_failure';
        operation.state = 'retryable_failure';
      } else {
        stage.state = 'terminal_failure';
        operation.reserved = 0;
        operation.state = 'terminal_failure';
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
  it('reserves one unit for a paid root, permits the provider, and consumes exactly one unit on success', async () => {
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
    const cached = await service.authorize('paid', input, roots(input));
    const outbound = vi.fn();
    if (!cached.cachedResponse) await service.guardProviderFetcher(cached, outbound as typeof fetch)('https://api.openai.test');
    expect(cached.cachedResponse?.state).toBe('enhanced');
    expect(outbound).not.toHaveBeenCalled();
    expect((await service.getUsageSummary('paid')).deepAnalysis).toMatchObject({ used: 1, reserved: 0 });
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

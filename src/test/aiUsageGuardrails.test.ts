import { afterEach, describe, expect, it, vi } from 'vitest';
import repositoryIntelligenceHandler, { buildAuthenticatedStageSingleFlightKey } from '../../api/repository-intelligence';
import usageHandler from '../../api/_routes/account/usage';
import {
  AiUsageAuthorizationService,
  AiUsageDeniedError,
  buildLogicalAiOperationIdentity,
  resolveAiCostGuardConfig,
  setAiUsageStoreForTests,
  type AiUsageStore,
  type AuthorizedAiStage,
} from '../../api/_lib/aiUsage';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { hashSessionToken } from '../../api/_lib/accountSession';
import { setAccountPersistenceStoreForTests } from '../../api/_lib/accountPersistence';
import { requestRepositoryIntelligenceEnhancement } from '@/lib/repositoryIntelligence/deepIntelligenceClient';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  repositoryFutureFailureMessage,
  type RepositoryIntelligenceProviderApiResponse,
} from '@/lib/repositoryIntelligence/productionProviderContract';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';
import type { RepositoryDeepIntelligenceRequest } from '@/lib/repositoryIntelligence/deepIntelligenceRequest';
import {
  buildRepositoryIntelligenceEvidence,
  buildRepositoryProductStrategistRequest,
  prepareRepositoryProductStrategistContext,
} from '@/lib/repositoryIntelligence';
import { SAMPLE_PROJECT_REPO_INPUT } from '@/lib/demo/sampleReadiness';

const now = new Date('2026-08-24T12:00:00.000Z');

function requestFixture(): RepositoryDeepIntelligenceRequest {
  return {
    executionProfile: 'product-strategist',
    repository: { name: 'ShipSeal', fullName: 'Csisz/shipseal-v2', sourceType: 'github', ref: 'main' },
    fingerprint: 'request-fingerprint-stable',
  } as unknown as RepositoryDeepIntelligenceRequest;
}

function authorizedStage(overrides: Partial<AuthorizedAiStage> = {}): AuthorizedAiStage {
  return {
    operationId: 'aop_test',
    publicOperationId: 'op_test',
    stageId: 'ast_test',
    stageKind: 'roots',
    stageFingerprint: 'root-fingerprint',
    leaseId: 'lease_test',
    stageAttemptCount: 1,
    ...overrides,
  };
}

function usageSummary() {
  return {
    plan: 'internal' as const,
    entitlementStatus: 'active' as const,
    capabilities: { repositoryFutures: true, executableFuturePlan: true },
    deepAnalysis: {
      limit: 10,
      used: 3,
      reserved: 1,
      remaining: 6,
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-09-01T00:00:00.000Z',
    },
  };
}

function fakeStore(overrides: Partial<AiUsageStore> = {}) {
  const store = {
    getEntitlement: vi.fn(),
    getUsageSummary: vi.fn(async () => usageSummary()),
    authorizeStage: vi.fn(async () => authorizedStage()),
    completeStage: vi.fn(async () => undefined),
    acquireProviderPermit: vi.fn(async () => ({ id: 'prm_test', windowKey: '2026-08-24' })),
    releaseProviderPermit: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as AiUsageStore;
  return store;
}

function response() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string | string[]) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
    json() { return JSON.parse(this.body) as Record<string, unknown>; },
  };
}

afterEach(() => {
  setAiUsageStoreForTests(null);
  setAccountPersistenceStoreForTests(null);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Omega 19.1 logical AI usage authorization', () => {
  it('binds a stable logical Futures operation to the owner and request, not a stage attempt key', async () => {
    const request = requestFixture();
    const ownerA = buildLogicalAiOperationIdentity('usr_owner_a', request);
    const ownerARepeated = buildLogicalAiOperationIdentity('usr_owner_a', request);
    const ownerB = buildLogicalAiOperationIdentity('usr_owner_b', request);
    expect(ownerA.logicalAnalysisFingerprint).toBe(ownerARepeated.logicalAnalysisFingerprint);
    expect(ownerA.logicalAnalysisFingerprint).not.toBe(ownerB.logicalAnalysisFingerprint);

    const store = fakeStore();
    const service = new AiUsageAuthorizationService(store, {}, () => now);
    const rootsFingerprint = stableContextFingerprint({ version: REPOSITORY_PRODUCT_PIPELINE_VERSION, report: request.fingerprint, stage: 'roots' });
    await service.authorize('usr_owner_a', request, { kind: 'roots', fingerprint: rootsFingerprint });
    await service.authorize('usr_owner_a', request, {
      kind: 'expansion', fingerprint: 'expansion-fingerprint', batchIndex: 0, totalBatches: 1, parents: [],
    });
    const calls = vi.mocked(store.authorizeStage).mock.calls.map(call => call[0]);
    expect(calls[0].logicalAnalysisFingerprint).toBe(calls[1].logicalAnalysisFingerprint);
    expect(calls[0]).toMatchObject({ stageKind: 'roots', reserveUserUnit: true });
    expect(calls[1]).toMatchObject({ stageKind: 'expansion', reserveUserUnit: false });
  });

  it('acquires and releases one persisted permit around every actual provider fetch', async () => {
    const store = fakeStore();
    const service = new AiUsageAuthorizationService(store, {
      NODE_ENV: 'test',
      SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: '20',
      SHIPSEAL_AI_GLOBAL_MAX_IN_FLIGHT: '2',
    }, () => now);
    const outbound = vi.fn(async () => new Response('{}', { status: 200 }));
    const guarded = service.guardProviderFetcher(authorizedStage(), outbound as typeof fetch);
    await guarded('https://api.openai.com/v1/chat/completions');
    await guarded('https://api.openai.com/v1/chat/completions');
    expect(store.acquireProviderPermit).toHaveBeenCalledTimes(2);
    expect(outbound).toHaveBeenCalledTimes(2);
    expect(store.releaseProviderPermit).toHaveBeenCalledTimes(2);
  });

  it('fails closed when production global cost limits are missing or invalid', () => {
    expect(() => resolveAiCostGuardConfig({ NODE_ENV: 'production' })).toThrowError(AiUsageDeniedError);
    expect(() => resolveAiCostGuardConfig({
      NODE_ENV: 'production',
      SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: 'unlimited',
      SHIPSEAL_AI_GLOBAL_MAX_IN_FLIGHT: '5',
    })).toThrowError(/temporarily unavailable/i);
  });
});

describe('Omega 19.1 authenticated API boundaries', () => {
  it('returns authentication_required before configuration or provider access for an anonymous caller', async () => {
    const accountStore = new InMemoryAccountPersistenceStore();
    setAccountPersistenceStoreForTests(accountStore);
    const outbound = vi.fn();
    vi.stubGlobal('fetch', outbound);
    const req = {
      method: 'POST',
      body: { version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request: requestFixture() },
      headers: {},
      once: vi.fn(),
      removeListener: vi.fn(),
    };
    const res = response();
    await repositoryIntelligenceHandler(req as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ state: 'fallback', category: 'authentication_required', retryable: false });
    expect(outbound).not.toHaveBeenCalled();
  });

  it('returns only the authenticated account allowance and never the global provider budget', async () => {
    const accountStore = new InMemoryAccountPersistenceStore();
    const user = await accountStore.upsertOAuthUser({ providerSubject: 'usage-owner', email: null, displayName: 'Usage Owner', avatarUrl: null });
    const token = `usage-session-${'x'.repeat(36)}`;
    await accountStore.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      createdAt: now.toISOString(),
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    setAccountPersistenceStoreForTests(accountStore);
    setAiUsageStoreForTests(fakeStore());
    const res = response();
    await usageHandler({
      method: 'GET',
      headers: { cookie: `__Host-shipseal_session=${token}` },
    } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(usageSummary());
    expect(res.body).not.toMatch(/provider_call|in_flight|global/i);
  });

  it('makes zero provider HTTP requests when server entitlement authorization is denied', async () => {
    const accountStore = new InMemoryAccountPersistenceStore();
    const user = await accountStore.upsertOAuthUser({ providerSubject: 'free-owner', email: null, displayName: 'Free Owner', avatarUrl: null });
    const token = `free-session-${'x'.repeat(36)}`;
    await accountStore.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      createdAt: now.toISOString(),
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    setAccountPersistenceStoreForTests(accountStore);
    setAiUsageStoreForTests(fakeStore({
      authorizeStage: vi.fn(async () => {
        throw new AiUsageDeniedError('upgrade_required', 403, false, 'Full Repository Futures is a paid AI feature.');
      }),
    }));
    vi.stubEnv('SHIPSEAL_DEEP_INTELLIGENCE_ENABLED', 'true');
    vi.stubEnv('SHIPSEAL_DEEP_INTELLIGENCE_MODEL', 'fixture-model');
    vi.stubEnv('SHIPSEAL_DEEP_INTELLIGENCE_API_KEY', 'fixture-key');
    const outbound = vi.fn();
    vi.stubGlobal('fetch', outbound);
    const evidenceResult = buildRepositoryIntelligenceEvidence(SAMPLE_PROJECT_REPO_INPUT);
    expect(evidenceResult.evidence.length).toBeGreaterThan(0);
    const contextBundle = prepareRepositoryProductStrategistContext({ scanInput: SAMPLE_PROJECT_REPO_INPUT, evidenceResult });
    const request = buildRepositoryProductStrategistRequest({ contextBundle, evidenceResult });
    const rootStage = {
      kind: 'roots' as const,
      fingerprint: stableContextFingerprint({ version: REPOSITORY_PRODUCT_PIPELINE_VERSION, report: request.fingerprint, stage: 'roots' }),
    };
    const res = response();
    await repositoryIntelligenceHandler({
      method: 'POST',
      body: { version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request, productStage: rootStage },
      headers: { cookie: `__Host-shipseal_session=${token}` },
      once: vi.fn(),
      removeListener: vi.fn(),
    } as never, res as never);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ state: 'fallback', category: 'upgrade_required', retryable: false });
    expect(outbound).not.toHaveBeenCalled();
  });

  it('scopes legacy single-flight suppression by authenticated owner', () => {
    const attemptKey = 'sharedattemptkey123';
    expect(buildAuthenticatedStageSingleFlightKey('owner-a', attemptKey))
      .not.toBe(buildAuthenticatedStageSingleFlightKey('owner-b', attemptKey));
    expect(buildAuthenticatedStageSingleFlightKey('owner-a', attemptKey))
      .toBe(buildAuthenticatedStageSingleFlightKey('owner-a', attemptKey));
  });

  it('preserves a machine-readable entitlement denial from a non-2xx API response', async () => {
    const denial: RepositoryIntelligenceProviderApiResponse = {
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback',
      category: 'upgrade_required',
      retryable: false,
      message: 'Full Repository Futures is a paid AI feature.',
      deepState: 'failed',
      diagnostics: { costEstimate: 'unavailable', failureBoundary: 'provider-http' },
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(denial), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }));
    const result = await requestRepositoryIntelligenceEnhancement(requestFixture(), { fetcher: fetcher as typeof fetch });
    expect(result).toMatchObject({ state: 'fallback', category: 'upgrade_required', retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('distinguishes account entitlement denials from temporary ShipSeal capacity', () => {
    expect(repositoryFutureFailureMessage('upgrade_required')).toMatch(/paid AI feature/i);
    expect(repositoryFutureFailureMessage('allowance_exhausted')).toMatch(/allowance has been used/i);
    const capacity = repositoryFutureFailureMessage('global_ai_capacity_reached');
    expect(capacity).toMatch(/temporarily unavailable/i);
    expect(capacity).toMatch(/not an account billing issue/i);
  });
});

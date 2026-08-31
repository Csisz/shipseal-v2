import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryDeepIntelligenceRequest } from '@/lib/repositoryIntelligence/deepIntelligenceRequest';
import type { RepositoryDeepIntelligenceValidatedResult } from '@/lib/repositoryIntelligence/deepIntelligenceSchema';
import {
  clearRepositoryIntelligenceEnhancementSessionCache,
  requestRepositoryProductIntelligenceStaged,
} from '@/lib/repositoryIntelligence/deepIntelligenceClient';
import {
  buildRepositoryProductExpansionStages,
  buildRepositoryProductExpansionStagesForFingerprint,
  buildRepositoryProductRootStage,
  mergeRepositoryProductExpansionResults,
} from '@/lib/repositoryIntelligence/stagedProductIntelligence';
import { validateRepositoryProductExpansionOwnership } from '../../api/_lib/aiUsage';
import { REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, REPOSITORY_PRODUCT_PIPELINE_VERSION } from '@/lib/repositoryIntelligence/productionProviderContract';
import {
  buildProductStrategistExpansionResponseFormat,
  normalizeProductStrategistExpansionResponse,
} from '../../api/_lib/repositoryProductStrategistResponse';

const request = {
  fingerprint: 'report-fingerprint-v115', locale: 'en',
  repository: { name: 'ShipSeal', fullName: 'Csisz/shipseal-v2', sourceType: 'github', ref: 'main' },
} as unknown as RepositoryDeepIntelligenceRequest;
const opportunities = Array.from({ length: 7 }, (_, index) => ({
  id: `product-opportunity:${index}`, sourceId: `op-${index}`, title: `Future ${index + 1}`,
  opportunityStatement: `Direction ${index + 1}`, userValue: 'Grounded user value', whyItFits: 'Grounded fit',
  evidenceIds: [`evidence-${index}`], futureEvolutions: [], fingerprint: `root-${index}`,
}));
const rootResult = {
  fingerprint: 'roots-result',
  productIntelligence: {
    sourceAnalysisFingerprint: request.fingerprint,
    fingerprint: 'product-roots',
    opportunities,
  },
} as unknown as RepositoryDeepIntelligenceValidatedResult;

function json(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }); }

function enhancedRoots() {
  return json({
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'enhanced', result: rootResult,
    providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable', publicOperationId: `op_${'f'.repeat(24)}` },
  });
}

function enhancedComplete() {
  const stages = buildRepositoryProductExpansionStages(request, rootResult.productIntelligence!);
  const batches = stages.map(stage => ({
    pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION,
    stage: 'expansion' as const,
    fingerprint: stage.fingerprint,
    batchIndex: stage.batchIndex,
    totalBatches: stage.totalBatches,
    expansions: stage.parents.map(parent => ({ parentId: parent.id, evolutions: [
      { sourceId: `${parent.id}-one`, generation: 2 as const, title: 'Adaptive experience', description: 'Grounded evolution.', userValue: 'Better outcomes.' },
      { sourceId: `${parent.id}-two`, generation: 2 as const, title: 'Guided experience', description: 'Grounded evolution.', userValue: 'Clearer decisions.' },
      { sourceId: `${parent.id}-three`, parentSourceId: `${parent.id}-one`, generation: 3 as const, title: 'Connected intelligence', description: 'Grounded later evolution.', userValue: 'Coordinated outcomes.' },
    ] })),
  }));
  return json({
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'enhanced', result: mergeRepositoryProductExpansionResults(rootResult, batches),
    providerId: 'fixture', deepState: 'completed', diagnostics: {
      costEstimate: 'unavailable', publicOperationId: `op_${'f'.repeat(24)}`,
      expansionBatchCount: stages.length, acceptedSecondGenerationCount: 14, acceptedThirdGenerationCount: 7,
      stageRetryCount: 1, rateLimitAttempt: 1, retryAfterMs: 20_000, backoffMs: 20_000,
      rateLimitRecoveryStatus: 'recovered', duplicateSuppressed: true,
    },
  });
}

function isFinalization(body: unknown) {
  return Boolean(body && typeof body === 'object' && 'productFinalization' in body);
}

function enhancedBatch(stage: { fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities }) {
  return json({
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'stage-enhanced', providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable' },
    stageResult: {
      pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION, stage: 'expansion', fingerprint: stage.fingerprint,
      batchIndex: stage.batchIndex, totalBatches: stage.totalBatches,
      expansions: stage.parents!.map(parent => ({ parentId: parent.id, evolutions: [
        { sourceId: `${parent.id}-one`, generation: 2, title: 'Adaptive experience', description: 'Grounded evolution.', userValue: 'Better outcomes.' },
        { sourceId: `${parent.id}-two`, generation: 2, title: 'Guided experience', description: 'Grounded evolution.', userValue: 'Clearer decisions.' },
      ] })),
    },
  });
}

function rateLimited(retryAfterMs = 20_000) {
  return json({
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'fallback', category: 'rate_limited', retryable: true,
    message: 'Future analysis is waiting for AI capacity.', deepState: 'failed', diagnostics: {
      costEstimate: 'unavailable', operationalFailureCategory: 'provider_rate_limited', failureBoundary: 'provider-http',
      rateLimitAttempt: 1, retryAfterMs, rateLimitRemainingRequests: 0, rateLimitRemainingTokens: 10, rateLimitType: 'requests',
    },
  });
}

describe('staged Product Intelligence', () => {
  afterEach(() => { vi.unstubAllGlobals(); clearRepositoryIntelligenceEnhancementSessionCache(); });

  it('creates stable roots and bounded expansion batches keyed by parent IDs', () => {
    const root = buildRepositoryProductRootStage(request);
    const batches = buildRepositoryProductExpansionStages(request, rootResult.productIntelligence!);
    expect(root.kind).toBe('roots');
    expect(batches).toHaveLength(3);
    expect(batches.map(batch => batch.parents.length)).toEqual([3, 3, 1]);
    expect(new Set(batches.flatMap(batch => batch.parents.map(parent => parent.id)))).toEqual(new Set(opportunities.map(item => item.id)));
    expect(buildRepositoryProductExpansionStages(request, rootResult.productIntelligence!)).toEqual(batches);
  });

  it('authorizes every canonical expansion batch against analysis identity despite a different provider transmission identity', () => {
    const analysisFingerprint = request.fingerprint;
    const providerTransmissionFingerprint = 'server-prepared-provider-fingerprint';
    expect(providerTransmissionFingerprint).not.toBe(analysisFingerprint);
    const stages = buildRepositoryProductExpansionStagesForFingerprint(
      analysisFingerprint,
      rootResult.productIntelligence!,
    );

    expect(stages).toHaveLength(3);
    expect(stages.map(stage => validateRepositoryProductExpansionOwnership(
      analysisFingerprint,
      rootResult.productIntelligence!,
      stage,
    ))).toEqual(stages.map(() => ({ valid: true })));
  });

  it('rejects tampered expansion parents, evidence, batches, and foreign analysis fingerprints', () => {
    const [canonical] = buildRepositoryProductExpansionStagesForFingerprint(
      request.fingerprint,
      rootResult.productIntelligence!,
    );
    const wrongParent = structuredClone(canonical);
    wrongParent.parents[0].id = 'product-opportunity:tampered';
    expect(validateRepositoryProductExpansionOwnership(request.fingerprint, rootResult.productIntelligence!, wrongParent))
      .toMatchObject({ valid: false, reason: 'parent-set-mismatch' });

    const wrongEvidence = structuredClone(canonical);
    wrongEvidence.parents[0].evidenceIds = ['evidence-not-owned-by-parent'];
    expect(validateRepositoryProductExpansionOwnership(request.fingerprint, rootResult.productIntelligence!, wrongEvidence))
      .toMatchObject({ valid: false, reason: 'parent-set-mismatch' });

    const wrongBatch = { ...canonical, batchIndex: 99 };
    expect(validateRepositoryProductExpansionOwnership(request.fingerprint, rootResult.productIntelligence!, wrongBatch))
      .toMatchObject({ valid: false, reason: 'batch-metadata-mismatch' });

    const foreignStage = buildRepositoryProductExpansionStagesForFingerprint(
      'another-analysis-fingerprint',
      rootResult.productIntelligence!,
    )[0];
    expect(validateRepositoryProductExpansionOwnership(request.fingerprint, rootResult.productIntelligence!, foreignStage))
      .toMatchObject({ valid: false, reason: 'stage-fingerprint-mismatch' });

    expect(validateRepositoryProductExpansionOwnership(
      'another-analysis-fingerprint',
      rootResult.productIntelligence!,
      foreignStage,
    )).toMatchObject({ valid: false, reason: 'analysis-fingerprint-mismatch' });
  });

  it('validates each expansion batch and keeps generated-language repair local', () => {
    const stage = buildRepositoryProductExpansionStages(request, rootResult.productIntelligence!)[0];
    const response = {
      x: stage.parents.map(parent => ({ p: parent.id, evo: [
        { id: 'adaptive', t: 'Adaptive planning', s: 'Plans adapt to real usage.', v: 'More relevant guidance.', next: [] },
        { id: 'coaching', t: 'Guided coaching', s: 'Insights guide the next decision.', v: 'Clearer progress.', next: [] },
      ] })),
    };
    expect(buildProductStrategistExpansionResponseFormat(stage).json_schema.schema.properties.x.minItems).toBe(3);
    expect(normalizeProductStrategistExpansionResponse(response, stage, 'en')).toMatchObject({
      fingerprint: stage.fingerprint,
      expansions: expect.arrayContaining([expect.objectContaining({ parentId: stage.parents[0].id })]),
    });
    expect(() => normalizeProductStrategistExpansionResponse({
      ...response,
      x: response.x.map((item, index) => index ? item : { ...item, evo: [{ ...item.evo[0], t: 'Adaptive自动 planning' }, item.evo[1]] }),
    }, stage, 'en')).toThrow(/generated-language contract/i);
    expect(() => normalizeProductStrategistExpansionResponse({
      ...response,
      x: response.x.map((item, index) => index ? item : { ...item, evo: [item.evo[0]] }),
    }, stage, 'en')).toThrow(/bounded schema/i);
    expect(() => normalizeProductStrategistExpansionResponse({
      ...response,
      x: response.x.map((item, index) => index ? item : { ...item, p: 'product-opportunity:unknown' }),
    }, stage, 'en')).toThrow(/stable parent identities|bounded schema/i);
    expect(() => normalizeProductStrategistExpansionResponse({
      ...response,
      x: response.x.map((item, index) => index ? item : { ...item, evo: [item.evo[0], { ...item.evo[1], id: item.evo[0].id }] }),
    }, stage, 'en')).toThrow(/duplicate stage-local identities/i);
  });

  it('retries a temporary root-stage failure once without rebuilding repository understanding', async () => {
    let rootCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { productFinalization?: unknown; productStage: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities } };
      if (isFinalization(body)) return enhancedComplete();
      const stage = body.productStage;
      if (stage.kind === 'roots') {
        rootCalls += 1;
        if (rootCalls === 1) return json({
          version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'fallback', category: 'provider_unavailable', retryable: true,
          message: 'Temporary provider failure', deepState: 'failed', diagnostics: { costEstimate: 'unavailable', operationalFailureCategory: 'provider_unavailable' },
        });
        return json({
          version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'enhanced', result: rootResult,
          providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable', publicOperationId: `op_${'f'.repeat(24)}` },
        });
      }
      return json({
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
        state: 'stage-enhanced', providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable' },
        stageResult: {
          pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION, stage: 'expansion', fingerprint: stage.fingerprint,
          batchIndex: stage.batchIndex, totalBatches: stage.totalBatches,
          expansions: stage.parents!.map(parent => ({ parentId: parent.id, evolutions: [
            { sourceId: `${parent.id}-one`, generation: 2, title: 'Adaptive experience', description: 'Grounded evolution.', userValue: 'Better outcomes.' },
            { sourceId: `${parent.id}-two`, generation: 2, title: 'Guided experience', description: 'Grounded evolution.', userValue: 'Clearer decisions.' },
          ] })),
        },
      });
    }));

    const result = await requestRepositoryProductIntelligenceStaged(request);
    expect(result.state).toBe('enhanced');
    expect(rootCalls).toBe(2);
    if (result.state === 'enhanced') expect(result.diagnostics.stageRetryCount).toBe(1);
  });

  it('returns a provider timeout for explicit resume instead of exhausting the second stage attempt immediately', async () => {
    const fetcher = vi.fn(async () => json({
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      state: 'fallback', category: 'request_timeout', retryable: true,
      message: 'Provider deadline reached.', deepState: 'timed-out',
      diagnostics: {
        costEstimate: 'unavailable', operationalFailureCategory: 'provider_timeout',
        failureBoundary: 'provider-generation', operationRecoveryAction: 'retry_stage',
      },
    }));

    const result = await requestRepositoryProductIntelligenceStaged(request, { fetcher: fetcher as typeof fetch });

    expect(result).toMatchObject({
      state: 'fallback', category: 'request_timeout', retryable: true,
      diagnostics: { operationRecoveryAction: 'retry_stage' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('resumes only a timed-out expansion while retaining successful roots and pathway groups', async () => {
    const calls = { roots: 0, batches: [0, 0, 0], finalization: 0 };
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        productFinalization?: unknown;
        productStage?: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities };
      };
      if (isFinalization(body)) {
        calls.finalization += 1;
        return enhancedComplete();
      }
      const stage = body.productStage!;
      if (stage.kind === 'roots') {
        calls.roots += 1;
        return enhancedRoots();
      }
      calls.batches[stage.batchIndex!] += 1;
      if (stage.batchIndex === 1 && calls.batches[1] === 1) {
        return json({
          version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
          state: 'fallback', category: 'request_timeout', retryable: true,
          message: 'Provider deadline reached.', deepState: 'timed-out',
          diagnostics: {
            costEstimate: 'unavailable', productStage: 'expansion',
            expansionBatchIndex: 1, expansionBatchCount: 3,
            operationalFailureCategory: 'provider_timeout', failureBoundary: 'provider-generation',
            operationRecoveryAction: 'retry_stage',
          },
        });
      }
      return enhancedBatch(stage);
    }));

    const first = await requestRepositoryProductIntelligenceStaged(request);
    expect(first).toMatchObject({ state: 'fallback', category: 'request_timeout' });
    expect(calls).toMatchObject({ roots: 1, batches: [1, 1, 1], finalization: 0 });

    const resumed = await requestRepositoryProductIntelligenceStaged(request);
    expect(resumed.state).toBe('enhanced');
    expect(calls).toEqual({ roots: 1, batches: [1, 2, 1], finalization: 1 });
  });

  it('waits for Retry-After and performs only one stage-owned 429 retry', async () => {
    const calls: string[] = [];
    const waits: number[] = [];
    const progress: Array<{ rateLimitRetryAt?: number }> = [];
    let rootCalls = 0;
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { productFinalization?: unknown; stageAttemptKey?: string; productStage: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities } };
      if (isFinalization(body)) return enhancedComplete();
      expect(body.stageAttemptKey).toMatch(/^[a-z0-9]{8,80}$/i);
      const stage = body.productStage;
      calls.push(stage.kind === 'roots' ? 'roots' : `batch-${stage.batchIndex}`);
      if (stage.kind === 'roots') return ++rootCalls === 1 ? rateLimited() : enhancedRoots();
      return enhancedBatch(stage);
    });

    const result = await requestRepositoryProductIntelligenceStaged(request, {
      fetcher: fetcher as typeof fetch,
      now: () => 1_000,
      random: () => 0,
      wait: async delayMs => { waits.push(delayMs); },
      onProgress: value => progress.push(value),
    });

    expect(result.state).toBe('enhanced');
    expect(calls.filter(call => call === 'roots')).toHaveLength(2);
    expect(waits).toEqual([20_000]);
    expect(progress).toContainEqual(expect.objectContaining({ rateLimitRetryAt: 21_000 }));
    if (result.state === 'enhanced') expect(result.diagnostics).toMatchObject({
      rateLimitAttempt: 1, retryAfterMs: 20_000, backoffMs: 20_000, rateLimitRecoveryStatus: 'recovered',
    });
  });

  it('shares concurrent report-and-stage requests through one active browser call', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { productFinalization?: unknown; productStage: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities } };
      if (isFinalization(body)) return enhancedComplete();
      const stage = body.productStage;
      calls.push(stage.kind === 'roots' ? 'roots' : `batch-${stage.batchIndex}`);
      await new Promise(resolve => setTimeout(resolve, 5));
      return stage.kind === 'roots' ? enhancedRoots() : enhancedBatch(stage);
    });

    const [first, duplicate] = await Promise.all([
      requestRepositoryProductIntelligenceStaged(request, { fetcher: fetcher as typeof fetch }),
      requestRepositoryProductIntelligenceStaged(request, { fetcher: fetcher as typeof fetch }),
    ]);

    expect(first.state).toBe('enhanced');
    expect(duplicate.state).toBe('enhanced');
    expect(calls).toHaveLength(4);
    expect(calls.filter(call => call === 'roots')).toHaveLength(1);
    expect(new Set(calls)).toEqual(new Set(['roots', 'batch-0', 'batch-1', 'batch-2']));
    if (duplicate.state === 'enhanced') expect(duplicate.diagnostics.duplicateSuppressed).toBe(true);
  });

  it('carries an owner-scoped recovery operation ID outside the immutable analysis fingerprint', async () => {
    const recoveryOperationId = `op_${'r'.repeat(24)}`;
    const bodies: Array<{ recoveryOperationId?: string; request: { fingerprint: string }; productStage: { kind: string } }> = [];
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as typeof bodies[number] & { productFinalization?: unknown; productStage: Parameters<typeof enhancedBatch>[0] };
      bodies.push(body);
      if (isFinalization(body)) return enhancedComplete();
      return body.productStage.kind === 'roots' ? enhancedRoots() : enhancedBatch(body.productStage);
    });
    const result = await requestRepositoryProductIntelligenceStaged(request, {
      fetcher: fetcher as typeof fetch,
      recoveryOperationId,
    });
    expect(result.state).toBe('enhanced');
    expect(bodies).toHaveLength(5);
    expect(bodies.filter(body => body.productStage).every(body => body.recoveryOperationId === recoveryOperationId)).toBe(true);
    expect(bodies.filter(body => body.productStage).every(body => body.request.fingerprint === request.fingerprint)).toBe(true);
  });

  it('reduces expansion recovery to one call, preserves completed work, and suppresses later bursts', async () => {
    let batchOneRateLimited = true;
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { productFinalization?: unknown; productStage: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities } };
      if (isFinalization(body)) return enhancedComplete();
      const stage = body.productStage;
      calls.push(stage.kind === 'roots' ? 'roots' : `batch-${stage.batchIndex}`);
      if (stage.kind === 'roots') return enhancedRoots();
      if (stage.batchIndex === 1 && batchOneRateLimited) return rateLimited(2_000);
      return enhancedBatch(stage);
    }));

    const first = await requestRepositoryProductIntelligenceStaged(request, {
      random: () => 0,
      wait: async () => undefined,
    });
    expect(first).toMatchObject({
      state: 'fallback', category: 'rate_limited',
      diagnostics: {
        productStage: 'expansion', expansionBatchIndex: 1,
        expansionConcurrencyAtRetry: 1, rateLimitRecoveryStatus: 'exhausted',
      },
    });
    expect(calls).toEqual(['roots', 'batch-0', 'batch-1', 'batch-1']);

    batchOneRateLimited = false;
    const second = await requestRepositoryProductIntelligenceStaged(request, {
      random: () => 0,
      wait: async () => undefined,
    });
    expect(second.state).toBe('enhanced');
    expect(calls).toEqual(['roots', 'batch-0', 'batch-1', 'batch-1', 'batch-1', 'batch-2']);
  });

  it('preserves completed batches and retries only the failed batch', async () => {
    let failBatchOne = true;
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { productFinalization?: unknown; productStage: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities } };
      if (isFinalization(body)) return enhancedComplete();
      const stage = body.productStage;
      calls.push(stage.kind === 'roots' ? 'roots' : `batch-${stage.batchIndex}`);
      if (stage.kind === 'roots') return json({
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'enhanced', result: rootResult,
        providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable', publicOperationId: `op_${'f'.repeat(24)}` },
      });
      if (stage.batchIndex === 1 && failBatchOne) return json({
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'fallback', category: 'schema_validation_failed', retryable: true,
        message: 'Expansion language repair failed', deepState: 'failed', diagnostics: {
          costEstimate: 'unavailable', operationalFailureCategory: 'expansion_language_failed', failureBoundary: 'language-validation',
        },
      });
      return json({
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
        state: 'stage-enhanced', providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable' },
        stageResult: {
          pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION, stage: 'expansion', fingerprint: stage.fingerprint,
          batchIndex: stage.batchIndex, totalBatches: stage.totalBatches,
          expansions: stage.parents!.map(parent => ({ parentId: parent.id, evolutions: [
            { sourceId: `${parent.id}-adaptive`, generation: 2, title: 'Adaptive experience', description: 'A grounded next product step.', userValue: 'More relevant outcomes.' },
            { sourceId: `${parent.id}-guided`, generation: 2, title: 'Guided experience', description: 'A grounded guided product step.', userValue: 'Clearer decisions.' },
            { sourceId: `${parent.id}-network`, parentSourceId: `${parent.id}-adaptive`, generation: 3, title: 'Connected intelligence', description: 'A later grounded possibility.', userValue: 'Coordinated value.' },
          ] })),
        },
      });
    }));

    const first = await requestRepositoryProductIntelligenceStaged(request);
    expect(first).toMatchObject({
      state: 'fallback', category: 'schema_validation_failed',
      diagnostics: { operationalFailureCategory: 'expansion_language_failed', expansionBatchIndex: 1 },
    });
    expect(calls).toEqual(['roots', 'batch-0', 'batch-1', 'batch-1', 'batch-2']);

    failBatchOne = false;
    const second = await requestRepositoryProductIntelligenceStaged(request);
    expect(second.state).toBe('enhanced');
    expect(calls).toEqual(['roots', 'batch-0', 'batch-1', 'batch-1', 'batch-2', 'batch-1']);
    if (second.state === 'enhanced') {
      expect(second.result.productIntelligence?.opportunities.every(item => item.futureEvolutions.length === 3)).toBe(true);
      expect(second.result.productIntelligence?.opportunities.map(item => item.sourceId).sort())
        .toEqual(opportunities.map(item => item.sourceId).sort());
      expect(new Set(second.result.productIntelligence?.opportunities.map(item => item.sourceId)).size).toBe(7);
      expect(second.diagnostics).toMatchObject({ expansionBatchCount: 3, acceptedSecondGenerationCount: 14, acceptedThirdGenerationCount: 7 });
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryDeepIntelligenceRequest } from '@/lib/repositoryIntelligence/deepIntelligenceRequest';
import type { RepositoryDeepIntelligenceValidatedResult } from '@/lib/repositoryIntelligence/deepIntelligenceSchema';
import {
  clearRepositoryIntelligenceEnhancementSessionCache,
  requestRepositoryProductIntelligenceStaged,
} from '@/lib/repositoryIntelligence/deepIntelligenceClient';
import {
  buildRepositoryProductExpansionStages,
  buildRepositoryProductRootStage,
} from '@/lib/repositoryIntelligence/stagedProductIntelligence';
import { REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, REPOSITORY_PRODUCT_PIPELINE_VERSION } from '@/lib/repositoryIntelligence/productionProviderContract';
import {
  buildProductStrategistExpansionResponseFormat,
  normalizeProductStrategistExpansionResponse,
} from '../../api/_lib/repositoryProductStrategistResponse';

const request = { fingerprint: 'report-fingerprint-v115', locale: 'en' } as RepositoryDeepIntelligenceRequest;
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
  });

  it('preserves completed batches and retries only the failed batch', async () => {
    let failBatchOne = true;
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { productStage: { kind: 'roots' | 'expansion'; fingerprint: string; batchIndex?: number; totalBatches?: number; parents?: typeof opportunities } };
      const stage = body.productStage;
      calls.push(stage.kind === 'roots' ? 'roots' : `batch-${stage.batchIndex}`);
      if (stage.kind === 'roots') return json({
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'enhanced', result: rootResult,
        providerId: 'fixture', deepState: 'completed', diagnostics: { costEstimate: 'unavailable' },
      });
      if (stage.batchIndex === 1 && failBatchOne) return json({
        version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, state: 'fallback', category: 'request_timeout', retryable: true,
        message: 'Timed out', deepState: 'timed-out', diagnostics: { costEstimate: 'unavailable', providerTimedOut: true },
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
    expect(first).toMatchObject({ state: 'fallback', category: 'request_timeout' });
    expect(calls).toEqual(['roots', 'batch-0', 'batch-1', 'batch-2']);

    failBatchOne = false;
    const second = await requestRepositoryProductIntelligenceStaged(request);
    expect(second.state).toBe('enhanced');
    expect(calls).toEqual(['roots', 'batch-0', 'batch-1', 'batch-2', 'batch-1']);
    if (second.state === 'enhanced') {
      expect(second.result.productIntelligence?.opportunities.every(item => item.futureEvolutions.length === 3)).toBe(true);
      expect(second.diagnostics).toMatchObject({ expansionBatchCount: 3, acceptedSecondGenerationCount: 14, acceptedThirdGenerationCount: 7 });
    }
  });
});

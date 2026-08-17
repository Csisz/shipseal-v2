import { stableContextFingerprint } from './contextSelection';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';
import {
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  type RepositoryProductExpansionStageResult,
  type RepositoryProductProviderStage,
} from './productionProviderContract';
import type { RepositoryProductFutureEvolution, RepositoryProductIntelligenceResult } from './productIntelligenceSchema';

export const REPOSITORY_PRODUCT_EXPANSION_BATCH_SIZE = 3;
export const REPOSITORY_PRODUCT_EXPANSION_CONCURRENCY = 2;
export const REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS = 42_000;
export const REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS = 2;

export interface RepositoryProductPipelineProgress {
  stage: 'roots' | 'expansion' | 'merging';
  completedBatches: number;
  totalBatches: number;
  activeBatchIndexes: number[];
  stageAttempt?: number;
  rateLimitRetryAt?: number;
  rateLimitAttempt?: number;
}

export function buildRepositoryProductRootStage(request: RepositoryDeepIntelligenceRequest): RepositoryProductProviderStage {
  return {
    kind: 'roots',
    fingerprint: stableContextFingerprint({
      version: REPOSITORY_PRODUCT_PIPELINE_VERSION,
      report: request.fingerprint,
      stage: 'roots',
    }),
  };
}

export function buildRepositoryProductExpansionStages(
  request: RepositoryDeepIntelligenceRequest,
  product: RepositoryProductIntelligenceResult,
): Extract<RepositoryProductProviderStage, { kind: 'expansion' }>[] {
  const parents = product.opportunities.map(opportunity => ({
    id: opportunity.id,
    title: opportunity.title,
    opportunityStatement: opportunity.opportunityStatement,
    userValue: opportunity.userValue,
    whyItFits: opportunity.whyItFits,
    evidenceIds: [...opportunity.evidenceIds].sort(),
  }));
  const totalBatches = Math.ceil(parents.length / REPOSITORY_PRODUCT_EXPANSION_BATCH_SIZE);
  return Array.from({ length: totalBatches }, (_, batchIndex) => {
    const batchParents = parents.slice(
      batchIndex * REPOSITORY_PRODUCT_EXPANSION_BATCH_SIZE,
      (batchIndex + 1) * REPOSITORY_PRODUCT_EXPANSION_BATCH_SIZE,
    );
    return {
      kind: 'expansion' as const,
      batchIndex,
      totalBatches,
      parents: batchParents,
      fingerprint: stableContextFingerprint({
        version: REPOSITORY_PRODUCT_PIPELINE_VERSION,
        report: request.fingerprint,
        stage: 'expansion',
        parents: batchParents.map(parent => ({ id: parent.id, evidenceIds: parent.evidenceIds })),
      }),
    };
  });
}

export function mergeRepositoryProductExpansionResults(
  rootResult: RepositoryDeepIntelligenceValidatedResult,
  batches: readonly RepositoryProductExpansionStageResult[],
): RepositoryDeepIntelligenceValidatedResult {
  const product = rootResult.productIntelligence;
  if (!product) throw new Error('Validated Product Understanding and Future roots are required before expansion.');
  const evolutionsByParent = new Map(batches.flatMap(batch => batch.expansions.map(item => [item.parentId, item.evolutions] as const)));
  const opportunities = product.opportunities.map(opportunity => {
    const expanded = evolutionsByParent.get(opportunity.id);
    if (!expanded || expanded.filter(item => item.generation === 2).length < 2) {
      throw new Error(`Expansion is incomplete for ${opportunity.id}.`);
    }
    const futureEvolutions: RepositoryProductFutureEvolution[] = expanded.map(evolution => {
      const id = stableContextFingerprint({
        report: product.sourceAnalysisFingerprint,
        parent: opportunity.id,
        source: evolution.sourceId,
        generation: evolution.generation,
      });
      return {
        id: `product-future-evolution:${id}`,
        sourceId: evolution.sourceId,
        parentSourceId: evolution.parentSourceId,
        generation: evolution.generation,
        title: evolution.title,
        description: evolution.description,
        userValue: evolution.userValue,
      };
    }).map(evolution => ({
      ...evolution,
      parentSourceId: evolution.parentSourceId,
    }));
    const core = { ...opportunity, futureEvolutions };
    return { ...core, fingerprint: stableContextFingerprint(core) };
  });
  const productCore = { ...product, opportunities };
  const mergedProduct = { ...productCore, fingerprint: stableContextFingerprint(productCore) };
  const resultCore = { ...rootResult, productIntelligence: mergedProduct };
  return { ...resultCore, fingerprint: stableContextFingerprint(resultCore) };
}

export async function mapWithBoundedConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}

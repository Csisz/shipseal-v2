import { stableContextFingerprint } from './contextSelection.js';
import type { RepositoryDeepIntelligenceValidatedResult } from './deepIntelligenceSchema.js';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest.js';
import {
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  type RepositoryProductExpansionStageResult,
  type RepositoryProductProviderStage,
} from './productionProviderContract.js';
import type { RepositoryProductFutureEvolution, RepositoryProductIntelligenceResult } from './productIntelligenceSchema.js';
import { REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION } from './productIntelligenceSchema.js';

export const REPOSITORY_PRODUCT_EXPANSION_BATCH_SIZE = 3;
export const REPOSITORY_PRODUCT_EXPANSION_CONCURRENCY = 2;
export const REPOSITORY_PRODUCT_STAGE_CLIENT_TIMEOUT_MS = 42_000;
export const REPOSITORY_PRODUCT_STAGE_MAX_ATTEMPTS = 2;

export interface RepositoryProductPipelineProgress {
  stage: 'roots' | 'expansion' | 'merging' | 'finalizing';
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
  return buildRepositoryProductExpansionStagesForFingerprint(request.fingerprint, product);
}

export function buildRepositoryProductExpansionStagesForFingerprint(
  requestFingerprint: string,
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
        report: requestFingerprint,
        stage: 'expansion',
        parents: batchParents.map(parent => ({ id: parent.id, evidenceIds: parent.evidenceIds })),
      }),
    };
  });
}

export function isCompleteRepositoryProductIntelligenceResult(
  result: unknown,
  expectedSourceAnalysisFingerprint?: string,
): result is RepositoryProductIntelligenceResult {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const product = result as Partial<RepositoryProductIntelligenceResult>;
  if (product.version !== REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION
    || typeof product.sourceAnalysisFingerprint !== 'string'
    || expectedSourceAnalysisFingerprint !== undefined && product.sourceAnalysisFingerprint !== expectedSourceAnalysisFingerprint
    || typeof product.fingerprint !== 'string'
    || !product.understanding
    || !Array.isArray(product.opportunities)
    || product.opportunities.length < 6
    || product.opportunities.length > 8) return false;
  const opportunityIds = new Set<string>();
  const evolutionIds = new Set<string>();
  for (const opportunity of product.opportunities) {
    if (!opportunity || typeof opportunity !== 'object' || typeof opportunity.id !== 'string'
      || opportunityIds.has(opportunity.id) || !Array.isArray(opportunity.futureEvolutions)) return false;
    opportunityIds.add(opportunity.id);
    if (opportunity.futureEvolutions.filter(item => item?.generation === 2).length < 2) return false;
    for (const evolution of opportunity.futureEvolutions) {
      if (!evolution || ![2, 3].includes(evolution.generation)
        || typeof evolution.id !== 'string' || typeof evolution.sourceId !== 'string'
        || typeof evolution.title !== 'string' || typeof evolution.description !== 'string'
        || typeof evolution.userValue !== 'string' || evolutionIds.has(evolution.id)) return false;
      evolutionIds.add(evolution.id);
    }
  }
  return true;
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

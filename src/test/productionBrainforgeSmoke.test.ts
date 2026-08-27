import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  buildRepositoryIntelligenceEvidence,
  buildRepositoryProductStrategistRequest,
  prepareRepositoryProductStrategistContext,
  type RepositoryIntelligenceProviderApiResponse,
} from '../lib/repositoryIntelligence';
import {
  buildRepositoryProductExpansionStages,
  buildRepositoryProductRootStage,
  mergeRepositoryProductExpansionResults,
} from '../lib/repositoryIntelligence/stagedProductIntelligence';
import type { RepositoryProductProviderStage } from '../lib/repositoryIntelligence/productionProviderContract';
import { stableContextFingerprint } from '../lib/repositoryIntelligence/contextSelection';

const smokeEnabled = process.env.SHIPSEAL_PRODUCTION_SMOKE === 'true';
const productionOrigin = process.env.SHIPSEAL_PRODUCTION_ORIGIN || 'https://www.getshipseal.com';

describe.runIf(smokeEnabled)('production brainforge smoke', () => {
  it('accepts real roots and starts a real expansion batch', async () => {
    const evidenceResponse = await fetch(`${productionOrigin}/api/repository-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'public-github', owner: 'Csisz', repo: 'brainforge', ref: 'main' }),
    });
    expect(evidenceResponse.ok).toBe(true);
    const evidencePayload = await evidenceResponse.json() as { scanInput: import('../lib/types').RepoScanInput };
    const scanInput = evidencePayload.scanInput;
    const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
    const contextBundle = prepareRepositoryProductStrategistContext({ scanInput, evidenceResult });
    const request = buildRepositoryProductStrategistRequest({ contextBundle, evidenceResult });

    const rootsStage = buildRepositoryProductRootStage(request);
    const roots = await postProductStage(request, rootsStage);
    if (roots.body.state !== 'enhanced') {
      console.info(JSON.stringify({ phase: 'roots', state: roots.body.state, diagnostics: safeDiagnostics(roots.body) }));
      expect(roots.body.state).toBe('enhanced');
      return;
    }

    const opportunities = roots.body.result.productIntelligence?.opportunities || [];
    expect(opportunities.length).toBeGreaterThanOrEqual(6);
    expect(opportunities.length).toBeLessThanOrEqual(8);
    expect(roots.body.diagnostics).toMatchObject({
      productStage: 'roots',
      acceptedRootCount: opportunities.length,
      rejectedRootCount: expect.any(Number),
      compactOpportunityContract: 'roots',
      compactOpportunityShapeRejectedCount: 0,
    });

    const expansionStages = buildRepositoryProductExpansionStages(request, roots.body.result.productIntelligence!);
    expect(expansionStages.length).toBeGreaterThan(0);
    const expansions = [];
    for (const stage of expansionStages) {
      const expansion = await postProductStage(request, stage);
      expansions.push({ stage, ...expansion });
      console.info(JSON.stringify({
        phase: 'expansion',
        batchIndex: stage.batchIndex,
        requestId: expansion.body.diagnostics?.requestId,
        vercelRequestId: expansion.vercelRequestId,
        stageFingerprint: stage.fingerprint,
        state: expansion.body.state,
        languageRepairCount: expansion.body.diagnostics?.languageRepairCount || 0,
        retryCount: expansion.body.diagnostics?.retryCount || 0,
        providerFinishReason: expansion.body.diagnostics?.providerFinishReason,
        operationalFailureCategory: expansion.body.diagnostics?.operationalFailureCategory,
        failureBoundary: expansion.body.diagnostics?.failureBoundary,
        languageValidation: expansion.body.diagnostics?.languageValidation,
        expansionSchemaValidation: expansion.body.diagnostics?.expansionSchemaValidation,
        expansionResponseShape: expansion.body.diagnostics?.expansionResponseShape,
        rateLimitAttempt: expansion.body.diagnostics?.rateLimitAttempt,
        retryAfterMs: expansion.body.diagnostics?.retryAfterMs,
        rateLimitType: expansion.body.diagnostics?.rateLimitType,
      }));
      expect(expansion.body.state).toBe('stage-enhanced');
      expect(expansion.body.diagnostics).toMatchObject({ productStage: 'expansion', requestId: expect.any(String) });
    }
    const stageResults = expansions.map(expansion => {
      if (expansion.body.state !== 'stage-enhanced') throw new Error('Expansion stage was not accepted.');
      return expansion.body.stageResult;
    });
    const merged = mergeRepositoryProductExpansionResults(roots.body.result, stageResults);
    const futureReady = merged.productIntelligence?.opportunities.every(opportunity => opportunity.futureEvolutions.length >= 2) || false;
    expect(futureReady).toBe(true);

    console.info(JSON.stringify({
      buildExpected: process.env.SHIPSEAL_EXPECTED_BUILD_COMMIT || '00785e3ff45794b427d2bbdf9affee275d712c92',
      productionOrigin,
      buildHeader: roots.buildHeader,
      buildCommit: roots.body.diagnostics?.buildCommit,
      buildDeployment: roots.body.diagnostics?.buildDeployment,
      productPipelineVersion: roots.body.diagnostics?.productPipelineVersion,
      rootContractVersion: roots.body.diagnostics?.rootContractVersion,
      rootRequestId: roots.body.diagnostics?.requestId,
      rootVercelRequestId: roots.vercelRequestId,
      providerModel: roots.body.diagnostics?.providerModelId || (roots.body.state === 'enhanced' ? roots.body.modelId : undefined),
      finishReason: roots.body.diagnostics?.providerFinishReason,
      rootCountReturned: roots.body.diagnostics?.parsedProductOpportunityCount,
      rootCountParsed: roots.body.diagnostics?.parsedProductOpportunityCount,
      rootCountAccepted: roots.body.diagnostics?.acceptedRootCount,
      rootCountRejected: roots.body.diagnostics?.rejectedRootCount,
      expansionBatchCount: expansionStages.length,
      expansionRequests: expansions.map(expansion => ({
        batchIndex: expansion.stage.batchIndex,
        stageFingerprint: expansion.stage.fingerprint,
        requestId: expansion.body.diagnostics?.requestId,
        vercelRequestId: expansion.vercelRequestId,
        state: expansion.body.state,
        languageRepairCount: expansion.body.diagnostics?.languageRepairCount || 0,
        retryCount: expansion.body.diagnostics?.retryCount || 0,
        providerFinishReason: expansion.body.diagnostics?.providerFinishReason,
      })),
      finalState: futureReady ? 'future-ready' : 'fallback',
    }));
  }, 300_000);
});

async function postProductStage(
  request: ReturnType<typeof buildRepositoryProductStrategistRequest>,
  productStage: RepositoryProductProviderStage,
) {
  const response = await fetch(`${productionOrigin}/api/repository-intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
      request,
      productStage,
      stageAttemptKey: stableContextFingerprint({
        reportFingerprint: request.fingerprint,
        stageFingerprint: productStage.fingerprint,
        stageAttempt: 1,
      }),
    }),
  });
  const body = await response.json() as RepositoryIntelligenceProviderApiResponse;
  expect(response.ok).toBe(true);
  return {
    body,
    vercelRequestId: response.headers.get('x-vercel-id') || undefined,
    buildHeader: response.headers.get('x-shipseal-build') || undefined,
  };
}

function safeDiagnostics(response: RepositoryIntelligenceProviderApiResponse) {
  const diagnostics = response.diagnostics;
  return diagnostics && {
    requestId: diagnostics.requestId,
    productStage: diagnostics.productStage,
    validationCategory: diagnostics.validationCategory,
    validationReason: diagnostics.validationReason,
    failureBoundary: diagnostics.failureBoundary,
    parsedProductOpportunityCount: diagnostics.parsedProductOpportunityCount,
    acceptedRootCount: diagnostics.acceptedRootCount,
    rejectedRootCount: diagnostics.rejectedRootCount,
    compactOpportunityShapeRejectedCount: diagnostics.compactOpportunityShapeRejectedCount,
    compactOpportunityShapeIssueFields: diagnostics.compactOpportunityShapeIssueFields,
    providerModelId: diagnostics.providerModelId,
    providerFinishReason: diagnostics.providerFinishReason,
    operationalFailureCategory: diagnostics.operationalFailureCategory,
    providerHttpStatusCategory: diagnostics.providerHttpStatusCategory,
    rateLimitAttempt: diagnostics.rateLimitAttempt,
    retryAfterMs: diagnostics.retryAfterMs,
    rateLimitResetRequestsMs: diagnostics.rateLimitResetRequestsMs,
    rateLimitResetTokensMs: diagnostics.rateLimitResetTokensMs,
    rateLimitRemainingRequests: diagnostics.rateLimitRemainingRequests,
    rateLimitRemainingTokens: diagnostics.rateLimitRemainingTokens,
    rateLimitLimitRequests: diagnostics.rateLimitLimitRequests,
    rateLimitLimitTokens: diagnostics.rateLimitLimitTokens,
    rateLimitType: diagnostics.rateLimitType,
  };
}

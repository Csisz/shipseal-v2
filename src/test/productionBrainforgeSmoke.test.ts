import { describe, expect, it } from 'vitest';
import { scanZipFile } from '../lib/scanner';
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
} from '../lib/repositoryIntelligence/stagedProductIntelligence';
import type { RepositoryProductProviderStage } from '../lib/repositoryIntelligence/productionProviderContract';

const smokeEnabled = process.env.SHIPSEAL_PRODUCTION_SMOKE === 'true';
const productionOrigin = process.env.SHIPSEAL_PRODUCTION_ORIGIN || 'https://www.getshipseal.com';

describe.runIf(smokeEnabled)('production brainforge smoke', () => {
  it('accepts real roots and starts a real expansion batch', async () => {
    const archiveResponse = await fetch(`${productionOrigin}/api/github-archive?owner=Csisz&repo=brainforge&ref=main`);
    expect(archiveResponse.ok).toBe(true);
    const archiveBytes = await archiveResponse.arrayBuffer();
    const archiveFile = new File([archiveBytes], 'Csisz-brainforge-main.zip', { type: 'application/zip' });
    Object.defineProperty(archiveFile, 'arrayBuffer', {
      value: () => Promise.resolve(archiveBytes.slice(0)),
    });
    const source = {
      sourceType: 'github-url' as const,
      githubOwner: 'Csisz',
      githubRepo: 'brainforge',
      githubBranch: 'main',
      sourceUrl: 'https://github.com/Csisz/brainforge/tree/main',
    };
    const scanned = await scanZipFile(archiveFile, source);
    const scanInput = { ...scanned, repoName: 'Csisz/brainforge', source };
    const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
    const contextBundle = prepareRepositoryProductStrategistContext({ scanInput, evidenceResult });
    const request = buildRepositoryProductStrategistRequest({ contextBundle, evidenceResult });

    const rootsStage = buildRepositoryProductRootStage(request);
    const roots = await postProductStage(request, rootsStage);
    expect(roots.body.state).toBe('enhanced');
    if (roots.body.state !== 'enhanced') {
      console.info(JSON.stringify({ phase: 'roots', state: roots.body.state, diagnostics: safeDiagnostics(roots.body) }));
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
    const expansion = await postProductStage(request, expansionStages[0]);
    expect(['stage-enhanced', 'fallback']).toContain(expansion.body.state);
    expect(expansion.body.diagnostics).toMatchObject({ productStage: 'expansion', requestId: expect.any(String) });

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
      expansionRequestId: expansion.body.diagnostics?.requestId,
      expansionVercelRequestId: expansion.vercelRequestId,
      expansionFailureCategory: expansion.body.state === 'fallback' ? expansion.body.category : undefined,
      expansionFailureBoundary: expansion.body.diagnostics?.failureBoundary,
      finalState: expansion.body.state,
    }));
  }, 120_000);
});

async function postProductStage(
  request: ReturnType<typeof buildRepositoryProductStrategistRequest>,
  productStage: RepositoryProductProviderStage,
) {
  const response = await fetch(`${productionOrigin}/api/repository-intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION, request, productStage }),
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
  };
}

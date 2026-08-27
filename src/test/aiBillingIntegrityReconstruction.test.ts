import { describe, expect, it } from 'vitest';
import { reconstructCompleteFutureFromRecords } from '../../api/_lib/aiUsage';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';
import {
  REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
  REPOSITORY_PRODUCT_PIPELINE_VERSION,
  type RepositoryIntelligenceProviderApiResponse,
} from '@/lib/repositoryIntelligence/productionProviderContract';
import { buildRepositoryProductExpansionStagesForFingerprint } from '@/lib/repositoryIntelligence/stagedProductIntelligence';
import { REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION } from '@/lib/repositoryIntelligence/productIntelligenceSchema';

const requestFingerprint = 'historical-analysis-fingerprint';

function rootResponse(): Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }> {
  const opportunities = Array.from({ length: 6 }, (_, index) => ({
    id: `future-${index}`, sourceId: `source-${index}`, title: `Future ${index}`,
    opportunityStatement: 'A grounded direction.', userValue: 'Useful value.', whyItFits: 'Repository evidence supports it.',
    evidenceIds: [`evidence-${index}`], targetUsers: ['Maintainers'], origin: 'evidence-backed' as const,
    inferenceLevel: 'evidence-linked' as const, strategicRationale: 'Grounded rationale.', existingCapabilityIds: [],
    requiredNewCapabilities: [], futureEvolutions: [], optionalSupportingOpportunityIds: [], knownConflicts: [],
    expectedImplementationAreas: [], changeWeight: 'moderate' as const, impactBreadth: 'workflow' as const,
    verificationConcept: 'Verify the workflow.', humanReviewRequirements: [], limitations: [],
    confidence: 'high' as const, fingerprint: `root-${index}`,
  }));
  return {
    version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
    state: 'enhanced', providerId: 'historical-provider', deepState: 'completed',
    diagnostics: { costEstimate: 'unavailable' },
    result: {
      version: 'shipseal.repository-deep-intelligence-result.v1', fingerprint: 'root-result',
      productIntelligence: {
        version: REPOSITORY_PRODUCT_INTELLIGENCE_RESULT_VERSION,
        sourceAnalysisFingerprint: requestFingerprint,
        fingerprint: 'root-product', understanding: {} as never, opportunities,
      },
    } as never,
  };
}

function records() {
  const root = rootResponse();
  const stages = buildRepositoryProductExpansionStagesForFingerprint(requestFingerprint, root.result.productIntelligence!);
  return {
    operation: { id: 'aop_historical', request_fingerprint: requestFingerprint, canonical_root_response: root },
    stages: [
      { stage_kind: 'roots', state: 'succeeded', cached_response: root },
      ...stages.map(stage => ({
        stage_kind: 'expansion', state: 'succeeded', stage_fingerprint: stage.fingerprint,
        cached_response: {
          version: REPOSITORY_INTELLIGENCE_PROVIDER_API_VERSION,
          state: 'stage-enhanced', providerId: 'historical-provider', deepState: 'completed',
          diagnostics: { costEstimate: 'unavailable' },
          stageResult: {
            pipelineVersion: REPOSITORY_PRODUCT_PIPELINE_VERSION, stage: 'expansion', fingerprint: stage.fingerprint,
            batchIndex: stage.batchIndex, totalBatches: stage.totalBatches,
            expansions: stage.parents.map(parent => ({ parentId: parent.id, evolutions: [
              { sourceId: `${parent.id}-a`, generation: 2, title: 'First evolution', description: 'Grounded detail.', userValue: 'Useful.' },
              { sourceId: `${parent.id}-b`, generation: 2, title: 'Second evolution', description: 'Grounded detail.', userValue: 'Useful.' },
            ] })),
          },
        },
      })),
    ] as Record<string, unknown>[],
  };
}

describe('Deep Analysis complete-result reconstruction', () => {
  it('reconstructs a canonical complete Future only from the exact successful expansion set', () => {
    const fixture = records();
    const result = reconstructCompleteFutureFromRecords(fixture.operation, fixture.stages);
    expect(result.state).toBe('complete');
    if (result.state === 'complete') {
      expect(result.response.result.productIntelligence?.opportunities.every(item => item.futureEvolutions.length === 2)).toBe(true);
      expect(result.response.result.productIntelligence?.sourceAnalysisFingerprint).toBe(requestFingerprint);
    }
  });

  it('classifies root-only and partial historical operations as incomplete for audited refund', () => {
    const fixture = records();
    expect(reconstructCompleteFutureFromRecords(fixture.operation, fixture.stages.slice(0, 1))).toEqual({ state: 'incomplete' });
    expect(reconstructCompleteFutureFromRecords(fixture.operation, fixture.stages.slice(0, -1))).toEqual({ state: 'incomplete' });
  });

  it('refuses an expansion whose canonical fingerprint does not match the immutable analysis', () => {
    const fixture = records();
    const corrupted = fixture.stages.map((stage, index) => index === 1
      ? { ...stage, stage_fingerprint: stableContextFingerprint({ wrong: true }) }
      : stage);
    expect(reconstructCompleteFutureFromRecords(fixture.operation, corrupted)).toEqual({ state: 'incomplete' });
  });
});

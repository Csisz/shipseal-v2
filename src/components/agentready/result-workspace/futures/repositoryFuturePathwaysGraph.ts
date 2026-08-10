import type { ReadinessReport } from '@/lib/types';
import type { RepositoryProductIntelligenceResult } from '@/lib/repositoryIntelligence';
import {
  buildRepositoryActionableImprovements,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildWorkspaceStory,
  type RepositoryUniverseModel,
} from '@/lib/workspace';
import {
  DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
  REPOSITORY_FUTURE_CAPABILITIES,
  adaptActionableImprovementCandidates,
  adaptProductOpportunityCandidates,
  adaptRepositoryHealthCandidates,
  adaptWorkspaceStoryCandidates,
  buildProductOpportunityCapabilityDefinitions,
  buildRepositoryFutureGraph,
  productOpportunitySatisfiedCapabilityIds,
} from '@/lib/workspace/repositoryFutures';

export function buildRepositoryFuturePathwaysGraph(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  productIntelligence?: RepositoryProductIntelligenceResult | null,
) {
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  const plan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation });
  const improvements = buildRepositoryActionableImprovements({ transformation, plan });
  const sourceScanId = `scan:${report.repoName}:${report.scannedAt}`;
  const sourceScanFingerprint = sourceScanId;
  const repository = {
    repositoryId: report.source.sourceType === 'github-app'
      ? `github:${report.source.githubOwner}/${report.source.githubRepo}`
      : `upload:${report.repoName}`,
    sourceScanId,
    sourceScanFingerprint,
    limited: Boolean(report.scanEvidence.limitedScan || report.scanSummary.limited),
  };
  const context = { repository, universe };
  return buildRepositoryFutureGraph({
    repository,
    universe,
    candidateResults: [
      ...(productIntelligence?.opportunities.length ? [adaptProductOpportunityCandidates({ productIntelligence, context })] : []),
      adaptActionableImprovementCandidates(improvements, context),
      adaptRepositoryHealthCandidates(report.repositoryHealth, context),
      adaptWorkspaceStoryCandidates(buildWorkspaceStory(report), context),
    ],
    capabilityDefinitions: [
      ...DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
      ...(productIntelligence ? buildProductOpportunityCapabilityDefinitions(productIntelligence) : []),
    ],
    satisfiedCapabilityIds: [
      REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence,
      ...(productIntelligence ? productOpportunitySatisfiedCapabilityIds(productIntelligence) : []),
    ],
  });
}

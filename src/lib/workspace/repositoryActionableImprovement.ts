import type {
  RepositoryOptimizationPlan,
  RepositoryOptimizationPlanItem,
} from './repositoryOptimizationPlan';
import type {
  RepositoryTransformationConfidence,
  RepositoryTransformationDomain,
  RepositoryTransformationProposal,
  RepositoryTransformationProposalModel,
} from './repositoryTransformation';

export type ActionableImprovementLifecycle = 'proposed' | 'prepared' | 'applied' | 'verified' | 'unresolved';
export type ActionableImprovementSupport = 'actionable' | 'unsupported';

export interface ActionableImprovementEvidence {
  summary: string;
  detail?: string;
  entityId?: string;
  relationshipId?: string;
  confidence: number;
  kind: 'evidence-backed' | 'heuristic';
}

export interface RepositoryActionableImprovement {
  id: string;
  title: string;
  domain: RepositoryTransformationDomain;
  lifecycle: ActionableImprovementLifecycle;
  support: ActionableImprovementSupport;
  unsupportedReason?: string;
  problem: {
    summary: string;
    explanation: string;
  };
  evidence: ActionableImprovementEvidence[];
  affectedEntities: string[];
  recommendation: {
    summary: string;
    rationale: string;
  };
  artifacts: Array<{
    id: string;
    action: RepositoryOptimizationPlanItem['artifact']['action'];
    generatedPath: string;
    futureDestination: string;
    generatorId: string;
    previewAvailable: boolean;
    readiness: RepositoryOptimizationPlanItem['readiness'];
  }>;
  verification: {
    expectation: string;
    method: string;
  };
  included: boolean;
}

export interface BuildRepositoryActionableImprovementsInput {
  transformation: RepositoryTransformationProposalModel;
  plan: RepositoryOptimizationPlan;
  preparedProposalIds?: Iterable<string>;
  appliedProposalIds?: Iterable<string>;
  verifiedProposalIds?: Iterable<string>;
}

/**
 * Internal adapter joining the existing proposal and plan schemas. It does not
 * create serialized state or replace either production model.
 */
export function buildRepositoryActionableImprovements({
  transformation,
  plan,
  preparedProposalIds = [],
  appliedProposalIds = [],
  verifiedProposalIds = [],
}: BuildRepositoryActionableImprovementsInput): RepositoryActionableImprovement[] {
  const prepared = new Set(preparedProposalIds);
  const applied = new Set(appliedProposalIds);
  const verified = new Set(verifiedProposalIds);
  const excluded = new Set(plan.excludedProposalIds);

  return [...transformation.proposals]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(proposal => improvementFor(proposal, plan, {
      prepared: prepared.has(proposal.id),
      applied: applied.has(proposal.id),
      verified: verified.has(proposal.id),
      included: !excluded.has(proposal.id),
    }));
}

function improvementFor(
  proposal: RepositoryTransformationProposal,
  plan: RepositoryOptimizationPlan,
  state: { prepared: boolean; applied: boolean; verified: boolean; included: boolean }
): RepositoryActionableImprovement {
  const planItems = plan.items.filter(item => item.proposalIds.includes(proposal.id));
  const evidence = proposal.sourceEvidence.map(item => ({
    summary: item.label,
    detail: item.detail,
    confidence: confidenceNumber(proposal.confidence),
    kind: item.state === 'evidence' ? 'evidence-backed' as const : 'heuristic' as const,
  }));
  const support = supportFor(proposal, planItems, evidence);
  const unsupportedReason = unsupportedReasonFor(proposal, planItems, evidence);

  return {
    id: proposal.id,
    title: proposal.title,
    domain: proposal.domain,
    lifecycle: lifecycleFor(state, support),
    support,
    unsupportedReason,
    problem: {
      summary: proposal.summary,
      explanation: evidence.length
        ? `The current repository evidence does not yet provide the ${proposal.title.toLowerCase()} described by this proposal.`
        : 'The current scan did not expose enough evidence to support this proposal.',
    },
    evidence,
    affectedEntities: [...new Set(proposal.graphChanges.affectedExistingNodeIds)].sort(),
    recommendation: {
      summary: proposal.title,
      rationale: proposal.expectedEffect.repositoryMeaning,
    },
    artifacts: planItems.map(item => ({
      id: item.artifact.id,
      action: item.artifact.action,
      generatedPath: item.artifact.path,
      futureDestination: item.artifact.repositoryDestinationPath,
      generatorId: item.artifact.generatorId,
      previewAvailable: Boolean(item.artifact.content),
      readiness: item.readiness,
    })),
    verification: {
      expectation: proposal.expectedEffect.agentBehavior,
      method: 'Apply reviewed artifacts, then rescan the same repository and compare the saved baseline.',
    },
    included: state.included && support === 'actionable',
  };
}

function supportFor(
  proposal: RepositoryTransformationProposal,
  planItems: RepositoryOptimizationPlanItem[],
  evidence: ActionableImprovementEvidence[]
): ActionableImprovementSupport {
  if (!evidence.length || !proposal.graphChanges.affectedExistingNodeIds.length) return 'unsupported';
  if (!proposal.artifactActions.length || !planItems.length) return 'unsupported';
  if (planItems.every(item => item.readiness === 'blocked' || item.artifact.action === 'unavailable')) return 'unsupported';
  return 'actionable';
}

function unsupportedReasonFor(
  proposal: RepositoryTransformationProposal,
  planItems: RepositoryOptimizationPlanItem[],
  evidence: ActionableImprovementEvidence[]
) {
  if (!evidence.length) return 'No bounded repository evidence supports this proposal.';
  if (!proposal.graphChanges.affectedExistingNodeIds.length) return 'No current repository entity is mapped to this proposal.';
  if (!proposal.artifactActions.length || !planItems.length) return 'No supported generated artifact maps to this proposal.';
  if (planItems.every(item => item.readiness === 'blocked' || item.artifact.action === 'unavailable')) {
    return 'The mapped generator output is blocked or unavailable.';
  }
  return undefined;
}

function lifecycleFor(
  state: { prepared: boolean; applied: boolean; verified: boolean; included: boolean },
  support: ActionableImprovementSupport
): ActionableImprovementLifecycle {
  if (support === 'unsupported') return 'unresolved';
  if (state.verified) return 'verified';
  if (state.applied) return 'applied';
  if (state.prepared) return 'prepared';
  return 'proposed';
}

function confidenceNumber(confidence: RepositoryTransformationConfidence) {
  if (confidence === 'high') return 0.9;
  if (confidence === 'medium') return 0.7;
  return 0.45;
}

import type { AgentPackFile } from '@/lib/types';
import type {
  ExecutableFuturePlan,
  RepositoryTransformationProposal,
} from '@/lib/workspace';

export interface UniverseFastPathAction {
  proposalId: string;
  title: string;
  summary: string;
  affectedEntityCount: number;
  agentTask: string;
}

export interface FuturePlanFastPathSummary {
  stepCount: number;
  prerequisiteCount: number;
  existingAreaCount: number;
  likelyNewAreaCount: number;
  reviewGateCount: number;
}

/**
 * Fast Path is a presentation selector over the existing deterministic
 * transformation model. A repository entity is actionable only when an
 * existing proposal explicitly names it as affected evidence.
 */
export function resolveUniverseFastPathAction(
  nodeId: string | undefined,
  proposals: RepositoryTransformationProposal[],
): UniverseFastPathAction | null {
  if (!nodeId) return null;
  const proposal = proposals.find(item => item.graphChanges.affectedExistingNodeIds.includes(nodeId));
  if (!proposal) return null;
  return {
    proposalId: proposal.id,
    title: proposal.title,
    summary: proposal.summary,
    affectedEntityCount: proposal.graphChanges.affectedExistingNodeIds.length,
    agentTask: proposal.title,
  };
}

export function buildFuturePlanFastPathSummary(plan: ExecutableFuturePlan): FuturePlanFastPathSummary {
  return {
    stepCount: plan.implementationStages.length,
    prerequisiteCount: plan.requiredCapabilities.length,
    existingAreaCount: plan.affectedRepositoryAreas.filter(area => area.kind === 'existing-repository-area').length,
    likelyNewAreaCount: plan.affectedRepositoryAreas.filter(area => area.kind !== 'existing-repository-area').length,
    reviewGateCount: plan.reviewGates.length,
  };
}

/** Picks a real existing agent artifact; it never generates another output. */
export function resolveFastPathAgentArtifact(files: AgentPackFile[]): AgentPackFile | undefined {
  const preferredNames = [
    'AGENTS.md',
    'CLAUDE.md',
    'GLOBAL_CONTEXT.md',
    'ARCHITECTURE.md',
    'AGENT_READINESS_REPORT.md',
  ];
  for (const name of preferredNames) {
    const exact = files.find(file => file.name === name || file.name.endsWith(`/${name}`));
    if (exact) return exact;
  }
  return files[0];
}

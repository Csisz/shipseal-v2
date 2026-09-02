import { describe, expect, it } from 'vitest';
import { futuresQaProductIntelligence, futuresQaReport } from '@/dev/RepositoryFuturesLayoutQa';
import { buildRepositoryFuturePathwaysGraph } from '@/components/agentready/result-workspace/futures/repositoryFuturePathwaysGraph';
import {
  buildExecutableFuturePlan,
  buildRepositoryUniverseModel,
  type RepositoryTransformationProposal,
} from '@/lib/workspace';
import { synthesizeRepositoryFutureDraft } from '@/lib/workspace/repositoryFutures';
import {
  buildFuturePlanFastPathSummary,
  resolveFastPathAgentArtifact,
  resolveUniverseFastPathAction,
} from '@/components/agentready/result-workspace/fastPathPresentation';

function proposal(affectedExistingNodeIds: string[]): RepositoryTransformationProposal {
  return {
    id: 'proposal:context',
    domain: 'agent-routing',
    title: 'Unify agent context',
    summary: 'Give coding agents one bounded route into repository context.',
    evidenceType: 'evidence',
    sourceEvidence: [],
    artifactActions: [],
    graphChanges: { proposedNodes: [], proposedEdges: [], affectedExistingNodeIds },
    expectedEffect: {
      agentBehavior: 'Agents load the same bounded repository context.',
      repositoryMeaning: 'Repository guidance has one clear entry point.',
    },
    confidence: 'high',
  };
}

function executablePlan() {
  const universe = buildRepositoryUniverseModel(futuresQaReport);
  const graph = buildRepositoryFuturePathwaysGraph(futuresQaReport, universe, futuresQaProductIntelligence);
  const primaryGoalId = graph.nodes.find(node => node.kind === 'future-goal')?.id;
  if (!primaryGoalId) throw new Error('Expected Future fixture to expose a goal.');
  const synthesized = synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [primaryGoalId],
    supportingGoalIds: [],
  });
  if (!synthesized.ok) throw new Error('Expected Future fixture to synthesize.');
  return buildExecutableFuturePlan({
    report: futuresQaReport,
    graph,
    draft: synthesized.draft,
    productIntelligence: futuresQaProductIntelligence,
  });
}

describe('Outcome-first Fast Path presentation selectors', () => {
  it('offers Fix this only for a repository node named by an existing deterministic proposal', () => {
    const action = resolveUniverseFastPathAction('node:readme', [proposal(['node:readme', 'node:agents'])]);
    expect(action).toMatchObject({
      proposalId: 'proposal:context',
      title: 'Unify agent context',
      affectedEntityCount: 2,
      agentTask: 'Unify agent context',
    });
    expect(resolveUniverseFastPathAction('node:ordinary-file', [proposal(['node:readme'])])).toBeNull();
  });

  it('summarizes the canonical executable plan without changing or regenerating it', () => {
    const plan = executablePlan();
    expect(buildFuturePlanFastPathSummary(plan)).toEqual({
      stepCount: plan.implementationStages.length,
      prerequisiteCount: plan.requiredCapabilities.length,
      existingAreaCount: plan.affectedRepositoryAreas.filter(area => area.kind === 'existing-repository-area').length,
      likelyNewAreaCount: plan.affectedRepositoryAreas.filter(area => area.kind !== 'existing-repository-area').length,
      reviewGateCount: plan.reviewGates.length,
    });
  });

  it('selects a real existing agent artifact instead of generating a new delivery format', () => {
    const files = [
      { name: 'notes.md', language: 'markdown' as const, description: 'Notes', content: 'notes' },
      { name: '07-context/AGENTS.md', language: 'markdown' as const, description: 'Agent guidance', content: 'agent guidance' },
    ];
    expect(resolveFastPathAgentArtifact(files)?.name).toBe('07-context/AGENTS.md');
    expect(resolveFastPathAgentArtifact([])).toBeUndefined();
  });
});

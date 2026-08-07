import type {
  RepositoryTransformationDomain,
  RepositoryTransformationProposal,
  RepositoryTransformationProposalModel,
} from '../repositoryTransformation.js';
import type { RepositoryUniverseModel, RepositoryUniversePosition } from '../repositoryUniverse.js';
import type { WorkspaceEvidenceItem } from '../workspaceStory.js';
import type { RepositoryFutureDraft } from './draft.js';
import { repositoryFutureFingerprint, sortedUnique } from './identity.js';
import type {
  RepositoryFutureConfidence,
  RepositoryFutureGraph,
  RepositoryFutureHumanReviewState,
} from './schema.js';

export const REPOSITORY_FUTURE_UNIVERSE_PROJECTION_VERSION = 'shipseal.repository-future-universe-projection.v1' as const;

export interface RepositoryFutureUniverseProposedNode {
  id: string;
  kind: 'capability' | 'dependency' | 'artifact';
  label: string;
  lifecycle: 'proposed';
  currentness: 'future';
  state: 'proposed';
  capabilityId?: string;
  artifactPath?: string;
  sourceGoalIds: string[];
  affectedCurrentNodeIds: string[];
  clusterId: string;
  position: RepositoryUniversePosition;
  confidence: RepositoryFutureConfidence;
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
}

export interface RepositoryFutureUniverseProposedEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'connects-to-evidence';
  lifecycle: 'proposed';
  currentness: 'future';
  sourceGoalIds: string[];
}

export interface RepositoryFutureUniverseProjection {
  schemaVersion: typeof REPOSITORY_FUTURE_UNIVERSE_PROJECTION_VERSION;
  sourceUniverseIdentity: string;
  sourceUniverseFingerprint: string;
  sourceGraphFingerprint: string;
  sourceDraftFingerprint: string;
  proposedNodes: RepositoryFutureUniverseProposedNode[];
  proposedEdges: RepositoryFutureUniverseProposedEdge[];
  affectedCurrentNodeIds: string[];
  affectedClusterIds: string[];
  limitations: string[];
  reviewRequired: boolean;
  fingerprint: string;
}

export function buildRepositoryFutureUniverseProjection(input: {
  universe: RepositoryUniverseModel;
  graph: RepositoryFutureGraph;
  draft: RepositoryFutureDraft;
}): RepositoryFutureUniverseProjection {
  const { universe, graph, draft } = input;
  const currentNodeIds = new Set(universe.nodes.map(node => node.id));
  const sourceUniverseIdentity = repositoryFutureFingerprint({
    rootNodeId: universe.rootNodeId,
    nodeIds: universe.nodes.map(node => node.id).sort(),
    edgeIds: universe.edges.map(edge => edge.id).sort(),
  });
  const selectedGoals = [draft.primaryGoal, ...draft.supportingGoals];
  const candidateById = new Map(graph.candidates.map(candidate => [candidate.id, candidate]));
  const mappingsByGoalId = new Map(selectedGoals.map(goal => {
    const candidate = candidateById.get(goal.candidateId);
    return [goal.goalId, sortedUnique((candidate?.universeMappings || [])
      .map(mapping => mapping.universeNodeId)
      .filter(nodeId => currentNodeIds.has(nodeId)))];
  }));
  const allSelectedMappings = sortedUnique([...mappingsByGoalId.values()].flat());
  const fallbackCurrentNodeIds = allSelectedMappings.length ? allSelectedMappings : [universe.rootNodeId];
  const nodes: RepositoryFutureUniverseProposedNode[] = [];

  const capabilityGroups = new Map<string, typeof selectedGoals>();
  for (const goal of selectedGoals) {
    const capabilityId = candidateById.get(goal.candidateId)?.targetCapabilityId;
    if (!capabilityId) continue;
    capabilityGroups.set(capabilityId, [...(capabilityGroups.get(capabilityId) || []), goal]);
  }
  for (const [capabilityId, goals] of [...capabilityGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const affected = sortedUnique(goals.flatMap(goal => mappingsByGoalId.get(goal.goalId) || []));
    nodes.push(proposedNode({
      universe,
      id: `future-projection:capability:${capabilityId}`,
      kind: 'capability',
      label: goals[0]?.title || capabilityId,
      capabilityId,
      sourceGoalIds: goals.map(goal => goal.goalId),
      affectedCurrentNodeIds: affected.length ? affected : fallbackCurrentNodeIds,
      confidence: lowestConfidence(goals.map(goal => goal.confidence)),
      humanReviewState: goals.some(goal => goal.humanReviewState === 'required') ? 'required' : 'not-required',
      limitations: sortedUnique(goals.flatMap(goal => goal.limitations)),
      ordinal: nodes.length,
    }));
  }

  for (const dependency of draft.dependencies
    .filter(item => item.state !== 'satisfied')
    .sort((left, right) => left.executionOrder - right.executionOrder || left.capabilityId.localeCompare(right.capabilityId))) {
    const affected = sortedUnique(dependency.dependentGoalIds.flatMap(goalId => mappingsByGoalId.get(goalId) || []));
    nodes.push(proposedNode({
      universe,
      id: `future-projection:dependency:${dependency.capabilityId}`,
      kind: 'dependency',
      label: dependency.title,
      capabilityId: dependency.capabilityId,
      sourceGoalIds: dependency.dependentGoalIds,
      affectedCurrentNodeIds: affected.length ? affected : fallbackCurrentNodeIds,
      confidence: dependency.confidence,
      humanReviewState: dependency.humanReviewState,
      limitations: dependency.limitations,
      ordinal: nodes.length,
    }));
  }

  for (const artifact of [...draft.artifacts].sort((left, right) => left.id.localeCompare(right.id))) {
    const sourceGoal = selectedGoals.find(goal => goal.candidateId === artifact.candidateId);
    const sourceGoalIds = sourceGoal ? [sourceGoal.goalId] : [];
    const mapped = sortedUnique([
      ...artifact.universeMappings.map(mapping => mapping.universeNodeId),
      ...sourceGoalIds.flatMap(goalId => mappingsByGoalId.get(goalId) || []),
    ].filter(nodeId => currentNodeIds.has(nodeId)));
    nodes.push(proposedNode({
      universe,
      id: `future-projection:artifact:${artifact.artifactId || artifact.id}`,
      kind: 'artifact',
      label: artifact.title,
      artifactPath: artifact.evidencePaths[0] || artifact.title,
      sourceGoalIds,
      affectedCurrentNodeIds: mapped.length ? mapped : fallbackCurrentNodeIds,
      confidence: artifact.confidence,
      humanReviewState: artifact.humanReviewState,
      limitations: artifact.limitations,
      ordinal: nodes.length,
    }));
  }

  const proposedNodes = uniqueBy(nodes, node => node.id).sort((left, right) => left.id.localeCompare(right.id));
  const proposedEdges = proposedNodes.flatMap(node => node.affectedCurrentNodeIds.slice(0, 4).map(target => ({
    id: `future-projection:edge:${repositoryFutureFingerprint({ source: node.id, target })}`,
    source: node.id,
    target,
    relationship: 'connects-to-evidence' as const,
    lifecycle: 'proposed' as const,
    currentness: 'future' as const,
    sourceGoalIds: node.sourceGoalIds,
  }))).sort((left, right) => left.id.localeCompare(right.id));
  const affectedCurrentNodeIds = sortedUnique(proposedNodes.flatMap(node => node.affectedCurrentNodeIds));
  const affectedClusterIds = sortedUnique(affectedCurrentNodeIds.map(nodeId => universe.nodes.find(node => node.id === nodeId)?.clusterId || ''));
  const limitations = sortedUnique([
    ...draft.limitations,
    ...proposedNodes.flatMap(node => node.limitations),
    'This is a proposed projection derived from the selected Future Draft. It is not applied or verified repository state.',
  ]);
  const projectionCore = {
    schemaVersion: REPOSITORY_FUTURE_UNIVERSE_PROJECTION_VERSION,
    sourceUniverseIdentity,
    sourceUniverseFingerprint: graph.sourceUniverseFingerprint,
    sourceGraphFingerprint: graph.fingerprint,
    sourceDraftFingerprint: draft.fingerprint,
    proposedNodes,
    proposedEdges,
    affectedCurrentNodeIds,
    affectedClusterIds,
    limitations,
    reviewRequired: draft.preparationReadiness !== 'ready' || proposedNodes.some(node => node.humanReviewState === 'required'),
  };
  return { ...projectionCore, fingerprint: repositoryFutureFingerprint(projectionCore) };
}

export function repositoryFutureProjectionToTransformationModel(
  universe: RepositoryUniverseModel,
  projection?: RepositoryFutureUniverseProjection,
): RepositoryTransformationProposalModel {
  const proposals = projection?.proposedNodes.map(node => projectionProposal(node, projection)) || [];
  return {
    modeLabel: 'Selected Future Path projection',
    proposals,
    supportedOutputPaths: sortedUnique(proposals.flatMap(proposal => proposal.artifactActions.map(action => action.path))),
    summary: {
      currentFiles: universe.summary.representedFileNodeCount,
      currentClusters: universe.summary.clusterCount,
      proposedArtifacts: projection?.proposedNodes.filter(node => node.kind === 'artifact').length || 0,
      proposedRelationships: projection?.proposedEdges.length || 0,
      limitedScan: Boolean(projection?.limitations.length),
    },
  };
}

function proposedNode(input: {
  universe: RepositoryUniverseModel;
  id: string;
  kind: RepositoryFutureUniverseProposedNode['kind'];
  label: string;
  capabilityId?: string;
  artifactPath?: string;
  sourceGoalIds: string[];
  affectedCurrentNodeIds: string[];
  confidence: RepositoryFutureConfidence;
  humanReviewState: RepositoryFutureHumanReviewState;
  limitations: string[];
  ordinal: number;
}): RepositoryFutureUniverseProposedNode {
  const anchors = input.affectedCurrentNodeIds.flatMap(id => input.universe.nodes.find(node => node.id === id) || []);
  const root = input.universe.nodes.find(node => node.id === input.universe.rootNodeId) || input.universe.nodes[0];
  const base = averagePosition(anchors.length ? anchors.map(node => node.position) : root ? [root.position] : [{ x: 0, y: 0, z: 0 }]);
  const angle = (input.ordinal * 2.399963229728653) % (Math.PI * 2);
  const distance = 5.5 + (input.ordinal % 3) * 1.4;
  const position = { x: base.x + Math.cos(angle) * distance, y: base.y + ((input.ordinal % 5) - 2) * 1.1, z: base.z + Math.sin(angle) * distance };
  const clusterId = anchors[0]?.clusterId || root?.clusterId || input.universe.clusters[0]?.id || 'cluster:repository';
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    lifecycle: 'proposed',
    currentness: 'future',
    state: 'proposed',
    capabilityId: input.capabilityId,
    artifactPath: input.artifactPath,
    sourceGoalIds: sortedUnique(input.sourceGoalIds),
    affectedCurrentNodeIds: sortedUnique(input.affectedCurrentNodeIds),
    clusterId,
    position,
    confidence: input.confidence,
    humanReviewState: input.humanReviewState,
    limitations: sortedUnique(input.limitations),
  };
}

function projectionProposal(node: RepositoryFutureUniverseProposedNode, projection: RepositoryFutureUniverseProjection): RepositoryTransformationProposal {
  const domain = domainFor(node.capabilityId || node.label);
  const artifactPath = node.artifactPath || `Proposed capability: ${node.label}`;
  const sourceEvidence: WorkspaceEvidenceItem[] = node.affectedCurrentNodeIds.map(id => ({ label: id, detail: 'Current repository entity connected by selected Future Draft evidence.', state: 'evidence' }));
  return {
    id: node.id,
    domain,
    title: node.label,
    summary: 'This selected Future Path proposes a repository change connected to current evidence. It has not been applied.',
    evidenceType: 'heuristic',
    sourceEvidence,
    artifactActions: node.kind === 'artifact' ? [{ action: 'create', path: artifactPath, description: 'Prospective artifact supported by the selected Future Draft metadata.' }] : [],
    graphChanges: {
      proposedNodes: [{
        id: node.id,
        proposalId: node.id,
        label: node.label,
        domain,
        artifactPath,
        evidenceType: 'heuristic',
        clusterId: node.clusterId,
        position: node.position,
        x: node.position.x,
        y: node.position.y,
      }],
      proposedEdges: projection.proposedEdges.filter(edge => edge.source === node.id).map(edge => ({
        id: edge.id,
        proposalId: node.id,
        source: edge.source,
        target: edge.target,
        relationship: edge.relationship,
        evidenceType: 'heuristic',
      })),
      affectedExistingNodeIds: node.affectedCurrentNodeIds,
    },
    expectedEffect: {
      agentBehavior: 'The selected path would add or strengthen this capability after explicit preparation and application.',
      repositoryMeaning: 'Proposed by the active Future Draft; current repository truth remains unchanged.',
    },
    confidence: node.confidence,
  };
}

function domainFor(value: string): RepositoryTransformationDomain {
  if (/route|instruction|agent/i.test(value)) return 'agent-routing';
  if (/verif|test|gate|quality/i.test(value)) return 'verification-path';
  return 'project-memory';
}

function averagePosition(positions: RepositoryUniversePosition[]) {
  return positions.reduce((total, position) => ({ x: total.x + position.x / positions.length, y: total.y + position.y / positions.length, z: total.z + position.z / positions.length }), { x: 0, y: 0, z: 0 });
}

function lowestConfidence(values: RepositoryFutureConfidence[]): RepositoryFutureConfidence {
  if (values.includes('low')) return 'low';
  if (values.includes('medium')) return 'medium';
  return 'high';
}

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter(value => {
    const identity = key(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

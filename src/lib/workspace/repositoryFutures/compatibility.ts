import type {
  RepositoryFutureCompatibilityResult,
  RepositoryFutureDraftSelection,
} from './draft.js';
import { sortedUnique } from './identity.js';
import type {
  RepositoryFutureConflict,
  RepositoryFutureGraph,
  RepositoryFutureNode,
  RepositoryFutureNormalizedCandidate,
} from './schema.js';

const PAIR_CONFLICT_KINDS = new Set<RepositoryFutureConflict['kind']>([
  'goal-incompatibility',
  'artifact-target-collision',
  'action-mismatch',
  'incompatible-verification-boundary',
]);

export interface RepositoryFutureGraphIndex {
  candidateByGoalId: Map<string, RepositoryFutureNormalizedCandidate>;
  goalIdByCandidateId: Map<string, string>;
  nodeById: Map<string, RepositoryFutureNode>;
  candidateGoalIdByNodeId: Map<string, string>;
  conflictsByNodeId: Map<string, RepositoryFutureConflict[]>;
}

export function createRepositoryFutureGraphIndex(graph: RepositoryFutureGraph): RepositoryFutureGraphIndex {
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  const candidateById = new Map(graph.candidates.map(candidate => [candidate.id, candidate]));
  const candidateByGoalId = new Map<string, RepositoryFutureNormalizedCandidate>();
  const goalIdByCandidateId = new Map<string, string>();
  for (const node of graph.nodes) {
    if (node.kind !== 'future-goal' || !node.candidateId) continue;
    const candidate = candidateById.get(node.candidateId);
    if (!candidate) continue;
    candidateByGoalId.set(node.id, candidate);
    goalIdByCandidateId.set(candidate.id, node.id);
  }
  const candidateGoalIdByNodeId = new Map<string, string>();
  for (const node of graph.nodes) {
    if (!node.candidateId) continue;
    const goalId = goalIdByCandidateId.get(node.candidateId);
    if (goalId) candidateGoalIdByNodeId.set(node.id, goalId);
  }
  const conflictsByNodeId = new Map<string, RepositoryFutureConflict[]>();
  for (const conflict of graph.conflicts) {
    for (const nodeId of conflict.affectedNodeIds) {
      const values = conflictsByNodeId.get(nodeId) || [];
      values.push(conflict);
      conflictsByNodeId.set(nodeId, values);
    }
  }
  for (const values of conflictsByNodeId.values()) values.sort((left, right) => left.id.localeCompare(right.id));
  return { candidateByGoalId, goalIdByCandidateId, nodeById, candidateGoalIdByNodeId, conflictsByNodeId };
}

export function inspectRepositoryFutureCandidateCompatibility(
  graph: RepositoryFutureGraph,
  selection: RepositoryFutureDraftSelection,
  candidateGoalId: string,
  index = createRepositoryFutureGraphIndex(graph),
): RepositoryFutureCompatibilityResult {
  const selectedGoalIds = sortedUnique([...selection.primaryGoalIds, ...selection.supportingGoalIds]);
  const candidate = index.candidateByGoalId.get(candidateGoalId);
  if (!candidate) return compatibility(candidateGoalId, undefined, 'blocked', [], [], false, ['Candidate is not a future goal in this graph.']);
  if (selectedGoalIds.includes(candidateGoalId)) {
    return compatibility(candidateGoalId, candidate.id, 'already-selected', [candidateGoalId], [], candidate.humanReviewState === 'required', ['Candidate is already selected.']);
  }

  const intrinsic = intrinsicBlockingConflicts(graph, candidateGoalId, index);
  const invalidReasons: string[] = [];
  if (candidate.eligibility !== 'eligible') invalidReasons.push(`Candidate eligibility is ${candidate.eligibility}.`);
  if (candidate.currentness !== 'future' || candidate.lifecycle !== 'proposed') invalidReasons.push('Candidate does not represent a proposed future goal.');
  if (candidate.repositoryId !== graph.repository.repositoryId
    || candidate.sourceScanId !== graph.repository.sourceScanId
    || candidate.sourceScanFingerprint !== graph.repository.sourceScanFingerprint) {
    invalidReasons.push('Candidate repository or scan identity does not match this graph.');
  }
  if (intrinsic.length || invalidReasons.length) {
    return compatibility(
      candidateGoalId,
      candidate.id,
      'blocked',
      [],
      intrinsic.map(item => item.id),
      candidate.humanReviewState === 'required',
      [...invalidReasons, ...intrinsic.map(item => item.rationale)],
    );
  }

  if (selection.supportingGoalIds.length >= 2) {
    return compatibility(candidateGoalId, candidate.id, 'blocked', selectedGoalIds, [], candidate.humanReviewState === 'required', ['The active draft already has two supporting goals.']);
  }

  const pairConflicts = selectedGoalIds.flatMap(selectedGoalId => pairwiseBlockingConflicts(graph, selectedGoalId, candidateGoalId, index));
  const uniquePairConflicts = uniqueConflicts(pairConflicts);
  if (uniquePairConflicts.length) {
    return compatibility(
      candidateGoalId,
      candidate.id,
      'incompatible',
      selectedGoalIds.filter(selectedGoalId => pairwiseBlockingConflicts(graph, selectedGoalId, candidateGoalId, index).length > 0),
      uniquePairConflicts.map(item => item.id),
      candidate.humanReviewState === 'required',
      uniquePairConflicts.map(item => item.rationale),
    );
  }

  const reviewConflicts = candidateConflicts(graph, candidateGoalId, index).filter(item => !item.blocking);
  const dependencyReview = candidate.dependencies.some(dependency => {
    const graphDependency = graph.dependencies.find(item => item.capabilityId === dependency.capabilityId);
    return dependency.humanReviewState === 'required' || graphDependency?.humanReviewState === 'required' || graphDependency?.state === 'review-required';
  });
  const requiredReview = candidate.humanReviewState === 'required' || dependencyReview || reviewConflicts.length > 0;
  return compatibility(
    candidateGoalId,
    candidate.id,
    requiredReview ? 'compatible-with-review' : 'compatible',
    [],
    reviewConflicts.map(item => item.id),
    requiredReview,
    requiredReview
      ? sortedUnique([...reviewConflicts.map(item => item.rationale), 'Human review remains required and cannot be bypassed by synthesis.'])
      : ['No deterministic conflict exists with the active selection.'],
  );
}

export function buildRepositoryFutureCompatibilityMatrix(
  graph: RepositoryFutureGraph,
  selection: RepositoryFutureDraftSelection,
  index = createRepositoryFutureGraphIndex(graph),
) {
  return [...index.candidateByGoalId.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map(goalId => inspectRepositoryFutureCandidateCompatibility(graph, selection, goalId, index));
}

export function intrinsicBlockingConflicts(
  graph: RepositoryFutureGraph,
  goalId: string,
  index = createRepositoryFutureGraphIndex(graph),
) {
  return candidateConflicts(graph, goalId, index).filter(conflict => {
    if (!conflict.blocking) return false;
    const affectedGoalIds = conflictGoalIds(conflict, index);
    if (PAIR_CONFLICT_KINDS.has(conflict.kind) && affectedGoalIds.length > 1) return false;
    return true;
  });
}

export function pairwiseBlockingConflicts(
  graph: RepositoryFutureGraph,
  leftGoalId: string,
  rightGoalId: string,
  index = createRepositoryFutureGraphIndex(graph),
) {
  const left = index.candidateByGoalId.get(leftGoalId);
  const right = index.candidateByGoalId.get(rightGoalId);
  if (!left || !right) return [];
  const matching = graph.conflicts.filter(conflict => {
    if (!conflict.blocking) return false;
    const affectedGoalIds = conflictGoalIds(conflict, index);
    if (!affectedGoalIds.includes(leftGoalId) || !affectedGoalIds.includes(rightGoalId)) return false;
    if (conflict.kind === 'artifact-target-collision') return artifactPairCollision(left, right, 'content');
    if (conflict.kind === 'action-mismatch') return artifactPairCollision(left, right, 'action');
    return PAIR_CONFLICT_KINDS.has(conflict.kind);
  });
  return uniqueConflicts(matching);
}

export function relevantSelectedConflicts(
  graph: RepositoryFutureGraph,
  selectedGoalIds: readonly string[],
  dependencyIds: ReadonlySet<string>,
  index = createRepositoryFutureGraphIndex(graph),
) {
  const selected = new Set(selectedGoalIds);
  return graph.conflicts.filter(conflict => {
    const affectedGoals = conflictGoalIds(conflict, index).filter(goalId => selected.has(goalId));
    const affectsDependency = conflict.affectedNodeIds.some(nodeId => dependencyIds.has(nodeId));
    if (conflict.kind === 'artifact-target-collision' || conflict.kind === 'action-mismatch') {
      for (let leftIndex = 0; leftIndex < affectedGoals.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < affectedGoals.length; rightIndex += 1) {
          if (pairwiseBlockingConflicts(graph, affectedGoals[leftIndex], affectedGoals[rightIndex], index).some(item => item.id === conflict.id)) return true;
        }
      }
      return false;
    }
    if (PAIR_CONFLICT_KINDS.has(conflict.kind)) return affectedGoals.length >= 2;
    return affectedGoals.length > 0 || affectsDependency;
  }).sort((left, right) => left.id.localeCompare(right.id));
}

export function candidateConflicts(
  graph: RepositoryFutureGraph,
  goalId: string,
  index = createRepositoryFutureGraphIndex(graph),
) {
  const candidate = index.candidateByGoalId.get(goalId);
  if (!candidate) return [];
  const nodeIds = graph.nodes.filter(node => node.candidateId === candidate.id).map(node => node.id);
  const directDependencyIds = candidate.dependencies.map(item => graph.dependencies.find(dependency => dependency.capabilityId === item.capabilityId)?.id).filter((id): id is string => Boolean(id));
  return uniqueConflicts([...nodeIds, ...directDependencyIds].flatMap(nodeId => index.conflictsByNodeId.get(nodeId) || []));
}

export function conflictGoalIds(conflict: RepositoryFutureConflict, index: RepositoryFutureGraphIndex) {
  return sortedUnique(conflict.affectedNodeIds.flatMap(nodeId => {
    if (index.candidateByGoalId.has(nodeId)) return [nodeId];
    const goalId = index.candidateGoalIdByNodeId.get(nodeId);
    return goalId ? [goalId] : [];
  }));
}

function artifactPairCollision(
  left: RepositoryFutureNormalizedCandidate,
  right: RepositoryFutureNormalizedCandidate,
  mode: 'content' | 'action',
) {
  for (const leftArtifact of left.expectedArtifacts) {
    if (!leftArtifact.targetPath) continue;
    for (const rightArtifact of right.expectedArtifacts) {
      if (!rightArtifact.targetPath || leftArtifact.targetPath.toLowerCase() !== rightArtifact.targetPath.toLowerCase()) continue;
      if (mode === 'content' && leftArtifact.contentFingerprint && rightArtifact.contentFingerprint && leftArtifact.contentFingerprint !== rightArtifact.contentFingerprint) return true;
      if (mode === 'action' && leftArtifact.action && rightArtifact.action && leftArtifact.action !== rightArtifact.action) return true;
    }
  }
  return false;
}

function compatibility(
  goalId: string,
  candidateId: string | undefined,
  state: RepositoryFutureCompatibilityResult['state'],
  affectedSelectedGoalIds: string[],
  conflictIds: string[],
  requiredReview: boolean,
  reasons: string[],
): RepositoryFutureCompatibilityResult {
  return {
    candidateId,
    goalId,
    state,
    affectedSelectedGoalIds: sortedUnique(affectedSelectedGoalIds),
    conflictIds: sortedUnique(conflictIds),
    requiredReview,
    reasons: sortedUnique(reasons),
  };
}

function uniqueConflicts(conflicts: readonly RepositoryFutureConflict[]) {
  return [...new Map(conflicts.map(conflict => [conflict.id, conflict])).values()].sort((left, right) => left.id.localeCompare(right.id));
}

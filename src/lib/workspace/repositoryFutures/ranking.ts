import {
  createRepositoryFutureGraphIndex,
  inspectRepositoryFutureCandidateCompatibility,
  intrinsicBlockingConflicts,
} from './compatibility.js';
import {
  REPOSITORY_FUTURE_QUICK_PATH_LIMIT,
  type RepositoryFutureCandidateRecommendation,
  type RepositoryFutureDraftSelection,
  type RepositoryFuturePrimaryRecommendations,
} from './draft.js';
import { compareRepositoryFutureCandidates } from './graph.js';
import { sortedUnique } from './identity.js';
import type { RepositoryFutureGraph, RepositoryFutureNormalizedCandidate } from './schema.js';

export function rankRepositoryFuturePrimaryCandidates(
  graph: RepositoryFutureGraph,
  limit = REPOSITORY_FUTURE_QUICK_PATH_LIMIT,
): RepositoryFuturePrimaryRecommendations {
  const index = createRepositoryFutureGraphIndex(graph);
  const boundedLimit = Math.max(0, Math.min(REPOSITORY_FUTURE_QUICK_PATH_LIMIT, Math.floor(limit)));
  const candidates = [...index.candidateByGoalId.entries()]
    .filter(([goalId, candidate]) => candidate.eligibility === 'eligible'
      && intrinsicBlockingConflicts(graph, goalId, index).length === 0
      && !hasUnsupportedRequiredDependency(graph, candidate))
    .sort(([, left], [, right]) => compareRepositoryFutureCandidates(left, right))
    .slice(0, boundedLimit)
    .map(([goalId, candidate], candidateIndex) => recommendation(
      candidateIndex + 1,
      goalId,
      candidate,
      candidate.humanReviewState === 'required' ? 'compatible-with-review' : 'compatible',
      primaryReasons(graph, candidate),
    ));
  return {
    state: candidates.length ? 'available' : 'none',
    sourceGraphFingerprint: graph.fingerprint,
    candidates,
    reasons: candidates.length
      ? ['Recommendations are ranked deterministically; none is selected automatically.']
      : ['No eligible Future Path can be synthesized from current evidence.'],
    limitations: sortedUnique([
      ...graph.limitations,
      ...(candidates.length ? [] : ['Improve scan evidence or resolve blocking candidate and dependency conflicts before synthesis.']),
    ]),
  };
}

export function rankRepositoryFutureSupportingCandidates(
  graph: RepositoryFutureGraph,
  primaryGoalId: string,
  limit = 2,
) {
  const index = createRepositoryFutureGraphIndex(graph);
  const primary = index.candidateByGoalId.get(primaryGoalId);
  if (!primary || limit <= 0) return [];
  const selection: RepositoryFutureDraftSelection = {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [primaryGoalId],
    supportingGoalIds: [],
  };
  return [...index.candidateByGoalId.entries()]
    .filter(([goalId]) => goalId !== primaryGoalId)
    .map(([goalId, candidate]) => ({
      goalId,
      candidate,
      compatibility: inspectRepositoryFutureCandidateCompatibility(graph, selection, goalId, index),
      sharedDependencies: sharedRequiredDependencies(primary, candidate),
    }))
    .filter(item => item.compatibility.state === 'compatible' || item.compatibility.state === 'compatible-with-review')
    .sort((left, right) => compatibilityRank(left.compatibility.state) - compatibilityRank(right.compatibility.state)
      || right.sharedDependencies - left.sharedDependencies
      || compareRepositoryFutureCandidates(left.candidate, right.candidate))
    .slice(0, Math.max(0, Math.min(2, Math.floor(limit))))
    .map((item, candidateIndex) => recommendation(
      candidateIndex + 1,
      item.goalId,
      item.candidate,
      item.compatibility.state,
      sortedUnique([
        ...item.compatibility.reasons,
        item.sharedDependencies
          ? `Shares ${item.sharedDependencies} required capability ${item.sharedDependencies === 1 ? 'dependency' : 'dependencies'} with the primary path.`
          : 'Adds a compatible bounded capability without replacing the primary path.',
      ]),
    ));
}

function recommendation(
  rank: number,
  goalId: string,
  candidate: RepositoryFutureNormalizedCandidate,
  compatibility: RepositoryFutureCandidateRecommendation['compatibility'],
  reasons: string[],
): RepositoryFutureCandidateRecommendation {
  return {
    rank,
    candidateId: candidate.id,
    goalId,
    title: candidate.title,
    fit: candidate.fit,
    compatibility,
    requiredReview: candidate.humanReviewState === 'required' || compatibility === 'compatible-with-review',
    reasons: sortedUnique(reasons),
  };
}

function primaryReasons(graph: RepositoryFutureGraph, candidate: RepositoryFutureNormalizedCandidate) {
  const dependencyStates = candidate.dependencies.map(dependency => graph.dependencies.find(item => item.capabilityId === dependency.capabilityId)?.state).filter(Boolean);
  return sortedUnique([
    candidate.alignment === 'direct-friction' ? 'Directly addresses observed repository friction.' : `Candidate alignment is ${candidate.alignment}.`,
    `${candidate.evidence.length} bounded evidence ${candidate.evidence.length === 1 ? 'reference' : 'references'} support this candidate.`,
    candidate.expectedArtifacts.every(artifact => artifact.supported) ? 'All expected artifact families have supported generator contracts.' : 'Some expected artifacts remain unsupported.',
    candidate.verificationMethod ? 'A later verification method is defined.' : 'A later verification method is not yet defined.',
    dependencyStates.includes('missing') ? 'Required missing capabilities will be included automatically.' : 'Known dependency state is represented in the graph.',
  ]);
}

function sharedRequiredDependencies(left: RepositoryFutureNormalizedCandidate, right: RepositoryFutureNormalizedCandidate) {
  const leftIds = new Set(left.dependencies.filter(item => item.requirement === 'required').map(item => item.capabilityId));
  return new Set(right.dependencies.filter(item => item.requirement === 'required' && leftIds.has(item.capabilityId)).map(item => item.capabilityId)).size;
}

function hasUnsupportedRequiredDependency(graph: RepositoryFutureGraph, candidate: RepositoryFutureNormalizedCandidate) {
  const dependencyByCapability = new Map(graph.dependencies.map(dependency => [dependency.capabilityId, dependency]));
  const dependencyById = new Map(graph.dependencies.map(dependency => [dependency.id, dependency]));
  const requiredTargets = new Map<string, string[]>();
  for (const edge of graph.edges.filter(edge => edge.relation === 'requires')) {
    const targets = requiredTargets.get(edge.source) || [];
    targets.push(edge.target);
    requiredTargets.set(edge.source, targets);
  }
  const visited = new Set<string>();
  function unsupported(dependencyId: string): boolean {
    if (visited.has(dependencyId)) return false;
    visited.add(dependencyId);
    const dependency = dependencyById.get(dependencyId);
    if (!dependency || dependency.state === 'unknown' || dependency.state === 'blocked' || dependency.state === 'stale') return true;
    return (requiredTargets.get(dependencyId) || []).some(unsupported);
  }
  return candidate.dependencies.some(dependency => {
    if (dependency.requirement !== 'required') return false;
    const resolved = dependencyByCapability.get(dependency.capabilityId);
    return !resolved || unsupported(resolved.id);
  });
}

function compatibilityRank(state: RepositoryFutureCandidateRecommendation['compatibility']) {
  if (state === 'compatible') return 0;
  if (state === 'compatible-with-review') return 1;
  return 2;
}

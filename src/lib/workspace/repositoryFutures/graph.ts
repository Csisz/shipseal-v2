import type { RepositoryUniverseModel } from '../repositoryUniverse.js';
import { DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS } from './capabilities.js';
import {
  confidenceRank,
  normalizeRepositoryFuturePath,
  originRank,
  repositoryFutureFingerprint,
  repositoryFutureId,
  sensitiveFutureContent,
  sortedUnique,
} from './identity.js';
import {
  REPOSITORY_FUTURE_GRAPH_POLICY_VERSION,
  REPOSITORY_FUTURE_GRAPH_VERSION,
  type BuildRepositoryFutureGraphInput,
  type RepositoryFutureConflict,
  type RepositoryFutureConflictKind,
  type RepositoryFutureDependency,
  type RepositoryFutureDependencyCycle,
  type RepositoryFutureDependencyDefinition,
  type RepositoryFutureEdge,
  type RepositoryFutureEligibility,
  type RepositoryFutureGraph,
  type RepositoryFutureNode,
  type RepositoryFutureNormalizedCandidate,
} from './schema.js';

const ELIGIBILITY_ORDER: Record<RepositoryFutureEligibility, number> = {
  eligible: 0,
  exploratory: 1,
  blocked: 2,
  unsupported: 3,
};

const ALIGNMENT_ORDER: Record<RepositoryFutureNormalizedCandidate['alignment'], number> = {
  'direct-friction': 0,
  transformation: 1,
  'verified-opportunity': 2,
  'workspace-evidence': 3,
  'provider-suggestion': 4,
};

export function buildRepositoryFutureGraph(input: BuildRepositoryFutureGraphInput): RepositoryFutureGraph {
  const sourceUniverseFingerprint = repositoryFutureFingerprint(input.universe);
  const candidates = normalizeGraphCandidates(
    input.candidateResults.flatMap(result => result.candidates),
    input,
  ).sort(compareRepositoryFutureCandidates);
  const rejectedInputs = input.candidateResults
    .flatMap(result => result.rejected)
    .sort((left, right) => (left.sourceId || '').localeCompare(right.sourceId || '') || left.reasonCodes.join(':').localeCompare(right.reasonCodes.join(':')));
  const definitions = normalizeDefinitions(input.capabilityDefinitions || DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS);
  const dependencyResult = buildRepositoryFutureDependencies(candidates, definitions, new Set(input.satisfiedCapabilityIds || []));
  const nodes = buildNodes(candidates, dependencyResult.dependencies, input.universe);
  const conflicts = buildConflicts(candidates, dependencyResult.dependencies, dependencyResult.cycles, nodes, input);
  const edges = buildEdges(candidates, dependencyResult.dependencies, definitions, conflicts, nodes);
  const limitations = sortedUnique([
    ...(input.repository.limited ? ['The source scan is limited; the graph contains exploratory or blocked futures only where evidence is insufficient.'] : []),
    ...(rejectedInputs.length ? [`${rejectedInputs.length} candidate input(s) were rejected before graph construction.`] : []),
    'The Repository Future Graph is a proposed overlay and does not select, prepare, persist, apply or verify a Future Plan.',
  ]);
  const summary = {
    currentReferenceNodes: nodes.filter(node => node.kind === 'repository-entity').length,
    eligibleCandidates: candidates.filter(candidate => candidate.eligibility === 'eligible').length,
    exploratoryCandidates: candidates.filter(candidate => candidate.eligibility === 'exploratory').length,
    blockedCandidates: candidates.filter(candidate => candidate.eligibility === 'blocked').length,
    unsupportedCandidates: candidates.filter(candidate => candidate.eligibility === 'unsupported').length,
    requiredDependencies: dependencyResult.dependencies.filter(item => item.requirement === 'required').length,
    satisfiedDependencies: dependencyResult.dependencies.filter(item => item.state === 'satisfied').length,
    blockingConflicts: conflicts.filter(conflict => conflict.blocking).length,
    limited: input.repository.limited,
  };
  const core = {
    version: REPOSITORY_FUTURE_GRAPH_VERSION,
    policyVersion: REPOSITORY_FUTURE_GRAPH_POLICY_VERSION,
    repository: input.repository,
    sourceUniverseFingerprint,
    nodes,
    edges,
    candidates,
    dependencies: dependencyResult.dependencies,
    dependencyCycles: dependencyResult.cycles,
    conflicts,
    rejectedInputs,
    summary,
    limitations,
  };
  return { ...core, fingerprint: repositoryFutureFingerprint(core) };
}

export function compareRepositoryFutureCandidates(left: RepositoryFutureNormalizedCandidate, right: RepositoryFutureNormalizedCandidate) {
  return ELIGIBILITY_ORDER[left.eligibility] - ELIGIBILITY_ORDER[right.eligibility]
    || ALIGNMENT_ORDER[left.alignment] - ALIGNMENT_ORDER[right.alignment]
    || evidenceQualityRank(right) - evidenceQualityRank(left)
    || dependencySatisfiabilityRank(right) - dependencySatisfiabilityRank(left)
    || supportedArtifactRank(right) - supportedArtifactRank(left)
    || Number(Boolean(right.verificationMethod)) - Number(Boolean(left.verificationMethod))
    || Number(left.humanReviewState === 'required') - Number(right.humanReviewState === 'required')
    || left.id.localeCompare(right.id);
}

export function buildRepositoryFutureDependencies(
  candidates: readonly RepositoryFutureNormalizedCandidate[],
  definitions: readonly RepositoryFutureDependencyDefinition[] = DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
  satisfiedCapabilityIds: ReadonlySet<string> = new Set(),
) {
  const definitionById = new Map(normalizeDefinitions(definitions).map(item => [item.id, item]));
  const accumulator = new Map<string, {
    capabilityId: string;
    required: boolean;
    origins: Set<RepositoryFutureNormalizedCandidate['origin']>;
    rationale: Set<string>;
    evidenceIds: Set<string>;
    confidence: RepositoryFutureNormalizedCandidate['confidence'];
    states: Set<RepositoryFutureDependency['state']>;
    dependentGoalIds: Set<string>;
    humanReviewRequired: boolean;
    limitations: Set<string>;
  }>();
  const reachable = new Set<string>();

  function addDependency(
    capabilityId: string,
    goalId: string,
    seed: RepositoryFutureNormalizedCandidate['dependencies'][number] | undefined,
    requirement: 'required' | 'optional',
    ancestry: string[],
  ) {
    const definition = definitionById.get(capabilityId);
    reachable.add(capabilityId);
    const key = capabilityId;
    const existing = accumulator.get(key) || {
      capabilityId,
      required: requirement === 'required',
      origins: new Set<RepositoryFutureNormalizedCandidate['origin']>(),
      rationale: new Set<string>(),
      evidenceIds: new Set<string>(),
      confidence: seed?.confidence || 'low',
      states: new Set<RepositoryFutureDependency['state']>(),
      dependentGoalIds: new Set<string>(),
      humanReviewRequired: false,
      limitations: new Set<string>(),
    };
    if (requirement === 'required') existing.required = true;
    if (seed) {
      existing.origins.add(seed.origin);
      existing.rationale.add(seed.rationale);
      seed.evidenceIds.forEach(id => existing.evidenceIds.add(id));
      if (confidenceRank(seed.confidence) < confidenceRank(existing.confidence)) existing.confidence = seed.confidence;
      if (seed.state) existing.states.add(seed.state);
      if (seed.humanReviewState === 'required') existing.humanReviewRequired = true;
      seed.limitations.forEach(item => existing.limitations.add(item));
    } else if (definition) {
      existing.origins.add('deterministic');
      existing.rationale.add(definition.rationale);
    }
    existing.dependentGoalIds.add(goalId);
    if (satisfiedCapabilityIds.has(capabilityId)) existing.states.add('satisfied');
    else if (!definition) {
      existing.states.add('unknown');
      existing.limitations.add('No supported deterministic capability definition exists.');
    } else if (!existing.states.size) existing.states.add('missing');
    accumulator.set(key, existing);

    if (!definition || ancestry.includes(capabilityId)) return;
    for (const requiredId of definition.requires) {
      addDependency(requiredId, goalId, undefined, 'required', [...ancestry, capabilityId]);
    }
  }

  for (const candidate of candidates) {
    for (const dependency of candidate.dependencies) {
      addDependency(dependency.capabilityId, goalNodeId(candidate.id), dependency, dependency.requirement, []);
    }
  }

  const dependencies = [...accumulator.values()].map(item => {
    const definition = definitionById.get(item.capabilityId);
    const state = dependencyState(item.states, item.humanReviewRequired);
    const core = {
      capabilityId: item.capabilityId,
      title: definition?.title || item.capabilityId,
      requirement: item.required ? 'required' as const : 'optional' as const,
      origin: [...item.origins].sort((left, right) => originRank(left) - originRank(right))[0] || 'deterministic' as const,
      rationale: [...item.rationale].sort().join(' '),
      evidenceIds: [...item.evidenceIds].sort(),
      confidence: item.confidence,
      state,
      dependentGoalIds: [...item.dependentGoalIds].sort(),
      humanReviewState: item.humanReviewRequired ? 'required' as const : 'not-required' as const,
      limitations: [...item.limitations].sort(),
    };
    return {
      id: dependencyNodeId(item.capabilityId),
      ...core,
      fingerprint: repositoryFutureFingerprint(core),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const cycles = detectRepositoryFutureDependencyCycles(definitionById, reachable, dependencies);
  return { dependencies, cycles };
}

export function detectRepositoryFutureDependencyCycles(
  definitionById: ReadonlyMap<string, RepositoryFutureDependencyDefinition>,
  reachableCapabilityIds: ReadonlySet<string>,
  dependencies: readonly RepositoryFutureDependency[],
): RepositoryFutureDependencyCycle[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles = new Map<string, string[]>();

  function visit(capabilityId: string) {
    if (visiting.has(capabilityId)) {
      const index = stack.indexOf(capabilityId);
      if (index >= 0) {
        const cycle = canonicalCycle(stack.slice(index));
        cycles.set(cycle.join('>'), cycle);
      }
      return;
    }
    if (visited.has(capabilityId)) return;
    visiting.add(capabilityId);
    stack.push(capabilityId);
    const definition = definitionById.get(capabilityId);
    for (const requiredId of [...(definition?.requires || [])].sort()) {
      if (reachableCapabilityIds.has(requiredId)) visit(requiredId);
    }
    stack.pop();
    visiting.delete(capabilityId);
    visited.add(capabilityId);
  }

  for (const capabilityId of [...reachableCapabilityIds].sort()) visit(capabilityId);
  return [...cycles.values()].map(capabilityIds => {
    const dependencyIds = capabilityIds.map(dependencyNodeId).sort();
    const affectedGoalIds = sortedUnique(dependencies
      .filter(item => capabilityIds.includes(item.capabilityId))
      .flatMap(item => item.dependentGoalIds));
    const core = {
      dependencyIds,
      capabilityIds,
      affectedGoalIds,
      blocking: true as const,
      rationale: `Required dependency cycle detected: ${[...capabilityIds, capabilityIds[0]].join(' → ')}.`,
    };
    return {
      id: repositoryFutureId('future-dependency-cycle', capabilityIds),
      ...core,
      fingerprint: repositoryFutureFingerprint(core),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function buildNodes(
  candidates: readonly RepositoryFutureNormalizedCandidate[],
  dependencies: readonly RepositoryFutureDependency[],
  universe: RepositoryUniverseModel,
) {
  const nodes: RepositoryFutureNode[] = [];
  const universeById = new Map(universe.nodes.map(node => [node.id, node]));
  const mappingEvidence = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    for (const mapping of candidate.universeMappings) {
      const ids = mappingEvidence.get(mapping.universeNodeId) || new Set<string>();
      candidate.evidence.forEach(item => ids.add(item.id));
      mappingEvidence.set(mapping.universeNodeId, ids);
    }
  }
  for (const [universeNodeId, evidenceIds] of [...mappingEvidence.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const current = universeById.get(universeNodeId);
    if (!current) continue;
    nodes.push(node({
      id: currentReferenceNodeId(universeNodeId),
      kind: 'repository-entity',
      lifecycle: 'current',
      currentness: 'current',
      title: current.label,
      rationale: 'Lightweight reference to authoritative current Repository Universe truth.',
      origin: 'deterministic',
      evidenceIds: [...evidenceIds],
      evidencePaths: current.path ? [current.path] : [],
      confidence: current.evidenceType === 'evidence' ? 'high' : 'medium',
      humanReviewState: 'not-required',
      universeMappings: [{ universeNodeId, repositoryRelativePath: current.path }],
      limitations: [],
      unavailableInformation: [],
    }));
  }
  for (const candidate of candidates) {
    nodes.push(node({
      id: goalNodeId(candidate.id),
      kind: 'future-goal',
      lifecycle: 'proposed',
      currentness: 'future',
      title: candidate.title,
      rationale: candidate.rationale,
      origin: candidate.origin,
      evidenceIds: candidate.evidence.map(item => item.id),
      evidencePaths: candidate.evidence.flatMap(item => item.path ? [item.path] : []),
      confidence: candidate.confidence,
      humanReviewState: candidate.humanReviewState,
      universeMappings: candidate.universeMappings,
      limitations: candidate.limitations,
      unavailableInformation: candidate.unavailableInformation,
      candidateId: candidate.id,
    }));
    for (const artifact of candidate.expectedArtifacts) {
      nodes.push(node({
        id: artifactNodeId(artifact.id),
        kind: 'artifact',
        lifecycle: 'proposed',
        currentness: 'future',
        title: artifact.targetPath || artifact.family,
        rationale: `Potential ${artifact.family} output; no artifact content is generated by Ω.18.5b.`,
        origin: candidate.origin,
        evidenceIds: candidate.evidence.map(item => item.id),
        evidencePaths: artifact.targetPath ? [artifact.targetPath] : [],
        confidence: candidate.confidence,
        humanReviewState: artifact.humanReviewRequired ? 'required' : 'not-required',
        universeMappings: [],
        limitations: artifact.limitations,
        unavailableInformation: artifact.targetPath ? [] : ['Artifact destination is not established.'],
        candidateId: candidate.id,
        artifactId: artifact.id,
      }));
    }
    if (candidate.humanReviewState === 'required') {
      nodes.push(node({
        id: reviewGateNodeId(candidate.id),
        kind: 'gate',
        lifecycle: 'proposed',
        currentness: 'future',
        title: 'Human review required',
        rationale: 'Sensitive repository areas require qualified human review before later preparation.',
        origin: candidate.origin,
        evidenceIds: candidate.evidence.map(item => item.id),
        evidencePaths: candidate.evidence.flatMap(item => item.path ? [item.path] : []),
        confidence: candidate.confidence,
        humanReviewState: 'required',
        universeMappings: candidate.universeMappings,
        limitations: [],
        unavailableInformation: [],
        candidateId: candidate.id,
      }));
    }
  }
  for (const dependency of dependencies) {
    nodes.push(node({
      id: dependency.id,
      kind: 'capability',
      lifecycle: dependency.state === 'satisfied' ? 'current' : 'proposed',
      currentness: dependency.state === 'satisfied' ? 'current' : 'future',
      title: dependency.title,
      rationale: dependency.rationale,
      origin: dependency.origin,
      evidenceIds: dependency.evidenceIds,
      evidencePaths: [],
      confidence: dependency.confidence,
      humanReviewState: dependency.humanReviewState,
      universeMappings: [],
      limitations: dependency.limitations,
      unavailableInformation: dependency.state === 'unknown' ? ['Dependency satisfaction cannot be established.'] : [],
      capabilityId: dependency.capabilityId,
    }));
  }
  return uniqueBy(nodes, item => item.id).sort((left, right) => left.id.localeCompare(right.id));
}

function buildEdges(
  candidates: readonly RepositoryFutureNormalizedCandidate[],
  dependencies: readonly RepositoryFutureDependency[],
  definitions: readonly RepositoryFutureDependencyDefinition[],
  conflicts: readonly RepositoryFutureConflict[],
  nodes: readonly RepositoryFutureNode[],
) {
  const edges: RepositoryFutureEdge[] = [];
  const nodeIds = new Set(nodes.map(node => node.id));
  const candidateByGoalId = new Map(candidates.map(candidate => [goalNodeId(candidate.id), candidate]));
  const dependencyByCapability = new Map(dependencies.map(item => [item.capabilityId, item]));
  for (const candidate of candidates) {
    for (const mapping of candidate.universeMappings) {
      const source = currentReferenceNodeId(mapping.universeNodeId);
      if (nodeIds.has(source)) edges.push(edge(source, goalNodeId(candidate.id), 'supports', candidate.origin, candidate.confidence, candidate.evidence.map(item => item.id), []));
    }
    for (const dependency of candidate.dependencies) {
      const target = dependencyNodeId(dependency.capabilityId);
      if (nodeIds.has(target)) edges.push(edge(goalNodeId(candidate.id), target, 'requires', dependency.origin, dependency.confidence, dependency.evidenceIds, dependency.limitations));
    }
    for (const artifact of candidate.expectedArtifacts) {
      edges.push(edge(goalNodeId(candidate.id), artifactNodeId(artifact.id), 'produces', candidate.origin, candidate.confidence, candidate.evidence.map(item => item.id), artifact.limitations));
    }
    if (candidate.humanReviewState === 'required') {
      edges.push(edge(reviewGateNodeId(candidate.id), goalNodeId(candidate.id), 'gates', candidate.origin, candidate.confidence, candidate.evidence.map(item => item.id), []));
    }
  }
  for (const definition of definitions) {
    const sourceDependency = dependencyByCapability.get(definition.id);
    if (!sourceDependency) continue;
    for (const requiredId of definition.requires) {
      if (dependencyByCapability.has(requiredId)) {
        edges.push(edge(sourceDependency.id, dependencyNodeId(requiredId), 'requires', 'deterministic', sourceDependency.confidence, sourceDependency.evidenceIds, []));
      }
    }
  }
  for (const conflict of conflicts.filter(item => item.kind === 'goal-incompatibility' && item.affectedNodeIds.length === 2)) {
    const [left, right] = [...conflict.affectedNodeIds].sort();
    const candidate = candidateByGoalId.get(left) || candidateByGoalId.get(right);
    edges.push(edge(left, right, 'conflicts-with', candidate?.origin || 'deterministic', candidate?.confidence || 'low', conflict.evidenceIds, [conflict.rationale]));
  }
  return uniqueBy(edges, item => item.id).sort((left, right) => left.id.localeCompare(right.id));
}

function buildConflicts(
  candidates: readonly RepositoryFutureNormalizedCandidate[],
  dependencies: readonly RepositoryFutureDependency[],
  cycles: readonly RepositoryFutureDependencyCycle[],
  nodes: readonly RepositoryFutureNode[],
  input: BuildRepositoryFutureGraphInput,
) {
  const conflicts: RepositoryFutureConflict[] = [];
  const candidateByAnyId = new Map<string, RepositoryFutureNormalizedCandidate>();
  candidates.forEach(candidate => {
    candidateByAnyId.set(candidate.id, candidate);
    candidateByAnyId.set(candidate.sourceId, candidate);
  });
  for (const candidate of candidates) {
    const goalId = goalNodeId(candidate.id);
    if (!candidate.evidence.length) conflicts.push(conflict('insufficient-evidence', [goalId], [], [], 'No adequate evidence resolves for this future candidate.', true, 'Collect a complete compatible scan or choose another candidate.'));
    if (candidate.repositoryId !== input.repository.repositoryId) conflicts.push(conflict('foreign-repository', [goalId], [], candidate.evidence.map(item => item.id), 'Candidate belongs to another repository.', true, 'Rebuild the candidate from the active repository.'));
    if (candidate.sourceScanId !== input.repository.sourceScanId) conflicts.push(conflict('foreign-scan', [goalId], [], candidate.evidence.map(item => item.id), 'Candidate belongs to another source scan.', true, 'Rebuild the graph from one source scan.'));
    if (candidate.sourceScanFingerprint !== input.repository.sourceScanFingerprint) conflicts.push(conflict('stale-identity', [goalId], [], candidate.evidence.map(item => item.id), 'Candidate source-scan fingerprint is stale.', true, 'Regenerate candidates from the active scan fingerprint.'));
    if (candidate.humanReviewState === 'required') conflicts.push(conflict('human-review-required', [goalId, reviewGateNodeId(candidate.id)], candidate.expectedArtifacts.flatMap(item => item.targetPath ? [item.targetPath] : []), candidate.evidence.map(item => item.id), 'Sensitive subject matter requires human review.', false, 'A qualified reviewer must inspect the evidence and later artifacts.'));
    for (const artifact of candidate.expectedArtifacts) {
      if (!artifact.supported) conflicts.push(conflict('unsupported-generator', [goalId, artifactNodeId(artifact.id)], artifact.targetPath ? [artifact.targetPath] : [], candidate.evidence.map(item => item.id), 'Expected artifact is not supported by the current generator contract.', true, 'Remove the unsupported artifact expectation or map it to a supported generator.'));
      if (artifact.limitations.some(item => /unsafe or non-repository-relative artifact destination/i.test(item))) {
        conflicts.push(conflict('unsafe-sensitive-target', [goalId, artifactNodeId(artifact.id)], [], candidate.evidence.map(item => item.id), 'Artifact destination is unsafe or not repository-relative.', true, 'Choose a validated repository-relative destination before synthesis.'));
      }
      if (artifact.targetPath && sensitiveFutureContent([artifact.targetPath])) conflicts.push(conflict('unsafe-sensitive-target', [goalId, artifactNodeId(artifact.id)], [artifact.targetPath], candidate.evidence.map(item => item.id), 'Artifact target is sensitive and requires review.', false, 'Require explicit human review before any later preparation.'));
    }
    for (const incompatibleId of candidate.incompatibleCandidateIds) {
      const other = candidateByAnyId.get(incompatibleId);
      if (!other || other.id === candidate.id) continue;
      conflicts.push(conflict('goal-incompatibility', [goalId, goalNodeId(other.id)], [], sortedUnique([...candidate.evidence.map(item => item.id), ...other.evidence.map(item => item.id)]), 'Candidate compatibility metadata marks these goals incompatible.', true, 'Choose one goal and retain the other for later.'));
    }
  }
  const artifactGroups = new Map<string, Array<{ candidate: RepositoryFutureNormalizedCandidate; artifact: RepositoryFutureNormalizedCandidate['expectedArtifacts'][number] }>>();
  for (const candidate of candidates) {
    for (const artifact of candidate.expectedArtifacts) {
      const path = normalizeRepositoryFuturePath(artifact.targetPath);
      if (!path) continue;
      const group = artifactGroups.get(path.toLowerCase()) || [];
      group.push({ candidate, artifact });
      artifactGroups.set(path.toLowerCase(), group);
    }
  }
  for (const group of artifactGroups.values()) {
    if (group.length < 2) continue;
    const actions = new Set(group.map(item => item.artifact.action).filter(Boolean));
    const contentFingerprints = new Set(group.map(item => item.artifact.contentFingerprint).filter(Boolean));
    const affectedNodes = sortedUnique(group.flatMap(item => [goalNodeId(item.candidate.id), artifactNodeId(item.artifact.id)]));
    const paths = sortedUnique(group.flatMap(item => item.artifact.targetPath ? [item.artifact.targetPath] : []));
    const evidenceIds = sortedUnique(group.flatMap(item => item.candidate.evidence.map(evidence => evidence.id)));
    if (actions.size > 1) conflicts.push(conflict('action-mismatch', affectedNodes, paths, evidenceIds, 'Candidates require contradictory actions for the same artifact target.', true, 'Select a single compatible action before synthesis.'));
    if (contentFingerprints.size > 1) conflicts.push(conflict('artifact-target-collision', affectedNodes, paths, evidenceIds, 'Candidates carry divergent content identities for the same artifact target.', true, 'Resolve the content identity collision before synthesis.'));
  }
  for (const cycle of cycles) {
    conflicts.push(conflict('dependency-cycle', [...cycle.affectedGoalIds, ...cycle.dependencyIds], [], [], cycle.rationale, true, 'Change the supported dependency definitions or choose a future without this complete cycle.'));
  }
  for (const dependency of dependencies.filter(item => item.state === 'blocked' || item.state === 'stale')) {
    conflicts.push(conflict('dependency-contradiction', [dependency.id, ...dependency.dependentGoalIds], [], dependency.evidenceIds, `Dependency ${dependency.title} is ${dependency.state}.`, true, 'Resolve or replace the requiring future goal.'));
  }
  const validNodeIds = new Set(nodes.map(node => node.id));
  return uniqueBy(conflicts.map(item => ({
    ...item,
    affectedNodeIds: item.affectedNodeIds.filter(id => validNodeIds.has(id)).sort(),
  })), item => item.id).sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeGraphCandidates(candidates: readonly RepositoryFutureNormalizedCandidate[], input: BuildRepositoryFutureGraphInput) {
  return uniqueBy([...candidates].sort((left, right) => left.id.localeCompare(right.id) || left.contentFingerprint.localeCompare(right.contentFingerprint)), item => item.id)
    .map(candidate => {
      const mismatched = candidate.repositoryId !== input.repository.repositoryId
        || candidate.sourceScanId !== input.repository.sourceScanId
        || candidate.sourceScanFingerprint !== input.repository.sourceScanFingerprint;
      if (!mismatched) return candidate;
      const core = {
        ...candidate,
        eligibility: 'blocked' as const,
        fit: 'blocked' as const,
        limitations: sortedUnique([...candidate.limitations, 'Candidate identity does not match the active repository scan binding.']),
      };
      return { ...core, contentFingerprint: repositoryFutureFingerprint({ ...core, contentFingerprint: undefined }) };
    });
}

function node(input: Omit<RepositoryFutureNode, 'schemaVersion' | 'contentFingerprint'>): RepositoryFutureNode {
  const core = {
    ...input,
    evidenceIds: sortedUnique(input.evidenceIds),
    evidencePaths: sortedUnique(input.evidencePaths.map(normalizeRepositoryFuturePath).filter(Boolean)),
    universeMappings: [...input.universeMappings].sort((left, right) => left.universeNodeId.localeCompare(right.universeNodeId)),
    limitations: sortedUnique(input.limitations),
    unavailableInformation: sortedUnique(input.unavailableInformation),
  };
  return { ...core, schemaVersion: REPOSITORY_FUTURE_GRAPH_VERSION, contentFingerprint: repositoryFutureFingerprint(core) };
}

function edge(
  rawSource: string,
  rawTarget: string,
  relation: RepositoryFutureEdge['relation'],
  origin: RepositoryFutureEdge['origin'],
  confidence: RepositoryFutureEdge['confidence'],
  evidenceIds: string[],
  limitations: string[],
): RepositoryFutureEdge {
  const [source, target] = relation === 'conflicts-with' ? [rawSource, rawTarget].sort() : [rawSource, rawTarget];
  const core = {
    source,
    target,
    relation,
    origin,
    confidence,
    evidenceIds: sortedUnique(evidenceIds),
    lifecycle: 'proposed' as const,
    limitations: sortedUnique(limitations),
  };
  return {
    id: repositoryFutureId('future-edge', { source, target, relation }),
    ...core,
    fingerprint: repositoryFutureFingerprint(core),
  };
}

function conflict(
  kind: RepositoryFutureConflictKind,
  affectedNodeIds: string[],
  affectedPaths: string[],
  evidenceIds: string[],
  rationale: string,
  blocking: boolean,
  recovery: string,
): RepositoryFutureConflict {
  const core = {
    kind,
    severity: blocking ? 'blocking' as const : 'review' as const,
    affectedNodeIds: sortedUnique(affectedNodeIds),
    affectedPaths: sortedUnique(affectedPaths.map(normalizeRepositoryFuturePath).filter(Boolean)),
    evidenceIds: sortedUnique(evidenceIds),
    rationale,
    blocking,
    recovery,
  };
  return {
    id: repositoryFutureId('future-conflict', core),
    ...core,
    fingerprint: repositoryFutureFingerprint(core),
  };
}

function normalizeDefinitions(definitions: readonly RepositoryFutureDependencyDefinition[]) {
  return uniqueBy(definitions.map(item => ({
    id: item.id.trim(),
    title: item.title.trim(),
    rationale: item.rationale.trim(),
    requires: sortedUnique(item.requires.map(value => value.trim())),
  })).filter(item => item.id), item => item.id).sort((left, right) => left.id.localeCompare(right.id));
}

function dependencyState(states: ReadonlySet<RepositoryFutureDependency['state']>, humanReviewRequired: boolean): RepositoryFutureDependency['state'] {
  if (states.has('blocked')) return 'blocked';
  if (states.has('stale')) return 'stale';
  if (humanReviewRequired || states.has('review-required')) return 'review-required';
  if (states.has('satisfied')) return 'satisfied';
  if (states.has('missing')) return 'missing';
  return 'unknown';
}

function evidenceQualityRank(candidate: RepositoryFutureNormalizedCandidate) {
  const observed = candidate.evidence.filter(item => item.state === 'observed-current' || item.state === 'verified-signal').length;
  return observed * 100 + candidate.evidence.length * 10 + confidenceRank(candidate.confidence);
}

function dependencySatisfiabilityRank(candidate: RepositoryFutureNormalizedCandidate) {
  if (candidate.dependencies.some(item => item.state === 'blocked' || item.state === 'stale')) return 0;
  if (candidate.dependencies.some(item => item.state === 'unknown')) return 1;
  return 2;
}

function supportedArtifactRank(candidate: RepositoryFutureNormalizedCandidate) {
  return candidate.expectedArtifacts.filter(item => item.supported).length;
}

function canonicalCycle(values: string[]) {
  if (!values.length) return values;
  const rotations = values.map((_, index) => [...values.slice(index), ...values.slice(0, index)]);
  return rotations.sort((left, right) => left.join('>').localeCompare(right.join('>')))[0];
}

function currentReferenceNodeId(universeNodeId: string) {
  return `future-current:${universeNodeId}`;
}

function goalNodeId(candidateId: string) {
  return `future-goal:${candidateId}`;
}

function dependencyNodeId(capabilityId: string) {
  return `future-capability:${capabilityId}`;
}

function artifactNodeId(artifactId: string) {
  return `future-artifact:${artifactId}`;
}

function reviewGateNodeId(candidateId: string) {
  return `future-gate:human-review:${candidateId}`;
}

function uniqueBy<T>(values: readonly T[], identity: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter(value => {
    const id = identity(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

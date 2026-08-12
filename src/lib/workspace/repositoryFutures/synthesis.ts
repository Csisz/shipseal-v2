import {
  buildRepositoryFutureCompatibilityMatrix,
  createRepositoryFutureGraphIndex,
  inspectRepositoryFutureCandidateCompatibility,
  relevantSelectedConflicts,
  type RepositoryFutureGraphIndex,
} from './compatibility.js';
import {
  REPOSITORY_FUTURE_DRAFT_VERSION,
  REPOSITORY_FUTURE_SYNTHESIS_VERSION,
  type RepositoryFutureDependencyExclusionResult,
  type RepositoryFutureDependencyImpact,
  type RepositoryFutureDraft,
  type RepositoryFutureDraftDependency,
  type RepositoryFutureDraftGoal,
  type RepositoryFutureDraftOperationResult,
  type RepositoryFutureDraftSelection,
  type RepositoryFutureExcludedCandidate,
  type RepositoryFutureExclusionReason,
  type RepositoryFutureHumanReviewRequirement,
  type RepositoryFutureQuickPathModel,
  type RepositoryFutureSavedAlternative,
  type RepositoryFutureSynthesisFailureCode,
  type RepositoryFutureSynthesisIssue,
  type RepositoryFutureSynthesisResult,
  type RepositoryFutureTradeOff,
} from './draft.js';
import { compareRepositoryFutureCandidates } from './graph.js';
import { repositoryFutureFingerprint, repositoryFutureId, sortedUnique } from './identity.js';
import {
  rankRepositoryFuturePrimaryCandidates,
  rankRepositoryFutureSupportingCandidates,
} from './ranking.js';
import type {
  RepositoryFutureConflict,
  RepositoryFutureDependency,
  RepositoryFutureGraph,
  RepositoryFutureNode,
  RepositoryFutureNormalizedCandidate,
} from './schema.js';

interface DependencyClosureResult {
  dependencies: RepositoryFutureDraftDependency[];
  executionOrder: string[];
  issues: RepositoryFutureSynthesisIssue[];
}

export function synthesizeRepositoryFutureDraft(
  graph: RepositoryFutureGraph,
  selection: RepositoryFutureDraftSelection,
): RepositoryFutureSynthesisResult {
  const index = createRepositoryFutureGraphIndex(graph);
  const selectionIssues = validateSelection(graph, selection, index);
  if (selectionIssues.length) return failure(graph, failureCode(selectionIssues), selectionIssues);

  const primaryGoalId = selection.primaryGoalIds[0];
  const supportingGoalIds = sortedUnique(selection.supportingGoalIds);
  const selectedGoalIds = [primaryGoalId, ...supportingGoalIds];
  const savedGoalIds = sortedUnique(selection.savedGoalIds || []).filter(goalId => !selectedGoalIds.includes(goalId));
  const closure = buildDependencyClosure(graph, selectedGoalIds, index);
  if (closure.issues.length) return failure(graph, failureCode(closure.issues), closure.issues);

  const dependencyIds = new Set(closure.dependencies.map(item => item.id));
  const conflicts = relevantSelectedConflicts(graph, selectedGoalIds, dependencyIds, index);
  const blockingConflicts = conflicts.filter(item => item.blocking);
  if (blockingConflicts.length) {
    return failure(graph, blockingConflicts.some(item => item.kind === 'dependency-cycle') ? 'dependency-cycle' : 'blocking-conflict', blockingConflicts.map(conflictIssue));
  }

  const primaryCandidate = index.candidateByGoalId.get(primaryGoalId);
  if (!primaryCandidate) return failure(graph, 'invalid-selection', [unknownGoalIssue(primaryGoalId)]);
  const supportingCandidates = supportingGoalIds.map(goalId => index.candidateByGoalId.get(goalId)).filter((candidate): candidate is RepositoryFutureNormalizedCandidate => Boolean(candidate));
  const compatibilityMatrix = buildRepositoryFutureCompatibilityMatrix(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [primaryGoalId],
    supportingGoalIds,
  }, index);
  const selectedCandidates = [primaryCandidate, ...supportingCandidates];
  const primaryGoal = draftGoal(primaryGoalId, primaryCandidate, index);
  const supportingGoals = supportingGoalIds.flatMap(goalId => {
    const candidate = index.candidateByGoalId.get(goalId);
    return candidate ? [draftGoal(goalId, candidate, index)] : [];
  });
  const artifacts = selectedNodes(graph, selectedCandidates, 'artifact');
  const gates = selectedNodes(graph, selectedCandidates, 'gate');
  const humanReviewRequirements = buildHumanReviewRequirements(selectedGoalIds, selectedCandidates, closure.dependencies, artifacts, gates, conflicts);
  const savedAlternatives = buildSavedAlternatives(graph, selectedGoalIds, compatibilityMatrix, index, new Set(savedGoalIds));
  const excludedCandidates = buildExcludedCandidates(graph, selectedGoalIds, compatibilityMatrix, index);
  const tradeOffs = buildTradeOffs(selectedGoalIds, selectedCandidates, closure.dependencies, artifacts, gates, conflicts);
  const limitations = sortedUnique([
    ...graph.limitations,
    ...selectedCandidates.flatMap(candidate => [...candidate.limitations, ...candidate.unavailableInformation]),
    ...closure.dependencies.flatMap(dependency => dependency.limitations),
  ]);
  const preparationReadiness = humanReviewRequirements.length ? 'review-required' as const : 'ready' as const;
  const compatibilityState = humanReviewRequirements.length ? 'compatible-with-review' as const : 'compatible' as const;
  const executionOrder = [...closure.executionOrder, ...supportingGoalIds, primaryGoalId];
  const core = {
    schemaVersion: REPOSITORY_FUTURE_DRAFT_VERSION,
    synthesisVersion: REPOSITORY_FUTURE_SYNTHESIS_VERSION,
    sourceGraphFingerprint: graph.fingerprint,
    sourceRepository: graph.repository,
    primaryGoal,
    supportingGoals,
    savedGoalIds,
    dependencies: closure.dependencies,
    dependencyExecutionOrder: closure.executionOrder,
    executionOrder,
    compatibilityState,
    compatibilityMatrix,
    conflicts,
    savedAlternatives,
    excludedCandidates,
    tradeOffs,
    artifacts,
    gates,
    humanReviewRequirements,
    preparationReadiness,
    limitations,
  };
  const fingerprint = repositoryFutureFingerprint(core);
  return {
    ok: true,
    draft: {
      ...core,
      id: repositoryFutureId('future-draft', fingerprint),
      fingerprint,
    },
  };
}

export function replaceRepositoryFuturePrimary(
  graph: RepositoryFutureGraph,
  draft: RepositoryFutureDraft,
  newPrimaryGoalId: string,
): RepositoryFutureDraftOperationResult {
  const baseSelection: RepositoryFutureDraftSelection = {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [newPrimaryGoalId],
    supportingGoalIds: [],
    savedGoalIds: draft.savedGoalIds.filter(goalId => goalId !== newPrimaryGoalId),
  };
  const baseResult = synthesizeRepositoryFutureDraft(graph, baseSelection);
  if (!baseResult.ok) return { result: baseResult, removedGoalIds: [] };
  const retained: string[] = [];
  const removed: string[] = [];
  for (const goalId of draft.supportingGoals.map(goal => goal.goalId).filter(goalId => goalId !== newPrimaryGoalId).sort()) {
    const nextSelection = { ...baseSelection, supportingGoalIds: [...retained] };
    const compatibility = inspectRepositoryFutureCandidateCompatibility(graph, nextSelection, goalId);
    if (compatibility.state === 'compatible' || compatibility.state === 'compatible-with-review') retained.push(goalId);
    else removed.push(goalId);
  }
  return {
    result: synthesizeRepositoryFutureDraft(graph, { ...baseSelection, supportingGoalIds: retained }),
    removedGoalIds: sortedUnique(removed),
  };
}

export function addRepositoryFutureSupportingGoal(
  graph: RepositoryFutureGraph,
  draft: RepositoryFutureDraft,
  supportingGoalId: string,
): RepositoryFutureSynthesisResult {
  return synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [draft.primaryGoal.goalId],
    supportingGoalIds: [...draft.supportingGoals.map(goal => goal.goalId), supportingGoalId],
    savedGoalIds: draft.savedGoalIds.filter(goalId => goalId !== supportingGoalId),
  });
}

export function removeRepositoryFutureSupportingGoal(
  graph: RepositoryFutureGraph,
  draft: RepositoryFutureDraft,
  supportingGoalId: string,
): RepositoryFutureSynthesisResult {
  if (!draft.supportingGoals.some(goal => goal.goalId === supportingGoalId)) {
    return failure(graph, 'invalid-selection', [{
      code: 'invalid-selection',
      goalIds: [supportingGoalId],
      conflictIds: [],
      dependencyIds: [],
      reason: 'Supporting goal is not selected in this draft.',
      recovery: 'Choose a currently selected supporting goal.',
    }]);
  }
  return synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [draft.primaryGoal.goalId],
    supportingGoalIds: draft.supportingGoals.map(goal => goal.goalId).filter(goalId => goalId !== supportingGoalId),
    savedGoalIds: draft.savedGoalIds,
  });
}

export function saveRepositoryFutureAlternative(
  graph: RepositoryFutureGraph,
  draft: RepositoryFutureDraft,
  goalId: string,
): RepositoryFutureSynthesisResult {
  if (draft.primaryGoal.goalId === goalId || draft.supportingGoals.some(goal => goal.goalId === goalId)) {
    return failure(graph, 'invalid-selection', [{
      code: 'invalid-selection',
      goalIds: [goalId],
      conflictIds: [],
      dependencyIds: [],
      reason: 'An active Future goal cannot be saved for later.',
      recovery: 'Remove or replace the active goal before saving it.',
    }]);
  }
  return synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [draft.primaryGoal.goalId],
    supportingGoalIds: draft.supportingGoals.map(goal => goal.goalId),
    savedGoalIds: [...draft.savedGoalIds, goalId],
  });
}

export function restoreRepositoryFutureAlternative(
  graph: RepositoryFutureGraph,
  draft: RepositoryFutureDraft,
  goalId: string,
): RepositoryFutureSynthesisResult {
  if (!draft.savedGoalIds.includes(goalId)) {
    return failure(graph, 'invalid-selection', [{
      code: 'invalid-selection',
      goalIds: [goalId],
      conflictIds: [],
      dependencyIds: [],
      reason: 'Future goal is not explicitly saved for later.',
      recovery: 'Choose a currently saved Future goal.',
    }]);
  }
  return synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [draft.primaryGoal.goalId],
    supportingGoalIds: draft.supportingGoals.map(goal => goal.goalId),
    savedGoalIds: draft.savedGoalIds.filter(savedGoalId => savedGoalId !== goalId),
  });
}

export function inspectRepositoryFutureDependencyImpact(
  draft: RepositoryFutureDraft,
  dependencyId: string,
): RepositoryFutureDependencyImpact | undefined {
  const dependency = draft.dependencies.find(item => item.id === dependencyId);
  if (!dependency) return undefined;
  const directDependentGoalIds = sortedUnique(dependency.causeChains.filter(chain => chain.length === 2).map(chain => chain[0]));
  const requiredByPrimary = dependency.causeChains.some(chain => chain[0] === draft.primaryGoal.goalId);
  const selectedSupportingIds = new Set(draft.supportingGoals.map(goal => goal.goalId));
  const removableSupportingGoalIds = sortedUnique(dependency.dependentGoalIds.filter(goalId => selectedSupportingIds.has(goalId)));
  return {
    dependencyId,
    capabilityId: dependency.capabilityId,
    state: dependency.state,
    directDependentGoalIds,
    causeChains: dependency.causeChains.map(chain => [...chain]),
    evidenceIds: [...dependency.evidenceIds],
    humanReviewState: dependency.humanReviewState,
    requiredByPrimary,
    removableByRemovingSupportingGoals: !requiredByPrimary && removableSupportingGoalIds.length > 0,
    removableSupportingGoalIds,
  };
}

export function requestRepositoryFutureDependencyExclusion(
  draft: RepositoryFutureDraft,
  dependencyId: string,
): RepositoryFutureDependencyExclusionResult {
  const dependency = draft.dependencies.find(item => item.id === dependencyId);
  if (!dependency) return { allowed: true, dependencyId, dependentGoalIds: [], reason: 'Dependency is not required by this draft.' };
  return {
    allowed: false,
    dependencyId,
    dependentGoalIds: [...dependency.dependentGoalIds],
    reason: 'Required dependencies are derived from selected goals and cannot be removed independently.',
  };
}

export function buildRepositoryFutureQuickPathModel(
  graph: RepositoryFutureGraph,
  draft?: RepositoryFutureDraft,
): RepositoryFutureQuickPathModel {
  const primaryRecommendations = rankRepositoryFuturePrimaryCandidates(graph);
  if (!draft) {
    return {
      sourceGraphFingerprint: graph.fingerprint,
      primaryRecommendations,
      supportingRecommendations: [],
      selectedSupportingGoals: [],
      automaticDependencies: [],
      compatibilityMatrix: [],
      tradeOffs: [],
      humanReviewRequirements: [],
      conflicts: [],
      savedAlternatives: [],
      draftValidity: 'unselected',
    };
  }
  const selectedSupportingIds = new Set(draft.supportingGoals.map(goal => goal.goalId));
  const remainingSlots = Math.max(0, 2 - selectedSupportingIds.size);
  return {
    sourceGraphFingerprint: graph.fingerprint,
    primaryRecommendations,
    selectedPrimary: draft.primaryGoal,
    supportingRecommendations: rankRepositoryFutureSupportingCandidates(graph, draft.primaryGoal.goalId, 2)
      .filter(item => !selectedSupportingIds.has(item.goalId))
      .slice(0, remainingSlots),
    selectedSupportingGoals: draft.supportingGoals.map(goal => ({ ...goal })),
    automaticDependencies: draft.dependencies.map(dependency => ({ ...dependency, causeChains: dependency.causeChains.map(chain => [...chain]) })),
    compatibilityMatrix: draft.compatibilityMatrix.map(item => ({ ...item })),
    tradeOffs: draft.tradeOffs.map(item => ({ ...item })),
    humanReviewRequirements: draft.humanReviewRequirements.map(item => ({ ...item })),
    conflicts: draft.conflicts.map(item => ({ ...item })),
    savedAlternatives: draft.savedAlternatives.map(item => ({ ...item })),
    draftValidity: draft.preparationReadiness === 'review-required' ? 'review-required' : draft.preparationReadiness === 'blocked' ? 'blocked' : 'valid',
  };
}

function validateSelection(
  graph: RepositoryFutureGraph,
  selection: RepositoryFutureDraftSelection,
  index: RepositoryFutureGraphIndex,
) {
  const issues: RepositoryFutureSynthesisIssue[] = [];
  if (selection.sourceGraphFingerprint !== graph.fingerprint) issues.push({
    code: 'invalid-graph-binding',
    goalIds: [],
    conflictIds: [],
    dependencyIds: [],
    reason: 'Selection source graph fingerprint does not match the active Future Graph.',
    recovery: 'Recreate the selection from the active graph.',
  });
  if (selection.primaryGoalIds.length !== 1) issues.push({
    code: 'invalid-primary-count',
    goalIds: sortedUnique(selection.primaryGoalIds),
    conflictIds: [],
    dependencyIds: [],
    reason: 'A Future draft requires exactly one primary goal.',
    recovery: 'Select exactly one eligible primary goal.',
  });
  if (selection.supportingGoalIds.length > 2) issues.push({
    code: 'support-limit-exceeded',
    goalIds: sortedUnique(selection.supportingGoalIds),
    conflictIds: [],
    dependencyIds: [],
    reason: 'A Future draft allows at most two supporting goals.',
    recovery: 'Remove a supporting goal or save it for later.',
  });
  const allGoalIds = [...selection.primaryGoalIds, ...selection.supportingGoalIds];
  if (new Set(allGoalIds).size !== allGoalIds.length) issues.push({
    code: 'duplicate-selection',
    goalIds: sortedUnique(allGoalIds.filter((goalId, goalIndex) => allGoalIds.indexOf(goalId) !== goalIndex)),
    conflictIds: [],
    dependencyIds: [],
    reason: 'Primary and supporting selections must be distinct.',
    recovery: 'Remove duplicate goal selections.',
  });
  for (const savedGoalId of sortedUnique(selection.savedGoalIds || [])) {
    if (!index.candidateByGoalId.has(savedGoalId)) issues.push(unknownGoalIssue(savedGoalId));
    if (allGoalIds.includes(savedGoalId)) issues.push({
      code: 'duplicate-selection',
      goalIds: [savedGoalId],
      conflictIds: [],
      dependencyIds: [],
      reason: 'An active Future goal cannot also be saved for later.',
      recovery: 'Keep the goal active or save it, but not both.',
    });
  }
  for (const goalId of sortedUnique(allGoalIds)) {
    const candidate = index.candidateByGoalId.get(goalId);
    if (!candidate) {
      issues.push(unknownGoalIssue(goalId));
      continue;
    }
    const compatibility = inspectRepositoryFutureCandidateCompatibility(graph, {
      sourceGraphFingerprint: graph.fingerprint,
      primaryGoalIds: [],
      supportingGoalIds: [],
    }, goalId, index);
    if (compatibility.state === 'blocked') {
      const conflictKinds = graph.conflicts.filter(conflict => compatibility.conflictIds.includes(conflict.id)).map(conflict => conflict.kind);
      issues.push({
      code: conflictKinds.includes('dependency-cycle') ? 'dependency-cycle' : 'ineligible-goal',
      goalIds: [goalId],
      conflictIds: compatibility.conflictIds,
      dependencyIds: [],
      reason: compatibility.reasons.join(' '),
      recovery: 'Resolve the candidate blockers or choose another eligible goal.',
      });
    }
  }
  if (!issues.length && selection.primaryGoalIds.length === 1) {
    const acceptedSupports: string[] = [];
    for (const goalId of selection.supportingGoalIds) {
      const compatibility = inspectRepositoryFutureCandidateCompatibility(graph, {
        sourceGraphFingerprint: graph.fingerprint,
        primaryGoalIds: selection.primaryGoalIds,
        supportingGoalIds: acceptedSupports,
      }, goalId, index);
      if (compatibility.state !== 'compatible' && compatibility.state !== 'compatible-with-review') issues.push({
        code: compatibility.state === 'blocked' ? 'ineligible-goal' : 'blocking-conflict',
        goalIds: [goalId, ...compatibility.affectedSelectedGoalIds],
        conflictIds: compatibility.conflictIds,
        dependencyIds: [],
        reason: compatibility.reasons.join(' '),
        recovery: 'Remove or replace the incompatible supporting goal.',
      });
      else acceptedSupports.push(goalId);
    }
  }
  return sortIssues(issues);
}

function buildDependencyClosure(
  graph: RepositoryFutureGraph,
  selectedGoalIds: string[],
  index: RepositoryFutureGraphIndex,
): DependencyClosureResult {
  const dependencyByCapability = new Map(graph.dependencies.map(dependency => [dependency.capabilityId, dependency]));
  const dependencyById = new Map(graph.dependencies.map(dependency => [dependency.id, dependency]));
  const requiredTargets = new Map<string, string[]>();
  for (const edge of graph.edges.filter(edge => edge.relation === 'requires')) {
    const targets = requiredTargets.get(edge.source) || [];
    targets.push(edge.target);
    requiredTargets.set(edge.source, sortedUnique(targets));
  }
  const dependentGoals = new Map<string, Set<string>>();
  const causeChains = new Map<string, Map<string, string[]>>();
  const closureIds = new Set<string>();
  const issues: RepositoryFutureSynthesisIssue[] = [];

  function walk(goalId: string, dependencyId: string, chain: string[], visiting: Set<string>) {
    if (visiting.has(dependencyId)) {
      const cycleStart = chain.indexOf(dependencyId);
      const dependencyIds = sortedUnique(cycleStart >= 0 ? chain.slice(cycleStart) : [...chain, dependencyId]);
      issues.push({
        code: 'dependency-cycle',
        goalIds: [goalId],
        conflictIds: graph.dependencyCycles.filter(cycle => cycle.dependencyIds.some(id => dependencyIds.includes(id))).map(cycle => cycle.id),
        dependencyIds,
        reason: `Required dependency cycle detected: ${dependencyIds.join(' → ')}.`,
        recovery: 'Change the selected goal or resolve the supported dependency definition; no edge was removed automatically.',
      });
      return;
    }
    const dependency = dependencyById.get(dependencyId);
    if (!dependency) {
      issues.push(unsupportedDependencyIssue(goalId, dependencyId));
      return;
    }
    closureIds.add(dependencyId);
    const goals = dependentGoals.get(dependencyId) || new Set<string>();
    goals.add(goalId);
    dependentGoals.set(dependencyId, goals);
    const fullChain = [goalId, ...chain, dependencyId];
    const chains = causeChains.get(dependencyId) || new Map<string, string[]>();
    chains.set(fullChain.join('>'), fullChain);
    causeChains.set(dependencyId, chains);
    if (dependency.state === 'unknown' || dependency.state === 'blocked' || dependency.state === 'stale') {
      issues.push({
        code: 'unsupported-dependency',
        goalIds: [goalId],
        conflictIds: graph.conflicts.filter(conflict => conflict.affectedNodeIds.includes(dependencyId)).map(conflict => conflict.id),
        dependencyIds: [dependencyId],
        reason: `Required dependency ${dependency.title} is ${dependency.state}.`,
        recovery: 'Resolve the dependency state or choose another future goal.',
      });
    }
    const nextVisiting = new Set(visiting);
    nextVisiting.add(dependencyId);
    for (const requiredId of requiredTargets.get(dependencyId) || []) walk(goalId, requiredId, [...chain, dependencyId], nextVisiting);
  }

  for (const goalId of selectedGoalIds) {
    const candidate = index.candidateByGoalId.get(goalId);
    if (!candidate) continue;
    for (const dependencyHint of candidate.dependencies.filter(item => item.requirement === 'required').sort((left, right) => left.capabilityId.localeCompare(right.capabilityId))) {
      const dependency = dependencyByCapability.get(dependencyHint.capabilityId);
      if (!dependency) issues.push(unsupportedDependencyIssue(goalId, dependencyHint.capabilityId));
      else walk(goalId, dependency.id, [], new Set());
    }
  }

  for (const cycle of graph.dependencyCycles.filter(cycle => cycle.dependencyIds.some(id => closureIds.has(id)))) {
    issues.push({
      code: 'dependency-cycle',
      goalIds: cycle.affectedGoalIds.filter(goalId => selectedGoalIds.includes(goalId)),
      conflictIds: graph.conflicts.filter(conflict => conflict.kind === 'dependency-cycle' && conflict.affectedNodeIds.some(nodeId => cycle.dependencyIds.includes(nodeId))).map(conflict => conflict.id),
      dependencyIds: [...cycle.dependencyIds],
      reason: cycle.rationale,
      recovery: 'Change the selected goal or resolve the supported dependency definitions; synthesis never removes a cycle edge arbitrarily.',
    });
  }
  const sortedIssues = sortIssues(issues);
  if (sortedIssues.length) return { dependencies: [], executionOrder: [], issues: sortedIssues };

  const executionOrder = topologicalDependencyOrder(closureIds, requiredTargets);
  const dependencies = executionOrder.flatMap((dependencyId, order) => {
    const dependency = dependencyById.get(dependencyId);
    if (!dependency) return [];
    return [{
      id: dependency.id,
      capabilityId: dependency.capabilityId,
      title: dependency.title,
      state: dependency.state,
      origin: dependency.origin,
      rationale: dependency.rationale,
      evidenceIds: [...dependency.evidenceIds],
      confidence: dependency.confidence,
      dependentGoalIds: [...(dependentGoals.get(dependencyId) || [])].sort(),
      causeChains: [...(causeChains.get(dependencyId)?.values() || [])].sort(compareChains),
      humanReviewState: dependency.humanReviewState,
      limitations: [...dependency.limitations],
      sourceFingerprint: dependency.fingerprint,
      executionOrder: order,
    }];
  });
  return { dependencies, executionOrder, issues: [] };
}

function topologicalDependencyOrder(closureIds: ReadonlySet<string>, requiredTargets: ReadonlyMap<string, string[]>) {
  const visited = new Set<string>();
  const ordered: string[] = [];
  function visit(dependencyId: string) {
    if (visited.has(dependencyId)) return;
    visited.add(dependencyId);
    for (const requiredId of requiredTargets.get(dependencyId) || []) if (closureIds.has(requiredId)) visit(requiredId);
    ordered.push(dependencyId);
  }
  for (const dependencyId of [...closureIds].sort()) visit(dependencyId);
  return ordered;
}

function draftGoal(goalId: string, candidate: RepositoryFutureNormalizedCandidate, index: RepositoryFutureGraphIndex): RepositoryFutureDraftGoal {
  const node = index.nodeById.get(goalId);
  return {
    goalId,
    candidateId: candidate.id,
    title: candidate.title,
    rationale: candidate.rationale,
    origin: candidate.origin,
    confidence: candidate.confidence,
    fit: candidate.fit,
    evidenceIds: candidate.evidence.map(item => item.id),
    evidencePaths: node?.evidencePaths || [],
    humanReviewState: candidate.humanReviewState,
    limitations: sortedUnique([...candidate.limitations, ...candidate.unavailableInformation]),
  };
}

function selectedNodes(
  graph: RepositoryFutureGraph,
  candidates: RepositoryFutureNormalizedCandidate[],
  kind: 'artifact' | 'gate',
) {
  const candidateIds = new Set(candidates.map(candidate => candidate.id));
  return graph.nodes.filter(node => node.kind === kind && node.candidateId && candidateIds.has(node.candidateId)).map(node => ({ ...node })).sort((left, right) => left.id.localeCompare(right.id));
}

function buildHumanReviewRequirements(
  selectedGoalIds: string[],
  candidates: RepositoryFutureNormalizedCandidate[],
  dependencies: RepositoryFutureDraftDependency[],
  artifacts: RepositoryFutureNode[],
  gates: RepositoryFutureNode[],
  conflicts: RepositoryFutureConflict[],
) {
  const requirements: RepositoryFutureHumanReviewRequirement[] = [];
  candidates.forEach((candidate, candidateIndex) => {
    if (candidate.humanReviewState === 'required') requirements.push(reviewRequirement(selectedGoalIds[candidateIndex], 'goal', candidate.rationale, candidate.evidence.map(item => item.id)));
  });
  dependencies.filter(item => item.humanReviewState === 'required' || item.state === 'review-required').forEach(item => requirements.push(reviewRequirement(item.id, 'dependency', item.rationale, item.evidenceIds)));
  artifacts.filter(item => item.humanReviewState === 'required').forEach(item => requirements.push(reviewRequirement(item.id, 'artifact', item.rationale, item.evidenceIds)));
  gates.filter(item => item.humanReviewState === 'required').forEach(item => requirements.push(reviewRequirement(item.id, 'gate', item.rationale, item.evidenceIds)));
  conflicts.filter(item => !item.blocking && item.severity === 'review').forEach(item => requirements.push(reviewRequirement(item.id, 'conflict', item.rationale, item.evidenceIds)));
  return [...new Map(requirements.map(item => [`${item.sourceKind}:${item.sourceId}`, item])).values()].sort((left, right) => left.sourceKind.localeCompare(right.sourceKind) || left.sourceId.localeCompare(right.sourceId));
}

function reviewRequirement(sourceId: string, sourceKind: RepositoryFutureHumanReviewRequirement['sourceKind'], rationale: string, evidenceIds: string[]): RepositoryFutureHumanReviewRequirement {
  return { sourceId, sourceKind, rationale, evidenceIds: sortedUnique(evidenceIds) };
}

function buildSavedAlternatives(
  graph: RepositoryFutureGraph,
  selectedGoalIds: string[],
  compatibilityMatrix: RepositoryFutureDraft['compatibilityMatrix'],
  index: RepositoryFutureGraphIndex,
  explicitlySavedGoalIds: Set<string>,
) {
  const selected = new Set(selectedGoalIds);
  return compatibilityMatrix.flatMap(compatibility => {
    if (selected.has(compatibility.goalId)) return [];
    const candidate = index.candidateByGoalId.get(compatibility.goalId);
    if (!candidate) return [];
    const supportLimit = compatibility.reasons.some(reason => /already has two supporting goals/i.test(reason));
    const viable = explicitlySavedGoalIds.has(compatibility.goalId)
      || compatibility.state === 'compatible'
      || compatibility.state === 'compatible-with-review'
      || candidate.eligibility === 'exploratory'
      || (supportLimit && candidate.eligibility === 'eligible');
    if (!viable) return [];
    const saved: RepositoryFutureSavedAlternative = {
      candidateId: candidate.id,
      goalId: compatibility.goalId,
      sourceGraphFingerprint: graph.fingerprint,
      title: candidate.title,
      rationale: candidate.rationale,
      origin: candidate.origin,
      fit: candidate.fit,
      evidence: candidate.evidence.map(item => ({ ...item })),
      compatibility: compatibility.state,
      compatibilityReasons: [...compatibility.reasons],
      conflictIds: [...compatibility.conflictIds],
      exclusionReasons: explicitlySavedGoalIds.has(compatibility.goalId)
        ? [...exclusionReasons(candidate, compatibility), 'saved-for-later']
        : exclusionReasons(candidate, compatibility),
      savedForLater: explicitlySavedGoalIds.has(compatibility.goalId),
      limitations: sortedUnique([...candidate.limitations, ...candidate.unavailableInformation]),
    };
    return [saved];
  }).sort((left, right) => {
    if (left.savedForLater !== right.savedForLater) return left.savedForLater ? -1 : 1;
    const rankDifference = savedRank(left) - savedRank(right);
    if (rankDifference) return rankDifference;
    const leftCandidate = index.candidateByGoalId.get(left.goalId);
    const rightCandidate = index.candidateByGoalId.get(right.goalId);
    return leftCandidate && rightCandidate
      ? compareRepositoryFutureCandidates(leftCandidate, rightCandidate)
      : left.goalId.localeCompare(right.goalId);
  });
}

function buildExcludedCandidates(
  graph: RepositoryFutureGraph,
  selectedGoalIds: string[],
  compatibilityMatrix: RepositoryFutureDraft['compatibilityMatrix'],
  index: RepositoryFutureGraphIndex,
) {
  const selected = new Set(selectedGoalIds);
  return compatibilityMatrix.flatMap(compatibility => {
    if (selected.has(compatibility.goalId)) return [];
    const candidate = index.candidateByGoalId.get(compatibility.goalId);
    if (!candidate) return [];
    const reasons = exclusionReasons(candidate, compatibility);
    if (!reasons.length) return [];
    const excluded: RepositoryFutureExcludedCandidate = {
      candidateId: candidate.id,
      goalId: compatibility.goalId,
      reasons,
      conflictIds: [...compatibility.conflictIds],
      rationale: [...compatibility.reasons],
    };
    return [excluded];
  }).sort((left, right) => left.goalId.localeCompare(right.goalId));
}

function exclusionReasons(
  candidate: RepositoryFutureNormalizedCandidate,
  compatibility: RepositoryFutureDraft['compatibilityMatrix'][number],
) {
  const reasons: RepositoryFutureExclusionReason[] = ['not-selected'];
  if (candidate.eligibility === 'blocked') reasons.push('blocked');
  if (candidate.eligibility === 'unsupported') reasons.push('unsupported');
  if (candidate.eligibility === 'exploratory') reasons.push('exploratory');
  if (compatibility.reasons.some(reason => /two supporting goals/i.test(reason))) reasons.push('support-limit-reached');
  if (compatibility.reasons.some(reason => /evidence/i.test(reason))) reasons.push('missing-required-evidence');
  if (compatibility.reasons.some(reason => /stale|repository or scan identity/i.test(reason))) reasons.push('stale-scope');
  if (compatibility.reasons.some(reason => /dependency cycle/i.test(reason))) reasons.push('dependency-cycle');
  if (compatibility.reasons.some(reason => /dependency/i.test(reason))) reasons.push('unsupported-dependency');
  if (compatibility.reasons.some(reason => /unsafe|sensitive target/i.test(reason))) reasons.push('unsafe-target');
  if (compatibility.reasons.some(reason => /artifact|action/i.test(reason))) reasons.push('artifact-collision');
  if (compatibility.state === 'incompatible') {
    reasons.push(compatibility.affectedSelectedGoalIds.length > 1 ? 'conflicts-with-support' : 'conflicts-with-primary');
  }
  return [...new Set(reasons)].sort();
}

function buildTradeOffs(
  selectedGoalIds: string[],
  candidates: RepositoryFutureNormalizedCandidate[],
  dependencies: RepositoryFutureDraftDependency[],
  artifacts: RepositoryFutureNode[],
  gates: RepositoryFutureNode[],
  conflicts: RepositoryFutureConflict[],
): RepositoryFutureTradeOff[] {
  const evidenceIds = sortedUnique(candidates.flatMap(candidate => candidate.evidence.map(item => item.id)));
  const unavailable = sortedUnique(candidates.flatMap(candidate => candidate.unavailableInformation));
  const reviewRequired = candidates.some(candidate => candidate.humanReviewState === 'required')
    || dependencies.some(dependency => dependency.humanReviewState === 'required' || dependency.state === 'review-required')
    || artifacts.some(artifact => artifact.humanReviewState === 'required')
    || gates.some(gate => gate.humanReviewState === 'required');
  const impactNodes = sortedUnique(candidates.flatMap(candidate => candidate.universeMappings.map(mapping => mapping.universeNodeId)));
  const changeUnits = artifacts.length + dependencies.filter(dependency => dependency.state !== 'satisfied').length + selectedGoalIds.length;
  const verificationMethods = candidates.filter(candidate => Boolean(candidate.verificationMethod)).length;
  const reviewConflicts = conflicts.filter(conflict => !conflict.blocking);
  return [
    tradeOff('impactBreadth', impactNodes.length > 3 || selectedGoalIds.length > 2 ? 'cross-cutting' : 'focused', impactNodes.length > 3 ? 'The selected goals map across several current repository entities.' : 'The selected goals remain bounded to a focused repository area.', evidenceIds, selectedGoalIds, []),
    tradeOff('changeWeight', changeUnits >= 8 ? 'broad' : changeUnits >= 4 ? 'moderate' : 'small', 'Change weight reflects selected goals, prospective artifacts and unsatisfied required capabilities; it is not an effort estimate.', evidenceIds, [...selectedGoalIds, ...artifacts.map(item => item.id), ...dependencies.map(item => item.id)], []),
    tradeOff('verificationBurden', reviewRequired || verificationMethods < candidates.length ? 'high' : gates.length || dependencies.some(item => item.state !== 'satisfied') ? 'moderate' : 'low', 'Verification burden reflects explicit methods, gates, dependency states and review requirements.', evidenceIds, [...gates.map(item => item.id), ...dependencies.map(item => item.id)], reviewConflicts.map(item => item.id)),
    tradeOff('reversibility', reviewRequired ? 'review-dependent' : artifacts.some(item => item.unavailableInformation.length) ? 'uncertain' : 'direct', reviewRequired ? 'Sensitive or reviewed changes require a human-controlled recovery decision.' : 'Reversibility is derived only from currently represented artifact and review boundaries.', evidenceIds, artifacts.map(item => item.id), []),
    tradeOff('humanReview', reviewRequired ? 'required' : 'none', reviewRequired ? 'One or more selected goals, dependencies, artifacts or gates require human review.' : 'No current graph contract marks the selected closure as review-required.', evidenceIds, selectedGoalIds, reviewConflicts.map(item => item.id)),
    tradeOff('knownConflicts', reviewConflicts.length ? 'moderate' : 'none', reviewConflicts.length ? 'Non-blocking review conflicts remain visible in the draft.' : 'No selected deterministic conflicts remain.', evidenceIds, selectedGoalIds, reviewConflicts.map(item => item.id)),
    tradeOff('unavailableInformation', unavailable.length ? 'limited' : 'known', unavailable.length ? unavailable.join(' ') : 'No selected candidate declares unavailable information.', evidenceIds, selectedGoalIds, []),
  ];
}

function tradeOff(
  category: RepositoryFutureTradeOff['category'],
  value: RepositoryFutureTradeOff['value'],
  rationale: string,
  evidenceIds: string[],
  nodeIds: string[],
  conflictIds: string[],
): RepositoryFutureTradeOff {
  return { category, value, rationale, evidenceIds: sortedUnique(evidenceIds), nodeIds: sortedUnique(nodeIds), conflictIds: sortedUnique(conflictIds) };
}

function conflictIssue(conflict: RepositoryFutureConflict): RepositoryFutureSynthesisIssue {
  return {
    code: conflict.kind === 'dependency-cycle' ? 'dependency-cycle' : 'blocking-conflict',
    goalIds: [],
    conflictIds: [conflict.id],
    dependencyIds: [],
    reason: conflict.rationale,
    recovery: conflict.recovery,
  };
}

function unknownGoalIssue(goalId: string): RepositoryFutureSynthesisIssue {
  return {
    code: 'unknown-goal',
    goalIds: [goalId],
    conflictIds: [],
    dependencyIds: [],
    reason: 'Selected goal does not exist as a future-goal node in this graph.',
    recovery: 'Choose a goal ID from this graph.',
  };
}

function unsupportedDependencyIssue(goalId: string, dependencyId: string): RepositoryFutureSynthesisIssue {
  return {
    code: 'unsupported-dependency',
    goalIds: [goalId],
    conflictIds: [],
    dependencyIds: [dependencyId],
    reason: 'A required dependency does not resolve to a supported graph capability.',
    recovery: 'Resolve the dependency through a supported deterministic capability mapping.',
  };
}

function failure(
  graph: RepositoryFutureGraph,
  code: RepositoryFutureSynthesisFailureCode,
  issues: RepositoryFutureSynthesisIssue[],
): RepositoryFutureSynthesisResult {
  return {
    ok: false,
    code,
    sourceGraphFingerprint: graph.fingerprint,
    issues: sortIssues(issues),
    limitations: sortedUnique([...graph.limitations, ...issues.map(issue => issue.reason)]),
  };
}

function failureCode(issues: RepositoryFutureSynthesisIssue[]): RepositoryFutureSynthesisFailureCode {
  const priority: RepositoryFutureSynthesisFailureCode[] = [
    'invalid-graph-binding',
    'invalid-primary-count',
    'support-limit-exceeded',
    'dependency-cycle',
    'unsupported-dependency',
    'blocking-conflict',
    'invalid-selection',
    'no-eligible-primary',
  ];
  for (const code of priority) if (issues.some(issue => issue.code === code)) return code;
  return 'invalid-selection';
}

function sortIssues(issues: RepositoryFutureSynthesisIssue[]) {
  return [...new Map(issues.map(issue => [repositoryFutureFingerprint(issue), issue])).values()]
    .sort((left, right) => left.code.localeCompare(right.code) || left.reason.localeCompare(right.reason));
}

function compareChains(left: string[], right: string[]) {
  return left.join('>').localeCompare(right.join('>'));
}

function savedRank(saved: RepositoryFutureSavedAlternative) {
  if (saved.compatibility === 'compatible') return 0;
  if (saved.compatibility === 'compatible-with-review') return 1;
  if (saved.exclusionReasons.includes('exploratory')) return 2;
  return 3;
}

import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import { buildRepositoryUniverseModel } from '@/lib/workspace';
import {
  REPOSITORY_FUTURE_CAPABILITIES,
  REPOSITORY_FUTURE_DRAFT_VERSION,
  REPOSITORY_FUTURE_SYNTHESIS_VERSION,
  addRepositoryFutureSupportingGoal,
  buildRepositoryFutureQuickPathModel,
  buildRepositoryFutureGraph,
  inspectRepositoryFutureCandidateCompatibility,
  inspectRepositoryFutureDependencyImpact,
  rankRepositoryFuturePrimaryCandidates,
  rankRepositoryFutureSupportingCandidates,
  removeRepositoryFutureSupportingGoal,
  replaceRepositoryFuturePrimary,
  requestRepositoryFutureDependencyExclusion,
  synthesizeRepositoryFutureDraft,
  type RepositoryFutureCandidateDependencyHint,
  type RepositoryFutureDependencyDefinition,
  type RepositoryFutureGraph,
  type RepositoryFutureNormalizedCandidate,
} from '@/lib/workspace/repositoryFutures';

const repository = {
  repositoryId: 'github:shipseal/future-synthesis',
  projectId: 'project-future-synthesis',
  sourceScanId: 'scan-future-synthesis',
  sourceScanFingerprint: 'scan-future-synthesis-v1',
  limited: false,
};

const CAPABILITIES = {
  evidence: REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence,
  memory: 'synthesis-memory',
  routing: 'synthesis-routing',
  shared: 'synthesis-shared',
  supportOnly: 'synthesis-support-only',
  alternateOnly: 'synthesis-alternate-only',
  review: 'synthesis-review',
  cycleA: 'synthesis-cycle-a',
  cycleB: 'synthesis-cycle-b',
};

const definitions: RepositoryFutureDependencyDefinition[] = [
  definition(CAPABILITIES.evidence, []),
  definition(CAPABILITIES.memory, [CAPABILITIES.evidence]),
  definition(CAPABILITIES.routing, [CAPABILITIES.memory]),
  definition(CAPABILITIES.shared, [CAPABILITIES.evidence]),
  definition(CAPABILITIES.supportOnly, [CAPABILITIES.evidence]),
  definition(CAPABILITIES.alternateOnly, [CAPABILITIES.evidence]),
  definition(CAPABILITIES.review, [CAPABILITIES.evidence]),
  definition(CAPABILITIES.cycleA, [CAPABILITIES.cycleB]),
  definition(CAPABILITIES.cycleB, [CAPABILITIES.cycleA]),
];

function universeFixture() {
  const report = buildReport({
    repoName: 'future-synthesis',
    source: { sourceType: 'github-app', githubOwner: 'shipseal', githubRepo: 'future-synthesis', githubBranch: 'main' },
    files: [
      { path: 'README.md', size: 220 },
      { path: 'src/App.tsx', size: 480 },
      { path: 'src/App.test.tsx', size: 340 },
    ],
    textContents: { 'README.md': '# Future synthesis fixture' },
  });
  return buildRepositoryUniverseModel(report);
}

function candidate(
  key: string,
  overrides: Partial<RepositoryFutureNormalizedCandidate> = {},
): RepositoryFutureNormalizedCandidate {
  const candidateId = `future-candidate:${key}`;
  const evidenceId = `future-evidence:${key}`;
  const base: RepositoryFutureNormalizedCandidate = {
    id: candidateId,
    sourceId: `source:${key}`,
    sourceContractVersion: 'test.future-source.v1',
    repositoryId: repository.repositoryId,
    sourceScanId: repository.sourceScanId,
    sourceScanFingerprint: repository.sourceScanFingerprint,
    title: `Future ${key}`,
    rationale: `Repository-specific rationale for ${key}.`,
    origin: 'deterministic',
    lifecycle: 'proposed',
    currentness: 'future',
    targetCapabilityId: CAPABILITIES.shared,
    evidence: [{
      id: evidenceId,
      path: 'src/App.tsx',
      sourceScanId: repository.sourceScanId,
      sourceScanFingerprint: repository.sourceScanFingerprint,
      state: 'observed-current',
      origin: 'deterministic',
      confidence: 'high',
      contractVersion: 'test.evidence.v1',
      humanReviewRequired: false,
    }],
    dependencies: [dependency(CAPABILITIES.evidence, 'satisfied')],
    expectedArtifacts: [{
      id: `future-artifact:${key}`,
      family: 'architecture',
      targetPath: `docs/futures/${key}.md`,
      action: 'create',
      generatorId: 'repository-intelligence:architecture',
      supported: true,
      contentFingerprint: `artifact-content:${key}`,
      humanReviewRequired: false,
      limitations: [],
    }],
    confidence: 'high',
    humanReviewState: 'not-required',
    limitations: [],
    unavailableInformation: [],
    compatibilityHints: [],
    incompatibleCandidateIds: [],
    universeMappings: [],
    verificationMethod: 'Rescan and inspect the generated repository evidence.',
    alignment: 'direct-friction',
    eligibility: 'eligible',
    fit: 'strong-evidence-fit',
    contentFingerprint: `candidate-content:${key}`,
  };
  return { ...base, ...overrides };
}

function dependency(
  capabilityId: string,
  state: RepositoryFutureCandidateDependencyHint['state'] = 'missing',
  humanReviewState: RepositoryFutureCandidateDependencyHint['humanReviewState'] = 'not-required',
): RepositoryFutureCandidateDependencyHint {
  return {
    capabilityId,
    requirement: 'required',
    origin: 'deterministic',
    rationale: `Required ${capabilityId}.`,
    evidenceIds: [`evidence:${capabilityId}`],
    confidence: 'high',
    state,
    humanReviewState,
    limitations: [],
  };
}

function definition(id: string, requires: string[]): RepositoryFutureDependencyDefinition {
  return { id, title: id, rationale: `${id} dependency definition.`, requires };
}

function graphFixture(
  candidates: RepositoryFutureNormalizedCandidate[],
  options: { limited?: boolean; satisfied?: string[]; dependencyDefinitions?: RepositoryFutureDependencyDefinition[] } = {},
) {
  return buildRepositoryFutureGraph({
    repository: { ...repository, limited: options.limited || false },
    universe: universeFixture(),
    candidateResults: [{ candidates, rejected: [] }],
    capabilityDefinitions: options.dependencyDefinitions || definitions,
    satisfiedCapabilityIds: options.satisfied || [CAPABILITIES.evidence],
  });
}

function goalId(graph: RepositoryFutureGraph, candidateId: string) {
  const goal = graph.nodes.find(node => node.kind === 'future-goal' && node.candidateId === candidateId);
  if (!goal) throw new Error(`Missing goal for ${candidateId}`);
  return goal.id;
}

function selection(graph: RepositoryFutureGraph, primaryGoalIds: string[], supportingGoalIds: string[] = []) {
  return { sourceGraphFingerprint: graph.fingerprint, primaryGoalIds, supportingGoalIds };
}

function expectDraft(result: ReturnType<typeof synthesizeRepositoryFutureDraft>) {
  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(result.issues.map(issue => issue.reason).join(' '));
  return result.draft;
}

describe('Omega 18.5c Repository Future synthesis', () => {
  it('keeps recommendation separate from explicit one-primary selection and emits the versioned draft', () => {
    const primary = candidate('primary');
    const graph = graphFixture([primary]);
    const primaryId = goalId(graph, primary.id);
    const recommendations = rankRepositoryFuturePrimaryCandidates(graph);
    const unselectedModel = buildRepositoryFutureQuickPathModel(graph);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId])));

    expect(recommendations.state).toBe('available');
    expect(recommendations.candidates[0].goalId).toBe(primaryId);
    expect(unselectedModel.selectedPrimary).toBeUndefined();
    expect(unselectedModel.draftValidity).toBe('unselected');
    expect(draft.schemaVersion).toBe(REPOSITORY_FUTURE_DRAFT_VERSION);
    expect(draft.synthesisVersion).toBe(REPOSITORY_FUTURE_SYNTHESIS_VERSION);
    expect(draft.primaryGoal.goalId).toBe(primaryId);
    expect(draft.supportingGoals).toEqual([]);
    expect(draft.sourceGraphFingerprint).toBe(graph.fingerprint);
  });

  it('rejects zero or multiple primaries, unknown goals, stale graph binding and blocked goals', () => {
    const valid = candidate('valid');
    const blocked = candidate('blocked', { eligibility: 'blocked', fit: 'blocked', limitations: ['Blocked fixture.'] });
    const stale = candidate('stale', { sourceScanFingerprint: 'stale-scan-fingerprint' });
    const graph = graphFixture([valid, blocked, stale]);
    const validId = goalId(graph, valid.id);
    const blockedId = goalId(graph, blocked.id);
    const staleId = goalId(graph, stale.id);

    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [])).ok).toBe(false);
    const multiple = synthesizeRepositoryFutureDraft(graph, selection(graph, [validId, blockedId]));
    expect(multiple).toMatchObject({ ok: false, code: 'invalid-primary-count' });
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, ['future-goal:foreign']))).toMatchObject({ ok: false, code: 'invalid-selection' });
    expect(synthesizeRepositoryFutureDraft(graph, { ...selection(graph, [validId]), sourceGraphFingerprint: 'foreign-graph' })).toMatchObject({ ok: false, code: 'invalid-graph-binding' });
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [blockedId]))).toMatchObject({ ok: false, code: 'invalid-selection' });
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [staleId]))).toMatchObject({ ok: false, code: 'invalid-selection' });
  });

  it('supports zero, one or two distinct supports and rejects a third, duplicates and primary reuse', () => {
    const values = ['primary', 'support-a', 'support-b', 'support-c'].map(key => candidate(key));
    const graph = graphFixture(values);
    const ids = values.map(value => goalId(graph, value.id));

    expect(expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]]))).supportingGoals).toHaveLength(0);
    expect(expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]], [ids[1]]))).supportingGoals).toHaveLength(1);
    expect(expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]], [ids[1], ids[2]]))).supportingGoals).toHaveLength(2);
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]], [ids[1], ids[2], ids[3]]))).toMatchObject({ ok: false, code: 'support-limit-exceeded' });
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]], [ids[1], ids[1]]))).toMatchObject({ ok: false, code: 'invalid-selection' });
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]], [ids[0]]))).toMatchObject({ ok: false, code: 'invalid-selection' });
  });

  it('rejects explicit goal conflict even when provider metadata claims positive compatibility', () => {
    const support = candidate('provider-support', {
      origin: 'deep-intelligence',
      alignment: 'provider-suggestion',
      confidence: 'medium',
      fit: 'supported-with-review',
      compatibilityHints: ['compatible-with: future-candidate:primary'],
    });
    const primary = candidate('primary', { incompatibleCandidateIds: [support.id] });
    const graph = graphFixture([support, primary]);
    const primaryId = goalId(graph, primary.id);
    const supportId = goalId(graph, support.id);
    const compatibility = inspectRepositoryFutureCandidateCompatibility(graph, selection(graph, [primaryId]), supportId);
    const result = synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId], [supportId]));

    expect(compatibility.state).toBe('incompatible');
    expect(compatibility.conflictIds).not.toEqual([]);
    expect(result).toMatchObject({ ok: false, code: 'blocking-conflict' });
  });

  it('evaluates supporting goals pairwise and rejects a conflict introduced only between supports', () => {
    const supportB = candidate('support-b');
    const supportA = candidate('support-a', { incompatibleCandidateIds: [supportB.id] });
    const primary = candidate('primary');
    const graph = graphFixture([supportB, primary, supportA]);
    const primaryId = goalId(graph, primary.id);
    const supportAId = goalId(graph, supportA.id);
    const supportBId = goalId(graph, supportB.id);

    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId], [supportAId])).ok).toBe(true);
    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId], [supportAId, supportBId]))).toMatchObject({ ok: false, code: 'blocking-conflict' });
  });

  it('rejects artifact target collisions and contradictory actions only when conflicting goals are combined', () => {
    const primary = candidate('primary', {
      expectedArtifacts: [{ ...candidate('primary').expectedArtifacts[0], targetPath: 'docs/shared.md', action: 'create', contentFingerprint: 'primary-content' }],
    });
    const support = candidate('support', {
      expectedArtifacts: [{ ...candidate('support').expectedArtifacts[0], targetPath: 'docs/shared.md', action: 'update', contentFingerprint: 'support-content' }],
    });
    const graph = graphFixture([primary, support]);
    const primaryId = goalId(graph, primary.id);
    const supportId = goalId(graph, support.id);

    expect(synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId])).ok).toBe(true);
    const combined = synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId], [supportId]));
    expect(combined).toMatchObject({ ok: false, code: 'blocking-conflict' });
    if (combined.ok === false) expect(combined.issues.flatMap(issue => issue.conflictIds).length).toBeGreaterThan(0);
  });

  it('keeps sensitive human review explicit without turning it into a false blocking conflict', () => {
    const reviewed = candidate('reviewed', {
      humanReviewState: 'required',
      expectedArtifacts: [{
        ...candidate('reviewed').expectedArtifacts[0],
        targetPath: '.github/workflows/ci.yml',
        humanReviewRequired: true,
      }],
      dependencies: [dependency(CAPABILITIES.review, 'review-required', 'required')],
      fit: 'supported-with-review',
    });
    const graph = graphFixture([reviewed]);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, reviewed.id)])));

    expect(draft.compatibilityState).toBe('compatible-with-review');
    expect(draft.preparationReadiness).toBe('review-required');
    expect(draft.humanReviewRequirements.map(item => item.sourceKind)).toEqual(expect.arrayContaining(['goal', 'dependency', 'artifact', 'gate', 'conflict']));
    expect(draft.tradeOffs.find(item => item.category === 'humanReview')).toMatchObject({ value: 'required', evidenceIds: expect.any(Array) });
  });

  it('computes complete transitive closure, prerequisite-first order, shared deduplication and satisfaction state', () => {
    const primary = candidate('primary', { dependencies: [dependency(CAPABILITIES.routing)] });
    const support = candidate('support', { dependencies: [dependency(CAPABILITIES.routing), dependency(CAPABILITIES.shared)] });
    const graph = graphFixture([primary, support], { satisfied: [CAPABILITIES.evidence, CAPABILITIES.shared] });
    const primaryId = goalId(graph, primary.id);
    const supportId = goalId(graph, support.id);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [primaryId], [supportId])));
    const byCapability = new Map(draft.dependencies.map(item => [item.capabilityId, item]));

    expect(draft.dependencies.map(item => item.capabilityId)).toEqual(expect.arrayContaining([CAPABILITIES.evidence, CAPABILITIES.memory, CAPABILITIES.routing, CAPABILITIES.shared]));
    expect(draft.dependencies.filter(item => item.capabilityId === CAPABILITIES.routing)).toHaveLength(1);
    expect(byCapability.get(CAPABILITIES.routing)?.dependentGoalIds).toEqual([primaryId, supportId].sort());
    expect(byCapability.get(CAPABILITIES.shared)?.state).toBe('satisfied');
    expect(draft.dependencyExecutionOrder.indexOf(byCapability.get(CAPABILITIES.evidence)!.id)).toBeLessThan(draft.dependencyExecutionOrder.indexOf(byCapability.get(CAPABILITIES.memory)!.id));
    expect(draft.dependencyExecutionOrder.indexOf(byCapability.get(CAPABILITIES.memory)!.id)).toBeLessThan(draft.dependencyExecutionOrder.indexOf(byCapability.get(CAPABILITIES.routing)!.id));
  });

  it('blocks a complete required dependency cycle without removing an edge', () => {
    const cyclic = candidate('cyclic', { dependencies: [dependency(CAPABILITIES.cycleA)] });
    const graph = graphFixture([cyclic]);
    const result = synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, cyclic.id)]));

    expect(result).toMatchObject({ ok: false, code: 'dependency-cycle' });
    if (result.ok === false) expect(result.issues.some(issue => issue.dependencyIds.length >= 2 || issue.conflictIds.length > 0)).toBe(true);
    expect(graph.edges.filter(edge => edge.relation === 'requires')).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: expect.any(String), target: expect.any(String) }),
    ]));

    const primary = candidate('safe-primary');
    const combinedGraph = graphFixture([primary, cyclic]);
    expect(synthesizeRepositoryFutureDraft(combinedGraph, selection(
      combinedGraph,
      [goalId(combinedGraph, primary.id)],
      [goalId(combinedGraph, cyclic.id)],
    ))).toMatchObject({ ok: false, code: 'dependency-cycle' });
  });

  it('prunes only orphaned dependencies when a support is removed and keeps required dependencies non-toggleable', () => {
    const primary = candidate('primary', { dependencies: [dependency(CAPABILITIES.shared)] });
    const support = candidate('support', { dependencies: [dependency(CAPABILITIES.shared), dependency(CAPABILITIES.supportOnly)] });
    const graph = graphFixture([primary, support]);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, primary.id)], [goalId(graph, support.id)])));
    const shared = draft.dependencies.find(item => item.capabilityId === CAPABILITIES.shared)!;
    const supportOnly = draft.dependencies.find(item => item.capabilityId === CAPABILITIES.supportOnly)!;
    const prior = structuredClone(draft);
    const removed = expectDraft(removeRepositoryFutureSupportingGoal(graph, draft, goalId(graph, support.id)));

    expect(removed.dependencies.some(item => item.capabilityId === CAPABILITIES.shared)).toBe(true);
    expect(removed.dependencies.some(item => item.capabilityId === CAPABILITIES.supportOnly)).toBe(false);
    expect(requestRepositoryFutureDependencyExclusion(draft, shared.id)).toMatchObject({ allowed: false, dependentGoalIds: expect.arrayContaining([goalId(graph, primary.id)]) });
    expect(inspectRepositoryFutureDependencyImpact(draft, supportOnly.id)).toMatchObject({ requiredByPrimary: false, removableByRemovingSupportingGoals: true });
    expect(draft).toEqual(prior);
  });

  it('replacing the primary removes newly incompatible supports and recomputes old dependency closure', () => {
    const supportA = candidate('support-a', { dependencies: [dependency(CAPABILITIES.supportOnly)] });
    const supportB = candidate('support-b', { dependencies: [dependency(CAPABILITIES.shared)] });
    const primaryA = candidate('primary-a', { dependencies: [dependency(CAPABILITIES.memory)] });
    const primaryB = candidate('primary-b', {
      dependencies: [dependency(CAPABILITIES.alternateOnly)],
      incompatibleCandidateIds: [supportA.id],
    });
    const graph = graphFixture([supportB, primaryA, supportA, primaryB]);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(
      graph,
      [goalId(graph, primaryA.id)],
      [goalId(graph, supportA.id), goalId(graph, supportB.id)],
    )));
    const replaced = replaceRepositoryFuturePrimary(graph, draft, goalId(graph, primaryB.id));

    expect(replaced.result.ok).toBe(true);
    if (!replaced.result.ok) return;
    expect(replaced.removedGoalIds).toEqual([goalId(graph, supportA.id)]);
    expect(replaced.result.draft.supportingGoals.map(goal => goal.goalId)).toEqual([goalId(graph, supportB.id)]);
    expect(replaced.result.draft.dependencies.some(item => item.capabilityId === CAPABILITIES.memory)).toBe(false);
    expect(replaced.result.draft.dependencies.some(item => item.capabilityId === CAPABILITIES.alternateOnly)).toBe(true);
  });

  it('ranks primary and supporting recommendations deterministically without selecting them', () => {
    const deterministic = candidate('deterministic');
    const reviewed = candidate('reviewed', { humanReviewState: 'required', fit: 'supported-with-review' });
    const exploratory = candidate('provider', {
      origin: 'deep-intelligence',
      alignment: 'provider-suggestion',
      eligibility: 'exploratory',
      fit: 'exploratory',
      confidence: 'low',
    });
    const first = graphFixture([exploratory, reviewed, deterministic]);
    const second = graphFixture([deterministic, exploratory, reviewed]);
    const firstRank = rankRepositoryFuturePrimaryCandidates(first);
    const secondRank = rankRepositoryFuturePrimaryCandidates(second);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(firstRank.candidates.map(item => item.candidateId)).toEqual(secondRank.candidates.map(item => item.candidateId));
    expect(firstRank.candidates[0].candidateId).toBe(deterministic.id);
    expect(firstRank.candidates.some(item => item.candidateId === exploratory.id)).toBe(false);
    expect(rankRepositoryFutureSupportingCandidates(first, goalId(first, deterministic.id))).toHaveLength(1);
  });

  it('bounds Quick Path recommendations to 24 candidates with a stable identity tie-break', () => {
    const values = Array.from({ length: 30 }, (_, index) => candidate(`candidate-${String(index).padStart(2, '0')}`));
    const graph = graphFixture([...values].reverse());
    const recommendations = rankRepositoryFuturePrimaryCandidates(graph, 100);

    expect(recommendations.candidates).toHaveLength(24);
    expect(recommendations.candidates.map(item => item.candidateId)).toEqual([...recommendations.candidates.map(item => item.candidateId)].sort());
  });

  it('retains viable unselected evidence lineage and explicit incompatible/exploratory exclusion reasons', () => {
    const compatible = candidate('compatible');
    const exploratory = candidate('exploratory', { eligibility: 'exploratory', fit: 'exploratory', confidence: 'low' });
    const incompatible = candidate('incompatible');
    const primary = candidate('primary', { incompatibleCandidateIds: [incompatible.id] });
    const graph = graphFixture([incompatible, compatible, primary, exploratory]);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, primary.id)])));

    expect(draft.savedAlternatives.map(item => item.candidateId)).toEqual([compatible.id, exploratory.id]);
    expect(draft.savedAlternatives.find(item => item.candidateId === compatible.id)?.evidence[0].id).toBe(compatible.evidence[0].id);
    expect(draft.savedAlternatives.some(item => item.candidateId === primary.id)).toBe(false);
    expect(draft.excludedCandidates.find(item => item.candidateId === incompatible.id)?.reasons).toContain('conflicts-with-primary');
    expect(draft.excludedCandidates.find(item => item.candidateId === exploratory.id)?.reasons).toContain('exploratory');
  });

  it('keeps draft identity stable across selection permutations and changes it for material selections or graph evidence', () => {
    const primary = candidate('primary');
    const supportA = candidate('support-a');
    const supportB = candidate('support-b');
    const graph = graphFixture([supportB, primary, supportA]);
    const ids = [supportA, supportB].map(value => goalId(graph, value.id));
    const first = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, primary.id)], ids)));
    const second = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, primary.id)], [...ids].reverse())));
    const noSupport = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, primary.id)])));
    const changedPrimary = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [ids[0]])));
    const changedCandidate = candidate('primary', {
      evidence: [{ ...primary.evidence[0], limitation: 'Materially changed evidence limitation.' }],
      contentFingerprint: 'candidate-content:primary:v2',
    });
    const changedGraph = graphFixture([changedCandidate, supportA, supportB]);
    const changedDraft = expectDraft(synthesizeRepositoryFutureDraft(changedGraph, selection(changedGraph, [goalId(changedGraph, changedCandidate.id)])));

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.id).toBe(second.id);
    expect(noSupport.fingerprint).not.toBe(first.fingerprint);
    expect(changedPrimary.fingerprint).not.toBe(noSupport.fingerprint);
    expect(changedGraph.fingerprint).not.toBe(graph.fingerprint);
    expect(changedDraft.fingerprint).not.toBe(noSupport.fingerprint);
  });

  it('adds supports immutably and changes the draft fingerprint only after explicit acceptance', () => {
    const primary = candidate('primary');
    const support = candidate('support');
    const graph = graphFixture([support, primary]);
    const graphBefore = structuredClone(graph);
    const draft = expectDraft(synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, primary.id)])));
    const draftBefore = structuredClone(draft);
    const recommendation = rankRepositoryFutureSupportingCandidates(graph, goalId(graph, primary.id))[0];

    expect(draft.supportingGoals).toEqual([]);
    expect(recommendation.goalId).toBe(goalId(graph, support.id));
    expect(draft.fingerprint).toBe(draftBefore.fingerprint);
    const accepted = expectDraft(addRepositoryFutureSupportingGoal(graph, draft, recommendation.goalId));
    expect(accepted.supportingGoals).toHaveLength(1);
    expect(accepted.fingerprint).not.toBe(draft.fingerprint);
    expect(graph).toEqual(graphBefore);
    expect(draft).toEqual(draftBefore);
  });

  it('returns an honest no-candidate state and still supports deterministic limited fallback', () => {
    const blockedGraph = graphFixture([candidate('blocked', { eligibility: 'blocked', fit: 'blocked' })]);
    const fallback = candidate('limited-fallback', {
      fit: 'supported-with-review',
      confidence: 'medium',
      limitations: ['Limited scan evidence remains explicit.'],
    });
    const limitedGraph = graphFixture([fallback], { limited: true });

    expect(rankRepositoryFuturePrimaryCandidates(blockedGraph)).toMatchObject({ state: 'none', candidates: [] });
    const draft = expectDraft(synthesizeRepositoryFutureDraft(limitedGraph, selection(limitedGraph, [goalId(limitedGraph, fallback.id)])));
    expect(draft.sourceRepository.limited).toBe(true);
    expect(draft.limitations.join(' ')).toContain('Limited scan');
  });

  it('rejects required capabilities that have no supported deterministic dependency definition', () => {
    const unsupported = candidate('unsupported-dependency', { dependencies: [dependency('provider-only-autonomous-oracle', 'unknown')] });
    const graph = graphFixture([unsupported]);
    const result = synthesizeRepositoryFutureDraft(graph, selection(graph, [goalId(graph, unsupported.id)]));

    expect(result).toMatchObject({ ok: false, code: 'unsupported-dependency' });
    expect(rankRepositoryFuturePrimaryCandidates(graph)).toMatchObject({ state: 'none', candidates: [] });
    if (result.ok === false) expect(result.limitations.join(' ')).toContain('dependency');
  });
});

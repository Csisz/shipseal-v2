import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import type { RepositoryEvidence } from '@/lib/repositoryIntelligence/evidence';
import {
  buildRepositoryActionableImprovements,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  buildWorkspaceStory,
} from '@/lib/workspace';
import {
  DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS,
  REPOSITORY_FUTURE_CAPABILITIES,
  REPOSITORY_FUTURE_GRAPH_VERSION,
  adaptActionableImprovementCandidates,
  adaptRepositoryHealthCandidates,
  adaptValidatedDeepIntelligenceCandidates,
  adaptVerifiedOpportunitySignalCandidates,
  adaptWorkspaceStoryCandidates,
  buildRepositoryFutureGraph,
  type RepositoryFutureAdapterContext,
  type RepositoryFutureCandidateAdapterResult,
  type RepositoryFutureDependencyDefinition,
  type RepositoryFutureEdgeRelation,
  type RepositoryFutureNode,
} from '@/lib/workspace/repositoryFutures';

function reportFixture() {
  return buildReport({
    repoName: 'future-graph-test',
    source: { sourceType: 'github-app', githubOwner: 'shipseal', githubRepo: 'future-graph-test', githubBranch: 'main' },
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 280 },
      { path: 'src/App.tsx', size: 520 },
      { path: 'src/App.test.tsx', size: 360 },
      { path: '.github/workflows/ci.yml', size: 180 },
    ],
    textContents: {
      'README.md': '# Future Graph Test\n\nA bounded repository fixture.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest run', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function deterministicFixture(limited = false) {
  const report = reportFixture();
  if (limited) {
    report.scanSummary = { ...report.scanSummary, limited: true, scanMode: 'limited-fallback', limitationReason: 'Fixture limitation.' };
    report.scanEvidence = { ...report.scanEvidence, limitedScan: true, limitationReason: 'Fixture limitation.' };
  }
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  const plan = buildRepositoryOptimizationPlan({ report, transformation, universe, atlas });
  const improvements = buildRepositoryActionableImprovements({ transformation, plan });
  const context: RepositoryFutureAdapterContext = {
    repository: {
      repositoryId: 'github:shipseal/future-graph-test',
      projectId: 'project-future',
      sourceScanId: 'scan-future',
      sourceScanFingerprint: 'scan-fingerprint-v1',
      limited,
    },
    universe,
  };
  return { report, universe, context, improvements, transformation, plan };
}

function deterministicResult(limited = false) {
  const fixture = deterministicFixture(limited);
  return {
    ...fixture,
    result: adaptActionableImprovementCandidates(fixture.improvements, fixture.context),
  };
}

function buildGraph(
  candidateResults: RepositoryFutureCandidateAdapterResult[],
  context: RepositoryFutureAdapterContext,
  overrides: Partial<Parameters<typeof buildRepositoryFutureGraph>[0]> = {},
) {
  return buildRepositoryFutureGraph({
    repository: context.repository,
    universe: context.universe,
    candidateResults,
    satisfiedCapabilityIds: [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence],
    ...overrides,
  });
}

function evidenceFixture(confidence = 0.7): RepositoryEvidence {
  return {
    id: 'evidence:src-app',
    schemaVersion: 'shipseal.repository-evidence.v1',
    repositoryRelativePath: 'src/App.tsx',
    folderPath: 'src',
    category: 'responsibility',
    sourceType: 'source',
    extractedFact: 'src/App.tsx is an application component.',
    confidence,
    origin: 'deterministic',
    assertionState: 'verified',
    extractor: { id: 'fixture', version: '1' },
    relatedEvidenceIds: [],
    relationships: [],
    validation: { state: 'validated', validatorIds: ['fixture'], reasons: [] },
    limitations: [],
  };
}

function deepFinding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deep-future:memory',
    category: 'future-direction',
    validationState: 'accepted',
    acceptedConfidence: 'high',
    humanReviewState: 'not-required',
    acceptedPaths: ['src/App.tsx'],
    supportingEvidenceIds: ['evidence:src-app'],
    limitations: [],
    futureDirectionCandidate: {
      goal: 'Create durable architecture memory',
      repositorySpecificRationale: 'The current application component lacks mapped architecture memory.',
      evidencePaths: ['src/App.tsx'],
      evidenceIds: ['evidence:src-app'],
      dependencies: ['project memory', 'unknown autonomous oracle'],
      expectedArtifactFamilies: ['architecture'],
      confidence: 'high',
      verificationMethod: 'Rescan and confirm the reviewed architecture artifact.',
      compatibilityHints: [],
    },
    ...overrides,
  };
}

describe('Omega 18.5b Repository Future Graph', () => {
  it('builds a versioned proposed overlay while preserving lightweight current Universe references', () => {
    const { universe, context, result } = deterministicResult();
    const before = structuredClone(universe);
    const graph = buildGraph([result], context);

    expect(graph.version).toBe(REPOSITORY_FUTURE_GRAPH_VERSION);
    expect(graph.candidates.length).toBeGreaterThan(0);
    expect(graph.nodes.some(node => node.kind === 'repository-entity' && node.currentness === 'current')).toBe(true);
    expect(graph.nodes.some(node => node.kind === 'future-goal' && node.lifecycle === 'proposed')).toBe(true);
    expect(graph.nodes.some(node => node.kind === 'capability')).toBe(true);
    expect(graph.nodes.some(node => node.kind === 'artifact')).toBe(true);
    expect(graph.edges.map(edge => edge.relation)).toEqual(expect.arrayContaining(['supports', 'requires', 'produces']));
    expect(graph.nodes.some(node => ['prepared', 'applied-unverified', 'verified', 'historical'].includes(node.lifecycle))).toBe(false);
    expect(universe).toEqual(before);

    for (const current of graph.nodes.filter(node => node.kind === 'repository-entity')) {
      expect(current.universeMappings).toHaveLength(1);
      expect(universe.nodes.some(node => node.id === current.universeMappings[0].universeNodeId)).toBe(true);
      expect(Object.keys(current)).not.toContain('position');
      expect(Object.keys(current)).not.toContain('metadata');
    }
  });

  it('normalizes deterministic Repository Health and Workspace Story evidence without treating it as an executable plan', () => {
    const { report, context } = deterministicFixture();
    const health = adaptRepositoryHealthCandidates(report.repositoryHealth, context);
    const story = adaptWorkspaceStoryCandidates(buildWorkspaceStory(report), context);
    const graph = buildGraph([health, story], context);

    expect(health.candidates.length).toBeGreaterThan(0);
    expect(health.candidates.every(candidate => candidate.origin === 'deterministic')).toBe(true);
    expect(story.candidates.every(candidate => candidate.eligibility === 'exploratory')).toBe(true);
    expect(graph.nodes.some(node => node.kind === 'outcome')).toBe(false);
    expect(graph.limitations.join(' ')).toContain('does not select, prepare, persist, apply or verify');
  });

  it('accepts only validated future-direction findings, caps provider confidence, and rejects unknown dependencies from executable structure', () => {
    const { context } = deterministicFixture();
    const adapted = adaptValidatedDeepIntelligenceCandidates({
      findings: [deepFinding(), { id: 'raw-provider', category: 'future-direction', futureDirectionCandidate: { goal: 'Unvalidated' } }],
      deterministicEvidence: [evidenceFixture(0.45)],
      context,
    });

    expect(adapted.candidates).toHaveLength(1);
    expect(adapted.rejected).toHaveLength(1);
    expect(adapted.rejected[0].reasonCodes).toContain('invalid-shape');
    expect(adapted.candidates[0]).toMatchObject({ origin: 'deep-intelligence', confidence: 'low', fit: 'exploratory', lifecycle: 'proposed' });
    expect(adapted.candidates[0].dependencies.map(item => item.capabilityId)).toContain(REPOSITORY_FUTURE_CAPABILITIES.projectMemory);
    expect(adapted.candidates[0].dependencies.some(item => item.capabilityId.includes('oracle'))).toBe(false);
    expect(adapted.candidates[0].limitations.join(' ')).toContain('Unknown provider dependency');
  });

  it('rejects unsafe provider evidence paths and blocks a provider candidate whose cited evidence cannot resolve', () => {
    const { context } = deterministicFixture();
    const adapted = adaptValidatedDeepIntelligenceCandidates({
      findings: [deepFinding({
        acceptedPaths: ['../../secret.txt'],
        supportingEvidenceIds: ['missing-evidence'],
        futureDirectionCandidate: {
          ...(deepFinding().futureDirectionCandidate as object),
          evidencePaths: ['../../secret.txt'],
          evidenceIds: ['missing-evidence'],
        },
      })],
      deterministicEvidence: [evidenceFixture()],
      context,
    });
    const graph = buildGraph([adapted], context);

    expect(adapted.candidates[0].eligibility).toBe('blocked');
    expect(adapted.candidates[0].universeMappings).toEqual([]);
    expect(graph.conflicts.some(conflict => conflict.kind === 'insufficient-evidence' && conflict.blocking)).toBe(true);
  });

  it('adapts only explicitly scoped opportunity signals and never emits an unlock edge or verified lifecycle', () => {
    const { context } = deterministicFixture();
    const baseSignal = {
      id: 'signal-1',
      projectId: 'project-future',
      sourceVerificationId: 'verification-accepted',
      kind: 'future-unlocked',
      title: 'A later capability may now be explored',
      rationale: 'Compatible bounded evidence admitted this signal.',
      evidenceIds: ['verification-evidence'],
      relatedArtifactIds: ['artifact-1'],
      confidence: 'medium',
    };
    const adapted = adaptVerifiedOpportunitySignalCandidates({
      signals: [baseSignal, { ...baseSignal, id: 'signal-foreign', projectId: 'other-project' }, { ...baseSignal, id: 'signal-unwired', sourceVerificationId: 'verification-unwired' }],
      context,
      expectedProjectId: 'project-future',
      eligibleVerificationIds: ['verification-accepted'],
    });
    const graph = buildGraph([adapted], context);

    expect(adapted.candidates).toHaveLength(1);
    expect(adapted.rejected.map(item => item.reasonCodes[0])).toEqual(['foreign-project', 'ineligible-verification']);
    expect(adapted.candidates[0]).toMatchObject({ origin: 'verified-signal', lifecycle: 'proposed', currentness: 'future' });
    expect(graph.edges.some(edge => edge.relation === 'unlocks')).toBe(false);
    expect(graph.nodes.some(node => node.lifecycle === 'verified')).toBe(false);
  });

  it('is stable across candidate/result permutations and does not use timestamps or insertion order', () => {
    const { context, result } = deterministicResult();
    const { report } = deterministicFixture();
    const health = adaptRepositoryHealthCandidates(report.repositoryHealth, context);
    const permutations = [
      [result, health],
      [{ ...health, candidates: [...health.candidates].reverse() }, { ...result, candidates: [...result.candidates].reverse() }],
      [health, result],
    ];
    const graphs = permutations.map(candidateResults => buildGraph(candidateResults, context));

    expect(graphs[1]).toEqual(graphs[0]);
    expect(graphs[2]).toEqual(graphs[0]);
    expect(graphs[0].fingerprint).toBe(graphs[1].fingerprint);
    expect(JSON.stringify(graphs[0])).not.toMatch(/scannedAt|createdAt|updatedAt|timestamp/i);
  });

  it('changes the graph fingerprint for material evidence and dependency changes', () => {
    const { context } = deterministicFixture();
    const firstDeep = adaptValidatedDeepIntelligenceCandidates({ findings: [deepFinding()], deterministicEvidence: [evidenceFixture(0.7)], context });
    const changedEvidence = adaptValidatedDeepIntelligenceCandidates({ findings: [deepFinding()], deterministicEvidence: [{ ...evidenceFixture(0.7), extractedFact: 'Materially changed evidence.', limitations: ['Changed evidence boundary.'] }], context });
    const first = buildGraph([firstDeep], context);
    const second = buildGraph([changedEvidence], context);
    const changedDefinitions = DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS.map(item => item.id === REPOSITORY_FUTURE_CAPABILITIES.projectMemory
      ? { ...item, requires: [...item.requires, REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy] }
      : item);
    const third = buildGraph([firstDeep], context, { capabilityDefinitions: changedDefinitions });

    expect(second.fingerprint).not.toBe(first.fingerprint);
    expect(third.fingerprint).not.toBe(first.fingerprint);
  });

  it('represents known, satisfied, missing and transitive dependencies with stable IDs', () => {
    const { context } = deterministicFixture();
    const adapted = adaptValidatedDeepIntelligenceCandidates({ findings: [deepFinding()], deterministicEvidence: [evidenceFixture()], context });
    const graph = buildGraph([adapted], context, {
      satisfiedCapabilityIds: [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence],
    });
    const projectMemory = graph.dependencies.find(item => item.capabilityId === REPOSITORY_FUTURE_CAPABILITIES.projectMemory);
    const repositoryEvidence = graph.dependencies.find(item => item.capabilityId === REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence);

    expect(projectMemory).toMatchObject({ state: 'missing', requirement: 'required' });
    expect(repositoryEvidence).toMatchObject({ state: 'satisfied', requirement: 'required' });
    expect(projectMemory?.id).toBe(`future-capability:${REPOSITORY_FUTURE_CAPABILITIES.projectMemory}`);
    expect(graph.edges.some(edge => edge.source === projectMemory?.id && edge.target === repositoryEvidence?.id && edge.relation === 'requires')).toBe(true);
  });

  it('detects complete required-dependency cycles deterministically without removing an edge', () => {
    const { context, result } = deterministicResult();
    const definitions: RepositoryFutureDependencyDefinition[] = [
      { id: REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence, title: 'Evidence', rationale: 'Fixture.', requires: [REPOSITORY_FUTURE_CAPABILITIES.projectMemory] },
      { id: REPOSITORY_FUTURE_CAPABILITIES.projectMemory, title: 'Memory', rationale: 'Fixture.', requires: [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence] },
    ];
    const first = buildGraph([result], context, { capabilityDefinitions: definitions, satisfiedCapabilityIds: [] });
    const second = buildGraph([result], context, { capabilityDefinitions: [...definitions].reverse(), satisfiedCapabilityIds: [] });

    expect(first.dependencyCycles).toHaveLength(1);
    expect(first.dependencyCycles[0].capabilityIds).toEqual([REPOSITORY_FUTURE_CAPABILITIES.projectMemory, REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence].sort());
    expect(first.conflicts.some(conflict => conflict.kind === 'dependency-cycle' && conflict.blocking)).toBe(true);
    expect(first.edges.filter(edge => edge.relation === 'requires').some(edge => edge.source.includes('project-memory') && edge.target.includes('repository-evidence'))).toBe(true);
    expect(first).toEqual(second);
  });

  it('detects symmetric goal incompatibility with stable identity independent of candidate order', () => {
    const { context, result } = deterministicResult();
    const [firstBase, secondBase] = result.candidates.slice(0, 2);
    expect(firstBase).toBeTruthy();
    expect(secondBase).toBeTruthy();
    const first = { ...firstBase, incompatibleCandidateIds: [secondBase.sourceId] };
    const second = { ...secondBase, incompatibleCandidateIds: [firstBase.sourceId] };
    const left = buildGraph([{ candidates: [first, second], rejected: [] }], context);
    const right = buildGraph([{ candidates: [second, first], rejected: [] }], context);
    const conflict = left.conflicts.find(item => item.kind === 'goal-incompatibility');
    const edge = left.edges.find(item => item.relation === 'conflicts-with');

    expect(conflict?.affectedNodeIds).toEqual([...conflict!.affectedNodeIds].sort());
    expect(edge?.source.localeCompare(edge!.target)).toBeLessThan(0);
    expect(left).toEqual(right);
  });

  it('detects action mismatches, divergent artifact identities, stale scope and sensitive review deterministically', () => {
    const { context, result } = deterministicResult();
    const [firstBase, secondBase] = result.candidates.slice(0, 2);
    const sharedPath = 'AGENTS.md';
    const first = {
      ...firstBase,
      expectedArtifacts: [{ ...firstBase.expectedArtifacts[0], targetPath: sharedPath, action: 'create' as const, contentFingerprint: 'content-a' }],
      humanReviewState: 'required' as const,
    };
    const second = {
      ...secondBase,
      expectedArtifacts: [{ ...secondBase.expectedArtifacts[0], targetPath: sharedPath, action: 'strengthen' as const, contentFingerprint: 'content-b' }],
      sourceScanFingerprint: 'stale-fingerprint',
    };
    const graph = buildGraph([{ candidates: [second, first], rejected: [] }], context);
    const kinds = graph.conflicts.map(item => item.kind);

    expect(kinds).toEqual(expect.arrayContaining(['action-mismatch', 'artifact-target-collision', 'stale-identity', 'human-review-required']));
    expect(graph.conflicts).toEqual([...graph.conflicts].sort((left, right) => left.id.localeCompare(right.id)));
  });

  it('keeps deterministic fallback usable with no provider or opportunity inputs and downgrades limited scans honestly', () => {
    const complete = deterministicResult();
    const fullGraph = buildGraph([complete.result], complete.context);
    const limited = deterministicResult(true);
    const limitedGraph = buildGraph([limited.result], limited.context);

    expect(fullGraph.candidates.length).toBeGreaterThan(0);
    expect(fullGraph.rejectedInputs).toEqual([]);
    expect(limitedGraph.summary.limited).toBe(true);
    expect(limitedGraph.candidates.every(candidate => candidate.fit !== 'strong-evidence-fit')).toBe(true);
    expect(limitedGraph.candidates.every(candidate => candidate.eligibility !== 'eligible')).toBe(true);
    expect(limitedGraph.nodes.filter(node => node.kind === 'repository-entity').every(node => node.universeMappings.length === 1)).toBe(true);
  });

  it('keeps all accepted edge and node schema variants serializable without emitting later lifecycle claims', () => {
    const relations: RepositoryFutureEdgeRelation[] = ['supports', 'requires', 'conflicts-with', 'produces', 'gates', 'verifies', 'unlocks', 'save-for-later-lineage'];
    const structuralOutcome = {
      id: 'future-outcome:structural-only',
      schemaVersion: REPOSITORY_FUTURE_GRAPH_VERSION,
      kind: 'outcome',
      lifecycle: 'proposed',
      currentness: 'future',
      title: 'Structural outcome support',
      rationale: 'Schema support only; the graph builder does not emit this node.',
      origin: 'deterministic',
      evidenceIds: [],
      evidencePaths: [],
      confidence: 'low',
      humanReviewState: 'not-required',
      universeMappings: [],
      limitations: ['Not emitted by Ω.18.5b.'],
      unavailableInformation: [],
      contentFingerprint: 'structural-fingerprint',
    } satisfies RepositoryFutureNode;

    expect(new Set(relations).size).toBe(8);
    expect(JSON.parse(JSON.stringify(structuralOutcome))).toEqual(structuralOutcome);
  });
});

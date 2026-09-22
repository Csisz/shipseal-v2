import { describe, expect, it, vi } from 'vitest';
import { futuresQaProductIntelligence, futuresQaReport } from '@/dev/RepositoryFuturesLayoutQa';
import {
  buildExecutableFuturePlan,
  buildRepositoryUniverseModel,
  renderClaudeCodeFuturePlanPrompt,
  renderCodexFuturePlanPrompt,
  renderExecutableFuturePlanMarkdown,
} from '@/lib/workspace';
import {
  addRepositoryFutureSupportingGoal,
  replaceRepositoryFuturePrimary,
  synthesizeRepositoryFutureDraft,
  type RepositoryFutureDraft,
  type RepositoryFutureGraph,
} from '@/lib/workspace/repositoryFutures';
import { buildRepositoryFuturePathwaysGraph } from '@/components/agentready/result-workspace/futures/repositoryFuturePathwaysGraph';

function fixture(reviewRequired = false) {
  const productIntelligence = reviewRequired
    ? {
        ...futuresQaProductIntelligence,
        fingerprint: 'product-intelligence:review-required',
        humanReviewRequired: true,
        opportunities: futuresQaProductIntelligence.opportunities.map(opportunity => ({
          ...opportunity,
          humanReviewRequirements: ['Authentication and session behavior require qualified human approval before production verification.'],
        })),
      }
    : futuresQaProductIntelligence;
  const universe = buildRepositoryUniverseModel(futuresQaReport);
  const graph = buildRepositoryFuturePathwaysGraph(futuresQaReport, universe, productIntelligence);
  const productGoals = graph.nodes
    .filter(node => node.kind === 'future-goal' && graph.candidates.find(candidate => candidate.id === node.candidateId)?.candidateClass === 'product-opportunity')
    .map(node => node.id);
  const result = synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [productGoals[0]],
    supportingGoalIds: [],
  });
  if (!result.ok) throw new Error('Expected executable-plan fixture synthesis to succeed.');
  return { report: futuresQaReport, graph, draft: result.draft, productIntelligence, productGoals };
}

function planFrom(graph: RepositoryFutureGraph, draft: RepositoryFutureDraft, productIntelligence = futuresQaProductIntelligence) {
  return buildExecutableFuturePlan({ report: futuresQaReport, graph, draft, productIntelligence });
}

function addSupport(graph: RepositoryFutureGraph, draft: RepositoryFutureDraft, goalId: string) {
  const result = addRepositoryFutureSupportingGoal(graph, draft, goalId);
  if (!result.ok) throw new Error(`Expected support ${goalId} to be compatible.`);
  return result.draft;
}

describe('V12 deterministic Executable Future Plan', () => {
  it('produces stable identity without timestamps and changes for Primary, Support, or source-intelligence changes', () => {
    const { graph, draft, productIntelligence, productGoals } = fixture();
    const first = planFrom(graph, draft, productIntelligence);
    const repeated = planFrom(graph, structuredClone(draft), structuredClone(productIntelligence));
    expect(repeated).toEqual(first);
    expect(repeated.fingerprint).toBe(first.fingerprint);
    expect(Object.keys(first)).not.toContain('createdAt');
    expect(Object.keys(first)).not.toContain('updatedAt');

    const replaced = replaceRepositoryFuturePrimary(graph, draft, productGoals[1]);
    expect(replaced.result.ok).toBe(true);
    if (!replaced.result.ok) return;
    expect(planFrom(graph, replaced.result.draft, productIntelligence).fingerprint).not.toBe(first.fingerprint);

    const supportedDraft = addSupport(graph, draft, productGoals[1]);
    expect(planFrom(graph, supportedDraft, productIntelligence).fingerprint).not.toBe(first.fingerprint);

    expect(buildExecutableFuturePlan({
      report: futuresQaReport,
      graph,
      draft,
      productIntelligence: { ...productIntelligence, fingerprint: 'changed-source-intelligence' },
    }).fingerprint).not.toBe(first.fingerprint);
  });

  it('preserves one Primary, at most two Supports, and orders dependencies before implementation and verification', () => {
    const { graph, draft, productIntelligence, productGoals } = fixture();
    const withOne = addSupport(graph, draft, productGoals[1]);
    const withTwo = addSupport(graph, withOne, productGoals[2]);
    const plan = planFrom(graph, withTwo, productIntelligence);

    expect(plan.primaryFuture.role).toBe('primary');
    expect(plan.supportingFutures).toHaveLength(2);
    expect(plan.supportingFutures.every(goal => goal.role === 'supporting')).toBe(true);
    expect(plan.requiredCapabilities.map(item => item.executionOrder)).toEqual([...plan.requiredCapabilities.map(item => item.executionOrder)].sort((left, right) => left - right));
    const stageKinds = plan.implementationStages.map(stage => stage.kind);
    expect(stageKinds).toEqual(expect.arrayContaining(['foundation', 'primary', 'supporting', 'integration', 'verification']));
    expect(stageKinds.indexOf('foundation')).toBeLessThan(stageKinds.indexOf('primary'));
    expect(stageKinds.indexOf('primary')).toBeLessThan(stageKinds.indexOf('supporting'));
    expect(stageKinds.indexOf('supporting')).toBeLessThan(stageKinds.indexOf('integration'));
    expect(stageKinds.indexOf('integration')).toBeLessThan(stageKinds.indexOf('verification'));
    expect(plan.implementationStages[0].sourceIds).toEqual(expect.arrayContaining(plan.requiredCapabilities.map(item => item.id)));
    expect(plan.implementationStages.at(-1)?.kind).toBe('verification');
  });

  it('uses validated existing paths and represents missing paths only as path-free responsibilities', () => {
    const { graph, draft, productIntelligence } = fixture();
    const opportunityId = graph.candidates.find(candidate => candidate.id === draft.primaryGoal.candidateId)?.sourceId;
    const conceptualIntelligence = {
      ...productIntelligence,
      fingerprint: 'product-intelligence:conceptual-area',
      opportunities: productIntelligence.opportunities.map(opportunity => opportunity.id === opportunityId
        ? {
            ...opportunity,
            expectedImplementationAreas: [
              ...opportunity.expectedImplementationAreas,
              { label: 'Environment preset configuration', evidenceIds: opportunity.evidenceIds },
            ],
          }
        : opportunity),
    };
    const plan = buildExecutableFuturePlan({ report: futuresQaReport, graph, draft, productIntelligence: conceptualIntelligence });
    const knownPaths = new Set((futuresQaReport.analyzedFiles || futuresQaReport.sampleFiles).map(file => file.path));

    expect(plan.affectedRepositoryAreas.some(area => area.path === 'src/App.tsx')).toBe(true);
    expect(plan.affectedRepositoryAreas.filter(area => area.kind === 'existing-repository-area').every(area => Boolean(area.path && knownPaths.has(area.path)))).toBe(true);
    expect(plan.affectedRepositoryAreas.find(area => area.label === 'Environment preset configuration')).toMatchObject({ kind: 'likely-new-responsibility', path: undefined });
    expect(JSON.stringify(plan.affectedRepositoryAreas)).not.toContain('src/future');
  });

  it('retains evidence provenance, explicit human-review reasons, and repository-aware verification', () => {
    const { graph, draft, productIntelligence } = fixture(true);
    const plan = planFrom(graph, draft, productIntelligence);

    expect(plan.evidence.some(item => item.path === 'README.md')).toBe(true);
    expect(plan.implementationStages.filter(stage => stage.kind !== 'verification').some(stage => stage.evidenceIds.length > 0)).toBe(true);
    expect(plan.humanReviewRequired).toBe(true);
    expect(plan.reviewGates).toHaveLength(1);
    expect(plan.reviewGates).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'authentication', reason: expect.stringContaining('Authentication and session behavior') })]));
    expect(plan.implementationStages.map(stage => stage.kind)).toContain('review');
    expect(plan.verificationPlan.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'npm test' }),
      expect.objectContaining({ command: 'npm run build' }),
      expect.objectContaining({ kind: 'product-acceptance' }),
      expect.objectContaining({ kind: 'review' }),
    ]));
  });

  it('renders Codex, Claude Code, and Markdown from one canonical model without a provider or repository mutation', () => {
    const { graph, draft, productIntelligence } = fixture();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const graphBefore = structuredClone(graph);
    const draftBefore = structuredClone(draft);
    const intelligenceBefore = structuredClone(productIntelligence);
    const plan = planFrom(graph, draft, productIntelligence);
    const codex = renderCodexFuturePlanPrompt(plan);
    const claude = renderClaudeCodeFuturePlanPrompt(plan);
    const markdown = renderExecutableFuturePlanMarkdown(plan);

    for (const value of [codex, claude, markdown]) {
      expect(value).toContain(plan.objective);
      expect(value).toContain(plan.primaryFuture.title);
      plan.implementationStages.forEach(stage => expect(value).toContain(stage.title));
      plan.requiredCapabilities.forEach(capability => expect(value).toContain(capability.title));
      expect(value).not.toMatch(/\bevidence:[^\s,]+/i);
      expect(value).not.toContain('[object Object]');
      expect(value).not.toContain('undefined');
    }
    expect([codex, claude, markdown].some(value => value.includes('Repository path:'))).toBe(true);
    expect(codex).toContain('Use repository-native inspection and editing tools.');
    expect(claude).toContain('Read repository guidance files before editing');
    expect(markdown).toContain('does not execute an agent, mutate the repository');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(graph).toEqual(graphBefore);
    expect(draft).toEqual(draftBefore);
    expect(productIntelligence).toEqual(intelligenceBefore);
    fetchSpy.mockRestore();
  });

  it('preserves canonical semantic prose beyond the former compact boundaries through plan and agent exports', () => {
    const { graph, draft, productIntelligence } = fixture();
    const primarySourceId = graph.candidates.find(candidate => candidate.id === draft.primaryGoal.candidateId)?.sourceId;
    const statement = 'Create a repository-grounded coordination workspace that preserves ownership, rationale, implementation boundaries, and acceptance evidence through every handoff so a developer can begin safely without reconstructing the product decision.';
    const userValue = 'Developers receive a complete and reviewable route from the selected product direction to repository changes, explicit constraints, and verification outcomes while retaining the context needed to stop at human-review boundaries.';
    const rationale = 'The current repository already exposes the relevant workflow and persistence seams, making this a grounded extension while keeping the proposed coordination responsibility distinct from existing files and behavior.';
    const capabilityRationale = 'A durable decision record must connect each accepted choice to repository evidence, ownership, implementation scope, and the verification result that closes the work.';
    const verification = 'Verify that the same accepted decision, owner, repository scope, and evidence-backed outcome remain available after the workspace is reopened and that no proposed responsibility is presented as an existing file.';
    expect(statement.length).toBeGreaterThan(180);
    expect(userValue.length).toBeGreaterThan(130);
    const semanticIntelligence = {
      ...productIntelligence,
      fingerprint: 'product-intelligence:semantic-completeness-v4',
      opportunities: productIntelligence.opportunities.map(opportunity => opportunity.id === primarySourceId
        ? {
            ...opportunity,
            opportunityStatement: statement,
            userValue,
            whyItFits: rationale,
            strategicRationale: rationale,
            verificationConcept: verification,
            requiredNewCapabilities: opportunity.requiredNewCapabilities.map((capability, index) => index === 0
              ? { ...capability, rationale: capabilityRationale }
              : capability),
          }
        : opportunity),
    };
    const semanticGraph = buildRepositoryFuturePathwaysGraph(
      futuresQaReport,
      buildRepositoryUniverseModel(futuresQaReport),
      semanticIntelligence,
    );
    const semanticPrimary = semanticGraph.nodes.find(node => node.kind === 'future-goal'
      && semanticGraph.candidates.find(candidate => candidate.id === node.candidateId)?.sourceId === primarySourceId);
    const semanticDraftResult = synthesizeRepositoryFutureDraft(semanticGraph, {
      sourceGraphFingerprint: semanticGraph.fingerprint,
      primaryGoalIds: [semanticPrimary!.id],
      supportingGoalIds: [],
    });
    expect(semanticDraftResult.ok).toBe(true);
    if (!semanticDraftResult.ok) return;
    const plan = buildExecutableFuturePlan({ report: futuresQaReport, graph: semanticGraph, draft: semanticDraftResult.draft, productIntelligence: semanticIntelligence });
    const internalPlan = JSON.stringify(plan);
    const artifacts = [
      renderCodexFuturePlanPrompt(plan),
      renderClaudeCodeFuturePlanPrompt(plan),
      renderExecutableFuturePlanMarkdown(plan),
    ];
    for (const value of [internalPlan, ...artifacts]) {
      expect(value).toContain(statement);
      expect(value).toContain(userValue);
      expect(value).toContain(rationale);
      expect(value).toContain(verification);
    }
    for (const artifact of artifacts) {
      expect(artifact).not.toMatch(/\bevidence:[^\s,]+/i);
      expect(artifact).not.toContain('[object Object]');
      expect(artifact).not.toContain('undefined');
    }
    expect(internalPlan).toContain(capabilityRationale);
    expect(artifacts.every(artifact => artifact.includes(capabilityRationale))).toBe(true);
  });

  it('recomposes from the cached graph for repeated Primary and Support choices without any provider request', () => {
    const { graph, draft, productIntelligence, productGoals } = fixture();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let currentDraft = draft;
    const fingerprints = new Set<string>();
    for (const goalId of productGoals.slice(0, 3)) {
      const replaced = replaceRepositoryFuturePrimary(graph, currentDraft, goalId);
      expect(replaced.result.ok).toBe(true);
      if (!replaced.result.ok) continue;
      currentDraft = replaced.result.draft;
      fingerprints.add(planFrom(graph, currentDraft, productIntelligence).fingerprint);
    }
    const supportId = productGoals.find(goalId => goalId !== currentDraft.primaryGoal.goalId)!;
    currentDraft = addSupport(graph, currentDraft, supportId);
    fingerprints.add(planFrom(graph, currentDraft, productIntelligence).fingerprint);

    expect(fingerprints.size).toBeGreaterThan(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

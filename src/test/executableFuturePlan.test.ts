import { describe, expect, it, vi } from 'vitest';
import { futuresQaProductIntelligence, futuresQaReport } from '@/dev/RepositoryFuturesLayoutQa';
import {
  buildExecutableFuturePlan,
  buildRepositoryUniverseModel,
  renderAgentFuturePlanPrompt,
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

function wasteNotBenchmarkPlan() {
  const selectedTitle = 'Small business waste and cost analytics dashboard';
  const selectedSourceId = futuresQaProductIntelligence.opportunities[0].id;
  const productIntelligence = {
    ...futuresQaProductIntelligence,
    fingerprint: 'product-intelligence:wastenot-agent-prompt-benchmark',
    humanReviewRequired: true,
    opportunities: futuresQaProductIntelligence.opportunities.map(opportunity => opportunity.id === selectedSourceId
      ? {
          ...opportunity,
          title: selectedTitle,
          opportunityStatement: `Add a repository-grounded ${selectedTitle}.`,
          userValue: 'Small businesses can understand waste patterns and their cost impact without losing the evidence behind each metric.',
          whyItFits: 'The selected Future extends repository capabilities represented by the scan without asserting unverified implementation paths.',
          strategicRationale: 'Waste and cost signals become actionable when they are joined in one evidence-backed decision surface.',
          verificationConcept: 'Verify that waste and cost analytics remain traceable to repository-supported inputs and preserve existing behavior.',
          humanReviewRequirements: ['Data handling and client-facing analytics claims require qualified human approval before production verification.'],
        }
      : opportunity),
  };
  const graph = buildRepositoryFuturePathwaysGraph(
    futuresQaReport,
    buildRepositoryUniverseModel(futuresQaReport),
    productIntelligence,
  );
  const primary = graph.nodes.find(node => node.kind === 'future-goal'
    && graph.candidates.find(candidate => candidate.id === node.candidateId)?.sourceId === selectedSourceId);
  const support = graph.nodes.find(node => node.kind === 'future-goal'
    && graph.candidates.find(candidate => candidate.id === node.candidateId)?.candidateClass === 'product-opportunity'
    && node.id !== primary?.id);
  const initial = synthesizeRepositoryFutureDraft(graph, {
    sourceGraphFingerprint: graph.fingerprint,
    primaryGoalIds: [primary!.id],
    supportingGoalIds: [],
  });
  if (!initial.ok) throw new Error('Expected canonical WasteNot benchmark synthesis to succeed.');
  const plan = planFrom(graph, addSupport(graph, initial.draft, support!.id), productIntelligence);
  return {
    ...plan,
    repository: { ...plan.repository, name: 'Csisz/wastenot', branch: 'master' },
  };
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
    expect(codex).toContain('# OpenAI Codex execution task');
    expect(codex).toContain('Use repository-native search');
    expect(claude).toContain('# Claude Code repository task');
    expect(claude).toContain('Read CLAUDE.md and applicable AGENTS.md files before editing');
    expect(markdown).toContain('does not execute an agent, mutate the repository');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(graph).toEqual(graphBefore);
    expect(draft).toEqual(draftBefore);
    expect(productIntelligence).toEqual(intelligenceBefore);
    fetchSpy.mockRestore();
  });

  it('adapts one canonical plan for every agent and operating mode without inventing access or dropping safety gates', () => {
    const { graph, draft, productIntelligence } = fixture(true);
    const plan = planFrom(graph, draft, productIntelligence);
    const targets = ['chatgpt', 'codex', 'claude', 'claude-code', 'cursor', 'generic'] as const;
    const prompts = targets.map(target => renderAgentFuturePlanPrompt(plan, target, 'balanced-productivity'));

    prompts.forEach(prompt => {
      expect(prompt).toContain(plan.primaryFuture.title);
      expect(prompt).toContain(plan.reviewGates[0].reason);
      expect(prompt).toContain('qualified reviewer');
      expect(prompt).toContain('Do not invent repository paths, capabilities, tests, evidence, or verification outcomes.');
    });
    expect(prompts[0]).toContain('No direct repository access is assumed.');
    expect(prompts[0]).toContain('Required attachments:');
    expect(prompts[1]).toContain('Verify the active repository and branch/ref');

    const tokenSaver = renderAgentFuturePlanPrompt(plan, 'codex', 'token-saver');
    const reliability = renderAgentFuturePlanPrompt(plan, 'codex', 'maximum-reliability');
    expect(tokenSaver).toContain('Operating mode: Token Saver');
    expect(tokenSaver).toContain('Do not scan the whole repository unless needed.');
    expect(tokenSaver).toContain('A qualified reviewer must explicitly approve continuation.');
    expect(reliability).toContain('Operating mode: Maximum Reliability');
    expect(reliability).toContain('Run full test/build commands when the change touches shared logic');
    expect(reliability).not.toBe(tokenSaver);
  });

  it('produces deterministic and operationally distinct WasteNot prompts for all six agents and three operating modes', () => {
    const plan = wasteNotBenchmarkPlan();
    const targets = ['chatgpt', 'codex', 'claude', 'claude-code', 'cursor', 'generic'] as const;
    const modes = ['balanced-productivity', 'token-saver', 'maximum-reliability'] as const;
    const structuralMarkers = {
      chatgpt: ['# ChatGPT collaborative implementation brief', '## Collaborative workflow', 'Patch-ready edits or change specification'],
      codex: ['# OpenAI Codex execution task', '## Inspect before editing', '## Execute in dependency order'],
      claude: ['# Claude structured implementation analysis', '## Evidence and assumptions ledger', '## Verification argument'],
      'claude-code': ['# Claude Code repository task', '## Repository startup protocol', '## Checkpointed implementation'],
      cursor: ['# Cursor targeted editing brief', '## Open and locate', '## Incremental edit passes'],
      generic: ['# Portable implementation specification', '## Required capabilities and inputs', '## Universal constraints'],
    } as const;

    const prompts = new Map<string, string>();
    for (const target of targets) {
      for (const mode of modes) {
        const key = `${target}:${mode}`;
        const prompt = renderAgentFuturePlanPrompt(plan, target, mode);
        prompts.set(key, prompt);
        expect(renderAgentFuturePlanPrompt(plan, target, mode)).toBe(prompt);
        expect(prompt).toContain('Csisz/wastenot');
        expect(prompt).toContain('Small business waste and cost analytics dashboard');
        plan.supportingFutures.forEach(future => expect(prompt).toContain(future.title));
        plan.requiredCapabilities.forEach(capability => {
          expect(prompt).toContain(capability.title);
          expect(prompt).toContain(capability.rationale);
        });
        plan.affectedRepositoryAreas.filter(area => area.path).forEach(area => expect(prompt).toContain(area.path!));
        plan.evidence.filter(item => item.path).forEach(item => expect(prompt).toContain(item.path!));
        plan.reviewGates.forEach(gate => expect(prompt).toContain(gate.reason));
        plan.verificationPlan.checks.forEach(check => {
          expect(prompt).toContain(check.title);
          if (check.command) expect(prompt).toContain(check.command);
        });
        expect(prompt).toContain('Do not create or update branches, commits, pushes, pull requests, merges, releases, or deployments without explicit authorization.');
        expect(prompt).toContain('This is not legal advice.');
        expect(prompt).not.toContain('## 1. Repository identity and scan context');
        expect(prompt).not.toContain('[object Object]');
        expect(prompt).not.toContain('undefined');
      }

      structuralMarkers[target].forEach(marker => expect(prompts.get(`${target}:balanced-productivity`)).toContain(marker));
      expect(prompts.get(`${target}:token-saver`)!.length).toBeLessThan(prompts.get(`${target}:balanced-productivity`)!.length * 0.92);
      expect(prompts.get(`${target}:maximum-reliability`)!.length).toBeGreaterThan(prompts.get(`${target}:balanced-productivity`)!.length);
      expect(prompts.get(`${target}:maximum-reliability`)).toContain(plan.repository.sourceScanFingerprint);
    }

    const balancedPrompts = targets.map(target => prompts.get(`${target}:balanced-productivity`)!);
    expect(new Set(balancedPrompts).size).toBe(targets.length);
    expect(prompts.get('chatgpt:balanced-productivity')).toContain('No direct repository access is assumed.');
    expect(prompts.get('chatgpt:balanced-productivity')).toContain('Required attachments:');
    expect(prompts.get('claude:balanced-productivity')).toContain('Classify every implementation claim as verified, inferred, or blocked by missing context.');
    expect(prompts.get('codex:balanced-productivity')).toContain('Use repository-native search');
    expect(prompts.get('claude-code:balanced-productivity')).toContain('Read CLAUDE.md and applicable AGENTS.md');
    expect(prompts.get('cursor:balanced-productivity')).toContain('symbol/reference search');
    expect(prompts.get('generic:balanced-productivity')).toContain('declare available capabilities');
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

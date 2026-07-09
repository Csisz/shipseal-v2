import { describe, expect, it } from 'vitest';
import { buildDeliveryPackFiles } from '@/lib/deliveryPack';
import { buildScoreJson } from '@/lib/exports';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import {
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  serializeRepositoryOptimizationManifest,
  type RepositoryTransformationProposal,
} from '@/lib/workspace';

function modestReport() {
  return buildReport({
    repoName: 'optimization-plan-test',
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 240 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/App.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 160 },
    ],
    textContents: {
      'README.md': '# Optimization Plan Test\n\nUse npm test before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function workspaceFor(report: ReturnType<typeof buildReport>) {
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  return { universe, atlas, transformation };
}

function planFor(report: ReturnType<typeof buildReport>, excludedProposalIds: string[] = []) {
  const { universe, atlas, transformation } = workspaceFor(report);
  return {
    universe,
    atlas,
    transformation,
    plan: buildRepositoryOptimizationPlan({ report, universe, atlas, transformation, excludedProposalIds }),
  };
}

function generatedContentFor(report: ReturnType<typeof buildReport>, path: string) {
  const scoreJson = buildScoreJson(report, { selectedPackages: ['agent-readiness', 'testing-red-team'] });
  return buildDeliveryPackFiles({
    agentFiles: report.agentPack,
    mcpFiles: report.mcpReadiness.generatedFiles,
    contextFiles: { markdown: report.contextPack, json: report.repoContextPack },
    repositoryName: report.repoName,
    scoreJson,
    repositoryHealth: report.repositoryHealth,
    selectedPackages: ['agent-readiness', 'testing-red-team'],
  }).find(file => file.path === path)?.content;
}

describe('Repository Optimization Plan model', () => {
  it('uses deterministic plan IDs, item ordering and manifest ordering', () => {
    const report = modestReport();
    const first = planFor(report).plan;
    const second = planFor(report).plan;

    expect(first.id).toBe(second.id);
    expect(first.items.map(item => item.id)).toEqual(second.items.map(item => item.id));
    expect(first.items.map(item => item.artifact.path)).toEqual([...first.items.map(item => item.artifact.path)].sort((left, right) => left.localeCompare(right)));
    expect(serializeRepositoryOptimizationManifest(first.manifest)).toBe(serializeRepositoryOptimizationManifest(second.manifest));
    expect(first.manifest.artifacts.map(artifact => artifact.path)).toEqual(first.items.map(item => item.artifact.path));
  });

  it('keeps excluded proposals out of the active plan and restores them deterministically when re-included', () => {
    const report = modestReport();
    const { transformation } = workspaceFor(report);
    const excludedProposal = transformation.proposals[0];
    const active = planFor(report).plan;
    const excluded = planFor(report, [excludedProposal.id]).plan;
    const restored = planFor(report).plan;

    expect(active.summary.selectedProposalCount).toBeGreaterThan(excluded.summary.selectedProposalCount);
    expect(excluded.excludedProposalIds).toEqual([excludedProposal.id]);
    expect(excluded.items.every(item => !item.proposalIds.includes(excludedProposal.id))).toBe(true);
    expect(restored.items.map(item => item.id)).toEqual(active.items.map(item => item.id));
  });

  it('deduplicates duplicate artifact paths while preserving contributing proposal IDs', () => {
    const report = modestReport();
    const { universe, atlas, transformation } = workspaceFor(report);
    const source = transformation.proposals.find(proposal => proposal.artifactActions.some(action => action.path === '07-context/TASK_ROUTER.md'));
    expect(source).toBeDefined();
    const duplicate: RepositoryTransformationProposal = {
      ...source!,
      id: 'agent-routing-task-router-duplicate',
      title: 'Duplicate task router contributor',
    };
    const duplicatedTransformation = { ...transformation, proposals: [...transformation.proposals, duplicate] };
    const duplicatedPlan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation: duplicatedTransformation });
    const taskRouter = duplicatedPlan.items.find(item => item.artifact.path === '07-context/TASK_ROUTER.md');

    expect(taskRouter).toBeDefined();
    expect(taskRouter?.proposalIds).toEqual(expect.arrayContaining([source!.id, duplicate.id]));
    expect(duplicatedPlan.items.filter(item => item.artifact.path === '07-context/TASK_ROUTER.md')).toHaveLength(1);
    expect(taskRouter?.conflicts.some(conflict => conflict.kind === 'duplicate-target')).toBe(true);

    const oneContributorRemoved = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation: duplicatedTransformation,
      excludedProposalIds: [duplicate.id],
    });
    expect(oneContributorRemoved.items.find(item => item.artifact.path === '07-context/TASK_ROUTER.md')).toBeDefined();
    expect(oneContributorRemoved.items.find(item => item.artifact.path === '07-context/TASK_ROUTER.md')?.proposalIds).toEqual([source!.id]);
  });

  it('uses truthful create, update and strengthen semantics from repository evidence', () => {
    const absentAgents = planFor(modestReport()).plan.items.find(item => item.artifact.path === '01-agent-instructions/AGENTS.md');
    expect(absentAgents?.artifact.action).toBe('create');

    const existingAgentsReport = buildReport({
      repoName: 'existing-agents',
      files: [
        { path: 'README.md', size: 120 },
        { path: 'AGENTS.md', size: 220 },
        { path: 'package.json', size: 220 },
        { path: 'src/index.ts', size: 220 },
      ],
      textContents: {
        'README.md': '# Existing Agents',
        'AGENTS.md': '# AGENTS\nKeep changes small.',
        'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      },
    });
    const existingAgents = planFor(existingAgentsReport).plan.items.find(item => item.artifact.path === '01-agent-instructions/AGENTS.md');
    expect(existingAgents?.artifact.action).toBe('strengthen');
    expect(existingAgents?.readiness).toBe('review-required');
    expect(existingAgents?.conflicts.some(conflict => conflict.kind === 'exact-existing-path')).toBe(true);
  });

  it('marks unsupported and unresolved artifacts as blocked without removing unrelated valid items', () => {
    const report = modestReport();
    const { universe, atlas, transformation } = workspaceFor(report);
    const source = transformation.proposals[0];
    const unsupported: RepositoryTransformationProposal = {
      ...source,
      id: 'project-memory-unsupported-artifact',
      artifactActions: [{
        action: 'create',
        path: '99-unsupported/UNAVAILABLE.md',
        outputId: '99-unsupported/UNAVAILABLE.md',
        description: 'Unsupported output used to verify blocked plan handling.',
      }],
    };
    const unresolvedFolder: RepositoryTransformationProposal = {
      ...source,
      id: 'agent-routing-unresolved-folder',
      domain: 'agent-routing',
      artifactActions: [{
        action: 'create',
        path: '07-context/folder-agents/missing-folder/AGENTS.md',
        outputId: '07-context/folder-agents/missing-folder/AGENTS.md',
        description: 'Unresolved folder-level AGENTS.md output.',
      }],
    };
    const plan = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation: { ...transformation, proposals: [...transformation.proposals, unsupported, unresolvedFolder] },
    });

    expect(plan.items.find(item => item.artifact.path === '99-unsupported/UNAVAILABLE.md')?.readiness).toBe('blocked');
    expect(plan.items.find(item => item.artifact.path === '07-context/folder-agents/missing-folder/AGENTS.md')?.readiness).toBe('blocked');
    expect(plan.items.some(item => item.readiness !== 'blocked')).toBe(true);
  });

  it('uses content from the existing Delivery Pack generator path and exposes matching previews', () => {
    const report = modestReport();
    const plan = planFor(report).plan;
    const testingStrategy = plan.items.find(item => item.artifact.path === '04-testing/TESTING_STRATEGY.md');
    const generated = generatedContentFor(report, '04-testing/TESTING_STRATEGY.md');

    expect(testingStrategy).toBeDefined();
    expect(testingStrategy?.artifact.content).toBe(generated);
    expect(testingStrategy?.artifact.excerpt).toBe(String(generated).slice(0, testingStrategy.artifact.excerpt.length));
    expect(testingStrategy?.artifact.source).toBe('shipseal-delivery-pack-generator');
  });

  it('prepares manifest entries for unique selected artifacts only', () => {
    const report = buildSampleReport();
    const plan = planFor(report).plan;

    expect(plan.manifest.schemaVersion).toBe('shipseal.repository-optimization-plan.v1');
    expect(plan.manifest.artifactCount).toBe(plan.items.length);
    expect(new Set(plan.manifest.artifacts.map(artifact => artifact.path)).size).toBe(plan.manifest.artifacts.length);
    expect(plan.manifest.selectedProposalIds).toEqual([...plan.manifest.selectedProposalIds].sort());
    expect(plan.manifest.artifacts.every(artifact => artifact.contributingProposalIds.length > 0)).toBe(true);
  });

  it('does not mutate canonical Repository Universe or Atlas graphs', () => {
    const report = modestReport();
    const { universe, atlas, transformation } = workspaceFor(report);
    const universeNodeIds = universe.nodes.map(node => node.id);
    const atlasNodeIds = atlas.nodes.map(node => node.id);

    buildRepositoryOptimizationPlan({ report, universe, atlas, transformation });

    expect(universe.nodes.map(node => node.id)).toEqual(universeNodeIds);
    expect(atlas.nodes.map(node => node.id)).toEqual(atlasNodeIds);
  });
});

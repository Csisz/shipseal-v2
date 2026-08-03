import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import {
  buildRepositoryActionableImprovements,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  prepareRepositoryOptimizationPlan,
  validateRepositoryOptimizationPlan,
  type RepositoryOptimizationPlan,
  type RepositoryTransformationProposal,
} from '@/lib/workspace';

function fixture() {
  const report = buildReport({
    repoName: 'actionable-loop-test',
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 240 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/App.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 160 },
    ],
    textContents: {
      'README.md': '# Actionable Loop\n\nUse npm test before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  const plan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation });
  return { report, universe, atlas, transformation, plan };
}

function planWithItem(plan: RepositoryOptimizationPlan, mutate: (item: RepositoryOptimizationPlan['items'][number]) => RepositoryOptimizationPlan['items'][number]) {
  const items = [mutate(plan.items[0]), ...plan.items.slice(1)];
  return { ...plan, items, artifacts: items.map(item => item.artifact) };
}

describe('Actionable Improvement loop model', () => {
  it('maps every production proposal to evidence, affected entities, artifacts, and verification', () => {
    const { transformation, plan } = fixture();
    const improvements = buildRepositoryActionableImprovements({ transformation, plan });

    expect(improvements).toHaveLength(transformation.proposals.length);
    expect(improvements.every(improvement => improvement.evidence.length > 0 || improvement.support === 'unsupported')).toBe(true);
    expect(improvements.filter(improvement => improvement.support === 'actionable').every(improvement => improvement.artifacts.length > 0)).toBe(true);
    expect(improvements.filter(improvement => improvement.support === 'actionable').every(improvement => improvement.affectedEntities.length > 0)).toBe(true);
    expect(improvements.every(improvement => improvement.verification.expectation && improvement.verification.method)).toBe(true);
    expect(
      improvements.every(improvement =>
        improvement.evidence.every(evidence => ['evidence-backed', 'heuristic'].includes(evidence.kind))
      )
    ).toBe(true);
  });

  it('labels low-confidence evidence as heuristic without presenting it as direct scan proof', () => {
    const { report, universe, atlas, transformation } = fixture();
    const proposal = transformation.proposals[0];
    const heuristicProposal = {
      ...proposal,
      confidence: 'low' as const,
      evidenceType: 'heuristic' as const,
      sourceEvidence: proposal.sourceEvidence.map(evidence => ({ ...evidence, state: 'heuristic' as const })),
    };
    const adjusted = {
      ...transformation,
      proposals: [heuristicProposal, ...transformation.proposals.slice(1)],
    };
    const plan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation: adjusted });
    const improvement = buildRepositoryActionableImprovements({ transformation: adjusted, plan })
      .find(item => item.id === heuristicProposal.id)!;

    expect(improvement.evidence.every(evidence => evidence.kind === 'heuristic')).toBe(true);
    expect(improvement.evidence.every(evidence => evidence.confidence === 0.45)).toBe(true);
  });

  it('keeps unsupported proposals unresolved and out of the included actionable set', () => {
    const { report, universe, atlas, transformation } = fixture();
    const unsupported: RepositoryTransformationProposal = {
      ...transformation.proposals[0],
      id: 'unsupported-without-evidence',
      sourceEvidence: [],
      artifactActions: [],
      graphChanges: { proposedNodes: [], proposedEdges: [], affectedExistingNodeIds: [] },
    };
    const extended = { ...transformation, proposals: [...transformation.proposals, unsupported] };
    const plan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation: extended });
    const improvement = buildRepositoryActionableImprovements({ transformation: extended, plan })
      .find(item => item.id === unsupported.id);
    const validation = validateRepositoryOptimizationPlan({
      ...plan,
      manifest: {
        ...plan.manifest,
        selectedProposalIds: [...plan.manifest.selectedProposalIds, unsupported.id],
      },
    });

    expect(improvement).toMatchObject({ support: 'unsupported', lifecycle: 'unresolved', included: false });
    expect(improvement?.unsupportedReason).toMatch(/evidence/i);
    expect(plan.manifest.selectedProposalIds).not.toContain(unsupported.id);
    expect(validation.canPrepare).toBe(false);
    expect(validation.issues.some(issue => issue.proposalIds.includes(unsupported.id))).toBe(true);
  });

  it('derives lifecycle without treating proposed, prepared, applied, and verified as equivalent', () => {
    const { transformation, plan } = fixture();
    const proposalId = transformation.proposals[0].id;
    const proposed = buildRepositoryActionableImprovements({ transformation, plan }).find(item => item.id === proposalId);
    const prepared = buildRepositoryActionableImprovements({ transformation, plan, preparedProposalIds: [proposalId] }).find(item => item.id === proposalId);
    const applied = buildRepositoryActionableImprovements({ transformation, plan, appliedProposalIds: [proposalId] }).find(item => item.id === proposalId);
    const verified = buildRepositoryActionableImprovements({ transformation, plan, verifiedProposalIds: [proposalId] }).find(item => item.id === proposalId);

    expect([proposed?.lifecycle, prepared?.lifecycle, applied?.lifecycle, verified?.lifecycle]).toEqual(['proposed', 'prepared', 'applied', 'verified']);
  });

  it('validates successful plans and preserves one prepared output for ZIP and PR previews', () => {
    const { plan } = fixture();
    const validation = validateRepositoryOptimizationPlan(plan);
    const result = prepareRepositoryOptimizationPlan(plan, { githubAvailable: true });

    expect(validation.canPrepare).toBe(true);
    expect(['ready-for-preview', 'needs-review']).toContain(validation.readiness);
    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') return;
    expect(result.prepared.sourcePlanId).toBe(plan.id);
    expect(result.prepared.applyPlan.manifest.selectedProposalIds).toEqual(plan.manifest.selectedProposalIds);
    expect(result.prepared.applyPlan.prPreview.files.map(file => file.generatedPath))
      .toEqual(result.prepared.applyPlan.files.filter(file => file.includeInPr).map(file => file.generatedPath));
    expect(result.prepared.applyPlan.manifest.filesIncludedInZip.map(file => file.generatedPath))
      .toEqual(result.prepared.applyPlan.files.filter(file => file.includeInZip).map(file => file.generatedPath));
  });

  it('blocks forbidden paths, invalid content, action mismatches, and unsupported outputs', () => {
    const { plan } = fixture();
    const unsafe = planWithItem(plan, item => ({
      ...item,
      artifact: {
        ...item.artifact,
        repositoryDestinationPath: '.env',
        action: 'update',
        content: '',
      },
    }));
    const validation = validateRepositoryOptimizationPlan(unsafe);

    expect(validation.canPrepare).toBe(false);
    expect(validation.issues.map(issue => issue.kind)).toEqual(expect.arrayContaining([
      'forbidden-destination',
      'invalid-generated-content',
      'action-evidence-mismatch',
    ]));
    expect(prepareRepositoryOptimizationPlan(unsafe).status).toBe('blocked');
  });

  it('surfaces duplicate destinations as review-required instead of duplicating package files', () => {
    const { report, universe, atlas, transformation } = fixture();
    const source = transformation.proposals.find(proposal => proposal.artifactActions.length > 0)!;
    const duplicate = { ...source, id: `${source.id}-duplicate` };
    const plan = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation: { ...transformation, proposals: [...transformation.proposals, duplicate] },
    });
    const validation = validateRepositoryOptimizationPlan(plan);

    expect(validation.issues.some(issue => issue.kind === 'duplicate-target' && issue.severity === 'review-required')).toBe(true);
    expect(new Set(plan.items.map(item => item.artifact.path)).size).toBe(plan.items.length);
  });

  it('invalidates a prepared snapshot when plan selection changes', () => {
    const { report, universe, atlas, transformation, plan } = fixture();
    const result = prepareRepositoryOptimizationPlan(plan);
    const changed = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation,
      excludedProposalIds: [transformation.proposals[0].id],
    });

    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') return;
    expect(changed.id).not.toBe(result.prepared.sourcePlanId);
  });
});

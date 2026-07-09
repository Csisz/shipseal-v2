import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import {
  buildOptimizationApplyPlan,
  buildOptimizationPackZipBlob,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  optimizationPackZipFiles,
  type RepositoryTransformationProposal,
} from '@/lib/workspace';

function reportWithExistingAgents() {
  return buildReport({
    repoName: 'apply-flow-test',
    files: [
      { path: 'README.md', size: 220 },
      { path: 'AGENTS.md', size: 180 },
      { path: 'package.json', size: 240 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/App.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 160 },
    ],
    textContents: {
      'README.md': '# Apply Flow Test\n\nUse npm test before release.',
      'AGENTS.md': '# AGENTS\nKeep changes small.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function planFor(report = reportWithExistingAgents(), extraProposals: RepositoryTransformationProposal[] = []) {
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  return buildRepositoryOptimizationPlan({
    report,
    universe,
    atlas,
    transformation: { ...transformation, proposals: [...transformation.proposals, ...extraProposals] },
  });
}

describe('Repository Optimization Apply model', () => {
  it('builds a deterministic Optimization Pack manifest, instructions and review notes from selected artifacts', () => {
    const plan = planFor();
    const applyPlan = buildOptimizationApplyPlan(plan, { githubUnavailableReason: 'Manual flow only.' });
    const zipFiles = optimizationPackZipFiles(applyPlan);

    expect(applyPlan.modelVersion).toBe('optimization-apply-plan.v1');
    expect(applyPlan.manifest.schemaVersion).toBe('shipseal.optimization-pack.v1');
    expect(applyPlan.summary.selectedArtifactCount).toBe(plan.items.length);
    expect(zipFiles.map(file => file.path)).toEqual([...zipFiles.map(file => file.path)].sort((left, right) => left.localeCompare(right)));
    expect(zipFiles.some(file => file.path === 'optimization-manifest.json')).toBe(true);
    expect(zipFiles.some(file => file.path === 'APPLY_INSTRUCTIONS.md')).toBe(true);
    expect(zipFiles.some(file => file.path === 'REVIEW_NOTES.md')).toBe(true);
    expect(applyPlan.applyInstructions).toContain('This ZIP did not change repository files.');
    expect(applyPlan.applyInstructions).toContain('git checkout -b shipseal/optimization-pack');
    expect(applyPlan.reviewNotes).toContain('No repository files have been changed.');
  });

  it('keeps excluded proposals out of package files and manifest selection', () => {
    const report = reportWithExistingAgents();
    const universe = buildRepositoryUniverseModel(report);
    const atlas = buildRepositoryAtlasModel(report);
    const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
    const excludedProposalId = transformation.proposals[0].id;
    const plan = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation,
      excludedProposalIds: [excludedProposalId],
    });
    const applyPlan = buildOptimizationApplyPlan(plan);

    expect(applyPlan.manifest.selectedProposalIds).not.toContain(excludedProposalId);
    expect(applyPlan.files.every(file => !file.contributingProposalIds.includes(excludedProposalId))).toBe(true);
    expect(JSON.stringify(optimizationPackZipFiles(applyPlan))).not.toContain(excludedProposalId);
  });

  it('deduplicates duplicate package paths without losing both selected artifacts from the manifest', () => {
    const report = reportWithExistingAgents();
    const plan = planFor(report);
    const applyPlan = buildOptimizationApplyPlan(plan);
    const normalFilePaths = optimizationPackZipFiles(applyPlan)
      .filter(file => !['optimization-manifest.json', 'APPLY_INSTRUCTIONS.md', 'REVIEW_NOTES.md'].includes(file.path))
      .map(file => file.path);

    expect(new Set(normalFilePaths).size).toBe(normalFilePaths.length);
    expect(applyPlan.manifest.filesIncludedInZip.map(file => file.zipPath)).toEqual(normalFilePaths.sort((left, right) => left.localeCompare(right)));
    expect(applyPlan.manifest.filesIncludedInZip.filter(file => file.destinationPath === 'AGENTS.md').length).toBeGreaterThanOrEqual(1);
  });

  it('places review-required files under review-required paths and keeps blocked files out of normal ZIP and PR files', () => {
    const report = reportWithExistingAgents();
    const universe = buildRepositoryUniverseModel(report);
    const atlas = buildRepositoryAtlasModel(report);
    const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
    const source = transformation.proposals[0];
    const unsupported: RepositoryTransformationProposal = {
      ...source,
      id: 'apply-flow-unsupported-output',
      title: 'Unsupported output',
      summary: 'Unsupported output used to verify blocked apply handling.',
      artifactActions: [{
        action: 'create',
        path: '99-unsupported/UNAVAILABLE.md',
        outputId: '99-unsupported/UNAVAILABLE.md',
        description: 'Unsupported output used to verify blocked apply handling.',
      }],
    };
    const plan = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation: { ...transformation, proposals: [...transformation.proposals, unsupported] },
    });
    const applyPlan = buildOptimizationApplyPlan(plan, { githubAvailable: true });
    const zipFilePaths = optimizationPackZipFiles(applyPlan).map(file => file.path);

    expect(applyPlan.files.some(file => file.zipPath === 'review-required/AGENTS.md')).toBe(true);
    expect(zipFilePaths.some(path => path.includes('99-unsupported/UNAVAILABLE.md'))).toBe(false);
    expect(applyPlan.prPreview.files.some(file => file.generatedPath === '99-unsupported/UNAVAILABLE.md')).toBe(false);
    expect(applyPlan.prPreview.blockedFiles.some(file => file.generatedPath === '99-unsupported/UNAVAILABLE.md')).toBe(true);
    expect(applyPlan.manifest.blockedOrUnavailable.some(file => file.generatedPath === '99-unsupported/UNAVAILABLE.md')).toBe(true);
  });

  it('previews a GitHub App PR without introducing a second scoring or repository analysis path', () => {
    const plan = planFor();
    const applyPlan = buildOptimizationApplyPlan(plan, { githubAvailable: true });

    expect(applyPlan.prPreview.canUseGitHubApp).toBe(true);
    expect(applyPlan.prPreview.branchName).toBe('shipseal/optimization-pack');
    expect(applyPlan.prPreview.title).toBe('Add ShipSeal optimization pack');
    expect(applyPlan.prPreview.body).toContain('ShipSeal did not execute repository code and did not verify improvements.');
    expect(applyPlan.prPreview.files.map(file => file.path)).toEqual(applyPlan.files.filter(file => file.includeInPr).map(file => file.prPath));
    expect(applyPlan.prPreview.files.every(file => file.content.length > 0)).toBe(true);
  });

  it('creates a ZIP whose file list and manifest match the apply plan', async () => {
    const plan = planFor();
    const applyPlan = buildOptimizationApplyPlan(plan);
    const expectedPaths = optimizationPackZipFiles(applyPlan).map(file => file.path);
    const zip = await JSZip.loadAsync(await buildOptimizationPackZipBlob(applyPlan));
    const actualPaths = Object.keys(zip.files).filter(path => !zip.files[path].dir).sort((left, right) => left.localeCompare(right));
    const manifest = JSON.parse(await zip.file('optimization-manifest.json')!.async('string'));

    expect(actualPaths).toEqual(expectedPaths);
    expect(manifest).toEqual(applyPlan.manifest);
    expect(await zip.file('APPLY_INSTRUCTIONS.md')!.async('string')).toContain('Generated files must be reviewed before copying');
  });
});

import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import {
  buildOptimizationApplyPlan,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  buildRepositoryVerificationBaseline,
  buildRepositoryVerificationResult,
  type RepositoryTransformationProposal,
} from '@/lib/workspace';

function baseReport() {
  return buildReport({
    repoName: 'verification-loop',
    source: { sourceType: 'zip-upload' },
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 240 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/App.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 160 },
    ],
    textContents: {
      'README.md': '# Verification Loop\n\nUse npm test before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function reportWithFiles(files: string[], repoName = 'verification-loop') {
  return buildReport({
    repoName,
    source: { sourceType: 'zip-upload' },
    files: files.map(path => ({ path, size: 240 })),
    textContents: {
      'README.md': '# Verification Loop\n\nUse npm test before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function applyPlanFor(report = baseReport(), extraProposals: RepositoryTransformationProposal[] = []) {
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  const plan = buildRepositoryOptimizationPlan({
    report,
    universe,
    atlas,
    transformation: { ...transformation, proposals: [...transformation.proposals, ...extraProposals] },
  });
  return { universe, atlas, transformation, plan, applyPlan: buildOptimizationApplyPlan(plan) };
}

describe('Repository Verification model', () => {
  it('creates deterministic baselines from an Optimization Apply Plan', () => {
    const report = baseReport();
    const { applyPlan } = applyPlanFor(report);
    const first = buildRepositoryVerificationBaseline({ report, applyPlan, method: 'zip-download' });
    const second = buildRepositoryVerificationBaseline({ report, applyPlan, method: 'zip-download' });

    expect(first.id).toBe(second.id);
    expect(first.schemaVersion).toBe('shipseal.repository-verification-baseline.v1');
    expect(first.selectedProposalIds).toEqual([...first.selectedProposalIds].sort());
    expect(first.artifacts.map(artifact => artifact.destinationPath)).toEqual([...first.artifacts.map(artifact => artifact.destinationPath)].sort());
    expect(first.baselineFilePaths).toContain('README.md');
  });

  it('matches the same repository and rejects unrelated repositories', () => {
    const report = baseReport();
    const { applyPlan } = applyPlanFor(report);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan });
    const same = buildRepositoryVerificationResult({ baseline, currentReport: reportWithFiles(['README.md', 'package.json', 'src/App.tsx', 'AGENTS.md']) });
    const different = buildRepositoryVerificationResult({ baseline, currentReport: reportWithFiles(['README.md'], 'other-repository') });

    expect(same.status).toBe('matched-rescan');
    expect(same.repositoryMatch.matches).toBe(true);
    expect(different.status).toBe('repository-mismatch');
    expect(different.repositoryMatch.matches).toBe(false);
    expect(different.limitations).toContain('This scan does not match the saved optimization baseline.');
  });

  it('detects create artifacts when absent before and present after rescan', () => {
    const report = baseReport();
    const { applyPlan } = applyPlanFor(report);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan, method: 'zip-download' });
    const result = buildRepositoryVerificationResult({
      baseline,
      currentReport: reportWithFiles(['README.md', 'package.json', 'src/App.tsx', 'src/App.test.tsx', '.github/workflows/ci.yml', 'AGENTS.md']),
    });
    const agents = result.artifacts.find(artifact => artifact.destinationPath === 'AGENTS.md' && artifact.action === 'create');

    expect(agents?.state).toBe('verified-file-presence');
    expect(agents?.label).toBe('Detected after rescan');
    expect(result.counts.detected).toBeGreaterThan(0);
  });

  it('keeps absent create artifacts as not detected', () => {
    const report = baseReport();
    const { applyPlan } = applyPlanFor(report);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan });
    const result = buildRepositoryVerificationResult({ baseline, currentReport: reportWithFiles(['README.md', 'package.json', 'src/App.tsx']) });
    const agents = result.artifacts.find(artifact => artifact.destinationPath === 'AGENTS.md' && artifact.action === 'create');

    expect(agents?.state).toBe('not-detected');
    expect(result.counts.missing).toBeGreaterThan(0);
  });

  it('marks strengthen path-only matches as review needed and content signatures as verified only when supplied', () => {
    const report = reportWithFiles(['README.md', 'AGENTS.md', 'package.json', 'src/App.tsx']);
    const { applyPlan } = applyPlanFor(report);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan });
    const agentsFile = applyPlan.files.find(file => file.generatedPath === '01-agent-instructions/AGENTS.md');
    expect(agentsFile).toBeDefined();

    const pathOnly = buildRepositoryVerificationResult({ baseline, currentReport: reportWithFiles(['README.md', 'AGENTS.md', 'package.json', 'src/App.tsx']) });
    expect(pathOnly.artifacts.find(artifact => artifact.generatedPath === '01-agent-instructions/AGENTS.md')?.state).toBe('needs-human-review');

    const contentMatch = buildRepositoryVerificationResult({
      baseline,
      currentReport: reportWithFiles(['README.md', 'AGENTS.md', 'package.json', 'src/App.tsx']),
      currentContentByPath: { 'AGENTS.md': agentsFile!.content },
    });
    expect(contentMatch.artifacts.find(artifact => artifact.generatedPath === '01-agent-instructions/AGENTS.md')?.state).toBe('verified-content-match');
    expect(contentMatch.counts.contentMatched).toBeGreaterThan(0);
  });

  it('keeps review-required items review-required unless content match is available and ignores blocked items in detected counts', () => {
    const report = reportWithFiles(['README.md', 'AGENTS.md', 'package.json', 'src/App.tsx']);
    const { transformation, universe, atlas } = applyPlanFor(report);
    const unsupported: RepositoryTransformationProposal = {
      ...transformation.proposals[0],
      id: 'verification-unsupported-output',
      title: 'Unsupported verification output',
      artifactActions: [{
        action: 'create',
        path: '99-unsupported/UNAVAILABLE.md',
        outputId: '99-unsupported/UNAVAILABLE.md',
        description: 'Unsupported output used to verify blocked verification handling.',
      }],
    };
    const plan = buildRepositoryOptimizationPlan({
      report,
      universe,
      atlas,
      transformation: { ...transformation, proposals: [...transformation.proposals, unsupported] },
    });
    const applyPlan = buildOptimizationApplyPlan(plan);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan });
    const result = buildRepositoryVerificationResult({ baseline, currentReport: reportWithFiles(['README.md', 'AGENTS.md', 'package.json', 'src/App.tsx', '99-unsupported/UNAVAILABLE.md']) });

    expect(result.artifacts.find(artifact => artifact.destinationPath === 'AGENTS.md')?.state).toBe('needs-human-review');
    expect(result.artifacts.find(artifact => artifact.generatedPath === '99-unsupported/UNAVAILABLE.md')?.state).toBe('blocked');
    expect(result.counts.blocked).toBeGreaterThan(0);
    expect(result.counts.detected).toBe(0);
  });

  it('marks missing current file inventory as not verifiable', () => {
    const report = baseReport();
    const { applyPlan } = applyPlanFor(report);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan });
    const current = { ...reportWithFiles(['README.md', 'package.json']), analyzedFiles: [], sampleFiles: [] };
    const result = buildRepositoryVerificationResult({ baseline, currentReport: current });

    expect(result.artifacts.every(artifact => artifact.state === 'not-verifiable' || artifact.state === 'blocked')).toBe(true);
    expect(result.limitations).toContain('Current scan did not expose comparable file inventory.');
  });

  it('compares metrics only as observed scan deltas and keeps the manifest deterministic', () => {
    const report = baseReport();
    const { applyPlan, universe, atlas } = applyPlanFor(report);
    const universeNodeIds = universe.nodes.map(node => node.id);
    const atlasNodeIds = atlas.nodes.map(node => node.id);
    const baseline = buildRepositoryVerificationBaseline({ report, applyPlan });
    const current = reportWithFiles(['README.md', 'package.json', 'src/App.tsx', 'src/App.test.tsx', '.github/workflows/ci.yml', 'AGENTS.md', '07-context/ARCHITECTURE.md']);
    const first = buildRepositoryVerificationResult({ baseline, currentReport: current });
    const second = buildRepositoryVerificationResult({ baseline, currentReport: current });

    expect(first.metrics.every(metric => metric.language === 'observed-after-rescan')).toBe(true);
    expect(first.metrics.map(metric => metric.label)).toContain('Workspace Quality');
    expect(first.manifest).toEqual(second.manifest);
    expect(universe.nodes.map(node => node.id)).toEqual(universeNodeIds);
    expect(atlas.nodes.map(node => node.id)).toEqual(atlasNodeIds);
  });
});

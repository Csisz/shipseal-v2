import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import { buildRepositoryUniverseModel, buildWorkspaceStory } from '@/lib/workspace';
import { selectRepositoryFrictions } from '@/components/agentready/result-dashboard/repositoryFrictions';
import { buildRepositoryFuturePathwaysGraph } from '@/components/agentready/result-workspace/futures/repositoryFuturePathwaysGraph';
import { buildFutureFieldLayout } from '@/components/agentready/result-workspace/futures/futurePathwaysLayout';

function largeRepositoryReport(fileCount = 600) {
  const files = Array.from({ length: fileCount }, (_unused, index) => ({
    path: `src/domain-${index % 18}/feature-${index % 60}/module-${String(index).padStart(4, '0')}.${index % 7 === 0 ? 'test.ts' : 'ts'}`,
    size: 240 + index,
  }));
  files.push(
    { path: 'README.md', size: 1_200 },
    { path: 'package.json', size: 640 },
    { path: '.github/workflows/ci.yml', size: 420 },
  );
  return buildReport({
    repoName: 'large-performance-fixture',
    files,
    textContents: {
      'README.md': '# Large deterministic performance fixture',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
    },
  });
}

describe('post-scan pure builder performance architecture', () => {
  it('measures large-report story and Universe construction without brittle timing claims', () => {
    const report = largeRepositoryReport();
    const storyStarted = performance.now();
    const story = buildWorkspaceStory(report);
    const storyDurationMs = performance.now() - storyStarted;
    const universeStarted = performance.now();
    const universe = buildRepositoryUniverseModel(report);
    const universeDurationMs = performance.now() - universeStarted;
    const frictionStarted = performance.now();
    const frictions = selectRepositoryFrictions(report.repositoryHealth);
    const frictionDurationMs = performance.now() - frictionStarted;
    const futureGraphStarted = performance.now();
    const futureGraph = buildRepositoryFuturePathwaysGraph(report, universe);
    const futureGraphDurationMs = performance.now() - futureGraphStarted;
    const layoutStarted = performance.now();
    const layout = buildFutureFieldLayout({
      phase: 'possibility',
      conflictCount: futureGraph.conflicts.length,
      activeTraceId: undefined,
      candidates: futureGraph.candidates.slice(0, 7).map((candidate, index) => ({
        goalId: `goal:${candidate.id}`,
        title: candidate.title,
        fit: candidate.fit,
        role: index === 0 ? 'primary' as const : 'candidate' as const,
        origin: candidate.origin,
        capabilityId: candidate.targetCapabilityId,
        confidence: candidate.confidence,
        compatibility: candidate.eligibility,
        humanReviewRequired: candidate.humanReviewState === 'required',
        evidenceCount: candidate.evidence.length,
        mappedEvidenceCount: candidate.universeMappings.length,
        universeNodeIds: candidate.universeMappings.map(mapping => mapping.universeNodeId),
      })),
      dependencies: futureGraph.dependencies.slice(0, 8).map((dependency, index) => ({
        id: dependency.id,
        title: dependency.title,
        state: dependency.state,
        dependentCount: dependency.dependentGoalIds.length,
        dependentGoalIds: dependency.dependentGoalIds,
        executionOrder: index,
        humanReviewRequired: dependency.humanReviewState === 'required',
      })),
    });
    const layoutDurationMs = performance.now() - layoutStarted;

    // Safe diagnostic counts only: no repository paths, excerpts, evidence IDs, or content.
    console.info(JSON.stringify({
      diagnostic: 'post-scan-builder-performance',
      analyzedFiles: report.scanSummary.filesAnalyzed,
      storyDurationMs: Number(storyDurationMs.toFixed(2)),
      universeDurationMs: Number(universeDurationMs.toFixed(2)),
      frictionDurationMs: Number(frictionDurationMs.toFixed(2)),
      futureGraphDurationMs: Number(futureGraphDurationMs.toFixed(2)),
      futureLayoutDurationMs: Number(layoutDurationMs.toFixed(2)),
      universeNodes: universe.nodes.length,
      universeEdges: universe.edges.length,
      futureCandidates: futureGraph.candidates.length,
      futureLayoutNodes: layout.nodes.length,
    }));

    expect(story.chapters.length).toBeGreaterThan(0);
    expect(universe.summary.representedFileNodeCount).toBe(report.scanSummary.filesAnalyzed);
    expect(frictions.length).toBeGreaterThan(0);
    expect(futureGraph.candidates.length).toBeGreaterThan(0);
    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(storyDurationMs).toBeLessThan(5_000);
    expect(universeDurationMs).toBeLessThan(5_000);
    expect(futureGraphDurationMs).toBeLessThan(5_000);
    expect(buildRepositoryUniverseModel(report)).toEqual(universe);
  });
});

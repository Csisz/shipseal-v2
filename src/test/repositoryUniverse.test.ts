import { describe, expect, it } from 'vitest';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import {
  DEFAULT_REPOSITORY_UNIVERSE_FILTERS,
  buildRepositoryAtlasModel,
  buildRepositoryUniverseModel,
  repositoryUniverseEdgeVisible,
  repositoryUniverseFilterCounts,
  repositoryUniverseVisibleNodeIds,
} from '@/lib/workspace';
import { repositoryUniverseClusterToken, repositoryUniverseNodeClusterToken } from '@/lib/workspace/repositoryUniverseVisual';

function reportWithFiles() {
  return buildReport({
    repoName: 'universe-test',
    files: [
      { path: 'README.md', size: 240 },
      { path: 'AGENTS.md', size: 180 },
      { path: 'package.json', size: 160 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/components/Button.tsx', size: 220 },
      { path: 'src/components/Button.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 140 },
      { path: 'public/logo.svg', size: 80 },
      { path: 'notes/internal.txt', size: 90 },
      { path: 'dist/bundle.js', size: 1000, ignored: true, ignoredReason: 'generated-vendor' },
    ],
    textContents: {
      'README.md': '# Universe Test\n\n## Setup\nnpm install\nnpm test\n',
      'AGENTS.md': '# Agents\nFollow local conventions.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

describe('Repository Universe model', () => {
  it('creates exactly one file node for every analyzed file', () => {
    const report = reportWithFiles();
    const universe = buildRepositoryUniverseModel(report);
    const fileNodes = universe.nodes.filter(node => node.kind === 'file');

    expect(report.analyzedFiles?.map(file => file.path).sort()).toEqual([
      '.github/workflows/ci.yml',
      'AGENTS.md',
      'README.md',
      'package.json',
      'notes/internal.txt',
      'src/App.tsx',
      'src/components/Button.test.tsx',
      'src/components/Button.tsx',
    ].sort());
    expect(fileNodes).toHaveLength(report.analyzedFiles?.length || 0);
    expect(universe.summary.representedFileNodeCount).toBe(report.analyzedFiles?.length);
    expect(fileNodes.map(node => node.path).sort()).toEqual(report.analyzedFiles?.map(file => file.path).sort());
  });

  it('does not fabricate files or expose ignored generated paths as file nodes', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const paths = universe.nodes.filter(node => node.kind === 'file').map(node => node.path);

    expect(paths).not.toContain('dist/bundle.js');
    expect(paths).not.toContain('ARCHITECTURE.md');
    expect(universe.nodes.find(node => node.id === 'concept:ignored-context')?.metadata.category).toBe('generated');
    expect(universe.summary.ignoredFileInventoryAvailable).toBe(false);
  });

  it('uses deterministic stable file IDs and repository-relative normalized paths', () => {
    const first = buildRepositoryUniverseModel(reportWithFiles());
    const second = buildRepositoryUniverseModel(reportWithFiles());

    expect(first.fileRecords.map(record => record.id)).toEqual(second.fileRecords.map(record => record.id));
    expect(first.fileRecords.every(record => !record.path.startsWith('/'))).toBe(true);
    expect(first.fileRecords.every(record => !record.path.includes('\\'))).toBe(true);
  });

  it('assigns every file to a valid folder or repository-derived cluster', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const nodeIds = new Set(universe.nodes.map(node => node.id));
    const clusterIds = new Set(universe.clusters.map(cluster => cluster.id));

    for (const node of universe.nodes.filter(node => node.kind === 'file')) {
      expect(clusterIds.has(node.clusterId)).toBe(true);
      expect(node.parentId ? nodeIds.has(node.parentId) : true).toBe(true);
      expect(node.metadata.category).toBeTruthy();
    }
  });

  it('keeps important files visually distinguishable while retaining background files', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const readme = universe.nodes.find(node => node.path === 'README.md');
    const source = universe.nodes.find(node => node.path === 'notes/internal.txt');

    expect(readme?.importance).toBe('primary');
    expect(source?.importance).toBe('background');
    expect(readme?.radius).toBeGreaterThan(source?.radius || 0);
    expect(source).toBeDefined();
  });

  it('keeps relationship accuracy explicit without unsupported technical edges', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const relationships = universe.edges.map(edge => edge.relationship);

    expect(relationships).toContain('contains');
    expect(universe.edges.every(edge => edge.evidenceType === 'evidence' || edge.evidenceType === 'heuristic')).toBe(true);
    expect(relationships).not.toEqual(expect.arrayContaining(['imports', 'calls', 'tests', 'configures', 'documents', 'semantic-similarity']));
  });

  it('uses the shared knowledge model with Atlas instead of a separate repository analyzer', () => {
    const report = reportWithFiles();
    const universe = buildRepositoryUniverseModel(report);
    const atlas = buildRepositoryAtlasModel(report);
    const atlasIds = new Set(atlas.nodes.map(node => node.id));

    expect(universe.nodes.some(node => node.metadata.atlasNodeId && atlasIds.has(node.metadata.atlasNodeId))).toBe(true);
    expect(universe.nodes.find(node => node.path === 'notes/internal.txt')).toBeDefined();
  });

  it('creates a valid independent Universe for the sample project and new reports', () => {
    const sample = buildRepositoryUniverseModel(buildSampleReport());
    const other = buildRepositoryUniverseModel(buildReport({
      repoName: 'other-universe',
      files: [
        { path: 'README.md', size: 20 },
        { path: 'src/index.ts', size: 50 },
      ],
      textContents: {
        'README.md': '# Other',
      },
    }));

    expect(sample.summary.representedFileNodeCount).toBeGreaterThan(0);
    expect(sample.rootNodeId).not.toBe(other.rootNodeId);
    expect(other.nodes.filter(node => node.kind === 'file')).toHaveLength(2);
  });

  it('filters visible Universe nodes and edges without changing graph identity', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const allVisible = repositoryUniverseVisibleNodeIds(universe, DEFAULT_REPOSITORY_UNIVERSE_FILTERS);
    const withoutFiles = repositoryUniverseVisibleNodeIds(universe, {
      ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS,
      files: false,
    });

    expect(allVisible.size).toBe(universe.nodes.length);
    expect(withoutFiles.has(universe.rootNodeId)).toBe(true);
    expect([...withoutFiles].every(id => universe.nodes.find(node => node.id === id)?.kind !== 'file')).toBe(true);
    expect(withoutFiles.size).toBeLessThan(allVisible.size);
    expect(universe.nodes.filter(node => node.kind === 'file')).toHaveLength(universe.summary.representedFileNodeCount);
    expect(universe.edges.filter(edge => repositoryUniverseEdgeVisible(edge, withoutFiles)).length).toBeLessThan(universe.edges.length);
  });

  it('keeps evidence-state filters explicit for Universe visibility', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const withoutEvidence = repositoryUniverseVisibleNodeIds(universe, {
      ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS,
      evidence: false,
    });
    const withoutHeuristic = repositoryUniverseVisibleNodeIds(universe, {
      ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS,
      heuristic: false,
    });

    expect(withoutEvidence.has(universe.rootNodeId)).toBe(true);
    expect([...withoutEvidence].every(id => {
      const node = universe.nodes.find(item => item.id === id);
      return !node || node.id === universe.rootNodeId || node.evidenceType !== 'evidence';
    })).toBe(true);
    expect(withoutHeuristic.size).toBeLessThanOrEqual(universe.nodes.length);
  });

  it('reports filter counts from real graph entities without fabricating zero-state nodes', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const counts = repositoryUniverseFilterCounts(universe);

    expect(counts.files).toBe(universe.nodes.filter(node => node.kind === 'file').length);
    expect(counts.folders).toBe(universe.nodes.filter(node => node.kind === 'folder').length);
    expect(counts.concepts).toBe(universe.nodes.filter(node => node.kind === 'concept' || node.kind === 'workflow' || node.kind === 'recommendation').length);
    expect(counts.evidence).toBe(universe.nodes.filter(node => node.id !== universe.rootNodeId && node.kind !== 'repository' && node.evidenceType === 'evidence').length);
    expect(counts.missing).toBe(0);
    expect(universe.nodes.every(node => node.evidenceType !== 'missing' && node.kind !== 'recommendation')).toBe(true);
  });

  it('applies entity-kind filters and zero-count filters without changing the canonical graph', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const counts = repositoryUniverseFilterCounts(universe);
    const beforeNodeIds = universe.nodes.map(node => node.id);
    const withoutFolders = repositoryUniverseVisibleNodeIds(universe, { ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS, folders: false });
    const withoutConcepts = repositoryUniverseVisibleNodeIds(universe, { ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS, concepts: false });
    const withoutHeuristic = repositoryUniverseVisibleNodeIds(universe, { ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS, heuristic: false });
    const withoutMissing = repositoryUniverseVisibleNodeIds(universe, { ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS, missing: false });

    expect(counts.folders).toBeGreaterThan(0);
    expect([...withoutFolders].every(id => universe.nodes.find(node => node.id === id)?.kind !== 'folder')).toBe(true);
    expect(counts.concepts).toBeGreaterThan(0);
    expect([...withoutConcepts].every(id => !['concept', 'workflow', 'recommendation'].includes(universe.nodes.find(node => node.id === id)?.kind || ''))).toBe(true);
    expect(counts.heuristic).toBe(0);
    expect(withoutHeuristic.size).toBe(universe.nodes.length);
    expect(counts.missing).toBe(0);
    expect(withoutMissing.size).toBe(universe.nodes.length);
    expect(universe.nodes.map(node => node.id)).toEqual(beforeNodeIds);
  });

  it('applies heuristic and proposed filters when matching entities exist', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const heuristicId = 'concept:heuristic-test';
    const proposedId = 'recommendation:proposed-test';
    const withStates = {
      ...universe,
      nodes: [
        ...universe.nodes,
        {
          ...universe.nodes[0],
          id: heuristicId,
          kind: 'concept' as const,
          label: 'Heuristic entity',
          clusterId: 'cluster:context',
          evidenceType: 'heuristic' as const,
          parentId: undefined,
        },
        {
          ...universe.nodes[0],
          id: proposedId,
          kind: 'recommendation' as const,
          label: 'Proposed entity',
          clusterId: 'cluster:context',
          evidenceType: 'missing' as const,
          parentId: undefined,
        },
      ],
    };
    const counts = repositoryUniverseFilterCounts(withStates);
    const withoutHeuristic = repositoryUniverseVisibleNodeIds(withStates, { ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS, heuristic: false });
    const withoutMissing = repositoryUniverseVisibleNodeIds(withStates, { ...DEFAULT_REPOSITORY_UNIVERSE_FILTERS, missing: false });

    expect(counts.heuristic).toBe(1);
    expect(counts.missing).toBe(1);
    expect(withoutHeuristic.has(heuristicId)).toBe(false);
    expect(withoutMissing.has(proposedId)).toBe(false);
    expect(withStates.nodes.some(node => node.id === heuristicId)).toBe(true);
    expect(withStates.nodes.some(node => node.id === proposedId)).toBe(true);
  });

  it('keeps cluster color assignment deterministic and shared across same-cluster nodes', () => {
    const universe = buildRepositoryUniverseModel(reportWithFiles());
    const documentationNodes = universe.nodes.filter(node => node.clusterId === 'cluster:documentation');
    const sourceNodes = universe.nodes.filter(node => node.clusterId.startsWith('cluster:src'));

    expect(repositoryUniverseClusterToken('cluster:documentation')).toEqual(repositoryUniverseClusterToken('cluster:documentation'));
    expect(new Set(documentationNodes.map(node => repositoryUniverseNodeClusterToken(node).hex)).size).toBe(1);
    if (sourceNodes.length) {
      expect(repositoryUniverseNodeClusterToken(documentationNodes[0]).hex).not.toBe(repositoryUniverseNodeClusterToken(sourceNodes[0]).hex);
    }
  });
});

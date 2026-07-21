import { describe, expect, it } from 'vitest';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import {
  buildRepositoryAtlasModel,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  repositoryTransformationAffectedEntityCount,
} from '@/lib/workspace';

function transformationFor(report: ReturnType<typeof buildReport>) {
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  return {
    universe,
    atlas,
    transformation: buildRepositoryTransformationProposalModel(report, universe, atlas),
  };
}

function modestReport() {
  return buildReport({
    repoName: 'transformation-test',
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 240 },
      { path: 'src/App.tsx', size: 420 },
      { path: 'src/App.test.tsx', size: 260 },
      { path: '.github/workflows/ci.yml', size: 160 },
    ],
    textContents: {
      'README.md': '# Transformation Test\n\nUse npm test before release.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

describe('Repository Transformation Preview model', () => {
  it('keeps the current graph unchanged while deriving deterministic proposals', () => {
    const report = modestReport();
    const { universe, atlas, transformation } = transformationFor(report);
    const beforeUniverseNodeIds = universe.nodes.map(node => node.id);
    const beforeAtlasNodeIds = atlas.nodes.map(node => node.id);
    const second = buildRepositoryTransformationProposalModel(report, universe, atlas);

    expect(transformation.proposals.map(proposal => proposal.id)).toEqual(second.proposals.map(proposal => proposal.id));
    expect(universe.nodes.map(node => node.id)).toEqual(beforeUniverseNodeIds);
    expect(atlas.nodes.map(node => node.id)).toEqual(beforeAtlasNodeIds);
    expect(transformation.summary.currentFiles).toBe(universe.summary.representedFileNodeCount);
    expect(transformation.summary.proposedArtifacts).toBeGreaterThan(0);
  });

  it('uses only supported generated outputs and keeps proposed nodes separate from scanned entities', () => {
    const { universe, transformation } = transformationFor(modestReport());
    const currentNodeIds = new Set(universe.nodes.map(node => node.id));
    const supported = new Set(transformation.supportedOutputPaths);

    for (const proposal of transformation.proposals) {
      expect(proposal.artifactActions.length).toBeGreaterThan(0);
      for (const action of proposal.artifactActions) {
        expect(supported.has(action.path)).toBe(true);
        expect(action.preview?.source).toBe('generated-output');
      }
      for (const node of proposal.graphChanges.proposedNodes) {
        expect(currentNodeIds.has(node.id)).toBe(false);
        expect(node.id).toMatch(/^proposal-node:/);
        expect(node.evidenceType).toBe('missing');
      }
    }
  });

  it('covers the three supported transformation domains when evidence exists', () => {
    const { transformation } = transformationFor(modestReport());
    const domains = new Set(transformation.proposals.map(proposal => proposal.domain));

    expect(domains.has('project-memory')).toBe(true);
    expect(domains.has('agent-routing')).toBe(true);
    expect(domains.has('verification-path')).toBe(true);
    expect(transformation.proposals.find(proposal => proposal.domain === 'project-memory')?.artifactActions.map(action => action.path)).toEqual(
      expect.arrayContaining(['01-agent-instructions/AGENTS.md'])
    );
    expect(transformation.proposals.find(proposal => proposal.domain === 'agent-routing')?.artifactActions.some(action => /TASK_ROUTER|folder-agents/.test(action.path))).toBe(true);
    expect(transformation.proposals.find(proposal => proposal.domain === 'verification-path')?.artifactActions.some(action => /04-testing/.test(action.path))).toBe(true);
  });

  it('does not propose creating duplicate existing instruction paths', () => {
    const report = buildReport({
      repoName: 'strong-instructions',
      files: [
        { path: 'README.md', size: 220 },
        { path: 'AGENTS.md', size: 200 },
        { path: 'CLAUDE.md', size: 180 },
        { path: 'package.json', size: 240 },
        { path: 'src/index.ts', size: 260 },
      ],
      textContents: {
        'README.md': '# Strong Instructions',
        'AGENTS.md': '# Agents\nUse tests and keep changes small.',
        'CLAUDE.md': '# Claude\nPlan first.',
        'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      },
    });
    const { transformation } = transformationFor(report);
    const agentsProposal = transformation.proposals.find(proposal => proposal.artifactActions.some(action => action.path === '01-agent-instructions/AGENTS.md'));

    expect(agentsProposal).toBeDefined();
    expect(agentsProposal?.artifactActions.find(action => action.path === '01-agent-instructions/AGENTS.md')?.action).toBe('strengthen');
  });

  it('uses cautious language and low confidence for limited scans', () => {
    const report = buildReport({
      repoName: 'limited-transform',
      files: [{ path: 'index.html', size: 100 }],
      textContents: {},
      scanSummary: {
        scanMode: 'limited-fallback',
        limited: true,
        limitationReason: 'Invalid archive',
        totalFilesFound: 1,
        filesAnalyzed: 1,
        filesIgnored: 0,
        generatedVendorFilesIgnored: 0,
        binaryFilesIgnored: 0,
        readableTextBytesAnalyzed: 0,
        ignoredGeneratedFolders: [],
        warnings: ['Limited scan'],
        limits: {
          maxZipSizeBytes: 1,
          maxFileCount: 1,
          maxReadableTextFileSizeBytes: 1,
          maxTotalReadableTextBytes: 1,
          maxPathLength: 1,
          maxGeneratedFolderDepth: 1,
        },
      },
    });
    const { transformation } = transformationFor(report);

    expect(transformation.summary.limitedScan).toBe(true);
    expect(transformation.proposals.every(proposal => proposal.confidence === 'low')).toBe(true);
    expect(transformation.proposals.every(proposal => /proposed|generated|preview|approval/i.test(`${proposal.summary} ${proposal.artifactActions.map(action => action.description).join(' ')}`))).toBe(true);
  });

  it('builds valid evidence-bound proposals for the sample project', () => {
    const { transformation } = transformationFor(buildSampleReport());

    expect(transformation.proposals.length).toBeGreaterThan(0);
    expect(transformation.proposals.every(proposal => proposal.sourceEvidence.length > 0)).toBe(true);
    expect(transformation.proposals.every(proposal => proposal.graphChanges.proposedEdges.length > 0)).toBe(true);
  });

  it('counts unique affected current entities for every transformation variant', () => {
    const { transformation } = transformationFor(modestReport());

    expect(transformation.proposals.length).toBeGreaterThanOrEqual(3);
    for (const proposal of transformation.proposals) {
      const count = repositoryTransformationAffectedEntityCount(proposal);
      expect(Number.isFinite(count)).toBe(true);
      expect(Number.isNaN(count)).toBe(false);
      expect(count).toBe(new Set(proposal.graphChanges.affectedExistingNodeIds).size);
      expect(count).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(proposal.confidence);
    }

    // Folder routing requires at least one affected entity; this would be medium when the old object `.length` bug returned undefined.
    expect(transformation.proposals.find(proposal => proposal.id === 'agent-routing-folder-agents')?.confidence).toBe('high');
  });
});

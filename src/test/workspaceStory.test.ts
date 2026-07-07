import { describe, expect, it } from 'vitest';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { buildRepositoryKnowledgeModel, buildWorkspaceStory } from '@/lib/workspace/workspaceStory';

describe('Workspace Story model', () => {
  it('derives deterministic chapters from existing report and reveal evidence', () => {
    const story = buildWorkspaceStory(buildSampleReport());

    expect(story.initialChapterId).toBe('structure');
    expect(story.chapters.map(chapter => chapter.id)).toEqual([
      'structure',
      'documentation',
      'architecture',
      'projectMemory',
      'verification',
      'contextWorkflow',
    ]);
    expect(story.chapters).toHaveLength(6);
    expect(story.chapters.every(chapter => chapter.evidenceItems.length > 0)).toBe(true);
    expect(story.chapters.every(chapter => chapter.knowledgeNodeId.startsWith('concept:'))).toBe(true);
  });

  it('creates stable graph-ready node IDs deterministically', () => {
    const first = buildRepositoryKnowledgeModel(buildSampleReport());
    const second = buildRepositoryKnowledgeModel(buildSampleReport());

    expect(first.rootNodeId).toBe(second.rootNodeId);
    expect(first.nodes.map(node => node.id)).toEqual(second.nodes.map(node => node.id));
    expect(first.edges.map(edge => edge.id)).toEqual(second.edges.map(edge => edge.id));
  });

  it('derives Workspace Story chapters from shared knowledge entities', () => {
    const report = buildSampleReport();
    const knowledge = buildRepositoryKnowledgeModel(report);
    const story = buildWorkspaceStory(report);
    const nodeIds = new Set(knowledge.nodes.map(node => node.id));

    for (const chapter of story.chapters) {
      expect(nodeIds.has(chapter.knowledgeNodeId)).toBe(true);
      const node = knowledge.nodes.find(item => item.id === chapter.knowledgeNodeId);
      expect(node?.metadata.chapterId).toBe(chapter.id);
      expect(node?.evidenceItems).toEqual(chapter.evidenceItems);
    }
  });

  it('keeps evidence and heuristic states distinguishable', () => {
    const story = buildWorkspaceStory(buildReport({
      repoName: 'thin-repo',
      files: [
        { path: 'package.json', size: 120 },
        { path: 'src/main.ts', size: 80 },
      ],
      textContents: {
        'package.json': JSON.stringify({ scripts: { build: 'vite build' } }),
      },
    }));

    const projectMemory = story.chapters.find(chapter => chapter.id === 'projectMemory');

    expect(projectMemory).toBeDefined();
    expect(projectMemory?.evidenceType).toBe('heuristic');
    expect(projectMemory?.evidenceItems.some(item => item.state === 'missing')).toBe(true);
    expect(projectMemory?.evidenceItems.map(item => item.label).join('\n')).not.toContain('AGENTS.md found');

    const knowledge = buildRepositoryKnowledgeModel(buildReport({
      repoName: 'thin-repo',
      files: [
        { path: 'package.json', size: 120 },
        { path: 'src/main.ts', size: 80 },
      ],
      textContents: {
        'package.json': JSON.stringify({ scripts: { build: 'vite build' } }),
      },
    }));
    const memoryNode = knowledge.nodes.find(node => node.metadata.chapterId === 'projectMemory' && node.kind === 'concept');
    expect(memoryNode?.evidenceType).toBe('missing');
    expect(knowledge.nodes.some(node => node.evidenceType === 'missing')).toBe(true);
  });

  it('preserves relationship evidence type without fabricating unsupported technical edges', () => {
    const knowledge = buildRepositoryKnowledgeModel(buildSampleReport());

    expect(knowledge.edges.length).toBeGreaterThan(0);
    expect(knowledge.edges.every(edge => edge.evidenceType === 'evidence' || edge.evidenceType === 'heuristic')).toBe(true);
    expect(knowledge.edges.map(edge => edge.relationship)).not.toEqual(expect.arrayContaining([
      'imports',
      'calls',
      'tests',
      'configures',
      'documents',
      'semantic-similarity',
    ]));
  });

  it('does not fabricate unsupported chapters when no evidence items exist', () => {
    const report = buildSampleReport();
    const story = buildWorkspaceStory({
      ...report,
      sampleFiles: [],
      summary: {
        ...report.summary,
        keyFolders: [],
        instructionFiles: [],
      },
      repoContextPack: {
        ...report.repoContextPack,
        keyFolders: [],
        sampleFiles: [],
        existingInstructionFiles: [],
        ignoredFolders: [],
      },
      stack: {
        ...report.stack,
        primary: 'Unknown',
        languages: [],
        frameworks: [],
        testFrameworks: [],
        runCommands: [],
        scripts: {},
      },
      scanSummary: {
        ...report.scanSummary,
        filesAnalyzed: 0,
        filesIgnored: 0,
        generatedVendorFilesIgnored: 0,
        binaryFilesIgnored: 0,
        ignoredGeneratedFolders: [],
      },
    });

    expect(story.chapters.length).toBeLessThanOrEqual(6);
    expect(story.chapters.every(chapter => chapter.evidenceItems.length > 0)).toBe(true);
  });

  it('maps chapters to Mental Model, DNA and simulator surfaces', () => {
    const story = buildWorkspaceStory(buildSampleReport());
    const docs = story.chapters.find(chapter => chapter.id === 'documentation');
    const verification = story.chapters.find(chapter => chapter.id === 'verification');
    const context = story.chapters.find(chapter => chapter.id === 'contextWorkflow');

    expect(docs?.mentalModelNodeId).toBe('documentation');
    expect(docs?.dnaDimensionId).toBe('documentation');
    expect(docs?.agentStepIds).toContain('findDocumentation');
    expect(verification?.dnaDimensionId).toBe('verification');
    expect(verification?.agentStepIds).toContain('findBuildAndTest');
    expect(context?.agentStepIds).toContain('ignoreGeneratedFolders');

    const knowledge = buildRepositoryKnowledgeModel(buildSampleReport());
    const docsNode = knowledge.nodes.find(node => node.metadata.chapterId === 'documentation' && node.kind === 'concept');
    expect(docsNode?.metadata.mentalModelNodeId).toBe('documentation');
    expect(docsNode?.metadata.dnaDimensionId).toBe('documentation');
    expect(docsNode?.metadata.agentStepIds).toEqual(expect.arrayContaining(['findDocumentation']));
  });

  it('creates a valid Workspace Story for the sample project', () => {
    const story = buildWorkspaceStory(buildSampleReport());

    expect(story.initialChapterId).not.toBeNull();
    expect(story.chapters.some(chapter => chapter.evidenceType === 'evidence')).toBe(true);
    expect(story.chapters.flatMap(chapter => chapter.evidenceItems).some(item => item.label === 'README.md')).toBe(true);
  });

  it('creates independent knowledge roots for new report data', () => {
    const first = buildRepositoryKnowledgeModel(buildSampleReport());
    const second = buildRepositoryKnowledgeModel(buildReport({
      repoName: 'another-repo',
      files: [
        { path: 'README.md', size: 100 },
        { path: 'src/index.ts', size: 90 },
      ],
      textContents: {
        'README.md': '# Another repo',
      },
    }));

    expect(first.rootNodeId).not.toBe(second.rootNodeId);
    expect(second.nodes.find(node => node.id === second.rootNodeId)?.label).toBe('another-repo');
  });
});

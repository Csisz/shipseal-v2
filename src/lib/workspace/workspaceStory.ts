import type { ReadinessReport } from '../types';
import { buildIntelligenceRevealModel, type IntelligenceRevealSignalKind } from './intelligenceReveal';

export type WorkspaceStoryEvidenceState = 'evidence' | 'heuristic' | 'missing';

export type RepositoryKnowledgeNodeKind = 'repository' | 'file' | 'folder' | 'concept' | 'workflow' | 'memory' | 'recommendation';
export type RepositoryKnowledgeEdgeRelationship =
  | 'references'
  | 'contains'
  | 'documents'
  | 'tests'
  | 'configures'
  | 'routes-agent-to'
  | 'supports-workflow'
  | 'related-concept'
  | 'heuristic';

export type WorkspaceStoryChapterId =
  | 'structure'
  | 'documentation'
  | 'architecture'
  | 'projectMemory'
  | 'verification'
  | 'contextWorkflow';

export type WorkspaceStoryMentalNodeId =
  | 'documentation'
  | 'architecture'
  | 'source'
  | 'aiInstructions'
  | 'tests'
  | 'buildCi'
  | 'context'
  | 'recommendations';

export type WorkspaceStoryDnaDimensionId =
  | 'documentation'
  | 'architecture'
  | 'projectMemory'
  | 'contextEfficiency'
  | 'aiRouting'
  | 'verification';

export type WorkspaceStoryAgentStepId =
  | 'repositoryDetected'
  | 'frameworkIdentified'
  | 'findDocumentation'
  | 'searchArchitecture'
  | 'locateAiInstructions'
  | 'findBuildAndTest'
  | 'ignoreGeneratedFolders'
  | 'identifySourceFolders'
  | 'workspaceComplete';

export interface WorkspaceEvidenceItem {
  label: string;
  detail?: string;
  state: WorkspaceStoryEvidenceState;
}

export interface WorkspaceStoryChapter {
  id: WorkspaceStoryChapterId;
  knowledgeNodeId: string;
  label: string;
  shortLabel: string;
  summary: string;
  evidenceType: IntelligenceRevealSignalKind;
  evidenceItems: WorkspaceEvidenceItem[];
  mentalModelNodeId?: WorkspaceStoryMentalNodeId;
  dnaDimensionId?: WorkspaceStoryDnaDimensionId;
  agentStepIds: WorkspaceStoryAgentStepId[];
  relationship: string;
  repositoryMeaning: string;
  agentUse: string;
}

export interface WorkspaceStory {
  initialChapterId: WorkspaceStoryChapterId | null;
  chapters: WorkspaceStoryChapter[];
}

export interface RepositoryKnowledgeNode {
  id: string;
  kind: RepositoryKnowledgeNodeKind;
  label: string;
  path?: string;
  clusterId?: string;
  evidenceType: WorkspaceStoryEvidenceState;
  evidenceItems: WorkspaceEvidenceItem[];
  metadata: Record<string, string | number | boolean | string[] | null | undefined>;
}

export interface RepositoryKnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relationship: RepositoryKnowledgeEdgeRelationship;
  evidenceType: Exclude<WorkspaceStoryEvidenceState, 'missing'>;
  evidenceItems: WorkspaceEvidenceItem[];
}

export interface RepositoryKnowledgeCluster {
  id: string;
  label: string;
  category: string;
  nodeIds: string[];
  summary: string;
}

export interface RepositoryKnowledgeModel {
  rootNodeId: string;
  nodes: RepositoryKnowledgeNode[];
  edges: RepositoryKnowledgeEdge[];
  clusters: RepositoryKnowledgeCluster[];
}

export interface RepositoryAtlasNode extends RepositoryKnowledgeNode {
  x: number;
  y: number;
  radius: number;
  labelPriority: 'primary' | 'secondary' | 'detail';
}

export interface RepositoryAtlasCluster extends RepositoryKnowledgeCluster {
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export interface RepositoryAtlasModel {
  rootNodeId: string;
  nodes: RepositoryAtlasNode[];
  edges: RepositoryKnowledgeEdge[];
  clusters: RepositoryAtlasCluster[];
  statusNote: string;
}

interface StoryCandidate {
  id: WorkspaceStoryChapterId;
  revealSignalIds: Array<ReturnType<typeof buildIntelligenceRevealModel>['signals'][number]['id']>;
  label: string;
  shortLabel: string;
  summary: string;
  mentalModelNodeId?: WorkspaceStoryMentalNodeId;
  dnaDimensionId?: WorkspaceStoryDnaDimensionId;
  agentStepIds: WorkspaceStoryAgentStepId[];
  relationship: string;
  repositoryMeaning: string;
  agentUse: string;
  extraEvidence?: (report: ReadinessReport) => WorkspaceEvidenceItem[];
}

const STORY_CANDIDATES: StoryCandidate[] = [
  {
    id: 'structure',
    revealSignalIds: ['structure'],
    label: 'Repository shape',
    shortLabel: 'Shape',
    summary: 'ShipSeal found the first boundary of the repository.',
    mentalModelNodeId: 'source',
    dnaDimensionId: 'aiRouting',
    agentStepIds: ['repositoryDetected', 'identifySourceFolders'],
    relationship: 'The repository center connects to the folders and files most likely to orient future work.',
    repositoryMeaning: 'This gives the workspace a starting map before any recommendations or exports matter.',
    agentUse: 'A coding agent can begin with repository identity, then move into likely source folders instead of scanning everything equally.',
    extraEvidence: report => [
      evidenceItem(`${report.scanEvidence.analyzedFileCount || report.scanSummary.filesAnalyzed} files analyzed`, 'Scan evidence', 'evidence'),
      ...report.summary.keyFolders.slice(0, 3).map(folder => evidenceItem(`${folder}/`, 'Key folder', 'evidence')),
    ],
  },
  {
    id: 'documentation',
    revealSignalIds: ['documentation'],
    label: 'Knowledge and docs',
    shortLabel: 'Docs',
    summary: 'Documentation becomes the first explanation layer.',
    mentalModelNodeId: 'documentation',
    dnaDimensionId: 'documentation',
    agentStepIds: ['findDocumentation'],
    relationship: 'Documentation connects repository identity to human and agent onboarding.',
    repositoryMeaning: 'Strong docs reduce the amount of guessing needed before making a change.',
    agentUse: 'An agent would inspect these docs first to understand purpose, setup and safe boundaries.',
    extraEvidence: report => firstMatchingReportFiles(report, [
      /(^|\/)readme\.md$/i,
      /(^|\/)docs\/readme\.md$/i,
      /(^|\/)documentation\.md$/i,
      /(^|\/)docs\/.*\.md$/i,
    ], 4).map(path => evidenceItem(path, 'Documentation file', 'evidence')),
  },
  {
    id: 'architecture',
    revealSignalIds: ['architecture'],
    label: 'Architecture path',
    shortLabel: 'Architecture',
    summary: 'Stack and source signals explain where product behavior likely lives.',
    mentalModelNodeId: 'architecture',
    dnaDimensionId: 'architecture',
    agentStepIds: ['frameworkIdentified', 'searchArchitecture', 'identifySourceFolders'],
    relationship: 'Architecture connects framework, source folders and routing into one repository map.',
    repositoryMeaning: 'This helps separate product-critical areas from support surfaces.',
    agentUse: 'An agent can route tasks toward the right folders before opening implementation files.',
    extraEvidence: report => [
      ...firstMatchingReportFiles(report, [
        /(^|\/)architecture(\.md)?$/i,
        /(^|\/)docs\/architecture(\.md)?$/i,
        /(^|\/).*architecture.*\.md$/i,
        /(^|\/)system[-_ ]?design\.md$/i,
      ], 3).map(path => evidenceItem(path, 'Architecture file', 'evidence')),
      ...report.summary.keyFolders.slice(0, 3).map(folder => evidenceItem(`${folder}/`, 'Source or architecture folder', 'evidence')),
    ],
  },
  {
    id: 'projectMemory',
    revealSignalIds: ['projectMemory'],
    label: 'Project memory',
    shortLabel: 'Memory',
    summary: 'Reusable AI instructions anchor future repository work.',
    mentalModelNodeId: 'aiInstructions',
    dnaDimensionId: 'projectMemory',
    agentStepIds: ['locateAiInstructions'],
    relationship: 'Project memory connects repository-specific rules to source work.',
    repositoryMeaning: 'Persistent instructions help the workspace remember how this repository wants to be changed.',
    agentUse: 'An agent would use these files to follow local conventions and avoid repeating discovery work.',
    extraEvidence: report => uniqueStrings([
      ...report.summary.instructionFiles,
      ...report.repoContextPack.existingInstructionFiles,
      ...firstMatchingReportFiles(report, [
        /(^|\/)agents\.md$/i,
        /(^|\/)claude\.md$/i,
        /(^|\/)\.cursorrules$/i,
        /(^|\/)\.cursor\/rules/i,
      ], 4),
    ]).slice(0, 4).map(path => evidenceItem(path, 'AI instruction file', 'evidence')),
  },
  {
    id: 'verification',
    revealSignalIds: ['verification', 'developerWorkflow'],
    label: 'Verification path',
    shortLabel: 'Verify',
    summary: 'Tests, commands and CI define how changes become trustworthy.',
    mentalModelNodeId: 'tests',
    dnaDimensionId: 'verification',
    agentStepIds: ['findBuildAndTest'],
    relationship: 'Verification connects source changes to build, lint, test and CI confidence.',
    repositoryMeaning: 'The workspace can show how an AI-assisted change should be checked.',
    agentUse: 'An agent can choose the likely validation command instead of guessing after edits.',
    extraEvidence: report => [
      ...firstMatchingReportFiles(report, [
        /(^|\/)(test|tests|__tests__)\//i,
        /(^|\/).*\.test\.[jt]sx?$/i,
        /(^|\/).*\.spec\.[jt]sx?$/i,
        /(^|\/)\.github\/workflows\/.*\.ya?ml$/i,
      ], 4).map(path => evidenceItem(path, 'Verification file', 'evidence')),
      ...report.stack.runCommands
        .filter(command => /test|lint|build|typecheck/i.test(`${command.label} ${command.cmd}`))
        .slice(0, 3)
        .map(command => evidenceItem(`${command.label}: ${command.cmd}`, 'Detected command', 'evidence')),
      ...report.stack.testFrameworks.slice(0, 2).map(framework => evidenceItem(framework, 'Detected test framework', 'evidence')),
    ],
  },
  {
    id: 'contextWorkflow',
    revealSignalIds: ['context', 'developerWorkflow'],
    label: 'Context and workflow',
    shortLabel: 'Context',
    summary: 'Noise filters and workflow signals shape efficient exploration.',
    mentalModelNodeId: 'context',
    dnaDimensionId: 'contextEfficiency',
    agentStepIds: ['ignoreGeneratedFolders', 'findBuildAndTest'],
    relationship: 'Context filters connect useful source exploration to generated and vendor exclusions.',
    repositoryMeaning: 'This keeps the workspace focused on knowledge instead of repository volume.',
    agentUse: 'An agent can avoid generated folders and spend context on files likely to affect the task.',
    extraEvidence: report => [
      ...report.scanSummary.ignoredGeneratedFolders.slice(0, 3).map(folder => evidenceItem(folder, 'Ignored generated folder', 'evidence')),
      report.scanSummary.filesIgnored
        ? evidenceItem(`${report.scanSummary.filesIgnored} files ignored`, 'Scan filter', 'evidence')
        : evidenceItem('No ignored generated folders surfaced', 'Context heuristic', 'heuristic'),
    ],
  },
];

export function buildWorkspaceStory(report: ReadinessReport): WorkspaceStory {
  const knowledge = buildRepositoryKnowledgeModel(report);
  const conceptNodes = new Map(
    knowledge.nodes
      .filter(node => node.kind === 'concept' && typeof node.metadata.chapterId === 'string')
      .map(node => [node.metadata.chapterId as WorkspaceStoryChapterId, node])
  );
  const chapters: WorkspaceStoryChapter[] = [];

  for (const candidate of STORY_CANDIDATES) {
    const node = conceptNodes.get(candidate.id);
    if (!node || !node.evidenceItems.length) continue;

    chapters.push({
      id: candidate.id,
      knowledgeNodeId: node.id,
      label: candidate.label,
      shortLabel: candidate.shortLabel,
      summary: candidate.summary,
      evidenceType: node.evidenceType === 'evidence' ? 'evidence' : 'heuristic',
      evidenceItems: node.evidenceItems,
      mentalModelNodeId: candidate.mentalModelNodeId,
      dnaDimensionId: candidate.dnaDimensionId,
      agentStepIds: candidate.agentStepIds,
      relationship: candidate.relationship,
      repositoryMeaning: candidate.repositoryMeaning,
      agentUse: candidate.agentUse,
    });

    if (chapters.length >= 6) break;
  }

  return {
    initialChapterId: chapters[0]?.id || null,
    chapters,
  };
}

export function buildRepositoryKnowledgeModel(report: ReadinessReport): RepositoryKnowledgeModel {
  const reveal = buildIntelligenceRevealModel(report);
  const revealSignals = new Map(reveal.signals.map(signal => [signal.id, signal]));
  const rootNodeId = `repository:${stableId(report.scanEvidence.repositoryFullName || report.repoName)}`;
  const nodes: RepositoryKnowledgeNode[] = [{
    id: rootNodeId,
    kind: 'repository',
    label: report.repoName,
    evidenceType: 'evidence',
    evidenceItems: [
      evidenceItem(report.scanEvidence.repositoryFullName || report.repoName, 'Repository identity', 'evidence'),
      evidenceItem(`${report.scanEvidence.analyzedFileCount || report.scanSummary.filesAnalyzed} files analyzed`, 'Scan evidence', 'evidence'),
    ],
    metadata: {
      repoName: report.repoName,
      sourceType: report.scanEvidence.sourceType,
      scannedAt: report.scannedAt,
      repositoryRole: 'Central repository identity',
      agentRelevance: 'The first anchor for all repository exploration.',
    },
  }];
  const edges: RepositoryKnowledgeEdge[] = [];
  const clusters: RepositoryKnowledgeCluster[] = [{
    id: 'cluster:repository',
    label: 'Repository',
    category: 'identity',
    nodeIds: [rootNodeId],
    summary: 'Repository identity and scan boundary.',
  }];

  for (const candidate of STORY_CANDIDATES) {
    const matchingSignals = candidate.revealSignalIds
      .map(id => revealSignals.get(id))
      .filter(Boolean);
    const revealEvidence = matchingSignals.flatMap(signal =>
      (signal?.evidence || []).map(item => evidenceItem(item, signal?.category, signal?.kind || 'heuristic'))
    );
    const extraEvidence = candidate.extraEvidence?.(report) || [];
    const evidenceItems = compactEvidence([...revealEvidence, ...extraEvidence]).slice(0, 6);

    if (!evidenceItems.length) continue;

    const clusterId = `cluster:${candidate.id}`;
    const conceptNodeId = `concept:${candidate.id}`;
    const conceptNode: RepositoryKnowledgeNode = {
      id: conceptNodeId,
      kind: 'concept',
      label: candidate.label,
      clusterId,
      evidenceType: strongestEvidenceState(evidenceItems),
      evidenceItems,
      metadata: {
        chapterId: candidate.id,
        storyChapterId: candidate.id,
        shortLabel: candidate.shortLabel,
        summary: candidate.summary,
        repositoryRole: candidate.repositoryMeaning,
        agentRelevance: candidate.agentUse,
        mentalModelNodeId: candidate.mentalModelNodeId,
        dnaDimensionId: candidate.dnaDimensionId,
        agentStepIds: candidate.agentStepIds,
        revealSignalIds: candidate.revealSignalIds,
      },
    };
    nodes.push(conceptNode);

    edges.push({
      id: `edge:${rootNodeId}->${conceptNodeId}:related-concept`,
      source: rootNodeId,
      target: conceptNodeId,
      relationship: 'related-concept',
      evidenceType: conceptNode.evidenceType === 'evidence' ? 'evidence' : 'heuristic',
      evidenceItems: evidenceItems.slice(0, 2),
    });

    const clusterNodeIds = [conceptNodeId];
    for (const item of evidenceItems) {
      const evidenceNodeId = evidenceNodeIdFor(candidate.id, item);
      if (!nodes.some(node => node.id === evidenceNodeId)) {
        const path = pathForEvidence(item);
        nodes.push({
          id: evidenceNodeId,
          kind: knowledgeNodeKindForEvidence(item),
          label: item.label,
          path,
          clusterId,
          evidenceType: item.state,
          evidenceItems: [item],
          metadata: {
            chapterId: candidate.id,
            storyChapterId: candidate.id,
            detail: item.detail,
            repositoryRole: item.detail || candidate.summary,
            agentRelevance: candidate.agentUse,
            mentalModelNodeId: candidate.mentalModelNodeId,
            dnaDimensionId: candidate.dnaDimensionId,
            agentStepIds: candidate.agentStepIds,
            fileType: path ? fileTypeForPath(path) : undefined,
          },
        });
      }
      clusterNodeIds.push(evidenceNodeId);
      edges.push({
        id: `edge:${conceptNodeId}->${evidenceNodeId}:${item.state === 'evidence' ? evidenceRelationshipFor(item) : 'heuristic'}`,
        source: conceptNodeId,
        target: evidenceNodeId,
        relationship: item.state === 'evidence' ? evidenceRelationshipFor(item) : 'heuristic',
        evidenceType: item.state === 'evidence' ? 'evidence' : 'heuristic',
        evidenceItems: [item],
      });
    }

    clusters.push({
      id: clusterId,
      label: candidate.label,
      category: candidate.shortLabel,
      nodeIds: uniqueStrings(clusterNodeIds),
      summary: candidate.summary,
    });

    if (clusters.length >= 7) break;
  }

  return {
    rootNodeId,
    nodes,
    edges,
    clusters,
  };
}

export function buildRepositoryAtlasModel(report: ReadinessReport): RepositoryAtlasModel {
  const knowledge = buildRepositoryKnowledgeModel(report);
  const nonRootClusters = knowledge.clusters.filter(cluster => cluster.id !== 'cluster:repository');
  const clusterCount = Math.max(1, nonRootClusters.length);
  const orbitRadius = clusterCount <= 4 ? 260 : 310;
  const clusterLayouts = new Map<string, RepositoryAtlasCluster>();

  for (const cluster of knowledge.clusters) {
    if (cluster.id === 'cluster:repository') {
      clusterLayouts.set(cluster.id, {
        ...cluster,
        x: 0,
        y: 0,
        radius: 88,
        angle: -Math.PI / 2,
      });
      continue;
    }

    const index = nonRootClusters.findIndex(item => item.id === cluster.id);
    const angle = -Math.PI / 2 + (index / clusterCount) * Math.PI * 2;
    clusterLayouts.set(cluster.id, {
      ...cluster,
      x: Math.cos(angle) * orbitRadius,
      y: Math.sin(angle) * orbitRadius,
      radius: Math.min(150, 86 + cluster.nodeIds.length * 9),
      angle,
    });
  }

  const atlasNodes: RepositoryAtlasNode[] = knowledge.nodes.map(node => {
    if (node.id === knowledge.rootNodeId) {
      return {
        ...node,
        x: 0,
        y: 0,
        radius: 42,
        labelPriority: 'primary',
      };
    }

    const cluster = node.clusterId ? clusterLayouts.get(node.clusterId) : undefined;
    const clusterNodeIds = cluster?.nodeIds || [];
    const indexInCluster = Math.max(0, clusterNodeIds.indexOf(node.id));
    const siblingCount = Math.max(1, clusterNodeIds.length - 1);
    const conceptNode = node.kind === 'concept';
    const localAngle = cluster
      ? cluster.angle + Math.PI + ((indexInCluster - 1) / siblingCount) * Math.PI * 1.35
      : indexInCluster;
    const localRadius = conceptNode ? 0 : (node.evidenceType === 'evidence' ? 58 : 78) + (indexInCluster % 3) * 13;

    return {
      ...node,
      x: (cluster?.x || 0) + Math.cos(localAngle) * localRadius,
      y: (cluster?.y || 0) + Math.sin(localAngle) * localRadius,
      radius: radiusForKnowledgeNode(node),
      labelPriority: conceptNode ? 'primary' : node.evidenceType === 'evidence' ? 'secondary' : 'detail',
    };
  });

  return {
    rootNodeId: knowledge.rootNodeId,
    nodes: atlasNodes,
    edges: knowledge.edges,
    clusters: [...clusterLayouts.values()],
    statusNote: `Showing ${atlasNodes.length} high-signal entities from ${(report.scanEvidence.analyzedFileCount || report.scanSummary.filesAnalyzed || report.fileCount).toLocaleString()} analyzed files`,
  };
}

export function chapterForMentalModelNode(story: WorkspaceStory, nodeId: WorkspaceStoryMentalNodeId) {
  return story.chapters.find(chapter => chapter.mentalModelNodeId === nodeId);
}

export function chapterForDnaDimension(story: WorkspaceStory, dimensionId: WorkspaceStoryDnaDimensionId) {
  return story.chapters.find(chapter => chapter.dnaDimensionId === dimensionId);
}

function evidenceItem(label: string, detail: string | undefined, state: WorkspaceStoryEvidenceState | IntelligenceRevealSignalKind): WorkspaceEvidenceItem {
  const normalized = label.toLowerCase();
  const inferredState = /(^|\b)(no|missing|not detected|unavailable|needs evidence)\b/.test(normalized)
    ? 'missing'
    : state;
  return {
    label,
    detail,
    state: inferredState === 'evidence' ? 'evidence' : inferredState === 'missing' ? 'missing' : 'heuristic',
  };
}

function compactEvidence(items: WorkspaceEvidenceItem[]) {
  const seen = new Set<string>();
  return items
    .map(item => ({ ...item, label: item.label.trim(), detail: item.detail?.trim() }))
    .filter(item => {
      if (!item.label) return false;
      const key = item.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function strongestEvidenceState(items: WorkspaceEvidenceItem[]): WorkspaceStoryEvidenceState {
  if (items.some(item => item.state === 'evidence')) return 'evidence';
  if (items.some(item => item.state === 'heuristic')) return 'heuristic';
  return 'missing';
}

function evidenceNodeIdFor(chapterId: WorkspaceStoryChapterId, item: WorkspaceEvidenceItem) {
  return `${knowledgeNodeKindForEvidence(item)}:${chapterId}:${stableId(item.label)}`;
}

function knowledgeNodeKindForEvidence(item: WorkspaceEvidenceItem): RepositoryKnowledgeNodeKind {
  const label = item.label.toLowerCase();
  const detail = item.detail?.toLowerCase() || '';
  if (detail.includes('detected command') || /^command:/.test(label) || /^[^:]+:\s*(npm|bun|pnpm|yarn|vite|tsc|vitest|jest|playwright)/i.test(item.label)) {
    return 'workflow';
  }
  if (detail.includes('ignored generated folder') || detail.includes('key folder') || detail.includes('source or architecture folder') || /^folder:\s*/i.test(item.label) || /\/$/.test(item.label)) {
    return 'folder';
  }
  if (/\.[a-z0-9]+($|\s)/i.test(item.label) || item.label.includes('/')) {
    return item.label.toLowerCase().includes('agents') || item.label.toLowerCase().includes('claude') ? 'memory' : 'file';
  }
  return item.state === 'missing' ? 'recommendation' : 'concept';
}

function evidenceRelationshipFor(item: WorkspaceEvidenceItem): RepositoryKnowledgeEdgeRelationship {
  const kind = knowledgeNodeKindForEvidence(item);
  if (kind === 'workflow') return 'supports-workflow';
  if (kind === 'memory') return 'routes-agent-to';
  return 'references';
}

function stableId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/[^a-z0-9/._-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'unknown';
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedReportFiles(report: ReadinessReport) {
  return uniqueStrings([
    ...report.sampleFiles.map(file => file.path),
    ...report.repoContextPack.sampleFiles,
    ...report.summary.instructionFiles,
    ...report.repoContextPack.existingInstructionFiles,
  ].map(path => path.replace(/\\/g, '/').replace(/^\/+/, '')));
}

function firstMatchingReportFiles(report: ReadinessReport, patterns: RegExp[], limit: number) {
  return normalizedReportFiles(report)
    .filter(path => patterns.some(pattern => pattern.test(path)))
    .slice(0, limit);
}

function pathForEvidence(item: WorkspaceEvidenceItem) {
  const label = item.label
    .replace(/^Folder:\s*/i, '')
    .replace(/^File:\s*/i, '')
    .replace(/\s+found$/i, '')
    .trim();

  if (/^\d+(\.\d+)?\s+files?\s+/i.test(label)) return undefined;
  if (/^[^:]+:\s*(npm|bun|pnpm|yarn|vite|tsc|vitest|jest|playwright|cargo|go|mvn|gradle)/i.test(label)) return undefined;
  if (!/[/.]/.test(label)) return undefined;
  return label.replace(/\\/g, '/').replace(/^\/+/, '');
}

function fileTypeForPath(path: string) {
  const match = path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : path.endsWith('/') ? 'folder' : undefined;
}

function radiusForKnowledgeNode(node: RepositoryKnowledgeNode) {
  if (node.kind === 'repository') return 42;
  if (node.kind === 'concept') return 27;
  if (node.kind === 'folder') return 21;
  if (node.kind === 'memory' || node.kind === 'workflow') return 20;
  if (node.kind === 'recommendation') return 18;
  return node.evidenceType === 'evidence' ? 19 : 17;
}

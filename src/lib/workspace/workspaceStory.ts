import type { ReadinessReport } from '../types';
import { buildIntelligenceRevealModel, type IntelligenceRevealSignalKind } from './intelligenceReveal';

export type WorkspaceStoryEvidenceState = 'evidence' | 'heuristic' | 'missing';

export type RepositoryKnowledgeNodeKind = 'repository' | 'file' | 'folder' | 'concept' | 'workflow' | 'memory' | 'recommendation';
export type RepositoryKnowledgeEdgeRelationship =
  | 'references'
  | 'contains'
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
}

export interface RepositoryKnowledgeModel {
  rootNodeId: string;
  nodes: RepositoryKnowledgeNode[];
  edges: RepositoryKnowledgeEdge[];
  clusters: RepositoryKnowledgeCluster[];
}

interface StoryCandidate {
  id: WorkspaceStoryChapterId;
  revealSignalIds: string[];
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
    },
  }];
  const edges: RepositoryKnowledgeEdge[] = [];
  const clusters: RepositoryKnowledgeCluster[] = [{
    id: 'cluster:repository',
    label: 'Repository',
    category: 'identity',
    nodeIds: [rootNodeId],
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
        shortLabel: candidate.shortLabel,
        summary: candidate.summary,
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
        nodes.push({
          id: evidenceNodeId,
          kind: knowledgeNodeKindForEvidence(item),
          label: item.label,
          clusterId,
          evidenceType: item.state,
          evidenceItems: [item],
          metadata: {
            chapterId: candidate.id,
            detail: item.detail,
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
  if (detail.includes('ignored generated folder') || detail.includes('key folder') || /\/$/.test(item.label)) {
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

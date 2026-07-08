import type { ReadinessReport, RepoFileSummary } from '../types';
import {
  buildRepositoryKnowledgeModel,
  type RepositoryKnowledgeEdgeRelationship,
  type WorkspaceEvidenceItem,
  type WorkspaceStoryAgentStepId,
  type WorkspaceStoryDnaDimensionId,
  type WorkspaceStoryEvidenceState,
} from './workspaceStory';

export type RepositoryUniverseFileCategory =
  | 'source'
  | 'documentation'
  | 'test'
  | 'configuration'
  | 'workflow'
  | 'agent-instruction'
  | 'generated'
  | 'asset'
  | 'other';

export type RepositoryUniverseNodeKind = 'repository' | 'folder' | 'file' | 'concept' | 'workflow' | 'recommendation';
export type RepositoryUniverseImportance = 'primary' | 'supporting' | 'background';
export type RepositoryUniverseEvidenceType = 'evidence' | 'heuristic' | 'missing';
export type RepositoryUniverseRelationship = RepositoryKnowledgeEdgeRelationship | 'contains';

export interface RepositoryUniversePosition {
  x: number;
  y: number;
  z: number;
}

export interface RepositoryUniverseNode {
  id: string;
  kind: RepositoryUniverseNodeKind;
  label: string;
  path?: string;
  parentId?: string;
  clusterId: string;
  evidenceType: RepositoryUniverseEvidenceType;
  importance: RepositoryUniverseImportance;
  radius: number;
  position: RepositoryUniversePosition;
  evidenceItems: WorkspaceEvidenceItem[];
  metadata: {
    extension?: string;
    language?: string;
    category?: RepositoryUniverseFileCategory;
    size?: number;
    directory?: string;
    depth?: number;
    relationshipCount?: number;
    agentRelevance?: string;
    storyChapterId?: string;
    dnaDimensionId?: WorkspaceStoryDnaDimensionId;
    simulatorStepIds?: WorkspaceStoryAgentStepId[];
    atlasNodeId?: string;
    repositoryRole?: string;
  };
}

export interface RepositoryUniverseEdge {
  id: string;
  source: string;
  target: string;
  relationship: RepositoryUniverseRelationship;
  evidenceType: Exclude<WorkspaceStoryEvidenceState, 'missing'>;
  confidence?: number;
  evidenceItems: WorkspaceEvidenceItem[];
}

export interface RepositoryUniverseCluster {
  id: string;
  label: string;
  category: string;
  nodeIds: string[];
  summary: string;
  position: RepositoryUniversePosition;
  radius: number;
}

export interface RepositoryUniverseFileRecord {
  id: string;
  path: string;
  name: string;
  extension?: string;
  directory: string;
  depth: number;
  category: RepositoryUniverseFileCategory;
  evidenceType: Exclude<WorkspaceStoryEvidenceState, 'missing'>;
  importance: RepositoryUniverseImportance;
  size?: number;
  language?: string;
  storyChapterId?: string;
  dnaDimensionId?: WorkspaceStoryDnaDimensionId;
  simulatorStepIds?: WorkspaceStoryAgentStepId[];
  atlasNodeId?: string;
  repositoryRole?: string;
  agentRelevance?: string;
}

export interface RepositoryUniverseSummary {
  discoveredFileCount: number;
  analyzedFileCount: number;
  representedFileNodeCount: number;
  folderNodeCount: number;
  clusterCount: number;
  edgeCount: number;
  ignoredFileCount: number;
  ignoredGeneratedFolders: string[];
  ignoredFileInventoryAvailable: boolean;
}

export interface RepositoryUniverseModel {
  rootNodeId: string;
  nodes: RepositoryUniverseNode[];
  edges: RepositoryUniverseEdge[];
  clusters: RepositoryUniverseCluster[];
  fileRecords: RepositoryUniverseFileRecord[];
  summary: RepositoryUniverseSummary;
  statusNote: string;
}

export interface RepositoryUniverseFilters {
  files: boolean;
  folders: boolean;
  concepts: boolean;
  evidence: boolean;
  heuristic: boolean;
  missing: boolean;
}

export type RepositoryUniverseFilterKey = keyof RepositoryUniverseFilters;

export type RepositoryUniverseFilterCounts = Record<RepositoryUniverseFilterKey, number>;

export const DEFAULT_REPOSITORY_UNIVERSE_FILTERS: RepositoryUniverseFilters = {
  files: true,
  folders: true,
  concepts: true,
  evidence: true,
  heuristic: true,
  missing: true,
};

type KnowledgeMetadata = RepositoryUniverseFileRecord & {
  evidenceItems: WorkspaceEvidenceItem[];
};

const DISALLOWED_TECHNICAL_RELATIONSHIPS = new Set<RepositoryUniverseRelationship>([
  'imports',
  'tests',
  'documents',
  'configures',
]);

export function buildRepositoryUniverseModel(report: ReadinessReport): RepositoryUniverseModel {
  const knowledge = buildRepositoryKnowledgeModel(report);
  const rootNodeId = knowledge.rootNodeId;
  const knowledgeByPath = knowledgeMetadataByPath(report);
  const fileRecords = normalizedAnalyzedFiles(report).map(file => buildFileRecord(report, file, knowledgeByPath.get(normalizePath(file.path))));
  const folderPaths = folderPathsForFiles(fileRecords);
  const clusters = buildUniverseClusters(fileRecords, rootNodeId);
  const clusterById = new Map(clusters.map(cluster => [cluster.id, cluster]));
  const folderNodeIds = new Map<string, string>();
  const nodes: RepositoryUniverseNode[] = [];
  const edges: RepositoryUniverseEdge[] = [];

  nodes.push({
    id: rootNodeId,
    kind: 'repository',
    label: report.repoName,
    clusterId: 'cluster:repository',
    evidenceType: 'evidence',
    importance: 'primary',
    radius: 11,
    position: { x: 0, y: 0, z: 0 },
    evidenceItems: [
      evidenceItem(report.scanEvidence.repositoryFullName || report.repoName, 'Repository identity', 'evidence'),
      evidenceItem(`${report.scanEvidence.analyzedFileCount || report.scanSummary.filesAnalyzed} files analyzed`, 'Scan evidence', 'evidence'),
    ],
    metadata: {
      relationshipCount: 0,
      agentRelevance: 'Central anchor for repository exploration.',
      repositoryRole: 'Repository identity and scan boundary.',
    },
  });

  for (const folderPath of folderPaths) {
    const folderId = `folder:${stableId(folderPath || 'root')}`;
    folderNodeIds.set(folderPath, folderId);
  }

  const rootFolderIds = new Set<string>();
  for (const folderPath of folderPaths) {
    const folderId = folderNodeIds.get(folderPath);
    if (!folderId) continue;
    const parentFolder = parentDirectory(folderPath);
    const parentId = folderPath.includes('/') ? folderNodeIds.get(parentFolder) : rootNodeId;
    const clusterId = clusterIdForPath(folderPath, undefined);
    const cluster = clusterById.get(clusterId) || clusterById.get('cluster:other') || clusters[0];
    const folderPosition = folderPositionFor(folderPath, cluster?.position || { x: 0, y: 0, z: 0 }, cluster?.radius || 180);
    const label = folderPath.split('/').pop() || folderPath || 'root';

    nodes.push({
      id: folderId,
      kind: 'folder',
      label,
      path: folderPath,
      parentId,
      clusterId: cluster?.id || 'cluster:other',
      evidenceType: 'evidence',
      importance: folderPath.split('/').length <= 1 ? 'supporting' : 'background',
      radius: folderPath.split('/').length <= 1 ? 6.8 : 5.6,
      position: folderPosition,
      evidenceItems: [evidenceItem(folderPath || 'root', 'Repository folder', 'evidence')],
      metadata: {
        category: categoryForPath(folderPath),
        directory: parentFolder,
        depth: folderPath ? folderPath.split('/').length : 0,
        relationshipCount: 0,
        repositoryRole: 'Folder anchor derived from repository paths.',
        agentRelevance: 'Helps an agent understand local repository boundaries before opening files.',
      },
    });

    if (parentId) {
      if (parentId === rootNodeId) rootFolderIds.add(folderId);
      edges.push(containmentEdge(parentId, folderId, folderPath || label));
    }
  }

  for (const record of fileRecords) {
    const parentId = folderNodeIds.get(record.directory) || rootNodeId;
    const cluster = clusterById.get(clusterIdForPath(record.path, record.category)) || clusters[0];
    const position = filePositionFor(record, cluster?.position || { x: 0, y: 0, z: 0 }, cluster?.radius || 180);
    nodes.push({
      id: record.id,
      kind: 'file',
      label: record.name,
      path: record.path,
      parentId,
      clusterId: cluster?.id || 'cluster:other',
      evidenceType: record.evidenceType,
      importance: record.importance,
      radius: record.importance === 'primary' ? 5.8 : record.importance === 'supporting' ? 4.2 : 2.6,
      position,
      evidenceItems: [
        evidenceItem(record.path, 'Analyzed repository file', 'evidence'),
        ...(knowledgeByPath.get(record.path)?.evidenceItems || []),
      ].slice(0, 5),
      metadata: {
        extension: record.extension,
        language: record.language,
        category: record.category,
        size: record.size,
        directory: record.directory,
        depth: record.depth,
        relationshipCount: 0,
        agentRelevance: record.agentRelevance || agentRelevanceForFile(record),
        storyChapterId: record.storyChapterId,
        dnaDimensionId: record.dnaDimensionId,
        simulatorStepIds: record.simulatorStepIds,
        atlasNodeId: record.atlasNodeId,
        repositoryRole: record.repositoryRole || repositoryRoleForFile(record),
      },
    });
    edges.push(containmentEdge(parentId, record.id, record.path));
  }

  for (const cluster of clusters.filter(cluster => cluster.id !== 'cluster:repository')) {
    const topFolderId = folderNodeIds.get(cluster.category);
    if (topFolderId && rootFolderIds.has(topFolderId)) continue;
    const strongestNode = cluster.nodeIds
      .map(id => nodes.find(node => node.id === id))
      .find(node => node?.kind === 'folder' || node?.kind === 'file');
    if (strongestNode) {
      edges.push({
        id: `edge:${rootNodeId}->${strongestNode.id}:related-concept`,
        source: rootNodeId,
        target: strongestNode.id,
        relationship: 'related-concept',
        evidenceType: 'heuristic',
        confidence: 0.62,
        evidenceItems: [evidenceItem(cluster.label, 'Repository-derived cluster', 'heuristic')],
      });
    }
  }

  for (const edge of knowledge.edges) {
    const sourceFileId = pathNodeId(knowledge.nodes.find(node => node.id === edge.source)?.path, fileRecords);
    const targetFileId = pathNodeId(knowledge.nodes.find(node => node.id === edge.target)?.path, fileRecords);
    const sourceConcept = knowledge.nodes.find(node => node.id === edge.source);
    const targetConcept = knowledge.nodes.find(node => node.id === edge.target);
    const source = sourceFileId || conceptAnchorFor(sourceConcept?.metadata.chapterId as string | undefined, fileRecords);
    const target = targetFileId || conceptAnchorFor(targetConcept?.metadata.chapterId as string | undefined, fileRecords);
    if (!source || !target || source === target) continue;
    if (DISALLOWED_TECHNICAL_RELATIONSHIPS.has(edge.relationship)) continue;
    const id = `edge:${source}->${target}:${edge.relationship}`;
    if (edges.some(existing => existing.id === id)) continue;
    edges.push({
      id,
      source,
      target,
      relationship: edge.relationship,
      evidenceType: edge.evidenceType,
      confidence: edge.evidenceType === 'evidence' ? 0.8 : 0.55,
      evidenceItems: edge.evidenceItems,
    });
  }

  const ignoredFileCount = report.scanEvidence.ignoredFileCount || report.scanSummary.filesIgnored || 0;
  if (ignoredFileCount > 0) {
    const ignoredNodeId = 'concept:ignored-context';
    nodes.push({
      id: ignoredNodeId,
      kind: 'concept',
      label: 'Ignored generated context',
      clusterId: 'cluster:context',
      evidenceType: 'evidence',
      importance: 'supporting',
      radius: 6.2,
      position: { x: -260, y: -40, z: -120 },
      evidenceItems: [
        evidenceItem(`${ignoredFileCount} ignored files`, 'Scan filter', 'evidence'),
        ...report.scanSummary.ignoredGeneratedFolders.slice(0, 3).map(folder => evidenceItem(folder, 'Ignored generated folder', 'evidence')),
      ],
      metadata: {
        category: 'generated',
        relationshipCount: 1,
        repositoryRole: 'Aggregate ignored context. Individual ignored paths are not available in the current report model.',
        agentRelevance: 'Helps agents avoid generated or vendor context when planning repository exploration.',
        storyChapterId: 'contextWorkflow',
        dnaDimensionId: 'contextEfficiency',
        simulatorStepIds: ['ignoreGeneratedFolders'],
      },
    });
    edges.push({
      id: `edge:${rootNodeId}->${ignoredNodeId}:related-concept`,
      source: rootNodeId,
      target: ignoredNodeId,
      relationship: 'related-concept',
      evidenceType: 'evidence',
      confidence: 0.82,
      evidenceItems: [evidenceItem(`${ignoredFileCount} ignored files`, 'Scan filter', 'evidence')],
    });
  }

  const relationshipCounts = relationshipCountsFor(edges);
  const nodesWithCounts = nodes.map(node => ({
    ...node,
    metadata: {
      ...node.metadata,
      relationshipCount: relationshipCounts.get(node.id) || 0,
    },
  }));
  const clustersWithNodes = clusters.map(cluster => ({
    ...cluster,
    nodeIds: nodesWithCounts.filter(node => node.clusterId === cluster.id).map(node => node.id),
  })).filter(cluster => cluster.nodeIds.length > 0);

  const summary: RepositoryUniverseSummary = {
    discoveredFileCount: report.scanEvidence.discoveredFileCount || report.scanSummary.totalFilesFound || report.fileCount,
    analyzedFileCount: report.scanEvidence.analyzedFileCount || report.scanSummary.filesAnalyzed || fileRecords.length,
    representedFileNodeCount: fileRecords.length,
    folderNodeCount: nodesWithCounts.filter(node => node.kind === 'folder').length,
    clusterCount: clustersWithNodes.length,
    edgeCount: edges.length,
    ignoredFileCount,
    ignoredGeneratedFolders: [...report.scanSummary.ignoredGeneratedFolders],
    ignoredFileInventoryAvailable: false,
  };

  return {
    rootNodeId,
    nodes: nodesWithCounts,
    edges,
    clusters: clustersWithNodes,
    fileRecords,
    summary,
    statusNote: `All ${summary.representedFileNodeCount.toLocaleString()} analyzed files are represented.`,
  };
}

export function repositoryUniverseNodeVisible(node: RepositoryUniverseNode, filters: RepositoryUniverseFilters, rootNodeId: string) {
  if (node.id === rootNodeId || node.kind === 'repository') return true;
  if (node.kind === 'file' && !filters.files) return false;
  if (node.kind === 'folder' && !filters.folders) return false;
  if ((node.kind === 'concept' || node.kind === 'workflow' || node.kind === 'recommendation') && !filters.concepts) return false;
  if (node.evidenceType === 'evidence' && !filters.evidence) return false;
  if (node.evidenceType === 'heuristic' && !filters.heuristic) return false;
  if ((node.evidenceType === 'missing' || node.kind === 'recommendation') && !filters.missing) return false;
  return true;
}

export function repositoryUniverseVisibleNodeIds(model: RepositoryUniverseModel, filters: RepositoryUniverseFilters) {
  return new Set(model.nodes
    .filter(node => repositoryUniverseNodeVisible(node, filters, model.rootNodeId))
    .map(node => node.id));
}

export function repositoryUniverseEdgeVisible(edge: RepositoryUniverseEdge, visibleNodeIds: Set<string>) {
  return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
}

export function repositoryUniverseFilterCounts(model: RepositoryUniverseModel): RepositoryUniverseFilterCounts {
  const counts: RepositoryUniverseFilterCounts = {
    files: 0,
    folders: 0,
    concepts: 0,
    evidence: 0,
    heuristic: 0,
    missing: 0,
  };

  for (const node of model.nodes) {
    if (node.id === model.rootNodeId || node.kind === 'repository') continue;
    for (const key of repositoryUniverseFilterKeysForNode(node)) {
      counts[key] += 1;
    }
  }

  return counts;
}

export function repositoryUniverseFilterKeysForNode(node: RepositoryUniverseNode): RepositoryUniverseFilterKey[] {
  const keys: RepositoryUniverseFilterKey[] = [];
  if (node.kind === 'file') keys.push('files');
  if (node.kind === 'folder') keys.push('folders');
  if (node.kind === 'concept' || node.kind === 'workflow' || node.kind === 'recommendation') keys.push('concepts');
  if (node.evidenceType === 'evidence') keys.push('evidence');
  if (node.evidenceType === 'heuristic') keys.push('heuristic');
  if (node.evidenceType === 'missing' || node.kind === 'recommendation') keys.push('missing');
  return keys;
}

function normalizedAnalyzedFiles(report: ReadinessReport): RepoFileSummary[] {
  const source = report.analyzedFiles?.length ? report.analyzedFiles : report.sampleFiles;
  const seen = new Set<string>();
  return source
    .map(file => ({ ...file, path: normalizePath(file.path) }))
    .filter(file => {
      if (!file.path || file.isDir || file.ignored) return false;
      if (seen.has(file.path)) return false;
      seen.add(file.path);
      return true;
    });
}

function buildFileRecord(report: ReadinessReport, file: RepoFileSummary, knowledge?: KnowledgeMetadata): RepositoryUniverseFileRecord {
  const path = normalizePath(file.path);
  const category = categoryForPath(path);
  const name = path.split('/').pop() || path;
  const directory = parentDirectory(path);
  const depth = path.split('/').length - 1;
  const extension = extensionForPath(path);
  const importance = knowledge?.importance || importanceForPath(path, category, report);

  return {
    id: `file:${stableId(`${report.scanEvidence.repositoryFullName || report.repoName}:${path}`)}`,
    path,
    name,
    extension,
    directory,
    depth,
    category,
    evidenceType: 'evidence',
    importance,
    size: file.size,
    language: languageForExtension(extension),
    storyChapterId: knowledge?.storyChapterId,
    dnaDimensionId: knowledge?.dnaDimensionId,
    simulatorStepIds: knowledge?.simulatorStepIds,
    atlasNodeId: knowledge?.atlasNodeId,
    repositoryRole: knowledge?.repositoryRole,
    agentRelevance: knowledge?.agentRelevance,
  };
}

function knowledgeMetadataByPath(report: ReadinessReport) {
  const knowledge = buildRepositoryKnowledgeModel(report);
  const metadata = new Map<string, KnowledgeMetadata>();
  for (const node of knowledge.nodes) {
    if (!node.path) continue;
    const path = normalizePath(node.path);
    metadata.set(path, {
      id: '',
      path,
      name: path.split('/').pop() || path,
      directory: parentDirectory(path),
      depth: path.split('/').length - 1,
      category: categoryForPath(path),
      evidenceType: node.evidenceType === 'missing' ? 'heuristic' : node.evidenceType,
      importance: node.kind === 'file' || node.kind === 'memory' || node.kind === 'workflow' ? 'primary' : 'supporting',
      storyChapterId: typeof node.metadata.storyChapterId === 'string' ? node.metadata.storyChapterId : undefined,
      dnaDimensionId: typeof node.metadata.dnaDimensionId === 'string' ? node.metadata.dnaDimensionId as WorkspaceStoryDnaDimensionId : undefined,
      simulatorStepIds: Array.isArray(node.metadata.agentStepIds) ? node.metadata.agentStepIds as WorkspaceStoryAgentStepId[] : undefined,
      atlasNodeId: node.id,
      repositoryRole: typeof node.metadata.repositoryRole === 'string' ? node.metadata.repositoryRole : undefined,
      agentRelevance: typeof node.metadata.agentRelevance === 'string' ? node.metadata.agentRelevance : undefined,
      evidenceItems: node.evidenceItems,
    });
  }
  return metadata;
}

function buildUniverseClusters(records: RepositoryUniverseFileRecord[], rootNodeId: string): RepositoryUniverseCluster[] {
  const keys = uniqueStrings(records.map(record => clusterIdForPath(record.path, record.category)));
  const clusters: RepositoryUniverseCluster[] = [{
    id: 'cluster:repository',
    label: 'Repository',
    category: 'repository',
    nodeIds: [rootNodeId],
    summary: 'Repository identity and scan boundary.',
    position: { x: 0, y: 0, z: 0 },
    radius: 140,
  }];

  keys.forEach((id, index) => {
    const members = records.filter(record => clusterIdForPath(record.path, record.category) === id);
    const first = members[0];
    const angle = -Math.PI / 2 + (index / Math.max(1, keys.length)) * Math.PI * 2;
    const orbit = keys.length <= 4 ? 230 : 300;
    clusters.push({
      id,
      label: clusterLabel(first?.path || id, first?.category || 'other'),
      category: topLevelSegment(first?.path || id),
      nodeIds: members.map(record => record.id),
      summary: clusterSummary(first?.category || 'other'),
      position: {
        x: Math.cos(angle) * orbit,
        y: Math.sin(angle) * 80,
        z: Math.sin(angle) * orbit,
      },
      radius: Math.min(170, Math.max(70, 42 + members.length * 5)),
    });
  });

  return clusters;
}

function folderPathsForFiles(records: RepositoryUniverseFileRecord[]) {
  const folders = new Set<string>();
  for (const record of records) {
    const parts = record.directory.split('/').filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
      folders.add(parts.slice(0, index + 1).join('/'));
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

function clusterIdForPath(path: string, category?: RepositoryUniverseFileCategory) {
  const normalized = normalizePath(path);
  const top = topLevelSegment(normalized);
  if (category === 'documentation') return 'cluster:documentation';
  if (category === 'agent-instruction') return 'cluster:project-memory';
  if (category === 'workflow') return 'cluster:ci-workflow';
  if (category === 'test') return 'cluster:verification';
  if (category === 'configuration') return 'cluster:configuration';
  if (category === 'asset') return 'cluster:assets';
  if (top) return `cluster:${stableId(top)}`;
  return 'cluster:other';
}

function clusterLabel(path: string, category: RepositoryUniverseFileCategory) {
  if (category === 'documentation') return 'Documentation';
  if (category === 'agent-instruction') return 'Project memory';
  if (category === 'workflow') return 'CI and workflow';
  if (category === 'test') return 'Tests and verification';
  if (category === 'configuration') return 'Configuration';
  if (category === 'asset') return 'Assets';
  const top = topLevelSegment(path);
  if (!top || top === '.') return 'Other repository files';
  if (top === 'src') return 'Application source';
  if (top === 'app') return 'Application routes';
  return `${top}/`;
}

function clusterSummary(category: RepositoryUniverseFileCategory) {
  if (category === 'documentation') return 'Documentation and knowledge files used for repository understanding.';
  if (category === 'agent-instruction') return 'AI instruction and project-memory files.';
  if (category === 'workflow') return 'CI and developer workflow evidence.';
  if (category === 'test') return 'Verification files and test surfaces.';
  if (category === 'configuration') return 'Configuration files that shape tools and runtime behavior.';
  if (category === 'asset') return 'Static and visual repository assets.';
  return 'Repository files grouped by folder structure.';
}

function categoryForPath(path: string): RepositoryUniverseFileCategory {
  const normalized = normalizePath(path).toLowerCase();
  if (/(^|\/)(node_modules|dist|build|coverage|\.next|\.turbo|\.cache|vendor)\//.test(normalized)) return 'generated';
  if (/(^|\/)(agents\.md|claude\.md|\.cursorrules)$/.test(normalized) || normalized.includes('/.cursor/rules')) return 'agent-instruction';
  if (/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(normalized)) return 'workflow';
  if (/(^|\/)(readme|architecture|documentation|contributing|changelog|roadmap)(\.[a-z0-9]+)?$/.test(normalized) || normalized.startsWith('docs/') || /\.mdx?$/.test(normalized)) return 'documentation';
  if (/(^|\/)(tests?|__tests__)\//.test(normalized) || /(\.|-)(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return 'test';
  if (/(^|\/)(package\.json|tsconfig|vite\.config|eslint\.config|tailwind\.config|postcss\.config|\.env\.example|\.gitignore)/.test(normalized) || /\.(json|ya?ml|toml|ini|config\.[jt]s)$/.test(normalized)) return 'configuration';
  if (/\.(png|jpe?g|gif|webp|svg|ico|css|scss|sass|woff2?)$/.test(normalized)) return 'asset';
  if (/\.(tsx?|jsx?|py|rb|go|rs|java|cs|php|swift|kt|mjs|cjs)$/.test(normalized) || normalized.startsWith('src/') || normalized.startsWith('app/') || normalized.startsWith('lib/')) return 'source';
  return 'other';
}

function importanceForPath(path: string, category: RepositoryUniverseFileCategory, report: ReadinessReport): RepositoryUniverseImportance {
  const normalized = normalizePath(path).toLowerCase();
  if (
    /(^|\/)(readme\.md|agents\.md|claude\.md|package\.json|architecture\.md|vite\.config\.[jt]s|tsconfig\.json)$/.test(normalized)
    || report.summary.instructionFiles.some(item => normalizePath(item).toLowerCase() === normalized)
  ) {
    return 'primary';
  }
  if (category === 'documentation' || category === 'test' || category === 'workflow' || category === 'configuration' || category === 'agent-instruction') return 'supporting';
  if (report.summary.keyFolders.some(folder => normalized.startsWith(`${normalizePath(folder).toLowerCase()}/`))) return 'supporting';
  return 'background';
}

function repositoryRoleForFile(record: RepositoryUniverseFileRecord) {
  if (record.category === 'documentation') return 'Documentation evidence that helps explain the repository.';
  if (record.category === 'agent-instruction') return 'Project-memory evidence for AI coding agents.';
  if (record.category === 'test') return 'Verification evidence for future changes.';
  if (record.category === 'workflow') return 'Workflow evidence for build or CI behavior.';
  if (record.category === 'configuration') return 'Configuration evidence for tools and runtime.';
  if (record.category === 'source') return 'Source file represented in repository space.';
  return 'Analyzed repository file represented for navigation.';
}

function agentRelevanceForFile(record: RepositoryUniverseFileRecord) {
  if (record.category === 'documentation') return 'Likely inspected early for setup, architecture or operating context.';
  if (record.category === 'agent-instruction') return 'Likely used to follow repository-specific AI instructions.';
  if (record.category === 'test') return 'Useful for validating generated code changes.';
  if (record.category === 'workflow') return 'Useful for understanding CI and delivery checks.';
  if (record.category === 'configuration') return 'Useful for inferring commands, frameworks and tool boundaries.';
  return 'Available as repository context when an agent explores this workspace.';
}

function filePositionFor(record: RepositoryUniverseFileRecord, cluster: RepositoryUniversePosition, clusterRadius: number): RepositoryUniversePosition {
  const hash = numericHash(record.path);
  const angle = (hash % 360) * Math.PI / 180;
  const layer = ((hash >> 8) % 11) / 10;
  const radial = record.importance === 'primary'
    ? clusterRadius * 0.22
    : record.importance === 'supporting'
      ? clusterRadius * (0.36 + layer * 0.2)
      : clusterRadius * (0.62 + layer * 0.36);
  const vertical = (((hash >> 16) % 101) - 50) * (record.importance === 'background' ? 1.1 : 0.72);
  return {
    x: cluster.x + Math.cos(angle) * radial,
    y: cluster.y + vertical,
    z: cluster.z + Math.sin(angle) * radial,
  };
}

function folderPositionFor(path: string, cluster: RepositoryUniversePosition, clusterRadius: number): RepositoryUniversePosition {
  const hash = numericHash(path);
  const angle = (hash % 360) * Math.PI / 180;
  const depth = Math.max(1, path.split('/').filter(Boolean).length);
  const radial = clusterRadius * Math.min(0.55, 0.18 + depth * 0.11);
  return {
    x: cluster.x + Math.cos(angle) * radial,
    y: cluster.y + (((hash >> 12) % 61) - 30),
    z: cluster.z + Math.sin(angle) * radial,
  };
}

function containmentEdge(source: string, target: string, label: string): RepositoryUniverseEdge {
  return {
    id: `edge:${source}->${target}:contains`,
    source,
    target,
    relationship: 'contains',
    evidenceType: 'evidence',
    confidence: 1,
    evidenceItems: [evidenceItem(label, 'Repository path containment', 'evidence')],
  };
}

function relationshipCountsFor(edges: RepositoryUniverseEdge[]) {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.source, (counts.get(edge.source) || 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
  }
  return counts;
}

function pathNodeId(path: string | undefined, records: RepositoryUniverseFileRecord[]) {
  if (!path) return undefined;
  return records.find(record => record.path === normalizePath(path))?.id;
}

function conceptAnchorFor(chapterId: string | undefined, records: RepositoryUniverseFileRecord[]) {
  if (!chapterId) return undefined;
  return records.find(record => record.storyChapterId === chapterId && record.importance === 'primary')?.id
    || records.find(record => record.storyChapterId === chapterId)?.id;
}

function evidenceItem(label: string, detail: string | undefined, state: WorkspaceStoryEvidenceState): WorkspaceEvidenceItem {
  return { label, detail, state };
}

function topLevelSegment(path: string) {
  return normalizePath(path).split('/').filter(Boolean)[0] || 'root';
}

function parentDirectory(path: string) {
  const parts = normalizePath(path).split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function extensionForPath(path: string) {
  const match = normalizePath(path).match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : undefined;
}

function languageForExtension(extension?: string) {
  if (!extension) return undefined;
  const languages: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    md: 'Markdown',
    mdx: 'MDX',
    json: 'JSON',
    yml: 'YAML',
    yaml: 'YAML',
    css: 'CSS',
    scss: 'SCSS',
    py: 'Python',
  };
  return languages[extension];
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

function stableId(value: string) {
  return normalizePath(value)
    .toLowerCase()
    .replace(/[^a-z0-9/._:-]+/g, '-')
    .replace(/[:/]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'unknown';
}

function numericHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

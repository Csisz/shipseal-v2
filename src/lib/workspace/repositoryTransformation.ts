import type { ReadinessReport } from '../types';
import { buildScoreJson } from '../exports';
import { buildDeliveryPackFiles } from '../deliveryPack';
import type { RepositoryAtlasModel, RepositoryAtlasNode } from './workspaceStory';
import type { RepositoryUniverseModel, RepositoryUniverseNode, RepositoryUniversePosition } from './repositoryUniverse';
import type { WorkspaceEvidenceItem, WorkspaceStoryEvidenceState } from './workspaceStory';

export type RepositoryTransformationMode = 'current' | 'with-shipseal';
export type RepositoryTransformationDomain = 'project-memory' | 'agent-routing' | 'verification-path';
export type RepositoryTransformationDomainFilter = 'all' | RepositoryTransformationDomain;
export type RepositoryTransformationConfidence = 'high' | 'medium' | 'low';

export interface RepositoryTransformationArtifactAction {
  action: 'create' | 'update' | 'strengthen';
  path: string;
  outputId?: string;
  description: string;
  preview?: {
    title: string;
    outline: string[];
    excerpt: string;
    source: 'generated-output' | 'metadata';
  };
}

export interface RepositoryTransformationProposedNode {
  id: string;
  proposalId: string;
  label: string;
  domain: RepositoryTransformationDomain;
  artifactPath: string;
  evidenceType: WorkspaceStoryEvidenceState;
  clusterId: string;
  position: RepositoryUniversePosition;
  x: number;
  y: number;
}

export interface RepositoryTransformationProposedEdge {
  id: string;
  proposalId: string;
  source: string;
  target: string;
  relationship: 'proposes' | 'connects-to-evidence' | 'routes-to' | 'supports-verification';
  evidenceType: WorkspaceStoryEvidenceState;
}

export interface RepositoryTransformationProposal {
  id: string;
  domain: RepositoryTransformationDomain;
  title: string;
  summary: string;
  evidenceType: WorkspaceStoryEvidenceState;
  sourceEvidence: WorkspaceEvidenceItem[];
  artifactActions: RepositoryTransformationArtifactAction[];
  graphChanges: {
    proposedNodes: RepositoryTransformationProposedNode[];
    proposedEdges: RepositoryTransformationProposedEdge[];
    affectedExistingNodeIds: string[];
  };
  expectedEffect: {
    agentBehavior: string;
    repositoryMeaning: string;
  };
  confidence: RepositoryTransformationConfidence;
}

export interface RepositoryTransformationProposalModel {
  modeLabel: string;
  proposals: RepositoryTransformationProposal[];
  supportedOutputPaths: string[];
  summary: {
    currentFiles: number;
    currentClusters: number;
    proposedArtifacts: number;
    proposedRelationships: number;
    limitedScan: boolean;
  };
}

interface GeneratedOutput {
  path: string;
  content: string;
}

export function buildRepositoryTransformationProposalModel(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel
): RepositoryTransformationProposalModel {
  const outputs = supportedGeneratedOutputs(report);
  const proposals = [
    projectMemoryProposal(report, universe, atlas, outputs),
    projectContextProposal(report, universe, atlas, outputs),
    taskRouterProposal(report, universe, atlas, outputs),
    folderRoutingProposal(report, universe, atlas, outputs),
    verificationStrategyProposal(report, universe, atlas, outputs),
    verificationGateProposal(report, universe, atlas, outputs),
  ].filter((proposal): proposal is RepositoryTransformationProposal => Boolean(proposal));

  const uniqueProposals = uniqueBy(proposals, proposal => proposal.artifactActions.map(action => action.path).join('|'));
  return {
    modeLabel: 'Repository Transformation Preview',
    proposals: uniqueProposals,
    supportedOutputPaths: outputs.map(output => output.path),
    summary: {
      currentFiles: universe.summary.representedFileNodeCount,
      currentClusters: universe.summary.clusterCount,
      proposedArtifacts: uniqueProposals.reduce((total, proposal) => total + proposal.artifactActions.length, 0),
      proposedRelationships: uniqueProposals.reduce((total, proposal) => total + proposal.graphChanges.proposedEdges.length, 0),
      limitedScan: report.scanEvidence.limitedScan || report.scanSummary.limited,
    },
  };
}

export function transformationDomainLabel(domain: RepositoryTransformationDomain) {
  if (domain === 'project-memory') return 'Project Memory';
  if (domain === 'agent-routing') return 'Agent Routing';
  return 'Verification Path';
}

export function repositoryTransformationDomainCounts(proposals: RepositoryTransformationProposal[]) {
  return proposals.reduce<Record<RepositoryTransformationDomain, number>>((counts, proposal) => {
    counts[proposal.domain] += 1;
    return counts;
  }, {
    'project-memory': 0,
    'agent-routing': 0,
    'verification-path': 0,
  });
}

function supportedGeneratedOutputs(report: ReadinessReport): GeneratedOutput[] {
  const scoreJson = buildScoreJson(report, { selectedPackages: ['agent-readiness', 'testing-red-team'] });
  const files = buildDeliveryPackFiles({
    agentFiles: report.agentPack,
    mcpFiles: report.mcpReadiness.generatedFiles,
    contextFiles: { markdown: report.contextPack, json: report.repoContextPack },
    repositoryName: report.repoName,
    scoreJson,
    repositoryHealth: report.repositoryHealth,
    selectedPackages: ['agent-readiness', 'testing-red-team'],
  });
  return files
    .filter(file => typeof file.content === 'string')
    .map(file => ({ path: file.path, content: String(file.content) }));
}

function projectMemoryProposal(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel,
  outputs: GeneratedOutput[]
) {
  const output = outputFor(outputs, '01-agent-instructions/AGENTS.md');
  if (!output) return null;
  const existing = hasRepositoryPath(report, 'AGENTS.md');
  const affected = affectedNodes(universe, atlas, [/^readme\.md$/i, /agents\.md$/i, /^docs\//i], 5);
  return proposal({
    id: 'project-memory-agent-instructions',
    domain: 'project-memory',
    title: existing ? 'Strengthen repository AI instructions' : 'Add repository AI instructions',
    summary: existing
      ? 'ShipSeal can strengthen the existing agent instruction layer with scan-derived operating context.'
      : 'ShipSeal can make repository-level AI instructions explicit for future coding agents.',
    output,
    action: existing ? 'strengthen' : 'create',
    actionDescription: existing
      ? 'Use the generated AGENTS.md output as a reviewable strengthening layer for the existing repository instruction file.'
      : 'Create a generated AGENTS.md output for repository-level agent operating guidance after approval.',
    affected,
    universe,
    atlas,
    evidence: [
      evidence(`${report.summary.instructionFiles.length || 0} instruction files detected`, 'Scan summary', 'evidence'),
      ...report.summary.keyFolders.slice(0, 3).map(folder => evidence(`${folder}/`, 'Key folder', 'evidence')),
    ],
    expectedAgent: 'An AI coding agent would read the proposed instruction layer before opening broad repository context.',
    expectedMeaning: 'Project memory becomes explicit instead of depending on chat history or repeated rediscovery.',
    confidence: confidenceFor(report, affected.length >= 2),
    relationship: 'connects-to-evidence',
  });
}

function projectContextProposal(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel,
  outputs: GeneratedOutput[]
) {
  const output = outputFor(outputs, '07-context/ARCHITECTURE.md');
  if (!output || !report.summary.keyFolders.length) return null;
  const affected = affectedNodes(universe, atlas, [/^src\//i, /^docs\//i, /^readme\.md$/i, /architecture/i], 6);
  return proposal({
    id: 'project-memory-architecture-context',
    domain: 'project-memory',
    title: 'Preview architecture memory',
    summary: 'ShipSeal can turn detected folders, docs and stack evidence into compact architecture memory.',
    output,
    action: hasArchitectureDoc(report) ? 'strengthen' : 'create',
    actionDescription: hasArchitectureDoc(report)
      ? 'Strengthen architecture memory using existing documentation and scan evidence.'
      : 'Create a generated architecture-memory output after approval.',
    affected,
    universe,
    atlas,
    evidence: [
      evidence(`${report.stack.primary}`, 'Detected stack', 'evidence'),
      ...report.summary.keyFolders.slice(0, 4).map(folder => evidence(`${folder}/`, 'Key folder', 'evidence')),
    ],
    expectedAgent: 'An agent would use this compact memory before opening many source files.',
    expectedMeaning: 'The repository gains a reusable explanation of structure and boundaries.',
    confidence: confidenceFor(report, affected.length >= 3),
    relationship: 'connects-to-evidence',
  });
}

function taskRouterProposal(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel,
  outputs: GeneratedOutput[]
) {
  const output = outputFor(outputs, '07-context/TASK_ROUTER.md');
  if (!output || !report.summary.keyFolders.length) return null;
  const affected = affectedNodes(universe, atlas, [/^src\//i, /^api\//i, /^docs\//i, /^tests?\//i, /^package\.json$/i], 7);
  return proposal({
    id: 'agent-routing-task-router',
    domain: 'agent-routing',
    title: 'Preview task routing map',
    summary: 'ShipSeal can propose a task router that points agents toward likely starting folders and boundaries.',
    output,
    action: 'create',
    actionDescription: 'Create a generated TASK_ROUTER.md output that routes common agent tasks to high-signal repository areas.',
    affected,
    universe,
    atlas,
    evidence: [
      ...report.summary.keyFolders.slice(0, 5).map(folder => evidence(`${folder}/`, 'Routing candidate', 'evidence')),
      evidence(`${report.stack.runCommands.length} detected commands`, 'Command evidence', report.stack.runCommands.length ? 'evidence' : 'heuristic'),
    ],
    expectedAgent: 'An agent would choose a starting area before reading broad repository context.',
    expectedMeaning: 'Navigation becomes task-oriented rather than folder-name guessing.',
    confidence: confidenceFor(report, affected.length >= 2),
    relationship: 'routes-to',
  });
}

function folderRoutingProposal(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel,
  outputs: GeneratedOutput[]
) {
  const folderOutputs = outputs.filter(output => output.path.startsWith('07-context/folder-agents/') && output.path.endsWith('/AGENTS.md'));
  if (!folderOutputs.length) return null;
  const affected = affectedNodes(universe, atlas, folderOutputs.map(output => folderRegexFromOutputPath(output.path)), 8);
  return proposal({
    id: 'agent-routing-folder-agents',
    domain: 'agent-routing',
    title: 'Preview scoped folder guidance',
    summary: 'ShipSeal can generate folder-level AGENTS suggestions for repository areas that already exist.',
    output: folderOutputs[0],
    extraOutputs: folderOutputs.slice(1, 4),
    action: 'create',
    actionDescription: 'Create generated folder-level AGENTS suggestions for review before copying into the repository.',
    affected,
    universe,
    atlas,
    evidence: folderOutputs.slice(0, 4).map(output => evidence(output.path, 'Supported generated folder instruction output', 'evidence')),
    expectedAgent: 'An agent working inside a folder would get local rules, scope and verification guidance.',
    expectedMeaning: 'Local context becomes scoped, so the workspace can guide agents without making every task global.',
    confidence: confidenceFor(report, affected.length >= 1),
    relationship: 'routes-to',
  });
}

function verificationStrategyProposal(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel,
  outputs: GeneratedOutput[]
) {
  const output = outputFor(outputs, '04-testing/TESTING_STRATEGY.md');
  if (!output) return null;
  const affected = affectedNodes(universe, atlas, [/(\.|-)(test|spec)\./i, /(^|\/)(tests?|__tests__)\//i, /^package\.json$/i, /^\.github\/workflows\//i], 7);
  return proposal({
    id: 'verification-path-testing-strategy',
    domain: 'verification-path',
    title: 'Preview verification guidance',
    summary: 'ShipSeal can make detected tests, commands and quality expectations easier for agents to follow.',
    output,
    action: hasRepositoryPath(report, 'TESTING_STRATEGY.md') ? 'strengthen' : 'create',
    actionDescription: 'Create or strengthen generated testing guidance from current scan evidence.',
    affected,
    universe,
    atlas,
    evidence: [
      evidence(`${report.stack.runCommands.length} detected commands`, 'Verification command evidence', report.stack.runCommands.length ? 'evidence' : 'heuristic'),
      evidence(`Tests detected: ${report.scanEvidence.keyFilesFound.tests ? 'yes' : 'no'}`, 'Scan evidence', report.scanEvidence.keyFilesFound.tests ? 'evidence' : 'heuristic'),
    ],
    expectedAgent: 'An agent would use the proposed verification guide before claiming a change is ready.',
    expectedMeaning: 'Verification becomes a visible path, not a scattered set of commands and conventions.',
    confidence: confidenceFor(report, report.stack.runCommands.length > 0 || report.scanEvidence.keyFilesFound.tests),
    relationship: 'supports-verification',
  });
}

function verificationGateProposal(
  report: ReadinessReport,
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel,
  outputs: GeneratedOutput[]
) {
  const output = outputFor(outputs, '04-testing/CI_QUALITY_GATE.yml');
  if (!output || (!report.stack.runCommands.length && !report.scanEvidence.keyFilesFound.ciConfig)) return null;
  const affected = affectedNodes(universe, atlas, [/^\.github\/workflows\//i, /^package\.json$/i, /(\.|-)(test|spec)\./i], 6);
  return proposal({
    id: 'verification-path-ci-quality-gate',
    domain: 'verification-path',
    title: 'Preview quality gate guidance',
    summary: 'ShipSeal can propose CI quality-gate guidance connected to detected commands and workflow evidence.',
    output,
    action: report.scanEvidence.keyFilesFound.ciConfig ? 'strengthen' : 'create',
    actionDescription: report.scanEvidence.keyFilesFound.ciConfig
      ? 'Strengthen verification guidance around existing workflow evidence.'
      : 'Create a generated CI quality-gate example after approval.',
    affected,
    universe,
    atlas,
    evidence: [
      evidence(`CI config detected: ${report.scanEvidence.keyFilesFound.ciConfig ? 'yes' : 'no'}`, 'Scan evidence', report.scanEvidence.keyFilesFound.ciConfig ? 'evidence' : 'heuristic'),
      ...report.stack.runCommands.slice(0, 3).map(command => evidence(command.cmd, command.label, 'evidence')),
    ],
    expectedAgent: 'An agent would connect code changes to the repository verification command path.',
    expectedMeaning: 'Quality checks become a clearer part of the AI workspace map.',
    confidence: confidenceFor(report, report.stack.runCommands.length > 0),
    relationship: 'supports-verification',
  });
}

function proposal(input: {
  id: string;
  domain: RepositoryTransformationDomain;
  title: string;
  summary: string;
  output: GeneratedOutput;
  extraOutputs?: GeneratedOutput[];
  action: RepositoryTransformationArtifactAction['action'];
  actionDescription: string;
  affected: { universe: RepositoryUniverseNode[]; atlas: RepositoryAtlasNode[] };
  universe: RepositoryUniverseModel;
  atlas: RepositoryAtlasModel;
  evidence: WorkspaceEvidenceItem[];
  expectedAgent: string;
  expectedMeaning: string;
  confidence: RepositoryTransformationConfidence;
  relationship: RepositoryTransformationProposedEdge['relationship'];
}): RepositoryTransformationProposal {
  const affectedUniverseIds = unique(input.affected.universe.map(node => node.id));
  const affectedAtlasIds = unique(input.affected.atlas.map(node => node.id));
  const proposedNode = proposedNodeFor(input.id, input.domain, input.output.path, input.title, input.affected, input.universe, input.atlas);
  const artifactActions = [input.output, ...(input.extraOutputs || [])].map((output, index) => ({
    action: input.action,
    path: output.path,
    outputId: output.path,
    description: index === 0 ? input.actionDescription : 'Additional supported generated output in this proposal group.',
    preview: previewFor(output),
  }));

  return {
    id: input.id,
    domain: input.domain,
    title: input.title,
    summary: input.summary,
    evidenceType: input.confidence === 'low' ? 'heuristic' : 'evidence',
    sourceEvidence: input.evidence.slice(0, 6),
    artifactActions,
    graphChanges: {
      proposedNodes: [proposedNode],
      proposedEdges: affectedUniverseIds.slice(0, 8).map(target => ({
        id: `proposal-edge:${input.id}:${target}`,
        proposalId: input.id,
        source: proposedNode.id,
        target,
        relationship: input.relationship,
        evidenceType: input.confidence === 'low' ? 'heuristic' : 'evidence',
      })),
      affectedExistingNodeIds: unique([...affectedUniverseIds, ...affectedAtlasIds]),
    },
    expectedEffect: {
      agentBehavior: input.expectedAgent,
      repositoryMeaning: input.expectedMeaning,
    },
    confidence: input.confidence,
  };
}

function proposedNodeFor(
  proposalId: string,
  domain: RepositoryTransformationDomain,
  artifactPath: string,
  label: string,
  affected: { universe: RepositoryUniverseNode[]; atlas: RepositoryAtlasNode[] },
  universe: RepositoryUniverseModel,
  atlas: RepositoryAtlasModel
): RepositoryTransformationProposedNode {
  const domainOffset = domain === 'project-memory' ? -72 : domain === 'agent-routing' ? 0 : 72;
  const universeCenter = averageUniversePosition(affected.universe) || universe.nodes.find(node => node.id === universe.rootNodeId)?.position || { x: 0, y: 0, z: 0 };
  const atlasCenter = averageAtlasPosition(affected.atlas) || atlas.nodes.find(node => node.id === atlas.rootNodeId) || { x: 0, y: 0 };
  const clusterId = domain === 'project-memory'
    ? 'cluster:project-memory'
    : domain === 'verification-path'
      ? 'cluster:verification'
      : affected.universe[0]?.clusterId || 'cluster:context';

  return {
    id: `proposal-node:${proposalId}`,
    proposalId,
    label,
    domain,
    artifactPath,
    evidenceType: 'missing',
    clusterId,
    position: {
      x: universeCenter.x + 46,
      y: universeCenter.y + domainOffset,
      z: universeCenter.z + 46,
    },
    x: atlasCenter.x + 92,
    y: atlasCenter.y + domainOffset,
  };
}

function affectedNodes(universe: RepositoryUniverseModel, atlas: RepositoryAtlasModel, patterns: RegExp[], limit: number) {
  const universeNodes = universe.nodes.filter(node => {
    const haystack = `${node.path || ''} ${node.label} ${node.metadata.category || ''}`;
    return patterns.some(pattern => pattern.test(haystack));
  }).slice(0, limit);
  const fallback = universeNodes.length ? universeNodes : universe.nodes.filter(node => node.id === universe.rootNodeId);
  return {
    universe: fallback,
    atlas: fallback.map(node => atlasNodeForUniverseNode(node, atlas)).filter(Boolean) as RepositoryAtlasNode[],
  };
}

function atlasNodeForUniverseNode(node: RepositoryUniverseNode, atlas: RepositoryAtlasModel) {
  if (node.metadata.atlasNodeId) {
    const byAtlasId = atlas.nodes.find(item => item.id === node.metadata.atlasNodeId);
    if (byAtlasId) return byAtlasId;
  }
  if (node.path) {
    const byPath = atlas.nodes.find(item => item.path === node.path);
    if (byPath) return byPath;
  }
  return atlas.nodes.find(item => item.id === node.id) || null;
}

function averageUniversePosition(nodes: RepositoryUniverseNode[]) {
  if (!nodes.length) return null;
  return {
    x: nodes.reduce((sum, node) => sum + node.position.x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.position.y, 0) / nodes.length,
    z: nodes.reduce((sum, node) => sum + node.position.z, 0) / nodes.length,
  };
}

function averageAtlasPosition(nodes: RepositoryAtlasNode[]) {
  if (!nodes.length) return null;
  return {
    x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
  };
}

function outputFor(outputs: GeneratedOutput[], path: string) {
  return outputs.find(output => output.path === path);
}

function hasRepositoryPath(report: ReadinessReport, path: string) {
  const normalized = path.toLowerCase();
  return (report.analyzedFiles || report.sampleFiles).some(file => file.path.toLowerCase() === normalized);
}

function hasArchitectureDoc(report: ReadinessReport) {
  return (report.analyzedFiles || report.sampleFiles).some(file => /(^|\/)(architecture|system|design).*\.md$/i.test(file.path));
}

function previewFor(output: GeneratedOutput) {
  const lines = output.content.split('\n').map(line => line.trim()).filter(Boolean);
  const outline = lines.filter(line => /^#{1,3}\s+/.test(line)).slice(0, 5);
  return {
    title: output.path,
    outline: outline.length ? outline : lines.slice(0, 4),
    excerpt: lines.slice(0, 8).join('\n').slice(0, 700),
    source: 'generated-output' as const,
  };
}

function confidenceFor(report: ReadinessReport, enoughEvidence: boolean): RepositoryTransformationConfidence {
  if (report.scanEvidence.limitedScan || report.scanSummary.limited) return 'low';
  return enoughEvidence ? 'high' : 'medium';
}

function evidence(label: string, detail: string, state: WorkspaceStoryEvidenceState): WorkspaceEvidenceItem {
  return { label, detail, state };
}

function folderRegexFromOutputPath(path: string) {
  const folder = path.replace(/^07-context\/folder-agents\//, '').replace(/\/AGENTS\.md$/, '');
  if (folder === 'root') return /^$/;
  return new RegExp(`^${escapeRegExp(folder)}(\\/|$)`, 'i');
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

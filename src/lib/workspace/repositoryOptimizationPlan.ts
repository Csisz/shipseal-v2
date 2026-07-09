import type { ReadinessReport } from '../types';
import { buildScoreJson } from '../exports';
import { buildDeliveryPackFiles } from '../deliveryPack';
import type { DeliveryPackFileKind } from '../deliveryPack/types';
import type { RepositoryAtlasModel } from './workspaceStory';
import type { RepositoryUniverseModel } from './repositoryUniverse';
import type {
  RepositoryTransformationArtifactAction,
  RepositoryTransformationConfidence,
  RepositoryTransformationDomain,
  RepositoryTransformationProposal,
  RepositoryTransformationProposalModel,
} from './repositoryTransformation';

export type RepositoryOptimizationAction = RepositoryTransformationArtifactAction['action'] | 'unavailable';
export type RepositoryOptimizationReadiness = 'ready' | 'review-required' | 'blocked';
export type RepositoryOptimizationInclusionState = 'included' | 'excluded';

export type RepositoryOptimizationConflictKind =
  | 'exact-existing-path'
  | 'case-insensitive-path-collision'
  | 'duplicate-target'
  | 'unresolved-folder-agents-destination'
  | 'unavailable-generator-output'
  | 'inconsistent-action';

export interface RepositoryOptimizationConflict {
  kind: RepositoryOptimizationConflictKind;
  state: Exclude<RepositoryOptimizationReadiness, 'ready'>;
  explanation: string;
  paths: string[];
  proposalIds: string[];
}

export interface RepositoryOptimizationArtifact {
  id: string;
  path: string;
  repositoryDestinationPath: string;
  kind: DeliveryPackFileKind | 'unknown';
  action: RepositoryOptimizationAction;
  source: 'shipseal-delivery-pack-generator';
  generatorId: string;
  content: string;
  outline: string[];
  excerpt: string;
  contributingProposalIds: string[];
}

export interface RepositoryOptimizationAffectedEntity {
  id: string;
  label: string;
  path?: string;
  source: 'universe' | 'atlas';
}

export interface RepositoryOptimizationPlanItem {
  id: string;
  proposalId: string;
  proposalIds: string[];
  domains: RepositoryTransformationDomain[];
  title: string;
  purpose: string;
  artifact: RepositoryOptimizationArtifact;
  evidenceReferences: Array<{ label: string; detail?: string; state: string }>;
  affectedCurrentEntities: RepositoryOptimizationAffectedEntity[];
  expectedAgentBehavior: string[];
  confidence: RepositoryTransformationConfidence;
  inclusionState: RepositoryOptimizationInclusionState;
  readiness: RepositoryOptimizationReadiness;
  conflicts: RepositoryOptimizationConflict[];
  packageReady: boolean;
}

export interface RepositoryOptimizationPlanSummary {
  selectedProposalCount: number;
  excludedProposalCount: number;
  artifactCount: number;
  readyItemCount: number;
  reviewRequiredItemCount: number;
  blockedItemCount: number;
  actionCounts: Record<RepositoryOptimizationAction, number>;
  selectedDomains: RepositoryTransformationDomain[];
}

export interface RepositoryOptimizationManifest {
  schemaVersion: 'shipseal.repository-optimization-plan.v1';
  product: 'ShipSeal';
  repository: {
    name: string;
    fullName?: string;
    sourceType: ReadinessReport['source']['sourceType'];
    ref?: string;
  };
  selectedDomains: RepositoryTransformationDomain[];
  selectedProposalIds: string[];
  artifactCount: number;
  artifacts: Array<{
    id: string;
    path: string;
    repositoryDestinationPath: string;
    kind: DeliveryPackFileKind | 'unknown';
    action: RepositoryOptimizationAction;
    source: 'shipseal-delivery-pack-generator';
    generatorId: string;
    contributingProposalIds: string[];
    evidenceReferences: string[];
    readiness: RepositoryOptimizationReadiness;
    conflicts: RepositoryOptimizationConflictKind[];
  }>;
}

export interface RepositoryOptimizationPlan {
  id: string;
  modelVersion: 'repository-optimization-plan.v1';
  repositoryName: string;
  items: RepositoryOptimizationPlanItem[];
  artifacts: RepositoryOptimizationArtifact[];
  manifest: RepositoryOptimizationManifest;
  summary: RepositoryOptimizationPlanSummary;
  excludedProposalIds: string[];
}

interface BuildRepositoryOptimizationPlanInput {
  report: ReadinessReport;
  transformation: RepositoryTransformationProposalModel;
  universe: RepositoryUniverseModel;
  atlas: RepositoryAtlasModel;
  excludedProposalIds?: Iterable<string>;
}

interface ArtifactAccumulator {
  path: string;
  proposalIds: Set<string>;
  domains: Set<RepositoryTransformationDomain>;
  titles: string[];
  summaries: string[];
  actions: RepositoryTransformationArtifactAction['action'][];
  evidence: RepositoryOptimizationPlanItem['evidenceReferences'];
  affectedIds: Set<string>;
  expectedAgentBehavior: string[];
  confidence: RepositoryTransformationConfidence;
}

const GENERATOR_ID = 'shipseal.delivery-pack.generator.v2';
const DOMAIN_ORDER: RepositoryTransformationDomain[] = ['project-memory', 'agent-routing', 'verification-path'];

export function buildRepositoryOptimizationPlan({
  report,
  transformation,
  universe,
  atlas,
  excludedProposalIds = [],
}: BuildRepositoryOptimizationPlanInput): RepositoryOptimizationPlan {
  const excluded = new Set(excludedProposalIds);
  const generatedOutputByPath = generatedOutputsByCanonicalPath(report);
  const existingPaths = existingRepositoryPaths(report);
  const accumulators = new Map<string, ArtifactAccumulator>();

  for (const proposal of transformation.proposals.filter(proposal => !excluded.has(proposal.id))) {
    for (const action of proposal.artifactActions) {
      const canonicalPath = normalizePath(action.path);
      const accumulator = accumulators.get(canonicalPath) || {
        path: action.path,
        proposalIds: new Set<string>(),
        domains: new Set<RepositoryTransformationDomain>(),
        titles: [],
        summaries: [],
        actions: [],
        evidence: [],
        affectedIds: new Set<string>(),
        expectedAgentBehavior: [],
        confidence: 'high' as RepositoryTransformationConfidence,
      };

      accumulator.proposalIds.add(proposal.id);
      accumulator.domains.add(proposal.domain);
      accumulator.titles.push(proposal.title);
      accumulator.summaries.push(proposal.summary);
      accumulator.actions.push(action.action);
      accumulator.evidence.push(...proposal.sourceEvidence);
      for (const id of proposal.graphChanges.affectedExistingNodeIds) accumulator.affectedIds.add(id);
      accumulator.expectedAgentBehavior.push(proposal.expectedEffect.agentBehavior, proposal.expectedEffect.repositoryMeaning);
      accumulator.confidence = lowestConfidence(accumulator.confidence, proposal.confidence);
      accumulators.set(canonicalPath, accumulator);
    }
  }

  const items = [...accumulators.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(accumulator => planItemFor(accumulator, {
      report,
      universe,
      atlas,
      generatedOutputByPath,
      existingPaths,
    }));

  const artifacts = items.map(item => item.artifact);
  const selectedProposalIds = uniqueSorted(items.flatMap(item => item.proposalIds));
  const selectedDomains = sortDomains(unique(items.flatMap(item => item.domains)));
  const summary = summarize(items, excluded);
  const manifest = buildRepositoryOptimizationManifest(report, items, selectedProposalIds, selectedDomains);

  return {
    id: `repository-optimization-plan:${stableId(report.repoName)}:${stableId(selectedProposalIds.join('|') || 'empty')}`,
    modelVersion: 'repository-optimization-plan.v1',
    repositoryName: report.repoName,
    items,
    artifacts,
    manifest,
    summary,
    excludedProposalIds: [...excluded].sort(),
  };
}

export function prepareRepositoryOptimizationManifest(plan: RepositoryOptimizationPlan): RepositoryOptimizationManifest {
  return plan.manifest;
}

export function serializeRepositoryOptimizationManifest(manifest: RepositoryOptimizationManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function planItemFor(
  accumulator: ArtifactAccumulator,
  input: {
    report: ReadinessReport;
    universe: RepositoryUniverseModel;
    atlas: RepositoryAtlasModel;
    generatedOutputByPath: Map<string, { path: string; content: string; kind: DeliveryPackFileKind }>;
    existingPaths: ExistingRepositoryPaths;
  }
): RepositoryOptimizationPlanItem {
  const proposalIds = [...accumulator.proposalIds].sort();
  const output = input.generatedOutputByPath.get(normalizePath(accumulator.path));
  const repositoryDestinationPath = repositoryDestinationPathFor(accumulator.path);
  const conflicts = conflictsFor(accumulator, repositoryDestinationPath, output, input.existingPaths);
  const readiness = readinessFor(conflicts);
  const action = actionFor(accumulator, repositoryDestinationPath, output, input.existingPaths);
  const content = output?.content || '';
  const artifact: RepositoryOptimizationArtifact = {
    id: `optimization-artifact:${stableId(accumulator.path)}`,
    path: accumulator.path,
    repositoryDestinationPath,
    kind: output?.kind || kindFromPath(accumulator.path),
    action,
    source: 'shipseal-delivery-pack-generator',
    generatorId: GENERATOR_ID,
    content,
    outline: outlineFor(content),
    excerpt: excerptFor(content),
    contributingProposalIds: proposalIds,
  };

  return {
    id: `optimization-plan-item:${stableId(accumulator.path)}`,
    proposalId: proposalIds[0] || 'unknown-proposal',
    proposalIds,
    domains: sortDomains([...accumulator.domains]),
    title: unique(accumulator.titles)[0] || accumulator.path,
    purpose: unique(accumulator.summaries)[0] || 'Generator-backed optimization artifact prepared for review.',
    artifact,
    evidenceReferences: uniqueEvidence(accumulator.evidence).slice(0, 10),
    affectedCurrentEntities: affectedEntities([...accumulator.affectedIds].sort(), input.universe, input.atlas),
    expectedAgentBehavior: unique(accumulator.expectedAgentBehavior).slice(0, 4),
    confidence: accumulator.confidence,
    inclusionState: 'included',
    readiness,
    conflicts,
    packageReady: readiness !== 'blocked' && Boolean(content),
  };
}

function generatedOutputsByCanonicalPath(report: ReadinessReport) {
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

  return new Map(files.map(file => [normalizePath(file.path), {
    path: file.path,
    content: String(file.content),
    kind: file.kind,
  }]));
}

interface ExistingRepositoryPaths {
  exact: Set<string>;
  lowerToPaths: Map<string, string[]>;
}

function existingRepositoryPaths(report: ReadinessReport): ExistingRepositoryPaths {
  const exact = new Set<string>();
  const lowerToPaths = new Map<string, string[]>();

  for (const file of report.analyzedFiles || report.sampleFiles || []) {
    const normalized = normalizePath(file.path);
    exact.add(normalized);
    const lower = normalized.toLowerCase();
    lowerToPaths.set(lower, [...(lowerToPaths.get(lower) || []), file.path]);
  }

  return { exact, lowerToPaths };
}

function conflictsFor(
  accumulator: ArtifactAccumulator,
  repositoryDestinationPath: string,
  output: { path: string; content: string; kind: DeliveryPackFileKind } | undefined,
  existingPaths: ExistingRepositoryPaths
): RepositoryOptimizationConflict[] {
  const conflicts: RepositoryOptimizationConflict[] = [];
  const proposalIds = [...accumulator.proposalIds].sort();
  const normalizedOutputPath = normalizePath(accumulator.path);
  const normalizedDestination = normalizePath(repositoryDestinationPath);
  const exactExisting = existingPaths.exact.has(normalizedOutputPath) || existingPaths.exact.has(normalizedDestination);
  const caseCollision = caseInsensitiveCollision(accumulator.path, repositoryDestinationPath, existingPaths);
  const actions = unique(accumulator.actions);

  if (!output) {
    conflicts.push({
      kind: 'unavailable-generator-output',
      state: 'blocked',
      explanation: 'The selected proposal references an output that is not available from the current Delivery Pack generator.',
      paths: [accumulator.path],
      proposalIds,
    });
  }

  if (isFolderAgentsPath(accumulator.path) && !folderDestinationResolved(repositoryDestinationPath, existingPaths)) {
    conflicts.push({
      kind: 'unresolved-folder-agents-destination',
      state: 'blocked',
      explanation: 'ShipSeal could not verify that the folder-level AGENTS.md destination exists in the scanned repository evidence.',
      paths: [repositoryDestinationPath],
      proposalIds,
    });
  }

  if (actions.length > 1) {
    conflicts.push({
      kind: 'inconsistent-action',
      state: 'review-required',
      explanation: 'Multiple proposals target this artifact with different action semantics, so the final action needs review.',
      paths: [accumulator.path],
      proposalIds,
    });
  }

  if (proposalIds.length > 1) {
    conflicts.push({
      kind: 'duplicate-target',
      state: 'review-required',
      explanation: 'Multiple selected proposals target this generated path. ShipSeal consolidated them into one artifact entry.',
      paths: [accumulator.path],
      proposalIds,
    });
  }

  if (exactExisting) {
    conflicts.push({
      kind: 'exact-existing-path',
      state: 'review-required',
      explanation: 'A matching repository path exists. Generated content is prepared for review and has not been merged.',
      paths: unique([accumulator.path, repositoryDestinationPath]),
      proposalIds,
    });
  }

  if (caseCollision.length > 0) {
    conflicts.push({
      kind: 'case-insensitive-path-collision',
      state: 'review-required',
      explanation: 'A scanned path differs only by letter case. Review the destination before package application.',
      paths: caseCollision,
      proposalIds,
    });
  }

  return conflicts;
}

function actionFor(
  accumulator: ArtifactAccumulator,
  repositoryDestinationPath: string,
  output: { path: string; content: string; kind: DeliveryPackFileKind } | undefined,
  existingPaths: ExistingRepositoryPaths
): RepositoryOptimizationAction {
  if (!output) return 'unavailable';
  const actions = unique(accumulator.actions);
  if (actions.includes('strengthen')) return 'strengthen';

  const destinationExists = existingPaths.exact.has(normalizePath(repositoryDestinationPath)) || existingPaths.exact.has(normalizePath(accumulator.path));
  if (destinationExists && /(^|\/)AGENTS\.md$/i.test(repositoryDestinationPath)) return 'strengthen';
  if (destinationExists) return 'update';
  return actions[0] || 'create';
}

function readinessFor(conflicts: RepositoryOptimizationConflict[]): RepositoryOptimizationReadiness {
  if (conflicts.some(conflict => conflict.state === 'blocked')) return 'blocked';
  if (conflicts.some(conflict => conflict.state === 'review-required')) return 'review-required';
  return 'ready';
}

function repositoryDestinationPathFor(path: string) {
  if (path === '01-agent-instructions/AGENTS.md') return 'AGENTS.md';
  if (path.startsWith('07-context/folder-agents/') && path.endsWith('/AGENTS.md')) {
    const folder = path.replace(/^07-context\/folder-agents\//, '').replace(/\/AGENTS\.md$/, '');
    return folder === 'root' ? 'AGENTS.md' : `${folder}/AGENTS.md`;
  }
  return path;
}

function caseInsensitiveCollision(path: string, repositoryDestinationPath: string, existingPaths: ExistingRepositoryPaths) {
  return unique([path, repositoryDestinationPath].flatMap(candidate => {
    const normalized = normalizePath(candidate);
    const matches = existingPaths.lowerToPaths.get(normalized.toLowerCase()) || [];
    return matches.filter(match => normalizePath(match) !== normalized);
  }));
}

function isFolderAgentsPath(path: string) {
  return path.startsWith('07-context/folder-agents/') && path.endsWith('/AGENTS.md');
}

function folderDestinationResolved(repositoryDestinationPath: string, existingPaths: ExistingRepositoryPaths) {
  const folder = normalizePath(repositoryDestinationPath).replace(/\/?AGENTS\.md$/i, '');
  if (!folder || folder === 'AGENTS.md') return true;
  return [...existingPaths.exact].some(path => path === folder || path.startsWith(`${folder}/`));
}

function affectedEntities(ids: string[], universe: RepositoryUniverseModel, atlas: RepositoryAtlasModel): RepositoryOptimizationAffectedEntity[] {
  const entities: RepositoryOptimizationAffectedEntity[] = [];
  for (const id of ids) {
    const universeNode = universe.nodes.find(node => node.id === id);
    if (universeNode) {
      entities.push({ id: universeNode.id, label: universeNode.label, path: universeNode.path, source: 'universe' });
      continue;
    }
    const atlasNode = atlas.nodes.find(node => node.id === id);
    if (atlasNode) entities.push({ id: atlasNode.id, label: atlasNode.label, path: atlasNode.path, source: 'atlas' });
  }
  return uniqueBy(entities, entity => `${entity.source}:${entity.id}`).slice(0, 12);
}

function summarize(
  items: RepositoryOptimizationPlanItem[],
  excluded: Set<string>
): RepositoryOptimizationPlanSummary {
  const actionCounts: Record<RepositoryOptimizationAction, number> = {
    create: 0,
    update: 0,
    strengthen: 0,
    unavailable: 0,
  };
  for (const item of items) actionCounts[item.artifact.action] += 1;

  return {
    selectedProposalCount: unique(items.flatMap(item => item.proposalIds)).length,
    excludedProposalCount: [...excluded].filter(Boolean).length,
    artifactCount: items.length,
    readyItemCount: items.filter(item => item.readiness === 'ready').length,
    reviewRequiredItemCount: items.filter(item => item.readiness === 'review-required').length,
    blockedItemCount: items.filter(item => item.readiness === 'blocked').length,
    actionCounts,
    selectedDomains: sortDomains(unique(items.flatMap(item => item.domains))),
  };
}

function buildRepositoryOptimizationManifest(
  report: ReadinessReport,
  items: RepositoryOptimizationPlanItem[],
  selectedProposalIds: string[],
  selectedDomains: RepositoryTransformationDomain[]
): RepositoryOptimizationManifest {
  return {
    schemaVersion: 'shipseal.repository-optimization-plan.v1',
    product: 'ShipSeal',
    repository: {
      name: report.repoName,
      fullName: report.scanEvidence.repositoryFullName || undefined,
      sourceType: report.source.sourceType,
      ref: report.source.githubBranch || report.source.githubDefaultBranch || report.scanEvidence.branchOrRef || undefined,
    },
    selectedDomains,
    selectedProposalIds,
    artifactCount: items.length,
    artifacts: items.map(item => ({
      id: item.artifact.id,
      path: item.artifact.path,
      repositoryDestinationPath: item.artifact.repositoryDestinationPath,
      kind: item.artifact.kind,
      action: item.artifact.action,
      source: item.artifact.source,
      generatorId: item.artifact.generatorId,
      contributingProposalIds: item.proposalIds,
      evidenceReferences: item.evidenceReferences.map(evidence => evidence.detail ? `${evidence.label} - ${evidence.detail}` : evidence.label),
      readiness: item.readiness,
      conflicts: item.conflicts.map(conflict => conflict.kind),
    })),
  };
}

function outlineFor(content: string) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  const headings = lines.filter(line => /^#{1,3}\s+/.test(line)).slice(0, 6);
  return headings.length ? headings : lines.slice(0, 5);
}

function excerptFor(content: string) {
  return content.split('\n').slice(0, 18).join('\n').trim().slice(0, 1200);
}

function kindFromPath(path: string): DeliveryPackFileKind | 'unknown' {
  if (/\.ya?ml$/i.test(path)) return 'yaml';
  if (/\.json$/i.test(path)) return 'json';
  if (/\.html?$/i.test(path)) return 'html';
  if (/\.md$/i.test(path)) return 'markdown';
  return 'unknown';
}

function lowestConfidence(current: RepositoryTransformationConfidence, next: RepositoryTransformationConfidence): RepositoryTransformationConfidence {
  const rank: Record<RepositoryTransformationConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[next] < rank[current] ? next : current;
}

function sortDomains(domains: RepositoryTransformationDomain[]) {
  return domains.sort((left, right) => DOMAIN_ORDER.indexOf(left) - DOMAIN_ORDER.indexOf(right));
}

function uniqueEvidence(items: RepositoryOptimizationPlanItem['evidenceReferences']) {
  return uniqueBy(items, item => `${item.state}:${item.label}:${item.detail || ''}`);
}

function uniqueSorted(values: string[]) {
  return unique(values).sort();
}

function unique<T extends string>(values: T[]) {
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

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function stableId(value: string) {
  return normalizePath(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
}

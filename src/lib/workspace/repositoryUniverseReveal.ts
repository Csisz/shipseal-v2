import type { RepositoryUniverseEdge, RepositoryUniverseModel, RepositoryUniverseNode } from './repositoryUniverse';

export type RepositoryUniverseRevealPhase = 'core' | 'clusters' | 'important' | 'relationships' | 'supporting' | 'settled';

export interface RepositoryUniverseRevealSchedule {
  durationMs: number;
  nodePhaseById: ReadonlyMap<string, RepositoryUniverseRevealPhase>;
  edgePhaseById: ReadonlyMap<string, RepositoryUniverseRevealPhase>;
  nodeOrder: readonly string[];
  edgeOrder: readonly string[];
}

const NODE_PHASE_WEIGHT: Record<RepositoryUniverseRevealPhase, number> = { core: 0, clusters: 1, important: 2, relationships: 3, supporting: 4, settled: 5 };
const IMPORTANCE_WEIGHT = { primary: 0, supporting: 1, background: 2 } as const;

export function repositoryUniverseRevealDuration(nodeCount: number) {
  if (nodeCount <= 12) return 2000;
  if (nodeCount <= 48) return 2450;
  return 3000;
}

export function buildRepositoryUniverseRevealSchedule(model: Pick<RepositoryUniverseModel, 'rootNodeId' | 'nodes' | 'edges'>): RepositoryUniverseRevealSchedule {
  const degree = new Map<string, number>();
  for (const edge of model.edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  const primaryClusterLeaders = new Set<string>();
  for (const node of sortedNodes(model.nodes, degree)) {
    if (!primaryClusterLeaders.has(node.clusterId) && node.id !== model.rootNodeId) primaryClusterLeaders.add(node.clusterId);
  }
  const nodePhaseById = new Map<string, RepositoryUniverseRevealPhase>();
  for (const node of model.nodes) {
    const phase: RepositoryUniverseRevealPhase = node.id === model.rootNodeId
      ? 'core'
      : primaryClusterLeaders.has(node.clusterId) && node.importance !== 'background'
        ? 'clusters'
        : node.importance === 'primary'
          ? 'important'
          : 'supporting';
    nodePhaseById.set(node.id, phase);
  }
  const edgePhaseById = new Map<string, RepositoryUniverseRevealPhase>();
  for (const edge of model.edges) edgePhaseById.set(edge.id, edgePhaseFor(edge, nodePhaseById));
  const nodeOrder = sortedNodes(model.nodes, degree).sort((left, right) => NODE_PHASE_WEIGHT[nodePhaseById.get(left.id)!] - NODE_PHASE_WEIGHT[nodePhaseById.get(right.id)!] || left.id.localeCompare(right.id)).map(node => node.id);
  const edgeOrder = [...model.edges].sort((left, right) => NODE_PHASE_WEIGHT[edgePhaseById.get(left.id)!] - NODE_PHASE_WEIGHT[edgePhaseById.get(right.id)!] || left.id.localeCompare(right.id)).map(edge => edge.id);
  return { durationMs: repositoryUniverseRevealDuration(model.nodes.length), nodePhaseById, edgePhaseById, nodeOrder, edgeOrder };
}

export function repositoryUniverseRevealProgress(schedule: RepositoryUniverseRevealSchedule, elapsedMs: number, interrupted = false) {
  const progress = interrupted ? 1 : Math.max(0, Math.min(1, elapsedMs / schedule.durationMs));
  const phase: RepositoryUniverseRevealPhase = progress >= 1 ? 'settled' : progress < .18 ? 'core' : progress < .38 ? 'clusters' : progress < .58 ? 'important' : progress < .74 ? 'relationships' : 'supporting';
  const phaseWeight = NODE_PHASE_WEIGHT[phase];
  const visibleNodes = schedule.nodeOrder.filter(id => NODE_PHASE_WEIGHT[schedule.nodePhaseById.get(id)!] <= phaseWeight);
  const visibleEdges = schedule.edgeOrder.filter(id => NODE_PHASE_WEIGHT[schedule.edgePhaseById.get(id)!] <= phaseWeight);
  return { progress, phase, completed: progress === 1, visibleNodes, visibleEdges };
}

function sortedNodes(nodes: readonly RepositoryUniverseNode[], degree: ReadonlyMap<string, number>) {
  return [...nodes].sort((left, right) => IMPORTANCE_WEIGHT[left.importance] - IMPORTANCE_WEIGHT[right.importance] || (degree.get(right.id) || 0) - (degree.get(left.id) || 0) || left.id.localeCompare(right.id));
}

function edgePhaseFor(edge: RepositoryUniverseEdge, phases: ReadonlyMap<string, RepositoryUniverseRevealPhase>): RepositoryUniverseRevealPhase {
  const source = phases.get(edge.source) || 'supporting';
  const target = phases.get(edge.target) || 'supporting';
  return source === 'core' && target === 'core' ? 'core' : source === 'supporting' && target === 'supporting' ? 'supporting' : 'relationships';
}

import type {
  RepositoryFutureStageCandidate,
  RepositoryFutureStageOverlay,
} from './futurePathwaysPresentation';

export const FUTURES_CANVAS_WORLD = { width: 1480, height: 820 } as const;
export type RepositoryFuturesCanvasOrientation = 'horizontal' | 'vertical';

export type RepositoryFuturesCanvasNode = {
  id: string;
  kind: 'repository' | 'goal' | 'dependency';
  role: 'current' | RepositoryFutureStageCandidate['role'] | 'required' | 'satisfied';
  title: string;
  x: number;
  y: number;
  depth: 0 | 1 | 2 | 3;
  candidate?: RepositoryFutureStageCandidate;
  dependency?: RepositoryFutureStageOverlay['dependencies'][number];
};

export type RepositoryFuturesCanvasEdge = {
  id: string;
  kind: 'grounding' | 'requirement' | 'selected-path';
  sourceId: string;
  targetId: string;
  goalIds: string[];
  selected: boolean;
};

export interface RepositoryFuturesCanvasModel {
  nodes: RepositoryFuturesCanvasNode[];
  edges: RepositoryFuturesCanvasEdge[];
  horizons: Array<{ depth: 1 | 2 | 3; label: string; position: number }>;
  orientation: RepositoryFuturesCanvasOrientation;
  world: { width: number; height: number };
}

const roleOrder: Record<RepositoryFutureStageCandidate['role'], number> = {
  primary: 0,
  supporting: 1,
  candidate: 2,
  saved: 3,
  blocked: 4,
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function goalDepth(candidate: RepositoryFutureStageCandidate): 1 | 2 | 3 {
  if (candidate.role === 'primary') return 3;
  if (candidate.role === 'supporting' || candidate.role === 'saved') return 2;
  if (candidate.role === 'blocked') return 1;
  return (1 + (stableHash(candidate.goalId) % 3)) as 1 | 2 | 3;
}

function lane(index: number, count: number) {
  if (count <= 1) return FUTURES_CANVAS_WORLD.height / 2;
  return 126 + (index / (count - 1)) * 568;
}

/**
 * Pure visual adapter. It never derives eligibility, compatibility, selection,
 * or dependency closure; those facts must already exist in the stage overlay.
 */
export function buildRepositoryFuturesCanvasModel(
  repositoryName: string,
  overlay: Pick<RepositoryFutureStageOverlay, 'candidates' | 'dependencies' | 'productIntelligenceState'>,
  orientation: RepositoryFuturesCanvasOrientation = 'horizontal',
): RepositoryFuturesCanvasModel {
  const repositoryId = `repository:${repositoryName}`;
  const nodes: RepositoryFuturesCanvasNode[] = [{
    id: repositoryId,
    kind: 'repository',
    role: 'current',
    title: repositoryName,
    x: 150,
    y: FUTURES_CANVAS_WORLD.height / 2,
    depth: 0,
  }];
  const edges: RepositoryFuturesCanvasEdge[] = [];
  // The overlay already contains repository-grounded fallback candidates. Keep
  // that real topology visible while enhanced Product Intelligence is forming.
  const candidates = overlay.candidates.slice().sort((left, right) => roleOrder[left.role] - roleOrder[right.role] || left.goalId.localeCompare(right.goalId));

  candidates.forEach((candidate, index) => {
    const depth = goalDepth(candidate);
    const selected = candidate.role === 'primary' || candidate.role === 'supporting';
    nodes.push({
      id: candidate.goalId,
      kind: 'goal',
      role: candidate.role,
      title: candidate.title,
      x: 540 + depth * 250 + ((stableHash(candidate.goalId) % 41) - 20),
      y: candidate.role === 'primary' ? FUTURES_CANVAS_WORLD.height / 2 : lane(index, candidates.length),
      depth,
      candidate,
    });
    // Candidate evidence/mappings are the real grounding for this repository edge.
    if (candidate.evidenceCount > 0 || candidate.universeNodeIds.length > 0) {
      edges.push({
        id: `grounding:${candidate.goalId}`,
        kind: 'grounding',
        sourceId: repositoryId,
        targetId: candidate.goalId,
        goalIds: [candidate.goalId],
        selected,
      });
    }
  });

  const goalIds = new Set(candidates.map(candidate => candidate.goalId));
  overlay.dependencies
    .slice()
    .sort((left, right) => left.executionOrder - right.executionOrder || left.id.localeCompare(right.id))
    .forEach((dependency, index, dependencies) => {
      const relatedGoalIds = dependency.dependentGoalIds.filter(goalId => goalIds.has(goalId));
      if (!relatedGoalIds.length) return;
      const span = Math.max(1, dependencies.length - 1);
      nodes.push({
        id: dependency.id,
        kind: 'dependency',
        role: dependency.state === 'satisfied' ? 'satisfied' : 'required',
        title: dependency.title,
        x: 690 + (index / span) * 260,
        y: 330 + (index % 2) * 160,
        depth: 2,
        dependency,
      });
      relatedGoalIds.forEach(goalId => edges.push({
        id: `requirement:${dependency.id}:${goalId}`,
        kind: 'requirement',
        sourceId: dependency.id,
        targetId: goalId,
        goalIds: [goalId],
        selected: true,
      }));
    });

  const primary = candidates.find(candidate => candidate.role === 'primary');
  if (primary) {
    candidates.filter(candidate => candidate.role === 'supporting').forEach(candidate => edges.push({
      id: `selected-path:${candidate.goalId}:${primary.goalId}`,
      kind: 'selected-path',
      sourceId: candidate.goalId,
      targetId: primary.goalId,
      goalIds: [candidate.goalId, primary.goalId],
      selected: true,
    }));
  }

  const orientedNodes = orientation === 'vertical'
    ? nodes.map(node => ({ ...node, x: node.y, y: node.x }))
    : nodes;
  return {
    nodes: orientedNodes,
    edges,
    horizons: [
      { depth: 1, label: 'Near horizon', position: 650 },
      { depth: 2, label: 'Middle horizon', position: 900 },
      { depth: 3, label: 'Far horizon', position: 1150 },
    ],
    orientation,
    world: orientation === 'vertical'
      ? { width: FUTURES_CANVAS_WORLD.height, height: FUTURES_CANVAS_WORLD.width }
      : FUTURES_CANVAS_WORLD,
  };
}

export function repositoryFuturesTrace(model: RepositoryFuturesCanvasModel, nodeId?: string) {
  if (!nodeId) return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>([nodeId]);
  const addEdge = (edge: RepositoryFuturesCanvasEdge) => {
    edgeIds.add(edge.id);
    nodeIds.add(edge.sourceId);
    nodeIds.add(edge.targetId);
  };
  model.edges.forEach(edge => {
    if (edge.sourceId === nodeId || edge.targetId === nodeId || edge.goalIds.includes(nodeId)) {
      addEdge(edge);
    }
  });
  const directlyRelatedDependencyIds = new Set([...nodeIds].filter(id => model.nodes.find(node => node.id === id)?.kind === 'dependency'));
  model.edges.filter(edge => edge.kind === 'requirement' && directlyRelatedDependencyIds.has(edge.sourceId)).forEach(addEdge);
  const relatedGoalIds = new Set([...nodeIds].filter(id => model.nodes.find(node => node.id === id)?.kind === 'goal'));
  model.edges.filter(edge => edge.kind === 'selected-path' && edge.goalIds.some(goalId => relatedGoalIds.has(goalId))).forEach(addEdge);
  model.edges.filter(edge => edge.kind === 'grounding' && relatedGoalIds.has(edge.targetId)).forEach(addEdge);
  return { nodeIds, edgeIds };
}

export function repositoryFuturesEdgePath(
  edge: RepositoryFuturesCanvasEdge,
  nodes: Map<string, RepositoryFuturesCanvasNode>,
  orientation: RepositoryFuturesCanvasOrientation = 'horizontal',
) {
  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);
  if (!source || !target) return '';
  const bend = ((stableHash(edge.id) % 81) - 40) * 0.45;
  if (orientation === 'vertical') {
    const distance = target.y - source.y;
    return `M ${source.x} ${source.y} C ${source.x + bend} ${source.y + distance * 0.38}, ${target.x - bend} ${target.y - distance * 0.32}, ${target.x} ${target.y}`;
  }
  const distance = target.x - source.x;
  return `M ${source.x} ${source.y} C ${source.x + distance * 0.38} ${source.y + bend}, ${target.x - distance * 0.32} ${target.y - bend}, ${target.x} ${target.y}`;
}

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
  canonicalPosition?: {
    candidateId: string;
    futureDepth: 1 | 2 | 3;
    lane: number;
    x: number;
    y: number;
  };
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

// Used only to resolve malformed duplicate presentation records. Role priority
// must never participate in canonical placement or ordinary node ordering.
const resolvedRoleOrder: Record<RepositoryFutureStageCandidate['role'], number> = {
  primary: 0,
  supporting: 1,
  saved: 2,
  blocked: 3,
  candidate: 4,
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function repositoryFutureDepth(candidate: Pick<RepositoryFutureStageCandidate, 'goalId' | 'futureDepth'>): 1 | 2 | 3 {
  return candidate.futureDepth || (1 + (stableHash(candidate.goalId) % 3)) as 1 | 2 | 3;
}

export function repositoryFutureCanonicalPosition(
  candidate: Pick<RepositoryFutureStageCandidate, 'goalId' | 'futureDepth'>,
) {
  const futureDepth = repositoryFutureDepth(candidate);
  const identityHash = stableHash(candidate.goalId);
  const lane = identityHash % 7;
  return {
    candidateId: candidate.goalId,
    futureDepth,
    lane,
    x: 650 + (futureDepth - 1) * 250 + ((stableHash(`${candidate.goalId}:depth`) % 41) - 20),
    y: 126 + lane * (568 / 6) + ((stableHash(`${candidate.goalId}:lane`) % 25) - 12),
  };
}

function uniqueCandidates(candidates: RepositoryFutureStageCandidate[]) {
  const byGoalId = new Map<string, RepositoryFutureStageCandidate>();
  candidates.forEach(candidate => {
    const existing = byGoalId.get(candidate.goalId);
    if (!existing || resolvedRoleOrder[candidate.role] < resolvedRoleOrder[existing.role]) {
      byGoalId.set(candidate.goalId, candidate);
    }
  });
  return [...byGoalId.values()].sort((left, right) => left.goalId.localeCompare(right.goalId));
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
  const candidates = uniqueCandidates(overlay.candidates);

  candidates.forEach(candidate => {
    const canonicalPosition = repositoryFutureCanonicalPosition(candidate);
    const depth = canonicalPosition.futureDepth;
    const selected = candidate.role === 'primary' || candidate.role === 'supporting';
    nodes.push({
      id: candidate.goalId,
      kind: 'goal',
      role: candidate.role,
      title: candidate.title,
      x: canonicalPosition.x,
      y: canonicalPosition.y,
      depth,
      canonicalPosition,
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
  const goalNodes = new Map(nodes.filter(node => node.kind === 'goal').map(node => [node.id, node]));
  const dependencies = [...new Map(overlay.dependencies.map(dependency => [dependency.id, dependency])).values()]
    .sort((left, right) => left.executionOrder - right.executionOrder || left.id.localeCompare(right.id));
  dependencies.forEach((dependency, index) => {
    const relatedGoalIds = [...new Set(dependency.dependentGoalIds.filter(goalId => goalIds.has(goalId)))];
    if (!relatedGoalIds.length) return;
    const relatedGoals = relatedGoalIds.flatMap(goalId => {
      const goal = goalNodes.get(goalId);
      return goal ? [goal] : [];
    });
    const earliestDependentX = Math.min(...relatedGoals.map(goal => goal.x));
    const dependentLaneCenter = relatedGoals.reduce((total, goal) => total + goal.y, 0) / relatedGoals.length;
    const prerequisiteStartX = 350;
    const prerequisiteEndX = Math.max(prerequisiteStartX, earliestDependentX - 150);
    const progress = (index + 1) / (dependencies.length + 1);
    const dependencyX = prerequisiteStartX + (prerequisiteEndX - prerequisiteStartX) * progress;
    const dependencyY = Math.max(110, Math.min(710,
      dependentLaneCenter + ((stableHash(`${dependency.id}:prerequisite-lane`) % 81) - 40),
    ));
    const earliestDepth = Math.min(...relatedGoals.map(goal => goal.depth as 1 | 2 | 3));
    nodes.push({
      id: dependency.id,
      kind: 'dependency',
      role: dependency.state === 'satisfied' ? 'satisfied' : 'required',
      title: dependency.title,
      x: dependencyX,
      y: dependencyY,
      depth: Math.max(1, earliestDepth - 1) as 1 | 2,
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
    candidates.filter(candidate => candidate.role === 'supporting').forEach(candidate => {
      const supportNode = goalNodes.get(candidate.goalId);
      const primaryNode = goalNodes.get(primary.goalId);
      if (!supportNode || !primaryNode) return;
      const [sourceId, targetId] = supportNode.x <= primaryNode.x
        ? [candidate.goalId, primary.goalId]
        : [primary.goalId, candidate.goalId];
      edges.push({
        id: `selected-path:${candidate.goalId}:${primary.goalId}`,
        kind: 'selected-path',
        sourceId,
        targetId,
        goalIds: [candidate.goalId, primary.goalId],
        selected: true,
      });
    });
  }

  const orientedNodes = orientation === 'vertical'
    ? nodes.map(node => ({
      ...node,
      x: node.y,
      y: node.x,
      canonicalPosition: node.canonicalPosition ? {
        ...node.canonicalPosition,
        x: node.canonicalPosition.y,
        y: node.canonicalPosition.x,
      } : undefined,
    }))
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

export function repositoryFuturesSelectedPlanNodes(model: RepositoryFuturesCanvasModel) {
  const selectedGoalIds = new Set(model.nodes
    .filter(node => node.kind === 'goal' && (node.role === 'primary' || node.role === 'supporting'))
    .map(node => node.id));
  const selectedDependencyIds = new Set(model.edges
    .filter(edge => edge.kind === 'requirement' && edge.goalIds.some(goalId => selectedGoalIds.has(goalId)))
    .map(edge => edge.sourceId));
  return model.nodes.filter(node => node.kind === 'repository'
    || selectedGoalIds.has(node.id)
    || selectedDependencyIds.has(node.id));
}

export function repositoryFuturesEdgePath(
  edge: RepositoryFuturesCanvasEdge,
  nodes: Map<string, RepositoryFuturesCanvasNode>,
  orientation: RepositoryFuturesCanvasOrientation = 'horizontal',
) {
  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);
  if (!source || !target) return '';
  const bend = ((stableHash(edge.id) % 81) - 40) * 0.52;
  if (orientation === 'vertical') {
    const distance = target.y - source.y;
    const fieldSweep = Math.sign(target.x - source.x || bend || 1)
      * Math.min(104, 22 + Math.abs(target.x - source.x) * 0.2);
    return `M ${source.x} ${source.y} C ${source.x + bend + fieldSweep} ${source.y + distance * 0.34}, ${target.x - bend - fieldSweep * 0.48} ${target.y - distance * 0.3}, ${target.x} ${target.y}`;
  }
  const distance = target.x - source.x;
  const fieldSweep = Math.sign(target.y - source.y || bend || 1)
    * Math.min(104, 22 + Math.abs(target.y - source.y) * 0.2);
  return `M ${source.x} ${source.y} C ${source.x + distance * 0.34} ${source.y + bend + fieldSweep}, ${target.x - distance * 0.3} ${target.y - bend - fieldSweep * 0.48}, ${target.x} ${target.y}`;
}

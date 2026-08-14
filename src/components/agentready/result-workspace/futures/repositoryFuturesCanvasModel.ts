import type {
  RepositoryFutureStageCandidate,
  RepositoryFutureStageOverlay,
} from './futurePathwaysPresentation';

export const FUTURES_CANVAS_WORLD = { width: 1820, height: 1040 } as const;
export type RepositoryFuturesCanvasOrientation = 'horizontal' | 'vertical';
export type RepositoryFuturesPresentationStream = 'strategic' | 'evidence' | 'product' | 'foundation' | 'exploratory' | 'general';

export type RepositoryFuturesCanvasNode = {
  id: string;
  kind: 'repository' | 'goal' | 'evolution' | 'capability' | 'artifact' | 'dependency';
  role: 'current' | RepositoryFutureStageCandidate['role'] | 'branch' | 'required' | 'satisfied';
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
  presentationRow?: {
    index: number;
    label: string;
    stream: RepositoryFuturesPresentationStream;
  };
  candidate?: RepositoryFutureStageCandidate;
  parentGoalId?: string;
  dependency?: RepositoryFutureStageOverlay['dependencies'][number];
  selected?: boolean;
  summary?: string;
  userValue?: string;
};

export type RepositoryFuturesCanvasEdge = {
  id: string;
  kind: 'grounding' | 'expansion' | 'requirement' | 'selected-path';
  sourceId: string;
  targetId: string;
  goalIds: string[];
  selected: boolean;
};

export interface RepositoryFuturesCanvasModel {
  nodes: RepositoryFuturesCanvasNode[];
  edges: RepositoryFuturesCanvasEdge[];
  horizons: Array<{ depth: 1 | 2 | 3; label: string; position: number }>;
  progressionBands: Array<{ id: 'current' | 'now' | 'next' | 'later' | 'future'; label: string; position: number }>;
  streamRows: Array<{ index: number; label: string; position: number; occupied: number }>;
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

const structuredRows = [
  { label: 'Strategic opportunities', position: 130 },
  { label: 'Evidence-backed opportunities', position: 230 },
  { label: 'Product & preview directions', position: 330 },
  { label: 'Knowledge systems', position: 430 },
  { label: 'Agent workflows', position: 530 },
  { label: 'Delivery systems', position: 630 },
  { label: 'Safety & governance', position: 730 },
  { label: 'Exploratory directions', position: 830 },
] as const;

const lattice = {
  repository: 150,
  direction: 500,
  next: 850,
  later: 1200,
  outcome: 1550,
} as const;

const verticalStreamPosition = (index: number) => 40 + index * 95;

function repositoryFoundationRow(candidate: RepositoryFutureStageCandidate) {
  const title = candidate.title.toLowerCase();
  const signal = `${title} ${candidate.capabilityTitle || ''} ${candidate.capabilityId}`.toLowerCase();
  if (/\b(security|privacy|data|critical|risk|auth|compliance|policy)\b/.test(title)) return 6;
  if (/\b(deploy|deployment|release|rollback|handoff|delivery)\b/.test(title)) return 5;
  if (/\b(preview|interface|visual|map|experience)\b/.test(title)) return 2;
  if (/\b(documentation|docs?|readme|knowledge|index|memory)\b/.test(title)) return 3;
  if (/\b(route|routing|workflow|command|agent|instruction|test|verification)\b/.test(title)) return 4;
  if (/\b(security|privacy|data|critical|risk|auth|compliance|policy)\b/.test(signal)) return 6;
  if (/\b(deploy|deployment|release|rollback|handoff|delivery)\b/.test(signal)) return 5;
  if (/\b(preview|interface|visual|map|experience)\b/.test(signal)) return 2;
  if (/\b(documentation|docs?|readme|knowledge|index|memory|context)\b/.test(signal)) return 3;
  if (/\b(route|routing|workflow|command|agent|instruction|test|verification)\b/.test(signal)) return 4;
  return 3 + (stableHash(`${candidate.goalId}:foundation-row`) % 4);
}

function repositoryFuturePresentationRow(candidate: RepositoryFutureStageCandidate) {
  let stream: RepositoryFuturesPresentationStream;
  let index: number;
  if (candidate.candidateClass === 'product-opportunity' && candidate.opportunityOrigin === 'strategic') {
    stream = 'strategic';
    index = 0;
  } else if (candidate.candidateClass === 'product-opportunity' && candidate.opportunityOrigin === 'evidence-backed') {
    stream = 'evidence';
    index = 1;
  } else if (candidate.candidateClass === 'product-opportunity' && candidate.opportunityOrigin === 'exploratory') {
    stream = 'exploratory';
    index = 7;
  } else if (candidate.candidateClass === 'product-opportunity') {
    stream = 'product';
    index = 2;
  } else if (candidate.candidateClass === 'repository-improvement') {
    stream = 'foundation';
    index = repositoryFoundationRow(candidate);
  } else {
    stream = 'general';
    index = repositoryFoundationRow(candidate);
  }
  return {
    index,
    label: structuredRows[index].label,
    stream,
    y: structuredRows[index].position,
  };
}

function repositoryFutureStructuredPosition(candidate: RepositoryFutureStageCandidate) {
  const depth = repositoryFutureDepth(candidate);
  const row = repositoryFuturePresentationRow(candidate);
  return {
    x: 610 + (depth - 1) * 290 + ((stableHash(`${candidate.goalId}:structured-depth`) % 37) - 18),
    y: row.y,
    row,
  };
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
  overlay: Pick<RepositoryFutureStageOverlay, 'candidates' | 'projections' | 'dependencies' | 'productIntelligenceState'>,
  orientation: RepositoryFuturesCanvasOrientation = 'horizontal',
): RepositoryFuturesCanvasModel {
  const repositoryId = `repository:${repositoryName}`;
  const nodes: RepositoryFuturesCanvasNode[] = [{
    id: repositoryId,
    kind: 'repository',
    role: 'current',
    title: repositoryName,
    x: lattice.repository,
    y: 520,
    depth: 0,
  }];
  const edges: RepositoryFuturesCanvasEdge[] = [];
  // The interactive topology is gated until the actual response reaches a
  // terminal state. No deterministic/example nodes leak into the forming UI.
  const readyCandidates = overlay.productIntelligenceState === 'analysing' ? [] : uniqueCandidates(overlay.candidates);
  // The phone field keeps six real directions so every lane remains tappable;
  // the complete eight-direction generation remains available on larger views.
  const candidates = orientation === 'vertical' ? readyCandidates.slice(0, 6) : readyCandidates;
  const occupiedVisualRows = new Set<number>();
  const visualRowByGoalId = new Map<string, number>();
  candidates.forEach(candidate => {
    const semanticRow = repositoryFuturePresentationRow(candidate).index;
    // The exploratory stream starts beside the sixth lane instead of jumping
    // to a detached floor; additional routes can still occupy lanes 7 and 8.
    const preferredRow = semanticRow === 7 ? 5 : semanticRow;
    const visualRow = [...structuredRows.keys()]
      .filter(index => !occupiedVisualRows.has(index))
      .sort((left, right) => Math.abs(left - preferredRow) - Math.abs(right - preferredRow) || left - right)[0]
      ?? preferredRow;
    occupiedVisualRows.add(visualRow);
    visualRowByGoalId.set(candidate.goalId, visualRow);
  });

  candidates.forEach(candidate => {
    const canonicalPosition = repositoryFutureCanonicalPosition(candidate);
    const structuredPosition = repositoryFutureStructuredPosition(candidate);
    const visualRowIndex = visualRowByGoalId.get(candidate.goalId) ?? structuredPosition.row.index;
    const depth = canonicalPosition.futureDepth;
    const selected = candidate.role === 'primary' || candidate.role === 'supporting';
    nodes.push({
      id: candidate.goalId,
      kind: 'goal',
      role: candidate.role,
      title: candidate.title,
      x: lattice.direction,
      y: structuredRows[visualRowIndex].position,
      depth,
      canonicalPosition,
      presentationRow: {
        index: visualRowIndex,
        label: structuredPosition.row.label,
        stream: structuredPosition.row.stream,
      },
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

  const goalNodesForCentering = nodes.filter(node => node.kind === 'goal');
  if (goalNodesForCentering.length) {
    const goalYs = goalNodesForCentering.map(node => node.y);
    nodes[0].y = (Math.min(...goalYs) + Math.max(...goalYs)) / 2;
  }

  const goalNodeById = new Map(nodes.filter(node => node.kind === 'goal').map(node => [node.id, node]));
  const projectionNodeById = new Map<string, RepositoryFuturesCanvasNode>(goalNodeById);
  const projections = overlay.projections || [];
  projections
    .filter(projection => goalNodeById.has(projection.goalId))
    .sort((left, right) => left.goalId.localeCompare(right.goalId)
      || (left.generation || 4) - (right.generation || 4)
      || left.order - right.order)
    .forEach(projection => {
      const goal = goalNodeById.get(projection.goalId)!;
      const sourceNode = projectionNodeById.get(projection.sourceId) || goal;
      const siblings = projections.filter(item => item.goalId === projection.goalId && item.kind === projection.kind && item.sourceId === projection.sourceId);
      const siblingIndex = Math.max(0, siblings.findIndex(item => item.id === projection.id));
      const siblingRank = siblingIndex - (siblings.length - 1) / 2;
      const siblingOffset = siblingRank * (projection.kind === 'evolution' ? 24 : 34);
      const generationTwoSpread = projection.kind === 'evolution' && projection.generation !== 3 && siblings.length > 1
        ? siblingIndex * 160
        : 0;
      const x = (projection.kind === 'evolution'
        ? projection.generation === 3 ? lattice.later : lattice.next
        : projection.kind === 'capability' ? lattice.next : lattice.outcome) + generationTwoSpread;
      const y = projection.kind === 'evolution' ? sourceNode.y + siblingOffset : goal.y + siblingOffset;
      const node: RepositoryFuturesCanvasNode = {
        id: projection.id,
        kind: projection.kind,
        role: 'branch',
        title: projection.title,
        x,
        y,
        depth: projection.kind === 'evolution' ? projection.generation || 2 : projection.kind === 'capability' ? 2 : 3,
        presentationRow: goal.presentationRow,
        parentGoalId: projection.goalId,
        selected: goal.role === 'primary' || goal.role === 'supporting',
        summary: projection.summary,
        userValue: projection.userValue,
      };
      nodes.push(node);
      projectionNodeById.set(node.id, node);
      edges.push({
        id: `expansion:${projection.sourceId}:${projection.id}`,
        kind: 'expansion',
        sourceId: projection.sourceId,
        targetId: projection.id,
        goalIds: [projection.goalId],
        selected: goal.role === 'primary' || goal.role === 'supporting',
      });
    });

  const goalIds = new Set(candidates.map(candidate => candidate.goalId));
  const goalNodes = new Map(nodes.filter(node => node.kind === 'goal').map(node => [node.id, node]));
  const dependencies = [...new Map(overlay.dependencies.map(dependency => [dependency.id, dependency])).values()]
    .sort((left, right) => left.executionOrder - right.executionOrder || left.id.localeCompare(right.id));
  const placedDependencies: Array<{ x: number; y: number }> = [];
  dependencies.forEach(dependency => {
    const relatedGoalIds = [...new Set(dependency.dependentGoalIds.filter(goalId => goalIds.has(goalId)))];
    if (!relatedGoalIds.length) return;
    const relatedGoals = relatedGoalIds.flatMap(goalId => {
      const goal = goalNodes.get(goalId);
      return goal ? [goal] : [];
    });
    const routeX = relatedGoals.reduce((sum, goal) => sum + goal.x, 0) / relatedGoals.length;
    const routeY = relatedGoals.reduce((sum, goal) => sum + goal.y, 0) / relatedGoals.length;
    const placementOptions = [
      { x: routeX + 110, y: routeY - 22 },
      { x: routeX + 210, y: routeY + 22 },
      { x: routeX + 110, y: routeY + 34 },
      { x: routeX + 210, y: routeY - 34 },
    ];
    const placement = placementOptions.find(option => placedDependencies.every(existing => (
      Math.abs(existing.x - option.x) >= 96 || Math.abs(existing.y - option.y) >= 76
    ))) || placementOptions[placedDependencies.length % placementOptions.length];
    placedDependencies.push(placement);
    const earliestDepth = Math.min(...relatedGoals.map(goal => goal.depth as 1 | 2 | 3));
    nodes.push({
      id: dependency.id,
      kind: 'dependency',
      role: dependency.state === 'satisfied' ? 'satisfied' : 'required',
      title: dependency.title,
      x: placement.x,
      y: placement.y,
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
    ? nodes.map(node => {
      const rowOffset = node.presentationRow
        ? node.y - structuredRows[node.presentationRow.index].position
        : 0;
      return {
        ...node,
        x: node.presentationRow ? verticalStreamPosition(node.presentationRow.index) + rowOffset : node.y,
        // In the top-to-bottom field, evolution siblings need a small flow-axis
        // stagger as well as their lane offset; otherwise their compact overview
        // targets stack even though the semantic branch is distinct.
        y: node.x + (node.kind === 'evolution' ? rowOffset * 4 : 0),
        canonicalPosition: node.canonicalPosition ? {
          ...node.canonicalPosition,
          x: node.canonicalPosition.y,
          y: node.canonicalPosition.x,
        } : undefined,
      };
    })
    : nodes;
  return {
    nodes: orientedNodes,
    edges,
    horizons: [
      { depth: 1, label: 'Direction', position: lattice.direction },
      { depth: 2, label: 'Next evolution', position: lattice.next },
      { depth: 3, label: 'Later possibility', position: lattice.later },
    ],
    progressionBands: [
      { id: 'current', label: 'Current', position: lattice.repository },
      { id: 'now', label: 'Directions', position: lattice.direction },
      { id: 'next', label: 'Next evolutions', position: lattice.next },
      { id: 'later', label: 'Later possibilities', position: lattice.later },
      { id: 'future', label: 'Outcome horizon', position: lattice.outcome },
    ],
    streamRows: structuredRows.map((row, index) => ({
      index,
      label: nodes.find(node => node.presentationRow?.index === index)?.presentationRow?.label || row.label,
      position: orientation === 'vertical' ? verticalStreamPosition(index) : row.position,
      occupied: nodes.filter(node => node.presentationRow?.index === index).length,
    })),
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
    edge.goalIds.forEach(goalId => nodeIds.add(goalId));
  };
  model.edges.forEach(edge => {
    if (edge.sourceId === nodeId || edge.targetId === nodeId || edge.goalIds.includes(nodeId)) {
      addEdge(edge);
    }
  });
  const directlyRelatedDependencyIds = new Set([...nodeIds].filter(id => model.nodes.find(node => node.id === id)?.kind === 'dependency'));
  model.edges.filter(edge => edge.kind === 'requirement' && directlyRelatedDependencyIds.has(edge.sourceId)).forEach(addEdge);
  const relatedGoalIds = new Set([...nodeIds].filter(id => model.nodes.find(node => node.id === id)?.kind === 'goal'));
  model.edges.filter(edge => edge.kind === 'expansion' && edge.goalIds.some(goalId => relatedGoalIds.has(goalId))).forEach(addEdge);
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
    || Boolean(node.parentGoalId && selectedGoalIds.has(node.parentGoalId))
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
    if (edge.kind === 'requirement') {
      const crossDistance = target.x - source.x;
      return `M ${source.x} ${source.y} C ${source.x} ${source.y + distance * 0.3}, ${target.x + crossDistance * 0.12} ${target.y - distance * 0.28}, ${target.x} ${target.y}`;
    }
    const fieldSweep = Math.sign(target.x - source.x || bend || 1)
      * Math.min(104, 22 + Math.abs(target.x - source.x) * 0.2);
    return `M ${source.x} ${source.y} C ${source.x + bend + fieldSweep} ${source.y + distance * 0.34}, ${target.x - bend - fieldSweep * 0.48} ${target.y - distance * 0.3}, ${target.x} ${target.y}`;
  }
  const distance = target.x - source.x;
  if (edge.kind === 'requirement') {
    const crossDistance = target.y - source.y;
    return `M ${source.x} ${source.y} C ${source.x + distance * 0.3} ${source.y}, ${target.x - distance * 0.28} ${target.y + crossDistance * 0.12}, ${target.x} ${target.y}`;
  }
  const fieldSweep = Math.sign(target.y - source.y || bend || 1)
    * Math.min(104, 22 + Math.abs(target.y - source.y) * 0.2);
  return `M ${source.x} ${source.y} C ${source.x + distance * 0.34} ${source.y + bend + fieldSweep}, ${target.x - distance * 0.3} ${target.y - bend - fieldSweep * 0.48}, ${target.x} ${target.y}`;
}

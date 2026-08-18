import type {
  RepositoryFutureStageCandidate,
  RepositoryFutureStageOverlay,
} from './futurePathwaysPresentation';

export const FUTURES_CANVAS_WORLD = { width: 1840, height: 1160 } as const;
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
  { label: 'Strategic opportunities', position: 126 },
  { label: 'Evidence-backed opportunities', position: 250 },
  { label: 'Product & preview directions', position: 374 },
  { label: 'Knowledge systems', position: 498 },
  { label: 'Agent workflows', position: 622 },
  { label: 'Delivery systems', position: 746 },
  { label: 'Safety & governance', position: 870 },
  { label: 'Exploratory directions', position: 994 },
] as const;

const lattice = {
  repository: 150,
  direction: 510,
  next: 900,
  later: 1290,
  outcome: 1660,
} as const;

const TERMINAL_COLUMN_SPACING = 170;
const TERMINAL_COLLISION_WIDTH = 152;
const TERMINAL_COLLISION_HEIGHT = 88;

const VERTICAL_WORLD = { width: 2300, height: 1540 } as const;
const verticalStreamPosition = (index: number) => 205 + index * 270;

function repositoryFuturesVerticalFlowPosition(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return 195;
  if (node.kind === 'goal') return 480;
  if (node.kind === 'dependency') {
    const anchor = node.role === 'satisfied' ? 345 : 685;
    const base = node.role === 'satisfied' ? 335 : 620;
    return base + (node.x - anchor) * 0.45;
  }
  if (node.kind === 'evolution' && node.depth === 2) return 790 + (node.x - lattice.next) * 0.5;
  if (node.kind === 'evolution' && node.depth === 3) return 1010 + (node.x - lattice.later) * 0.47;
  if (node.kind === 'capability') return 790 + (node.x - lattice.next) * 0.5;
  if (node.kind === 'artifact') return 1120 + (node.x - lattice.outcome) * 0.42;
  return node.x;
}

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
  // Orientation is presentation only: both projections retain the exact same
  // semantic roster, identities and relationships.
  const candidates = readyCandidates;
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
  const placedTerminalNodes: Array<{ x: number; y: number }> = [];
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
      const baseX = (projection.kind === 'evolution'
        ? projection.generation === 3 ? lattice.later : lattice.next
        : projection.kind === 'capability' ? lattice.next : lattice.outcome) + generationTwoSpread;
      const baseY = projection.kind === 'evolution' ? sourceNode.y + siblingOffset : goal.y + siblingOffset;
      const terminal = (projection.kind === 'evolution' && projection.generation === 3) || projection.kind === 'artifact';
      const terminalOptions = terminal
        ? [0, 1, 2, 3].flatMap(column => [0, -48, 48].map(rowOffset => ({
          x: baseX + column * TERMINAL_COLUMN_SPACING,
          y: baseY + rowOffset,
        })))
        : [];
      const terminalPlacement = terminal
        ? terminalOptions.find(option => placedTerminalNodes.every(existing => (
          Math.abs(existing.x - option.x) >= TERMINAL_COLLISION_WIDTH
          || Math.abs(existing.y - option.y) >= TERMINAL_COLLISION_HEIGHT
        ))) || terminalOptions[terminalOptions.length - 1]
        : undefined;
      if (terminalPlacement) placedTerminalNodes.push(terminalPlacement);
      const x = terminalPlacement?.x ?? baseX;
      const y = terminalPlacement?.y ?? baseY;
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
  const placedDependencies: Record<'satisfied' | 'required', Array<{ x: number; y: number }>> = {
    satisfied: [],
    required: [],
  };
  dependencies.forEach(dependency => {
    const relatedGoalIds = [...new Set(dependency.dependentGoalIds.filter(goalId => goalIds.has(goalId)))];
    if (!relatedGoalIds.length) return;
    const relatedGoals = relatedGoalIds.flatMap(goalId => {
      const goal = goalNodes.get(goalId);
      return goal ? [goal] : [];
    });
    const routeX = relatedGoals.reduce((sum, goal) => sum + goal.x, 0) / relatedGoals.length;
    const routeY = relatedGoals.reduce((sum, goal) => sum + goal.y, 0) / relatedGoals.length;
    const role = dependency.state === 'satisfied' ? 'satisfied' : 'required';
    // Existing truths sit upstream of the direction they already support.
    // Required work sits downstream, between the direction and its next
    // evolution. The separate grammars prevent the two meanings from reading
    // as an accidental overlay in the same corridor.
    const xOffset = role === 'satisfied' ? -165 : 175;
    const fallbackXOffset = role === 'satisfied' ? -245 : 275;
    const placementOptions = [
      { x: routeX + xOffset, y: routeY - 30 },
      { x: routeX + xOffset, y: routeY + 30 },
      { x: routeX + fallbackXOffset, y: routeY - 30 },
      { x: routeX + fallbackXOffset, y: routeY + 30 },
      { x: routeX + xOffset, y: routeY - 58 },
      { x: routeX + xOffset, y: routeY + 58 },
    ];
    const rolePlacements = placedDependencies[role];
    const placement = placementOptions.find(option => rolePlacements.every(existing => (
      Math.abs(existing.x - option.x) >= 108 || Math.abs(existing.y - option.y) >= 78
    ))) || placementOptions[rolePlacements.length % placementOptions.length];
    rolePlacements.push(placement);
    const earliestDepth = Math.min(...relatedGoals.map(goal => goal.depth as 1 | 2 | 3));
    nodes.push({
      id: dependency.id,
      kind: 'dependency',
      role: dependency.state === 'satisfied' ? 'satisfied' : 'required',
      title: dependency.title,
      x: placement.x,
      y: placement.y,
      depth: Math.max(1, earliestDepth - 1) as 1 | 2,
      presentationRow: relatedGoals.length === 1 ? relatedGoals[0].presentationRow : undefined,
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

  const terminalOffsetsById = new Map<string, { x: number; y: number }>();
  const terminalGoalIds = [...new Set(nodes
    .filter(node => node.kind === 'evolution' && node.depth === 3 && node.parentGoalId)
    .map(node => node.parentGoalId!))].sort();
  terminalGoalIds.forEach(goalId => {
    const terminalNodes = nodes
      .filter(node => node.kind === 'evolution' && node.depth === 3 && node.parentGoalId === goalId)
      .sort((left, right) => left.x - right.x || left.y - right.y || left.id.localeCompare(right.id));
    terminalNodes.forEach((node, index) => {
      const rank = index - (terminalNodes.length - 1) / 2;
      terminalOffsetsById.set(node.id, { x: rank * 136, y: 0 });
    });
  });
  const orientedNodes = orientation === 'vertical'
    ? nodes.map(node => {
      const rowOffset = node.presentationRow
        ? node.y - structuredRows[node.presentationRow.index].position
        : 0;
      const terminalOffset = terminalOffsetsById.get(node.id);
      const terminalEvolution = terminalOffset !== undefined;
      const laneX = node.presentationRow ? verticalStreamPosition(node.presentationRow.index) : VERTICAL_WORLD.width / 2;
      return {
        ...node,
        x: node.kind === 'repository'
          ? VERTICAL_WORLD.width / 2
          : terminalEvolution
            ? laneX + terminalOffset.x
            : laneX + (node.kind === 'evolution' || node.kind === 'capability' ? rowOffset * 3.2 : rowOffset * 1.6),
        // Desktop generations need wide horizontal breathing room; applying that
        // full rhythm to the narrow top-to-bottom field would put the repository
        // behind the mode controls at the camera's minimum zoom. This semantic
        // flow-axis map keeps every generation distinct while fitting the touch
        // overview without changing the shared V7.2 camera architecture.
        y: terminalEvolution ? 1100 + terminalOffset.y : repositoryFuturesVerticalFlowPosition(node),
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
    horizons: orientation === 'vertical'
      ? [
        { depth: 1, label: 'Direction', position: 480 },
        { depth: 2, label: 'Next evolution', position: 790 },
        { depth: 3, label: 'Later possibility', position: 1100 },
      ]
      : [
        { depth: 1, label: 'Direction', position: lattice.direction },
        { depth: 2, label: 'Next evolution', position: lattice.next },
        { depth: 3, label: 'Later possibility', position: lattice.later },
      ],
    progressionBands: orientation === 'vertical'
      ? [
        { id: 'current', label: 'Current', position: 195 },
        { id: 'now', label: 'Directions', position: 480 },
        { id: 'next', label: 'Next evolutions', position: 790 },
        { id: 'later', label: 'Later possibilities', position: 1100 },
        { id: 'future', label: 'Outcome horizon', position: 1380 },
      ]
      : [
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
      ? VERTICAL_WORLD
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

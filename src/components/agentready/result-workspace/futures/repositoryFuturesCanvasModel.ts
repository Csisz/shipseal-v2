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
  layoutBox?: RepositoryFuturesNodeLayoutBox;
};

export type RepositoryFuturesNodeLayoutBox = {
  width: number;
  height: number;
  clearance: number;
  branchGoalId?: string;
  parentId?: string;
  terminalColumn?: number;
  terminalBand?: number;
};

export type RepositoryFuturesLayoutRectangle = RepositoryFuturesNodeLayoutBox & {
  id: string;
  kind: RepositoryFuturesCanvasNode['kind'];
  depth: RepositoryFuturesCanvasNode['depth'];
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
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

const SPATIAL_LATTICE = {
  horizontal: {
    top: 104,
    branchGap: 34,
    repository: 150,
    goal: 510,
    generationTwo: 900,
    generationTwoColumnGap: 170,
    generationThree: 1320,
    terminalColumnGap: 164,
  },
  vertical: {
    left: 112,
    branchGap: 54,
    repository: 190,
    goal: 480,
    generationTwo: 790,
    generationThree: 1090,
    terminalBandGap: 136,
  },
} as const;

type RepositoryFuturesLayoutMode = RepositoryFutureStageOverlay['mode'];

export function repositoryFuturesNodeFootprint(
  node: Pick<RepositoryFuturesCanvasNode, 'kind' | 'depth'>,
  mode: RepositoryFuturesLayoutMode = 'quick',
): Pick<RepositoryFuturesNodeLayoutBox, 'width' | 'height' | 'clearance'> {
  if (node.kind === 'repository') return { width: 184, height: 88, clearance: 30 };
  if (node.kind === 'goal') return { width: 192, height: 112, clearance: 28 };
  if (node.kind === 'dependency') return { width: 104, height: 54, clearance: 24 };
  if (node.kind === 'capability') return { width: 108, height: mode === 'deep' ? 72 : 60, clearance: 24 };
  if (node.kind === 'artifact') return { width: 96, height: mode === 'deep' ? 66 : 48, clearance: 22 };
  if (node.depth === 3) return { width: mode === 'deep' ? 132 : 112, height: mode === 'deep' ? 72 : 48, clearance: mode === 'deep' ? 24 : 20 };
  return { width: 132, height: mode === 'deep' ? 82 : 60, clearance: mode === 'deep' ? 26 : 22 };
}

function layoutRectangle(node: RepositoryFuturesCanvasNode): RepositoryFuturesLayoutRectangle {
  const box = node.layoutBox || repositoryFuturesNodeFootprint(node);
  return {
    id: node.id,
    kind: node.kind,
    depth: node.depth,
    x: node.x,
    y: node.y,
    ...box,
    left: node.x - box.width / 2,
    right: node.x + box.width / 2,
    top: node.y - box.height / 2,
    bottom: node.y + box.height / 2,
  };
}

function layoutRectanglesCollide(left: RepositoryFuturesLayoutRectangle, right: RepositoryFuturesLayoutRectangle) {
  const clearance = Math.max(left.clearance, right.clearance);
  return left.left < right.right + clearance
    && left.right + clearance > right.left
    && left.top < right.bottom + clearance
    && left.bottom + clearance > right.top;
}

export function repositoryFuturesLayoutBoxes(model: Pick<RepositoryFuturesCanvasModel, 'nodes'>) {
  return model.nodes.map(layoutRectangle);
}

export function repositoryFuturesLayoutCollisions(model: Pick<RepositoryFuturesCanvasModel, 'nodes'>) {
  const boxes = repositoryFuturesLayoutBoxes(model);
  const collisions: Array<{ leftId: string; rightId: string }> = [];
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      if (layoutRectanglesCollide(boxes[leftIndex], boxes[rightIndex])) {
        collisions.push({ leftId: boxes[leftIndex].id, rightId: boxes[rightIndex].id });
      }
    }
  }
  return collisions;
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

function expansionChildrenBySource(nodes: RepositoryFuturesCanvasNode[], edges: RepositoryFuturesCanvasEdge[]) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const children = new Map<string, RepositoryFuturesCanvasNode[]>();
  edges.filter(edge => edge.kind === 'expansion').forEach(edge => {
    const child = nodeById.get(edge.targetId);
    if (!child) return;
    const existing = children.get(edge.sourceId) || [];
    existing.push(child);
    children.set(edge.sourceId, existing);
  });
  children.forEach(items => items.sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id)));
  return children;
}

function branchGoalId(node: RepositoryFuturesCanvasNode) {
  return node.kind === 'goal' ? node.id : node.parentGoalId;
}

function setNodeLayoutBox(
  node: RepositoryFuturesCanvasNode,
  mode: RepositoryFuturesLayoutMode,
  values: Partial<RepositoryFuturesNodeLayoutBox> = {},
) {
  node.layoutBox = {
    ...repositoryFuturesNodeFootprint(node, mode),
    branchGoalId: branchGoalId(node),
    ...values,
  };
}

function canPlaceNode(node: RepositoryFuturesCanvasNode, placed: RepositoryFuturesCanvasNode[]) {
  const rectangle = layoutRectangle(node);
  return placed.every(existing => !layoutRectanglesCollide(rectangle, layoutRectangle(existing)));
}

function movementPriority(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository' || node.kind === 'goal') return 100;
  if (node.kind === 'evolution' && node.depth === 3) return 10;
  if (node.kind === 'artifact') return 12;
  if (node.kind === 'evolution') return 20;
  if (node.kind === 'capability') return 24;
  return 28;
}

function relaxRepositoryFuturesLayout(
  nodes: RepositoryFuturesCanvasNode[],
  orientation: RepositoryFuturesCanvasOrientation,
) {
  const ordered = [...nodes].sort((left, right) => movementPriority(left) - movementPriority(right) || left.id.localeCompare(right.id));
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
        const left = ordered[leftIndex];
        const right = ordered[rightIndex];
        const leftBox = layoutRectangle(left);
        const rightBox = layoutRectangle(right);
        if (!layoutRectanglesCollide(leftBox, rightBox)) continue;
        const leftPriority = movementPriority(left);
        const rightPriority = movementPriority(right);
        const movable = leftPriority === rightPriority
          ? left.id.localeCompare(right.id) > 0 ? left : right
          : leftPriority < rightPriority ? left : right;
        if (movementPriority(movable) >= 100) continue;
        const fixed = movable === left ? right : left;
        const movableBox = movable === left ? leftBox : rightBox;
        const fixedBox = movable === left ? rightBox : leftBox;
        const clearance = Math.max(movableBox.clearance, fixedBox.clearance);
        if (orientation === 'horizontal') {
          const direction = movable.y === fixed.y
            ? stableHash(`${movable.id}:relax-y`) % 2 ? 1 : -1
            : Math.sign(movable.y - fixed.y);
          const displacement = (movableBox.height + fixedBox.height) / 2 + clearance - Math.abs(movable.y - fixed.y);
          movable.y += direction * Math.max(1, displacement);
        } else {
          const direction = movable.x === fixed.x
            ? stableHash(`${movable.id}:relax-x`) % 2 ? 1 : -1
            : Math.sign(movable.x - fixed.x);
          const displacement = (movableBox.width + fixedBox.width) / 2 + clearance - Math.abs(movable.x - fixed.x);
          movable.x += direction * Math.max(1, displacement);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function placeHorizontalTerminal(
  node: RepositoryFuturesCanvasNode,
  parent: RepositoryFuturesCanvasNode,
  placed: RepositoryFuturesCanvasNode[],
  mode: RepositoryFuturesLayoutMode,
  siblingIndex: number,
) {
  const baseX = Math.max(SPATIAL_LATTICE.horizontal.generationThree, parent.x + 360);
  const yOffsets = [0, -38, 38, -76, 76, -114, 114];
  const options = [0, 1, 2, 3].flatMap(column => yOffsets.map(offset => ({
    x: baseX + column * SPATIAL_LATTICE.horizontal.terminalColumnGap,
    y: parent.y + offset + (siblingIndex % 2 ? 5 : -5),
    terminalColumn: column,
  })));
  for (const option of options) {
    node.x = option.x;
    node.y = option.y;
    setNodeLayoutBox(node, mode, { parentId: parent.id, terminalColumn: option.terminalColumn });
    if (canPlaceNode(node, placed)) return;
  }
  const fallbackColumn = 4 + Math.floor(siblingIndex / yOffsets.length);
  node.x = baseX + fallbackColumn * SPATIAL_LATTICE.horizontal.terminalColumnGap;
  node.y = parent.y + yOffsets[siblingIndex % yOffsets.length];
  setNodeLayoutBox(node, mode, { parentId: parent.id, terminalColumn: fallbackColumn });
}

function layoutHorizontalBranches(
  nodes: RepositoryFuturesCanvasNode[],
  edges: RepositoryFuturesCanvasEdge[],
  mode: RepositoryFuturesLayoutMode,
) {
  const childNodes = expansionChildrenBySource(nodes, edges);
  const goals = nodes.filter(node => node.kind === 'goal')
    .sort((left, right) => (left.presentationRow?.index || 0) - (right.presentationRow?.index || 0) || left.id.localeCompare(right.id));
  const metrics = goals.map(goal => {
    const children = childNodes.get(goal.id) || [];
    const rowCount = Math.max(1, Math.ceil(children.length / 2));
    const deepestHeight = Math.max(0, ...children.map(child => repositoryFuturesNodeFootprint(child, mode).height));
    const rowSpacing = Math.max(84, deepestHeight + (mode === 'deep' ? 28 : 22));
    const contentHeight = Math.max(repositoryFuturesNodeFootprint(goal, mode).height, deepestHeight + (rowCount - 1) * rowSpacing + 50);
    return { goal, children, rowCount, rowSpacing, contentHeight };
  });
  let cursor = SPATIAL_LATTICE.horizontal.top;
  metrics.forEach(metric => {
    metric.goal.x = SPATIAL_LATTICE.horizontal.goal;
    metric.goal.y = cursor + metric.contentHeight / 2;
    setNodeLayoutBox(metric.goal, mode, { branchGoalId: metric.goal.id });
    cursor += metric.contentHeight + SPATIAL_LATTICE.horizontal.branchGap;
  });

  const placed: RepositoryFuturesCanvasNode[] = [...goals];
  metrics.forEach(metric => {
    metric.children.forEach((child, index) => {
      const column = metric.children.length > 1 ? index % 2 : 0;
      const row = Math.floor(index / 2);
      const centeredRow = row - (metric.rowCount - 1) / 2;
      child.x = child.depth === 3 || child.kind === 'artifact'
        ? SPATIAL_LATTICE.horizontal.generationThree
        : SPATIAL_LATTICE.horizontal.generationTwo + column * SPATIAL_LATTICE.horizontal.generationTwoColumnGap;
      child.y = metric.goal.y + centeredRow * metric.rowSpacing + (metric.children.length > 1 ? column ? 18 : -18 : 0);
      setNodeLayoutBox(child, mode, { parentId: metric.goal.id, terminalColumn: child.depth === 3 ? 0 : undefined });
      placed.push(child);
    });
    metric.children.forEach(parent => {
      const descendants = childNodes.get(parent.id) || [];
      descendants.forEach((child, siblingIndex) => {
        placeHorizontalTerminal(child, parent, placed, mode, siblingIndex);
        placed.push(child);
      });
    });
  });
  return { goals, cursor };
}

function layoutVerticalBranches(
  nodes: RepositoryFuturesCanvasNode[],
  edges: RepositoryFuturesCanvasEdge[],
  mode: RepositoryFuturesLayoutMode,
) {
  const childNodes = expansionChildrenBySource(nodes, edges);
  const goals = nodes.filter(node => node.kind === 'goal')
    .sort((left, right) => (left.presentationRow?.index || 0) - (right.presentationRow?.index || 0) || left.id.localeCompare(right.id));
  const metrics = goals.map(goal => {
    const children = childNodes.get(goal.id) || [];
    const childWidth = Math.max(132, ...children.map(child => repositoryFuturesNodeFootprint(child, mode).width));
    const width = Math.max(270, children.length * (childWidth + 30) + 64);
    return { goal, children, width };
  });
  let cursor = SPATIAL_LATTICE.vertical.left;
  metrics.forEach(metric => {
    metric.goal.x = cursor + metric.width / 2;
    metric.goal.y = SPATIAL_LATTICE.vertical.goal;
    setNodeLayoutBox(metric.goal, mode, { branchGoalId: metric.goal.id });
    cursor += metric.width + SPATIAL_LATTICE.vertical.branchGap;
  });

  const placed: RepositoryFuturesCanvasNode[] = [...goals];
  metrics.forEach(metric => {
    const childSpacing = metric.children.length > 1 ? Math.min(182, (metric.width - 96) / metric.children.length) : 0;
    metric.children.forEach((child, index) => {
      const rank = index - (metric.children.length - 1) / 2;
      child.x = metric.goal.x + rank * childSpacing;
      child.y = child.depth === 3 || child.kind === 'artifact'
        ? SPATIAL_LATTICE.vertical.generationThree
        : SPATIAL_LATTICE.vertical.generationTwo + (index % 2 ? 12 : -12);
      setNodeLayoutBox(child, mode, { parentId: metric.goal.id, terminalBand: child.depth === 3 ? index % 2 : undefined });
      placed.push(child);
    });
    metric.children.forEach((parent, parentIndex) => {
      const descendants = childNodes.get(parent.id) || [];
      descendants.forEach((child, siblingIndex) => {
        const baseBand = parentIndex % 2;
        const requestedBand = Math.min(2, baseBand + Math.floor(siblingIndex / 2));
        const xOffsets = descendants.length > 1 ? [-82, 82, -164, 164, 0] : [0, -82, 82];
        const options = [requestedBand, (requestedBand + 1) % 3, (requestedBand + 2) % 3]
          .flatMap(band => xOffsets.map(offset => ({ x: parent.x + offset, band })));
        let placedOption = false;
        for (const option of options) {
          child.x = option.x;
          child.y = SPATIAL_LATTICE.vertical.generationThree + option.band * SPATIAL_LATTICE.vertical.terminalBandGap;
          setNodeLayoutBox(child, mode, { parentId: parent.id, terminalBand: option.band });
          if (canPlaceNode(child, placed)) {
            placedOption = true;
            break;
          }
        }
        if (!placedOption) {
          child.x = parent.x + xOffsets[siblingIndex % xOffsets.length];
          child.y = SPATIAL_LATTICE.vertical.generationThree + 2 * SPATIAL_LATTICE.vertical.terminalBandGap;
          setNodeLayoutBox(child, mode, { parentId: parent.id, terminalBand: 2 });
        }
        placed.push(child);
      });
    });
  });
  return { goals, cursor };
}

function layoutDependencies(
  nodes: RepositoryFuturesCanvasNode[],
  orientation: RepositoryFuturesCanvasOrientation,
  mode: RepositoryFuturesLayoutMode,
) {
  const goalById = new Map(nodes.filter(node => node.kind === 'goal').map(node => [node.id, node]));
  const placed = nodes.filter(node => node.kind !== 'dependency');
  nodes.filter(node => node.kind === 'dependency').sort((left, right) => left.id.localeCompare(right.id)).forEach(node => {
    const goals = node.dependency?.dependentGoalIds.flatMap(id => goalById.get(id) || []) || [];
    if (!goals.length) return;
    const routeX = goals.reduce((sum, goal) => sum + goal.x, 0) / goals.length;
    const routeY = goals.reduce((sum, goal) => sum + goal.y, 0) / goals.length;
    const direction = stableHash(`${node.id}:dependency-side`) % 2 ? 1 : -1;
    const offsets = [108, -108, 154, -154, 202, -202];
    for (const offset of offsets) {
      node.x = orientation === 'horizontal'
        ? node.role === 'satisfied' ? 330 : 724
        : routeX + offset * direction;
      node.y = orientation === 'horizontal'
        ? routeY + offset * direction
        : node.role === 'satisfied' ? 336 : 642;
      setNodeLayoutBox(node, mode, {
        branchGoalId: goals.length === 1 ? goals[0].id : undefined,
        parentId: goals.length === 1 ? goals[0].id : undefined,
      });
      if (canPlaceNode(node, placed)) break;
    }
    if (!node.layoutBox) setNodeLayoutBox(node, mode);
    placed.push(node);
  });
}

function applyRepositoryFuturesSpatialLayout(
  sourceNodes: RepositoryFuturesCanvasNode[],
  edges: RepositoryFuturesCanvasEdge[],
  orientation: RepositoryFuturesCanvasOrientation,
  mode: RepositoryFuturesLayoutMode,
) {
  const nodes = sourceNodes.map(node => ({ ...node, layoutBox: undefined }));
  const { goals, cursor } = orientation === 'horizontal'
    ? layoutHorizontalBranches(nodes, edges, mode)
    : layoutVerticalBranches(nodes, edges, mode);
  const repository = nodes.find(node => node.kind === 'repository');
  if (repository) {
    repository.x = orientation === 'horizontal'
      ? SPATIAL_LATTICE.horizontal.repository
      : goals.length ? (goals[0].x + goals[goals.length - 1].x) / 2 : VERTICAL_WORLD.width / 2;
    repository.y = orientation === 'horizontal'
      ? goals.length ? (goals[0].y + goals[goals.length - 1].y) / 2 : 520
      : SPATIAL_LATTICE.vertical.repository;
    setNodeLayoutBox(repository, mode);
  }
  layoutDependencies(nodes, orientation, mode);
  nodes.filter(node => !node.layoutBox).forEach(node => setNodeLayoutBox(node, mode));
  relaxRepositoryFuturesLayout(nodes, orientation);
  let boxes = nodes.map(layoutRectangle);
  if (orientation === 'vertical' && boxes.length) {
    const minimumLeft = Math.min(...boxes.map(box => box.left));
    const maximumRight = Math.max(...boxes.map(box => box.right));
    const contentWidth = maximumRight - minimumLeft;
    const worldWidth = Math.max(VERTICAL_WORLD.width, contentWidth + 224, cursor + 40);
    const shift = worldWidth / 2 - (minimumLeft + maximumRight) / 2;
    nodes.forEach(node => { node.x += shift; });
    boxes = nodes.map(layoutRectangle);
  }
  const maximumRight = Math.max(0, ...boxes.map(box => box.right));
  const maximumBottom = Math.max(0, ...boxes.map(box => box.bottom));
  return {
    nodes,
    world: orientation === 'horizontal'
      ? { width: Math.max(FUTURES_CANVAS_WORLD.width, maximumRight + 150), height: Math.max(FUTURES_CANVAS_WORLD.height, maximumBottom + 104, cursor + 70) }
      : { width: Math.max(VERTICAL_WORLD.width, maximumRight + 112), height: Math.max(VERTICAL_WORLD.height, maximumBottom + 112) },
  };
}

/**
 * Pure visual adapter. It never derives eligibility, compatibility, selection,
 * or dependency closure; those facts must already exist in the stage overlay.
 */
export function buildRepositoryFuturesCanvasModel(
  repositoryName: string,
  overlay: Pick<RepositoryFutureStageOverlay, 'candidates' | 'projections' | 'dependencies' | 'productIntelligenceState'>
    & Partial<Pick<RepositoryFutureStageOverlay, 'mode'>>,
  orientation: RepositoryFuturesCanvasOrientation = 'horizontal',
): RepositoryFuturesCanvasModel {
  const layoutMode = overlay.mode || 'quick';
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

  const spatial = applyRepositoryFuturesSpatialLayout(nodes, edges, orientation, layoutMode);
  const orientedNodes = spatial.nodes.map(node => orientation === 'vertical' && node.canonicalPosition ? {
    ...node,
    canonicalPosition: {
      ...node.canonicalPosition,
      x: node.canonicalPosition.y,
      y: node.canonicalPosition.x,
    },
  } : node);
  return {
    nodes: orientedNodes,
    edges,
    horizons: orientation === 'vertical'
      ? [
        { depth: 1, label: 'Direction', position: 480 },
        { depth: 2, label: 'Next evolution', position: 790 },
        { depth: 3, label: 'Later possibility', position: SPATIAL_LATTICE.vertical.generationThree },
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
        { id: 'later', label: 'Later possibilities', position: SPATIAL_LATTICE.vertical.generationThree },
        { id: 'future', label: 'Outcome horizon', position: spatial.world.height - 90 },
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
      position: (() => {
        const rowNodes = orientedNodes.filter(node => node.kind === 'goal' && node.presentationRow?.index === index);
        if (!rowNodes.length) return orientation === 'vertical' ? verticalStreamPosition(index) : row.position;
        return rowNodes.reduce((sum, node) => sum + (orientation === 'vertical' ? node.x : node.y), 0) / rowNodes.length;
      })(),
      occupied: orientedNodes.filter(node => node.presentationRow?.index === index).length,
    })),
    orientation,
    world: spatial.world,
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
  const portOffset = edge.kind === 'selected-path' ? 0 : ((stableHash(`${edge.id}:port`) % 7) - 3) * 3;
  if (orientation === 'vertical') {
    const distance = target.y - source.y;
    const sourceX = source.x + portOffset;
    const targetX = target.x - portOffset * 0.35;
    if (edge.kind === 'requirement') {
      const crossDistance = targetX - sourceX;
      return `M ${sourceX} ${source.y} C ${sourceX} ${source.y + distance * 0.3}, ${targetX + crossDistance * 0.12} ${target.y - distance * 0.28}, ${targetX} ${target.y}`;
    }
    const fieldSweep = Math.sign(targetX - sourceX || bend || 1)
      * Math.min(104, 22 + Math.abs(targetX - sourceX) * 0.2);
    return `M ${sourceX} ${source.y} C ${sourceX + bend + fieldSweep} ${source.y + distance * 0.34}, ${targetX - bend - fieldSweep * 0.48} ${target.y - distance * 0.3}, ${targetX} ${target.y}`;
  }
  const distance = target.x - source.x;
  const sourceY = source.y + portOffset;
  const targetY = target.y - portOffset * 0.35;
  if (edge.kind === 'requirement') {
    const crossDistance = targetY - sourceY;
    return `M ${source.x} ${sourceY} C ${source.x + distance * 0.3} ${sourceY}, ${target.x - distance * 0.28} ${targetY + crossDistance * 0.12}, ${target.x} ${targetY}`;
  }
  const fieldSweep = Math.sign(targetY - sourceY || bend || 1)
    * Math.min(104, 22 + Math.abs(targetY - sourceY) * 0.2);
  return `M ${source.x} ${sourceY} C ${source.x + distance * 0.34} ${sourceY + bend + fieldSweep}, ${target.x - distance * 0.3} ${targetY - bend - fieldSweep * 0.48}, ${target.x} ${targetY}`;
}

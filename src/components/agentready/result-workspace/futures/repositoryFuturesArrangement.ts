import type {
  RepositoryFuturesCanvasModel,
  RepositoryFuturesCanvasNode,
} from './repositoryFuturesCanvasModel';

export type RepositoryFuturesNodeOffset = { x: number; y: number };
export type RepositoryFuturesNodeOffsets = Record<string, RepositoryFuturesNodeOffset>;

const ZERO_OFFSET: RepositoryFuturesNodeOffset = { x: 0, y: 0 };
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function repositoryFuturesArrangementStorageKey(repositoryName: string, graphFingerprint: string) {
  return `shipseal:futures-arrangement:${encodeURIComponent(repositoryName)}:${graphFingerprint}`;
}

export function readRepositoryFuturesArrangement(key: string): RepositoryFuturesNodeOffsets {
  if (typeof window === 'undefined') return {};
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || '{}') as RepositoryFuturesNodeOffsets;
    return Object.fromEntries(Object.entries(value).flatMap(([nodeId, offset]) => (
      offset && Number.isFinite(offset.x) && Number.isFinite(offset.y)
        ? [[nodeId, { x: clamp(offset.x, -160, 160), y: clamp(offset.y, -160, 160) }]]
        : []
    )));
  } catch {
    return {};
  }
}

export function writeRepositoryFuturesArrangement(key: string, offsets: RepositoryFuturesNodeOffsets) {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(offsets).length) window.sessionStorage.setItem(key, JSON.stringify(offsets));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Arrangement is an optional session enhancement; navigation remains usable without storage.
  }
}

export function constrainRepositoryFuturesNodeOffset(
  model: RepositoryFuturesCanvasModel,
  nodeId: string,
  proposed: RepositoryFuturesNodeOffset,
): RepositoryFuturesNodeOffset {
  const node = model.nodes.find(item => item.id === nodeId);
  if (!node || node.kind === 'repository') return ZERO_OFFSET;

  if (node.kind === 'goal') {
    return {
      x: clamp(proposed.x, -72, 72),
      y: clamp(clamp(node.y + proposed.y, 72, model.world.height - 72) - node.y, -118, 118),
    };
  }

  const dependentGoalXs = model.edges
    .filter(edge => edge.kind === 'requirement' && edge.sourceId === node.id)
    .flatMap(edge => {
      const goal = model.nodes.find(item => item.id === edge.targetId && item.kind === 'goal');
      return goal ? [goal.x] : [];
    });
  const latestPrerequisiteX = dependentGoalXs.length ? Math.min(...dependentGoalXs) - 96 : node.x + 72;
  const arrangedX = clamp(node.x + clamp(proposed.x, -72, 72), 260, latestPrerequisiteX);
  return {
    x: arrangedX - node.x,
    y: clamp(clamp(node.y + proposed.y, 82, model.world.height - 82) - node.y, -96, 96),
  };
}

export function reconcileRepositoryFuturesNodeOffsets(
  model: RepositoryFuturesCanvasModel,
  offsets: RepositoryFuturesNodeOffsets,
) {
  const next: RepositoryFuturesNodeOffsets = {};
  model.nodes.forEach(node => {
    if (!offsets[node.id] || node.kind === 'repository') return;
    const offset = constrainRepositoryFuturesNodeOffset(model, node.id, offsets[node.id]);
    if (offset.x || offset.y) next[node.id] = offset;
  });
  return next;
}

export function applyRepositoryFuturesNodeOffsets(
  model: RepositoryFuturesCanvasModel,
  offsets: RepositoryFuturesNodeOffsets,
): RepositoryFuturesCanvasNode[] {
  return model.nodes.map(node => {
    const offset = offsets[node.id];
    if (!offset || node.kind === 'repository') return node;
    return model.orientation === 'vertical'
      ? { ...node, x: node.x + offset.y, y: node.y + offset.x }
      : { ...node, x: node.x + offset.x, y: node.y + offset.y };
  });
}

export function repositoryFuturesOffsetsEqual(
  left: RepositoryFuturesNodeOffsets,
  right: RepositoryFuturesNodeOffsets,
) {
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  return leftIds.length === rightIds.length
    && leftIds.every(nodeId => left[nodeId].x === right[nodeId]?.x && left[nodeId].y === right[nodeId]?.y);
}

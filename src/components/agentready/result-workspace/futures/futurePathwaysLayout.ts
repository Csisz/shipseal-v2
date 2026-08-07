import type {
  RepositoryFutureStageCandidate,
  RepositoryFutureStageOverlay,
} from './futurePathwaysPresentation';

export interface FutureFieldPoint {
  x: number;
  y: number;
}

export interface FutureFieldNode extends FutureFieldPoint {
  id: string;
  kind: 'goal' | 'dependency' | 'evidence';
  role: RepositoryFutureStageCandidate['role'] | 'required' | 'current-evidence';
  label: string;
  scale: number;
  opacity: number;
  order?: number;
  state?: string;
  reviewRequired?: boolean;
}

export interface FutureFieldRoute {
  id: string;
  kind: 'evidence' | 'execution' | 'support' | 'saved' | 'candidate' | 'conflict';
  source: FutureFieldPoint;
  target: FutureFieldPoint;
  controlA: FutureFieldPoint;
  controlB: FutureFieldPoint;
  deterministic: boolean;
  opacity: number;
  broken: boolean;
}

export interface FutureFieldLayout {
  nodes: FutureFieldNode[];
  routes: FutureFieldRoute[];
  horizonX: number;
}

export type FutureEvidenceProjection = Record<string, FutureFieldPoint & { visible?: boolean }>;

export function futureImpulseEvent(
  overlay: Pick<RepositoryFutureStageOverlay, 'focusedId' | 'draftFingerprint'>,
  reducedMotion: boolean,
) {
  if (reducedMotion) return undefined;
  if (overlay.draftFingerprint) return 'synthesis-recomputed' as const;
  if (overlay.focusedId) return 'evidence-focused' as const;
  return undefined;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function candidateLane(candidate: RepositoryFutureStageCandidate, index: number, count: number) {
  const semanticBand = stableHash(candidate.capabilityId || candidate.title) % 5;
  const orderedBand = count <= 1 ? 2 : Math.round((index / (count - 1)) * 4);
  return clamp(12 + ((semanticBand + orderedBand) % 5) * 18, 10, 88);
}

function route(
  id: string,
  kind: FutureFieldRoute['kind'],
  source: FutureFieldPoint,
  target: FutureFieldPoint,
  deterministic: boolean,
  opacity: number,
  broken = false,
): FutureFieldRoute {
  const distance = target.x - source.x;
  const direction = stableHash(id) % 2 ? 1 : -1;
  const organicBend = direction * (2.4 + (stableHash(`${id}:bend`) % 36) / 10);
  const bend = kind === 'support' ? (target.y - source.y) * 0.22 + organicBend : organicBend;
  return {
    id,
    kind,
    source,
    target,
    controlA: { x: source.x + distance * 0.38, y: source.y + bend },
    controlB: { x: target.x - distance * 0.32, y: target.y - bend * 0.58 },
    deterministic,
    opacity,
    broken,
  };
}

function fallbackEvidencePoint(nodeId: string, index: number): FutureFieldPoint {
  const hash = stableHash(nodeId);
  return {
    x: 13 + (hash % 19),
    y: 14 + ((hash >>> 5) % 68) + (index % 2 ? 2 : -2),
  };
}

/**
 * Pure deterministic topology for the DOM/SVG future field. Coordinates are
 * percentages so WebGL projections and the non-WebGL fallback share one model.
 */
export function buildFutureFieldLayout(
  overlay: Pick<RepositoryFutureStageOverlay, 'phase' | 'candidates' | 'dependencies' | 'conflictCount'>,
  evidenceProjections: FutureEvidenceProjection = {},
): FutureFieldLayout {
  const horizonX = overlay.phase === 'synthesis' ? 48 : 51;
  const nodes: FutureFieldNode[] = [];
  const routes: FutureFieldRoute[] = [];
  const candidateNodes = new Map<string, FutureFieldNode>();
  const candidates = overlay.candidates.slice(0, 7);
  const supports = candidates.filter(candidate => candidate.role === 'supporting');
  const primary = candidates.find(candidate => candidate.role === 'primary');
  const saved = candidates.filter(candidate => candidate.role === 'saved');

  candidates.forEach((candidate, index) => {
    let x = 68 + (stableHash(candidate.capabilityId) % 13);
    let y = candidateLane(candidate, index, candidates.length);
    let scale = 0.84;
    let opacity = candidate.role === 'blocked' ? 0.34 : 0.72;
    if (primary?.goalId === candidate.goalId) {
      x = 86;
      y = 50;
      scale = 1.5;
      opacity = 1;
    } else if (candidate.role === 'supporting') {
      const supportIndex = supports.findIndex(item => item.goalId === candidate.goalId);
      x = 74;
      y = supportIndex === 0 ? 29 : 71;
      scale = 1.04;
      opacity = 0.92;
    } else if (candidate.role === 'saved') {
      const savedIndex = saved.findIndex(item => item.goalId === candidate.goalId);
      x = 91;
      y = savedIndex === 0 ? 13 : 87;
      scale = 0.7;
      opacity = 0.34;
    } else if (primary) {
      x = 64 + (index % 2) * 5;
      scale = 0.68;
      opacity = candidate.role === 'blocked' ? 0.25 : 0.38;
    }
    const node: FutureFieldNode = {
      id: candidate.goalId,
      kind: 'goal',
      role: candidate.role,
      label: candidate.title,
      x,
      y,
      scale,
      opacity,
    };
    nodes.push(node);
    candidateNodes.set(candidate.goalId, node);
  });
  const primaryNode = primary ? candidateNodes.get(primary.goalId) : undefined;

  const dependencyNodes = overlay.dependencies
    .slice()
    .sort((left, right) => left.executionOrder - right.executionOrder || left.id.localeCompare(right.id))
    .map((dependency, index, ordered) => {
      const span = Math.max(1, ordered.length - 1);
      const node: FutureFieldNode = {
        id: dependency.id,
        kind: 'dependency',
        role: 'required',
        label: dependency.title,
        x: 53 + (index / span) * Math.min(22, ordered.length * 5.5),
        y: 50 + (index % 2 ? 4 : -4),
        scale: 0.72,
        opacity: dependency.state === 'satisfied' ? 0.58 : 0.94,
        order: dependency.executionOrder,
        state: dependency.state,
        reviewRequired: dependency.humanReviewRequired,
      };
      nodes.push(node);
      return node;
    });

  const evidenceIds = [...new Set(candidates.flatMap(candidate => candidate.universeNodeIds))].sort();
  const evidenceNodes = evidenceIds.slice(0, 12).map((nodeId, index) => {
    const projected = evidenceProjections[nodeId];
    const fallback = fallbackEvidencePoint(nodeId, index);
    const point = projected?.visible === false ? fallback : projected || fallback;
    const node: FutureFieldNode = {
      id: `evidence:${nodeId}`,
      kind: 'evidence',
      role: 'current-evidence',
      label: 'Repository evidence',
      x: clamp(point.x, 3, 97),
      y: clamp(point.y, 6, 94),
      scale: 0.42,
      opacity: 0.62,
    };
    nodes.push(node);
    return { universeNodeId: nodeId, node };
  });
  const evidenceById = new Map(evidenceNodes.map(item => [item.universeNodeId, item.node]));

  if (!primaryNode) {
    for (const candidate of candidates) {
      const target = candidateNodes.get(candidate.goalId);
      if (!target) continue;
      const anchors = candidate.universeNodeIds.map(id => evidenceById.get(id)).filter((item): item is FutureFieldNode => Boolean(item)).slice(0, 2);
      const sources = anchors.length ? anchors : [{ x: horizonX - 13, y: target.y } as FutureFieldPoint];
      sources.forEach((source, index) => routes.push(route(
        `evidence:${candidate.goalId}:${index}`,
        candidate.role === 'blocked' ? 'conflict' : 'candidate',
        source,
        target,
        candidate.origin === 'Deterministic evidence',
        candidate.role === 'blocked' ? 0.24 : 0.44,
        candidate.role === 'blocked',
      )));
    }
    return { nodes, routes, horizonX };
  }

  const firstExecutionNode = dependencyNodes[0] || primaryNode;
  evidenceNodes.forEach(({ node }, index) => routes.push(route(
    `evidence:trunk:${index}`,
    'evidence',
    node,
    firstExecutionNode,
    true,
    0.46,
  )));
  dependencyNodes.forEach((dependency, index) => {
    const next = dependencyNodes[index + 1] || primaryNode;
    routes.push(route(`execution:${dependency.id}`, 'execution', dependency, next, true, 0.92));
  });
  if (!dependencyNodes.length) {
    routes.push(route('execution:direct-primary', 'execution', { x: horizonX - 3, y: 50 }, primaryNode, true, 0.88));
  }
  supports.forEach(support => {
    const source = candidateNodes.get(support.goalId);
    if (!source) return;
    const relevantDependency = dependencyNodes.find(dependency => overlay.dependencies.find(item => item.id === dependency.id)?.dependentGoalIds.includes(support.goalId));
    routes.push(route(`support:${support.goalId}`, 'support', source, relevantDependency || primaryNode, true, 0.8));
  });
  saved.forEach(item => {
    const source = candidateNodes.get(item.goalId);
    if (source) routes.push(route(`saved:${item.goalId}`, 'saved', { x: horizonX + 5, y: source.y }, source, false, 0.24));
  });
  candidates.filter(candidate => candidate.role === 'blocked').forEach(item => {
    const target = candidateNodes.get(item.goalId);
    if (target) routes.push(route(`conflict:${item.goalId}`, 'conflict', { x: horizonX + 4, y: target.y }, target, false, 0.28, true));
  });

  return { nodes, routes, horizonX };
}

export function futureRoutePath(routeValue: FutureFieldRoute) {
  return `M ${routeValue.source.x} ${routeValue.source.y} C ${routeValue.controlA.x} ${routeValue.controlA.y}, ${routeValue.controlB.x} ${routeValue.controlB.y}, ${routeValue.target.x} ${routeValue.target.y}`;
}

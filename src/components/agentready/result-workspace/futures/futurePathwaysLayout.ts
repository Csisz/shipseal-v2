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
  kind: 'goal' | 'dependency' | 'evidence' | 'bundle' | 'intervention';
  role: RepositoryFutureStageCandidate['role'] | 'required' | 'current-evidence' | 'evidence-bundle' | 'capability';
  label: string;
  scale: number;
  opacity: number;
  pathGoalIds: string[];
  order?: number;
  state?: string;
  reviewRequired?: boolean;
  sourceUniverseNodeId?: string;
  bundleSize?: number;
}

export interface FutureFieldRoute {
  id: string;
  kind: 'evidence' | 'capability' | 'execution' | 'support' | 'saved' | 'candidate' | 'conflict';
  source: FutureFieldPoint;
  target: FutureFieldPoint;
  controlA: FutureFieldPoint;
  controlB: FutureFieldPoint;
  deterministic: boolean;
  opacity: number;
  broken: boolean;
  pathGoalIds: string[];
}

export interface FutureFieldLayout {
  nodes: FutureFieldNode[];
  routes: FutureFieldRoute[];
  horizonX: number;
  zones: Array<{ id: 'current' | 'intervention' | 'decision' | 'outcome'; label: string; x: number }>;
}

export type FutureEvidenceProjection = Record<string, FutureFieldPoint & { visible?: boolean }>;

export function futureImpulseEvent(
  overlay: Pick<RepositoryFutureStageOverlay, 'activeTraceId' | 'focusedId' | 'draftFingerprint'>,
  reducedMotion: boolean,
) {
  if (reducedMotion) return undefined;
  if (overlay.draftFingerprint) return 'synthesis-recomputed' as const;
  if (overlay.activeTraceId || overlay.focusedId) return 'evidence-focused' as const;
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

function lane(index: number, count: number) {
  return count <= 1 ? 50 : 16 + (index / (count - 1)) * 68;
}

function route(
  id: string,
  kind: FutureFieldRoute['kind'],
  source: FutureFieldPoint,
  target: FutureFieldPoint,
  deterministic: boolean,
  opacity: number,
  pathGoalIds: string[],
  broken = false,
): FutureFieldRoute {
  const distance = Math.max(4, target.x - source.x);
  const organicBend = ((stableHash(`${id}:bend`) % 31) - 15) / 10;
  return {
    id,
    kind,
    source,
    target,
    controlA: { x: source.x + distance * 0.4, y: source.y + organicBend },
    controlB: { x: target.x - distance * 0.35, y: target.y - organicBend * 0.55 },
    deterministic,
    opacity,
    broken,
    pathGoalIds,
  };
}

function fallbackEvidencePoint(nodeId: string, index: number): FutureFieldPoint {
  const hash = stableHash(nodeId);
  return { x: 10 + (hash % 18), y: 14 + ((hash >>> 5) % 68) + (index % 2 ? 2 : -2) };
}

function isRepositoryRootNodeId(nodeId: string) {
  return nodeId.startsWith('repository:') || nodeId === 'universe:root' || nodeId === 'root';
}

function mappedEvidenceIds(candidate: RepositoryFutureStageCandidate) {
  const specific = candidate.universeNodeIds.filter(nodeId => !isRepositoryRootNodeId(nodeId));
  return (specific.length ? specific : candidate.universeNodeIds).slice(0, 2);
}

function applyTraceEmphasis(
  nodes: FutureFieldNode[],
  routes: FutureFieldRoute[],
  overlay: Pick<RepositoryFutureStageOverlay, 'activeTraceId' | 'candidates' | 'dependencies'>,
) {
  const traceId = overlay.activeTraceId;
  if (!traceId) return;
  const dependency = overlay.dependencies.find(item => item.id === traceId);
  const traceGoalIds = new Set(dependency?.dependentGoalIds || [traceId]);
  const tracedCandidate = overlay.candidates.find(item => item.goalId === traceId);
  if (tracedCandidate?.role === 'primary') {
    overlay.candidates.filter(item => item.role === 'supporting').forEach(item => traceGoalIds.add(item.goalId));
  } else if (tracedCandidate?.role === 'supporting') {
    const primary = overlay.candidates.find(item => item.role === 'primary');
    if (primary) traceGoalIds.add(primary.goalId);
  }
  const related = (pathGoalIds: string[], id?: string) => id === traceId || pathGoalIds.some(goalId => traceGoalIds.has(goalId));
  nodes.forEach(node => {
    node.opacity *= related(node.pathGoalIds, node.id) ? 1 : 0.2;
  });
  routes.forEach(path => {
    path.opacity *= related(path.pathGoalIds, path.id) ? 1 : 0.16;
  });
}

/**
 * Pure deterministic topology for the DOM/SVG future field. It preserves
 * projected repository evidence, then aggregates that evidence before the
 * directional capability -> dependency -> outcome continuum.
 */
export function buildFutureFieldLayout(
  overlay: Pick<RepositoryFutureStageOverlay, 'phase' | 'candidates' | 'dependencies' | 'conflictCount' | 'activeTraceId'>,
  evidenceProjections: FutureEvidenceProjection = {},
): FutureFieldLayout {
  const nodes: FutureFieldNode[] = [];
  const routes: FutureFieldRoute[] = [];
  const candidates = overlay.candidates.slice(0, 7);
  const primary = candidates.find(candidate => candidate.role === 'primary');
  const supports = candidates.filter(candidate => candidate.role === 'supporting');
  const saved = candidates.filter(candidate => candidate.role === 'saved');
  const candidateNodes = new Map<string, FutureFieldNode>();
  const interventionNodes = new Map<string, FutureFieldNode>();

  candidates.forEach((candidate, index) => {
    const candidateY = lane(index, candidates.length);
    let x = 68 + (stableHash(candidate.capabilityId) % 5);
    let y = candidateY;
    let scale = 0.78;
    let opacity = candidate.role === 'blocked' ? 0.34 : 0.74;
    if (candidate.role === 'primary') {
      x = 70;
      y = 50;
      scale = 1.28;
      opacity = 1;
    } else if (candidate.role === 'supporting') {
      const supportIndex = supports.findIndex(item => item.goalId === candidate.goalId);
      x = 55;
      y = supportIndex === 0 ? 32 : 68;
      scale = 0.9;
      opacity = 0.9;
    } else if (candidate.role === 'saved') {
      const savedIndex = saved.findIndex(item => item.goalId === candidate.goalId);
      x = 69;
      y = savedIndex === 0 ? 12 : 88;
      scale = 0.62;
      opacity = 0.3;
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
      pathGoalIds: [candidate.goalId],
    };
    nodes.push(node);
    candidateNodes.set(candidate.goalId, node);

    const bundle: FutureFieldNode = {
      id: `bundle:${candidate.goalId}`,
      kind: 'bundle',
      role: 'evidence-bundle',
      label: 'Evidence bundle',
      x: 34,
      y: candidate.role === 'primary' ? 50 : candidateY,
      scale: 0.52,
      opacity: candidate.role === 'saved' ? 0.24 : candidate.role === 'blocked' ? 0.3 : 0.62,
      pathGoalIds: [candidate.goalId],
      bundleSize: Math.max(1, candidate.evidenceCount),
    };
    nodes.push(bundle);

    const intervention: FutureFieldNode = {
      id: `intervention:${candidate.goalId}`,
      kind: 'intervention',
      role: 'capability',
      label: candidate.capabilityTitle || candidate.title,
      x: 45,
      y: bundle.y,
      scale: candidate.role === 'primary' ? 0.86 : 0.68,
      opacity: candidate.role === 'saved' ? 0.25 : candidate.role === 'blocked' ? 0.34 : 0.76,
      pathGoalIds: [candidate.goalId],
    };
    nodes.push(intervention);
    interventionNodes.set(candidate.goalId, intervention);

    const evidenceIds = mappedEvidenceIds(candidate);
    const sourceIds = evidenceIds.length ? evidenceIds : [`fallback:${candidate.goalId}`];
    sourceIds.forEach((nodeId, evidenceIndex) => {
      const projected = evidenceProjections[nodeId];
      const fallback = fallbackEvidencePoint(nodeId, evidenceIndex + index);
      const point = projected?.visible === false ? fallback : projected || fallback;
      const evidenceNode: FutureFieldNode = {
        id: `evidence:${candidate.goalId}:${nodeId}`,
        kind: 'evidence',
        role: 'current-evidence',
        label: 'Repository evidence',
        x: clamp(point.x, 4, 30),
        y: clamp(point.y, 7, 93),
        scale: 0.38,
        opacity: candidate.role === 'saved' ? 0.2 : 0.52,
        pathGoalIds: [candidate.goalId],
        sourceUniverseNodeId: nodeId.startsWith('fallback:') ? undefined : nodeId,
      };
      nodes.push(evidenceNode);
      routes.push(route(
        `evidence:${candidate.goalId}:${evidenceIndex}`,
        'evidence',
        evidenceNode,
        bundle,
        candidate.origin === 'Deterministic evidence',
        candidate.role === 'saved' ? 0.18 : 0.36,
        [candidate.goalId],
      ));
    });
    routes.push(route(
      `capability:${candidate.goalId}`,
      candidate.role === 'saved' ? 'saved' : candidate.role === 'blocked' ? 'conflict' : 'capability',
      bundle,
      intervention,
      candidate.origin === 'Deterministic evidence',
      candidate.role === 'saved' ? 0.22 : candidate.role === 'blocked' ? 0.26 : 0.62,
      [candidate.goalId],
      candidate.role === 'blocked',
    ));
  });

  const orderedDependencies = overlay.dependencies
    .slice()
    .sort((left, right) => left.executionOrder - right.executionOrder || left.id.localeCompare(right.id));
  const dependencyNodes = orderedDependencies.map((dependency, index) => {
    const span = Math.max(1, orderedDependencies.length - 1);
    const node: FutureFieldNode = {
      id: dependency.id,
      kind: 'dependency',
      role: 'required',
      label: dependency.title,
      x: 57 + (index / span) * Math.min(9, orderedDependencies.length * 3.5),
      y: 50 + (index % 2 ? 3 : -3),
      scale: 0.7,
      opacity: dependency.state === 'satisfied' ? 0.58 : 0.92,
      pathGoalIds: dependency.dependentGoalIds,
      order: dependency.executionOrder,
      state: dependency.state,
      reviewRequired: dependency.humanReviewRequired,
    };
    nodes.push(node);
    return node;
  });

  if (!primary) {
    candidates.forEach(candidate => {
      const intervention = interventionNodes.get(candidate.goalId);
      const target = candidateNodes.get(candidate.goalId);
      if (!intervention || !target) return;
      routes.push(route(
        `candidate:${candidate.goalId}`,
        candidate.role === 'blocked' ? 'conflict' : 'candidate',
        intervention,
        target,
        candidate.origin === 'Deterministic evidence',
        candidate.role === 'blocked' ? 0.26 : 0.52,
        [candidate.goalId],
        candidate.role === 'blocked',
      ));
    });
  } else {
    const primaryNode = candidateNodes.get(primary.goalId)!;
    const primaryIntervention = interventionNodes.get(primary.goalId)!;
    const firstStep = dependencyNodes[0] || primaryNode;
    routes.push(route('execution:primary-entry', 'execution', primaryIntervention, firstStep, true, 0.9, [primary.goalId]));
    dependencyNodes.forEach((dependency, index) => {
      const next = dependencyNodes[index + 1] || primaryNode;
      const dependencyModel = orderedDependencies[index];
      routes.push(route(`execution:${dependency.id}`, 'execution', dependency, next, true, 0.94, dependencyModel.dependentGoalIds));
    });
    supports.forEach(support => {
      const intervention = interventionNodes.get(support.goalId);
      const supportNode = candidateNodes.get(support.goalId);
      if (!intervention || !supportNode) return;
      routes.push(route(`support-entry:${support.goalId}`, 'support', intervention, supportNode, true, 0.72, [support.goalId]));
      const relevantDependencyIndex = orderedDependencies.findIndex(item => item.dependentGoalIds.includes(support.goalId));
      const convergenceTarget = relevantDependencyIndex >= 0 ? dependencyNodes[relevantDependencyIndex] : primaryNode;
      routes.push(route(`support:${support.goalId}`, 'support', supportNode, convergenceTarget, true, 0.78, [support.goalId, primary.goalId]));
    });
    saved.forEach(item => {
      const intervention = interventionNodes.get(item.goalId);
      const target = candidateNodes.get(item.goalId);
      if (intervention && target) routes.push(route(`saved:${item.goalId}`, 'saved', intervention, target, false, 0.2, [item.goalId]));
    });
  }

  applyTraceEmphasis(nodes, routes, overlay);
  return {
    nodes,
    routes,
    horizonX: 38,
    zones: [
      { id: 'current', label: 'Current evidence', x: 14 },
      { id: 'intervention', label: 'Intervention', x: 43 },
      { id: 'decision', label: 'Decision + dependencies', x: 61 },
      { id: 'outcome', label: 'Future outcome', x: 70 },
    ],
  };
}

export function futureRoutePath(routeValue: FutureFieldRoute) {
  return `M ${routeValue.source.x} ${routeValue.source.y} C ${routeValue.controlA.x} ${routeValue.controlA.y}, ${routeValue.controlB.x} ${routeValue.controlB.y}, ${routeValue.target.x} ${routeValue.target.y}`;
}

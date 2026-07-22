import type { RepositoryUniversePosition } from './repositoryUniverse';

export interface RepositoryUniverseCameraMotionState {
  theta: number;
  phi: number;
  radius: number;
  target: RepositoryUniversePosition;
}

export interface RepositoryUniverseFrameDelta {
  deltaSeconds: number;
  animationDeltaSeconds: number;
}

export interface RepositoryUniverseViewportMetrics {
  width: number;
  height: number;
  pixelRatio: number;
  aspect: number;
}

export interface RepositoryUniversePointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RepositoryUniverseCameraSettlementTolerance {
  targetDistance: number;
  positionDistance: number;
  angleRadians: number;
  radiusDistance: number;
}

export interface RepositoryUniverseFocusRequest {
  generation: number;
  nodeId: string;
  consecutiveSettledFrames: number;
}

export type RepositoryUniverseSettlementState = 'idle' | 'moving' | 'converging' | 'settled' | 'interrupted';

export interface RepositoryUniverseDiagnosticsSnapshot {
  rendererCreationCount: number;
  rendererDisposalCount: number;
  canvasId: string;
  renderCalls: number;
  triangles: number;
  lines: number;
  approximateFps: number;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  canvasWidth: number;
  canvasHeight: number;
  devicePixelRatio: number;
  fullscreen: boolean;
  resizeCount: number;
  selectedNodeId: string | null;
  cameraTheta: number;
  cameraPhi: number;
  cameraRadius: number;
  cameraTargetX: number;
  cameraTargetY: number;
  cameraTargetZ: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasHostWidth: number;
  canvasHostHeight: number;
  responsiveLayoutMode: 'narrow' | 'wide';
  horizontalOverflow: number;
  programmaticCameraMotionActive: boolean;
  visualMotionActive: boolean;
  activeVisualInterpolationCount: number;
  visualTargetRecalculationCount: number;
  visualTargetRecalculationsPerSecond: number;
  pointerMoveEventCount: number;
  hoverRaycastCount: number;
  hoverRaycastsPerSecond: number;
  cachedRaycastObjectCount: number;
  raycastCacheRebuildCount: number;
  visualTargetsDirty: boolean;
  hoverRaycastPending: boolean;
  settlementState: RepositoryUniverseSettlementState;
  baseEdgeBatchCount: number;
  baseEdgeSegmentCount: number;
  overlayBatchCount: number;
  activeOverlaySegmentCount: number;
  edgeBatchRebuildCount: number;
  edgeBufferUpdateCount: number;
  individualCanonicalEdgeObjectCount: number;
  ownedGeometryCount: number;
  ownedMaterialCount: number;
  geometryDisposalCount: number;
  materialDisposalCount: number;
  duplicateDisposalDetectionCount: number;
}

export const REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP = Object.freeze({
  none: 0,
  clusters: 1 << 0,
  repositoryEdges: 1 << 1,
  repositoryNodes: 1 << 2,
  nodeLabels: 1 << 3,
  proposalEdges: 1 << 4,
  proposalNodes: 1 << 5,
  all: (1 << 6) - 1,
});

export type RepositoryUniverseVisualTargetDirtyDependency =
  | 'initial-scene'
  | 'hovered-node'
  | 'selected-node'
  | 'focused-cluster'
  | 'search-membership'
  | 'visible-node-membership'
  | 'visible-edge-membership'
  | 'route-membership'
  | 'proposal-visibility'
  | 'proposal-selection'
  | 'camera-label-band'
  | 'reduced-motion'
  | 'initial-reveal';

export interface RepositoryUniverseVisualTargetDirtyState {
  groups: number;
  version: number;
  recalculationCount: number;
}

export interface RepositoryUniversePointerPickState {
  x: number;
  y: number;
  pending: boolean;
  hoveredNodeId: string | null;
  pointerMoveEventCount: number;
  hoverRaycastCount: number;
}

export interface RepositoryUniverseRaycastCache<T> {
  readonly objects: T[];
  dirty: boolean;
  rebuildCount: number;
}

export interface RepositoryUniverseVisualMotionState {
  active: boolean;
}

export type RepositoryUniverseLabelDistanceBand = 'near' | 'medium' | 'far';

export interface RepositoryUniverseNodeVisualPriority {
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  matched: boolean;
  routeHighlighted: boolean;
  connected: boolean;
  quiet: boolean;
  suppressed: boolean;
  importance: 'primary' | 'supporting' | 'background';
}

export interface RepositoryUniverseEdgeVisualPriority {
  visible: boolean;
  directlySelected: boolean;
  focused: boolean;
  relationship: string;
  evidenceType: string;
  contextualFocusActive: boolean;
}

export interface RepositoryUniverseDiagnosticsChannel {
  update: (values: Partial<RepositoryUniverseDiagnosticsSnapshot>) => void;
  dispose: () => void;
}

interface DiagnosticsHost {
  [REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY]?: Readonly<RepositoryUniverseDiagnosticsSnapshot>;
}

declare global {
  interface Window {
    readonly __SHIPSEAL_REPOSITORY_UNIVERSE_DIAGNOSTICS__?: Readonly<RepositoryUniverseDiagnosticsSnapshot>;
  }
}

/** Maximum motion step after an inactive tab, breakpoint, or unusually long frame. */
export const MAX_REPOSITORY_UNIVERSE_ANIMATION_DELTA_SECONDS = 1 / 20;

/** Closely matches the previous 0.18-per-frame camera damping at 60 FPS. */
export const REPOSITORY_UNIVERSE_CAMERA_DAMPING_RATE = 12;

/** The previous 0.0007 radians-per-frame idle orbit expressed per second at 60 FPS. */
export const REPOSITORY_UNIVERSE_IDLE_RADIANS_PER_SECOND = 0.042;

/** Consecutive converged frames prevent a single lucky frame from reporting settlement. */
export const REPOSITORY_UNIVERSE_SETTLED_FRAME_COUNT = 4;

/** Named per-second rates keep U2B interaction timing intentional and frame-rate independent. */
export const REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES = Object.freeze({
  hover: 22,
  selection: 16,
  dimIn: 13,
  dimOut: 9,
  emissive: 18,
  haloIn: 24,
  haloOut: 12,
  edge: 14,
  proposal: 15,
  clusterRing: 11,
  label: 20,
});

export const REPOSITORY_UNIVERSE_VISUAL_SETTLEMENT_EPSILON = 0.001;
export const REPOSITORY_UNIVERSE_LABEL_FAR_RADIUS = 720;
export const REPOSITORY_UNIVERSE_LABEL_MEDIUM_RADIUS = 420;
export const REPOSITORY_UNIVERSE_LABEL_BAND_HYSTERESIS = 12;

export const REPOSITORY_UNIVERSE_CAMERA_SETTLEMENT_TOLERANCE: RepositoryUniverseCameraSettlementTolerance = {
  targetDistance: 0.2,
  positionDistance: 0.35,
  angleRadians: 0.001,
  radiusDistance: 0.2,
};

/** Development-only, read-only window property used by localhost browser diagnostics. */
export const REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY = '__SHIPSEAL_REPOSITORY_UNIVERSE_DIAGNOSTICS__' as const;

let rendererCreationCount = 0;
let rendererDisposalCount = 0;

/**
 * U3A dirty-dependency contract:
 * - hover and search membership affect repository nodes and labels;
 * - selection and cluster focus also affect cluster rings and repository edges;
 * - filters arrive as visible-node/visible-edge membership changes;
 * - flight-path route-node membership also owns the derived route-edge dependency;
 * - Current/With ShipSeal mode and domain own proposal visibility;
 * - proposal selection and exclusion own proposal-node/proposal-edge emphasis;
 * - camera motion dirties labels only when the hysteretic distance band changes;
 * - reduced motion, initial scene creation, and reveal-mode changes refresh all targets.
 * Fullscreen, camera angle, and ordinary reveal progress do not derive visual targets.
 */
export function repositoryUniverseVisualTargetGroupsForDependency(
  dependency: RepositoryUniverseVisualTargetDirtyDependency,
) {
  const groups = REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP;
  switch (dependency) {
    case 'hovered-node':
    case 'search-membership':
      return groups.repositoryNodes | groups.nodeLabels;
    case 'selected-node':
    case 'focused-cluster':
      return groups.clusters | groups.repositoryEdges | groups.repositoryNodes | groups.nodeLabels;
    case 'visible-node-membership':
      return groups.repositoryNodes | groups.nodeLabels;
    case 'visible-edge-membership':
      return groups.repositoryEdges;
    case 'route-membership':
      // Route edges do not currently have a distinct style, but keeping the edge group
      // dirty here makes the route-node/route-edge dependency explicit and future-safe.
      return groups.repositoryEdges | groups.repositoryNodes | groups.nodeLabels;
    case 'proposal-visibility':
    case 'proposal-selection':
      return groups.proposalEdges | groups.proposalNodes;
    case 'camera-label-band':
      return groups.nodeLabels;
    case 'initial-scene':
    case 'reduced-motion':
    case 'initial-reveal':
      return groups.all;
  }
}

export function createRepositoryUniverseVisualTargetDirtyState(
  initialGroups = REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.all,
): RepositoryUniverseVisualTargetDirtyState {
  return { groups: initialGroups, version: initialGroups ? 1 : 0, recalculationCount: 0 };
}

export function markRepositoryUniverseVisualTargetsDirty(
  state: RepositoryUniverseVisualTargetDirtyState,
  groups: number,
) {
  if (!groups) return;
  state.groups |= groups;
  state.version += 1;
}

export function consumeRepositoryUniverseVisualTargetGroups(state: RepositoryUniverseVisualTargetDirtyState) {
  const groups = state.groups;
  if (!groups) return REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.none;
  state.groups = REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.none;
  state.recalculationCount += 1;
  return groups;
}

export function createRepositoryUniversePointerPickState(): RepositoryUniversePointerPickState {
  return {
    x: 0,
    y: 0,
    pending: false,
    hoveredNodeId: null,
    pointerMoveEventCount: 0,
    hoverRaycastCount: 0,
  };
}

export function queueRepositoryUniversePointerMove(
  state: RepositoryUniversePointerPickState,
  x: number,
  y: number,
) {
  state.x = x;
  state.y = y;
  state.pending = true;
  state.pointerMoveEventCount += 1;
}

export function consumeRepositoryUniverseHoverRaycast(state: RepositoryUniversePointerPickState) {
  if (!state.pending) return null;
  state.pending = false;
  state.hoverRaycastCount += 1;
  return { x: state.x, y: state.y };
}

export function prepareRepositoryUniverseImmediatePick(
  state: RepositoryUniversePointerPickState,
  x: number,
  y: number,
) {
  state.x = x;
  state.y = y;
  state.pending = false;
  return { x, y };
}

export function clearRepositoryUniversePointerHover(state: RepositoryUniversePointerPickState) {
  const changed = state.pending || state.hoveredNodeId !== null;
  state.pending = false;
  state.hoveredNodeId = null;
  return changed;
}

export function createRepositoryUniverseRaycastCache<T>(): RepositoryUniverseRaycastCache<T> {
  return { objects: [], dirty: true, rebuildCount: 0 };
}

export function markRepositoryUniverseRaycastCacheDirty<T>(cache: RepositoryUniverseRaycastCache<T>) {
  cache.dirty = true;
}

export function rebuildRepositoryUniverseRaycastCache<T>(
  cache: RepositoryUniverseRaycastCache<T>,
  candidates: Iterable<T>,
  eligible: (candidate: T) => boolean,
) {
  if (!cache.dirty) return false;
  cache.objects.length = 0;
  for (const candidate of candidates) {
    if (eligible(candidate)) cache.objects.push(candidate);
  }
  cache.dirty = false;
  cache.rebuildCount += 1;
  return true;
}

export function clearRepositoryUniverseRaycastCache<T>(cache: RepositoryUniverseRaycastCache<T>) {
  cache.objects.length = 0;
  cache.dirty = false;
}

export function createRepositoryUniverseVisualMotionState(initialActive = false): RepositoryUniverseVisualMotionState {
  return { active: initialActive };
}

export function activateRepositoryUniverseVisualMotion(state: RepositoryUniverseVisualMotionState) {
  state.active = true;
}

export function completeRepositoryUniverseVisualMotionFrame(
  state: RepositoryUniverseVisualMotionState,
  activeInterpolationCount: number,
) {
  state.active = activeInterpolationCount > 0;
  return state.active;
}

export function repositoryUniverseFrameDelta(
  previousTimestampMs: number | null,
  timestampMs: number,
  maximumAnimationDeltaSeconds = MAX_REPOSITORY_UNIVERSE_ANIMATION_DELTA_SECONDS,
): RepositoryUniverseFrameDelta {
  if (previousTimestampMs === null || !Number.isFinite(previousTimestampMs) || !Number.isFinite(timestampMs)) {
    return { deltaSeconds: 0, animationDeltaSeconds: 0 };
  }

  const deltaSeconds = Math.max(0, (timestampMs - previousTimestampMs) / 1000);
  return {
    deltaSeconds,
    animationDeltaSeconds: Math.min(deltaSeconds, Math.max(0, maximumAnimationDeltaSeconds)),
  };
}

export function exponentialDampingAlpha(ratePerSecond: number, deltaSeconds: number) {
  if (ratePerSecond <= 0 || deltaSeconds <= 0) return 0;
  return 1 - Math.exp(-ratePerSecond * deltaSeconds);
}

export function dampScalar(current: number, desired: number, ratePerSecond: number, deltaSeconds: number) {
  return current + (desired - current) * exponentialDampingAlpha(ratePerSecond, deltaSeconds);
}

export function stepRepositoryUniverseVisualScalar(
  current: number,
  desired: number,
  ratePerSecond: number,
  deltaSeconds: number,
  reducedMotion = false,
  epsilon = REPOSITORY_UNIVERSE_VISUAL_SETTLEMENT_EPSILON,
) {
  if (reducedMotion || Math.abs(desired - current) <= epsilon) return desired;
  const next = dampScalar(current, desired, ratePerSecond, deltaSeconds);
  return Math.abs(desired - next) <= epsilon ? desired : next;
}

export function repositoryUniverseVisualScalarActive(
  current: number,
  desired: number,
  epsilon = REPOSITORY_UNIVERSE_VISUAL_SETTLEMENT_EPSILON,
) {
  return Math.abs(desired - current) > epsilon;
}

export function repositoryUniverseOpacityVisible(
  targetVisible: boolean,
  currentOpacity: number,
  epsilon = REPOSITORY_UNIVERSE_VISUAL_SETTLEMENT_EPSILON,
) {
  return targetVisible || currentOpacity > epsilon;
}

/** Reveal owns spatial position in U2A; this multiplier composes any base scale with U2B emphasis. */
export function composeRepositoryUniverseVisualScale(baseScale: number, emphasisScale: number) {
  return baseScale * emphasisScale;
}

export function repositoryUniverseNodeOpacityTarget(state: RepositoryUniverseNodeVisualPriority) {
  if (!state.visible) return 0;
  if (state.selected) return 1;
  if (state.hovered || state.matched) return 0.98;
  if (state.routeHighlighted) return 0.96;
  if (state.connected) return 0.92;
  if (state.quiet || state.suppressed) return 0.3;
  return state.importance === 'background' ? 0.58 : 0.86;
}

export function repositoryUniverseNodeScaleTarget(state: RepositoryUniverseNodeVisualPriority) {
  if (state.selected) return 2.18;
  if (state.hovered) return 1.58;
  if (state.matched) return 1.48;
  if (state.routeHighlighted) return 1.38;
  if (state.connected) return 1.32;
  return state.importance === 'primary' ? 1.08 : 1;
}

export function repositoryUniverseNodeEmissiveTarget(state: RepositoryUniverseNodeVisualPriority) {
  if (state.selected) return 1.25;
  if (state.hovered || state.matched) return 0.78;
  if (state.routeHighlighted) return 0.64;
  if (state.connected) return 0.54;
  return state.importance === 'primary' ? 0.32 : 0.09;
}

export function repositoryUniverseNodeHaloOpacityTarget(state: RepositoryUniverseNodeVisualPriority) {
  if (!state.visible) return 0;
  if (state.selected) return 0.58;
  if (state.hovered) return 0.25;
  if (state.matched) return 0.22;
  if (state.routeHighlighted) return 0.18;
  if (state.connected) return 0.13;
  return 0;
}

export function repositoryUniverseNodeHaloScaleTarget(state: RepositoryUniverseNodeVisualPriority) {
  if (state.selected) return 1.5;
  if (state.routeHighlighted) return 1.22;
  if (state.connected) return 1.16;
  return 1;
}

export function repositoryUniverseEdgeOpacityTarget(state: RepositoryUniverseEdgeVisualPriority) {
  if (!state.visible) return 0;
  if (state.directlySelected) return state.evidenceType === 'heuristic' ? 0.38 : 0.56;
  if (state.focused) return 0.25;
  if (state.relationship === 'contains') return state.contextualFocusActive ? 0.035 : 0.05;
  return state.contextualFocusActive ? 0.08 : 0.12;
}

export function repositoryUniverseLabelDistanceBand(
  cameraRadius: number,
  previous: RepositoryUniverseLabelDistanceBand = cameraRadius > REPOSITORY_UNIVERSE_LABEL_FAR_RADIUS
    ? 'far'
    : cameraRadius > REPOSITORY_UNIVERSE_LABEL_MEDIUM_RADIUS
      ? 'medium'
      : 'near',
): RepositoryUniverseLabelDistanceBand {
  if (previous === 'far') {
    return cameraRadius < REPOSITORY_UNIVERSE_LABEL_FAR_RADIUS - REPOSITORY_UNIVERSE_LABEL_BAND_HYSTERESIS ? 'medium' : 'far';
  }
  if (previous === 'near') {
    return cameraRadius > REPOSITORY_UNIVERSE_LABEL_MEDIUM_RADIUS + REPOSITORY_UNIVERSE_LABEL_BAND_HYSTERESIS ? 'medium' : 'near';
  }
  if (cameraRadius > REPOSITORY_UNIVERSE_LABEL_FAR_RADIUS + REPOSITORY_UNIVERSE_LABEL_BAND_HYSTERESIS) return 'far';
  if (cameraRadius < REPOSITORY_UNIVERSE_LABEL_MEDIUM_RADIUS - REPOSITORY_UNIVERSE_LABEL_BAND_HYSTERESIS) return 'near';
  return 'medium';
}

export function dampVectorComponents(
  current: RepositoryUniversePosition,
  desired: RepositoryUniversePosition,
  ratePerSecond: number,
  deltaSeconds: number,
): RepositoryUniversePosition {
  const alpha = exponentialDampingAlpha(ratePerSecond, deltaSeconds);
  return {
    x: current.x + (desired.x - current.x) * alpha,
    y: current.y + (desired.y - current.y) * alpha,
    z: current.z + (desired.z - current.z) * alpha,
  };
}

export function normalizeAngle(angle: number) {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

export function shortestAngleDelta(current: number, desired: number) {
  return normalizeAngle(desired - current);
}

export function dampAngle(current: number, desired: number, ratePerSecond: number, deltaSeconds: number) {
  return normalizeAngle(current + shortestAngleDelta(current, desired) * exponentialDampingAlpha(ratePerSecond, deltaSeconds));
}

export function stepRepositoryUniverseCamera(
  current: RepositoryUniverseCameraMotionState,
  desired: RepositoryUniverseCameraMotionState,
  deltaSeconds: number,
  reducedMotion = false,
): RepositoryUniverseCameraMotionState {
  if (reducedMotion) {
    return {
      theta: desired.theta,
      phi: desired.phi,
      radius: desired.radius,
      target: { ...desired.target },
    };
  }

  return {
    theta: dampAngle(current.theta, desired.theta, REPOSITORY_UNIVERSE_CAMERA_DAMPING_RATE, deltaSeconds),
    phi: dampScalar(current.phi, desired.phi, REPOSITORY_UNIVERSE_CAMERA_DAMPING_RATE, deltaSeconds),
    radius: dampScalar(current.radius, desired.radius, REPOSITORY_UNIVERSE_CAMERA_DAMPING_RATE, deltaSeconds),
    target: dampVectorComponents(current.target, desired.target, REPOSITORY_UNIVERSE_CAMERA_DAMPING_RATE, deltaSeconds),
  };
}

export function repositoryUniverseCameraPosition(state: RepositoryUniverseCameraMotionState): RepositoryUniversePosition {
  const phi = Math.max(0.18, Math.min(Math.PI - 0.18, state.phi));
  return {
    x: state.target.x + state.radius * Math.sin(phi) * Math.cos(state.theta),
    y: state.target.y + state.radius * Math.cos(phi),
    z: state.target.z + state.radius * Math.sin(phi) * Math.sin(state.theta),
  };
}

export function repositoryUniverseVectorDistance(first: RepositoryUniversePosition, second: RepositoryUniversePosition) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

export function repositoryUniverseCameraConverged(
  current: RepositoryUniverseCameraMotionState,
  desired: RepositoryUniverseCameraMotionState,
  tolerance = REPOSITORY_UNIVERSE_CAMERA_SETTLEMENT_TOLERANCE,
) {
  return repositoryUniverseVectorDistance(current.target, desired.target) <= tolerance.targetDistance
    && repositoryUniverseVectorDistance(repositoryUniverseCameraPosition(current), repositoryUniverseCameraPosition(desired)) <= tolerance.positionDistance
    && Math.abs(shortestAngleDelta(current.theta, desired.theta)) <= tolerance.angleRadians
    && Math.abs(current.phi - desired.phi) <= tolerance.angleRadians
    && Math.abs(current.radius - desired.radius) <= tolerance.radiusDistance;
}

export function repositoryUniverseCameraTargetMatches(
  first: RepositoryUniverseCameraMotionState,
  second: RepositoryUniverseCameraMotionState,
  tolerance = 0.000001,
) {
  return Math.abs(shortestAngleDelta(first.theta, second.theta)) <= tolerance
    && Math.abs(first.phi - second.phi) <= tolerance
    && Math.abs(first.radius - second.radius) <= tolerance
    && repositoryUniverseVectorDistance(first.target, second.target) <= tolerance;
}

export function createRepositoryUniverseFocusRequest(
  previous: RepositoryUniverseFocusRequest | null,
  nodeId: string,
): RepositoryUniverseFocusRequest {
  return {
    generation: (previous?.generation || 0) + 1,
    nodeId,
    consecutiveSettledFrames: 0,
  };
}

export function nextRepositoryUniverseSettledFrameCount(currentCount: number, converged: boolean) {
  return converged ? currentCount + 1 : 0;
}

export function repositoryUniverseFocusCanSettle(
  request: RepositoryUniverseFocusRequest,
  activeGeneration: number,
  requiredFrames = REPOSITORY_UNIVERSE_SETTLED_FRAME_COUNT,
) {
  return request.generation === activeGeneration && request.consecutiveSettledFrames >= requiredFrames;
}

export function idleRotationDelta(deltaSeconds: number) {
  return REPOSITORY_UNIVERSE_IDLE_RADIANS_PER_SECOND * Math.max(0, deltaSeconds);
}

export function repositoryUniverseViewportMetrics(
  width: number,
  height: number,
  devicePixelRatio: number,
  fullscreen: boolean,
): RepositoryUniverseViewportMetrics {
  const renderedWidth = Math.max(1, Math.round(width));
  const renderedHeight = Math.max(1, Math.round(height));
  return {
    width: renderedWidth,
    height: renderedHeight,
    pixelRatio: Math.min(devicePixelRatio || 1, fullscreen ? 1.5 : 1.35),
    aspect: renderedWidth / renderedHeight,
  };
}

export function repositoryUniversePointerCoordinates(
  clientX: number,
  clientY: number,
  bounds: RepositoryUniversePointerBounds,
) {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  return {
    x: ((clientX - bounds.left) / width) * 2 - 1,
    y: -((clientY - bounds.top) / height) * 2 + 1,
  };
}

export function createRepositoryUniverseDiagnosticsChannel(
  development: boolean,
  host: DiagnosticsHost | undefined,
  initial: Omit<RepositoryUniverseDiagnosticsSnapshot, 'rendererCreationCount' | 'rendererDisposalCount' | 'canvasId'>,
): RepositoryUniverseDiagnosticsChannel | undefined {
  if (!development || !host) return undefined;

  rendererCreationCount += 1;
  const state: RepositoryUniverseDiagnosticsSnapshot = {
    rendererCreationCount,
    rendererDisposalCount,
    canvasId: `repository-universe-canvas-${rendererCreationCount}`,
    ...initial,
  };
  const getter = () => Object.freeze({ ...state });
  let disposed = false;

  Object.defineProperty(host, REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY, {
    configurable: true,
    enumerable: false,
    get: getter,
  });

  return {
    update(values) {
      Object.assign(state, values);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rendererDisposalCount += 1;
      state.rendererDisposalCount = rendererDisposalCount;
      const descriptor = Object.getOwnPropertyDescriptor(host, REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY);
      if (descriptor?.get === getter) delete host[REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY];
    },
  };
}

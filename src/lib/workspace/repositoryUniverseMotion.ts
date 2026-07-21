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
  renderCalls: number;
  triangles: number;
  lines: number;
  approximateFps: number;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  canvasWidth: number;
  canvasHeight: number;
  devicePixelRatio: number;
  programmaticCameraMotionActive: boolean;
  settlementState: RepositoryUniverseSettlementState;
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

export const REPOSITORY_UNIVERSE_CAMERA_SETTLEMENT_TOLERANCE: RepositoryUniverseCameraSettlementTolerance = {
  targetDistance: 0.2,
  positionDistance: 0.35,
  angleRadians: 0.001,
  radiusDistance: 0.2,
};

/** Development-only, read-only window property used by localhost browser diagnostics. */
export const REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY = '__SHIPSEAL_REPOSITORY_UNIVERSE_DIAGNOSTICS__' as const;

let rendererCreationCount = 0;

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

export function createRepositoryUniverseDiagnosticsChannel(
  development: boolean,
  host: DiagnosticsHost | undefined,
  initial: Omit<RepositoryUniverseDiagnosticsSnapshot, 'rendererCreationCount'>,
): RepositoryUniverseDiagnosticsChannel | undefined {
  if (!development || !host) return undefined;

  rendererCreationCount += 1;
  const state: RepositoryUniverseDiagnosticsSnapshot = {
    rendererCreationCount,
    ...initial,
  };
  const getter = () => Object.freeze({ ...state });

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
      const descriptor = Object.getOwnPropertyDescriptor(host, REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY);
      if (descriptor?.get === getter) delete host[REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY];
    },
  };
}

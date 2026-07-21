import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY,
  REPOSITORY_UNIVERSE_IDLE_RADIANS_PER_SECOND,
  REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES,
  REPOSITORY_UNIVERSE_SETTLED_FRAME_COUNT,
  composeRepositoryUniverseVisualScale,
  createRepositoryUniverseDiagnosticsChannel,
  createRepositoryUniverseFocusRequest,
  idleRotationDelta,
  nextRepositoryUniverseSettledFrameCount,
  repositoryUniverseFocusCanSettle,
  repositoryUniverseCameraTargetMatches,
  repositoryUniverseFrameDelta,
  repositoryUniverseEdgeOpacityTarget,
  repositoryUniverseLabelDistanceBand,
  repositoryUniverseNodeHaloOpacityTarget,
  repositoryUniverseNodeOpacityTarget,
  repositoryUniverseNodeScaleTarget,
  repositoryUniverseOpacityVisible,
  repositoryUniverseVisualScalarActive,
  shortestAngleDelta,
  stepRepositoryUniverseCamera,
  stepRepositoryUniverseVisualScalar,
  type RepositoryUniverseCameraMotionState,
  type RepositoryUniverseDiagnosticsSnapshot,
} from '@/lib/workspace/repositoryUniverseMotion';

const initialCamera: RepositoryUniverseCameraMotionState = {
  theta: -0.68,
  phi: 1.08,
  radius: 700,
  target: { x: 0, y: 0, z: 0 },
};

const focusedCamera: RepositoryUniverseCameraMotionState = {
  theta: 0.8,
  phi: 1.32,
  radius: 220,
  target: { x: 120, y: -40, z: 65 },
};

function simulateCamera(frameRate: number, durationSeconds = 1) {
  let camera = initialCamera;
  const deltaSeconds = 1 / frameRate;
  for (let frame = 0; frame < frameRate * durationSeconds; frame += 1) {
    camera = stepRepositoryUniverseCamera(camera, focusedCamera, deltaSeconds);
  }
  return camera;
}

function emptyDiagnostics(): Omit<RepositoryUniverseDiagnosticsSnapshot, 'rendererCreationCount'> {
  return {
    renderCalls: 0,
    triangles: 0,
    lines: 0,
    approximateFps: 0,
    visibleNodeCount: 0,
    visibleEdgeCount: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    devicePixelRatio: 1,
    programmaticCameraMotionActive: false,
    visualMotionActive: false,
    activeVisualInterpolationCount: 0,
    settlementState: 'idle',
  };
}

const baseNodePriority = {
  visible: true,
  selected: false,
  hovered: false,
  matched: false,
  routeHighlighted: false,
  connected: false,
  quiet: false,
  suppressed: false,
  importance: 'supporting' as const,
};

describe('Repository Universe 3D motion', () => {
  it('produces equivalent exponential damping across 30, 60 and 120 FPS timelines', () => {
    const at30 = simulateCamera(30);
    const at60 = simulateCamera(60);
    const at120 = simulateCamera(120);

    for (const camera of [at60, at120]) {
      expect(camera.theta).toBeCloseTo(at30.theta, 10);
      expect(camera.phi).toBeCloseTo(at30.phi, 10);
      expect(camera.radius).toBeCloseTo(at30.radius, 10);
      expect(camera.target.x).toBeCloseTo(at30.target.x, 10);
      expect(camera.target.y).toBeCloseTo(at30.target.y, 10);
      expect(camera.target.z).toBeCloseTo(at30.target.z, 10);
    }
  });

  it('initializes the first frame without a synthetic delta', () => {
    expect(repositoryUniverseFrameDelta(null, 10_000)).toEqual({ deltaSeconds: 0, animationDeltaSeconds: 0 });
  });

  it('reports real elapsed delta while clamping the animation step after a long frame', () => {
    const delta = repositoryUniverseFrameDelta(1_000, 6_000);
    expect(delta.deltaSeconds).toBe(5);
    expect(delta.animationDeltaSeconds).toBeCloseTo(0.05, 10);
  });

  it('takes the shortest angle path across negative and positive pi', () => {
    expect(shortestAngleDelta(Math.PI - 0.05, -Math.PI + 0.05)).toBeCloseTo(0.1, 10);
    expect(shortestAngleDelta(-Math.PI + 0.05, Math.PI - 0.05)).toBeCloseTo(-0.1, 10);
  });

  it('retargets an interrupted transition from its current interpolated camera', () => {
    const firstStep = stepRepositoryUniverseCamera(initialCamera, focusedCamera, 0.08);
    const replacement = { ...focusedCamera, theta: -2.4, radius: 360, target: { x: -90, y: 10, z: -120 } };
    const retargeted = stepRepositoryUniverseCamera(firstStep, replacement, 1 / 60);

    expect(retargeted.radius).toBeLessThan(firstStep.radius);
    expect(retargeted.radius).toBeGreaterThan(replacement.radius);
    expect(Math.abs(shortestAngleDelta(firstStep.theta, retargeted.theta))).toBeLessThan(
      Math.abs(shortestAngleDelta(initialCamera.theta, replacement.theta)),
    );
  });

  it('does not settle merely because a focus target was assigned', () => {
    const request = createRepositoryUniverseFocusRequest(null, 'file:first');
    expect(request.consecutiveSettledFrames).toBe(0);
    expect(repositoryUniverseFocusCanSettle(request, request.generation)).toBe(false);
  });

  it('settles once only after consecutive converged frames', () => {
    const request = createRepositoryUniverseFocusRequest(null, 'file:first');
    let completions = 0;
    for (let frame = 0; frame < REPOSITORY_UNIVERSE_SETTLED_FRAME_COUNT + 3; frame += 1) {
      request.consecutiveSettledFrames = nextRepositoryUniverseSettledFrameCount(request.consecutiveSettledFrames, true);
      if (repositoryUniverseFocusCanSettle(request, request.generation) && completions === 0) completions += 1;
    }
    expect(completions).toBe(1);
  });

  it('invalidates an obsolete settlement when focus is retargeted', () => {
    const first = createRepositoryUniverseFocusRequest(null, 'file:first');
    first.consecutiveSettledFrames = REPOSITORY_UNIVERSE_SETTLED_FRAME_COUNT;
    const replacement = createRepositoryUniverseFocusRequest(first, 'file:second');

    expect(repositoryUniverseFocusCanSettle(first, replacement.generation)).toBe(false);
    expect(repositoryUniverseFocusCanSettle(replacement, replacement.generation)).toBe(false);
    expect(repositoryUniverseCameraTargetMatches(focusedCamera, { ...focusedCamera, target: { x: 121, y: -40, z: 65 } })).toBe(false);
  });

  it('applies final camera values immediately for reduced motion', () => {
    expect(stepRepositoryUniverseCamera(initialCamera, focusedCamera, 0, true)).toEqual(focusedCamera);
  });

  it('interpolates node scale toward hover emphasis without snapping', () => {
    const next = stepRepositoryUniverseVisualScalar(1, 1.58, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.hover, 1 / 60);
    expect(next).toBeGreaterThan(1);
    expect(next).toBeLessThan(1.58);
  });

  it('reverses hover removal from the current in-flight value', () => {
    const raised = stepRepositoryUniverseVisualScalar(1, 1.58, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.hover, 1 / 60);
    const reversed = stepRepositoryUniverseVisualScalar(raised, 1, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.hover, 1 / 60);
    expect(reversed).toBeLessThan(raised);
    expect(reversed).toBeGreaterThan(1);
  });

  it('interpolates selection from the current hover scale toward the selected target', () => {
    const selectedTarget = repositoryUniverseNodeScaleTarget({ ...baseNodePriority, selected: true });
    const next = stepRepositoryUniverseVisualScalar(1.42, selectedTarget, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.selection, 1 / 60);
    expect(next).toBeGreaterThan(1.42);
    expect(next).toBeLessThan(selectedTarget);
  });

  it('keeps selection above simultaneous route emphasis', () => {
    const state = { ...baseNodePriority, selected: true, routeHighlighted: true };
    expect(repositoryUniverseNodeOpacityTarget(state)).toBe(1);
    expect(repositoryUniverseNodeScaleTarget(state)).toBe(2.18);
    expect(repositoryUniverseNodeHaloOpacityTarget(state)).toBe(0.58);
  });

  it('dims and restores background nodes through intermediate values', () => {
    const dimmed = stepRepositoryUniverseVisualScalar(0.86, 0.3, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.dimOut, 1 / 60);
    const restored = stepRepositoryUniverseVisualScalar(dimmed, 0.86, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.dimIn, 1 / 60);
    expect(dimmed).toBeLessThan(0.86);
    expect(dimmed).toBeGreaterThan(0.3);
    expect(restored).toBeGreaterThan(dimmed);
  });

  it('fades halos to zero before changing semantic visibility', () => {
    const faded = stepRepositoryUniverseVisualScalar(0.25, 0, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.haloOut, 1 / 60);
    expect(repositoryUniverseOpacityVisible(false, faded)).toBe(true);
    expect(repositoryUniverseOpacityVisible(false, 0)).toBe(false);
  });

  it('fades directly selected edges above contextual edges', () => {
    const baseEdge = { visible: true, directlySelected: false, focused: false, relationship: 'imports', evidenceType: 'verified', contextualFocusActive: true };
    expect(repositoryUniverseEdgeOpacityTarget({ ...baseEdge, directlySelected: true })).toBe(0.56);
    expect(repositoryUniverseEdgeOpacityTarget(baseEdge)).toBe(0.08);
    expect(repositoryUniverseEdgeOpacityTarget({ ...baseEdge, visible: false })).toBe(0);
  });

  it('uses the same scalar motion for proposal appearance and disappearance', () => {
    const appeared = stepRepositoryUniverseVisualScalar(0, 0.66, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.proposal, 1 / 60);
    const disappeared = stepRepositoryUniverseVisualScalar(appeared, 0, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.proposal, 1 / 60);
    expect(appeared).toBeGreaterThan(0);
    expect(disappeared).toBeLessThan(appeared);
  });

  it('applies final visual values immediately for reduced motion', () => {
    expect(stepRepositoryUniverseVisualScalar(0.3, 1, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.selection, 0, true)).toBe(1);
    expect(repositoryUniverseVisualScalarActive(1, 1)).toBe(false);
  });

  it('keeps label distance bands stable around exact zoom boundaries', () => {
    expect(repositoryUniverseLabelDistanceBand(720, 'far')).toBe('far');
    expect(repositoryUniverseLabelDistanceBand(719, 'far')).toBe('far');
    expect(repositoryUniverseLabelDistanceBand(421, 'near')).toBe('near');
    expect(repositoryUniverseLabelDistanceBand(420, 'near')).toBe('near');
  });

  it('composes reveal and interaction scale instead of overwriting either layer', () => {
    expect(composeRepositoryUniverseVisualScale(0.42, 2.18)).toBeCloseTo(0.9156, 10);
  });

  it('produces equivalent visual interpolation across 30, 60 and 120 FPS timelines', () => {
    const simulate = (frameRate: number) => {
      let value = 0.3;
      for (let frame = 0; frame < frameRate; frame += 1) {
        value = stepRepositoryUniverseVisualScalar(value, 1, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.selection, 1 / frameRate, false, 0);
      }
      return value;
    };
    expect(simulate(60)).toBeCloseTo(simulate(30), 12);
    expect(simulate(120)).toBeCloseTo(simulate(30), 12);
  });

  it('produces equivalent idle angular movement across frame rates', () => {
    const movement = (frameRate: number) => Array.from({ length: frameRate }, () => idleRotationDelta(1 / frameRate))
      .reduce((total, delta) => total + delta, 0);

    expect(movement(30)).toBeCloseTo(REPOSITORY_UNIVERSE_IDLE_RADIANS_PER_SECOND, 12);
    expect(movement(60)).toBeCloseTo(movement(30), 12);
    expect(movement(120)).toBeCloseTo(movement(30), 12);
  });

  it('does not install diagnostics outside development mode', () => {
    const host = {};
    expect(createRepositoryUniverseDiagnosticsChannel(false, host, emptyDiagnostics())).toBeUndefined();
    expect(REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY in host).toBe(false);
  });

  it('exposes frozen diagnostic snapshots and removes them on disposal', () => {
    const host = {} as Record<string, unknown>;
    const channel = createRepositoryUniverseDiagnosticsChannel(true, host, emptyDiagnostics());
    channel?.update({ renderCalls: 3, triangles: 42, activeVisualInterpolationCount: 7, visualMotionActive: true, settlementState: 'moving' });

    const snapshot = host[REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY] as RepositoryUniverseDiagnosticsSnapshot;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).toMatchObject({ renderCalls: 3, triangles: 42, activeVisualInterpolationCount: 7, visualMotionActive: true, settlementState: 'moving' });
    expect(() => { (snapshot as { renderCalls: number }).renderCalls = 99; }).toThrow();
    expect((host[REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY] as RepositoryUniverseDiagnosticsSnapshot).renderCalls).toBe(3);

    channel?.dispose();
    expect(REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY in host).toBe(false);
  });
});

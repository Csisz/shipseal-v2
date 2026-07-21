import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY,
  REPOSITORY_UNIVERSE_IDLE_RADIANS_PER_SECOND,
  REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP,
  REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES,
  REPOSITORY_UNIVERSE_SETTLED_FRAME_COUNT,
  activateRepositoryUniverseVisualMotion,
  clearRepositoryUniversePointerHover,
  clearRepositoryUniverseRaycastCache,
  composeRepositoryUniverseVisualScale,
  completeRepositoryUniverseVisualMotionFrame,
  createRepositoryUniverseDiagnosticsChannel,
  createRepositoryUniverseFocusRequest,
  createRepositoryUniversePointerPickState,
  createRepositoryUniverseRaycastCache,
  createRepositoryUniverseVisualMotionState,
  createRepositoryUniverseVisualTargetDirtyState,
  consumeRepositoryUniverseHoverRaycast,
  consumeRepositoryUniverseVisualTargetGroups,
  idleRotationDelta,
  markRepositoryUniverseRaycastCacheDirty,
  markRepositoryUniverseVisualTargetsDirty,
  nextRepositoryUniverseSettledFrameCount,
  prepareRepositoryUniverseImmediatePick,
  queueRepositoryUniversePointerMove,
  rebuildRepositoryUniverseRaycastCache,
  repositoryUniverseFocusCanSettle,
  repositoryUniverseCameraTargetMatches,
  repositoryUniverseFrameDelta,
  repositoryUniverseEdgeOpacityTarget,
  repositoryUniverseLabelDistanceBand,
  repositoryUniverseNodeHaloOpacityTarget,
  repositoryUniverseNodeOpacityTarget,
  repositoryUniverseNodeScaleTarget,
  repositoryUniverseOpacityVisible,
  repositoryUniverseVisualTargetGroupsForDependency,
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
    visualTargetRecalculationCount: 0,
    visualTargetRecalculationsPerSecond: 0,
    pointerMoveEventCount: 0,
    hoverRaycastCount: 0,
    hoverRaycastsPerSecond: 0,
    cachedRaycastObjectCount: 0,
    raycastCacheRebuildCount: 0,
    visualTargetsDirty: false,
    hoverRaycastPending: false,
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

  it('calculates initial visual targets once', () => {
    const dirty = createRepositoryUniverseVisualTargetDirtyState();
    expect(consumeRepositoryUniverseVisualTargetGroups(dirty)).toBe(REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.all);
    expect(dirty.recalculationCount).toBe(1);
  });

  it('does not recalculate visual targets on an unchanged idle frame', () => {
    const dirty = createRepositoryUniverseVisualTargetDirtyState();
    consumeRepositoryUniverseVisualTargetGroups(dirty);
    expect(consumeRepositoryUniverseVisualTargetGroups(dirty)).toBe(REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.none);
    expect(dirty.recalculationCount).toBe(1);
  });

  it('marks only node and label targets dirty for hover and search changes', () => {
    const expected = REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryNodes
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.nodeLabels;
    expect(repositoryUniverseVisualTargetGroupsForDependency('hovered-node')).toBe(expected);
    expect(repositoryUniverseVisualTargetGroupsForDependency('search-membership')).toBe(expected);
  });

  it('marks cluster, edge, node and label targets dirty for selection and cluster focus', () => {
    const expected = REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.clusters
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryEdges
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryNodes
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.nodeLabels;
    expect(repositoryUniverseVisualTargetGroupsForDependency('selected-node')).toBe(expected);
    expect(repositoryUniverseVisualTargetGroupsForDependency('focused-cluster')).toBe(expected);
  });

  it('marks route-node and route-edge dependent targets dirty together', () => {
    const routeGroups = repositoryUniverseVisualTargetGroupsForDependency('route-membership');
    expect(routeGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryEdges).not.toBe(0);
    expect(routeGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryNodes).not.toBe(0);
    expect(routeGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.nodeLabels).not.toBe(0);
  });

  it('marks proposal nodes and edges dirty for mode, domain, selection and exclusion changes', () => {
    const expected = REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.proposalEdges
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.proposalNodes;
    expect(repositoryUniverseVisualTargetGroupsForDependency('proposal-visibility')).toBe(expected);
    expect(repositoryUniverseVisualTargetGroupsForDependency('proposal-selection')).toBe(expected);
  });

  it('accumulates explicit dirty groups without opaque state comparison', () => {
    const dirty = createRepositoryUniverseVisualTargetDirtyState(REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.none);
    markRepositoryUniverseVisualTargetsDirty(dirty, repositoryUniverseVisualTargetGroupsForDependency('visible-node-membership'));
    markRepositoryUniverseVisualTargetsDirty(dirty, repositoryUniverseVisualTargetGroupsForDependency('visible-edge-membership'));
    expect(consumeRepositoryUniverseVisualTargetGroups(dirty)).toBe(
      REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryNodes
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.nodeLabels
      | REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryEdges,
    );
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
    const dirty = createRepositoryUniverseVisualTargetDirtyState(REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.none);
    markRepositoryUniverseVisualTargetsDirty(dirty, repositoryUniverseVisualTargetGroupsForDependency('reduced-motion'));
    expect(consumeRepositoryUniverseVisualTargetGroups(dirty)).toBe(REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.all);
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

  it('coalesces multiple pointer moves into one hover raycast using the latest coordinates', () => {
    const pointer = createRepositoryUniversePointerPickState();
    queueRepositoryUniversePointerMove(pointer, -0.8, 0.6);
    queueRepositoryUniversePointerMove(pointer, 0.1, -0.2);
    queueRepositoryUniversePointerMove(pointer, 0.75, -0.45);

    expect(consumeRepositoryUniverseHoverRaycast(pointer)).toEqual({ x: 0.75, y: -0.45 });
    expect(consumeRepositoryUniverseHoverRaycast(pointer)).toBeNull();
    expect(pointer.pointerMoveEventCount).toBe(3);
    expect(pointer.hoverRaycastCount).toBe(1);
  });

  it('clears a pending hover and current hovered node on pointer leave', () => {
    const pointer = createRepositoryUniversePointerPickState();
    pointer.hoveredNodeId = 'file:hovered';
    queueRepositoryUniversePointerMove(pointer, 0.4, 0.2);

    expect(clearRepositoryUniversePointerHover(pointer)).toBe(true);
    expect(pointer.pending).toBe(false);
    expect(pointer.hoveredNodeId).toBeNull();
  });

  it('uses an immediate click position and cancels a stale pending hover pick', () => {
    const pointer = createRepositoryUniversePointerPickState();
    queueRepositoryUniversePointerMove(pointer, -0.9, -0.9);

    expect(prepareRepositoryUniverseImmediatePick(pointer, 0.3, 0.5)).toEqual({ x: 0.3, y: 0.5 });
    expect(pointer.pending).toBe(false);
    expect(consumeRepositoryUniverseHoverRaycast(pointer)).toBeNull();
  });

  it('rebuilds the raycast cache when visibility membership changes', () => {
    const first = { id: 'first', visible: true, disposed: false };
    const second = { id: 'second', visible: false, disposed: false };
    const candidates = [first, second];
    const cache = createRepositoryUniverseRaycastCache<(typeof candidates)[number]>();
    const eligible = (candidate: (typeof candidates)[number]) => candidate.visible && !candidate.disposed;

    expect(rebuildRepositoryUniverseRaycastCache(cache, candidates, eligible)).toBe(true);
    expect(cache.objects.map(candidate => candidate.id)).toEqual(['first']);
    second.visible = true;
    markRepositoryUniverseRaycastCacheDirty(cache);
    expect(rebuildRepositoryUniverseRaycastCache(cache, candidates, eligible)).toBe(true);
    expect(cache.objects.map(candidate => candidate.id)).toEqual(['first', 'second']);
  });

  it('does not rebuild the raycast cache when eligibility is unchanged', () => {
    const candidates = [{ id: 'node', visible: true, disposed: false }];
    const cache = createRepositoryUniverseRaycastCache<(typeof candidates)[number]>();
    const eligible = (candidate: (typeof candidates)[number]) => candidate.visible && !candidate.disposed;
    rebuildRepositoryUniverseRaycastCache(cache, candidates, eligible);

    expect(rebuildRepositoryUniverseRaycastCache(cache, candidates, eligible)).toBe(false);
    expect(cache.rebuildCount).toBe(1);
  });

  it('does not retain hidden or disposed objects in the raycast cache and clears on disposal', () => {
    const candidates = [
      { id: 'visible', visible: true, disposed: false },
      { id: 'hidden', visible: false, disposed: false },
      { id: 'disposed', visible: true, disposed: true },
    ];
    const cache = createRepositoryUniverseRaycastCache<(typeof candidates)[number]>();
    rebuildRepositoryUniverseRaycastCache(cache, candidates, candidate => candidate.visible && !candidate.disposed);
    expect(cache.objects.map(candidate => candidate.id)).toEqual(['visible']);

    clearRepositoryUniverseRaycastCache(cache);
    expect(cache.objects).toEqual([]);
  });

  it('deactivates visual interpolation after convergence and reactivates for a new target', () => {
    const visualMotion = createRepositoryUniverseVisualMotionState(true);
    expect(completeRepositoryUniverseVisualMotionFrame(visualMotion, 0)).toBe(false);
    expect(visualMotion.active).toBe(false);

    activateRepositoryUniverseVisualMotion(visualMotion);
    expect(visualMotion.active).toBe(true);
    expect(completeRepositoryUniverseVisualMotionFrame(visualMotion, 4)).toBe(true);
  });

  it('does not install diagnostics outside development mode', () => {
    const host = {};
    expect(createRepositoryUniverseDiagnosticsChannel(false, host, emptyDiagnostics())).toBeUndefined();
    expect(REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY in host).toBe(false);
  });

  it('exposes frozen diagnostic snapshots and removes them on disposal', () => {
    const host = {} as Record<string, unknown>;
    const channel = createRepositoryUniverseDiagnosticsChannel(true, host, emptyDiagnostics());
    channel?.update({
      renderCalls: 3,
      triangles: 42,
      activeVisualInterpolationCount: 7,
      visualMotionActive: true,
      pointerMoveEventCount: 12,
      hoverRaycastCount: 3,
      visualTargetRecalculationCount: 5,
      cachedRaycastObjectCount: 18,
      settlementState: 'moving',
    });

    const snapshot = host[REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY] as RepositoryUniverseDiagnosticsSnapshot;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).toMatchObject({
      renderCalls: 3,
      triangles: 42,
      activeVisualInterpolationCount: 7,
      visualMotionActive: true,
      pointerMoveEventCount: 12,
      hoverRaycastCount: 3,
      visualTargetRecalculationCount: 5,
      cachedRaycastObjectCount: 18,
      settlementState: 'moving',
    });
    expect(() => { (snapshot as { renderCalls: number }).renderCalls = 99; }).toThrow();
    expect((host[REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY] as RepositoryUniverseDiagnosticsSnapshot).renderCalls).toBe(3);

    channel?.dispose();
    expect(REPOSITORY_UNIVERSE_DIAGNOSTIC_PROPERTY in host).toBe(false);
  });
});

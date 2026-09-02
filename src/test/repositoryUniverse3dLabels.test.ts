import { describe, expect, it } from 'vitest';
import { repositoryUniverseLabelPriority, repositoryUniverseNodeBaseColor, repositoryUniverseNodeDisplayLabel, repositoryUniverseProposalDisplayLabel, repositoryUniverseProposalLabelVisible, repositoryUniverseRevealStartCamera, repositoryUniverseWheelCameraState } from '@/components/agentready/RepositoryUniverse3D';
import { REPOSITORY_UNIVERSE_REVEAL_MS, repositoryUniverseRevealLayer, repositoryUniverseRevealProgress } from '@/components/agentready/result-workspace/universe/repositoryUniverseMotion';
import { REPOSITORY_UNIVERSE_CLUSTER_PALETTE, brightenClusterColor, repositoryUniverseClusterToken, repositoryUniverseFocusCameraState, repositoryUniverseInspectorAwareLookTarget, repositoryUniverseRendererTokens } from '@/lib/workspace/repositoryUniverseVisual';
import type { RepositoryUniverseNode } from '@/lib/workspace';

function node(overrides: Partial<RepositoryUniverseNode>) {
  return {
    id: 'node:unknown',
    label: 'Unknown',
    kind: 'file',
    clusterId: 'cluster:test',
    evidenceType: 'evidence',
    importance: 'supporting',
    radius: 3,
    position: { x: 0, y: 0, z: 0 },
    evidenceItems: [],
    metadata: {},
    ...overrides,
  } as RepositoryUniverseNode;
}

describe('Repository Universe 3D labels', () => {
  it('derives safe labels for repository, folder, file and concept nodes', () => {
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'repo:test', kind: 'repository', label: 'shipseal' }))).toBe('shipseal');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'folder:src', kind: 'folder', label: 'src', path: 'src' }))).toBe('src');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'file:readme', kind: 'file', label: 'README.md', path: 'README.md' }))).toBe('README.md');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'concept:context', kind: 'concept', label: 'Ignored generated context' }))).toBe('Ignored generated context');
  });

  it('falls back to path, id and a final unknown label without requiring a global label variable', () => {
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'file:path', label: '', path: 'src/App.tsx' }))).toBe('App.tsx');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'concept:no-label', label: '', path: '' }))).toBe('concept:no-label');
    expect(repositoryUniverseNodeDisplayLabel({ id: '', label: '', path: '' })).toBe('Unknown repository entity');
  });

  it('uses existing proposal identity while keeping Proposed as secondary state', () => {
    expect(repositoryUniverseProposalDisplayLabel(
      { label: 'Testing strategy', artifactPath: '04-testing/TEST_STRATEGY.md' },
    )).toBe('Testing strategy');
    expect(repositoryUniverseProposalDisplayLabel(
      { label: 'Proposed', artifactPath: '01-agent-instructions/AGENTS.md' },
    )).toBe('AGENTS.md');
    expect(repositoryUniverseProposalDisplayLabel(
      { label: '', artifactPath: '' },
      { title: 'Architecture memory', artifactActions: [] },
    )).toBe('Architecture memory');
  });

  it('keeps priority labels visible and deterministically reduces ordinary proposal labels', () => {
    expect(repositoryUniverseLabelPriority({ selected: true })).toBeGreaterThan(repositoryUniverseLabelPriority({ searched: true }));
    expect(repositoryUniverseLabelPriority({ searched: true })).toBeGreaterThan(repositoryUniverseLabelPriority({ route: true }));
    expect(repositoryUniverseLabelPriority({ selectedProposal: true })).toBeGreaterThan(repositoryUniverseLabelPriority({ activeDomain: true }));
    expect(repositoryUniverseProposalLabelVisible({ selected: true, cameraRadius: 1200, priorityIndex: 9 })).toBe(true);
    expect(repositoryUniverseProposalLabelVisible({ activeDomain: true, cameraRadius: 400, priorityIndex: 7 })).toBe(true);
    expect(repositoryUniverseProposalLabelVisible({ cameraRadius: 500, priorityIndex: 1 })).toBe(false);
    expect(repositoryUniverseProposalLabelVisible({ cameraRadius: 500, priorityIndex: 3 })).toBe(true);
    expect(repositoryUniverseProposalLabelVisible({ hasSelectedProposal: true, cameraRadius: 300, priorityIndex: 0 })).toBe(false);
  });

  it('keeps Repository Universe colors tied to stable cluster membership', () => {
    const documentation = node({ clusterId: 'cluster:documentation', metadata: { category: 'documentation' } });
    const documentationFolder = node({ kind: 'folder', clusterId: 'cluster:documentation', metadata: { category: 'documentation' } });
    const memory = node({ clusterId: 'cluster:project-memory', metadata: { category: 'agent-instruction' } });

    expect(repositoryUniverseClusterToken('cluster:documentation')).toEqual(repositoryUniverseClusterToken('cluster:documentation'));
    expect(repositoryUniverseNodeBaseColor(documentation)).toBe(repositoryUniverseNodeBaseColor(documentationFolder));
    expect(repositoryUniverseNodeBaseColor(documentation)).not.toBe(repositoryUniverseNodeBaseColor(memory));
    expect(brightenClusterColor(repositoryUniverseNodeBaseColor(documentation), 0.44)).not.toBe(0xf8fafc);
    expect(repositoryUniverseNodeBaseColor(node({ clusterId: 'cluster:documentation', evidenceType: 'heuristic', metadata: { category: 'documentation' } }))).not.toBe(repositoryUniverseNodeBaseColor(documentation));
  });

  it('provides intentionally distinct light and dark renderer configurations', () => {
    const light = repositoryUniverseRendererTokens('light');
    const dark = repositoryUniverseRendererTokens('dark');

    expect(light.mode).toBe('light');
    expect(dark.mode).toBe('dark');
    expect(light.background).not.toBe(dark.background);
    expect(light.starOpacity).toBeLessThan(dark.starOpacity);
    expect(light.fogDensity).toBeLessThan(dark.fogDensity);
    expect(light.relationshipEdge).not.toBe(dark.relationshipEdge);
    expect(light.route).not.toBe(dark.route);
    expect(light.nodeEmissivePrimary).toBeLessThan(dark.nodeEmissivePrimary);
    expect(light.edgeOpacityBase).toBeGreaterThan(dark.edgeOpacityBase);
    expect(light.edgeOpacitySelected).toBeGreaterThan(light.edgeOpacityBase);
    expect(light.edgeOpacityFocused).toBeGreaterThan(light.edgeOpacityBase);
    expect(light.nodeOpacityBase).toBeGreaterThan(dark.nodeOpacityBase);
    expect(light.selected).not.toBe(light.search);
    expect(light.selected).not.toBe(light.route);
    expect(light.search).not.toBe(light.route);
    expect(light.haloAdditive).toBe(false);
    expect(dark.haloAdditive).toBe(true);
    expect(dark.background).toBe(0x000106);
    expect(dark.starOpacity).toBe(0.82);
  });

  it('keeps the deterministic cluster palette vivid and distinguishable', () => {
    const keyClusters = [
      'cluster:repository',
      'cluster:documentation',
      'cluster:project-memory',
      'cluster:verification',
      'cluster:ci-workflow',
      'cluster:configuration',
      'cluster:assets',
    ];
    const colors = keyClusters.map(clusterId => repositoryUniverseClusterToken(clusterId).hex);

    expect(new Set(colors).size).toBe(colors.length);
    for (let index = 0; index < colors.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < colors.length; otherIndex += 1) {
        expect(colorDistance(colors[index], colors[otherIndex])).toBeGreaterThan(54);
      }
    }
    expect(new Set(REPOSITORY_UNIVERSE_CLUSTER_PALETTE.map(token => token.hex)).size).toBe(REPOSITORY_UNIVERSE_CLUSTER_PALETTE.length);
  });

  it('starts the cinematic reveal wider without changing the working target and skips it for reduced motion', () => {
    const camera = {
      theta: 0.8,
      phi: 1.12,
      radius: 620,
      target: { x: 24, y: -12, z: 36 },
    };

    const revealStart = repositoryUniverseRevealStartCamera(camera);
    expect(revealStart.radius).toBeGreaterThanOrEqual(camera.radius + 200);
    expect(revealStart.radius).toBeGreaterThan(camera.radius * 1.3);
    expect(revealStart.radius).toBeLessThanOrEqual(1500);
    expect(revealStart.target).toEqual(camera.target);
    expect(revealStart.theta).not.toBe(camera.theta);
    expect(repositoryUniverseRevealStartCamera(camera, false)).toEqual(camera);
  });

  it('reveals repository, landmarks, relationships, then background context inside the fast motion budget', () => {
    const root = node({ id: 'repo:test', kind: 'repository', importance: 'primary' });
    const landmark = node({ id: 'folder:src', kind: 'folder', importance: 'primary' });
    const background = node({ id: 'file:quiet', kind: 'file', importance: 'background' });

    expect(REPOSITORY_UNIVERSE_REVEAL_MS).toBeLessThanOrEqual(550);
    expect(repositoryUniverseRevealLayer(root, root.id)).toBe('repository');
    expect(repositoryUniverseRevealLayer(landmark, root.id)).toBe('landmarks');
    expect(repositoryUniverseRevealLayer(background, root.id)).toBe('context');
    expect(repositoryUniverseRevealProgress(100, 'repository')).toBeGreaterThan(repositoryUniverseRevealProgress(100, 'landmarks'));
    expect(repositoryUniverseRevealProgress(190, 'landmarks')).toBeGreaterThan(repositoryUniverseRevealProgress(190, 'relationships'));
    expect(repositoryUniverseRevealProgress(REPOSITORY_UNIVERSE_REVEAL_MS, 'context')).toBe(1);
    expect(repositoryUniverseRevealProgress(0, 'context', false)).toBe(1);
  });

  it('targets selected nodes without changing orientation and preserves that target for zoom', () => {
    const camera = {
      theta: 0.8,
      phi: 1.12,
      radius: 620,
      target: { x: 0, y: 0, z: 0 },
    };
    const selected = node({ id: 'file:selected', kind: 'file', position: { x: 100, y: 50, z: -80 } });
    const second = node({ id: 'file:second', kind: 'file', position: { x: -120, y: 30, z: 140 } });

    const focused = repositoryUniverseFocusCameraState(camera, selected, 'repo:test');
    expect(focused.theta).toBe(camera.theta);
    expect(focused.phi).toBe(camera.phi);
    expect(focused.radius).toBe(240);
    expect(focused.target).toEqual({ x: 96, y: 39, z: -76.8 });

    const zoomed = { ...focused, radius: 180 };
    expect(zoomed.target).toEqual(focused.target);
    expect(repositoryUniverseFocusCameraState(focused, second, 'repo:test').target).not.toEqual(focused.target);

    const root = node({ id: 'repo:test', kind: 'repository', position: { x: 10, y: 5, z: -8 } });
    const rootFocused = repositoryUniverseFocusCameraState(zoomed, root, 'repo:test');
    expect(rootFocused.radius).toBeGreaterThanOrEqual(560);
    expect(rootFocused.target).toEqual(root.position);
  });

  it('keeps Universe wheel zoom centered on the active camera target', () => {
    const camera = {
      theta: 0.8,
      phi: 1.12,
      radius: 620,
      target: { x: 96, y: 39, z: -76.8 },
    };

    const zoomedIn = repositoryUniverseWheelCameraState(camera, -120);
    const zoomedOut = repositoryUniverseWheelCameraState(camera, 120);
    const fullscreenZoom = repositoryUniverseWheelCameraState(camera, -120, true);

    expect(zoomedIn.radius).toBeLessThan(camera.radius);
    expect(zoomedOut.radius).toBeGreaterThan(camera.radius);
    expect(fullscreenZoom.radius).toBeLessThan(zoomedIn.radius);
    expect(zoomedIn.target).toEqual(camera.target);
    expect(zoomedIn.theta).toBe(camera.theta);
    expect(zoomedIn.phi).toBe(camera.phi);
    expect(repositoryUniverseWheelCameraState({ ...camera, radius: 150 }, -1000).radius).toBe(150);
    expect(repositoryUniverseWheelCameraState({ ...camera, radius: 1500 }, 1000).radius).toBe(1500);
  });

  it('bounds wheel acceleration and only shifts context toward an explicit zoom-in anchor', () => {
    const camera = {
      theta: 0.8,
      phi: 1.12,
      radius: 620,
      target: { x: 0, y: 0, z: 0 },
    };
    const anchor = { x: 180, y: 40, z: -120 };
    const anchoredIn = repositoryUniverseWheelCameraState(camera, -1200, false, anchor);
    const cappedIn = repositoryUniverseWheelCameraState(camera, -140, false, anchor);
    const anchoredOut = repositoryUniverseWheelCameraState(camera, 120, false, anchor);

    expect(anchoredIn).toEqual(cappedIn);
    expect(anchoredIn.target.x).toBeGreaterThan(camera.target.x);
    expect(anchoredIn.target.y).toBeGreaterThan(camera.target.y);
    expect(anchoredIn.target.z).toBeLessThan(camera.target.z);
    expect(anchoredOut.target).toEqual(camera.target);
  });

  it('offsets only the look direction for inspector-aware desktop and mobile framing', () => {
    const camera = {
      theta: 0.8,
      phi: 1.12,
      radius: 240,
      target: { x: 96, y: 39, z: -76.8 },
    };
    const desktopLook = repositoryUniverseInspectorAwareLookTarget(camera, {
      width: 1280,
      height: 800,
      fullscreen: false,
      inspectorOpen: true,
    });
    const mobileLook = repositoryUniverseInspectorAwareLookTarget(camera, {
      width: 390,
      height: 844,
      fullscreen: false,
      inspectorOpen: true,
    });

    expect(desktopLook).not.toEqual(camera.target);
    expect(desktopLook.y).toBe(camera.target.y);
    expect(mobileLook).not.toEqual(camera.target);
    expect(mobileLook.y).toBeLessThan(camera.target.y);
    expect(repositoryUniverseInspectorAwareLookTarget(camera, {
      width: 1280,
      height: 800,
      fullscreen: true,
      inspectorOpen: true,
    })).toEqual(camera.target);
  });
});

function colorDistance(first: number, second: number) {
  const firstRed = (first >> 16) & 255;
  const firstGreen = (first >> 8) & 255;
  const firstBlue = first & 255;
  const secondRed = (second >> 16) & 255;
  const secondGreen = (second >> 8) & 255;
  const secondBlue = second & 255;
  return Math.hypot(firstRed - secondRed, firstGreen - secondGreen, firstBlue - secondBlue);
}

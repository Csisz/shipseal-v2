import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RepositoryTransformationDomainFilter, RepositoryTransformationMode, RepositoryTransformationProposalModel, RepositoryUniverseCluster, RepositoryUniverseEdge, RepositoryUniverseModel, RepositoryUniverseNode, RepositoryUniversePosition } from '@/lib/workspace';
import {
  REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP,
  REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES,
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
  repositoryUniverseCameraConverged,
  repositoryUniverseCameraPosition,
  repositoryUniverseCameraTargetMatches,
  repositoryUniverseFocusCanSettle,
  repositoryUniverseFrameDelta,
  repositoryUniverseEdgeOpacityTarget,
  repositoryUniverseLabelDistanceBand,
  repositoryUniverseNodeEmissiveTarget,
  repositoryUniverseNodeHaloOpacityTarget,
  repositoryUniverseNodeHaloScaleTarget,
  repositoryUniverseNodeOpacityTarget,
  repositoryUniverseNodeScaleTarget,
  repositoryUniverseOpacityVisible,
  repositoryUniverseVisualTargetGroupsForDependency,
  repositoryUniverseVisualScalarActive,
  repositoryUniverseVectorDistance,
  repositoryUniverseViewportMetrics,
  stepRepositoryUniverseCamera,
  stepRepositoryUniverseVisualScalar,
  type RepositoryUniverseFocusRequest,
  type RepositoryUniverseLabelDistanceBand,
  type RepositoryUniverseSettlementState,
} from '@/lib/workspace/repositoryUniverseMotion';
import { brightenClusterColor, repositoryUniverseClusterToken, repositoryUniverseNodeClusterToken, softenClusterColor, blendHex } from '@/lib/workspace/repositoryUniverseVisual';

export interface UniverseCameraState {
  theta: number;
  phi: number;
  radius: number;
  target: RepositoryUniversePosition;
}

interface RepositoryUniverse3DProps {
  model: RepositoryUniverseModel;
  selectedNodeId?: string;
  focusedClusterId?: string | null;
  routeNodeIds?: string[];
  searchMatchIds: string[];
  visibleNodeIds: string[];
  visibleEdgeIds: string[];
  cameraState: UniverseCameraState;
  rotationPaused: boolean;
  reducedMotion: boolean;
  animateIn?: boolean;
  fullscreen?: boolean;
  transformationMode?: RepositoryTransformationMode;
  transformationDomain?: RepositoryTransformationDomainFilter;
  selectedProposalId?: string | null;
  excludedProposalIds?: string[];
  transformation?: RepositoryTransformationProposalModel;
  onCameraStateChange: (state: UniverseCameraState) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectProposal?: (proposalId: string) => void;
  onFocusNodeSettled?: (nodeId: string) => void;
  onSceneSettled?: () => void;
}

type PointerMode = 'orbit' | 'pan';

interface VisualScalarMotion {
  current: number;
  target: number;
}

interface NodeRenderItem {
  node: RepositoryUniverseNode;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  labelTexture: THREE.CanvasTexture;
  baseRadius: number;
  position: THREE.Vector3;
  opacityMotion: VisualScalarMotion;
  scaleMotion: VisualScalarMotion;
  emissiveMotion: VisualScalarMotion;
  haloOpacityMotion: VisualScalarMotion;
  haloScaleMotion: VisualScalarMotion;
  labelOpacityMotion: VisualScalarMotion;
  meshTargetVisible: boolean;
  haloTargetVisible: boolean;
  labelTargetVisible: boolean;
  meshColorTarget: number;
  emissiveColorTarget: number;
  haloColorTarget: number;
  labelScaleWidthTarget: number;
  labelScaleHeightTarget: number;
  selected: boolean;
  hovered: boolean;
  matched: boolean;
  routeHighlighted: boolean;
  connected: boolean;
  focused: boolean;
}

interface EdgeRenderItem {
  edge: RepositoryUniverseEdge;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  opacityMotion: VisualScalarMotion;
  targetVisible: boolean;
  colorTarget: number;
}

interface ClusterRenderItem {
  cluster: RepositoryUniverseCluster;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  opacityMotion: VisualScalarMotion;
  colorTarget: number;
}

interface ProposalRenderItem {
  proposalId: string;
  domain: string;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  labelTexture: THREE.CanvasTexture;
  position: THREE.Vector3;
  opacityMotion: VisualScalarMotion;
  scaleMotion: VisualScalarMotion;
  haloOpacityMotion: VisualScalarMotion;
  labelOpacityMotion: VisualScalarMotion;
  meshTargetVisible: boolean;
  haloTargetVisible: boolean;
  labelTargetVisible: boolean;
}

interface ProposalEdgeRenderItem {
  proposalId: string;
  domain: string;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
  opacityMotion: VisualScalarMotion;
  targetVisible: boolean;
  colorTarget: number;
}

const INITIAL_APPEARANCE_MS = 1400;
const IDLE_ROTATION_DELAY_MS = 3600;
const LAYOUT_SPREAD_XZ = 0.96;
const LAYOUT_SPREAD_Y = 0.78;

export default function RepositoryUniverse3D({
  model,
  selectedNodeId,
  focusedClusterId,
  routeNodeIds = [],
  searchMatchIds,
  visibleNodeIds,
  visibleEdgeIds,
  cameraState,
  rotationPaused,
  reducedMotion,
  animateIn = true,
  fullscreen = false,
  transformationMode = 'current',
  transformationDomain = 'all',
  selectedProposalId,
  excludedProposalIds = [],
  transformation,
  onCameraStateChange,
  onSelectNode,
  onSelectProposal,
  onFocusNodeSettled,
  onSceneSettled,
}: RepositoryUniverse3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStateRef = useRef(cameraState);
  const renderCameraStateRef = useRef(cameraState);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const focusedClusterIdRef = useRef(focusedClusterId);
  const routeNodeIdSetRef = useRef(new Set(routeNodeIds));
  const searchMatchSetRef = useRef(new Set(searchMatchIds));
  const visibleNodeSetRef = useRef(new Set(visibleNodeIds));
  const visibleEdgeSetRef = useRef(new Set(visibleEdgeIds));
  const rotationPausedRef = useRef(rotationPaused);
  const reducedMotionRef = useRef(reducedMotion);
  const animateInRef = useRef(animateIn);
  const fullscreenRef = useRef(fullscreen);
  const resizeSceneRef = useRef<() => void>(() => undefined);
  const transformationModeRef = useRef(transformationMode);
  const transformationDomainRef = useRef(transformationDomain);
  const selectedProposalIdRef = useRef(selectedProposalId);
  const excludedProposalSetRef = useRef(new Set(excludedProposalIds));
  const visualTargetDirtyStateRef = useRef(createRepositoryUniverseVisualTargetDirtyState());
  const onCameraStateChangeRef = useRef(onCameraStateChange);
  const onSelectNodeRef = useRef(onSelectNode);
  const onSelectProposalRef = useRef(onSelectProposal);
  const onFocusNodeSettledRef = useRef(onFocusNodeSettled);
  const onSceneSettledRef = useRef(onSceneSettled);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [settled, setSettled] = useState(reducedMotion);

  const visibleNodeSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds]);
  const visibleEdgeSet = useMemo(() => new Set(visibleEdgeIds), [visibleEdgeIds]);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('selected-node'),
    );
  }, [selectedNodeId]);

  useEffect(() => {
    focusedClusterIdRef.current = focusedClusterId;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('focused-cluster'),
    );
  }, [focusedClusterId]);

  useEffect(() => {
    routeNodeIdSetRef.current = new Set(routeNodeIds);
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('route-membership'),
    );
  }, [routeNodeIds]);

  useEffect(() => {
    searchMatchSetRef.current = new Set(searchMatchIds);
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('search-membership'),
    );
  }, [searchMatchIds]);

  useEffect(() => {
    visibleNodeSetRef.current = visibleNodeSet;
    // Filter changes reach the renderer through the canonical visible-node membership.
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('visible-node-membership'),
    );
  }, [visibleNodeSet]);

  useEffect(() => {
    visibleEdgeSetRef.current = visibleEdgeSet;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('visible-edge-membership'),
    );
  }, [visibleEdgeSet]);

  useEffect(() => {
    rotationPausedRef.current = rotationPaused;
  }, [rotationPaused]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('reduced-motion'),
    );
    if (reducedMotion) setSettled(true);
  }, [reducedMotion]);

  useEffect(() => {
    fullscreenRef.current = fullscreen;
    const frameId = requestAnimationFrame(() => resizeSceneRef.current());
    return () => cancelAnimationFrame(frameId);
  }, [fullscreen]);

  useEffect(() => {
    animateInRef.current = animateIn;
    // Reveal currently owns spatial position, but remains an explicit all-target dependency.
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('initial-reveal'),
    );
    if (!animateIn) setSettled(true);
  }, [animateIn]);

  useEffect(() => {
    transformationModeRef.current = transformationMode;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('proposal-visibility'),
    );
  }, [transformationMode]);

  useEffect(() => {
    transformationDomainRef.current = transformationDomain;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('proposal-visibility'),
    );
  }, [transformationDomain]);

  useEffect(() => {
    selectedProposalIdRef.current = selectedProposalId;
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('proposal-selection'),
    );
  }, [selectedProposalId]);

  useEffect(() => {
    excludedProposalSetRef.current = new Set(excludedProposalIds);
    markRepositoryUniverseVisualTargetsDirty(
      visualTargetDirtyStateRef.current,
      repositoryUniverseVisualTargetGroupsForDependency('proposal-selection'),
    );
  }, [excludedProposalIds]);

  useEffect(() => {
    onCameraStateChangeRef.current = onCameraStateChange;
  }, [onCameraStateChange]);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    onSelectProposalRef.current = onSelectProposal;
  }, [onSelectProposal]);

  useEffect(() => {
    onFocusNodeSettledRef.current = onFocusNodeSettled;
  }, [onFocusNodeSettled]);

  useEffect(() => {
    onSceneSettledRef.current = onSceneSettled;
  }, [onSceneSettled]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (typeof window.WebGLRenderingContext === 'undefined') {
      setWebglUnavailable(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    setWebglUnavailable(false);
    setSettled(reducedMotionRef.current || !animateInRef.current);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 8000);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 3;
    const pointer = new THREE.Vector2();
    const nodeItems = new Map<string, NodeRenderItem>();
    const edgeItems = new Map<string, EdgeRenderItem>();
    const clusterItems = new Map<string, ClusterRenderItem>();
    const proposalItems = new Map<string, ProposalRenderItem>();
    const proposalEdgeItems = new Map<string, ProposalEdgeRenderItem>();
    const sphereGeometryCache = new Map<number, THREE.SphereGeometry>();
    const raycastCandidates: THREE.Object3D[] = [];
    const raycastCache = createRepositoryUniverseRaycastCache<THREE.Object3D>();
    const pointerPickState = createRepositoryUniversePointerPickState();
    const visualMotionState = createRepositoryUniverseVisualMotionState(true);
    const visualTargetDirtyState = createRepositoryUniverseVisualTargetDirtyState();
    visualTargetDirtyStateRef.current = visualTargetDirtyState;
    let frameId = 0;
    let disposed = false;
    let pointerMode: PointerMode | null = null;
    let pointerStart = { x: 0, y: 0 };
    let pointerLast = { x: 0, y: 0 };
    let pointerMoved = false;
    let userInteractedAt = performance.now();
    let localSettled = reducedMotionRef.current || !animateInRef.current;
    let lastPublishedCamera = cameraStateRef.current;
    let lastFrameTimestamp: number | null = null;
    let fpsWindowStartedAt: number | null = null;
    let fpsWindowFrameCount = 0;
    let approximateFps = 0;
    let lastFocusRequest: RepositoryUniverseFocusRequest | null = null;
    let pendingFocusRequest: RepositoryUniverseFocusRequest | null = null;
    let pendingFocusTarget: UniverseCameraState | null = null;
    let focusSettlementState: RepositoryUniverseSettlementState = 'idle';
    let labelDistanceBand: RepositoryUniverseLabelDistanceBand = repositoryUniverseLabelDistanceBand(cameraStateRef.current.radius);
    let activeVisualInterpolationCount = 0;
    let targetRecalculationWindowStartedAt: number | null = null;
    let targetRecalculationsAtWindowStart = 0;
    let hoverRaycastsAtWindowStart = 0;
    let visualTargetRecalculationsPerSecond = 0;
    let hoverRaycastsPerSecond = 0;
    const startedAt = performance.now();

    renderer.setClearColor(0x050914, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fullscreenRef.current ? 1.5 : 1.35));
    const diagnostics = import.meta.env.DEV
      ? createRepositoryUniverseDiagnosticsChannel(true, window, {
        renderCalls: 0,
        triangles: 0,
        lines: 0,
        approximateFps: 0,
        visibleNodeCount: visibleNodeSetRef.current.size,
        visibleEdgeCount: visibleEdgeSetRef.current.size,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        devicePixelRatio: renderer.getPixelRatio(),
        fullscreen: fullscreenRef.current,
        resizeCount: 0,
        selectedNodeId: selectedNodeIdRef.current || null,
        cameraTheta: renderCameraStateRef.current.theta,
        cameraPhi: renderCameraStateRef.current.phi,
        cameraRadius: renderCameraStateRef.current.radius,
        cameraTargetX: renderCameraStateRef.current.target.x,
        cameraTargetY: renderCameraStateRef.current.target.y,
        cameraTargetZ: renderCameraStateRef.current.target.z,
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
        visualTargetsDirty: true,
        hoverRaycastPending: false,
        settlementState: focusSettlementState,
      })
      : undefined;

    let currentAnimationDeltaSeconds = 0;
    const visualScalar = (initial: number): VisualScalarMotion => ({ current: initial, target: initial });
    const stepVisualScalar = (motion: VisualScalarMotion, rate: number) => {
      motion.current = stepRepositoryUniverseVisualScalar(
        motion.current,
        motion.target,
        rate,
        currentAnimationDeltaSeconds,
        reducedMotionRef.current,
      );
      return repositoryUniverseVisualScalarActive(motion.current, motion.target);
    };

    scene.add(new THREE.AmbientLight(0x8fb9ff, 1.25));
    const directional = new THREE.DirectionalLight(0xd8f7ff, 1.65);
    directional.position.set(220, 360, 180);
    scene.add(directional);
    const centerGlow = new THREE.PointLight(0x6ee7ff, 1.05, 760);
    centerGlow.position.set(0, 0, 0);
    scene.add(centerGlow);

    const sphereFor = (radius: number) => {
      const rounded = Math.round(radius * 10) / 10;
      const existing = sphereGeometryCache.get(rounded);
      if (existing) return existing;
      const segments = rounded > 5 ? 20 : 14;
      const geometry = new THREE.SphereGeometry(rounded, segments, Math.max(10, segments - 4));
      sphereGeometryCache.set(rounded, geometry);
      return geometry;
    };

    const nodeById = new Map(model.nodes.map(node => [node.id, node]));
    const relatedNodeIdsByNodeId = new Map<string, Set<string>>();
    const addRelatedNode = (sourceId: string, targetId: string) => {
      const existing = relatedNodeIdsByNodeId.get(sourceId);
      if (existing) {
        existing.add(targetId);
        return;
      }
      relatedNodeIdsByNodeId.set(sourceId, new Set([targetId]));
    };
    const visualPositionByNodeId = new Map<string, THREE.Vector3>();
    for (const node of model.nodes) {
      visualPositionByNodeId.set(node.id, visualPositionFor(node.position, node.id === model.rootNodeId));
    }

    for (const cluster of model.clusters) {
      if (cluster.id === 'cluster:repository') continue;
      const ringRadius = Math.max(48, Math.min(190, cluster.radius * 0.94));
      const geometry = new THREE.RingGeometry(ringRadius * 0.82, ringRadius, 96);
      const material = new THREE.MeshBasicMaterial({
        color: colorForCluster(cluster),
        transparent: true,
        opacity: 0.018,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(geometry, material);
      const position = visualPositionFor(cluster.position);
      ring.position.set(position.x, position.y - 10, position.z);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      clusterItems.set(cluster.id, {
        cluster,
        ring,
        opacityMotion: visualScalar(material.opacity),
        colorTarget: colorForCluster(cluster),
      });
    }

    for (const edge of model.edges) {
      const source = visualPositionByNodeId.get(edge.source);
      const target = visualPositionByNodeId.get(edge.target);
      if (!source || !target) continue;
      const material = new THREE.LineBasicMaterial({
        color: colorForEdge(edge),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      });
      const geometry = new THREE.BufferGeometry().setFromPoints([source, target]);
      const line = new THREE.Line(geometry, material);
      edgeItems.set(edge.id, {
        edge,
        line,
        opacityMotion: visualScalar(material.opacity),
        targetVisible: true,
        colorTarget: colorForEdge(edge),
      });
      scene.add(line);
      addRelatedNode(edge.source, edge.target);
      addRelatedNode(edge.target, edge.source);
    }

    for (const proposal of transformation?.proposals || []) {
      for (const proposedNode of proposal.graphChanges.proposedNodes) {
        const position = visualPositionFor(proposedNode.position);
        const baseColor = repositoryUniverseClusterToken(proposedNode.clusterId).hex;
        const material = new THREE.MeshStandardMaterial({
          color: brightenClusterColor(baseColor, 0.2),
          emissive: baseColor,
          emissiveIntensity: 0.38,
          metalness: 0.08,
          roughness: 0.52,
          transparent: true,
          opacity: 0,
          wireframe: true,
        });
        const mesh = new THREE.Mesh(sphereFor(5.3), material);
        mesh.position.copy(position);
        mesh.userData.proposalId = proposal.id;
        scene.add(mesh);
        mesh.visible = false;
        raycastCandidates.push(mesh);

        const haloMaterial = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const halo = new THREE.Mesh(sphereFor(13.4), haloMaterial);
        halo.position.copy(position);
        scene.add(halo);
        halo.visible = false;

        const { sprite: label, material: labelMaterial, texture } = labelSprite('Proposed', '#e0faff');
        label.position.set(position.x, position.y + 12, position.z);
        label.scale.set(44, 13, 1);
        scene.add(label);
        label.visible = false;

        proposalItems.set(proposal.id, {
          proposalId: proposal.id,
          domain: proposal.domain,
          mesh,
          halo,
          label,
          labelMaterial,
          labelTexture: texture,
          position,
          opacityMotion: visualScalar(material.opacity),
          scaleMotion: visualScalar(1),
          haloOpacityMotion: visualScalar(haloMaterial.opacity),
          labelOpacityMotion: visualScalar(labelMaterial.opacity),
          meshTargetVisible: false,
          haloTargetVisible: false,
          labelTargetVisible: false,
        });
      }

      for (const edge of proposal.graphChanges.proposedEdges) {
        const source = proposal.graphChanges.proposedNodes.find(node => node.id === edge.source);
        const target = visualPositionByNodeId.get(edge.target);
        if (!source || !target) continue;
        const sourcePosition = visualPositionFor(source.position);
        const material = new THREE.LineDashedMaterial({
          color: 0x9bdcf3,
          transparent: true,
          opacity: 0,
          dashSize: 9,
          gapSize: 7,
          depthWrite: false,
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([sourcePosition, target]);
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        scene.add(line);
        line.visible = false;
        proposalEdgeItems.set(edge.id, {
          proposalId: proposal.id,
          domain: proposal.domain,
          line,
          opacityMotion: visualScalar(material.opacity),
          targetVisible: false,
          colorTarget: 0x9bdcf3,
        });
      }
    }

    for (const node of model.nodes) {
      const displayLabel = repositoryUniverseNodeDisplayLabel(node);
      const baseRadius = nodeRadius(node);
      const position = visualPositionByNodeId.get(node.id) || visualPositionFor(node.position, node.id === model.rootNodeId);
      const material = new THREE.MeshStandardMaterial({
        color: colorForNode(node),
        emissive: emissiveForNode(node),
        emissiveIntensity: node.importance === 'primary' ? 0.38 : 0.11,
        metalness: 0.18,
        roughness: 0.38,
        transparent: true,
        opacity: 0.9,
        wireframe: node.evidenceType === 'missing' || node.kind === 'recommendation',
      });
      const mesh = new THREE.Mesh(sphereFor(baseRadius), material);
      mesh.position.copy(position);
      mesh.userData.nodeId = node.id;
      scene.add(mesh);
      raycastCandidates.push(mesh);

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Mesh(sphereFor(baseRadius * 2.25), haloMaterial);
      halo.position.copy(mesh.position);
      scene.add(halo);
      halo.visible = false;

      const { sprite: label, material: labelMaterial, texture } = labelSprite(shortLabel(displayLabel), labelColorForNode(node));
      label.position.set(position.x, position.y + baseRadius + 5, position.z);
      label.scale.set(node.kind === 'repository' ? 70 : 42, node.kind === 'repository' ? 20 : 14, 1);
      scene.add(label);
      label.visible = false;

      nodeItems.set(node.id, {
        node,
        mesh,
        halo,
        label,
        labelMaterial,
        labelTexture: texture,
        baseRadius,
        position,
        opacityMotion: visualScalar(material.opacity),
        scaleMotion: visualScalar(1),
        emissiveMotion: visualScalar(material.emissiveIntensity),
        haloOpacityMotion: visualScalar(haloMaterial.opacity),
        haloScaleMotion: visualScalar(1),
        labelOpacityMotion: visualScalar(labelMaterial.opacity),
        meshTargetVisible: true,
        haloTargetVisible: false,
        labelTargetVisible: false,
        meshColorTarget: colorForNode(node),
        emissiveColorTarget: emissiveForNode(node),
        haloColorTarget: 0x67e8f9,
        labelScaleWidthTarget: node.kind === 'repository' ? 70 : 42,
        labelScaleHeightTarget: node.kind === 'repository' ? 20 : 14,
        selected: false,
        hovered: false,
        matched: false,
        routeHighlighted: false,
        connected: false,
        focused: true,
      });
    }

    let resizeCount = 0;
    let lastResizeWidth = 0;
    let lastResizeHeight = 0;
    let lastResizePixelRatio = 0;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const { width, height, pixelRatio, aspect } = repositoryUniverseViewportMetrics(
        rect.width,
        rect.height,
        window.devicePixelRatio,
        fullscreenRef.current,
      );
      if (width === lastResizeWidth && height === lastResizeHeight && pixelRatio === lastResizePixelRatio) return;

      if (pixelRatio !== lastResizePixelRatio) renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      lastResizeWidth = width;
      lastResizeHeight = height;
      lastResizePixelRatio = pixelRatio;
      resizeCount += 1;
      diagnostics?.update({
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        devicePixelRatio: renderer.getPixelRatio(),
        fullscreen: fullscreenRef.current,
        resizeCount,
      });
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resizeSceneRef.current = resize;
    resize();

    const publishCamera = (state: UniverseCameraState, force = false) => {
      const clamped = clampCameraState(state);
      cameraStateRef.current = clamped;
      const distance = Math.abs(clamped.radius - lastPublishedCamera.radius)
        + Math.abs(clamped.theta - lastPublishedCamera.theta) * 100
        + Math.abs(clamped.phi - lastPublishedCamera.phi) * 100
        + repositoryUniverseVectorDistance(clamped.target, lastPublishedCamera.target);
      if (force || distance > 5) {
        lastPublishedCamera = clamped;
        onCameraStateChangeRef.current(clamped);
      }
    };

    const applyCamera = (deltaSeconds: number) => {
      const desired = clampCameraState(cameraStateRef.current);
      const current = renderCameraStateRef.current;
      const next = stepRepositoryUniverseCamera(current, desired, deltaSeconds, reducedMotionRef.current);
      renderCameraStateRef.current = next;
      const position = repositoryUniverseCameraPosition(next);
      camera.position.set(position.x, position.y, position.z);
      camera.lookAt(next.target.x, next.target.y, next.target.z);
      return { desired, next };
    };

    const updateFocusSettlement = (desired: UniverseCameraState, next: UniverseCameraState) => {
      const request = pendingFocusRequest;
      if (!request) return;

      if (!pendingFocusTarget || !repositoryUniverseCameraTargetMatches(desired, pendingFocusTarget)) {
        pendingFocusRequest = null;
        pendingFocusTarget = null;
        focusSettlementState = 'interrupted';
        diagnostics?.update({
          programmaticCameraMotionActive: false,
          settlementState: focusSettlementState,
        });
        return;
      }

      if (reducedMotionRef.current) {
        request.consecutiveSettledFrames = Number.POSITIVE_INFINITY;
      } else {
        const converged = repositoryUniverseCameraConverged(next, desired);
        request.consecutiveSettledFrames = nextRepositoryUniverseSettledFrameCount(request.consecutiveSettledFrames, converged);
        focusSettlementState = converged ? 'converging' : 'moving';
      }

      if (!repositoryUniverseFocusCanSettle(request, lastFocusRequest?.generation || 0)) return;
      pendingFocusRequest = null;
      pendingFocusTarget = null;
      focusSettlementState = 'settled';
      diagnostics?.update({
        programmaticCameraMotionActive: false,
        settlementState: focusSettlementState,
      });
      onFocusNodeSettledRef.current?.(request.nodeId);
    };

    const interruptProgrammaticCameraMotion = () => {
      if (!pendingFocusRequest) return;
      pendingFocusRequest = null;
      pendingFocusTarget = null;
      focusSettlementState = 'interrupted';
      const current = clampCameraState(renderCameraStateRef.current);
      publishCamera(current, true);
      diagnostics?.update({
        programmaticCameraMotionActive: false,
        settlementState: focusSettlementState,
      });
    };

    const setPointer = (event: Pick<PointerEvent | MouseEvent, 'clientX' | 'clientY'>) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const rebuildRaycastCacheIfNeeded = () => rebuildRepositoryUniverseRaycastCache(
      raycastCache,
      raycastCandidates,
      object => !disposed && object.visible && object.parent === scene,
    );

    const intersectEntity = (x = pointer.x, y = pointer.y) => {
      pointer.set(x, y);
      rebuildRaycastCacheIfNeeded();
      raycaster.setFromCamera(pointer, camera);
      const intersect = raycaster.intersectObjects(raycastCache.objects, false)[0];
      if (!intersect) return {};
      return {
        nodeId: intersect.object.userData.nodeId as string | undefined,
        proposalId: intersect.object.userData.proposalId as string | undefined,
      };
    };

    const handleDragPointerMove = (event: PointerEvent) => {
      if (pointerMode) {
        const dx = event.clientX - pointerLast.x;
        const dy = event.clientY - pointerLast.y;
        pointerLast = { x: event.clientX, y: event.clientY };
        if (!pointerMoved && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 3) {
          pointerMoved = true;
        }
        const state = cameraStateRef.current;
        if (pointerMode === 'pan') {
          const panScale = state.radius / 980;
          const theta = state.theta;
          publishCamera({
            ...state,
            target: {
              x: state.target.x - Math.cos(theta) * dx * panScale + Math.sin(theta) * dy * panScale * 0.16,
              y: state.target.y + dy * panScale * 0.52,
              z: state.target.z - Math.sin(theta) * dx * panScale - Math.cos(theta) * dy * panScale * 0.16,
            },
          });
        } else {
          publishCamera({
            ...state,
            theta: state.theta - dx * (fullscreenRef.current ? 0.0042 : 0.0032),
            phi: Math.max(0.24, Math.min(Math.PI - 0.24, state.phi - dy * (fullscreenRef.current ? 0.0042 : 0.0032))),
          });
        }
        userInteractedAt = performance.now();
        event.preventDefault();
        return;
      }
    };

    const handleCanvasPointerMove = (event: PointerEvent) => {
      if (pointerMode) return;
      setPointer(event);
      queueRepositoryUniversePointerMove(pointerPickState, pointer.x, pointer.y);
    };

    const clearPointerHover = () => {
      const hadHoveredNode = pointerPickState.hoveredNodeId !== null;
      clearRepositoryUniversePointerHover(pointerPickState);
      if (hadHoveredNode) {
        markRepositoryUniverseVisualTargetsDirty(
          visualTargetDirtyState,
          repositoryUniverseVisualTargetGroupsForDependency('hovered-node'),
        );
      }
    };

    const cleanupDocumentDrag = () => {
      window.removeEventListener('pointermove', handleDragPointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.button !== 2) return;
      interruptProgrammaticCameraMotion();
      setPointer(event);
      prepareRepositoryUniverseImmediatePick(pointerPickState, pointer.x, pointer.y);
      canvas.setPointerCapture?.(event.pointerId);
      pointerMode = event.button === 2 ? 'pan' : 'orbit';
      pointerStart = { x: event.clientX, y: event.clientY };
      pointerLast = pointerStart;
      pointerMoved = false;
      userInteractedAt = performance.now();
      window.addEventListener('pointermove', handleDragPointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp, { passive: false });
      window.addEventListener('pointercancel', handlePointerUp, { passive: false });
      event.preventDefault();
    }

    function handlePointerUp(event: PointerEvent) {
      const mode = pointerMode;
      pointerMode = null;
      cleanupDocumentDrag();
      if (mode === 'orbit' && !pointerMoved) {
        setPointer(event);
        const coordinates = prepareRepositoryUniverseImmediatePick(pointerPickState, pointer.x, pointer.y);
        const { nodeId, proposalId } = intersectEntity(coordinates.x, coordinates.y);
        if (nodeId) onSelectNodeRef.current(nodeId);
        if (proposalId) onSelectProposalRef.current?.(proposalId);
      }
      event.preventDefault();
    }

    const handleWheel = (event: WheelEvent) => {
      interruptProgrammaticCameraMotion();
      const state = cameraStateRef.current;
      const factor = Math.exp(event.deltaY * (fullscreenRef.current ? 0.0009 : 0.00068));
      const nextRadius = Math.max(150, Math.min(1500, state.radius * factor));
      publishCamera({ ...state, radius: nextRadius });
      userInteractedAt = performance.now();
      event.preventDefault();
    };

    const handleDoubleClick = (event: MouseEvent) => {
      setPointer(event);
      const coordinates = prepareRepositoryUniverseImmediatePick(pointerPickState, pointer.x, pointer.y);
      const { nodeId, proposalId } = intersectEntity(coordinates.x, coordinates.y);
      if (proposalId) {
        onSelectProposalRef.current?.(proposalId);
        return;
      }
      const node = nodeId ? nodeById.get(nodeId) : undefined;
      if (!node) return;
      const target = visualPositionByNodeId.get(node.id) || visualPositionFor(node.position, node.id === model.rootNodeId);
      const focusTarget = clampCameraState({
        ...cameraStateRef.current,
        radius: node.kind === 'file' ? 220 : 300,
        target,
      });
      publishCamera(focusTarget, true);
      pendingFocusRequest = createRepositoryUniverseFocusRequest(lastFocusRequest, node.id);
      pendingFocusTarget = focusTarget;
      lastFocusRequest = pendingFocusRequest;
      focusSettlementState = 'moving';
      diagnostics?.update({
        programmaticCameraMotionActive: true,
        settlementState: focusSettlementState,
      });
      onSelectNodeRef.current(node.id);
      if (reducedMotionRef.current) {
        const { desired, next } = applyCamera(0);
        updateFocusSettlement(desired, next);
      }
    };

    let selectedRelatedCacheKey = '';
    let selectedRelatedCache = new Set<string>();
    let selectedRelatedClusterCacheKey = '';
    const selectedRelatedClusterCache = new Set<string>();
    const relatedNodeIdsForSelection = (selectedId?: string) => {
      const cacheKey = selectedId || '';
      if (cacheKey === selectedRelatedCacheKey) return selectedRelatedCache;

      const related = new Set<string>();
      if (selectedId) {
        related.add(selectedId);
        for (const nodeId of relatedNodeIdsByNodeId.get(selectedId) || []) {
          related.add(nodeId);
        }
      }
      selectedRelatedCacheKey = cacheKey;
      selectedRelatedCache = related;
      return related;
    };

    const relatedClusterIdsForSelection = (selectedId: string | undefined, relatedNodeIds: Set<string>) => {
      const cacheKey = selectedId || '';
      if (cacheKey === selectedRelatedClusterCacheKey) return selectedRelatedClusterCache;
      selectedRelatedClusterCache.clear();
      for (const nodeId of relatedNodeIds) {
        const clusterId = nodeItems.get(nodeId)?.node.clusterId;
        if (clusterId) selectedRelatedClusterCache.add(clusterId);
      }
      selectedRelatedClusterCacheKey = cacheKey;
      return selectedRelatedClusterCache;
    };

    const recalculateVisualTargets = (dirtyGroups: number) => {
      const selectedId = selectedNodeIdRef.current;
      const focusedCluster = focusedClusterIdRef.current;
      const routeNodeIds = routeNodeIdSetRef.current;
      const routeActive = routeNodeIds.size > 0;
      const searchMatches = searchMatchSetRef.current;
      const visibleNodes = visibleNodeSetRef.current;
      const visibleEdges = visibleEdgeSetRef.current;
      const mode = transformationModeRef.current;
      const domain = transformationDomainRef.current;
      const selectedProposal = selectedProposalIdRef.current;
      const excludedProposals = excludedProposalSetRef.current;
      const selectedRelated = relatedNodeIdsForSelection(selectedId);
      const selectedClusterId = selectedId ? nodeItems.get(selectedId)?.node.clusterId : null;
      const selectedRelatedClusterIds = relatedClusterIdsForSelection(selectedId, selectedRelated);

      if (dirtyGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.clusters) {
        for (const item of clusterItems.values()) {
          const active = Boolean(focusedCluster && item.cluster.id === focusedCluster) || item.cluster.id === selectedClusterId;
          const related = selectedRelatedClusterIds.has(item.cluster.id);
          item.opacityMotion.target = active
            ? 0.09
            : related
              ? 0.045
              : focusedCluster || selectedId
                ? 0.012
                : 0.022;
          item.colorTarget = colorForCluster(item.cluster, active, related);
        }
      }

      if (dirtyGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryEdges) {
        for (const item of edgeItems.values()) {
          const { edge } = item;
          const directlySelected = Boolean(selectedId && (edge.source === selectedId || edge.target === selectedId));
          const focused = Boolean(focusedCluster && nodeById.get(edge.source)?.clusterId === focusedCluster && nodeById.get(edge.target)?.clusterId === focusedCluster);
          const visible = visibleEdges.has(edge.id);
          item.targetVisible = visible;
          item.opacityMotion.target = repositoryUniverseEdgeOpacityTarget({
            visible,
            directlySelected,
            focused,
            relationship: edge.relationship,
            evidenceType: edge.evidenceType,
            contextualFocusActive: Boolean(selectedId || focusedCluster),
          });
          item.colorTarget = colorForEdge(edge, directlySelected, focused);
        }
      }

      if (dirtyGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.proposalEdges) {
        for (const item of proposalEdgeItems.values()) {
          const visible = mode === 'with-shipseal' && (domain === 'all' || item.domain === domain);
          const selected = selectedProposal === item.proposalId;
          const excluded = excludedProposals.has(item.proposalId);
          item.targetVisible = visible;
          item.opacityMotion.target = !visible ? 0 : excluded ? 0.09 : selected ? 0.56 : 0.26;
          item.colorTarget = selected ? 0xe0faff : 0x9bdcf3;
        }
      }

      const radius = cameraStateRef.current.radius;
      const updateNodeTargets = Boolean(dirtyGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.repositoryNodes);
      const updateLabelTargets = Boolean(dirtyGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.nodeLabels);
      if (updateNodeTargets || updateLabelTargets) {
        for (const item of nodeItems.values()) {
          const { node } = item;
          const visible = visibleNodes.has(node.id);
          if (updateNodeTargets) {
            item.selected = node.id === selectedId;
            item.hovered = node.id === pointerPickState.hoveredNodeId;
            item.matched = searchMatches.has(node.id);
            item.routeHighlighted = routeNodeIds.has(node.id);
            item.connected = selectedRelated.has(node.id);
            item.focused = !focusedCluster || node.clusterId === focusedCluster || node.id === model.rootNodeId;
            const quiet = Boolean((selectedId || routeActive) && !item.selected && !item.connected && !item.matched && !item.routeHighlighted && node.id !== model.rootNodeId);
            const suppressed = Boolean(focusedCluster && !item.focused && !item.selected && !item.matched && !item.routeHighlighted);
            const priority = {
              visible,
              selected: item.selected,
              hovered: item.hovered,
              matched: item.matched,
              routeHighlighted: item.routeHighlighted,
              connected: item.connected,
              quiet,
              suppressed,
              importance: node.importance,
            };
            item.meshTargetVisible = visible;
            item.opacityMotion.target = repositoryUniverseNodeOpacityTarget(priority);
            item.scaleMotion.target = repositoryUniverseNodeScaleTarget(priority);
            item.emissiveMotion.target = repositoryUniverseNodeEmissiveTarget(priority);
            item.haloOpacityMotion.target = repositoryUniverseNodeHaloOpacityTarget(priority);
            item.haloScaleMotion.target = repositoryUniverseNodeHaloScaleTarget(priority);
            item.haloTargetVisible = item.haloOpacityMotion.target > 0;
            item.meshColorTarget = colorForNode(node, item.selected, item.matched || item.routeHighlighted, item.hovered, item.connected);
            item.emissiveColorTarget = emissiveForNode(node, item.selected, item.matched || item.routeHighlighted, item.hovered);
            item.haloColorTarget = item.selected
              ? 0xe0faff
              : item.routeHighlighted
                ? 0xa7f3ff
                : item.connected
                  ? brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.16)
                  : 0x67e8f9;
          }

          if (updateLabelTargets) {
            const labelVisible = visible && shouldRenderLabel(node, {
              selected: item.selected,
              hovered: item.hovered,
              matched: item.matched || item.routeHighlighted,
              connected: item.connected || item.routeHighlighted,
              focused: item.focused,
              focusedClusterId: focusedCluster,
              hasSelection: Boolean(selectedId),
              cameraRadius: radius,
              distanceBand: labelDistanceBand,
            });
            item.labelTargetVisible = labelVisible;
            item.labelOpacityMotion.target = labelVisible
              ? labelOpacity(node, labelDistanceBand, item.selected, item.hovered, item.matched, item.connected)
              : 0;
            const labelScale = labelScaleForNode(node, labelDistanceBand, item.selected || item.hovered || item.matched);
            item.labelScaleWidthTarget = labelScale.width;
            item.labelScaleHeightTarget = labelScale.height;
          }
        }
      }

      if (dirtyGroups & REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.proposalNodes) {
        for (const item of proposalItems.values()) {
          const visible = mode === 'with-shipseal' && (domain === 'all' || item.domain === domain);
          const selected = selectedProposal === item.proposalId;
          const excluded = excludedProposals.has(item.proposalId);
          const opacity = !visible ? 0 : excluded ? 0.24 : selected ? 0.92 : 0.66;
          item.meshTargetVisible = visible;
          item.haloTargetVisible = visible && !excluded;
          item.labelTargetVisible = visible;
          item.opacityMotion.target = opacity;
          item.scaleMotion.target = selected ? 1.34 : 1;
          item.haloOpacityMotion.target = item.haloTargetVisible ? selected ? 0.26 : 0.12 : 0;
          item.labelOpacityMotion.target = visible ? excluded ? 0.34 : selected ? 0.94 : 0.7 : 0;
        }
      }
    };

    const interpolateVisualValues = () => {
      let interpolationCount = 0;
      for (const item of clusterItems.values()) {
        if (stepVisualScalar(item.opacityMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.clusterRing)) interpolationCount += 1;
      }
      for (const item of edgeItems.values()) {
        if (stepVisualScalar(item.opacityMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.edge)) interpolationCount += 1;
      }
      for (const item of proposalEdgeItems.values()) {
        if (stepVisualScalar(item.opacityMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.edge)) interpolationCount += 1;
      }
      for (const item of nodeItems.values()) {
        let itemInterpolating = false;
        const opacityRate = item.opacityMotion.target >= item.opacityMotion.current
          ? REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.dimIn
          : REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.dimOut;
        const scaleRate = Math.max(item.scaleMotion.current, item.scaleMotion.target) >= 2
          ? REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.selection
          : REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.hover;
        itemInterpolating = stepVisualScalar(item.opacityMotion, opacityRate) || itemInterpolating;
        itemInterpolating = stepVisualScalar(item.scaleMotion, scaleRate) || itemInterpolating;
        itemInterpolating = stepVisualScalar(item.emissiveMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.emissive) || itemInterpolating;
        itemInterpolating = stepVisualScalar(
          item.haloOpacityMotion,
          item.haloOpacityMotion.target > item.haloOpacityMotion.current
            ? REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.haloIn
            : REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.haloOut,
        ) || itemInterpolating;
        itemInterpolating = stepVisualScalar(item.haloScaleMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.haloIn) || itemInterpolating;
        itemInterpolating = stepVisualScalar(item.labelOpacityMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.label) || itemInterpolating;
        if (itemInterpolating) interpolationCount += 1;
      }

      for (const item of proposalItems.values()) {
        let itemInterpolating = false;
        itemInterpolating = stepVisualScalar(item.opacityMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.proposal) || itemInterpolating;
        itemInterpolating = stepVisualScalar(item.scaleMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.proposal) || itemInterpolating;
        itemInterpolating = stepVisualScalar(
          item.haloOpacityMotion,
          item.haloOpacityMotion.target > item.haloOpacityMotion.current
            ? REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.haloIn
            : REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.haloOut,
        ) || itemInterpolating;
        itemInterpolating = stepVisualScalar(item.labelOpacityMotion, REPOSITORY_UNIVERSE_VISUAL_MOTION_RATES.label) || itemInterpolating;
        if (itemInterpolating) interpolationCount += 1;
      }
      return interpolationCount;
    };

    const applyVisualProperties = () => {
      for (const item of clusterItems.values()) {
        item.ring.visible = true;
        item.ring.material.opacity = item.opacityMotion.current;
        item.ring.material.color.setHex(item.colorTarget);
      }
      for (const item of edgeItems.values()) {
        item.line.material.opacity = item.opacityMotion.current;
        item.line.visible = repositoryUniverseOpacityVisible(item.targetVisible, item.opacityMotion.current);
        item.line.material.color.setHex(item.colorTarget);
      }
      for (const item of proposalEdgeItems.values()) {
        item.line.material.opacity = item.opacityMotion.current;
        item.line.visible = repositoryUniverseOpacityVisible(item.targetVisible, item.opacityMotion.current);
        item.line.material.color.setHex(item.colorTarget);
      }
      for (const item of nodeItems.values()) {
        const { mesh, halo, label, labelMaterial, baseRadius } = item;
        const meshVisible = repositoryUniverseOpacityVisible(item.meshTargetVisible, item.opacityMotion.current);
        if (mesh.visible !== meshVisible) {
          mesh.visible = meshVisible;
          markRepositoryUniverseRaycastCacheDirty(raycastCache);
        }
        mesh.material.opacity = item.opacityMotion.current;
        mesh.material.color.setHex(item.meshColorTarget);
        mesh.material.emissive.setHex(item.emissiveColorTarget);
        mesh.material.emissiveIntensity = item.emissiveMotion.current;
        // U2A reveal owns radial position; U2B emphasis owns object scale, composed independently.
        mesh.scale.setScalar(composeRepositoryUniverseVisualScale(1, item.scaleMotion.current));
        halo.material.opacity = item.haloOpacityMotion.current;
        halo.visible = repositoryUniverseOpacityVisible(item.haloTargetVisible, item.haloOpacityMotion.current);
        halo.material.color.setHex(item.haloColorTarget);
        halo.scale.setScalar(item.haloScaleMotion.current);
        labelMaterial.opacity = item.labelOpacityMotion.current;
        label.visible = repositoryUniverseOpacityVisible(item.labelTargetVisible, item.labelOpacityMotion.current);
        label.position.set(item.position.x, item.position.y + baseRadius * item.scaleMotion.current + 5, item.position.z);
        label.scale.set(item.labelScaleWidthTarget, item.labelScaleHeightTarget, 1);
        label.lookAt(camera.position);
      }
      for (const item of proposalItems.values()) {
        const meshVisible = repositoryUniverseOpacityVisible(item.meshTargetVisible, item.opacityMotion.current);
        if (item.mesh.visible !== meshVisible) {
          item.mesh.visible = meshVisible;
          markRepositoryUniverseRaycastCacheDirty(raycastCache);
        }
        item.mesh.material.opacity = item.opacityMotion.current;
        item.mesh.scale.setScalar(item.scaleMotion.current);
        item.halo.material.opacity = item.haloOpacityMotion.current;
        item.halo.visible = repositoryUniverseOpacityVisible(item.haloTargetVisible, item.haloOpacityMotion.current);
        item.labelMaterial.opacity = item.labelOpacityMotion.current;
        item.label.visible = repositoryUniverseOpacityVisible(item.labelTargetVisible, item.labelOpacityMotion.current);
        item.label.position.set(item.position.x, item.position.y + 12 + (item.scaleMotion.current - 1) * 12, item.position.z);
        item.label.lookAt(camera.position);
      }
    };

    const consumeAndRecalculateVisualTargets = () => {
      const dirtyGroups = consumeRepositoryUniverseVisualTargetGroups(visualTargetDirtyState);
      if (!dirtyGroups) return false;
      recalculateVisualTargets(dirtyGroups);
      activateRepositoryUniverseVisualMotion(visualMotionState);
      return true;
    };

    const processPendingHoverRaycast = () => {
      if (pointerMode) return;
      const coordinates = consumeRepositoryUniverseHoverRaycast(pointerPickState);
      if (!coordinates) return;
      const nextHoveredNodeId = intersectEntity(coordinates.x, coordinates.y).nodeId || null;
      if (nextHoveredNodeId === pointerPickState.hoveredNodeId) return;
      pointerPickState.hoveredNodeId = nextHoveredNodeId;
      markRepositoryUniverseVisualTargetsDirty(
        visualTargetDirtyState,
        repositoryUniverseVisualTargetGroupsForDependency('hovered-node'),
      );
    };

    const animate = (timestamp: number) => {
      if (disposed) return;
      const now = timestamp;
      const { animationDeltaSeconds } = repositoryUniverseFrameDelta(lastFrameTimestamp, timestamp);
      currentAnimationDeltaSeconds = animationDeltaSeconds;
      lastFrameTimestamp = timestamp;
      const elapsed = now - startedAt;
      if (!reducedMotionRef.current && animateInRef.current && elapsed > INITIAL_APPEARANCE_MS && !localSettled) {
        localSettled = true;
        setSettled(true);
        onSceneSettledRef.current?.();
      }
      if (!reducedMotionRef.current && !rotationPausedRef.current && elapsed > INITIAL_APPEARANCE_MS && now - userInteractedAt > IDLE_ROTATION_DELAY_MS) {
        const state = cameraStateRef.current;
        cameraStateRef.current = { ...state, theta: state.theta + idleRotationDelta(animationDeltaSeconds) };
      }
      const appearance = reducedMotionRef.current || !animateInRef.current ? 1 : easeOutCubic(Math.min(1, elapsed / INITIAL_APPEARANCE_MS));
      for (const item of nodeItems.values()) {
        const base = item.position;
        const startScale = 0.42;
        item.mesh.position.set(
          base.x * startScale + base.x * (1 - startScale) * appearance,
          base.y * startScale + base.y * (1 - startScale) * appearance,
          base.z * startScale + base.z * (1 - startScale) * appearance,
        );
        item.halo.position.copy(item.mesh.position);
        item.label.position.x = item.mesh.position.x;
        item.label.position.z = item.mesh.position.z;
      }
      const { desired, next } = applyCamera(animationDeltaSeconds);
      updateFocusSettlement(desired, next);

      const nextLabelDistanceBand = repositoryUniverseLabelDistanceBand(cameraStateRef.current.radius, labelDistanceBand);
      if (nextLabelDistanceBand !== labelDistanceBand) {
        labelDistanceBand = nextLabelDistanceBand;
        markRepositoryUniverseVisualTargetsDirty(
          visualTargetDirtyState,
          repositoryUniverseVisualTargetGroupsForDependency('camera-label-band'),
        );
      }
      consumeAndRecalculateVisualTargets();
      processPendingHoverRaycast();
      consumeAndRecalculateVisualTargets();

      if (visualMotionState.active) {
        activeVisualInterpolationCount = interpolateVisualValues();
        applyVisualProperties();
        completeRepositoryUniverseVisualMotionFrame(visualMotionState, activeVisualInterpolationCount);
      } else {
        activeVisualInterpolationCount = 0;
      }
      rebuildRaycastCacheIfNeeded();

      targetRecalculationWindowStartedAt ??= timestamp;
      const counterWindowDurationMs = timestamp - targetRecalculationWindowStartedAt;
      if (counterWindowDurationMs >= 1000) {
        visualTargetRecalculationsPerSecond = (visualTargetDirtyState.recalculationCount - targetRecalculationsAtWindowStart) * 1000 / counterWindowDurationMs;
        hoverRaycastsPerSecond = (pointerPickState.hoverRaycastCount - hoverRaycastsAtWindowStart) * 1000 / counterWindowDurationMs;
        targetRecalculationsAtWindowStart = visualTargetDirtyState.recalculationCount;
        hoverRaycastsAtWindowStart = pointerPickState.hoverRaycastCount;
        targetRecalculationWindowStartedAt = timestamp;
      }
      diagnostics?.update({
        visualMotionActive: visualMotionState.active,
        activeVisualInterpolationCount,
        visualTargetRecalculationCount: visualTargetDirtyState.recalculationCount,
        visualTargetRecalculationsPerSecond,
        pointerMoveEventCount: pointerPickState.pointerMoveEventCount,
        hoverRaycastCount: pointerPickState.hoverRaycastCount,
        hoverRaycastsPerSecond,
        cachedRaycastObjectCount: raycastCache.objects.length,
        raycastCacheRebuildCount: raycastCache.rebuildCount,
        visualTargetsDirty: visualTargetDirtyState.groups !== REPOSITORY_UNIVERSE_VISUAL_TARGET_GROUP.none,
        hoverRaycastPending: pointerPickState.pending,
        fullscreen: fullscreenRef.current,
        selectedNodeId: selectedNodeIdRef.current || null,
        cameraTheta: renderCameraStateRef.current.theta,
        cameraPhi: renderCameraStateRef.current.phi,
        cameraRadius: renderCameraStateRef.current.radius,
        cameraTargetX: renderCameraStateRef.current.target.x,
        cameraTargetY: renderCameraStateRef.current.target.y,
        cameraTargetZ: renderCameraStateRef.current.target.z,
      });
      renderer.render(scene, camera);
      fpsWindowStartedAt ??= timestamp;
      fpsWindowFrameCount += 1;
      const fpsWindowDurationMs = timestamp - fpsWindowStartedAt;
      if (fpsWindowDurationMs >= 500) {
        approximateFps = fpsWindowFrameCount * 1000 / fpsWindowDurationMs;
        fpsWindowStartedAt = timestamp;
        fpsWindowFrameCount = 0;
        diagnostics?.update({
          renderCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          lines: renderer.info.render.lines,
          approximateFps,
          visibleNodeCount: visibleNodeSetRef.current.size,
          visibleEdgeCount: visibleEdgeSetRef.current.size,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          devicePixelRatio: renderer.getPixelRatio(),
          programmaticCameraMotionActive: Boolean(pendingFocusRequest),
          settlementState: focusSettlementState,
        });
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handleCanvasPointerMove);
    canvas.addEventListener('pointerleave', clearPointerHover);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', preventDefault);

    return () => {
      disposed = true;
      cleanupDocumentDrag();
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      resizeSceneRef.current = () => undefined;
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handleCanvasPointerMove);
      canvas.removeEventListener('pointerleave', clearPointerHover);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('contextmenu', preventDefault);
      scene.traverse(object => {
        if ('geometry' in object && object.geometry) {
          (object.geometry as THREE.BufferGeometry).dispose();
        }
        if ('material' in object && object.material) {
          const material = object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) material.forEach(item => item.dispose());
          else material.dispose();
        }
      });
      nodeItems.forEach(item => item.labelTexture.dispose());
      proposalItems.forEach(item => item.labelTexture.dispose());
      sphereGeometryCache.forEach(geometry => geometry.dispose());
      clearRepositoryUniverseRaycastCache(raycastCache);
      raycastCandidates.length = 0;
      diagnostics?.dispose();
      renderer.dispose();
    };
  }, [model, transformation]);

  return (
    <div ref={hostRef} className="relative h-full min-h-[440px] overflow-hidden rounded-[1.4rem] border border-primary/15 bg-[#050914]" data-testid="repository-universe-host">
      <canvas
        ref={canvasRef}
        className="block h-full min-h-[440px] w-full touch-none"
        role="img"
        aria-label={`Repository Universe 3D graph. ${model.summary.representedFileNodeCount} analyzed file nodes represented.`}
        data-testid="repository-universe-canvas"
        data-node-count={model.summary.representedFileNodeCount}
        data-edge-count={model.summary.edgeCount}
        data-visible-node-count={visibleNodeIds.length}
        data-visible-edge-count={visibleEdgeIds.length}
        data-route-node-count={routeNodeIds.length}
        data-selected-visible={!selectedNodeId || visibleNodeSet.has(selectedNodeId) ? 'true' : 'false'}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        data-rotation-paused={rotationPaused || reducedMotion ? 'true' : 'false'}
        data-settled={settled ? 'true' : 'false'}
      />
      {!settled && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#050914]/70 backdrop-blur-[1px] transition-opacity duration-500 motion-reduce:hidden" aria-hidden="true">
          <div className="relative flex h-52 w-52 items-center justify-center">
            <div className="absolute h-full w-full rounded-full border border-primary/15" />
            <div className="absolute h-36 w-36 rounded-full border border-primary/20" />
            <div className="absolute h-20 w-20 rounded-full border border-primary/30 bg-primary/10 shadow-glow" />
            <div className="absolute left-8 top-8 h-2.5 w-2.5 rounded-full bg-primary/80 shadow-[0_0_18px_hsl(var(--primary)/0.5)]" />
            <div className="absolute right-10 top-14 h-2 w-2 rounded-full bg-accent/80 shadow-[0_0_16px_hsl(var(--accent)/0.45)]" />
            <div className="absolute bottom-10 left-14 h-2 w-2 rounded-full bg-success/80 shadow-[0_0_16px_hsl(var(--success)/0.45)]" />
            <div className="absolute bottom-14 right-9 h-2.5 w-2.5 rounded-full bg-primary-glow/80 shadow-[0_0_18px_hsl(var(--primary-glow)/0.5)]" />
            <div className="relative rounded-full border border-primary/25 bg-background/70 px-4 py-2 text-center backdrop-blur">
              <div className="font-display text-sm font-semibold text-foreground">Forming repository universe</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Signals are becoming clusters</div>
            </div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-primary/20 bg-background/55 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        Drag to orbit - gentle scroll to zoom - click a node
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        {visibleNodeIds.length.toLocaleString()} visible - {model.summary.representedFileNodeCount.toLocaleString()} file nodes - {model.summary.folderNodeCount.toLocaleString()} folders
      </div>
      {webglUnavailable && (
        <div className="absolute inset-0 grid place-items-center bg-[#050914]/95 p-8 text-center">
          <div className="max-w-md rounded-3xl border border-primary/20 bg-background/50 p-6">
            <div className="font-display text-xl font-semibold">3D rendering is unavailable</div>
            <p className="mt-2 text-sm text-muted-foreground">
              The complete repository remains available in Atlas 2D, including all searchable evidence and the selected inspector.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function nodeRadius(node: RepositoryUniverseNode) {
  if (node.kind === 'repository') return 7.8;
  if (node.kind === 'folder') return node.importance === 'supporting' ? 4.7 : 3.85;
  if (node.kind === 'concept' || node.kind === 'recommendation') return node.importance === 'primary' ? 4.75 : 3.45;
  if (node.importance === 'primary') return 4.7;
  if (node.importance === 'supporting') return 3.15;
  return 2.15;
}

function colorForNode(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean, hovered?: boolean, connected?: boolean) {
  if (selected) return brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.44);
  if (hovered) return brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.34);
  if (matched) return blendHex(repositoryUniverseNodeBaseColor(node), 0xfacc15, 0.22);
  if (connected) return brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.2);
  return repositoryUniverseNodeBaseColor(node);
}

// Focused visual-contract tests consume this deterministic helper alongside the renderer.
// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseNodeBaseColor(node: Pick<RepositoryUniverseNode, 'clusterId' | 'evidenceType' | 'importance'>) {
  const base = repositoryUniverseNodeClusterToken(node).hex;
  if (node.evidenceType === 'heuristic') return softenClusterColor(base, node.importance === 'background' ? 0.46 : 0.28);
  if (node.evidenceType === 'missing') return brightenClusterColor(base, 0.18);
  return node.importance === 'background' ? softenClusterColor(base, 0.24) : base;
}

function emissiveForNode(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean, hovered?: boolean) {
  if (selected || hovered) return 0x67e8f9;
  if (matched) return 0xfacc15;
  if (node.kind === 'repository') return 0x0891b2;
  if (node.importance === 'primary') return 0x1d4ed8;
  return 0x0f172a;
}

function colorForEdge(edge: RepositoryUniverseEdge, selected?: boolean, focused?: boolean) {
  if (selected) return edge.evidenceType === 'heuristic' ? 0x94a3b8 : 0x9bdcf3;
  if (focused) return 0x7dd3fc;
  if (edge.evidenceType === 'heuristic') return 0x94a3b8;
  if (edge.relationship === 'contains') return 0x38bdf8;
  return 0x5eead4;
}

function colorForCluster(cluster: RepositoryUniverseCluster, active?: boolean, related?: boolean) {
  const base = repositoryUniverseClusterToken(cluster.id).hex;
  if (active) return brightenClusterColor(base, 0.26);
  if (related) return brightenClusterColor(base, 0.14);
  return base;
}

function shouldRenderLabel(node: RepositoryUniverseNode, state: {
  selected?: boolean;
  hovered?: boolean;
  matched?: boolean;
  connected?: boolean;
  focused?: boolean;
  focusedClusterId?: string | null;
  hasSelection?: boolean;
  cameraRadius: number;
  distanceBand: RepositoryUniverseLabelDistanceBand;
}) {
  if (state.selected || state.hovered || state.matched) return true;
  if (node.kind === 'repository') return true;
  if (state.connected && (state.cameraRadius < 980 || node.importance !== 'background')) return true;
  if (state.hasSelection && !state.connected && node.importance === 'background') return false;
  if (state.distanceBand === 'far') return node.kind === 'folder' && node.importance === 'supporting';
  if (state.distanceBand === 'medium') {
    return node.kind === 'folder' || node.importance === 'primary' || Boolean(state.connected && node.importance !== 'background');
  }
  if (state.focusedClusterId && state.focused && node.importance !== 'background') return true;
  return node.kind === 'folder' || node.importance !== 'background' || Boolean(state.connected);
}

function labelOpacity(node: RepositoryUniverseNode, distanceBand: RepositoryUniverseLabelDistanceBand, selected?: boolean, hovered?: boolean, matched?: boolean, connected?: boolean) {
  if (selected || hovered || matched) return 1;
  if (connected) return 0.78;
  if (distanceBand === 'far') return node.kind === 'repository' ? 0.86 : 0.58;
  return node.importance === 'background' ? 0.44 : 0.68;
}

function labelScaleForNode(node: RepositoryUniverseNode, distanceBand: RepositoryUniverseLabelDistanceBand, priority?: boolean) {
  const zoomBoost = distanceBand === 'near' ? 1.08 : distanceBand === 'far' ? 0.82 : 0.94;
  const baseWidth = node.kind === 'repository' ? 66 : priority ? 50 : 36;
  const baseHeight = node.kind === 'repository' ? 18 : priority ? 16 : 12;
  return { width: baseWidth * zoomBoost, height: baseHeight * zoomBoost };
}

function labelColorForNode(node: RepositoryUniverseNode) {
  if (node.kind === 'repository') return '#ecfeff';
  if (node.evidenceType === 'missing') return '#fed7aa';
  if (node.evidenceType === 'heuristic') return '#cbd5e1';
  return '#e5f7ff';
}

// Focused visual-contract tests consume this deterministic helper alongside the renderer.
// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseNodeDisplayLabel(node: Pick<RepositoryUniverseNode, 'id' | 'label' | 'path'>) {
  const label = typeof node.label === 'string' ? node.label.trim() : '';
  if (label) return label;
  const path = typeof node.path === 'string' ? node.path.trim() : '';
  if (path) return path.split('/').filter(Boolean).pop() || path;
  const id = typeof node.id === 'string' ? node.id.trim() : '';
  return id || 'Unknown repository entity';
}

function labelSprite(label: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '600 28px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(5, 9, 20, 0.66)';
    roundRect(context, 34, 36, 444, 56, 24);
    context.fill();
    context.fillStyle = color;
    context.fillText(label, 256, 64, 400);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
  return { sprite: new THREE.Sprite(material), material, texture };
}

function shortLabel(label: string) {
  if (label.length <= 22) return label;
  return `${label.slice(0, 19)}...`;
}

function visualPositionFor(position: RepositoryUniversePosition, isRoot = false) {
  if (isRoot) return new THREE.Vector3(position.x, position.y, position.z);
  return new THREE.Vector3(position.x * LAYOUT_SPREAD_XZ, position.y * LAYOUT_SPREAD_Y, position.z * LAYOUT_SPREAD_XZ);
}

function clampCameraState(state: UniverseCameraState): UniverseCameraState {
  return {
    theta: state.theta,
    phi: Math.max(0.24, Math.min(Math.PI - 0.24, state.phi)),
    radius: Math.max(150, Math.min(1500, state.radius)),
    target: {
      x: Math.max(-900, Math.min(900, state.target.x)),
      y: Math.max(-520, Math.min(520, state.target.y)),
      z: Math.max(-900, Math.min(900, state.target.z)),
    },
  };
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function preventDefault(event: Event) {
  event.preventDefault();
}

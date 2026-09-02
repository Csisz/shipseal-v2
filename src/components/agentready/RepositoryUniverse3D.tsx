import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RepositoryTransformationDomainFilter, RepositoryTransformationMode, RepositoryTransformationProposal, RepositoryTransformationProposedNode, RepositoryTransformationProposalModel, RepositoryUniverseEdge, RepositoryUniverseModel, RepositoryUniverseNode, RepositoryUniversePosition } from '@/lib/workspace';
import { drawRepositoryUniverseSemanticIcon, repositoryUniverseClusterSemanticStyle, repositoryUniverseSemanticStyle, type RepositoryUniverseSemanticStyle, type RepositoryUniverseSemanticType } from '@/lib/workspace/repositoryUniverseSemantics';
import { brightenClusterColor, repositoryUniverseClusterToken, repositoryUniverseNodeClusterToken, repositoryUniverseInspectorAwareLookTarget, repositoryUniverseVisualPosition, softenClusterColor, blendHex, repositoryUniverseLandmarkOpacity, repositoryUniverseRendererTokens, repositoryUniverseSemanticIconVisible, repositoryUniverseSemanticLabelVisible, repositoryUniverseSemanticOpacityMultiplier, repositoryUniverseSemanticZoomLevel, REPOSITORY_UNIVERSE_CINEMATIC_TOKENS, type RepositoryUniverseRendererTokens } from '@/lib/workspace/repositoryUniverseVisual';
import type { ShipSealResolvedTheme } from '@/lib/theme';
import { REPOSITORY_UNIVERSE_REVEAL_MS, repositoryUniverseRevealLayer, repositoryUniverseRevealProgress } from './result-workspace/universe/repositoryUniverseMotion';

export interface UniverseCameraState {
  theta: number;
  phi: number;
  radius: number;
  target: RepositoryUniversePosition;
}

export type RepositoryVerificationNodeOverlayState = 'verified-change' | 'partially-verified' | 'unresolved' | 'regressed' | 'newly-detected' | 'unchanged';

export interface UniverseProjectedNodePosition {
  x: number;
  y: number;
  visible: boolean;
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
  theme?: ShipSealResolvedTheme;
  transformationMode?: RepositoryTransformationMode;
  transformationDomain?: RepositoryTransformationDomainFilter;
  selectedProposalId?: string | null;
  excludedProposalIds?: string[];
  transformation?: RepositoryTransformationProposalModel;
  verificationNodeStates?: Record<string, RepositoryVerificationNodeOverlayState>;
  projectionNodeIds?: string[];
  onProjectionChange?: (positions: Record<string, UniverseProjectedNodePosition>) => void;
  onCameraStateChange: (state: UniverseCameraState) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectProposal?: (proposalId: string) => void;
  onFocusNodeSettled?: (nodeId: string) => void;
  onSceneSettled?: () => void;
  focusRequest?: {
    nodeId: string;
    sequence: number;
  };
}

type PointerMode = 'orbit' | 'pan';

interface NodeRenderItem {
  node: RepositoryUniverseNode;
  semantic: RepositoryUniverseSemanticStyle;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  hitTarget: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  icon: THREE.Sprite;
  iconMaterial: THREE.SpriteMaterial;
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  labelTexture: THREE.CanvasTexture;
  baseRadius: number;
  position: THREE.Vector3;
}

interface EdgeRenderItem {
  edge: RepositoryUniverseEdge;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}

interface ProposalRenderItem {
  proposalId: string;
  domain: string;
  priorityIndex: number;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  labelTexture: THREE.CanvasTexture;
  position: THREE.Vector3;
}

interface ProposalEdgeRenderItem {
  proposalId: string;
  domain: string;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
}

const INITIAL_APPEARANCE_MS = REPOSITORY_UNIVERSE_REVEAL_MS;
const NODE_FOCUS_TRANSITION_MS = 360;
const IDLE_ROTATION_DELAY_MS = 12_000;
const LABEL_FAR_RADIUS = 720;
const LABEL_MEDIUM_RADIUS = 420;
const PROPOSAL_LABEL_FAR_RADIUS = 620;

interface LabelCollisionCandidate {
  id: string;
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  opacity: number;
  priority: number;
  protected: boolean;
}

interface ClusterRenderItem {
  clusterId: string;
  landmark: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
}

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
  theme = 'dark',
  transformationMode = 'current',
  transformationDomain = 'all',
  selectedProposalId,
  excludedProposalIds = [],
  transformation,
  verificationNodeStates = {},
  projectionNodeIds = [],
  onProjectionChange,
  onCameraStateChange,
  onSelectNode,
  onSelectProposal,
  onFocusNodeSettled,
  onSceneSettled,
  focusRequest,
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
  const transformationModeRef = useRef(transformationMode);
  const transformationDomainRef = useRef(transformationDomain);
  const selectedProposalIdRef = useRef(selectedProposalId);
  const excludedProposalSetRef = useRef(new Set(excludedProposalIds));
  const verificationNodeStatesRef = useRef(verificationNodeStates);
  const projectionNodeIdSetRef = useRef(new Set(projectionNodeIds));
  const onProjectionChangeRef = useRef(onProjectionChange);
  const onCameraStateChangeRef = useRef(onCameraStateChange);
  const onSelectNodeRef = useRef(onSelectNode);
  const onSelectProposalRef = useRef(onSelectProposal);
  const onFocusNodeSettledRef = useRef(onFocusNodeSettled);
  const onSceneSettledRef = useRef(onSceneSettled);
  const focusRequestRef = useRef(focusRequest);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [settled, setSettled] = useState(reducedMotion);

  const visibleNodeSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds]);
  const visibleEdgeSet = useMemo(() => new Set(visibleEdgeIds), [visibleEdgeIds]);
  const visualTokens = useMemo(() => repositoryUniverseRendererTokens(theme), [theme]);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  useEffect(() => {
    verificationNodeStatesRef.current = verificationNodeStates;
  }, [verificationNodeStates]);

  useEffect(() => {
    projectionNodeIdSetRef.current = new Set(projectionNodeIds);
  }, [projectionNodeIds]);

  useEffect(() => {
    onProjectionChangeRef.current = onProjectionChange;
  }, [onProjectionChange]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    focusedClusterIdRef.current = focusedClusterId;
  }, [focusedClusterId]);

  useEffect(() => {
    routeNodeIdSetRef.current = new Set(routeNodeIds);
  }, [routeNodeIds]);

  useEffect(() => {
    searchMatchSetRef.current = new Set(searchMatchIds);
  }, [searchMatchIds]);

  useEffect(() => {
    visibleNodeSetRef.current = visibleNodeSet;
  }, [visibleNodeSet]);

  useEffect(() => {
    visibleEdgeSetRef.current = visibleEdgeSet;
  }, [visibleEdgeSet]);

  useEffect(() => {
    rotationPausedRef.current = rotationPaused;
  }, [rotationPaused]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    if (reducedMotion) setSettled(true);
  }, [reducedMotion]);

  useEffect(() => {
    fullscreenRef.current = fullscreen;
  }, [fullscreen]);

  useEffect(() => {
    animateInRef.current = animateIn;
    if (!animateIn) setSettled(true);
  }, [animateIn]);

  useEffect(() => {
    transformationModeRef.current = transformationMode;
  }, [transformationMode]);

  useEffect(() => {
    transformationDomainRef.current = transformationDomain;
  }, [transformationDomain]);

  useEffect(() => {
    selectedProposalIdRef.current = selectedProposalId;
  }, [selectedProposalId]);

  useEffect(() => {
    excludedProposalSetRef.current = new Set(excludedProposalIds);
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
    focusRequestRef.current = focusRequest;
  }, [focusRequest]);

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
    raycaster.layers.enable(1);
    const pointer = new THREE.Vector2();
    const nodeItems = new Map<string, NodeRenderItem>();
    const edgeItems = new Map<string, EdgeRenderItem>();
    const clusterItems = new Map<string, ClusterRenderItem>();
    const proposalItems = new Map<string, ProposalRenderItem>();
    const proposalEdgeItems = new Map<string, ProposalEdgeRenderItem>();
    const sphereGeometryCache = new Map<number, THREE.SphereGeometry>();
    const semanticIconTextureCache = new Map<string, THREE.CanvasTexture>();
    let frameId = 0;
    let disposed = false;
    let pointerMode: PointerMode | null = null;
    let pointerStart = { x: 0, y: 0 };
    let pointerLast = { x: 0, y: 0 };
    let pointerMoved = false;
    const activeTouchPointers = new Map<number, { x: number; y: number }>();
    let pinchStartDistance = 0;
    let pinchStartRadius = 0;
    let pinchActive = false;
    let hoveredNodeId: string | null = null;
    let hoveredProposalId: string | null = null;
    let userInteractedAt = performance.now();
    let localSettled = reducedMotionRef.current || !animateInRef.current;
    let focusTransition: {
      nodeId: string;
      startedAt: number;
      from: UniverseCameraState;
      to: UniverseCameraState;
    } | null = null;
    let handledFocusSequence = focusRequestRef.current?.sequence || 0;
    let inspectorFramingAmount = selectedNodeIdRef.current && selectedNodeIdRef.current !== model.rootNodeId ? 1 : 0;
    let viewportWidth = 320;
    let viewportHeight = 320;
    let lastPublishedCamera = cameraStateRef.current;
    let lastProjectionPublishedAt = 0;
    let lastProjections: Record<string, UniverseProjectedNodePosition> = {};
    const startedAt = performance.now();
    const revealEnabled = !reducedMotionRef.current && animateInRef.current;
    const revealTargetCamera = clampCameraState(cameraStateRef.current);
    const revealStartCamera = repositoryUniverseRevealStartCamera(revealTargetCamera, revealEnabled);
    let revealInterrupted = !revealEnabled;
    renderCameraStateRef.current = revealStartCamera;

    renderer.setClearColor(visualTokens.background, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fullscreenRef.current ? 1.5 : 1.35));

    scene.fog = new THREE.FogExp2(visualTokens.fog, visualTokens.fogDensity);
    scene.add(new THREE.AmbientLight(visualTokens.ambientLight, visualTokens.ambientIntensity));
    const directional = new THREE.DirectionalLight(visualTokens.keyLight, visualTokens.keyIntensity);
    directional.position.set(220, 360, 180);
    scene.add(directional);
    const centerGlow = new THREE.PointLight(visualTokens.coreGlow, visualTokens.coreIntensity, 860);
    centerGlow.position.set(0, 0, 0);
    scene.add(centerGlow);
    const violetGlow = new THREE.PointLight(visualTokens.violetGlow, visualTokens.violetIntensity, 920);
    violetGlow.position.set(-360, 180, -260);
    scene.add(violetGlow);
    const warmGlow = new THREE.PointLight(visualTokens.warmGlow, visualTokens.warmIntensity, 680);
    warmGlow.position.set(420, -120, 260);
    scene.add(warmGlow);

    const starField = createStarField(visualTokens);
    scene.add(starField);

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
      const position = repositoryUniverseVisualPosition(node, model.rootNodeId);
      visualPositionByNodeId.set(node.id, new THREE.Vector3(position.x, position.y, position.z));
    }

    for (const edge of model.edges) {
      const source = visualPositionByNodeId.get(edge.source);
      const target = visualPositionByNodeId.get(edge.target);
      if (!source || !target) continue;
      const material = edge.evidenceType === 'heuristic'
        ? new THREE.LineDashedMaterial({
          color: colorForEdge(edge, false, false, visualTokens),
          transparent: true,
          opacity: visualTokens.edgeOpacityBase,
          depthWrite: false,
          dashSize: 5,
          gapSize: 7,
        })
        : new THREE.LineBasicMaterial({
        color: colorForEdge(edge, false, false, visualTokens),
        transparent: true,
        opacity: visualTokens.edgeOpacityBase,
        depthWrite: false,
      });
      const geometry = new THREE.BufferGeometry().setFromPoints([source, target]);
      const line = new THREE.Line(geometry, material);
      if (edge.evidenceType === 'heuristic') line.computeLineDistances();
      edgeItems.set(edge.id, { edge, line });
      scene.add(line);
      addRelatedNode(edge.source, edge.target);
      addRelatedNode(edge.target, edge.source);
    }

    let proposalPriorityIndex = 0;
    for (const proposal of transformation?.proposals || []) {
      for (const proposedNode of proposal.graphChanges.proposedNodes) {
        const position = visualPositionFor(proposedNode.position);
        const baseColor = repositoryUniverseClusterToken(proposedNode.clusterId).hex;
        const material = new THREE.MeshStandardMaterial({
          color: brightenClusterColor(baseColor, 0.2),
          emissive: baseColor,
          emissiveIntensity: visualTokens.nodeEmissivePrimary,
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

        const haloMaterial = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const halo = new THREE.Mesh(sphereFor(9.2), haloMaterial);
        halo.position.copy(position);
        scene.add(halo);

        const proposalIdentity = repositoryUniverseProposalDisplayLabel(proposedNode, proposal);
        const { sprite: label, material: labelMaterial, texture } = labelSprite(shortLabel(proposalIdentity), theme === 'light' ? '#493078' : '#e0faff', theme, 'Proposed');
        label.position.set(position.x, position.y + 10, position.z);
        label.scale.set(42, 14, 1);
        scene.add(label);

        proposalItems.set(proposal.id, { proposalId: proposal.id, domain: proposal.domain, priorityIndex: proposalPriorityIndex, mesh, halo, label, labelMaterial, labelTexture: texture, position });
        proposalPriorityIndex += 1;
      }

      for (const edge of proposal.graphChanges.proposedEdges) {
        const source = proposal.graphChanges.proposedNodes.find(node => node.id === edge.source);
        const target = visualPositionByNodeId.get(edge.target);
        if (!source || !target) continue;
        const sourcePosition = visualPositionFor(source.position);
        const material = new THREE.LineDashedMaterial({
          color: visualTokens.proposal,
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
        proposalEdgeItems.set(edge.id, { proposalId: proposal.id, domain: proposal.domain, line });
      }
    }

    for (const cluster of model.clusters) {
      if (cluster.id === 'cluster:repository') continue;
      const semantic = repositoryUniverseClusterSemanticStyle(cluster);
      const token = repositoryUniverseClusterToken(cluster.id);
      const position = repositoryUniverseVisualPosition({ id: cluster.id, position: cluster.position }, model.rootNodeId);
      const { sprite: landmark, material, texture } = clusterLandmarkSprite({
        label: cluster.label,
        count: cluster.nodeIds.length,
        semanticType: semantic.semanticType,
        color: token.hex,
        tokens: visualTokens,
      });
      landmark.position.set(position.x, position.y + Math.min(26, cluster.radius * 0.12), position.z);
      landmark.scale.set(84, 23, 1);
      landmark.renderOrder = 3;
      scene.add(landmark);
      clusterItems.set(cluster.id, { clusterId: cluster.id, landmark, material, texture });
    }

    for (const node of model.nodes) {
      const displayLabel = repositoryUniverseNodeDisplayLabel(node);
      const semantic = repositoryUniverseSemanticStyle(node);
      const baseRadius = nodeRadius(node);
      const position = visualPositionByNodeId.get(node.id) || visualPositionFor(node.position, node.id === model.rootNodeId);
      const material = new THREE.MeshStandardMaterial({
        color: colorForNode(node, false, false, false, false, false, visualTokens),
        emissive: emissiveForNode(node, false, false, false, false, visualTokens),
        emissiveIntensity: node.importance === 'primary' ? visualTokens.nodeEmissivePrimary : visualTokens.nodeEmissiveQuiet,
        metalness: visualTokens.materialMetalness,
        roughness: visualTokens.materialRoughness,
        transparent: true,
        opacity: 0.9,
        wireframe: node.evidenceType === 'missing' || node.kind === 'recommendation',
      });
      const mesh = new THREE.Mesh(sphereFor(baseRadius), material);
      mesh.position.copy(position);
      mesh.userData.nodeId = node.id;
      scene.add(mesh);

      const hitRadius = Math.max(baseRadius * 1.35, node.kind === 'repository' ? 11 : node.kind === 'folder' ? 7.4 : 5.4);
      const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitTarget = new THREE.Mesh(sphereFor(hitRadius), hitMaterial);
      hitTarget.position.copy(position);
      hitTarget.userData.nodeId = node.id;
      hitTarget.layers.set(1);
      scene.add(hitTarget);

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: visualTokens.coreGlow,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: visualTokens.haloAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const halo = new THREE.Mesh(sphereFor(baseRadius * 2.25), haloMaterial);
      halo.position.copy(mesh.position);
      scene.add(halo);

      const iconTexture = semanticIconTexture({
        semanticType: semantic.semanticType,
        color: repositoryUniverseNodeBaseColor(node),
        tokens: visualTokens,
        cache: semanticIconTextureCache,
      });
      const iconMaterial = new THREE.SpriteMaterial({
        map: iconTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const icon = new THREE.Sprite(iconMaterial);
      icon.position.copy(position);
      const initialIconSize = semantic.emphasis === 'landmark' ? 18 : semantic.emphasis === 'primary' ? 13 : 10;
      icon.scale.set(initialIconSize, initialIconSize, 1);
      icon.renderOrder = 4;
      scene.add(icon);

      const { sprite: label, material: labelMaterial, texture } = labelSprite(shortLabel(displayLabel), labelColorForNode(node, theme), theme);
      label.position.set(position.x, position.y + baseRadius + 5, position.z);
      label.scale.set(node.kind === 'repository' ? 70 : 42, node.kind === 'repository' ? 20 : 14, 1);
      scene.add(label);

      nodeItems.set(node.id, { node, semantic, mesh, hitTarget, halo, icon, iconMaterial, label, labelMaterial, labelTexture: texture, baseRadius, position });
    }

    const resize = () => {
      const rect = host.getBoundingClientRect();
      viewportWidth = Math.max(320, rect.width);
      viewportHeight = Math.max(320, rect.height);
      renderer.setSize(viewportWidth, viewportHeight, false);
      camera.aspect = viewportWidth / viewportHeight;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const publishCamera = (state: UniverseCameraState, force = false) => {
      const clamped = clampCameraState(state);
      cameraStateRef.current = clamped;
      const distance = Math.abs(clamped.radius - lastPublishedCamera.radius)
        + Math.abs(clamped.theta - lastPublishedCamera.theta) * 100
        + Math.abs(clamped.phi - lastPublishedCamera.phi) * 100
        + vectorDistance(clamped.target, lastPublishedCamera.target);
      if (force || distance > 5) {
        lastPublishedCamera = clamped;
        onCameraStateChangeRef.current(clamped);
      }
    };

    const finishReveal = () => {
      if (localSettled) return;
      localSettled = true;
      setSettled(true);
      onSceneSettledRef.current?.();
    };

    const interruptReveal = () => {
      if (revealInterrupted) return;
      revealInterrupted = true;
      finishReveal();
    };

    const cancelFocusTransition = () => {
      if (!focusTransition) return;
      focusTransition = null;
      publishCamera(renderCameraStateRef.current, true);
    };

    const beginRequestedFocus = (now: number) => {
      const request = focusRequestRef.current;
      if (!request || request.sequence === handledFocusSequence) return;
      handledFocusSequence = request.sequence;
      interruptReveal();
      const desired = clampCameraState(cameraStateRef.current);
      if (reducedMotionRef.current) {
        focusTransition = null;
        renderCameraStateRef.current = desired;
        onFocusNodeSettledRef.current?.(request.nodeId);
        return;
      }
      focusTransition = {
        nodeId: request.nodeId,
        startedAt: now,
        from: clampCameraState(renderCameraStateRef.current),
        to: desired,
      };
    };

    const applyCamera = (now: number) => {
      const desired = clampCameraState(cameraStateRef.current);
      const current = renderCameraStateRef.current;
      const revealStillTargetingInitialCamera = cameraStateDistance(desired, revealTargetCamera) < 2;
      if (!revealStillTargetingInitialCamera) interruptReveal();
      if (focusTransition && cameraStateDistance(desired, focusTransition.to) > 2) focusTransition = null;

      let next: UniverseCameraState;
      if (focusTransition) {
        const progress = Math.min(1, (now - focusTransition.startedAt) / NODE_FOCUS_TRANSITION_MS);
        next = interpolateCameraState(focusTransition.from, focusTransition.to, easeInOutCubic(progress));
        if (progress >= 1) {
          const focusedNodeId = focusTransition.nodeId;
          focusTransition = null;
          onFocusNodeSettledRef.current?.(focusedNodeId);
        }
      } else {
        const revealProgress = Math.min(1, (now - startedAt) / INITIAL_APPEARANCE_MS);
        const revealing = revealEnabled && !revealInterrupted && animateInRef.current && revealProgress < 1;
        const amount = revealing ? easeInOutCubic(revealProgress) : reducedMotionRef.current ? 1 : 0.18;
        const source = revealing ? revealStartCamera : current;
        next = interpolateCameraState(source, desired, amount);
      }
      renderCameraStateRef.current = next;
      const phi = Math.max(0.18, Math.min(Math.PI - 0.18, next.phi));
      const x = next.target.x + next.radius * Math.sin(phi) * Math.cos(next.theta);
      const y = next.target.y + next.radius * Math.cos(phi);
      const z = next.target.z + next.radius * Math.sin(phi) * Math.sin(next.theta);
      camera.position.set(x, y, z);
      const inspectorFramingTarget = selectedNodeIdRef.current && selectedNodeIdRef.current !== model.rootNodeId ? 1 : 0;
      inspectorFramingAmount = reducedMotionRef.current
        ? inspectorFramingTarget
        : inspectorFramingAmount + (inspectorFramingTarget - inspectorFramingAmount) * 0.14;
      const lookTarget = repositoryUniverseInspectorAwareLookTarget(next, {
        width: viewportWidth,
        height: viewportHeight,
        fullscreen: fullscreenRef.current,
        inspectorOpen: inspectorFramingAmount > 0.001,
      }, inspectorFramingAmount);
      camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
    };

    const publishRequestedProjections = (now: number) => {
      if (!onProjectionChangeRef.current || now - lastProjectionPublishedAt < 120) return;
      const requestedIds = projectionNodeIdSetRef.current;
      if (!requestedIds.size) return;
      const next: Record<string, UniverseProjectedNodePosition> = {};
      requestedIds.forEach(nodeId => {
        const item = nodeItems.get(nodeId);
        if (!item) return;
        const projected = item.mesh.position.clone().project(camera);
        next[nodeId] = {
          x: (projected.x + 1) * 50,
          y: (1 - projected.y) * 50,
          visible: projected.z >= -1 && projected.z <= 1 && projected.x >= -1.12 && projected.x <= 1.12 && projected.y >= -1.12 && projected.y <= 1.12,
        };
      });
      const ids = Object.keys(next);
      const changed = ids.length !== Object.keys(lastProjections).length || ids.some(nodeId => {
        const previous = lastProjections[nodeId];
        const current = next[nodeId];
        return !previous || previous.visible !== current.visible || Math.abs(previous.x - current.x) > 0.35 || Math.abs(previous.y - current.y) > 0.35;
      });
      lastProjectionPublishedAt = now;
      if (!changed) return;
      lastProjections = next;
      onProjectionChangeRef.current(next);
    };

    const setPointer = (event: Pick<PointerEvent | MouseEvent, 'clientX' | 'clientY'>) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const intersectEntity = () => {
      raycaster.setFromCamera(pointer, camera);
      const meshes = [
        ...[...nodeItems.values()].filter(item => item.hitTarget.visible).map(item => item.hitTarget),
        ...[...proposalItems.values()].filter(item => item.mesh.visible).map(item => item.mesh),
      ];
      const intersect = raycaster.intersectObjects(meshes, false)[0];
      if (!intersect) return {};
      return {
        nodeId: intersect.object.userData.nodeId as string | undefined,
        proposalId: intersect.object.userData.proposalId as string | undefined,
      };
    };

    const handleDragPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && activeTouchPointers.has(event.pointerId)) {
        activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activeTouchPointers.size >= 2) {
          const touches = [...activeTouchPointers.values()];
          const distance = Math.max(24, Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y));
          if (!pinchActive) {
            pinchActive = true;
            pinchStartDistance = distance;
            pinchStartRadius = cameraStateRef.current.radius;
          }
          pointerMoved = true;
          pointerMode = null;
          cancelFocusTransition();
          publishCamera({
            ...cameraStateRef.current,
            radius: pinchStartRadius * (pinchStartDistance / distance),
          });
          userInteractedAt = performance.now();
          event.preventDefault();
          return;
        }
      }
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
      const hovered = intersectEntity();
      hoveredNodeId = hovered.nodeId || null;
      hoveredProposalId = hovered.proposalId || null;
    };

    const handleCanvasPointerLeave = () => {
      if (pointerMode || pinchActive) return;
      hoveredNodeId = null;
      hoveredProposalId = null;
    };

    const cleanupDocumentDrag = () => {
      window.removeEventListener('pointermove', handleDragPointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.button !== 2) return;
      interruptReveal();
      cancelFocusTransition();
      hoveredNodeId = null;
      hoveredProposalId = null;
      if (event.pointerType === 'touch') {
        activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activeTouchPointers.size === 2) {
          const touches = [...activeTouchPointers.values()];
          pinchStartDistance = Math.max(24, Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y));
          pinchStartRadius = cameraStateRef.current.radius;
          pinchActive = true;
          pointerMode = null;
        }
      }
      setPointer(event);
      canvas.setPointerCapture?.(event.pointerId);
      if (!pinchActive) pointerMode = event.button === 2 ? 'pan' : 'orbit';
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
      const endedPinch = pinchActive;
      if (event.pointerType === 'touch') activeTouchPointers.delete(event.pointerId);
      if (activeTouchPointers.size < 2) {
        pinchActive = false;
        pinchStartDistance = 0;
      }
      if (event.pointerType !== 'touch' || activeTouchPointers.size === 0) cleanupDocumentDrag();
      if (!endedPinch && mode === 'orbit' && !pointerMoved) {
        setPointer(event);
        const { nodeId, proposalId } = intersectEntity();
        if (nodeId) onSelectNodeRef.current(nodeId);
        if (proposalId) onSelectProposalRef.current?.(proposalId);
      }
      event.preventDefault();
    }

    const handleWheel = (event: WheelEvent) => {
      interruptReveal();
      cancelFocusTransition();
      setPointer(event);
      const hovered = intersectEntity();
      const anchorNode = hovered.nodeId ? nodeItems.get(hovered.nodeId) : undefined;
      publishCamera(repositoryUniverseWheelCameraState(
        cameraStateRef.current,
        event.deltaY,
        fullscreenRef.current,
        anchorNode ? { x: anchorNode.position.x, y: anchorNode.position.y, z: anchorNode.position.z } : undefined,
      ));
      userInteractedAt = performance.now();
      event.preventDefault();
    };

    const handleDoubleClick = (event: MouseEvent) => {
      interruptReveal();
      cancelFocusTransition();
      setPointer(event);
      const { nodeId, proposalId } = intersectEntity();
      if (proposalId) {
        onSelectProposalRef.current?.(proposalId);
        return;
      }
      const node = nodeId ? nodeById.get(nodeId) : undefined;
      if (!node) return;
      onSelectNodeRef.current(node.id);
    };

    let selectedRelatedCacheKey = '';
    let selectedRelatedCache = new Set<string>();
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

    const updateVisualState = (now: number) => {
      const labelCandidates: LabelCollisionCandidate[] = [];
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
      const pinnedSelectionId = selectedId && selectedId !== model.rootNodeId ? selectedId : undefined;
      const interactionContextId = hoveredNodeId || pinnedSelectionId;
      const contextualRelated = relatedNodeIdsForSelection(interactionContextId);
      const radius = cameraStateRef.current.radius;
      const zoomLevel = repositoryUniverseSemanticZoomLevel(radius);
      const revealInProgress = revealEnabled && !revealInterrupted;
      const revealElapsed = now - startedAt;
      const relationshipReveal = repositoryUniverseRevealProgress(revealElapsed, 'relationships', revealInProgress);
      const landmarkReveal = repositoryUniverseRevealProgress(revealElapsed, 'landmarks', revealInProgress);
      const contextReveal = repositoryUniverseRevealProgress(revealElapsed, 'context', revealInProgress);

      for (const item of edgeItems.values()) {
        const { edge, line } = item;
        const directlySelected = Boolean(pinnedSelectionId && (edge.source === pinnedSelectionId || edge.target === pinnedSelectionId));
        const directlyHovered = Boolean(hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId));
        const activeLocalRelationship = directlyHovered || directlySelected;
        const routeRelationship = routeNodeIds.has(edge.source) && routeNodeIds.has(edge.target);
        const focused = Boolean(focusedCluster && nodeById.get(edge.source)?.clusterId === focusedCluster && nodeById.get(edge.target)?.clusterId === focusedCluster);
        const visible = visibleEdges.has(edge.id);
        line.visible = visible;
        const resolvedOpacity = !visible
          ? 0
          : routeRelationship
            ? visualTokens.edgeOpacitySelected
          : activeLocalRelationship
            ? edge.evidenceType === 'heuristic' ? visualTokens.edgeOpacitySelectedHeuristic : visualTokens.edgeOpacitySelected
            : focused
              ? visualTokens.edgeOpacityFocused
              : zoomLevel === 'overview'
                ? edge.relationship === 'contains' ? visualTokens.edgeOpacityOverviewContains : visualTokens.edgeOpacityOverview
              : edge.relationship === 'contains'
                ? interactionContextId || focusedCluster || routeActive ? visualTokens.edgeOpacityContainsQuiet : visualTokens.edgeOpacityContainsBase
                : interactionContextId || focusedCluster || routeActive ? visualTokens.edgeOpacityQuiet : visualTokens.edgeOpacityBase;
        line.material.opacity = resolvedOpacity * relationshipReveal;
        line.material.color.setHex(routeRelationship
          ? visualTokens.route
          : colorForEdge(edge, activeLocalRelationship, focused, visualTokens));
      }

      for (const item of proposalEdgeItems.values()) {
        const visible = mode === 'with-shipseal' && (domain === 'all' || item.domain === domain);
        const selected = selectedProposal === item.proposalId;
        const excluded = excludedProposals.has(item.proposalId);
        item.line.visible = visible;
        item.line.material.opacity = (!visible ? 0 : excluded ? 0.09 : selected ? 0.56 : 0.26) * contextReveal;
        item.line.material.color.setHex(selected
          ? visualTokens.proposalSelected
          : visualTokens.proposal);
      }

      const focusPulse = 0.5;
      for (const item of nodeItems.values()) {
        const { node, semantic, mesh, hitTarget, halo, icon, iconMaterial, label, labelMaterial, baseRadius } = item;
        const visible = visibleNodes.has(node.id);
        const selected = node.id === pinnedSelectionId;
        const hovered = node.id === hoveredNodeId;
        const matched = searchMatches.has(node.id);
        const routeHighlighted = routeNodeIds.has(node.id);
        const connected = contextualRelated.has(node.id);
        const focused = !focusedCluster || node.clusterId === focusedCluster || node.id === model.rootNodeId;
        const quiet = Boolean((interactionContextId || routeActive) && !selected && !hovered && !connected && !matched && !routeHighlighted && node.id !== model.rootNodeId);
        const suppressed = Boolean(focusedCluster && !focused && !selected && !matched && !routeHighlighted);
        const verificationState = verificationNodeStatesRef.current[node.id];
        const forcedSemanticIdentity = selected || hovered || matched || routeHighlighted;
        const contextualSemanticIdentity = connected || Boolean(focusedCluster && focused);
        const semanticIconVisible = repositoryUniverseSemanticIconVisible(semantic, zoomLevel, forcedSemanticIdentity, contextualSemanticIdentity);
        const semanticLabelVisible = repositoryUniverseSemanticLabelVisible(semantic, zoomLevel, forcedSemanticIdentity, contextualSemanticIdentity);
        const semanticOpacityMultiplier = repositoryUniverseSemanticOpacityMultiplier(semantic, zoomLevel, forcedSemanticIdentity, contextualSemanticIdentity, Boolean(interactionContextId));
        const baseOpacity = selected ? 1 : hovered || matched ? 0.99 : routeHighlighted ? 0.99 : connected ? 0.96 : quiet || suppressed ? visualTokens.nodeOpacityQuiet : node.importance === 'background' ? visualTokens.nodeOpacityBackground : visualTokens.nodeOpacityBase;
        const nodeReveal = repositoryUniverseRevealProgress(revealElapsed, repositoryUniverseRevealLayer(node, model.rootNodeId), revealInProgress);
        const opacity = !visible ? 0 : baseOpacity * semanticOpacityMultiplier * nodeReveal;
        const scale = selected ? 2.16 + focusPulse * 0.08 : hovered ? 1.62 : matched ? 1.54 : routeHighlighted ? 1.5 : connected ? 1.32 : node.importance === 'primary' ? 1.12 : 1;

        mesh.visible = opacity > 0.02;
        hitTarget.visible = visible && opacity > 0.02 && nodeReveal > 0.62;
        mesh.material.opacity = opacity;
        mesh.material.color.setHex(verificationState && !selected ? verificationOverlayColor(verificationState) : colorForNode(node, selected, matched, routeHighlighted, hovered, connected, visualTokens));
        mesh.material.emissive.setHex(verificationState && !selected ? verificationOverlayColor(verificationState) : emissiveForNode(node, selected, matched, routeHighlighted, hovered, visualTokens));
        mesh.material.emissiveIntensity = selected
          ? visualTokens.selectedEmissiveIntensity
          : hovered || matched
            ? visualTokens.priorityEmissiveIntensity
            : routeHighlighted
              ? visualTokens.routeEmissiveIntensity
              : connected
                ? visualTokens.connectedEmissiveIntensity
                : verificationState
                  ? visualTokens.connectedEmissiveIntensity
                  : node.importance === 'primary'
                  ? visualTokens.primaryEmissiveIntensity
                  : visualTokens.quietEmissiveIntensity;
        mesh.material.wireframe = node.evidenceType === 'missing' || node.kind === 'recommendation';
        mesh.scale.setScalar(scale * (0.94 + nodeReveal * 0.06));

        halo.visible = visible && (selected || hovered || matched || routeHighlighted || connected || Boolean(verificationState && verificationState !== 'unchanged'));
        halo.material.opacity = (selected
          ? visualTokens.haloOpacitySelected + focusPulse * visualTokens.haloPulseOpacity
          : hovered
            ? visualTokens.haloOpacityHovered
            : matched
              ? visualTokens.haloOpacitySearch
              : routeHighlighted
                ? visualTokens.haloOpacityRoute + focusPulse * visualTokens.haloRoutePulseOpacity
                : verificationState && verificationState !== 'unchanged'
                  ? 0.12
                  : connected
                  ? visualTokens.haloOpacityConnected
                  : 0) * nodeReveal;
        halo.material.color.setHex(selected
          ? visualTokens.selected
          : routeHighlighted
            ? visualTokens.route
            : matched
              ? visualTokens.search
              : verificationState && verificationState !== 'unchanged'
                ? verificationOverlayColor(verificationState)
                : connected
                ? brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.16)
                : visualTokens.coreGlow);
        halo.scale.setScalar(selected ? 1.58 + focusPulse * 0.08 : routeHighlighted ? 1.3 : verificationState && verificationState !== 'unchanged' ? 1.2 : connected ? 1.16 : 1);

        const iconVisible = visible && semanticIconVisible;
        const iconBaseSize = semantic.emphasis === 'landmark' ? 19 : semantic.emphasis === 'primary' ? 14 : semantic.emphasis === 'supporting' ? 11.5 : 9.5;
        const iconScale = selected ? 1.72 : hovered ? 1.42 : matched ? 1.34 : routeHighlighted ? 1.3 : connected ? 1.14 : 1;
        icon.visible = iconVisible;
        iconMaterial.opacity = (!iconVisible ? 0 : selected || hovered || matched ? 1 : routeHighlighted ? 0.98 : connected ? 0.92 : zoomLevel === 'overview' ? 0.9 : 0.82) * nodeReveal;
        icon.position.copy(mesh.position);
        icon.scale.set(iconBaseSize * iconScale, iconBaseSize * iconScale, 1);

        const labelVisible = visible && semanticLabelVisible && shouldRenderLabel(node, {
          selected,
          hovered,
          matched: matched || routeHighlighted,
          connected: connected || routeHighlighted,
          focused,
          focusedClusterId: focusedCluster,
          hasSelection: Boolean(interactionContextId),
          cameraRadius: radius,
        });
        label.visible = labelVisible;
        const desiredLabelOpacity = (labelVisible ? labelOpacity(node, radius, selected, hovered, matched, connected) : 0) * nodeReveal;
        labelMaterial.opacity = desiredLabelOpacity;
        label.position.set(mesh.position.x, mesh.position.y + baseRadius * scale + 5, mesh.position.z);
        const labelScale = labelScaleForNode(node, radius, selected || hovered || matched);
        label.scale.set(labelScale.width, labelScale.height, 1);
        label.lookAt(camera.position);
        if (labelVisible) {
          const routeHighlightedForPriority = routeNodeIds.has(node.id);
          labelCandidates.push({
            id: node.id,
            sprite: label,
            material: labelMaterial,
            opacity: desiredLabelOpacity,
            priority: repositoryUniverseLabelPriority({
              selected,
              searched: matched,
              route: routeHighlightedForPriority,
              repositoryRoot: node.id === model.rootNodeId,
              activeDomain: false,
              importance: node.importance,
              connected,
            }),
            protected: selected || hovered || matched || routeHighlightedForPriority,
          });
        }
      }

      for (const item of clusterItems.values()) {
        const baseOpacity = repositoryUniverseLandmarkOpacity(zoomLevel, visualTokens);
        const active = item.clusterId === focusedCluster || nodeById.get(interactionContextId || '')?.clusterId === item.clusterId;
        item.landmark.visible = baseOpacity > 0.01 || active;
        item.material.opacity = (active ? Math.max(baseOpacity, 0.96) : baseOpacity) * landmarkReveal;
        item.landmark.scale.set(active ? 91 : 84, active ? 25 : 23, 1);
        item.landmark.lookAt(camera.position);
      }

      for (const item of proposalItems.values()) {
        const visible = mode === 'with-shipseal' && (domain === 'all' || item.domain === domain);
        const selected = selectedProposal === item.proposalId;
        const hovered = hoveredProposalId === item.proposalId;
        const excluded = excludedProposals.has(item.proposalId);
        const unrelated = Boolean(selectedProposal && !selected);
        const opacity = (!visible ? 0 : excluded ? 0.16 : selected ? 0.96 : hovered ? 0.82 : unrelated ? 0.3 : 0.58) * contextReveal;
        item.mesh.visible = opacity > 0.02;
        item.mesh.material.opacity = opacity;
        item.mesh.material.emissiveIntensity = selected ? visualTokens.selectedEmissiveIntensity : hovered ? visualTokens.priorityEmissiveIntensity : visualTokens.quietEmissiveIntensity;
        item.mesh.scale.setScalar(selected ? 1.28 : hovered ? 1.12 : 1);
        item.halo.visible = visible && !excluded && (selected || hovered || !selectedProposal);
        item.halo.material.opacity = (selected ? 0.22 : hovered ? 0.1 : 0.035) * contextReveal;
        item.halo.scale.setScalar(selected ? 1.24 + focusPulse * 0.04 : 1);
        const labelVisible = visible && repositoryUniverseProposalLabelVisible({
          selected,
          hovered,
          excluded,
          activeDomain: domain !== 'all',
          hasSelectedProposal: Boolean(selectedProposal),
          cameraRadius: radius,
          priorityIndex: item.priorityIndex,
        });
        item.label.visible = labelVisible;
        const desiredLabelOpacity = (!labelVisible ? 0 : selected ? 1 : hovered ? 0.94 : unrelated ? 0.42 : excluded ? 0.3 : 0.72) * contextReveal;
        item.labelMaterial.opacity = desiredLabelOpacity;
        item.label.position.set(item.position.x, item.position.y + (selected ? 13 : 10), item.position.z);
        item.label.scale.set(selected ? 48 : hovered ? 45 : 40, selected ? 16 : 14, 1);
        item.label.lookAt(camera.position);
        if (labelVisible) {
          labelCandidates.push({
            id: `proposal:${item.proposalId}`,
            sprite: item.label,
            material: item.labelMaterial,
            opacity: desiredLabelOpacity,
            priority: repositoryUniverseLabelPriority({
              selectedProposal: selected,
              hovered,
              activeDomain: domain !== 'all',
              importance: 'supporting',
            }),
            protected: selected || hovered,
          });
        }
      }
      applyDeterministicLabelCollisions(labelCandidates, camera, viewportWidth, viewportHeight);
    };

    const animate = () => {
      if (disposed) return;
      const now = performance.now();
      const elapsed = now - startedAt;
      beginRequestedFocus(now);
      if (!localSettled && (reducedMotionRef.current || !animateInRef.current || elapsed >= INITIAL_APPEARANCE_MS)) {
        finishReveal();
      }
      const pinnedSelectionActive = Boolean(selectedNodeIdRef.current && selectedNodeIdRef.current !== model.rootNodeId);
      if (!reducedMotionRef.current && !rotationPausedRef.current && !pinnedSelectionActive && !hoveredNodeId && routeNodeIdSetRef.current.size === 0 && localSettled && now - userInteractedAt > IDLE_ROTATION_DELAY_MS) {
        const state = cameraStateRef.current;
        cameraStateRef.current = { ...state, theta: state.theta + 0.00012 };
      }
      for (const item of nodeItems.values()) {
        const base = item.position;
        const appearance = repositoryUniverseRevealProgress(
          elapsed,
          repositoryUniverseRevealLayer(item.node, model.rootNodeId),
          !reducedMotionRef.current && animateInRef.current && !revealInterrupted,
        );
        const startScale = 0.72;
        item.mesh.position.set(
          base.x * startScale + base.x * (1 - startScale) * appearance,
          base.y * startScale + base.y * (1 - startScale) * appearance,
          base.z * startScale + base.z * (1 - startScale) * appearance,
        );
        item.hitTarget.position.copy(item.mesh.position);
        item.halo.position.copy(item.mesh.position);
        item.icon.position.copy(item.mesh.position);
        item.label.position.x = item.mesh.position.x;
        item.label.position.z = item.mesh.position.z;
      }
      applyCamera(now);
      updateVisualState(now);
      publishRequestedProjections(now);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handleCanvasPointerMove);
    canvas.addEventListener('pointerleave', handleCanvasPointerLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', preventDefault);

    return () => {
      disposed = true;
      cleanupDocumentDrag();
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handleCanvasPointerMove);
      canvas.removeEventListener('pointerleave', handleCanvasPointerLeave);
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
      clusterItems.forEach(item => item.texture.dispose());
      semanticIconTextureCache.forEach(texture => texture.dispose());
      sphereGeometryCache.forEach(geometry => geometry.dispose());
      renderer.dispose();
    };
  }, [model, theme, transformation, visualTokens]);

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-[440px] overflow-hidden bg-[hsl(var(--universe-stage-bg))]"
      data-testid="repository-universe-host"
      data-reveal-active={!settled && !reducedMotion ? 'true' : 'false'}
      data-motion-event={!settled && !reducedMotion ? 'universe-enter' : 'settled'}
      data-verification-overlay-count={Object.keys(verificationNodeStates).length}
    >
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
        data-semantic-zoom={repositoryUniverseSemanticZoomLevel(cameraState.radius)}
        data-selected-visible={!selectedNodeId || visibleNodeSet.has(selectedNodeId) ? 'true' : 'false'}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        data-rotation-paused={rotationPaused || reducedMotion ? 'true' : 'false'}
        data-settled={settled ? 'true' : 'false'}
        data-reveal-sequence="repository-landmarks-relationships-context"
      />
      {!settled && (
        <div
          data-testid="repository-universe-cinematic-reveal"
          className="repository-universe-intelligence-reveal pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,hsl(var(--accent)/0.08),transparent_38%),linear-gradient(180deg,hsl(var(--universe-stage-bg)/0.45),transparent_30%,transparent_72%,hsl(var(--universe-stage-bg)/0.52))] motion-reduce:hidden"
          aria-hidden="true"
        />
      )}
      <div className="sr-only">
        Drag to orbit, scroll or pinch to zoom, and click a node. Search and the Atlas 2D view provide non-visual access to the same repository entities.
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-primary/15 bg-[hsl(var(--universe-surface)/0.58)] px-3 py-1.5 text-[11px] text-muted-foreground shadow-[0_12px_40px_hsl(var(--universe-stage-bg)/0.45)] backdrop-blur-xl">
        {visibleNodeIds.length.toLocaleString()} visible - {model.summary.representedFileNodeCount.toLocaleString()} file nodes - {model.summary.folderNodeCount.toLocaleString()} folders
      </div>
      {webglUnavailable && (
        <div className="absolute inset-0 grid place-items-center bg-[hsl(var(--universe-stage-bg)/0.95)] p-8 text-center">
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

// Focused motion-contract tests consume this helper without requiring WebGL.
// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseRevealStartCamera(state: UniverseCameraState, enabled = true): UniverseCameraState {
  const target = clampCameraState(state);
  if (!enabled) return target;
  return {
    ...target,
    theta: target.theta - 0.11,
    phi: Math.max(0.24, Math.min(Math.PI - 0.24, target.phi + 0.06)),
    radius: Math.min(1500, Math.max(target.radius + 240, target.radius * 1.38)),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseWheelCameraState(
  state: UniverseCameraState,
  deltaY: number,
  fullscreen = false,
  anchor?: RepositoryUniversePosition,
): UniverseCameraState {
  const controlledDelta = Math.max(-140, Math.min(140, deltaY));
  const factor = Math.exp(controlledDelta * (fullscreen ? 0.00082 : 0.00062));
  const radius = Math.max(150, Math.min(1500, state.radius * factor));
  const zoomTowardAnchor = anchor && radius < state.radius
    ? Math.min(0.2, Math.max(0, 1 - radius / Math.max(1, state.radius)) * 0.72)
    : 0;
  return {
    ...state,
    radius,
    target: zoomTowardAnchor && anchor ? {
      x: state.target.x + (anchor.x - state.target.x) * zoomTowardAnchor,
      y: state.target.y + (anchor.y - state.target.y) * zoomTowardAnchor,
      z: state.target.z + (anchor.z - state.target.z) * zoomTowardAnchor,
    } : state.target,
  };
}

function createStarField(tokens: RepositoryUniverseRendererTokens = REPOSITORY_UNIVERSE_CINEMATIC_TOKENS) {
  const count = 320;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const palette = [
    tokens.starCool,
    tokens.starCool,
    tokens.starViolet,
    tokens.starWarm,
  ];

  for (let index = 0; index < count; index += 1) {
    const normalized = (index + 0.5) / count;
    const inclination = Math.acos(1 - 2 * normalized);
    const azimuth = goldenAngle * index;
    const radius = 680 + (index % 23) * 48;
    const offset = index * 3;
    positions[offset] = radius * Math.sin(inclination) * Math.cos(azimuth);
    positions[offset + 1] = radius * Math.cos(inclination) * 0.72;
    positions[offset + 2] = radius * Math.sin(inclination) * Math.sin(azimuth);
    color.setHex(palette[index % palette.length]);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: tokens.starSize,
    sizeAttenuation: false,
    transparent: true,
    opacity: tokens.starOpacity,
    depthWrite: false,
    vertexColors: true,
  });
  return new THREE.Points(geometry, material);
}

function nodeRadius(node: RepositoryUniverseNode) {
  if (node.kind === 'repository') return 7.8;
  if (node.kind === 'folder') return node.importance === 'supporting' ? 4.7 : 3.85;
  if (node.kind === 'concept' || node.kind === 'recommendation') return node.importance === 'primary' ? 4.75 : 3.45;
  if (node.importance === 'primary') return 4.7;
  if (node.importance === 'supporting') return 3.15;
  return 2.15;
}

function verificationOverlayColor(state: RepositoryVerificationNodeOverlayState) {
  return ({
    'verified-change': 0x2dd4bf,
    'partially-verified': 0x60a5fa,
    unresolved: 0xf59e0b,
    regressed: 0xef4444,
    'newly-detected': 0xa78bfa,
    unchanged: 0x64748b,
  })[state];
}

function colorForNode(
  node: RepositoryUniverseNode,
  selected?: boolean,
  matched?: boolean,
  route?: boolean,
  hovered?: boolean,
  connected?: boolean,
  tokens: RepositoryUniverseRendererTokens = REPOSITORY_UNIVERSE_CINEMATIC_TOKENS,
) {
  const baseColor = repositoryUniverseNodeBaseColor(node);
  if (tokens.mode === 'light') {
    if (selected) return blendHex(baseColor, tokens.selected, 0.56);
    if (hovered) return blendHex(baseColor, tokens.coreGlow, 0.32);
    if (route) return blendHex(baseColor, tokens.route, 0.5);
    if (matched) return blendHex(baseColor, tokens.search, 0.46);
    if (connected) return blendHex(baseColor, tokens.connectedEdge, 0.24);
    return baseColor;
  }
  if (selected) return brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.5);
  if (hovered) return brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.38);
  if (route) return blendHex(repositoryUniverseNodeBaseColor(node), tokens.route, 0.42);
  if (matched) return blendHex(repositoryUniverseNodeBaseColor(node), tokens.search, 0.36);
  if (connected) return brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.24);
  return repositoryUniverseNodeBaseColor(node);
}

// Focused visual-contract tests consume this deterministic helper alongside the renderer.
// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseNodeBaseColor(node: Pick<RepositoryUniverseNode, 'clusterId' | 'evidenceType' | 'importance'>) {
  const base = repositoryUniverseNodeClusterToken(node).hex;
  if (node.evidenceType === 'heuristic') return softenClusterColor(base, node.importance === 'background' ? 0.38 : 0.22);
  if (node.evidenceType === 'missing') return brightenClusterColor(base, 0.18);
  return node.importance === 'background' ? softenClusterColor(base, 0.16) : base;
}

function emissiveForNode(
  node: RepositoryUniverseNode,
  selected?: boolean,
  matched?: boolean,
  route?: boolean,
  hovered?: boolean,
  tokens: RepositoryUniverseRendererTokens = REPOSITORY_UNIVERSE_CINEMATIC_TOKENS,
) {
  if (selected) return tokens.selected;
  if (hovered) return tokens.coreGlow;
  if (route) return tokens.route;
  if (matched) return tokens.search;
  if (node.kind === 'repository') return tokens.repositoryEmissive;
  if (node.importance === 'primary') return tokens.primaryEmissive;
  return tokens.quietEmissive;
}

function colorForEdge(
  edge: RepositoryUniverseEdge,
  selected?: boolean,
  focused?: boolean,
  tokens: RepositoryUniverseRendererTokens = REPOSITORY_UNIVERSE_CINEMATIC_TOKENS,
) {
  if (selected) return edge.evidenceType === 'heuristic' ? tokens.heuristicEdge : tokens.evidenceEdge;
  if (focused) return tokens.connectedEdge;
  if (edge.evidenceType === 'heuristic') return tokens.heuristicEdge;
  if (edge.relationship === 'contains') return tokens.containsEdge;
  return tokens.relationshipEdge;
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
}) {
  if (state.selected || state.hovered || state.matched) return true;
  if (node.kind === 'repository') return true;
  if (state.connected && (state.cameraRadius < 980 || node.importance !== 'background')) return true;
  if (state.hasSelection && !state.connected && node.importance === 'background') return false;
  if (state.cameraRadius > LABEL_FAR_RADIUS) return node.kind === 'folder' && node.importance === 'supporting';
  if (state.cameraRadius > LABEL_MEDIUM_RADIUS) {
    return node.kind === 'folder' || node.importance === 'primary' || Boolean(state.connected && node.importance !== 'background');
  }
  if (state.focusedClusterId && state.focused && node.importance !== 'background') return true;
  return node.kind === 'folder' || node.importance !== 'background' || Boolean(state.connected);
}

// Focused visual-contract tests consume this deterministic hierarchy alongside the renderer.
// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseLabelPriority(state: {
  selected?: boolean;
  searched?: boolean;
  route?: boolean;
  selectedProposal?: boolean;
  hovered?: boolean;
  activeDomain?: boolean;
  repositoryRoot?: boolean;
  connected?: boolean;
  importance?: RepositoryUniverseNode['importance'];
}) {
  if (state.selected) return 900;
  if (state.searched) return 850;
  if (state.route) return 800;
  if (state.selectedProposal) return 750;
  if (state.hovered) return 700;
  if (state.activeDomain) return 650;
  if (state.repositoryRoot) return 600;
  if (state.importance === 'primary') return 500;
  if (state.connected) return 450;
  if (state.importance === 'supporting') return 300;
  return 100;
}

// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseProposalDisplayLabel(
  node: Pick<RepositoryTransformationProposedNode, 'label' | 'artifactPath'>,
  proposal?: Pick<RepositoryTransformationProposal, 'title' | 'artifactActions'>,
) {
  const label = node.label.trim();
  if (label && label.toLowerCase() !== 'proposed') return label;
  const artifactPath = node.artifactPath.trim() || proposal?.artifactActions[0]?.path?.trim() || '';
  const artifactName = artifactPath.split('/').filter(Boolean).pop();
  if (artifactName) return artifactName;
  const title = proposal?.title.trim();
  return title || 'Proposed artifact';
}

// eslint-disable-next-line react-refresh/only-export-components
export function repositoryUniverseProposalLabelVisible(state: {
  selected?: boolean;
  hovered?: boolean;
  excluded?: boolean;
  activeDomain?: boolean;
  hasSelectedProposal?: boolean;
  cameraRadius: number;
  priorityIndex: number;
}) {
  if (state.selected || state.hovered) return true;
  if (state.excluded || state.hasSelectedProposal) return false;
  if (state.activeDomain) return state.cameraRadius <= PROPOSAL_LABEL_FAR_RADIUS || state.priorityIndex < 3;
  if (state.cameraRadius > PROPOSAL_LABEL_FAR_RADIUS) return state.priorityIndex === 0;
  if (state.cameraRadius > LABEL_MEDIUM_RADIUS) return state.priorityIndex % 3 === 0;
  return state.priorityIndex % 2 === 0;
}

function labelOpacity(node: RepositoryUniverseNode, cameraRadius: number, selected?: boolean, hovered?: boolean, matched?: boolean, connected?: boolean) {
  if (selected || hovered || matched) return 1;
  if (connected) return 0.78;
  if (cameraRadius > LABEL_FAR_RADIUS) return node.kind === 'repository' ? 0.86 : 0.58;
  return node.importance === 'background' ? 0.44 : 0.68;
}

function labelScaleForNode(node: RepositoryUniverseNode, cameraRadius: number, priority?: boolean) {
  const zoomBoost = cameraRadius < LABEL_MEDIUM_RADIUS ? 1.08 : cameraRadius > LABEL_FAR_RADIUS ? 0.82 : 0.94;
  const baseWidth = node.kind === 'repository' ? 66 : priority ? 50 : 36;
  const baseHeight = node.kind === 'repository' ? 18 : priority ? 16 : 12;
  return { width: baseWidth * zoomBoost, height: baseHeight * zoomBoost };
}

function labelColorForNode(node: RepositoryUniverseNode, theme: ShipSealResolvedTheme = 'dark') {
  if (theme === 'light') {
    if (node.kind === 'repository') return '#0f3a42';
    if (node.evidenceType === 'missing') return '#8c3d12';
    if (node.evidenceType === 'heuristic') return '#374151';
    return '#18384a';
  }
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

function semanticIconTexture({
  semanticType,
  color,
  tokens,
  cache,
}: {
  semanticType: RepositoryUniverseSemanticType;
  color: number;
  tokens: RepositoryUniverseRendererTokens;
  cache: Map<string, THREE.CanvasTexture>;
}) {
  const key = `${tokens.mode}:${semanticType}:${color.toString(16)}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const center = 64;
    const gradient = context.createRadialGradient(center - 12, center - 14, 4, center, center, 51);
    gradient.addColorStop(0, hexCss(blendHex(tokens.iconSurface, color, tokens.mode === 'light' ? 0.08 : 0.16)));
    gradient.addColorStop(1, hexCss(tokens.iconSurface));
    context.beginPath();
    context.arc(center, center, 49, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = hexCss(blendHex(tokens.iconBorder, color, 0.46));
    context.stroke();
    context.beginPath();
    context.arc(center, center, 41, 0, Math.PI * 2);
    context.lineWidth = 1.5;
    context.globalAlpha = tokens.mode === 'light' ? 0.28 : 0.36;
    context.strokeStyle = hexCss(color);
    context.stroke();
    context.globalAlpha = 1;
    context.strokeStyle = hexCss(tokens.iconInk);
    drawRepositoryUniverseSemanticIcon(context, semanticType, center, center, 54);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

function clusterLandmarkSprite({
  label,
  count,
  semanticType,
  color,
  tokens,
}: {
  label: string;
  count: number;
  semanticType: RepositoryUniverseSemanticType;
  color: number;
  tokens: RepositoryUniverseRendererTokens;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = 82;
    const centerY = 91;
    const halo = context.createRadialGradient(centerX, centerY, 12, centerX, centerY, 72);
    halo.addColorStop(0, `${hexCss(color)}52`);
    halo.addColorStop(0.5, `${hexCss(color)}18`);
    halo.addColorStop(1, `${hexCss(color)}00`);
    context.fillStyle = halo;
    context.fillRect(0, 0, 164, 182);
    context.beginPath();
    context.arc(centerX, centerY, 42, 0, Math.PI * 2);
    context.fillStyle = `${hexCss(tokens.landmarkSurface)}e8`;
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = hexCss(blendHex(color, tokens.iconBorder, 0.34));
    context.stroke();
    context.strokeStyle = hexCss(tokens.landmarkInk);
    drawRepositoryUniverseSemanticIcon(context, semanticType, centerX, centerY, 46);
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = '650 38px Inter, system-ui, sans-serif';
    context.lineWidth = 10;
    context.strokeStyle = tokens.mode === 'light' ? 'rgba(246,250,249,0.94)' : 'rgba(2,7,16,0.86)';
    context.strokeText(shortLabel(label), 148, 76, 560);
    context.fillStyle = hexCss(tokens.landmarkInk);
    context.fillText(shortLabel(label), 148, 76, 560);
    context.font = '600 22px Inter, system-ui, sans-serif';
    context.globalAlpha = 0.72;
    context.fillText(`${count.toLocaleString()} entities`, 148, 119, 520);
    context.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
  return { sprite: new THREE.Sprite(material), material, texture };
}

function labelSprite(label: string, color: string, theme: ShipSealResolvedTheme = 'dark', secondaryLabel?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '600 28px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    if (secondaryLabel) {
      context.fillStyle = theme === 'light' ? 'rgba(250, 248, 255, 0.88)' : 'rgba(5, 9, 20, 0.72)';
      roundRect(context, 34, 22, 444, 84, 24);
      context.fill();
    }
    context.lineWidth = theme === 'light' ? 9 : 8;
    context.strokeStyle = theme === 'light' ? 'rgba(248, 251, 250, 0.94)' : 'rgba(2, 6, 15, 0.88)';
    context.strokeText(label, 256, secondaryLabel ? 51 : 64, 400);
    context.fillStyle = color;
    context.fillText(label, 256, secondaryLabel ? 51 : 64, 400);
    if (secondaryLabel) {
      context.globalAlpha = 0.76;
      context.font = '600 17px Inter, system-ui, sans-serif';
      context.fillText(secondaryLabel, 256, 83, 360);
      context.globalAlpha = 1;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
  return { sprite: new THREE.Sprite(material), material, texture };
}

function hexCss(value: number) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function applyDeterministicLabelCollisions(
  candidates: LabelCollisionCandidate[],
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number,
) {
  const accepted: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  const projected = new THREE.Vector3();
  candidates.sort((first, second) => second.priority - first.priority || first.id.localeCompare(second.id));
  for (const candidate of candidates) {
    projected.copy(candidate.sprite.position).project(camera);
    if (projected.z < -1 || projected.z > 1) {
      candidate.sprite.visible = false;
      candidate.material.opacity = 0;
      continue;
    }
    const centerX = (projected.x * 0.5 + 0.5) * viewportWidth;
    const centerY = (-projected.y * 0.5 + 0.5) * viewportHeight;
    const width = Math.max(72, Math.min(164, candidate.sprite.scale.x * 2.6));
    const height = Math.max(24, candidate.sprite.scale.y * 2);
    const rect = {
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: centerY - height / 2,
      bottom: centerY + height / 2,
    };
    const collides = accepted.some(existing => rect.left < existing.right && rect.right > existing.left && rect.top < existing.bottom && rect.bottom > existing.top);
    if (collides && !candidate.protected) {
      candidate.sprite.visible = false;
      candidate.material.opacity = 0;
      continue;
    }
    candidate.sprite.visible = true;
    candidate.material.opacity = candidate.opacity;
    accepted.push(rect);
  }
}

function shortLabel(label: string) {
  if (label.length <= 22) return label;
  return `${label.slice(0, 19)}...`;
}

function visualPositionFor(position: RepositoryUniversePosition, isRoot = false) {
  if (isRoot) return new THREE.Vector3(position.x, position.y, position.z);
  return new THREE.Vector3(position.x * 0.96, position.y * 0.78, position.z * 0.96);
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

function vectorDistance(first: RepositoryUniversePosition, second: RepositoryUniversePosition) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function cameraStateDistance(first: UniverseCameraState, second: UniverseCameraState) {
  return Math.abs(first.radius - second.radius)
    + Math.abs(first.theta - second.theta) * 100
    + Math.abs(first.phi - second.phi) * 100
    + vectorDistance(first.target, second.target);
}

function lerpAngle(current: number, desired: number, amount: number) {
  let delta = desired - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * amount;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function interpolateCameraState(from: UniverseCameraState, to: UniverseCameraState, amount: number): UniverseCameraState {
  return {
    theta: lerpAngle(from.theta, to.theta, amount),
    phi: from.phi + (to.phi - from.phi) * amount,
    radius: from.radius + (to.radius - from.radius) * amount,
    target: {
      x: from.target.x + (to.target.x - from.target.x) * amount,
      y: from.target.y + (to.target.y - from.target.y) * amount,
      z: from.target.z + (to.target.z - from.target.z) * amount,
    },
  };
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
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

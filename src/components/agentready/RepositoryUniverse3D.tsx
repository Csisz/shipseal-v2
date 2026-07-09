import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RepositoryTransformationDomainFilter, RepositoryTransformationMode, RepositoryTransformationProposalModel, RepositoryUniverseCluster, RepositoryUniverseEdge, RepositoryUniverseModel, RepositoryUniverseNode, RepositoryUniversePosition } from '@/lib/workspace';
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

interface NodeRenderItem {
  node: RepositoryUniverseNode;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
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

interface ClusterRenderItem {
  cluster: RepositoryUniverseCluster;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
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
}

interface ProposalEdgeRenderItem {
  proposalId: string;
  domain: string;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
}

const INITIAL_APPEARANCE_MS = 1400;
const IDLE_ROTATION_DELAY_MS = 3600;
const LABEL_FAR_RADIUS = 720;
const LABEL_MEDIUM_RADIUS = 420;
const LAYOUT_SPREAD_XZ = 0.96;
const LAYOUT_SPREAD_Y = 0.78;

export default function RepositoryUniverse3D({
  model,
  selectedNodeId,
  focusedClusterId,
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
  const searchMatchSetRef = useRef(new Set(searchMatchIds));
  const visibleNodeSetRef = useRef(new Set(visibleNodeIds));
  const visibleEdgeSetRef = useRef(new Set(visibleEdgeIds));
  const rotationPausedRef = useRef(rotationPaused);
  const reducedMotionRef = useRef(reducedMotion);
  const animateInRef = useRef(animateIn);
  const transformationModeRef = useRef(transformationMode);
  const transformationDomainRef = useRef(transformationDomain);
  const selectedProposalIdRef = useRef(selectedProposalId);
  const excludedProposalSetRef = useRef(new Set(excludedProposalIds));
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
  }, [selectedNodeId]);

  useEffect(() => {
    focusedClusterIdRef.current = focusedClusterId;
  }, [focusedClusterId]);

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
    let frameId = 0;
    let disposed = false;
    let pointerMode: PointerMode | null = null;
    let pointerStart = { x: 0, y: 0 };
    let pointerLast = { x: 0, y: 0 };
    let pointerMoved = false;
    let hoveredNodeId: string | null = null;
    let userInteractedAt = performance.now();
    let localSettled = reducedMotionRef.current || !animateInRef.current;
    let lastPublishedCamera = cameraStateRef.current;
    const startedAt = performance.now();

    renderer.setClearColor(0x050914, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fullscreen ? 1.5 : 1.35));

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
      clusterItems.set(cluster.id, { cluster, ring });
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
      edgeItems.set(edge.id, { edge, line });
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

        const { sprite: label, material: labelMaterial, texture } = labelSprite('Proposed', '#e0faff');
        label.position.set(position.x, position.y + 12, position.z);
        label.scale.set(44, 13, 1);
        scene.add(label);

        proposalItems.set(proposal.id, { proposalId: proposal.id, domain: proposal.domain, mesh, halo, label, labelMaterial, labelTexture: texture, position });
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
        proposalEdgeItems.set(edge.id, { proposalId: proposal.id, domain: proposal.domain, line });
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

      const { sprite: label, material: labelMaterial, texture } = labelSprite(shortLabel(displayLabel), labelColorForNode(node));
      label.position.set(position.x, position.y + baseRadius + 5, position.z);
      label.scale.set(node.kind === 'repository' ? 70 : 42, node.kind === 'repository' ? 20 : 14, 1);
      scene.add(label);

      nodeItems.set(node.id, { node, mesh, halo, label, labelMaterial, labelTexture: texture, baseRadius, position });
    }

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(320, rect.width);
      const height = Math.max(320, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
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

    const applyCamera = () => {
      const desired = clampCameraState(cameraStateRef.current);
      const current = renderCameraStateRef.current;
      const damping = reducedMotionRef.current ? 1 : 0.18;
      const next = {
        theta: lerpAngle(current.theta, desired.theta, damping),
        phi: current.phi + (desired.phi - current.phi) * damping,
        radius: current.radius + (desired.radius - current.radius) * damping,
        target: {
          x: current.target.x + (desired.target.x - current.target.x) * damping,
          y: current.target.y + (desired.target.y - current.target.y) * damping,
          z: current.target.z + (desired.target.z - current.target.z) * damping,
        },
      };
      renderCameraStateRef.current = next;
      const phi = Math.max(0.18, Math.min(Math.PI - 0.18, next.phi));
      const x = next.target.x + next.radius * Math.sin(phi) * Math.cos(next.theta);
      const y = next.target.y + next.radius * Math.cos(phi);
      const z = next.target.z + next.radius * Math.sin(phi) * Math.sin(next.theta);
      camera.position.set(x, y, z);
      camera.lookAt(next.target.x, next.target.y, next.target.z);
    };

    const setPointer = (event: Pick<PointerEvent | MouseEvent, 'clientX' | 'clientY'>) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const intersectEntity = () => {
      raycaster.setFromCamera(pointer, camera);
      const meshes = [
        ...[...nodeItems.values()].filter(item => item.mesh.visible).map(item => item.mesh),
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
            theta: state.theta - dx * (fullscreen ? 0.0042 : 0.0032),
            phi: Math.max(0.24, Math.min(Math.PI - 0.24, state.phi - dy * (fullscreen ? 0.0042 : 0.0032))),
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
      hoveredNodeId = intersectEntity().nodeId || null;
    };

    const cleanupDocumentDrag = () => {
      window.removeEventListener('pointermove', handleDragPointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.button !== 2) return;
      setPointer(event);
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
        const { nodeId, proposalId } = intersectEntity();
        if (nodeId) onSelectNodeRef.current(nodeId);
        if (proposalId) onSelectProposalRef.current?.(proposalId);
      }
      event.preventDefault();
    }

    const handleWheel = (event: WheelEvent) => {
      const state = cameraStateRef.current;
      const factor = Math.exp(event.deltaY * (fullscreen ? 0.0009 : 0.00068));
      const nextRadius = Math.max(150, Math.min(1500, state.radius * factor));
      publishCamera({ ...state, radius: nextRadius });
      userInteractedAt = performance.now();
      event.preventDefault();
    };

    const handleDoubleClick = (event: MouseEvent) => {
      setPointer(event);
      const { nodeId, proposalId } = intersectEntity();
      if (proposalId) {
        onSelectProposalRef.current?.(proposalId);
        return;
      }
      const node = nodeId ? nodeById.get(nodeId) : undefined;
      if (!node) return;
      const target = visualPositionByNodeId.get(node.id) || visualPositionFor(node.position, node.id === model.rootNodeId);
      publishCamera({
        ...cameraStateRef.current,
        radius: node.kind === 'file' ? 220 : 300,
        target,
      }, true);
      onSelectNodeRef.current(node.id);
      onFocusNodeSettledRef.current?.(node.id);
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

    const updateVisualState = () => {
      const selectedId = selectedNodeIdRef.current;
      const focusedCluster = focusedClusterIdRef.current;
      const searchMatches = searchMatchSetRef.current;
      const visibleNodes = visibleNodeSetRef.current;
      const visibleEdges = visibleEdgeSetRef.current;
      const mode = transformationModeRef.current;
      const domain = transformationDomainRef.current;
      const selectedProposal = selectedProposalIdRef.current;
      const excludedProposals = excludedProposalSetRef.current;
      const selectedRelated = relatedNodeIdsForSelection(selectedId);

      const selectedClusterId = selectedId ? nodeItems.get(selectedId)?.node.clusterId : null;
      const selectedRelatedClusterIds = new Set<string>();
      for (const nodeId of selectedRelated) {
        const clusterId = nodeItems.get(nodeId)?.node.clusterId;
        if (clusterId) selectedRelatedClusterIds.add(clusterId);
      }

      for (const item of clusterItems.values()) {
        const active = Boolean(focusedCluster && item.cluster.id === focusedCluster) || item.cluster.id === selectedClusterId;
        const related = selectedRelatedClusterIds.has(item.cluster.id);
        item.ring.visible = true;
        item.ring.material.opacity = active
          ? 0.09
          : related
            ? 0.045
            : focusedCluster || selectedId
              ? 0.012
              : 0.022;
        item.ring.material.color.setHex(colorForCluster(item.cluster, active, related));
      }

      for (const item of edgeItems.values()) {
        const { edge, line } = item;
        const directlySelected = Boolean(selectedId && (edge.source === selectedId || edge.target === selectedId));
        const focused = Boolean(focusedCluster && nodeById.get(edge.source)?.clusterId === focusedCluster && nodeById.get(edge.target)?.clusterId === focusedCluster);
        const visible = visibleEdges.has(edge.id);
        line.visible = visible;
        line.material.opacity = !visible
          ? 0
          : directlySelected
            ? edge.evidenceType === 'heuristic' ? 0.38 : 0.56
            : focused
              ? 0.25
              : edge.relationship === 'contains'
                ? selectedId || focusedCluster ? 0.035 : 0.05
                : selectedId || focusedCluster ? 0.08 : 0.12;
        line.material.color.setHex(colorForEdge(edge, directlySelected, focused));
      }

      for (const item of proposalEdgeItems.values()) {
        const visible = mode === 'with-shipseal' && (domain === 'all' || item.domain === domain);
        const selected = selectedProposal === item.proposalId;
        const excluded = excludedProposals.has(item.proposalId);
        item.line.visible = visible;
        item.line.material.opacity = !visible ? 0 : excluded ? 0.09 : selected ? 0.56 : 0.26;
        item.line.material.color.setHex(selected ? 0xe0faff : 0x9bdcf3);
      }

      const radius = cameraStateRef.current.radius;
      for (const item of nodeItems.values()) {
        const { node, mesh, halo, label, labelMaterial, baseRadius } = item;
        const visible = visibleNodes.has(node.id);
        const selected = node.id === selectedId;
        const hovered = node.id === hoveredNodeId;
        const matched = searchMatches.has(node.id);
        const connected = selectedRelated.has(node.id);
        const focused = !focusedCluster || node.clusterId === focusedCluster || node.id === model.rootNodeId;
        const quiet = Boolean(selectedId && !selected && !connected && !matched && node.id !== model.rootNodeId);
        const suppressed = Boolean(focusedCluster && !focused && !selected && !matched);
        const opacity = !visible ? 0 : selected ? 1 : hovered || matched ? 0.98 : connected ? 0.92 : quiet || suppressed ? 0.3 : node.importance === 'background' ? 0.58 : 0.86;
        const scale = selected ? 2.18 : hovered ? 1.58 : matched ? 1.48 : connected ? 1.32 : node.importance === 'primary' ? 1.08 : 1;

        mesh.visible = opacity > 0.02;
        mesh.material.opacity = opacity;
        mesh.material.color.setHex(colorForNode(node, selected, matched, hovered, connected));
        mesh.material.emissive.setHex(emissiveForNode(node, selected, matched, hovered));
        mesh.material.emissiveIntensity = selected ? 1.25 : hovered || matched ? 0.78 : connected ? 0.54 : node.importance === 'primary' ? 0.32 : 0.09;
        mesh.material.wireframe = node.evidenceType === 'missing' || node.kind === 'recommendation';
        mesh.scale.setScalar(scale);

        halo.visible = visible && (selected || hovered || matched || connected);
        halo.material.opacity = selected ? 0.58 : hovered ? 0.25 : matched ? 0.22 : connected ? 0.13 : 0;
        halo.material.color.setHex(selected ? 0xe0faff : connected ? brightenClusterColor(repositoryUniverseNodeBaseColor(node), 0.16) : 0x67e8f9);
        halo.scale.setScalar(selected ? 1.5 : connected ? 1.16 : 1);

        const labelVisible = visible && shouldRenderLabel(node, {
          selected,
          hovered,
          matched,
          connected,
          focused,
          focusedClusterId: focusedCluster,
          hasSelection: Boolean(selectedId),
          cameraRadius: radius,
        });
        label.visible = labelVisible;
        labelMaterial.opacity = labelVisible ? labelOpacity(node, radius, selected, hovered, matched, connected) : 0;
        label.position.set(item.position.x, item.position.y + baseRadius * scale + 5, item.position.z);
        const labelScale = labelScaleForNode(node, radius, selected || hovered || matched);
        label.scale.set(labelScale.width, labelScale.height, 1);
        label.lookAt(camera.position);
      }

      for (const item of proposalItems.values()) {
        const visible = mode === 'with-shipseal' && (domain === 'all' || item.domain === domain);
        const selected = selectedProposal === item.proposalId;
        const excluded = excludedProposals.has(item.proposalId);
        const opacity = !visible ? 0 : excluded ? 0.24 : selected ? 0.92 : 0.66;
        item.mesh.visible = opacity > 0.02;
        item.mesh.material.opacity = opacity;
        item.mesh.scale.setScalar(selected ? 1.34 : 1);
        item.halo.visible = visible && !excluded;
        item.halo.material.opacity = selected ? 0.26 : 0.12;
        item.label.visible = visible;
        item.labelMaterial.opacity = visible ? excluded ? 0.34 : selected ? 0.94 : 0.7 : 0;
        item.label.position.set(item.position.x, item.position.y + (selected ? 16 : 12), item.position.z);
        item.label.lookAt(camera.position);
      }
    };

    const animate = () => {
      if (disposed) return;
      const now = performance.now();
      const elapsed = now - startedAt;
      if (!reducedMotionRef.current && animateInRef.current && elapsed > INITIAL_APPEARANCE_MS && !localSettled) {
        localSettled = true;
        setSettled(true);
        onSceneSettledRef.current?.();
      }
      if (!reducedMotionRef.current && !rotationPausedRef.current && elapsed > INITIAL_APPEARANCE_MS && now - userInteractedAt > IDLE_ROTATION_DELAY_MS) {
        const state = cameraStateRef.current;
        cameraStateRef.current = { ...state, theta: state.theta + 0.0007 };
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
      applyCamera();
      updateVisualState();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handleCanvasPointerMove);
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

function labelColorForNode(node: RepositoryUniverseNode) {
  if (node.kind === 'repository') return '#ecfeff';
  if (node.evidenceType === 'missing') return '#fed7aa';
  if (node.evidenceType === 'heuristic') return '#cbd5e1';
  return '#e5f7ff';
}

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

function vectorDistance(first: RepositoryUniversePosition, second: RepositoryUniversePosition) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
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

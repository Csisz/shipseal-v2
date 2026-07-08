import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RepositoryUniverseEdge, RepositoryUniverseModel, RepositoryUniverseNode, RepositoryUniversePosition } from '@/lib/workspace';

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
  onCameraStateChange: (state: UniverseCameraState) => void;
  onSelectNode: (nodeId: string) => void;
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
}

interface EdgeRenderItem {
  edge: RepositoryUniverseEdge;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}

const INITIAL_APPEARANCE_MS = 1400;
const IDLE_ROTATION_DELAY_MS = 3600;
const LABEL_FAR_RADIUS = 720;
const LABEL_MEDIUM_RADIUS = 420;

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
  onCameraStateChange,
  onSelectNode,
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
  const onCameraStateChangeRef = useRef(onCameraStateChange);
  const onSelectNodeRef = useRef(onSelectNode);
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
    onCameraStateChangeRef.current = onCameraStateChange;
  }, [onCameraStateChange]);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

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

    for (const edge of model.edges) {
      const source = model.nodes.find(node => node.id === edge.source);
      const target = model.nodes.find(node => node.id === edge.target);
      if (!source || !target) continue;
      const material = new THREE.LineBasicMaterial({
        color: edge.evidenceType === 'evidence' ? 0x5eead4 : 0x94a3b8,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      });
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(source.position.x, source.position.y, source.position.z),
        new THREE.Vector3(target.position.x, target.position.y, target.position.z),
      ]);
      const line = new THREE.Line(geometry, material);
      edgeItems.set(edge.id, { edge, line });
      scene.add(line);
    }

    for (const node of model.nodes) {
      const baseRadius = nodeRadius(node);
      const material = new THREE.MeshStandardMaterial({
        color: colorForNode(node),
        emissive: emissiveForNode(node),
        emissiveIntensity: node.importance === 'primary' ? 0.34 : 0.1,
        metalness: 0.16,
        roughness: 0.42,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(sphereFor(baseRadius), material);
      mesh.position.set(node.position.x, node.position.y, node.position.z);
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

      const { sprite, material: labelMaterial, texture } = labelSprite(shortLabel(node.label), labelColorForNode(node));
      label.position.set(node.position.x, node.position.y + baseRadius + 5, node.position.z);
      label.scale.set(node.kind === 'repository' ? 70 : 42, node.kind === 'repository' ? 20 : 14, 1);
      scene.add(label);

      nodeItems.set(node.id, { node, mesh, halo, label, labelMaterial, labelTexture: texture, baseRadius });
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

    const intersectNode = () => {
      raycaster.setFromCamera(pointer, camera);
      const meshes = [...nodeItems.values()]
        .filter(item => item.mesh.visible)
        .map(item => item.mesh);
      const intersect = raycaster.intersectObjects(meshes, false)[0];
      return intersect?.object.userData.nodeId as string | undefined;
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
          const panScale = state.radius / 760;
          const theta = state.theta;
          publishCamera({
            ...state,
            target: {
              x: state.target.x - Math.cos(theta) * dx * panScale + Math.sin(theta) * dy * panScale * 0.16,
              y: state.target.y + dy * panScale * 0.72,
              z: state.target.z - Math.sin(theta) * dx * panScale - Math.cos(theta) * dy * panScale * 0.16,
            },
          });
        } else {
          publishCamera({
            ...state,
            theta: state.theta - dx * 0.0048,
            phi: Math.max(0.22, Math.min(Math.PI - 0.22, state.phi - dy * 0.0048)),
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
      hoveredNodeId = intersectNode() || null;
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
        const nodeId = intersectNode();
        if (nodeId) onSelectNodeRef.current(nodeId);
      }
      event.preventDefault();
    }

    const handleWheel = (event: WheelEvent) => {
      const state = cameraStateRef.current;
      const factor = Math.exp(event.deltaY * 0.0011);
      const nextRadius = Math.max(100, Math.min(1700, state.radius * factor));
      publishCamera({ ...state, radius: nextRadius });
      userInteractedAt = performance.now();
      event.preventDefault();
    };

    const handleDoubleClick = (event: MouseEvent) => {
      setPointer(event);
      const nodeId = intersectNode();
      const node = model.nodes.find(item => item.id === nodeId);
      if (!node) return;
      publishCamera({
        ...cameraStateRef.current,
        radius: node.kind === 'file' ? 165 : 230,
        target: node.position,
      }, true);
      onSelectNodeRef.current(node.id);
      onFocusNodeSettledRef.current?.(node.id);
    };

    const updateVisualState = () => {
      const selectedId = selectedNodeIdRef.current;
      const focusedCluster = focusedClusterIdRef.current;
      const searchMatches = searchMatchSetRef.current;
      const visibleNodes = visibleNodeSetRef.current;
      const visibleEdges = visibleEdgeSetRef.current;
      const selectedRelated = new Set<string>();

      if (selectedId) {
        selectedRelated.add(selectedId);
        for (const item of edgeItems.values()) {
          if (item.edge.source === selectedId || item.edge.target === selectedId) {
            selectedRelated.add(item.edge.source);
            selectedRelated.add(item.edge.target);
          }
        }
      }

      for (const item of edgeItems.values()) {
        const { edge, line } = item;
        const directlySelected = Boolean(selectedId && (edge.source === selectedId || edge.target === selectedId));
        const focused = Boolean(focusedCluster && model.nodes.find(node => node.id === edge.source)?.clusterId === focusedCluster && model.nodes.find(node => node.id === edge.target)?.clusterId === focusedCluster);
        const visible = visibleEdges.has(edge.id);
        line.visible = visible;
        line.material.opacity = !visible
          ? 0
          : directlySelected
            ? 0.58
            : focused
              ? 0.25
              : edge.relationship === 'contains'
                ? 0.035
                : 0.09;
        line.material.color.setHex(directlySelected ? 0xf8fafc : edge.evidenceType === 'evidence' ? 0x5eead4 : 0x94a3b8);
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
        const opacity = !visible ? 0 : selected ? 1 : hovered || matched ? 0.96 : quiet || suppressed ? 0.18 : node.importance === 'background' ? 0.54 : 0.82;
        const scale = selected ? 1.9 : hovered ? 1.55 : matched ? 1.45 : connected ? 1.18 : 1;

        mesh.visible = opacity > 0.02;
        mesh.material.opacity = opacity;
        mesh.material.color.setHex(colorForNode(node, selected, matched, hovered));
        mesh.material.emissive.setHex(emissiveForNode(node, selected, matched, hovered));
        mesh.material.emissiveIntensity = selected ? 1.1 : hovered || matched ? 0.72 : connected ? 0.36 : node.importance === 'primary' ? 0.28 : 0.08;
        mesh.scale.setScalar(scale);

        halo.visible = visible && (selected || hovered || matched);
        halo.material.opacity = selected ? 0.34 : hovered ? 0.22 : matched ? 0.18 : 0;
        halo.scale.setScalar(selected ? 1.25 : 1);

        const labelVisible = visible && shouldRenderLabel(node, {
          selected,
          hovered,
          matched,
          connected,
          focused,
          focusedClusterId: focusedCluster,
          cameraRadius: radius,
        });
        label.visible = labelVisible;
        labelMaterial.opacity = labelVisible ? labelOpacity(node, radius, selected, hovered, matched, connected) : 0;
        label.position.set(node.position.x, node.position.y + baseRadius * scale + 5, node.position.z);
        const labelScale = labelScaleForNode(node, radius, selected || hovered || matched);
        label.scale.set(labelScale.width, labelScale.height, 1);
        label.lookAt(camera.position);
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
        const base = item.node.position;
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
      sphereGeometryCache.forEach(geometry => geometry.dispose());
      renderer.dispose();
    };
  }, [model]);

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
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-primary/20 bg-background/55 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        Drag to orbit - Scroll to zoom - Right-drag to pan - Click a node
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
  if (node.kind === 'repository') return 7.2;
  if (node.kind === 'folder') return node.importance === 'supporting' ? 4.4 : 3.6;
  if (node.importance === 'primary') return 4.5;
  if (node.importance === 'supporting') return 3.2;
  return 2.05;
}

function colorForNode(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean, hovered?: boolean) {
  if (selected) return 0xf8fafc;
  if (hovered) return 0xbfdbfe;
  if (matched) return 0xfacc15;
  if (node.kind === 'repository') return 0x67e8f9;
  if (node.kind === 'folder') return 0x60a5fa;
  if (node.evidenceType === 'heuristic') return 0x94a3b8;
  if (node.metadata.category === 'documentation') return 0xa78bfa;
  if (node.metadata.category === 'agent-instruction') return 0x5eead4;
  if (node.metadata.category === 'test') return 0x86efac;
  if (node.metadata.category === 'workflow') return 0x38bdf8;
  if (node.metadata.category === 'configuration') return 0xc4b5fd;
  if (node.metadata.category === 'asset') return 0xf0abfc;
  return node.importance === 'background' ? 0x64748b : 0x93c5fd;
}

function emissiveForNode(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean, hovered?: boolean) {
  if (selected || hovered) return 0x67e8f9;
  if (matched) return 0xfacc15;
  if (node.kind === 'repository') return 0x0891b2;
  if (node.importance === 'primary') return 0x1d4ed8;
  return 0x0f172a;
}

function shouldRenderLabel(node: RepositoryUniverseNode, state: {
  selected?: boolean;
  hovered?: boolean;
  matched?: boolean;
  connected?: boolean;
  focused?: boolean;
  focusedClusterId?: string | null;
  cameraRadius: number;
}) {
  if (state.selected || state.hovered || state.matched) return true;
  if (node.kind === 'repository') return true;
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
  if (node.kind === 'folder') return '#bae6fd';
  if (node.evidenceType === 'heuristic') return '#cbd5e1';
  return '#e5f7ff';
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

function clampCameraState(state: UniverseCameraState): UniverseCameraState {
  return {
    theta: state.theta,
    phi: Math.max(0.2, Math.min(Math.PI - 0.2, state.phi)),
    radius: Math.max(100, Math.min(1700, state.radius)),
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

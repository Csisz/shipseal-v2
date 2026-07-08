import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RepositoryUniverseModel, RepositoryUniverseNode, RepositoryUniversePosition } from '@/lib/workspace';

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
  cameraState: UniverseCameraState;
  rotationPaused: boolean;
  reducedMotion: boolean;
  fullscreen?: boolean;
  onCameraStateChange: (state: UniverseCameraState) => void;
  onSelectNode: (nodeId: string) => void;
  onFocusNodeSettled?: (nodeId: string) => void;
}

type PointerMode = 'orbit' | 'pan';

const INITIAL_APPEARANCE_MS = 2200;

export default function RepositoryUniverse3D({
  model,
  selectedNodeId,
  focusedClusterId,
  searchMatchIds,
  cameraState,
  rotationPaused,
  reducedMotion,
  fullscreen = false,
  onCameraStateChange,
  onSelectNode,
  onFocusNodeSettled,
}: RepositoryUniverse3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStateRef = useRef(cameraState);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [settled, setSettled] = useState(reducedMotion);
  const searchMatchSet = useMemo(() => new Set(searchMatchIds), [searchMatchIds]);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    const selectedNode = model.nodes.find(node => node.id === selectedNodeId);
    if (!selectedNode) return;
    const current = cameraStateRef.current;
    const nextState = {
      ...current,
      radius: Math.max(110, Math.min(current.radius, selectedNode.kind === 'file' ? 240 : 320)),
      target: selectedNode.position,
    };
    cameraStateRef.current = nextState;
    onCameraStateChange(nextState);
    onFocusNodeSettled?.(selectedNode.id);
  }, [model.nodes, onCameraStateChange, onFocusNodeSettled, selectedNodeId]);

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
    setSettled(reducedMotion);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const nodeMeshes: THREE.Mesh[] = [];
    const labelSprites: THREE.Sprite[] = [];
    let frameId = 0;
    let disposed = false;
    let pointerMode: PointerMode | null = null;
    let pointerStart = { x: 0, y: 0 };
    let pointerLast = { x: 0, y: 0 };
    let userInteractedAt = 0;
    let localSettled = reducedMotion;
    const reducedStart = performance.now();

    renderer.setClearColor(0x050914, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fullscreen ? 1.75 : 1.5));

    scene.add(new THREE.AmbientLight(0x8fb9ff, 1.5));
    const directional = new THREE.DirectionalLight(0xd8f7ff, 1.9);
    directional.position.set(220, 360, 180);
    scene.add(directional);
    const centerGlow = new THREE.PointLight(0x6ee7ff, 1.4, 680);
    centerGlow.position.set(0, 0, 0);
    scene.add(centerGlow);

    const clusterSet = new Set(model.clusters.map(cluster => cluster.id));
    const edgeMaterialEvidence = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.24 });
    const edgeMaterialHeuristic = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.12 });

    for (const edge of model.edges) {
      const source = model.nodes.find(node => node.id === edge.source);
      const target = model.nodes.find(node => node.id === edge.target);
      if (!source || !target) continue;
      const selected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
      const focused = focusedClusterId && source.clusterId === focusedClusterId && target.clusterId === focusedClusterId;
      const showQuiet = edge.relationship === 'contains' && source.kind !== 'repository' && !selected && !focused;
      const material = edge.evidenceType === 'evidence' ? edgeMaterialEvidence.clone() : edgeMaterialHeuristic.clone();
      material.opacity = selected ? 0.72 : focused ? 0.42 : showQuiet ? 0.055 : material.opacity;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(source.position.x, source.position.y, source.position.z),
        new THREE.Vector3(target.position.x, target.position.y, target.position.z),
      ]);
      const line = new THREE.Line(geometry, material);
      scene.add(line);
    }

    const sphereGeometryCache = new Map<number, THREE.SphereGeometry>();
    const sphereFor = (radius: number) => {
      const rounded = Math.round(radius * 10) / 10;
      const existing = sphereGeometryCache.get(rounded);
      if (existing) return existing;
      const geometry = new THREE.SphereGeometry(rounded, rounded > 7 ? 28 : 16, rounded > 7 ? 20 : 12);
      sphereGeometryCache.set(rounded, geometry);
      return geometry;
    };

    for (const node of model.nodes) {
      const selected = node.id === selectedNodeId;
      const matched = searchMatchSet.has(node.id);
      const focused = !focusedClusterId || node.clusterId === focusedClusterId || node.id === model.rootNodeId;
      const material = new THREE.MeshStandardMaterial({
        color: colorForNode(node, selected, matched),
        emissive: emissiveForNode(node, selected, matched),
        emissiveIntensity: selected ? 1.4 : matched ? 0.9 : node.importance === 'primary' ? 0.45 : 0.16,
        metalness: 0.18,
        roughness: 0.38,
        transparent: true,
        opacity: focused ? 1 : 0.26,
      });
      const radius = selected ? node.radius * 1.7 : matched ? node.radius * 1.45 : node.radius;
      const mesh = new THREE.Mesh(sphereFor(radius), material);
      mesh.position.set(node.position.x, node.position.y, node.position.z);
      mesh.userData.nodeId = node.id;
      nodeMeshes.push(mesh);
      scene.add(mesh);

      if (shouldRenderLabel(node, selected, matched, focusedClusterId)) {
        const sprite = labelSprite(shortLabel(node.label), selected ? '#f8fafc' : node.kind === 'folder' ? '#bae6fd' : '#cbd5e1');
        sprite.position.set(node.position.x, node.position.y + radius + 7, node.position.z);
        sprite.scale.set(selected ? 74 : node.kind === 'repository' ? 92 : 54, selected ? 24 : 18, 1);
        labelSprites.push(sprite);
        scene.add(sprite);
      }
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

    const applyCamera = () => {
      const state = cameraStateRef.current;
      const phi = Math.max(0.18, Math.min(Math.PI - 0.18, state.phi));
      const x = state.target.x + state.radius * Math.sin(phi) * Math.cos(state.theta);
      const y = state.target.y + state.radius * Math.cos(phi);
      const z = state.target.z + state.radius * Math.sin(phi) * Math.sin(state.theta);
      camera.position.set(x, y, z);
      camera.lookAt(state.target.x, state.target.y, state.target.z);
    };

    const publishCamera = (state: UniverseCameraState) => {
      cameraStateRef.current = state;
      onCameraStateChange(state);
    };

    const setPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture?.(event.pointerId);
      pointerMode = event.button === 2 ? 'pan' : 'orbit';
      pointerStart = { x: event.clientX, y: event.clientY };
      pointerLast = pointerStart;
      userInteractedAt = performance.now();
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerMode) return;
      const dx = event.clientX - pointerLast.x;
      const dy = event.clientY - pointerLast.y;
      pointerLast = { x: event.clientX, y: event.clientY };
      const state = cameraStateRef.current;
      if (pointerMode === 'pan') {
        const panScale = state.radius / 680;
        publishCamera({
          ...state,
          target: {
            x: state.target.x - dx * panScale,
            y: state.target.y + dy * panScale,
            z: state.target.z,
          },
        });
      } else {
        publishCamera({
          ...state,
          theta: state.theta - dx * 0.006,
          phi: Math.max(0.22, Math.min(Math.PI - 0.22, state.phi - dy * 0.006)),
        });
      }
      event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent) => {
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (moved < 5 && event.button !== 2) {
        setPointer(event);
        raycaster.setFromCamera(pointer, camera);
        const intersect = raycaster.intersectObjects(nodeMeshes, false)[0];
        const nodeId = intersect?.object.userData.nodeId;
        if (nodeId) onSelectNode(nodeId);
      }
      pointerMode = null;
      event.preventDefault();
    };

    const handleWheel = (event: WheelEvent) => {
      const state = cameraStateRef.current;
      const nextRadius = Math.max(80, Math.min(1500, state.radius + event.deltaY * 0.55));
      publishCamera({ ...state, radius: nextRadius });
      userInteractedAt = performance.now();
      event.preventDefault();
    };

    const handleDoubleClick = (event: MouseEvent) => {
      setPointer(event as PointerEvent);
      raycaster.setFromCamera(pointer, camera);
      const intersect = raycaster.intersectObjects(nodeMeshes, false)[0];
      const nodeId = intersect?.object.userData.nodeId;
      const node = model.nodes.find(item => item.id === nodeId);
      if (!node) return;
      publishCamera({
        ...cameraStateRef.current,
        radius: node.kind === 'file' ? 170 : 230,
        target: node.position,
      });
      onSelectNode(node.id);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', preventDefault);

    const animate = () => {
      if (disposed) return;
      const now = performance.now();
      const elapsed = now - reducedStart;
      if (!reducedMotion && elapsed > INITIAL_APPEARANCE_MS && !localSettled) {
        localSettled = true;
        setSettled(true);
      }
      if (!reducedMotion && !rotationPaused && elapsed > INITIAL_APPEARANCE_MS && now - userInteractedAt > 3200) {
        const state = cameraStateRef.current;
        cameraStateRef.current = { ...state, theta: state.theta + 0.0012 };
      }
      const appearance = reducedMotion ? 1 : Math.min(1, elapsed / INITIAL_APPEARANCE_MS);
      for (const mesh of nodeMeshes) {
        const nodeId = mesh.userData.nodeId as string;
        const node = model.nodes.find(item => item.id === nodeId);
        if (!node) continue;
        const base = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
        const start = new THREE.Vector3(node.position.x * 0.18, node.position.y * 0.18, node.position.z * 0.18);
        mesh.position.copy(start.lerp(base, appearance));
      }
      for (const sprite of labelSprites) {
        sprite.lookAt(camera.position);
      }
      applyCamera();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
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
      sphereGeometryCache.forEach(geometry => geometry.dispose());
      edgeMaterialEvidence.dispose();
      edgeMaterialHeuristic.dispose();
      renderer.dispose();
    };
  }, [focusedClusterId, fullscreen, model, onCameraStateChange, onFocusNodeSettled, onSelectNode, reducedMotion, rotationPaused, searchMatchSet, selectedNodeId]);

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
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        data-rotation-paused={rotationPaused || reducedMotion ? 'true' : 'false'}
        data-settled={settled ? 'true' : 'false'}
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-primary/20 bg-background/55 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        Drag to orbit - Scroll to zoom - Right-drag to pan - Click a node
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        {model.summary.representedFileNodeCount.toLocaleString()} file nodes - {model.summary.folderNodeCount.toLocaleString()} folders - {model.summary.clusterCount.toLocaleString()} clusters
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

function colorForNode(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean) {
  if (selected) return 0xf8fafc;
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

function emissiveForNode(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean) {
  if (selected) return 0x67e8f9;
  if (matched) return 0xfacc15;
  if (node.kind === 'repository') return 0x0891b2;
  if (node.importance === 'primary') return 0x1d4ed8;
  return 0x0f172a;
}

function shouldRenderLabel(node: RepositoryUniverseNode, selected?: boolean, matched?: boolean, focusedClusterId?: string | null) {
  if (selected || matched) return true;
  if (node.kind === 'repository' || node.kind === 'folder') return true;
  if (focusedClusterId && node.clusterId === focusedClusterId && node.importance !== 'background') return true;
  return node.importance === 'primary';
}

function labelSprite(label: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '600 34px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(5, 9, 20, 0.72)';
    roundRect(context, 24, 32, 464, 64, 28);
    context.fill();
    context.fillStyle = color;
    context.fillText(label, 256, 64, 430);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(material);
}

function shortLabel(label: string) {
  if (label.length <= 24) return label;
  return `${label.slice(0, 21)}...`;
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

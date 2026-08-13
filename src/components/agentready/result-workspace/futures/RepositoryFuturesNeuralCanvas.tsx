import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bookmark, Check, Focus, GitBranch, LockKeyhole, Minus, Move, Plus, RotateCcw, Route, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { RepositoryFutureStageOverlay } from './futurePathwaysPresentation';
import {
  buildRepositoryFuturesCanvasModel,
  repositoryFuturesEdgePath,
  repositoryFuturesSelectedPlanNodes,
  repositoryFuturesTrace,
  type RepositoryFuturesCanvasNode,
} from './repositoryFuturesCanvasModel';
import {
  constrainRepositoryFuturesCamera,
  fitRepositoryFuturesBoundsCamera,
  fitRepositoryFuturesCamera,
  frameRepositoryFuturesOrigin,
  panRepositoryFuturesCamera,
  repositoryFuturesBounds,
  repositoryFuturesLod,
  repositoryFuturesSafeInsets,
  repositoryFuturesSafeViewport,
  revealRepositoryFuturesTarget,
  zoomRepositoryFuturesCamera,
  type RepositoryFuturesCamera,
} from './repositoryFuturesCamera';
import { resolveRepositoryFutureNodeActions, type RepositoryFutureNodeAction } from './repositoryFutureNodeActions';
import {
  applyRepositoryFuturesNodeOffsets,
  constrainRepositoryFuturesNodeOffset,
  readRepositoryFuturesArrangement,
  reconcileRepositoryFuturesNodeOffsets,
  repositoryFuturesArrangementStorageKey,
  repositoryFuturesOffsetsEqual,
  writeRepositoryFuturesArrangement,
  type RepositoryFuturesNodeOffset,
} from './repositoryFuturesArrangement';

interface RepositoryFuturesNeuralCanvasProps {
  repositoryName: string;
  overlay: RepositoryFutureStageOverlay;
}

const DEFAULT_VIEWPORT = { width: 1200, height: 680 };
const nodeWidths = { repository: 210, candidate: 202, primary: 232, supporting: 208, saved: 194, blocked: 194, dependency: 174 } as const;
const fieldLanePositions = Array.from({ length: 7 }, (_, lane) => 126 + lane * (568 / 6));

export function RepositoryFuturesNeuralCanvas({ repositoryName, overlay }: RepositoryFuturesNeuralCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ x: number; y: number }>();
  const arrangeDragRef = useRef<{
    pointerId: number;
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startOffset: RepositoryFuturesNodeOffset;
    moved: boolean;
  }>();
  const suppressNodeClickRef = useRef(false);
  const pinchRef = useRef<{ distance: number; camera: RepositoryFuturesCamera }>();
  const inspectorRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<RepositoryFuturesCamera>();
  const cameraTransitionTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const arrangementPersistTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initialFramingRef = useRef(false);
  const orientationRef = useRef<'horizontal' | 'vertical'>();
  const revealedPinnedIdRef = useRef<string>();
  const mobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const canonicalModel = useMemo(() => buildRepositoryFuturesCanvasModel(repositoryName, overlay, 'horizontal'), [overlay, repositoryName]);
  const model = useMemo(() => mobile
    ? buildRepositoryFuturesCanvasModel(repositoryName, overlay, 'vertical')
    : canonicalModel, [canonicalModel, mobile, overlay, repositoryName]);
  const arrangementStorageKey = useMemo(() => repositoryFuturesArrangementStorageKey(repositoryName, overlay.graphFingerprint), [overlay.graphFingerprint, repositoryName]);
  const [nodeOffsets, setNodeOffsets] = useState(() => readRepositoryFuturesArrangement(arrangementStorageKey));
  const nodeOffsetsRef = useRef(nodeOffsets);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [arrangingNodeId, setArrangingNodeId] = useState<string>();
  const [arrangeSelectionId, setArrangeSelectionId] = useState<string>();
  const arrangedNodes = useMemo(() => applyRepositoryFuturesNodeOffsets(model, nodeOffsets), [model, nodeOffsets]);
  const canonicalNodeById = useMemo(() => new Map(model.nodes.map(node => [node.id, node])), [model.nodes]);
  const nodeById = useMemo(() => new Map(arrangedNodes.map(node => [node.id, node])), [arrangedNodes]);
  const [camera, setCamera] = useState(() => fitRepositoryFuturesCamera(DEFAULT_VIEWPORT, model.world));
  const [hoveredId, setHoveredId] = useState<string>();
  const [pinnedId, setPinnedId] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [cameraTransitioning, setCameraTransitioning] = useState(false);
  cameraRef.current = camera;
  const activeId = arrangingNodeId || pinnedId || hoveredId || overlay.activeTraceId;
  const inspectionId = pinnedId || hoveredId || overlay.activeTraceId;
  const activeNode = inspectionId ? nodeById.get(inspectionId) : undefined;
  const arrangingCanonicalNode = arrangingNodeId ? canonicalNodeById.get(arrangingNodeId) : undefined;
  const arrangingRenderedNode = arrangingNodeId ? nodeById.get(arrangingNodeId) : undefined;
  const primary = overlay.candidates.find(candidate => candidate.role === 'primary');
  const trace = useMemo(() => repositoryFuturesTrace(model, activeId), [activeId, model]);
  const lod = repositoryFuturesLod(camera.zoom);
  const overviewGoalIds = useMemo(() => new Set(overlay.candidates.slice(0, 3).map(candidate => candidate.goalId)), [overlay.candidates]);
  const meaningfulBounds = useMemo(() => repositoryFuturesBounds(arrangedNodes.map(nodeCameraTarget))!, [arrangedNodes]);
  const selectedPlanNodeIds = useMemo(() => new Set(repositoryFuturesSelectedPlanNodes(model).map(node => node.id)), [model]);
  const selectedPlanNodes = useMemo(() => arrangedNodes.filter(node => selectedPlanNodeIds.has(node.id)), [arrangedNodes, selectedPlanNodeIds]);
  const selectedPlanBounds = useMemo(() => repositoryFuturesBounds(selectedPlanNodes.map(nodeCameraTarget)), [selectedPlanNodes]);
  const initialFramingBounds = useMemo(() => {
    const preferredIds = new Set([
      ...selectedPlanNodes.map(node => node.id),
      ...overlay.candidates.slice(0, 4).map(candidate => candidate.goalId),
    ]);
    const preferredNodes = arrangedNodes.filter(node => node.kind === 'repository' || preferredIds.has(node.id));
    return repositoryFuturesBounds(preferredNodes.map(nodeCameraTarget)) || meaningfulBounds;
  }, [arrangedNodes, meaningfulBounds, overlay.candidates, selectedPlanNodes]);
  const meaningfulBoundsRef = useRef(meaningfulBounds);
  const initialFramingBoundsRef = useRef(initialFramingBounds);
  const pinnedIdRef = useRef(pinnedId);
  const arrangementStorageKeyRef = useRef(arrangementStorageKey);
  meaningfulBoundsRef.current = meaningfulBounds;
  initialFramingBoundsRef.current = initialFramingBounds;
  pinnedIdRef.current = pinnedId;
  nodeOffsetsRef.current = nodeOffsets;

  useEffect(() => {
    if (arrangementStorageKeyRef.current === arrangementStorageKey) return;
    arrangementStorageKeyRef.current = arrangementStorageKey;
    setNodeOffsets(readRepositoryFuturesArrangement(arrangementStorageKey));
    setArrangeMode(false);
    setArrangingNodeId(undefined);
    setArrangeSelectionId(undefined);
  }, [arrangementStorageKey]);

  useEffect(() => {
    setNodeOffsets(current => {
      const reconciled = reconcileRepositoryFuturesNodeOffsets(canonicalModel, current);
      return repositoryFuturesOffsetsEqual(current, reconciled) ? current : reconciled;
    });
    if (arrangeSelectionId && !canonicalModel.nodes.some(node => node.id === arrangeSelectionId)) {
      setArrangeSelectionId(undefined);
    }
  }, [arrangeSelectionId, canonicalModel]);

  useEffect(() => {
    if (arrangementPersistTimerRef.current) clearTimeout(arrangementPersistTimerRef.current);
    arrangementPersistTimerRef.current = setTimeout(() => {
      writeRepositoryFuturesArrangement(arrangementStorageKey, nodeOffsetsRef.current);
    }, 160);
    return () => {
      if (arrangementPersistTimerRef.current) clearTimeout(arrangementPersistTimerRef.current);
    };
  }, [arrangementStorageKey, nodeOffsets]);

  const getViewport = useCallback(() => {
    const bounds = stageRef.current?.getBoundingClientRect();
    return bounds && bounds.width > 0 && bounds.height > 0
      ? { width: bounds.width, height: bounds.height }
      : DEFAULT_VIEWPORT;
  }, []);

  const getInsets = useCallback((includeInspector = Boolean(pinnedId)) => {
    const viewport = getViewport();
    const inspectorBounds = includeInspector ? inspectorRef.current?.getBoundingClientRect() : undefined;
    return repositoryFuturesSafeInsets(viewport, inspectorBounds ? {
      width: inspectorBounds.width,
      height: inspectorBounds.height,
    } : includeInspector ? { width: 0, height: 0 } : undefined);
  }, [getViewport, pinnedId]);

  const applyCamera = useCallback((next: RepositoryFuturesCamera, animate = false) => {
    if (cameraTransitionTimerRef.current) clearTimeout(cameraTransitionTimerRef.current);
    setCameraTransitioning(animate && !reducedMotion);
    setCamera(next);
    if (animate && !reducedMotion) {
      cameraTransitionTimerRef.current = setTimeout(() => setCameraTransitioning(false), 220);
    }
  }, [reducedMotion]);

  const constrainCamera = useCallback((next: RepositoryFuturesCamera, includeInspector = Boolean(pinnedId)) => (
    constrainRepositoryFuturesCamera(next, getViewport(), meaningfulBounds, getInsets(includeInspector))
  ), [getInsets, getViewport, meaningfulBounds, pinnedId]);

  const fitAll = useCallback(() => {
    applyCamera(fitRepositoryFuturesBoundsCamera(getViewport(), meaningfulBounds, getInsets(), 52), true);
  }, [applyCamera, getInsets, getViewport, meaningfulBounds]);

  const fitPlan = useCallback(() => {
    if (!primary || !selectedPlanBounds) return;
    applyCamera(fitRepositoryFuturesBoundsCamera(getViewport(), selectedPlanBounds, getInsets(), 58), true);
  }, [applyCamera, getInsets, getViewport, primary, selectedPlanBounds]);

  const backToRepository = useCallback(() => {
    const root = model.nodes.find(node => node.kind === 'repository');
    if (!root) return;
    applyCamera(constrainCamera(frameRepositoryFuturesOrigin(
      getViewport(),
      root,
      model.orientation,
      getInsets(),
    )), true);
  }, [applyCamera, constrainCamera, getInsets, getViewport, model.nodes, model.orientation]);

  useLayoutEffect(() => {
    const orientationChanged = orientationRef.current !== model.orientation;
    orientationRef.current = model.orientation;
    if (!initialFramingRef.current || orientationChanged) {
      const viewport = getViewport();
      applyCamera(fitRepositoryFuturesBoundsCamera(viewport, initialFramingBoundsRef.current, repositoryFuturesSafeInsets(viewport), 54, 1.02));
      initialFramingRef.current = true;
    }
  }, [applyCamera, getViewport, model.orientation]);

  useLayoutEffect(() => {
    if (!stageRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (!initialFramingRef.current) return;
      const viewport = getViewport();
      const inspectorBounds = pinnedIdRef.current ? inspectorRef.current?.getBoundingClientRect() : undefined;
      const insets = repositoryFuturesSafeInsets(viewport, inspectorBounds ? {
        width: inspectorBounds.width,
        height: inspectorBounds.height,
      } : pinnedIdRef.current ? { width: 0, height: 0 } : undefined);
      setCamera(current => constrainRepositoryFuturesCamera(current, viewport, meaningfulBoundsRef.current, insets));
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [getViewport]);

  useEffect(() => () => {
    if (cameraTransitionTimerRef.current) clearTimeout(cameraTransitionTimerRef.current);
    if (arrangementPersistTimerRef.current) clearTimeout(arrangementPersistTimerRef.current);
    writeRepositoryFuturesArrangement(arrangementStorageKeyRef.current, nodeOffsetsRef.current);
  }, []);

  useEffect(() => {
    if (pinnedId && !nodeById.has(pinnedId)) {
      setPinnedId(undefined);
      revealedPinnedIdRef.current = undefined;
    }
  }, [nodeById, pinnedId]);

  useLayoutEffect(() => {
    if (!pinnedId) {
      revealedPinnedIdRef.current = undefined;
      return;
    }
    if (revealedPinnedIdRef.current === pinnedId) return;
    revealedPinnedIdRef.current = pinnedId;
    const node = nodeById.get(pinnedId);
    if (!node || !cameraRef.current) return;
    const viewport = getViewport();
    const insets = getInsets(true);
    const revealed = revealRepositoryFuturesTarget(
      cameraRef.current,
      repositoryFuturesSafeViewport(viewport, insets),
      nodeCameraTarget(node),
    );
    const bounded = constrainRepositoryFuturesCamera(revealed, viewport, meaningfulBounds, insets);
    if (bounded.x !== cameraRef.current.x || bounded.y !== cameraRef.current.y) applyCamera(bounded, true);
  }, [applyCamera, getInsets, getViewport, meaningfulBounds, nodeById, pinnedId]);

  const clearFocus = useCallback(() => {
    setHoveredId(undefined);
    setPinnedId(undefined);
    revealedPinnedIdRef.current = undefined;
    overlay.onTraceClear?.();
  }, [overlay]);

  const inspectNode = (node: RepositoryFuturesCanvasNode) => {
    const nextPinned = pinnedId === node.id ? undefined : node.id;
    setPinnedId(nextPinned);
    setHoveredId(undefined);
    if (!nextPinned) {
      overlay.onTraceClear?.();
      return;
    }
    if (node.kind === 'goal') overlay.onCandidateFocus(node.id);
    if (node.kind === 'dependency') overlay.onDependencyFocus(node.id);
    overlay.onTracePin?.(node.id);
  };

  const zoomAt = useCallback((factor: number, anchor: { x: number; y: number }) => {
    setCameraTransitioning(false);
    setCamera(current => constrainCamera(zoomRepositoryFuturesCamera(current, current.zoom * factor, anchor)));
  }, [constrainCamera]);

  const zoomAtCenter = useCallback((factor: number) => {
    const viewport = getViewport();
    const safe = repositoryFuturesSafeViewport(viewport, getInsets());
    zoomAt(factor, { x: safe.left + safe.width / 2, y: safe.top + safe.height / 2 });
  }, [getInsets, getViewport, zoomAt]);

  const resetSelectedNodePosition = useCallback(() => {
    const nodeId = arrangeSelectionId || pinnedId;
    if (!nodeId) return;
    setNodeOffsets(current => {
      if (!current[nodeId]) return current;
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, [arrangeSelectionId, pinnedId]);

  const resetAllNodePositions = useCallback(() => {
    setNodeOffsets({});
  }, []);

  const handleNodePointerDown = (event: React.PointerEvent<HTMLButtonElement>, node: RepositoryFuturesCanvasNode) => {
    if (!arrangeMode || mobile || node.kind === 'repository') return;
    event.stopPropagation();
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    arrangeDragRef.current = {
      pointerId: event.pointerId,
      nodeId: node.id,
      startClientX: clientX,
      startClientY: clientY,
      startOffset: nodeOffsets[node.id] || { x: 0, y: 0 },
      moved: false,
    };
    suppressNodeClickRef.current = false;
    setArrangeSelectionId(node.id);
    setArrangingNodeId(node.id);
    setCameraTransitioning(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleNodePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = arrangeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const clientX = Number.isFinite(event.clientX) ? event.clientX : drag.startClientX;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : drag.startClientY;
    const zoom = cameraRef.current?.zoom || 1;
    const deltaX = (clientX - drag.startClientX) / zoom;
    const deltaY = (clientY - drag.startClientY) / zoom;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) drag.moved = true;
    const nextOffset = constrainRepositoryFuturesNodeOffset(canonicalModel, drag.nodeId, {
      x: drag.startOffset.x + deltaX,
      y: drag.startOffset.y + deltaY,
    });
    setNodeOffsets(current => ({ ...current, [drag.nodeId]: nextOffset }));
  };

  const handleNodePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = arrangeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    suppressNodeClickRef.current = drag.moved;
    arrangeDragRef.current = undefined;
    setArrangingNodeId(undefined);
    writeRepositoryFuturesArrangement(arrangementStorageKeyRef.current, nodeOffsetsRef.current);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-neural-node], [data-camera-control], [data-futures-mode-owner], [data-neural-inspector]')) return;
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    pointersRef.current.set(event.pointerId, { x: clientX, y: clientY });
    setCameraTransitioning(false);
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { x: clientX, y: clientY };
    if (pointersRef.current.size === 2) {
      const [left, right] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.hypot(right.x - left.x, right.y - left.y), camera };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const clientX = Number.isFinite(event.clientX) ? event.clientX : dragRef.current?.x || 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : dragRef.current?.y || 0;
    pointersRef.current.set(event.pointerId, { x: clientX, y: clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [left, right] = [...pointersRef.current.values()];
      const distance = Math.max(1, Math.hypot(right.x - left.x, right.y - left.y));
      const bounds = stageRef.current?.getBoundingClientRect();
      const anchor = {
        x: (left.x + right.x) / 2 - (bounds?.left || 0),
        y: (left.y + right.y) / 2 - (bounds?.top || 0),
      };
      setCamera(constrainCamera(zoomRepositoryFuturesCamera(pinchRef.current.camera, pinchRef.current.camera.zoom * (distance / pinchRef.current.distance), anchor)));
      return;
    }
    if (!dragRef.current) return;
    const deltaX = clientX - dragRef.current.x;
    const deltaY = clientY - dragRef.current.y;
    dragRef.current = { x: clientX, y: clientY };
    setCamera(current => constrainCamera(panRepositoryFuturesCamera(current, deltaX, deltaY)));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    dragRef.current = undefined;
    pinchRef.current = undefined;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const pan = 36;
    if (event.key === 'ArrowLeft') setCamera(current => constrainCamera(panRepositoryFuturesCamera(current, pan, 0)));
    else if (event.key === 'ArrowRight') setCamera(current => constrainCamera(panRepositoryFuturesCamera(current, -pan, 0)));
    else if (event.key === 'ArrowUp') setCamera(current => constrainCamera(panRepositoryFuturesCamera(current, 0, pan)));
    else if (event.key === 'ArrowDown') setCamera(current => constrainCamera(panRepositoryFuturesCamera(current, 0, -pan)));
    else if (event.key === '+' || event.key === '=') zoomAtCenter(1.16);
    else if (event.key === '-') zoomAtCenter(1 / 1.16);
    else if (event.key === '0' || event.key.toLowerCase() === 'f') fitAll();
    else if (event.key === 'Escape' && arrangeMode) {
      setArrangeMode(false);
      setArrangingNodeId(undefined);
      arrangeDragRef.current = undefined;
    } else if (event.key === 'Escape') clearFocus();
    else return;
    event.preventDefault();
  };

  return (
    <section aria-labelledby="neural-futures-heading" className="relative">
      <div className="sr-only">
        <h3 id="neural-futures-heading">Neural Repository Futures map</h3>
        <p>Current repository on the left, grounded future goals across three horizons, and required dependencies connected only where the Future draft requires them.</p>
      </div>
      <div
        ref={stageRef}
        role="application"
        tabIndex={0}
        aria-label="Neural Repository Futures canvas. Use arrow keys to pan, plus and minus to zoom, F or zero to fit all futures, and Escape to clear focus or leave Arrange Mode."
        data-testid="repository-futures-neural-canvas"
        data-camera-x={camera.x.toFixed(2)}
        data-camera-y={camera.y.toFixed(2)}
        data-camera-zoom={camera.zoom.toFixed(3)}
        data-camera-lod={lod}
        data-future-orientation={model.orientation}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        data-reveal-motion={reducedMotion ? 'static' : 'topology-one-shot'}
        data-product-intelligence-state={overlay.productIntelligenceState}
        data-field-density="layered-neural"
        data-arrange-mode={arrangeMode ? 'active' : 'inactive'}
        data-arranged-node-count={Object.keys(nodeOffsets).length}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={event => {
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          setCameraTransitioning(false);
          setCamera(current => constrainCamera(zoomRepositoryFuturesCamera(current, current.zoom * Math.exp(-event.deltaY * 0.0015), {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          })));
        }}
        onKeyDown={handleKeyDown}
        onClick={event => {
          if (!(event.target as Element).closest('[data-neural-node], [data-camera-control], [data-futures-mode-owner], [data-neural-inspector]')) clearFocus();
        }}
        className={`futures-neural-stage relative h-[min(76svh,860px)] min-h-[620px] overflow-hidden rounded-[1rem] border border-primary/15 outline-none [touch-action:none] focus-visible:ring-2 focus-visible:ring-ring md:min-h-[700px] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div aria-hidden="true" className="futures-neural-mesh pointer-events-none absolute inset-0 opacity-[0.2]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,hsl(var(--futures-field-bg)/0.44)_100%)]" />
        <div data-futures-mode-owner role="group" aria-label="Future Pathways mode" className="absolute left-3 top-3 z-30 inline-flex rounded-full border border-border/40 bg-background/[0.72] p-0.5 backdrop-blur-md md:left-5 md:top-5">
          {(['quick', 'deep'] as const).map(value => (
            <button key={value} type="button" aria-label={value === 'quick' ? 'Quick Path' : 'Deep Configuration'} aria-pressed={overlay.mode === value} onClick={event => { event.stopPropagation(); overlay.onModeChange(value); }} className={`min-h-9 rounded-full px-3 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${overlay.mode === value ? 'bg-primary/15 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {value === 'quick' ? 'Quick' : 'Deep'}
            </button>
          ))}
        </div>
        <div data-camera-control className="absolute left-3 top-14 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-0.5 rounded-full border border-border/35 bg-background/[0.72] p-0.5 backdrop-blur-md md:left-5 md:top-[4.35rem]">
          <CameraButton label="Zoom out" onClick={() => zoomAtCenter(1 / 1.16)}><Minus /></CameraButton>
          <CameraButton label="Zoom in" onClick={() => zoomAtCenter(1.16)}><Plus /></CameraButton>
          <CameraButton label="Fit all futures" onClick={fitAll}><Focus /></CameraButton>
          <CameraButton label="Fit selected plan" onClick={fitPlan} disabled={!primary} disabledDescription="Choose a primary Future before fitting the selected plan."><Route /></CameraButton>
          <CameraButton label="Back to current repository" onClick={backToRepository}><GitBranch /></CameraButton>
          <button
            type="button"
            data-arrange-toggle
            aria-label={mobile ? 'Arrange Mode unavailable on mobile' : arrangeMode ? 'Done arranging nodes' : 'Arrange nodes'}
            aria-pressed={arrangeMode}
            title={mobile ? 'Arrange Mode is available on tablet and desktop. Mobile keeps touch navigation conflict-free.' : arrangeMode ? 'Done arranging nodes' : 'Arrange nodes within their semantic bounds'}
            disabled={mobile}
            onClick={event => { event.stopPropagation(); setArrangeMode(current => !current); }}
            className={`flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35 ${arrangeMode ? 'bg-primary/15 text-foreground shadow-sm' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
          >
            {arrangeMode ? <Check className="h-4 w-4" aria-hidden="true" /> : <Move className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden md:inline">{arrangeMode ? 'Done' : 'Arrange'}</span>
          </button>
          {arrangeMode && <>
            <CameraButton
              label="Reset selected node position"
              onClick={resetSelectedNodePosition}
              disabled={!nodeOffsets[arrangeSelectionId || pinnedId || '']}
              disabledDescription="Select or arrange a moved node before resetting its position."
            ><RotateCcw /></CameraButton>
            <CameraButton
              label="Reset all arranged positions"
              onClick={resetAllNodePositions}
              disabled={!Object.keys(nodeOffsets).length}
              disabledDescription="No arranged node positions to reset."
            ><RotateCcw /></CameraButton>
          </>}
          {activeId && <CameraButton label="Clear focused route" onClick={clearFocus}><X /></CameraButton>}
        </div>
        <div aria-label="Live Future Plan summary" data-plan-status={primary ? 'composed' : 'empty'} className="pointer-events-none absolute right-3 top-3 z-20 max-w-[calc(100%-8.5rem)] border-l border-primary/30 bg-background/[0.55] px-3 py-1.5 text-right text-[10px] text-muted-foreground backdrop-blur-md md:right-5 md:top-5 md:max-w-md">
          {primary ? <>
            <span className="block truncate font-medium text-foreground"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary">Primary</span> · {primary.title}</span>
            <span className="mt-1 block font-mono uppercase tracking-[0.1em]">Supports {overlay.supportCount}/2 · Requirements {overlay.dependencies.length} automatic</span>
          </> : <span className="font-medium text-foreground">Choose a future to begin.</span>}
          {overlay.productIntelligenceState === 'analysing' && <span role="status" aria-live="polite" className="mt-1 block">Future paths are forming</span>}
          {overlay.limited && <span role="status" className="mt-1 block text-warning">Limited scan evidence</span>}
        </div>

        <div
          data-testid="repository-futures-camera"
          className={`absolute left-0 top-0 ${cameraTransitioning ? 'transition-transform duration-200 ease-out motion-reduce:transition-none' : ''}`}
          style={{
            width: model.world.width,
            height: model.world.height,
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
            transformOrigin: '0 0',
            willChange: cameraTransitioning || dragging ? 'transform' : undefined,
          }}
        >
          <svg aria-hidden="true" viewBox={`0 0 ${model.world.width} ${model.world.height}`} className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="future-route" x1="0" x2={model.orientation === 'horizontal' ? '1' : '0'} y2={model.orientation === 'vertical' ? '1' : '0'}>
                <stop offset="0" stopColor="hsl(var(--futures-selected))" stopOpacity="0.2" />
                <stop offset="1" stopColor="hsl(var(--futures-requirement))" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="future-lane-field" x1={model.orientation === 'horizontal' ? '0' : '0.5'} x2={model.orientation === 'horizontal' ? '1' : '0.5'} y1={model.orientation === 'vertical' ? '0' : '0.5'} y2={model.orientation === 'vertical' ? '1' : '0.5'}>
                <stop offset="0" stopColor="hsl(var(--futures-selected))" stopOpacity="0" />
                <stop offset="0.42" stopColor="hsl(var(--futures-atmosphere))" stopOpacity="0.07" />
                <stop offset="1" stopColor="hsl(var(--futures-requirement))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g data-field-layer="lane-envelopes" aria-hidden="true">
              {fieldLanePositions.map(position => model.orientation === 'horizontal' ? (
                <rect key={position} x="300" y={position - 34} width={model.world.width - 360} height="68" rx="34" fill="url(#future-lane-field)" />
              ) : (
                <rect key={position} x={position - 34} y="300" width="68" height={model.world.height - 360} rx="34" fill="url(#future-lane-field)" />
              ))}
            </g>
            {model.horizons.map(horizon => (
              <g key={horizon.depth} opacity="0.28">
                {model.orientation === 'horizontal' ? <>
                  <line x1={horizon.position} x2={horizon.position} y1="70" y2={model.world.height - 70} stroke="hsl(var(--futures-structure))" strokeDasharray="2 18" />
                  <text x={horizon.position + 12} y="92" fill="hsl(var(--muted-foreground))" fontSize="10" letterSpacing="1.5">{horizon.label.toUpperCase()}</text>
                </> : <>
                  <line x1="70" x2={model.world.width - 70} y1={horizon.position} y2={horizon.position} stroke="hsl(var(--futures-structure))" strokeDasharray="2 18" />
                  <text x="82" y={horizon.position + 22} fill="hsl(var(--muted-foreground))" fontSize="10" letterSpacing="1.5">{horizon.label.toUpperCase()}</text>
                </>}
              </g>
            ))}
            {arrangingCanonicalNode && arrangingRenderedNode && (
              <g data-arrange-anchor-cue aria-hidden="true">
                <line
                  x1={arrangingCanonicalNode.x}
                  y1={arrangingCanonicalNode.y}
                  x2={arrangingRenderedNode.x}
                  y2={arrangingRenderedNode.y}
                  stroke="hsl(var(--futures-selected))"
                  strokeWidth="1.25"
                  strokeDasharray="3 7"
                  opacity="0.34"
                />
                <circle cx={arrangingCanonicalNode.x} cy={arrangingCanonicalNode.y} r="7" fill="none" stroke="hsl(var(--futures-selected))" strokeWidth="1.25" opacity="0.42" />
              </g>
            )}
            <g data-field-layer="node-halos" aria-hidden="true">
              {arrangedNodes.map(node => {
                const selected = node.role === 'primary' || node.role === 'supporting';
                const prerequisite = node.kind === 'dependency';
                return <ellipse
                  key={node.id}
                  data-field-object-halo={node.kind}
                  cx={node.x}
                  cy={node.y}
                  rx={node.role === 'primary' ? 96 : node.kind === 'repository' ? 82 : prerequisite ? 62 : 70}
                  ry={node.role === 'primary' ? 54 : prerequisite ? 34 : 42}
                  fill={selected ? 'hsl(var(--futures-selected))' : prerequisite ? 'hsl(var(--futures-requirement))' : 'hsl(var(--futures-atmosphere))'}
                  opacity={selected ? 0.075 : prerequisite ? 0.055 : 0.035}
                />;
              })}
            </g>
            {model.edges.map(edge => {
              const traced = !activeId || trace.edgeIds.has(edge.id);
              const baseOpacity = lod === 'far' ? 0.3 : lod === 'near' ? 0.58 : 0.46;
              const opacity = traced ? edge.selected ? 0.92 : baseOpacity : 0.14;
              const path = repositoryFuturesEdgePath(edge, nodeById, model.orientation);
              return (
                <g key={`${edge.id}:${overlay.draftFingerprint || 'possibility'}`} data-relationship-emphasis={edge.selected ? 'selected' : 'supporting'}>
                  <path
                    data-future-edge-id={edge.id}
                    data-future-edge={edge.kind}
                    data-edge-layer="ambient"
                    data-selected-route={edge.selected || undefined}
                    data-trace-state={traced ? 'related' : 'dimmed'}
                    d={path}
                    fill="none"
                    stroke={edge.selected ? 'hsl(var(--futures-selected))' : edge.kind === 'requirement' ? 'hsl(var(--futures-requirement))' : 'hsl(var(--futures-structure))'}
                    strokeWidth={edge.selected ? 10 : edge.kind === 'requirement' ? 6 : 4}
                    opacity={traced ? edge.selected ? 0.12 : 0.045 : 0.025}
                    strokeLinecap="round"
                    className="transition-opacity duration-150 motion-reduce:transition-none"
                  />
                  <path
                    data-future-edge-id={edge.id}
                    data-future-edge={edge.kind}
                    data-edge-layer="semantic"
                    data-selected-route={edge.selected || undefined}
                    data-trace-state={traced ? 'related' : 'dimmed'}
                    d={path}
                    fill="none"
                    stroke={edge.selected ? 'url(#future-route)' : edge.kind === 'requirement' ? 'hsl(var(--futures-requirement))' : 'hsl(var(--futures-structure))'}
                    strokeWidth={edge.selected ? 3.2 : edge.kind === 'requirement' ? 1.8 : 1.4}
                    strokeDasharray={edge.selected && overlay.draftFingerprint && !reducedMotion ? '1' : edge.kind === 'grounding' && !edge.selected ? '4 7' : undefined}
                    opacity={opacity}
                    pathLength="1"
                    strokeLinecap="round"
                    className={`${reducedMotion ? '' : 'future-canvas-edge-reveal'} transition-opacity duration-150 motion-reduce:transition-none`}
                    style={reducedMotion ? undefined : { animationDelay: `${80 + model.edges.indexOf(edge) * 24}ms` }}
                  >
                    {!reducedMotion && overlay.draftFingerprint && edge.selected && (
                      <animate attributeName="stroke-dashoffset" from="1" to="0" dur="520ms" fill="freeze" />
                    )}
                  </path>
                </g>
              );
            })}
          </svg>

          {arrangedNodes.map(node => {
            const traced = !activeId || trace.nodeIds.has(node.id);
            const selected = node.role === 'primary' || node.role === 'supporting';
            const draggable = arrangeMode && !mobile && node.kind !== 'repository';
            const arranging = arrangingNodeId === node.id;
            const offset = nodeOffsets[node.id] || { x: 0, y: 0 };
            const canonicalNode = canonicalNodeById.get(node.id) || node;
            const overviewDependency = node.kind === 'dependency' && (node.dependency?.dependentCount || 0) > 1;
            const showTitle = lod !== 'far'
              || node.kind === 'repository'
              || selected
              || activeId === node.id
              || overviewGoalIds.has(node.id)
              || overviewDependency;
            const showMetadata = lod === 'near' || node.kind === 'repository';
            return (
              <button
                key={node.id}
                type="button"
                data-neural-node={node.kind}
                data-neural-role={node.role}
                data-future-depth={node.depth}
                data-trace-state={traced ? 'related' : 'dimmed'}
                data-label-detail={showMetadata ? 'near' : showTitle ? 'title' : 'anchor'}
                data-arrange-draggable={draggable ? 'true' : 'false'}
                data-arranging={arranging ? 'true' : 'false'}
                data-arranged={nodeOffsets[node.id] ? 'true' : 'false'}
                data-canonical-x={canonicalNode.x.toFixed(2)}
                data-canonical-y={canonicalNode.y.toFixed(2)}
                data-arranged-x={node.x.toFixed(2)}
                data-arranged-y={node.y.toFixed(2)}
                data-offset-x={offset.x.toFixed(2)}
                data-offset-y={offset.y.toFixed(2)}
                aria-pressed={pinnedId === node.id}
                aria-grabbed={arranging}
                aria-label={nodeAriaLabel(node)}
                onPointerDown={event => handleNodePointerDown(event, node)}
                onPointerMove={handleNodePointerMove}
                onPointerUp={handleNodePointerEnd}
                onPointerCancel={handleNodePointerEnd}
                onClick={event => {
                  event.stopPropagation();
                  if (suppressNodeClickRef.current) {
                    suppressNodeClickRef.current = false;
                    return;
                  }
                  if (arrangeMode) setArrangeSelectionId(node.id);
                  inspectNode(node);
                }}
                onMouseEnter={() => { setHoveredId(node.id); overlay.onTracePreview?.(node.id); }}
                onMouseLeave={() => { setHoveredId(undefined); if (!pinnedId) overlay.onTracePreview?.(undefined); }}
                onFocus={() => { setHoveredId(node.id); overlay.onTracePreview?.(node.id); }}
                onBlur={() => { setHoveredId(undefined); if (!pinnedId) overlay.onTracePreview?.(undefined); }}
                className={`future-field-node absolute -translate-x-1/2 -translate-y-1/2 border text-left outline-none transition-[opacity,border-color,box-shadow,transform] duration-150 focus-visible:ring-4 focus-visible:ring-ring/70 motion-reduce:transition-none ${reducedMotion ? '' : 'future-canvas-node-reveal'} ${nodeGeometry(node)} ${nodeClass(node, pinnedId === node.id)} ${showTitle ? `${mobile ? 'min-h-28' : node.role === 'primary' ? 'min-h-[4.75rem]' : 'min-h-16'} px-4 py-3` : `${mobile ? 'h-20' : 'h-7'} min-h-0 rounded-full p-0`} ${traced ? '' : 'opacity-[0.38]'} ${arranging ? 'z-20 scale-[1.025] cursor-grabbing ring-2 ring-primary/65 shadow-[0_18px_42px_-16px_hsl(var(--futures-selected)/0.5)]' : draggable ? 'cursor-move' : node.kind === 'repository' && arrangeMode ? 'cursor-not-allowed' : ''}`}
                style={{ left: node.x, top: node.y, width: showTitle ? nodeWidth(node) : mobile ? 80 : 28, animationDelay: reducedMotion ? undefined : `${node.depth * 65}ms`, willChange: arranging ? 'left, top, transform' : undefined }}
              >
                {showTitle ? <>
                  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] opacity-75">{nodeIcon(node)}{nodeRoleLabel(node)}</span>
                  <span className="mt-1.5 block text-sm font-semibold leading-snug">{node.title}</span>
                  {showMetadata && <span className="mt-1 block text-[10px] opacity-65">{nodeMetadata(node)}</span>}
                </> : <span aria-hidden="true" className="block h-full w-full rounded-full bg-current opacity-75" />}
              </button>
            );
          })}
        </div>

        {activeNode && (
          <NeuralInspector inspectorRef={inspectorRef} node={activeNode} overlay={overlay} onClose={clearFocus} />
        )}
        {overlay.notice && <div role="status" aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 z-30 max-w-sm rounded-xl border border-primary/20 bg-background/85 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur-md md:bottom-5 md:left-5">{overlay.notice}</div>}
      </div>
      <p className="mt-2 px-2 text-[10px] text-muted-foreground">
        {arrangeMode
          ? 'Arrange Mode · drag nodes within their semantic bounds · drag empty space to pan · Escape finishes arranging'
          : mobile
            ? 'Current → Future · drag to pan · pinch to zoom · Arrange Mode is available on larger screens'
            : 'Current → Future · drag to pan · wheel or pinch to zoom · select a node to inspect · 0 or F fits all'}
      </p>
    </section>
  );
}

function CameraButton({ label, onClick, children, disabled = false, disabledDescription }: { label: string; onClick: () => void; children: React.ReactElement<{ className?: string }>; disabled?: boolean; disabledDescription?: string }) {
  return <button type="button" aria-label={label} title={disabled ? disabledDescription : label} disabled={disabled} onClick={event => { event.stopPropagation(); onClick(); }} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">{children && <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>}</button>;
}

function NeuralInspector({ inspectorRef, node, overlay, onClose }: { inspectorRef: React.RefObject<HTMLElement>; node: RepositoryFuturesCanvasNode; overlay: RepositoryFutureStageOverlay; onClose: () => void }) {
  const candidate = node.candidate;
  const dependency = node.dependency;
  const [replacementOpen, setReplacementOpen] = useState(false);
  const hasPrimary = overlay.candidates.some(item => item.role === 'primary');
  const actions = candidate ? resolveRepositoryFutureNodeActions({ candidate, hasPrimary, supportCount: overlay.supportCount }) : [];
  const primaryActionId = actions.find(action => ['make-primary', 'add-support', 'restore'].includes(action.id))?.id;
  const requiredCount = candidate ? overlay.dependencies.filter(item => item.dependentGoalIds.includes(candidate.goalId)).length : 0;
  useEffect(() => setReplacementOpen(false), [node.id]);

  const execute = (action: RepositoryFutureNodeAction) => {
    if (!candidate) return;
    if (action.id === 'make-primary') overlay.onCandidateSelect(candidate.goalId);
    if (action.id === 'add-support') overlay.onCandidateAddSupport(candidate.goalId);
    if (action.id === 'remove-support') overlay.onCandidateRemoveSupport(candidate.goalId);
    if (action.id === 'save-for-later') overlay.onCandidateSave(candidate.goalId);
    if (action.id === 'restore') overlay.onCandidateRestore(candidate.goalId);
    if (action.id === 'replace-support') setReplacementOpen(true);
  };
  return (
    <aside ref={inspectorRef} data-neural-inspector data-testid="neural-futures-inspector" aria-label="Neural Futures inspector" className="absolute inset-x-3 bottom-3 z-40 max-h-[52%] overflow-y-auto rounded-t-[1.35rem] border border-primary/20 bg-background/[0.92] p-4 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl md:inset-x-auto md:bottom-5 md:right-5 md:max-h-[calc(100%-7rem)] md:w-72 md:rounded-[1.15rem] lg:w-80">
      <div className="flex items-start justify-between gap-3">
        <div><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">{nodeRoleLabel(node)}</div><h4 className="mt-1 font-display text-lg font-semibold leading-tight">{node.title}</h4></div>
        <button type="button" aria-label="Close neural inspector" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /></button>
      </div>
      {candidate && <>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{candidate.userValue || candidate.rationale || 'A proposed repository-grounded direction.'}</p>
        <dl className="mt-4 grid grid-cols-2 divide-x divide-border/45 border-y border-border/40 py-2 text-xs">
          <InspectorFact label="Fit" value={candidate.fit} />
          <InspectorFact label="Requires" value={`${requiredCount} automatic`} />
        </dl>
        {candidate.compatibility === 'compatible-with-review' && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.07] p-2.5 text-xs text-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />This direction is actionable, but the resulting plan requires human review.</p>}
        {['blocked', 'incompatible'].includes(candidate.compatibility) && <div className="mt-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-3 text-xs"><div className="flex items-center gap-2 font-medium text-foreground"><LockKeyhole className="h-3.5 w-3.5 text-warning" />Cannot join as support</div><p className="mt-1 text-muted-foreground">{candidate.compatibilityReasons?.[0] || 'This direction is not compatible with the current selected plan.'}</p></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map(action => <button key={action.id} type="button" onClick={() => execute(action)} data-action-emphasis={action.id === primaryActionId ? 'primary' : 'secondary'} className={`min-h-11 rounded-full px-4 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${action.id === primaryActionId ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/60 bg-background/30 text-foreground hover:border-primary/35'}`}>{action.id === 'save-for-later' && <Bookmark className="mr-1.5 inline h-3.5 w-3.5" />}{action.label}{action.reviewRequired && action.id !== 'save-for-later' ? ' · Review' : ''}</button>)}
        </div>
        {actions.some(action => action.id === 'replace-support') && <p className="mt-2 text-xs text-muted-foreground">The plan already has two supporting Futures. Choose one bounded replacement; a third support cannot be added.</p>}
        {replacementOpen && <section aria-label="Choose supporting Future to replace" className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.05] p-3"><div className="text-xs font-medium">Replace which support?</div><div className="mt-2 grid gap-2">{actions.find(action => action.id === 'replace-support')?.replacementGoalIds.map(goalId => {
          const support = overlay.candidates.find(item => item.goalId === goalId);
          return <button key={goalId} type="button" onClick={() => { overlay.onCandidateReplaceSupport(candidate.goalId, goalId); setReplacementOpen(false); }} className="min-h-11 rounded-xl border border-border bg-background/50 px-3 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Replace {support?.title || 'selected support'}</button>;
        })}</div></section>}
        <div className="mt-4 divide-y divide-border/35 border-y border-border/35 text-xs">
          <InspectorDisclosure label="Why this fits">{candidate.whyItFits || candidate.rationale || 'Grounded in the current repository evidence.'}</InspectorDisclosure>
          <InspectorDisclosure label="Evidence and compatibility">{candidate.evidenceCount} evidence signals · {candidate.compatibility}. Proposed, not current.</InspectorDisclosure>
          {candidate.limitations?.length ? <InspectorDisclosure label="Limitations">{candidate.limitations.join(' ')}</InspectorDisclosure> : null}
        </div>
        <button type="button" onClick={overlay.onOpenDomControls} className="mt-3 min-h-10 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Configure path precisely</button>
      </>}
      {dependency && <>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{dependency.rationale || 'Automatically included because the selected future depends on this capability.'}</p>
        <dl className="mt-4 grid grid-cols-2 divide-x divide-border/45 border-y border-border/40 py-2 text-xs">
          <InspectorFact label="State" value={dependency.state === 'satisfied' ? 'Already exists' : 'Automatically required'} />
          <InspectorFact label="Required by" value={`${dependency.dependentGoalIds.length} selected ${dependency.dependentGoalIds.length === 1 ? 'Future' : 'Futures'}`} />
        </dl>
        <p className="mt-3 flex items-center gap-2 text-xs font-medium"><LockKeyhole className="h-3.5 w-3.5 text-accent" />Required capabilities cannot be removed independently.</p>
        <div className="mt-4 divide-y divide-border/35 border-y border-border/35 text-xs">
          <InspectorDisclosure label="Causal chain"><ul className="space-y-1">{dependency.dependentGoalIds.map(goalId => <li key={goalId}>{overlay.candidates.find(item => item.goalId === goalId)?.title || goalId} → {dependency.title}</li>)}</ul></InspectorDisclosure>
          <InspectorDisclosure label="Evidence and limitations">{dependency.evidencePaths?.length || 0} evidence references. {dependency.limitations?.join(' ') || 'No additional limitation recorded.'}</InspectorDisclosure>
        </div>
        <button type="button" onClick={overlay.onOpenDomControls} className="mt-3 min-h-10 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Configure path precisely</button>
      </>}
      {node.kind === 'repository' && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The scanned repository is the current truth anchor. Every visible future direction is grounded back to available repository evidence.</p>}
    </aside>
  );
}

function InspectorFact({ label, value }: { label: string; value: string }) {
  return <div className="px-2.5"><dt className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-medium text-foreground">{value}</dd></div>;
}

function InspectorDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="py-2.5"><summary className="cursor-pointer font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</summary><div className="mt-2 leading-relaxed text-muted-foreground">{children}</div></details>;
}

function nodeAriaLabel(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return `Current repository: ${node.title}`;
  if (node.kind === 'dependency') return `${node.role === 'satisfied' ? 'Existing' : 'Required'} dependency: ${node.title}`;
  return `${nodeRoleLabel(node)} goal: ${node.title}. ${node.candidate?.compatibility || 'Compatibility not yet evaluated'}. Proposed, not current.`;
}

function nodeRoleLabel(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return 'Current repository';
  if (node.kind === 'dependency') return node.role === 'satisfied' ? 'Existing capability' : 'Required capability';
  return node.role === 'primary' ? 'Primary future'
    : node.role === 'supporting' ? 'Supporting future'
      : node.role === 'saved' ? 'Saved future'
        : node.role === 'blocked' ? 'Blocked direction'
          : 'Candidate future';
}

function nodeMetadata(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return 'Current scanned truth';
  if (node.candidate) return `${node.candidate.fit} · ${node.candidate.evidenceCount} evidence signals`;
  return `${node.dependency?.dependentCount || 0} dependent ${node.dependency?.dependentCount === 1 ? 'goal' : 'goals'}`;
}

function nodeIcon(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />;
  if (node.kind === 'dependency') return node.role === 'satisfied' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />;
  if (node.role === 'saved') return <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />;
  if (node.candidate && ['blocked', 'incompatible'].includes(node.candidate.compatibility)) return <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />;
  if (node.candidate?.compatibility === 'compatible-with-review') return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Route className="h-3.5 w-3.5" aria-hidden="true" />;
}

function nodeWidth(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return nodeWidths.repository;
  if (node.kind === 'dependency') return nodeWidths.dependency;
  return nodeWidths[node.role as keyof typeof nodeWidths] || nodeWidths.candidate;
}

function nodeCameraTarget(node: RepositoryFuturesCanvasNode) {
  return {
    x: node.x,
    y: node.y,
    width: nodeWidth(node),
    height: node.kind === 'repository' ? 88 : node.kind === 'dependency' ? 64 : 112,
  };
}

function nodeGeometry(node: RepositoryFuturesCanvasNode) {
  if (node.kind === 'repository') return 'rounded-[1.25rem]';
  if (node.kind === 'dependency') return 'rounded-full';
  if (node.role === 'primary') return 'rounded-[1.1rem] border-2';
  if (node.role === 'saved' || node.role === 'blocked') return 'rounded-[1rem]';
  return 'rounded-[1.15rem]';
}

function nodeClass(node: RepositoryFuturesCanvasNode, pinned: boolean) {
  if (node.kind === 'repository') return 'border-foreground/25 bg-foreground/[0.075] text-foreground shadow-[0_0_30px_hsl(var(--foreground)/0.065)]';
  if (node.kind === 'dependency') return node.role === 'satisfied'
    ? 'border-success/40 bg-success/[0.08] text-foreground'
    : 'border-accent/42 bg-accent/[0.08] text-foreground';
  if (node.role === 'primary') return 'border-primary/75 bg-primary/[0.16] text-foreground ring-1 ring-primary/25 shadow-[0_0_30px_hsl(var(--primary)/0.18)]';
  if (node.role === 'supporting') return 'border-accent/55 bg-accent/[0.1] text-foreground shadow-[0_0_20px_hsl(var(--accent)/0.1)]';
  if (node.role === 'saved') return 'border-border/50 bg-background/[0.58] text-muted-foreground ring-1 ring-inset ring-border/25';
  if (node.role === 'blocked') return 'border-dashed border-muted-foreground/40 bg-background/40 text-muted-foreground';
  if (node.candidate?.compatibility === 'compatible-with-review') return 'border-dashed border-warning/45 bg-warning/[0.045] text-foreground';
  if (node.candidate && ['blocked', 'incompatible'].includes(node.candidate.compatibility)) return 'border-dashed border-muted-foreground/40 bg-background/40 text-muted-foreground';
  return pinned
    ? 'border-primary/70 bg-primary/[0.12] text-foreground shadow-[0_0_24px_hsl(var(--primary)/0.14)]'
    : 'border-primary/30 bg-background/[0.68] text-foreground hover:border-primary/60 hover:bg-primary/[0.07]';
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

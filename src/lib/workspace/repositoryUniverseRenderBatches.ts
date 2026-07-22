import type { RepositoryUniverseEdge } from './repositoryUniverse';

export const REPOSITORY_UNIVERSE_BASE_EDGE_BATCH_IDS = [
  'contains-evidence',
  'contains-heuristic',
  'relationship-evidence',
  'relationship-heuristic',
] as const;

export type RepositoryUniverseBaseEdgeBatchId = typeof REPOSITORY_UNIVERSE_BASE_EDGE_BATCH_IDS[number];
export type RepositoryUniverseEdgeOverlayId = 'selection' | 'hover' | 'focus' | 'route';

export interface RepositoryUniverseEdgeSegment {
  edgeId: string;
  source: string;
  target: string;
  batchId: RepositoryUniverseBaseEdgeBatchId;
  segmentIndex: number;
}

export interface RepositoryUniverseBaseEdgeBatch {
  id: RepositoryUniverseBaseEdgeBatchId;
  edgeIds: string[];
}

export interface RepositoryUniverseEdgeBatchPlan {
  batches: RepositoryUniverseBaseEdgeBatch[];
  segmentsByEdgeId: Map<string, RepositoryUniverseEdgeSegment>;
}

export interface RepositoryUniverseEdgeOverlayPlan {
  selection: string[];
  hover: string[];
  focus: string[];
  route: string[];
}

export function repositoryUniverseBaseEdgeBatchId(edge: Pick<RepositoryUniverseEdge, 'relationship' | 'evidenceType'>): RepositoryUniverseBaseEdgeBatchId {
  const relationship = edge.relationship === 'contains' ? 'contains' : 'relationship';
  const evidence = edge.evidenceType === 'heuristic' ? 'heuristic' : 'evidence';
  return `${relationship}-${evidence}` as RepositoryUniverseBaseEdgeBatchId;
}

/**
 * Stable batch/segment identities are renderer-internal. Canonical edge IDs remain the
 * source of truth for filtering, selection, routes, and diagnostics.
 */
export function buildRepositoryUniverseEdgeBatchPlan(
  edges: readonly RepositoryUniverseEdge[],
  visibleEdgeIds: ReadonlySet<string>,
): RepositoryUniverseEdgeBatchPlan {
  const buckets = new Map<RepositoryUniverseBaseEdgeBatchId, string[]>(
    REPOSITORY_UNIVERSE_BASE_EDGE_BATCH_IDS.map(id => [id, []]),
  );
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const segmentsByEdgeId = new Map<string, RepositoryUniverseEdgeSegment>();

  for (const edgeId of [...visibleEdgeIds].sort()) {
    const edge = edgeById.get(edgeId);
    if (!edge) continue;
    buckets.get(repositoryUniverseBaseEdgeBatchId(edge))?.push(edge.id);
  }

  const batches = REPOSITORY_UNIVERSE_BASE_EDGE_BATCH_IDS.map(id => ({ id, edgeIds: buckets.get(id) || [] }));
  for (const batch of batches) {
    batch.edgeIds.forEach((edgeId, segmentIndex) => {
      const edge = edgeById.get(edgeId);
      if (!edge) return;
      segmentsByEdgeId.set(edgeId, {
        edgeId,
        source: edge.source,
        target: edge.target,
        batchId: batch.id,
        segmentIndex,
      });
    });
  }

  return { batches, segmentsByEdgeId };
}

export function buildRepositoryUniverseEdgeOverlayPlan({
  edges,
  visibleEdgeIds,
  selectedNodeId,
  hoveredNodeId,
  focusedClusterId,
  nodeClusterIdByNodeId,
  routeNodeIds,
}: {
  edges: readonly RepositoryUniverseEdge[];
  visibleEdgeIds: ReadonlySet<string>;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  focusedClusterId?: string | null;
  nodeClusterIdByNodeId: ReadonlyMap<string, string>;
  routeNodeIds: ReadonlySet<string>;
}): RepositoryUniverseEdgeOverlayPlan {
  const plan: RepositoryUniverseEdgeOverlayPlan = { selection: [], hover: [], focus: [], route: [] };
  for (const edge of [...edges].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!visibleEdgeIds.has(edge.id)) continue;
    if (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)) plan.selection.push(edge.id);
    if (hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)) plan.hover.push(edge.id);
    if (focusedClusterId && nodeClusterIdByNodeId.get(edge.source) === focusedClusterId && nodeClusterIdByNodeId.get(edge.target) === focusedClusterId) plan.focus.push(edge.id);
    if (routeNodeIds.has(edge.source) && routeNodeIds.has(edge.target)) plan.route.push(edge.id);
  }
  return plan;
}

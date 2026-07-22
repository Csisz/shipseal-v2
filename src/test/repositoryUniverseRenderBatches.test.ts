import { describe, expect, it } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import { buildRepositoryUniverseModel } from '@/lib/workspace';
import {
  REPOSITORY_UNIVERSE_BASE_EDGE_BATCH_IDS,
  buildRepositoryUniverseEdgeBatchPlan,
  buildRepositoryUniverseEdgeOverlayPlan,
} from '@/lib/workspace/repositoryUniverseRenderBatches';

function sampleUniverse() {
  return buildRepositoryUniverseModel(buildSampleReport());
}

describe('Repository Universe canonical edge batches', () => {
  it('groups visible canonical edges deterministically with a stable edge-to-segment mapping', () => {
    const universe = sampleUniverse();
    const visible = new Set(universe.edges.map(edge => edge.id));
    const first = buildRepositoryUniverseEdgeBatchPlan(universe.edges, visible);
    const second = buildRepositoryUniverseEdgeBatchPlan([...universe.edges].reverse(), visible);

    expect(first.batches.map(batch => batch.id)).toEqual(REPOSITORY_UNIVERSE_BASE_EDGE_BATCH_IDS);
    expect(first.batches).toEqual(second.batches);
    expect([...first.segmentsByEdgeId.entries()]).toEqual([...second.segmentsByEdgeId.entries()]);
    expect(first.segmentsByEdgeId.size).toBe(universe.edges.length);
    expect(new Set([...first.segmentsByEdgeId.values()].map(segment => segment.edgeId)).size).toBe(universe.edges.length);
    expect(first.batches.filter(batch => batch.edgeIds.length > 0).length).toBeLessThanOrEqual(4);
  });

  it('excludes hidden edges from the base plan without changing visible edge identities', () => {
    const universe = sampleUniverse();
    const hidden = universe.edges[0];
    const visible = new Set(universe.edges.slice(1).map(edge => edge.id));
    const plan = buildRepositoryUniverseEdgeBatchPlan(universe.edges, visible);

    expect(plan.segmentsByEdgeId.has(hidden.id)).toBe(false);
    expect([...plan.segmentsByEdgeId.keys()].sort()).toEqual([...visible].sort());
  });

  it('keeps selection and route overlays bounded, semantic, and able to coexist', () => {
    const universe = sampleUniverse();
    const selectedNodeId = universe.rootNodeId;
    const visible = new Set(universe.edges.map(edge => edge.id));
    const routeEdge = universe.edges.find(edge => edge.source === selectedNodeId || edge.target === selectedNodeId);
    expect(routeEdge).toBeDefined();
    const nodeClusterIdByNodeId = new Map(universe.nodes.map(node => [node.id, node.clusterId]));
    const overlays = buildRepositoryUniverseEdgeOverlayPlan({
      edges: universe.edges,
      visibleEdgeIds: visible,
      selectedNodeId,
      hoveredNodeId: null,
      focusedClusterId: null,
      nodeClusterIdByNodeId,
      routeNodeIds: new Set([routeEdge!.source, routeEdge!.target]),
    });

    expect(overlays.selection.length).toBeGreaterThan(0);
    expect(overlays.selection.every(id => {
      const edge = universe.edges.find(candidate => candidate.id === id)!;
      return edge.source === selectedNodeId || edge.target === selectedNodeId;
    })).toBe(true);
    expect(overlays.route).toEqual([routeEdge!.id]);
    expect(overlays.selection).toContain(routeEdge!.id);
  });
});

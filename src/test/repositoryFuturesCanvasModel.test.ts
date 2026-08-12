import { describe, expect, it } from 'vitest';
import {
  buildRepositoryFuturesCanvasModel,
  repositoryFuturesEdgePath,
  repositoryFuturesTrace,
} from '@/components/agentready/result-workspace/futures/repositoryFuturesCanvasModel';
import {
  fitRepositoryFuturesCamera,
  focusRepositoryFuturesCamera,
  panRepositoryFuturesCamera,
  repositoryFuturesLod,
  zoomRepositoryFuturesCamera,
} from '@/components/agentready/result-workspace/futures/repositoryFuturesCamera';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

function candidate(goalId: string, role: RepositoryFutureStageOverlay['candidates'][number]['role'], evidenceCount = 2) {
  return {
    goalId,
    title: `Goal ${goalId}`,
    fit: 'Strong fit',
    role,
    origin: 'Deterministic evidence',
    capabilityId: `capability:${goalId}`,
    confidence: 'high',
    compatibility: role === 'blocked' ? 'blocked' : 'compatible',
    humanReviewRequired: false,
    evidenceCount,
    mappedEvidenceCount: evidenceCount,
    universeNodeIds: evidenceCount ? [`universe:${goalId}`] : [],
  };
}

const dependency = {
  id: 'dependency:test',
  title: 'Test coverage',
  state: 'required',
  dependentCount: 2,
  dependentGoalIds: ['goal:primary', 'goal:support'],
  executionOrder: 0,
  humanReviewRequired: false,
};

describe('Omega 18.5-V4 repository futures canvas model', () => {
  it('places a current root and real future entities deterministically across explicit horizons', () => {
    const candidates = [
      candidate('goal:support', 'supporting'),
      candidate('goal:unmapped', 'candidate', 0),
      candidate('goal:primary', 'primary'),
    ];
    const first = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates,
      dependencies: [dependency],
      productIntelligenceState: 'enhanced',
    });
    const reordered = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: candidates.slice().reverse(),
      dependencies: [dependency],
      productIntelligenceState: 'enhanced',
    });

    expect(first).toEqual(reordered);
    expect(first.nodes[0]).toMatchObject({ id: 'repository:shipseal', kind: 'repository', role: 'current', depth: 0 });
    expect(first.horizons.map(horizon => horizon.depth)).toEqual([1, 2, 3]);
    expect(first.nodes.find(node => node.id === 'goal:primary')).toMatchObject({ role: 'primary', depth: 3 });
    expect(first.nodes.find(node => node.id === 'goal:support')).toMatchObject({ role: 'supporting', depth: 2 });
    expect(first.nodes.find(node => node.id === 'dependency:test')).toMatchObject({ kind: 'dependency', role: 'required' });
  });

  it('draws only grounded and domain-present relationships and exposes curved trace routes', () => {
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [candidate('goal:primary', 'primary'), candidate('goal:support', 'supporting'), candidate('goal:unmapped', 'candidate', 0)],
      dependencies: [dependency],
      productIntelligenceState: 'enhanced',
    });
    const edgeIds = model.edges.map(edge => edge.id);

    expect(edgeIds).toContain('grounding:goal:primary');
    expect(edgeIds).toContain('requirement:dependency:test:goal:primary');
    expect(edgeIds).toContain('selected-path:goal:support:goal:primary');
    expect(edgeIds).not.toContain('grounding:goal:unmapped');
    expect(model.edges.every(edge => model.nodes.some(node => node.id === edge.sourceId) && model.nodes.some(node => node.id === edge.targetId))).toBe(true);
    expect(repositoryFuturesEdgePath(model.edges[0], new Map(model.nodes.map(node => [node.id, node])))).toContain(' C ');
    const trace = repositoryFuturesTrace(model, 'dependency:test');
    expect(trace.nodeIds).toEqual(new Set(['dependency:test', 'goal:primary', 'goal:support', 'repository:shipseal']));
    expect(trace.edgeIds).toEqual(new Set([
      'requirement:dependency:test:goal:primary',
      'requirement:dependency:test:goal:support',
      'selected-path:goal:support:goal:primary',
      'grounding:goal:primary',
      'grounding:goal:support',
    ]));
    const primaryTrace = repositoryFuturesTrace(model, 'goal:primary');
    expect(primaryTrace.nodeIds.has('dependency:test')).toBe(true);
    expect(primaryTrace.nodeIds.has('goal:support')).toBe(true);
  });

  it('keeps the existing grounded topology visible while enhanced Product Intelligence is analysing', () => {
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [candidate('goal:fallback', 'candidate')],
      dependencies: [],
      productIntelligenceState: 'analysing',
    });
    expect(model.nodes).toHaveLength(2);
    expect(model.nodes[0].kind).toBe('repository');
    expect(model.nodes[1]).toMatchObject({ id: 'goal:fallback', kind: 'goal' });
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ id: 'grounding:goal:fallback', kind: 'grounding' });
  });

  it('reorients the same deterministic topology top-to-bottom for the mobile world', () => {
    const input = {
      candidates: [candidate('goal:primary', 'primary'), candidate('goal:support', 'supporting')],
      dependencies: [dependency],
      productIntelligenceState: 'enhanced' as const,
    };
    const horizontal = buildRepositoryFuturesCanvasModel('shipseal', input, 'horizontal');
    const vertical = buildRepositoryFuturesCanvasModel('shipseal', input, 'vertical');

    expect(vertical.orientation).toBe('vertical');
    expect(vertical.world).toEqual({ width: horizontal.world.height, height: horizontal.world.width });
    horizontal.nodes.forEach(node => {
      expect(vertical.nodes.find(item => item.id === node.id)).toMatchObject({ x: node.y, y: node.x });
    });
    expect(vertical.edges).toEqual(horizontal.edges);
    expect(repositoryFuturesEdgePath(vertical.edges[0], new Map(vertical.nodes.map(node => [node.id, node])), 'vertical')).toContain(' C ');
  });
});

describe('Omega 18.5-V4 repository futures camera', () => {
  it('fits, pans and zooms around the requested anchor within bounded levels of detail', () => {
    const fit = fitRepositoryFuturesCamera({ width: 1200, height: 680 }, { width: 1480, height: 820 });
    expect(fit.zoom).toBeGreaterThanOrEqual(0.2);
    expect(repositoryFuturesLod(fit.zoom)).toBe('medium');
    expect(panRepositoryFuturesCamera(fit, 12, -8)).toEqual({ ...fit, x: fit.x + 12, y: fit.y - 8 });

    const anchor = { x: 400, y: 300 };
    const zoomed = zoomRepositoryFuturesCamera(fit, 1.2, anchor);
    expect(zoomed.zoom).toBe(1.2);
    expect((anchor.x - fit.x) / fit.zoom).toBeCloseTo((anchor.x - zoomed.x) / zoomed.zoom);
    expect(repositoryFuturesLod(0.5)).toBe('far');
    expect(repositoryFuturesLod(0.9)).toBe('medium');
    expect(repositoryFuturesLod(1.2)).toBe('near');
  });

  it('centers a focused world target without changing domain or layout state', () => {
    const focused = focusRepositoryFuturesCamera(
      { x: 0, y: 0, zoom: 0.6 },
      { width: 800, height: 600 },
      { x: 1200, y: 400 },
    );
    expect(focused.zoom).toBe(1.05);
    expect(1200 * focused.zoom + focused.x).toBeCloseTo(400);
    expect(400 * focused.zoom + focused.y).toBeCloseTo(300);
  });
});

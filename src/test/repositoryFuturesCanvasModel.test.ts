import { describe, expect, it } from 'vitest';
import {
  buildRepositoryFuturesCanvasModel,
  repositoryFuturesEdgePath,
  repositoryFuturesSelectedPlanNodes,
  repositoryFuturesTrace,
} from '@/components/agentready/result-workspace/futures/repositoryFuturesCanvasModel';
import {
  FUTURES_CAMERA_LIMITS,
  constrainRepositoryFuturesCamera,
  fitRepositoryFuturesBoundsCamera,
  fitRepositoryFuturesCamera,
  focusRepositoryFuturesCamera,
  frameRepositoryFuturesOrigin,
  panRepositoryFuturesCamera,
  repositoryFuturesBounds,
  repositoryFuturesCameraLayout,
  repositoryFuturesLod,
  repositoryFuturesSafeInsets,
  repositoryFuturesSafeViewport,
  revealRepositoryFuturesTarget,
  zoomRepositoryFuturesCamera,
} from '@/components/agentready/result-workspace/futures/repositoryFuturesCamera';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

function candidate(
  goalId: string,
  role: RepositoryFutureStageOverlay['candidates'][number]['role'],
  evidenceCount = 2,
  futureDepth?: 1 | 2 | 3,
) {
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
    futureDepth,
  };
}

function goalPosition(model: ReturnType<typeof buildRepositoryFuturesCanvasModel>, goalId: string) {
  const node = model.nodes.find(item => item.id === goalId && item.kind === 'goal');
  expect(node).toBeDefined();
  return { x: node!.x, y: node!.y, depth: node!.depth, canonicalPosition: node!.canonicalPosition };
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
      candidate('goal:support', 'supporting', 2, 2),
      candidate('goal:unmapped', 'candidate', 0),
      candidate('goal:primary', 'primary', 2, 3),
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

  it('composes stable future streams into ordered rows and keeps prerequisites beside the route they enable', () => {
    const candidates = [
      { ...candidate('goal:strategic', 'primary', 2, 1), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'strategic' as const },
      { ...candidate('goal:evidence', 'supporting', 2, 2), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'evidence-backed' as const },
      { ...candidate('goal:foundation', 'candidate', 2, 3), candidateClass: 'repository-improvement' as const },
      { ...candidate('goal:explore', 'candidate', 2, 3), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'exploratory' as const },
    ];
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates,
      dependencies: [{ ...dependency, dependentGoalIds: ['goal:strategic', 'goal:evidence'] }],
      productIntelligenceState: 'enhanced',
    });
    const goals = model.nodes.filter(node => node.kind === 'goal');
    const requirement = model.nodes.find(node => node.kind === 'dependency')!;

    expect(model.progressionBands.map(band => band.id)).toEqual(['current', 'now', 'next', 'later', 'future']);
    expect(model.streamRows.filter(row => row.occupied > 0).length).toBeGreaterThanOrEqual(3);
    expect(goals.every(node => node.presentationRow && node.y === model.streamRows[node.presentationRow.index].position)).toBe(true);
    expect(goals.find(node => node.id === 'goal:strategic')?.presentationRow?.stream).toBe('strategic');
    expect(goals.find(node => node.id === 'goal:evidence')?.presentationRow?.stream).toBe('evidence');
    expect(goals.find(node => node.id === 'goal:foundation')?.presentationRow?.stream).toBe('foundation');
    const relatedGoals = goals.filter(node => ['goal:strategic', 'goal:evidence'].includes(node.id));
    expect(requirement.x).toBeGreaterThan(Math.max(...relatedGoals.map(node => node.x)));
    expect(requirement.x).toBeLessThan(Math.max(...relatedGoals.map(node => node.x)) + 240);
    expect(requirement.y).toBeGreaterThanOrEqual(Math.min(...relatedGoals.map(node => node.y)) - 40);
    expect(requirement.y).toBeLessThanOrEqual(Math.max(...relatedGoals.map(node => node.y)) + 40);
    expect(goals.every(node => node.canonicalPosition?.candidateId === node.id)).toBe(true);
  });

  it('regularizes six grounded directions around a left-centered repository without a detached prerequisite band', () => {
    const candidates = [
      { ...candidate('goal:a', 'candidate', 2, 1), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'strategic' as const },
      { ...candidate('goal:b', 'candidate', 2, 1), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'strategic' as const },
      { ...candidate('goal:c', 'candidate', 2, 2), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'evidence-backed' as const },
      { ...candidate('goal:d', 'candidate', 2, 2), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'evidence-backed' as const },
      { ...candidate('goal:e', 'candidate', 2, 2), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'evidence-backed' as const },
      { ...candidate('goal:f', 'candidate', 2, 3), candidateClass: 'product-opportunity' as const, opportunityOrigin: 'exploratory' as const },
    ];
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates,
      dependencies: [{ ...dependency, dependentGoalIds: ['goal:c'] }],
      productIntelligenceState: 'enhanced',
    });
    const repository = model.nodes.find(node => node.kind === 'repository')!;
    const goals = model.nodes.filter(node => node.kind === 'goal').sort((left, right) => left.y - right.y);
    const gaps = goals.slice(1).map((node, index) => node.y - goals[index].y);
    const enabler = model.nodes.find(node => node.kind === 'dependency')!;

    expect(goals).toHaveLength(6);
    expect(new Set(goals.map(node => node.x))).toEqual(new Set([510]));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(2);
    expect(gaps.every(gap => gap === 108)).toBe(true);
    expect(repository.x).toBeLessThan(goals[0].x);
    expect(repository.y).toBe((goals[0].y + goals.at(-1)!.y) / 2);
    expect(enabler.x).toBeGreaterThan(goals[0].x);
    expect(enabler.y).toBeGreaterThanOrEqual(goals[0].y);
    expect(enabler.y).toBeLessThanOrEqual(goals.at(-1)!.y);
    expect('prerequisiteBand' in model).toBe(false);
    expect(model.progressionBands.slice(0, 4).map(band => band.position)).toEqual([150, 510, 900, 1290]);
  });

  it('separates repository-improvement streams by semantic family without changing canonical depth', () => {
    const foundations = [
      { ...candidate('goal:docs', 'candidate', 2, 2), title: 'Create a documentation index', candidateClass: 'repository-improvement' as const },
      { ...candidate('goal:route', 'candidate', 2, 2), title: 'Create a task router', candidateClass: 'repository-improvement' as const },
      { ...candidate('goal:deploy', 'candidate', 2, 2), title: 'Document deployment flow', candidateClass: 'repository-improvement' as const },
      { ...candidate('goal:security', 'candidate', 2, 2), title: 'Add security and data handling review anchor', candidateClass: 'repository-improvement' as const },
    ];
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: foundations,
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const goals = foundations.map(item => model.nodes.find(node => node.id === item.goalId)!);

    expect(new Set(goals.map(node => node.presentationRow?.index)).size).toBe(4);
    expect(goals.every(node => node.depth === 2 && node.canonicalPosition?.futureDepth === 2)).toBe(true);
    expect(goals.every(node => node.x === 510)).toBe(true);
  });

  it('places second- and third-generation product evolutions after each grounded first-level direction', () => {
    const direction = {
      ...candidate('goal:adaptive', 'primary', 1, 1),
      candidateClass: 'product-opportunity' as const,
      opportunityOrigin: 'strategic' as const,
    };
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [direction],
      projections: [
        { id: 'evolution:adaptive-plan', goalId: direction.goalId, kind: 'evolution' as const, title: 'Adaptive planning', sourceId: direction.goalId, order: 0, humanReviewRequired: false, generation: 2 as const, summary: 'Plans adjust to progress.', userValue: 'Families get relevant next steps.' },
        { id: 'evolution:family-recommendations', goalId: direction.goalId, kind: 'evolution' as const, title: 'Family recommendations', sourceId: direction.goalId, order: 1, humanReviewRequired: false, generation: 2 as const, summary: 'Recommendations span family goals.', userValue: 'Families coordinate learning.' },
        { id: 'evolution:coaching', goalId: direction.goalId, kind: 'evolution' as const, title: 'Progress coaching', sourceId: 'evolution:adaptive-plan', order: 2, humanReviewRequired: false, generation: 3 as const, summary: 'Progress patterns become guidance.', userValue: 'Parents can act on signals.' },
      ],
      dependencies: [{ ...dependency, dependentGoalIds: [direction.goalId] }],
      productIntelligenceState: 'enhanced',
    });
    const goal = model.nodes.find(node => node.id === direction.goalId)!;
    const second = model.nodes.filter(node => node.kind === 'evolution' && node.depth === 2);
    const third = model.nodes.find(node => node.id === 'evolution:coaching')!;
    const enabler = model.nodes.find(node => node.kind === 'dependency')!;

    expect(second).toHaveLength(2);
    expect(second.every(node => node.x > goal.x)).toBe(true);
    expect(third.x).toBeGreaterThan(Math.max(...second.map(node => node.x)));
    expect(model.edges).toContainEqual(expect.objectContaining({ sourceId: 'evolution:adaptive-plan', targetId: 'evolution:coaching' }));
    expect(enabler.x).toBeGreaterThan(goal.x);
    expect(enabler.x).toBeLessThan(second[0].x);

    const mobile = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [direction],
      projections: model.nodes.filter(node => node.kind === 'evolution').map((node, index) => ({
        id: node.id,
        goalId: direction.goalId,
        kind: 'evolution' as const,
        title: node.title,
        sourceId: index < 2 ? direction.goalId : 'evolution:adaptive-plan',
        order: index,
        humanReviewRequired: false,
        generation: node.depth as 2 | 3,
      })),
      dependencies: [],
      productIntelligenceState: 'enhanced',
    }, 'vertical');
    const mobileSecond = mobile.nodes.filter(node => node.kind === 'evolution' && node.depth === 2);
    expect(new Set(mobileSecond.map(node => node.x)).size).toBe(2);
    expect(new Set(mobileSecond.map(node => node.y)).size).toBe(2);
  });

  it('allocates terminal possibilities into collision-free columns without losing parent lineage', () => {
    const direction = {
      ...candidate('goal:terminal', 'primary', 1, 1),
      candidateClass: 'product-opportunity' as const,
      opportunityOrigin: 'strategic' as const,
    };
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [direction],
      projections: [
        { id: 'evolution:adaptive', goalId: direction.goalId, kind: 'evolution' as const, title: 'Adaptive route', sourceId: direction.goalId, order: 0, humanReviewRequired: false, generation: 2 as const },
        { id: 'evolution:collaborative', goalId: direction.goalId, kind: 'evolution' as const, title: 'Collaborative route', sourceId: direction.goalId, order: 1, humanReviewRequired: false, generation: 2 as const },
        { id: 'evolution:orchestration', goalId: direction.goalId, kind: 'evolution' as const, title: 'Product orchestration', sourceId: 'evolution:adaptive', order: 2, humanReviewRequired: false, generation: 3 as const },
        { id: 'evolution:network', goalId: direction.goalId, kind: 'evolution' as const, title: 'Partner network', sourceId: 'evolution:collaborative', order: 3, humanReviewRequired: false, generation: 3 as const },
      ],
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const terminal = model.nodes.filter(node => node.kind === 'evolution' && node.depth === 3);

    expect(terminal).toHaveLength(2);
    expect(Math.abs(terminal[0].x - terminal[1].x) >= 152 || Math.abs(terminal[0].y - terminal[1].y) >= 88).toBe(true);
    expect(model.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'evolution:adaptive', targetId: 'evolution:orchestration' }),
      expect.objectContaining({ sourceId: 'evolution:collaborative', targetId: 'evolution:network' }),
    ]));

    const mobile = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [direction],
      projections: model.nodes.filter(node => node.kind === 'evolution').map((node, index) => ({
        id: node.id,
        goalId: direction.goalId,
        kind: 'evolution' as const,
        title: node.title,
        sourceId: node.depth === 2 ? direction.goalId : index % 2 ? 'evolution:adaptive' : 'evolution:collaborative',
        order: index,
        humanReviewRequired: false,
        generation: node.depth as 2 | 3,
      })),
      dependencies: [],
      productIntelligenceState: 'enhanced',
    }, 'vertical');
    const mobileTerminal = mobile.nodes.filter(node => node.kind === 'evolution' && node.depth === 3);
    expect(Math.abs(mobileTerminal[0].y - mobileTerminal[1].y)).toBeGreaterThanOrEqual(132);
    expect(mobileTerminal[0].x).toBe(mobileTerminal[1].x);
  });

  it('places existing enablers upstream and required enablers downstream of their route', () => {
    const direction = {
      ...candidate('goal:enablers', 'primary', 2, 1),
      candidateClass: 'product-opportunity' as const,
      opportunityOrigin: 'strategic' as const,
    };
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [direction],
      projections: [{ id: 'evolution:next', goalId: direction.goalId, kind: 'evolution' as const, title: 'Next evolution', sourceId: direction.goalId, order: 0, humanReviewRequired: false, generation: 2 as const }],
      dependencies: [
        { ...dependency, id: 'dependency:existing', state: 'satisfied', dependentGoalIds: [direction.goalId] },
        { ...dependency, id: 'dependency:required', state: 'required', dependentGoalIds: [direction.goalId] },
      ],
      productIntelligenceState: 'enhanced',
    });
    const goal = model.nodes.find(node => node.id === direction.goalId)!;
    const existing = model.nodes.find(node => node.id === 'dependency:existing')!;
    const required = model.nodes.find(node => node.id === 'dependency:required')!;
    const evolution = model.nodes.find(node => node.id === 'evolution:next')!;

    expect(existing.x).toBeLessThan(goal.x);
    expect(required.x).toBeGreaterThan(goal.x);
    expect(required.x).toBeLessThan(evolution.x);
    expect(existing.role).toBe('satisfied');
    expect(required.role).toBe('required');
  });

  it('places synthesized unclassified previews away from their workflow goal', () => {
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [
        { ...candidate('goal:router', 'primary', 2, 2), title: 'Create a task router' },
        { ...candidate('goal:preview', 'candidate', 2, 2), title: 'Preview task routing map' },
      ],
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const router = model.nodes.find(node => node.id === 'goal:router')!;
    const preview = model.nodes.find(node => node.id === 'goal:preview')!;

    expect(router.presentationRow?.index).toBe(4);
    expect(preview.presentationRow?.index).toBe(2);
    expect(router.depth).toBe(preview.depth);
  });

  it('keeps canonical candidate coordinates stable across primary, support, saved, restore, and replacement mutations', () => {
    const baseCandidates = [
      candidate('goal:a', 'candidate', 2, 1),
      candidate('goal:b', 'candidate', 2, 2),
      candidate('goal:c', 'candidate', 2, 3),
    ];
    const build = (candidates: typeof baseCandidates) => buildRepositoryFuturesCanvasModel('shipseal', {
      candidates,
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const initial = build(baseCandidates);
    const primary = build(baseCandidates.map(item => item.goalId === 'goal:b' ? { ...item, role: 'primary' as const } : item));
    const supporting = build(baseCandidates.map(item => item.goalId === 'goal:b' ? { ...item, role: 'supporting' as const } : item));
    const saved = build(baseCandidates.map(item => item.goalId === 'goal:b' ? { ...item, role: 'saved' as const } : item));
    const restored = build(baseCandidates);
    const replacedPrimary = build(baseCandidates.map(item => ({
      ...item,
      role: item.goalId === 'goal:c' ? 'primary' as const : 'candidate' as const,
    })));

    expect(goalPosition(primary, 'goal:b')).toEqual(goalPosition(initial, 'goal:b'));
    expect(goalPosition(supporting, 'goal:b')).toEqual(goalPosition(initial, 'goal:b'));
    expect(goalPosition(saved, 'goal:b')).toEqual(goalPosition(initial, 'goal:b'));
    expect(goalPosition(restored, 'goal:b')).toEqual(goalPosition(initial, 'goal:b'));
    expect(goalPosition(replacedPrimary, 'goal:a')).toEqual(goalPosition(initial, 'goal:a'));
    expect(goalPosition(replacedPrimary, 'goal:b')).toEqual(goalPosition(initial, 'goal:b'));
  });

  it('does not reposition unrelated candidates when supports change, input order changes, or a new candidate appears', () => {
    const base = [
      candidate('goal:a', 'primary', 2, 1),
      candidate('goal:b', 'candidate', 2, 2),
      candidate('goal:c', 'candidate', 2, 3),
    ];
    const build = (candidates: typeof base) => buildRepositoryFuturesCanvasModel('shipseal', {
      candidates,
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const initial = build(base);
    const withSupport = build(base.map(item => item.goalId === 'goal:b' ? { ...item, role: 'supporting' as const } : item));
    const withoutSupport = build(base);
    const reordered = build(base.slice().reverse());
    const expanded = build([...base, candidate('goal:unrelated', 'candidate', 2, 2)]);

    for (const goalId of ['goal:a', 'goal:b', 'goal:c']) {
      expect(goalPosition(withSupport, goalId)).toEqual(goalPosition(initial, goalId));
      expect(goalPosition(withoutSupport, goalId)).toEqual(goalPosition(initial, goalId));
      expect(goalPosition(reordered, goalId)).toEqual(goalPosition(initial, goalId));
      expect(goalPosition(expanded, goalId)).toEqual(goalPosition(initial, goalId));
    }
  });

  it('keeps later semantic depths forward on desktop and mobile regardless of role', () => {
    const candidates = [
      candidate('goal:near', 'primary', 2, 1),
      candidate('goal:next', 'saved', 2, 2),
      candidate('goal:later', 'blocked', 2, 3),
    ];
    const input = { candidates, dependencies: [], productIntelligenceState: 'enhanced' as const };
    const desktop = buildRepositoryFuturesCanvasModel('shipseal', input, 'horizontal');
    const mobile = buildRepositoryFuturesCanvasModel('shipseal', input, 'vertical');

    expect(goalPosition(desktop, 'goal:near').canonicalPosition!.x).toBeLessThan(goalPosition(desktop, 'goal:next').canonicalPosition!.x);
    expect(goalPosition(desktop, 'goal:next').canonicalPosition!.x).toBeLessThan(goalPosition(desktop, 'goal:later').canonicalPosition!.x);
    expect(goalPosition(mobile, 'goal:near').canonicalPosition!.y).toBeLessThan(goalPosition(mobile, 'goal:next').canonicalPosition!.y);
    expect(goalPosition(mobile, 'goal:next').canonicalPosition!.y).toBeLessThan(goalPosition(mobile, 'goal:later').canonicalPosition!.y);
  });

  it('places each shared prerequisite once beside its dependent route on both axes', () => {
    const shared = {
      ...dependency,
      dependentGoalIds: ['goal:near', 'goal:later'],
    };
    const input = {
      candidates: [
        candidate('goal:near', 'primary', 2, 1),
        candidate('goal:later', 'supporting', 2, 3),
      ],
      dependencies: [shared, { ...shared }],
      productIntelligenceState: 'enhanced' as const,
    };
    const desktop = buildRepositoryFuturesCanvasModel('shipseal', input, 'horizontal');
    const mobile = buildRepositoryFuturesCanvasModel('shipseal', input, 'vertical');
    const desktopDependency = desktop.nodes.filter(node => node.id === shared.id);
    const mobileDependency = mobile.nodes.filter(node => node.id === shared.id);

    expect(desktopDependency).toHaveLength(1);
    expect(mobileDependency).toHaveLength(1);
    for (const goalId of shared.dependentGoalIds) {
      expect(desktopDependency[0].x).toBeGreaterThan(goalPosition(desktop, goalId).x);
      expect(mobileDependency[0].y).toBeGreaterThan(goalPosition(mobile, goalId).y);
    }
    expect(desktop.edges.filter(edge => edge.kind === 'requirement')).toHaveLength(2);
  });

  it('resolves duplicate candidate records to one visual node and one current role', () => {
    const duplicated = candidate('goal:duplicate', 'candidate', 2, 2);
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [duplicated, { ...duplicated, role: 'saved' }, { ...duplicated, role: 'primary' }],
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const rendered = model.nodes.filter(node => node.kind === 'goal' && node.id === duplicated.goalId);

    expect(rendered).toHaveLength(1);
    expect(rendered[0].role).toBe('primary');
  });

  it('draws the selected corridor over canonical nodes in forward spatial order', () => {
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [candidate('goal:primary', 'primary', 2, 1), candidate('goal:support', 'supporting', 2, 3)],
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const edge = model.edges.find(item => item.kind === 'selected-path')!;
    const source = model.nodes.find(node => node.id === edge.sourceId)!;
    const target = model.nodes.find(node => node.id === edge.targetId)!;

    expect(source.x).toBeLessThanOrEqual(target.x);
    expect([source.canonicalPosition, target.canonicalPosition]).not.toContain(undefined);
    expect(goalPosition(model, 'goal:primary').canonicalPosition?.candidateId).toBe('goal:primary');
    expect(goalPosition(model, 'goal:support').canonicalPosition?.candidateId).toBe('goal:support');
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

  it('keeps all Future topology hidden while Product Intelligence is analysing', () => {
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [candidate('goal:fallback', 'candidate')],
      dependencies: [],
      productIntelligenceState: 'analysing',
    });
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].kind).toBe('repository');
    expect(model.edges).toHaveLength(0);
  });

  it('expands grounded goals into real capability and artifact layers without duplicating candidate identities', () => {
    const goal = candidate('goal:future', 'candidate', 2, 1);
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [goal],
      projections: [
        { id: 'projection:capability', goalId: goal.goalId, kind: 'capability', title: 'Task routing', sourceId: goal.goalId, order: 0, humanReviewRequired: false },
        { id: 'projection:artifact:a', goalId: goal.goalId, kind: 'artifact', title: 'docs/TASK_ROUTER.md', sourceId: 'projection:capability', order: 0, humanReviewRequired: false },
        { id: 'projection:artifact:b', goalId: goal.goalId, kind: 'artifact', title: 'docs/COMMANDS.md', sourceId: 'projection:capability', order: 1, humanReviewRequired: false },
      ],
      dependencies: [],
      productIntelligenceState: 'enhanced',
    });
    const capability = model.nodes.find(node => node.kind === 'capability')!;
    const artifact = model.nodes.find(node => node.kind === 'artifact')!;

    expect(model.nodes.filter(node => node.kind === 'goal')).toHaveLength(1);
    expect(model.nodes.filter(node => node.kind === 'capability')).toHaveLength(1);
    expect(model.nodes.filter(node => node.kind === 'artifact')).toHaveLength(2);
    expect(model.edges.filter(edge => edge.kind === 'expansion')).toHaveLength(3);
    expect(model.nodes.find(node => node.id === goal.goalId)!.x).toBeLessThan(capability.x);
    expect(capability.x).toBeLessThan(artifact.x);
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
      const verticalNode = vertical.nodes.find(item => item.id === node.id)!;
      if (!node.presentationRow) expect(verticalNode.x).toBe(node.y);
      if (node.canonicalPosition) expect(verticalNode.canonicalPosition).toMatchObject({ x: node.canonicalPosition.y, y: node.canonicalPosition.x });
      else expect(verticalNode.canonicalPosition).toBeUndefined();
    });
    const verticalRepository = vertical.nodes.find(node => node.kind === 'repository')!;
    const verticalGoals = vertical.nodes.filter(node => node.kind === 'goal');
    expect(verticalRepository.y).toBeLessThan(Math.min(...verticalGoals.map(node => node.y)));
    expect(vertical.edges).toEqual(horizontal.edges);
    expect(repositoryFuturesEdgePath(vertical.edges[0], new Map(vertical.nodes.map(node => [node.id, node])), 'vertical')).toContain(' C ');
  });
});

describe('Omega 18.5-V7.2 repository futures camera', () => {
  it('fits, pans and zooms around the requested anchor within useful bounded levels of detail', () => {
    const fit = fitRepositoryFuturesCamera({ width: 1200, height: 680 }, { width: 1480, height: 820 });
    expect(fit.zoom).toBeGreaterThanOrEqual(FUTURES_CAMERA_LIMITS.minimum);
    expect(repositoryFuturesLod(fit.zoom)).toBe('medium');
    expect(panRepositoryFuturesCamera(fit, 12, -8)).toEqual({ ...fit, x: fit.x + 12, y: fit.y - 8 });

    const anchor = { x: 400, y: 300 };
    const zoomed = zoomRepositoryFuturesCamera(fit, 1.2, anchor);
    expect(zoomed.zoom).toBe(1.2);
    expect((anchor.x - fit.x) / fit.zoom).toBeCloseTo((anchor.x - zoomed.x) / zoomed.zoom);
    expect(zoomRepositoryFuturesCamera(fit, 0.01, anchor).zoom).toBe(FUTURES_CAMERA_LIMITS.minimum);
    expect(zoomRepositoryFuturesCamera(fit, 10, anchor).zoom).toBe(FUTURES_CAMERA_LIMITS.maximum);
    expect(repositoryFuturesLod(0.5)).toBe('far');
    expect(repositoryFuturesLod(0.9)).toBe('medium');
    expect(repositoryFuturesLod(1.2)).toBe('near');
  });

  it('uses responsive safe insets for desktop, tablet, and mobile inspector occlusion', () => {
    const desktop = repositoryFuturesSafeInsets({ width: 1200, height: 700 }, { width: 320, height: 420 });
    const tablet = repositoryFuturesSafeInsets({ width: 900, height: 700 }, { width: 288, height: 420 });
    const mobile = repositoryFuturesSafeInsets({ width: 390, height: 700 }, { width: 360, height: 300 });

    expect(repositoryFuturesCameraLayout({ width: 1200, height: 700 })).toBe('desktop');
    expect(repositoryFuturesCameraLayout({ width: 900, height: 700 })).toBe('tablet');
    expect(repositoryFuturesCameraLayout({ width: 390, height: 700 })).toBe('mobile');
    expect(desktop.right).toBe(368);
    expect(tablet.right).toBe(328);
    expect(tablet.right).not.toBe(desktop.right);
    expect(mobile.bottom).toBe(430);
    expect(repositoryFuturesSafeInsets({ width: 390, height: 700 }).bottom).toBe(82);
    expect(mobile.right).toBe(18);
  });

  it('leaves a comfortably visible target completely unchanged', () => {
    const camera = { x: 20, y: 10, zoom: 0.8 };
    const viewport = repositoryFuturesSafeViewport({ width: 1000, height: 700 }, { top: 80, right: 300, bottom: 20, left: 60 });
    const revealed = revealRepositoryFuturesTarget(camera, viewport, { x: 500, y: 350, width: 200, height: 100 });
    expect(revealed).toBe(camera);
    expect(revealed).toEqual({ x: 20, y: 10, zoom: 0.8 });
  });

  it('minimally reveals offscreen or inspector-covered targets without changing zoom', () => {
    const camera = { x: 0, y: 0, zoom: 0.8 };
    const viewport = { width: 1200, height: 700 };
    const insets = repositoryFuturesSafeInsets(viewport, { width: 320, height: 500 });
    const safe = repositoryFuturesSafeViewport(viewport, insets);
    const covered = revealRepositoryFuturesTarget(camera, safe, { x: 1050, y: 360, width: 220, height: 100 });
    const offscreen = focusRepositoryFuturesCamera(camera, viewport, { x: 1800, y: 360 }, insets);

    expect(covered.x).toBeLessThan(camera.x);
    expect(covered.y).toBe(camera.y);
    expect(covered.zoom).toBe(camera.zoom);
    expect(offscreen.x).toBeLessThan(camera.x);
    expect(offscreen.zoom).toBe(camera.zoom);
  });

  it('fits meaningful bounds inside the safe viewport with breathing room', () => {
    const viewport = { width: 1200, height: 700 };
    const insets = repositoryFuturesSafeInsets(viewport, { width: 320, height: 480 });
    const safe = repositoryFuturesSafeViewport(viewport, insets);
    const bounds = { minX: 100, minY: 100, maxX: 1000, maxY: 650 };
    const camera = fitRepositoryFuturesBoundsCamera(viewport, bounds, insets, 40);

    expect(bounds.minX * camera.zoom + camera.x).toBeGreaterThanOrEqual(safe.left + 39);
    expect(bounds.maxX * camera.zoom + camera.x).toBeLessThanOrEqual(safe.right - 39);
    expect(bounds.minY * camera.zoom + camera.y).toBeGreaterThanOrEqual(safe.top + 39);
    expect(bounds.maxY * camera.zoom + camera.y).toBeLessThanOrEqual(safe.bottom - 39);
  });

  it('returns exactly the root, selected goals, and their automatic dependencies for plan framing', () => {
    const model = buildRepositoryFuturesCanvasModel('shipseal', {
      candidates: [
        candidate('goal:primary', 'primary', 2, 2),
        candidate('goal:support', 'supporting', 2, 3),
        candidate('goal:alternative', 'candidate', 2, 1),
        candidate('goal:saved', 'saved', 2, 3),
      ],
      dependencies: [dependency],
      productIntelligenceState: 'enhanced',
    });
    const nodes = repositoryFuturesSelectedPlanNodes(model);
    const ids = nodes.map(node => node.id);
    const bounds = repositoryFuturesBounds(nodes);

    expect(ids).toEqual(expect.arrayContaining(['repository:shipseal', 'goal:primary', 'goal:support', 'dependency:test']));
    expect(ids).not.toContain('goal:alternative');
    expect(ids).not.toContain('goal:saved');
    expect(bounds).toBeDefined();
  });

  it('frames the repository origin at a useful orientation point', () => {
    const viewport = { width: 1200, height: 700 };
    const insets = repositoryFuturesSafeInsets(viewport);
    const safe = repositoryFuturesSafeViewport(viewport, insets);
    const camera = frameRepositoryFuturesOrigin(viewport, { x: 150, y: 410 }, 'horizontal', insets);

    expect(150 * camera.zoom + camera.x).toBeCloseTo(safe.left + safe.width * 0.25);
    expect(410 * camera.zoom + camera.y).toBeCloseTo(safe.top + safe.height / 2);
    expect(camera.zoom).toBe(0.9);
  });

  it('prevents total graph loss while retaining bounded overscroll', () => {
    const viewport = { width: 1200, height: 700 };
    const bounds = { minX: 45, minY: 70, maxX: 1260, maxY: 750 };
    const leftExtreme = constrainRepositoryFuturesCamera({ x: -10000, y: -10000, zoom: 0.8 }, viewport, bounds);
    const rightExtreme = constrainRepositoryFuturesCamera({ x: 10000, y: 10000, zoom: 0.8 }, viewport, bounds);

    expect(leftExtreme.x).toBeGreaterThan(-10000);
    expect(leftExtreme.y).toBeGreaterThan(-10000);
    expect(rightExtreme.x).toBeLessThan(10000);
    expect(rightExtreme.y).toBeLessThan(10000);
    expect(leftExtreme.x).toBeLessThan(0);
    expect(rightExtreme.x).toBeGreaterThan(0);
  });
});

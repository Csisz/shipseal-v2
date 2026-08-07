import { describe, expect, it } from 'vitest';
import { buildFutureFieldLayout, futureImpulseEvent, futureRoutePath } from '@/components/agentready/result-workspace/futures/futurePathwaysLayout';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

const callbacks = {
  onModeChange: () => undefined,
  onCandidateFocus: () => undefined,
  onCandidateSelect: () => undefined,
  onDependencyFocus: () => undefined,
  onOpenDomControls: () => undefined,
};

function candidate(goalId: string, role: RepositoryFutureStageOverlay['candidates'][number]['role'], capabilityId: string, universeNodeIds: string[]) {
  return {
    goalId,
    title: `${role} ${goalId}`,
    fit: 'Strong fit',
    role,
    origin: 'Deterministic evidence',
    capabilityId,
    confidence: 'high',
    compatibility: role === 'blocked' ? 'incompatible' : 'compatible',
    humanReviewRequired: false,
    evidenceCount: universeNodeIds.length,
    mappedEvidenceCount: universeNodeIds.length,
    universeNodeIds,
  };
}

function overlay(values: Partial<RepositoryFutureStageOverlay> = {}): RepositoryFutureStageOverlay {
  return {
    active: true,
    mode: 'quick',
    phase: 'possibility',
    graphFingerprint: 'graph:stable',
    candidates: [
      candidate('goal:a', 'candidate', 'testing', ['universe:test']),
      candidate('goal:b', 'candidate', 'documentation', ['universe:readme']),
      candidate('goal:c', 'blocked', 'deployment', ['universe:ci']),
    ],
    dependencies: [],
    artifactCount: 0,
    gateCount: 0,
    conflictCount: 1,
    limited: false,
    ...callbacks,
    ...values,
  };
}

describe('Omega 18.5d.1 deterministic Future Horizon layout', () => {
  it('is stable, curved and anchors paths to projected repository evidence', () => {
    const input = overlay();
    const projections = { 'universe:test': { x: 21, y: 42, visible: true } };
    const first = buildFutureFieldLayout(input, projections);
    const second = buildFutureFieldLayout(input, projections);

    expect(first).toEqual(second);
    expect(first.nodes.find(node => node.id === 'evidence:universe:test')).toMatchObject({ x: 21, y: 42, kind: 'evidence' });
    expect(first.routes.find(route => route.id === 'evidence:goal:a:0')?.source).toMatchObject({ x: 21, y: 42 });
    expect(futureRoutePath(first.routes[0])).toContain(' C ');
    expect(first.routes.find(route => route.kind === 'conflict')).toMatchObject({ broken: true });
  });

  it('reshapes synthesis into one dominant primary with ordered unique dependencies and converging supports', () => {
    const input = overlay({
      phase: 'synthesis',
      draftFingerprint: 'draft:stable',
      candidates: [
        candidate('goal:primary', 'primary', 'delivery', ['universe:root']),
        candidate('goal:support', 'supporting', 'testing', ['universe:test']),
        candidate('goal:saved', 'saved', 'documentation', ['universe:readme']),
      ],
      dependencies: [
        { id: 'dep:b', title: 'Build', state: 'required', dependentCount: 2, dependentGoalIds: ['goal:primary', 'goal:support'], executionOrder: 1, humanReviewRequired: false },
        { id: 'dep:a', title: 'Evidence', state: 'satisfied', dependentCount: 1, dependentGoalIds: ['goal:primary'], executionOrder: 0, humanReviewRequired: false },
      ],
    });
    const layout = buildFutureFieldLayout(input);
    const primary = layout.nodes.find(node => node.id === 'goal:primary')!;
    const support = layout.nodes.find(node => node.id === 'goal:support')!;
    const saved = layout.nodes.find(node => node.id === 'goal:saved')!;
    const dependencies = layout.nodes.filter(node => node.kind === 'dependency');

    expect(primary.x).toBeGreaterThan(dependencies.at(-1)!.x);
    expect(primary.scale).toBeGreaterThan(support.scale);
    expect(saved.opacity).toBeLessThan(support.opacity);
    expect(dependencies.map(node => node.id)).toEqual(['dep:a', 'dep:b']);
    expect(dependencies[0]).toMatchObject({ state: 'satisfied', reviewRequired: false });
    expect(new Set(dependencies.map(node => node.id)).size).toBe(dependencies.length);
    expect(layout.routes.some(route => route.id === 'support:goal:support' && route.kind === 'support')).toBe(true);
    expect(layout.routes.filter(route => route.kind === 'execution')).toHaveLength(2);
    expect(layout.routes.some(route => route.kind === 'saved' && !route.deterministic)).toBe(true);
  });

  it('keeps inferred and saved branches visually distinct from deterministic evidence', () => {
    const input = overlay({
      candidates: [
        { ...candidate('goal:deterministic', 'candidate', 'testing', ['universe:test']), origin: 'Deterministic evidence' },
        { ...candidate('goal:inferred', 'candidate', 'documentation', ['universe:readme']), origin: 'Provider suggestion' },
        candidate('goal:saved', 'saved', 'delivery', ['universe:root']),
      ],
    });
    const layout = buildFutureFieldLayout(input);

    expect(layout.routes.find(route => route.id === 'evidence:goal:deterministic:0')?.deterministic).toBe(true);
    expect(layout.routes.find(route => route.id === 'evidence:goal:inferred:0')?.deterministic).toBe(false);
    expect(layout.nodes.find(node => node.id === 'goal:saved')?.role).toBe('saved');
  });

  it('uses compact spatial goal nodes and removes semantic impulses in reduced motion', () => {
    const input = overlay({ focusedId: 'goal:a' });
    const layout = buildFutureFieldLayout(input);

    expect(layout.nodes.filter(node => node.kind === 'goal')).toHaveLength(input.candidates.length);
    expect(layout.nodes.every(node => !('card' in node))).toBe(true);
    expect(futureImpulseEvent(input, false)).toBe('evidence-focused');
    expect(futureImpulseEvent(input, true)).toBeUndefined();
    expect(futureImpulseEvent({ ...input, draftFingerprint: 'draft:stable' }, false)).toBe('synthesis-recomputed');
  });
});

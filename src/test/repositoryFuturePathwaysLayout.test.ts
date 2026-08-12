import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { buildFutureFieldLayout, futureImpulseEvent, futureRoutePath } from '@/components/agentready/result-workspace/futures/futurePathwaysLayout';
import { RepositoryFuturePathwaysStage } from '@/components/agentready/result-workspace/futures/RepositoryFuturePathwaysStage';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

const callbacks = {
  onModeChange: () => undefined,
  onCandidateFocus: () => undefined,
  onCandidateSelect: () => undefined,
  onCandidateAddSupport: () => undefined,
  onCandidateRemoveSupport: () => undefined,
  onCandidateReplaceSupport: () => undefined,
  onCandidateSave: () => undefined,
  onCandidateRestore: () => undefined,
  onDependencyFocus: () => undefined,
  onTracePreview: () => undefined,
  onTracePin: () => undefined,
  onTraceClear: () => undefined,
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
    capabilityTitle: `${capabilityId} capability`,
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
      candidate('goal:a', 'candidate', 'testing', ['repository:root', 'universe:test']),
      candidate('goal:b', 'candidate', 'documentation', ['universe:readme']),
      candidate('goal:c', 'blocked', 'deployment', ['universe:ci']),
    ],
    dependencies: [],
    artifactCount: 0,
    gateCount: 0,
    conflictCount: 1,
    limited: false,
    supportCount: 0,
    productIntelligenceState: 'deterministic-fallback',
    ...callbacks,
    ...values,
  };
}

describe('Omega 18.5d.2 directional Future Pathways layout', () => {
  it('does not present deterministic fallback cards as strong product directions while Product Strategist is analysing', () => {
    render(React.createElement(RepositoryFuturePathwaysStage, { overlay: overlay({ productIntelligenceState: 'analysing' }) }));
    expect(screen.getByRole('heading', { name: 'Future paths are forming' })).toBeInTheDocument();
    expect(screen.getByText(/without another loading screen/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Strong product directions/i })).not.toBeInTheDocument();
    expect(document.querySelector('[data-future-node="goal"]')).not.toBeInTheDocument();
  });

  it('is stable, curved and moves from specific evidence through capability to outcome without root routing', () => {
    const input = overlay();
    const projections = {
      'repository:root': { x: 49, y: 50, visible: true },
      'universe:test': { x: 21, y: 42, visible: true },
    };
    const first = buildFutureFieldLayout(input, projections);
    const second = buildFutureFieldLayout(input, projections);

    expect(first).toEqual(second);
    expect(first.zones.map(zone => zone.id)).toEqual(['current', 'intervention', 'decision', 'outcome']);
    expect(first.zones.map(zone => zone.label)).toEqual(['Current signals', 'Possible directions', 'Shared enablers', 'Future outcome']);
    expect(first.nodes.find(node => node.sourceUniverseNodeId === 'universe:test')).toMatchObject({ x: 21, y: 42, kind: 'evidence' });
    expect(first.nodes.some(node => node.sourceUniverseNodeId === 'repository:root')).toBe(false);
    expect(first.nodes.find(node => node.id === 'bundle:goal:a')!.x).toBeLessThan(first.nodes.find(node => node.id === 'intervention:goal:a')!.x);
    expect(first.nodes.find(node => node.id === 'intervention:goal:a')!.x).toBeLessThan(first.nodes.find(node => node.id === 'goal:a')!.x);
    expect(first.routes.every(path => path.target.x >= path.source.x)).toBe(true);
    expect(futureRoutePath(first.routes[0])).toContain(' C ');
    expect(first.routes.find(path => path.kind === 'conflict')).toMatchObject({ broken: true });
  });

  it('builds one ordered primary path with unique shared dependencies and support convergence', () => {
    const input = overlay({
      phase: 'synthesis',
      draftFingerprint: 'draft:stable',
      candidates: [
        candidate('goal:primary', 'primary', 'delivery', ['repository:root', 'universe:src']),
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
    expect(new Set(dependencies.map(node => node.id)).size).toBe(dependencies.length);
    expect(dependencies.find(node => node.id === 'dep:b')?.pathGoalIds).toEqual(['goal:primary', 'goal:support']);
    expect(layout.routes.some(path => path.id === 'support:goal:support' && path.target.x > path.source.x)).toBe(true);
    const sharedDependency = dependencies.find(node => node.id === 'dep:b')!;
    expect(layout.routes.find(path => path.id === 'support:goal:support')?.target).toMatchObject({ x: sharedDependency.x, y: sharedDependency.y });
    expect(layout.routes.filter(path => path.kind === 'execution')).toHaveLength(3);
    expect(layout.routes.some(path => path.kind === 'saved' && !path.deterministic)).toBe(true);
  });

  it('uses bounded evidence bundles, compact nodes and subordinate saved branches', () => {
    const input = overlay({
      candidates: [
        { ...candidate('goal:deterministic', 'candidate', 'testing', ['universe:test', 'universe:test-2', 'universe:test-3']), origin: 'Deterministic evidence' },
        { ...candidate('goal:inferred', 'candidate', 'documentation', ['universe:readme']), origin: 'Provider suggestion' },
        candidate('goal:saved', 'saved', 'delivery', ['universe:root']),
      ],
    });
    const layout = buildFutureFieldLayout(input);

    expect(layout.nodes.filter(node => node.kind === 'bundle')).toHaveLength(input.candidates.length);
    expect(layout.nodes.filter(node => node.kind === 'evidence' && node.pathGoalIds.includes('goal:deterministic'))).toHaveLength(2);
    expect(layout.routes.find(path => path.id === 'capability:goal:deterministic')?.deterministic).toBe(true);
    expect(layout.routes.find(path => path.id === 'capability:goal:inferred')?.deterministic).toBe(false);
    expect(layout.nodes.find(node => node.id === 'goal:saved')?.role).toBe('saved');
    expect(layout.nodes.every(node => !('card' in node))).toBe(true);
  });

  it('temporarily subordinates unrelated paths while keeping every node present, then restores the topology', () => {
    const base = overlay();
    const untraced = buildFutureFieldLayout(base);
    const traced = buildFutureFieldLayout({ ...base, activeTraceId: 'goal:a' });

    expect(traced.nodes).toHaveLength(untraced.nodes.length);
    expect(traced.routes).toHaveLength(untraced.routes.length);
    expect(traced.nodes.find(node => node.id === 'goal:a')!.opacity).toBe(untraced.nodes.find(node => node.id === 'goal:a')!.opacity);
    expect(traced.nodes.find(node => node.id === 'goal:b')!.opacity).toBeLessThan(untraced.nodes.find(node => node.id === 'goal:b')!.opacity);
  });

  it('keeps reduced motion topology identical while removing semantic impulses', () => {
    const input = overlay({ focusedId: 'goal:a' });
    expect(futureImpulseEvent(input, false)).toBe('evidence-focused');
    expect(futureImpulseEvent(input, true)).toBeUndefined();
    expect(futureImpulseEvent({ ...input, draftFingerprint: 'draft:stable' }, false)).toBe('synthesis-recomputed');
    expect(buildFutureFieldLayout(input)).toEqual(buildFutureFieldLayout(input));
  });
});

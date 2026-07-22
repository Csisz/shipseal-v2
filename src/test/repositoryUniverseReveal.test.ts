import { describe, expect, it } from 'vitest';
import { buildRepositoryUniverseRevealSchedule, repositoryUniverseRevealDuration, repositoryUniverseRevealProgress } from '@/lib/workspace/repositoryUniverseReveal';
import type { RepositoryUniverseModel } from '@/lib/workspace/repositoryUniverse';

const model: Pick<RepositoryUniverseModel, 'rootNodeId' | 'nodes' | 'edges'> = {
  rootNodeId: 'repo',
  nodes: [
    { id: 'repo', kind: 'repository', label: 'repo', clusterId: 'repository', evidenceType: 'evidence', importance: 'primary', radius: 1, position: { x: 0, y: 0, z: 0 }, evidenceItems: [], metadata: {} },
    { id: 'src', kind: 'folder', label: 'src', clusterId: 'source', evidenceType: 'evidence', importance: 'primary', radius: 1, position: { x: 1, y: 0, z: 0 }, evidenceItems: [], metadata: {} },
    { id: 'app', kind: 'file', label: 'app', clusterId: 'source', evidenceType: 'evidence', importance: 'primary', radius: 1, position: { x: 2, y: 0, z: 0 }, evidenceItems: [], metadata: {} },
    { id: 'readme', kind: 'file', label: 'readme', clusterId: 'docs', evidenceType: 'evidence', importance: 'supporting', radius: 1, position: { x: 0, y: 1, z: 0 }, evidenceItems: [], metadata: {} },
    { id: 'test', kind: 'file', label: 'test', clusterId: 'tests', evidenceType: 'heuristic', importance: 'background', radius: 1, position: { x: 0, y: 2, z: 0 }, evidenceItems: [], metadata: {} },
  ],
  edges: [
    { id: 'repo-src', source: 'repo', target: 'src', relationship: 'contains', evidenceType: 'evidence', evidenceItems: [] },
    { id: 'src-app', source: 'src', target: 'app', relationship: 'contains', evidenceType: 'evidence', evidenceItems: [] },
    { id: 'repo-readme', source: 'repo', target: 'readme', relationship: 'contains', evidenceType: 'evidence', evidenceItems: [] },
    { id: 'repo-test', source: 'repo', target: 'test', relationship: 'contains', evidenceType: 'heuristic', evidenceItems: [] },
  ],
};

describe('Repository Universe reveal schedule', () => {
  it('is deterministic and covers every node and edge exactly once', () => {
    const first = buildRepositoryUniverseRevealSchedule(model);
    const second = buildRepositoryUniverseRevealSchedule(model);
    expect(first.nodeOrder).toEqual(second.nodeOrder);
    expect(first.edgeOrder).toEqual(second.edgeOrder);
    expect(new Set(first.nodeOrder)).toEqual(new Set(model.nodes.map(node => node.id)));
    expect(new Set(first.edgeOrder)).toEqual(new Set(model.edges.map(edge => edge.id)));
  });

  it('reveals the core before clusters, important nodes, and supporting nodes', () => {
    const schedule = buildRepositoryUniverseRevealSchedule(model);
    expect(schedule.nodeOrder[0]).toBe('repo');
    expect(schedule.nodeOrder.indexOf('app')).toBeLessThan(schedule.nodeOrder.indexOf('test'));
    expect(repositoryUniverseRevealProgress(schedule, 0).visibleNodes).toEqual(['repo']);
    expect(repositoryUniverseRevealProgress(schedule, schedule.durationMs, false).visibleNodes).toHaveLength(model.nodes.length);
  });

  it('uses bounded duration and interruption immediately settles without restarting', () => {
    const schedule = buildRepositoryUniverseRevealSchedule(model);
    expect(repositoryUniverseRevealDuration(1)).toBe(2000);
    expect(repositoryUniverseRevealDuration(31)).toBe(2450);
    expect(repositoryUniverseRevealDuration(500)).toBe(3000);
    const interrupted = repositoryUniverseRevealProgress(schedule, 40, true);
    expect(interrupted).toMatchObject({ completed: true, phase: 'settled', progress: 1 });
    expect(interrupted.visibleEdges).toHaveLength(model.edges.length);
  });
});

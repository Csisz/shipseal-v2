import { describe, expect, it } from 'vitest';
import { buildRepositoryUniverseRouteEnergyPulses, repositoryUniverseRouteEnergyOscillation, repositoryUniverseRouteEnergyPulseCap } from '@/lib/workspace/repositoryUniverseRouteEnergy';
import type { RepositoryUniverseEdge } from '@/lib/workspace/repositoryUniverse';

const edges: RepositoryUniverseEdge[] = [
  { id: 'a-b', source: 'a', target: 'b', relationship: 'contains', evidenceType: 'evidence', evidenceItems: [] },
  { id: 'b-c', source: 'b', target: 'c', relationship: 'contains', evidenceType: 'evidence', evidenceItems: [] },
  { id: 'a-x', source: 'a', target: 'x', relationship: 'contains', evidenceType: 'evidence', evidenceItems: [] },
];

describe('Repository Universe route energy', () => {
  it('uses only visible canonical mapped route edges with a deterministic cap', () => {
    const route = new Set(['a', 'b', 'c']);
    const visible = new Set(edges.map(edge => edge.id));
    expect(buildRepositoryUniverseRouteEnergyPulses(edges, route, visible, 1440)).toEqual(buildRepositoryUniverseRouteEnergyPulses(edges, route, visible, 1440));
    expect(buildRepositoryUniverseRouteEnergyPulses(edges, route, visible, 1440).map(item => item.edgeId)).toEqual(['a-b', 'b-c']);
    expect(repositoryUniverseRouteEnergyPulseCap(390)).toBeLessThan(repositoryUniverseRouteEnergyPulseCap(1440));
  });
  it('uses a symmetric oscillation rather than directional traversal', () => {
    const phase = 1.2;
    expect(repositoryUniverseRouteEnergyOscillation(0, phase)).toBeCloseTo(repositoryUniverseRouteEnergyOscillation(1.25, phase));
  });
});

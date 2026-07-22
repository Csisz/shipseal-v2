import type { RepositoryUniverseEdge } from './repositoryUniverse';

export interface RepositoryUniverseRouteEnergyPulse {
  edgeId: string;
  phaseOffset: number;
}

export function repositoryUniverseRouteEnergyPulseCap(viewportWidth: number) {
  return viewportWidth < 640 ? 4 : 8;
}

/** Returns only canonical edges whose two endpoints are already route members. */
export function buildRepositoryUniverseRouteEnergyPulses(
  edges: readonly RepositoryUniverseEdge[],
  routeNodeIds: ReadonlySet<string>,
  visibleEdgeIds: ReadonlySet<string>,
  viewportWidth: number,
): RepositoryUniverseRouteEnergyPulse[] {
  return [...edges]
    .filter(edge => visibleEdgeIds.has(edge.id) && routeNodeIds.has(edge.source) && routeNodeIds.has(edge.target))
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, repositoryUniverseRouteEnergyPulseCap(viewportWidth))
    .map(edge => ({ edgeId: edge.id, phaseOffset: stablePhase(edge.id) }));
}

/** Oscillates 0→1→0, intentionally containing no directional traversal semantics. */
export function repositoryUniverseRouteEnergyOscillation(elapsedSeconds: number, phaseOffset: number) {
  return .5 + .5 * Math.sin(elapsedSeconds * Math.PI * 1.6 + phaseOffset);
}

function stablePhase(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}

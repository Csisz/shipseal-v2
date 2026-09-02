import type { RepositoryUniverseNode } from '@/lib/workspace';
import { repositoryUniverseSemanticStyle } from '@/lib/workspace/repositoryUniverseSemantics';

export const REPOSITORY_UNIVERSE_REVEAL_MS = 520;

export type RepositoryUniverseRevealLayer = 'repository' | 'landmarks' | 'relationships' | 'context';

const REPOSITORY_UNIVERSE_REVEAL_TIMING: Record<RepositoryUniverseRevealLayer, { delay: number; duration: number }> = {
  repository: { delay: 0, duration: 150 },
  landmarks: { delay: 72, duration: 190 },
  relationships: { delay: 155, duration: 220 },
  context: { delay: 235, duration: 260 },
};

export function repositoryUniverseRevealLayer(node: RepositoryUniverseNode, rootNodeId: string): RepositoryUniverseRevealLayer {
  if (node.id === rootNodeId || node.kind === 'repository') return 'repository';
  const semantic = repositoryUniverseSemanticStyle(node);
  if (semantic.emphasis === 'landmark' || semantic.emphasis === 'primary' || node.importance === 'primary') return 'landmarks';
  return 'context';
}

export function repositoryUniverseRevealProgress(
  elapsedMs: number,
  layer: RepositoryUniverseRevealLayer,
  enabled = true,
) {
  if (!enabled) return 1;
  const timing = REPOSITORY_UNIVERSE_REVEAL_TIMING[layer];
  return easeOutCubic(Math.max(0, Math.min(1, (elapsedMs - timing.delay) / timing.duration)));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

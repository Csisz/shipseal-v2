import type { RepositoryFuturesCanvasEdge, RepositoryFuturesCanvasNode } from './repositoryFuturesCanvasModel';
import type { RepositoryFuturesSemanticZoomLevel } from './repositoryFuturesCamera';

export type RepositoryFuturesEntryMotion = 'new-result' | 'cached-result';

export type RepositoryIntelligenceMotionEvent =
  | 'future-enter-new'
  | 'future-enter-cached'
  | 'node-hover'
  | 'node-pin'
  | 'primary-selected'
  | 'support-selected'
  | 'semantic-zoom-change'
  | 'view-change';

export const REPOSITORY_FUTURES_MOTION = {
  microMs: 160,
  localFocusMs: 220,
  routeResolutionMs: 420,
  workspaceTransitionMs: 420,
  semanticZoomHysteresis: 0.035,
} as const;

export function repositoryFutureEntryEvent(entry: RepositoryFuturesEntryMotion): RepositoryIntelligenceMotionEvent {
  return entry === 'new-result' ? 'future-enter-new' : 'future-enter-cached';
}

export function repositoryFutureNodeRevealDelay(
  node: RepositoryFuturesCanvasNode,
  entry: RepositoryFuturesEntryMotion,
) {
  const multiplier = entry === 'new-result' ? 1 : 0.38;
  const delay = node.kind === 'repository'
    ? 0
    : node.kind === 'goal'
      ? 58
      : node.kind === 'dependency' || node.kind === 'capability'
        ? 210
        : node.depth === 2
          ? 142
          : 250;
  return Math.round(delay * multiplier);
}

export function repositoryFutureEdgeRevealDelay(
  edge: RepositoryFuturesCanvasEdge,
  target: RepositoryFuturesCanvasNode | undefined,
  entry: RepositoryFuturesEntryMotion,
) {
  const multiplier = entry === 'new-result' ? 1 : 0.34;
  const delay = edge.kind === 'grounding'
    ? 92
    : target?.depth === 2
      ? 174
      : target?.depth === 3
        ? 252
        : 216;
  return Math.round(delay * multiplier);
}

export function repositoryFutureRouteResolutionDelay(
  target: RepositoryFuturesCanvasNode | undefined,
  role: 'primary' | 'supporting' | 'other',
) {
  const depth = target?.kind === 'repository' ? 0 : target?.depth || 1;
  const roleDelay = role === 'supporting' ? 74 : role === 'primary' ? 0 : 110;
  return roleDelay + Math.max(0, depth - 1) * 70;
}

const SEMANTIC_ZOOM_ORDER: RepositoryFuturesSemanticZoomLevel[] = ['strategy', 'path', 'detail', 'implementation'];
const SEMANTIC_ZOOM_THRESHOLDS = [0.68, 0.92, 1.18] as const;

/**
 * Keeps the current semantic level through a small overlap band. Camera
 * position remains untouched; only presentation disclosure is stabilized.
 */
export function repositoryFuturesSemanticZoomWithHysteresis(
  zoom: number,
  current: RepositoryFuturesSemanticZoomLevel,
  margin = REPOSITORY_FUTURES_MOTION.semanticZoomHysteresis,
): RepositoryFuturesSemanticZoomLevel {
  let currentIndex = SEMANTIC_ZOOM_ORDER.indexOf(current);
  if (currentIndex < 0) return current;

  while (currentIndex < SEMANTIC_ZOOM_THRESHOLDS.length) {
    const upper = SEMANTIC_ZOOM_THRESHOLDS[currentIndex];
    if (zoom < upper + margin) break;
    currentIndex += 1;
  }
  while (currentIndex > 0) {
    const lower = SEMANTIC_ZOOM_THRESHOLDS[currentIndex - 1];
    if (zoom >= lower - margin) break;
    currentIndex -= 1;
  }
  return SEMANTIC_ZOOM_ORDER[currentIndex];
}

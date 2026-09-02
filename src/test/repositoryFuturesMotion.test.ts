import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_FUTURES_MOTION,
  repositoryFutureEdgeRevealDelay,
  repositoryFutureEntryEvent,
  repositoryFutureNodeRevealDelay,
  repositoryFutureRouteResolutionDelay,
  repositoryFuturesSemanticZoomWithHysteresis,
} from '@/components/agentready/result-workspace/futures/repositoryFuturesMotion';
import type { RepositoryFuturesCanvasEdge, RepositoryFuturesCanvasNode } from '@/components/agentready/result-workspace/futures/repositoryFuturesCanvasModel';

const repository = { id: 'repository', kind: 'repository', depth: 0 } as RepositoryFuturesCanvasNode;
const goal = { id: 'goal', kind: 'goal', depth: 1 } as RepositoryFuturesCanvasNode;
const next = { id: 'next', kind: 'evolution', depth: 2 } as RepositoryFuturesCanvasNode;
const later = { id: 'later', kind: 'evolution', depth: 3 } as RepositoryFuturesCanvasNode;
const expansion = { id: 'edge', kind: 'expansion' } as RepositoryFuturesCanvasEdge;

describe('Omega 20.3 repository intelligence motion contract', () => {
  it('uses a small named timing hierarchy and distinguishes new from cached entry', () => {
    expect(REPOSITORY_FUTURES_MOTION.microMs).toBeLessThan(REPOSITORY_FUTURES_MOTION.localFocusMs);
    expect(REPOSITORY_FUTURES_MOTION.localFocusMs).toBeLessThan(REPOSITORY_FUTURES_MOTION.routeResolutionMs);
    expect(repositoryFutureEntryEvent('new-result')).toBe('future-enter-new');
    expect(repositoryFutureEntryEvent('cached-result')).toBe('future-enter-cached');
    expect(repositoryFutureNodeRevealDelay(repository, 'new-result')).toBe(0);
    expect(repositoryFutureNodeRevealDelay(goal, 'new-result')).toBeLessThan(repositoryFutureNodeRevealDelay(next, 'new-result'));
    expect(repositoryFutureNodeRevealDelay(next, 'new-result')).toBeLessThan(repositoryFutureNodeRevealDelay(later, 'new-result'));
    expect(repositoryFutureNodeRevealDelay(later, 'cached-result')).toBeLessThan(repositoryFutureNodeRevealDelay(later, 'new-result'));
    expect(repositoryFutureEdgeRevealDelay(expansion, later, 'cached-result')).toBeLessThan(repositoryFutureEdgeRevealDelay(expansion, later, 'new-result'));
  });

  it('resolves Primary before Supports and then advances through deeper generations', () => {
    expect(repositoryFutureRouteResolutionDelay(goal, 'primary')).toBeLessThan(repositoryFutureRouteResolutionDelay(goal, 'supporting'));
    expect(repositoryFutureRouteResolutionDelay(next, 'primary')).toBeGreaterThan(repositoryFutureRouteResolutionDelay(goal, 'primary'));
    expect(repositoryFutureRouteResolutionDelay(later, 'primary')).toBeGreaterThan(repositoryFutureRouteResolutionDelay(next, 'primary'));
  });

  it('holds semantic disclosure inside overlap bands without moving camera state', () => {
    expect(repositoryFuturesSemanticZoomWithHysteresis(0.69, 'strategy')).toBe('strategy');
    expect(repositoryFuturesSemanticZoomWithHysteresis(0.72, 'strategy')).toBe('path');
    expect(repositoryFuturesSemanticZoomWithHysteresis(0.9, 'path')).toBe('path');
    expect(repositoryFuturesSemanticZoomWithHysteresis(0.64, 'path')).toBe('strategy');
    expect(repositoryFuturesSemanticZoomWithHysteresis(1.3, 'strategy')).toBe('implementation');
    expect(repositoryFuturesSemanticZoomWithHysteresis(0.5, 'implementation')).toBe('strategy');
  });
});

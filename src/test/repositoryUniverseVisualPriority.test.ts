import { describe, expect, it } from 'vitest';
import { resolveRepositoryUniverseVisualPriority } from '@/lib/workspace/repositoryUniverseVisualPriority';

describe('Repository Universe visual priority', () => {
  it('hides filtered nodes and keeps selection dominant while route and heatmap coexist', () => {
    expect(resolveRepositoryUniverseVisualPriority({ visible: false, selected: true })).toMatchObject({ visible: false, selectionDominant: false });
    expect(resolveRepositoryUniverseVisualPriority({ visible: true, selected: true, hovered: true, route: true, heatmapValue: .8, reveal: true })).toMatchObject({ selectionDominant: true, hoverDominant: false, routeOutlined: true, heatmapFill: .8, revealAccent: false });
  });
  it('is deterministic and preserves hover over reveal', () => {
    const input = { visible: true, hovered: true, route: true, heatmapValue: .4, reveal: true };
    expect(resolveRepositoryUniverseVisualPriority(input)).toEqual(resolveRepositoryUniverseVisualPriority(input));
    expect(resolveRepositoryUniverseVisualPriority(input).revealAccent).toBe(false);
  });
});

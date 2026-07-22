import { describe, expect, it } from 'vitest';
import { buildRepositoryUniverseHeatmapDimensions, repositoryUniverseHeatmapValue } from '@/lib/workspace/repositoryUniverseHeatmap';

const model = { nodes: [
  { id: 'root', importance: 'primary', metadata: { relationshipCount: 4 } },
  { id: 'child', importance: 'background', metadata: { relationshipCount: 0 } },
] } as const;

describe('Repository Universe heatmap', () => {
  it('exposes only existing importance and relationship data deterministically', () => {
    const dimensions = buildRepositoryUniverseHeatmapDimensions(model as never);
    expect(dimensions.map(item => item.id)).toEqual(['importance', 'relationship-centrality']);
    expect(repositoryUniverseHeatmapValue(dimensions[0], 'root')).toBe(1);
    expect(repositoryUniverseHeatmapValue(dimensions[0], 'missing')).toBeNull();
  });
  it('normalizes identical values safely', () => {
    const [dimension] = buildRepositoryUniverseHeatmapDimensions({ nodes: [{ id: 'only', importance: 'supporting', metadata: { relationshipCount: 1 } }] } as never);
    expect(repositoryUniverseHeatmapValue(dimension, 'only')).toBe(.5);
  });
});

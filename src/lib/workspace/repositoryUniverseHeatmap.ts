import type { RepositoryUniverseModel } from './repositoryUniverse';

export type RepositoryUniverseHeatmapDimensionId = 'importance' | 'relationship-centrality';

export interface RepositoryUniverseHeatmapDimension {
  id: RepositoryUniverseHeatmapDimensionId;
  label: string;
  description: string;
  lowLabel: string;
  highLabel: string;
  values: ReadonlyMap<string, number>;
  minimum: number;
  maximum: number;
}

export function buildRepositoryUniverseHeatmapDimensions(model: Pick<RepositoryUniverseModel, 'nodes'>): RepositoryUniverseHeatmapDimension[] {
  const importance = new Map(model.nodes.map(node => [node.id, node.importance === 'primary' ? 1 : node.importance === 'supporting' ? .55 : .2]));
  const relationships = new Map(model.nodes.map(node => [node.id, Math.max(0, node.metadata.relationshipCount || 0)]));
  return [
    dimension('importance', 'Repository importance', 'Existing repository importance classification.', 'Background', 'Primary', importance),
    dimension('relationship-centrality', 'Relationship centrality', 'Existing relationship count for each represented entity.', 'Fewer relationships', 'More relationships', relationships),
  ];
}

export function repositoryUniverseHeatmapValue(dimension: RepositoryUniverseHeatmapDimension, nodeId: string) {
  const value = dimension.values.get(nodeId);
  if (value === undefined) return null;
  if (dimension.maximum === dimension.minimum) return .5;
  return Math.max(0, Math.min(1, (value - dimension.minimum) / (dimension.maximum - dimension.minimum)));
}

function dimension(id: RepositoryUniverseHeatmapDimensionId, label: string, description: string, lowLabel: string, highLabel: string, values: ReadonlyMap<string, number>): RepositoryUniverseHeatmapDimension {
  const range = [...values.values()];
  const minimum = range.length ? Math.min(...range) : 0;
  const maximum = range.length ? Math.max(...range) : 0;
  return { id, label, description, lowLabel, highLabel, values, minimum, maximum };
}

import type { RepositoryUniverseCluster, RepositoryUniverseNode } from './repositoryUniverse';

export type RepositoryUniverseSemanticType =
  | 'repository'
  | 'folder'
  | 'source'
  | 'documentation'
  | 'test'
  | 'configuration'
  | 'workflow'
  | 'agent-instruction'
  | 'generated'
  | 'asset'
  | 'concept'
  | 'recommendation'
  | 'missing'
  | 'unknown';

export type RepositoryUniverseSemanticEmphasis = 'landmark' | 'primary' | 'supporting' | 'background';

export interface RepositoryUniverseSemanticStyle {
  semanticType: RepositoryUniverseSemanticType;
  icon: RepositoryUniverseSemanticType;
  shortLabel: string;
  emphasis: RepositoryUniverseSemanticEmphasis;
}

const SEMANTIC_LABELS: Record<RepositoryUniverseSemanticType, string> = {
  repository: 'Repository',
  folder: 'Folder',
  source: 'Source code',
  documentation: 'Documentation',
  test: 'Test / verification',
  configuration: 'Configuration',
  workflow: 'Workflow / CI',
  'agent-instruction': 'AI instruction',
  generated: 'Generated output',
  asset: 'Asset',
  concept: 'Concept / knowledge',
  recommendation: 'Recommendation',
  missing: 'Missing / risk',
  unknown: 'Repository entity',
};

/**
 * Resolves visual identity from fields already present in the deterministic
 * Repository Universe model. It deliberately does not interpret file content
 * or invent architecture from names beyond the model's existing category.
 */
export function repositoryUniverseSemanticStyle(
  node: Pick<RepositoryUniverseNode, 'kind' | 'evidenceType' | 'importance' | 'metadata'>,
): RepositoryUniverseSemanticStyle {
  const semanticType = semanticTypeForNode(node);
  return {
    semanticType,
    icon: semanticType,
    shortLabel: SEMANTIC_LABELS[semanticType],
    emphasis: semanticEmphasisForNode(node),
  };
}

export function repositoryUniverseClusterSemanticStyle(
  cluster: Pick<RepositoryUniverseCluster, 'id' | 'category'>,
): RepositoryUniverseSemanticStyle {
  const semanticType = semanticTypeForCluster(cluster);
  return {
    semanticType,
    icon: semanticType,
    shortLabel: SEMANTIC_LABELS[semanticType],
    emphasis: 'landmark',
  };
}

function semanticTypeForNode(
  node: Pick<RepositoryUniverseNode, 'kind' | 'evidenceType' | 'metadata'>,
): RepositoryUniverseSemanticType {
  if (node.kind === 'repository') return 'repository';
  if (node.kind === 'folder') return 'folder';
  if (node.kind === 'recommendation') return 'recommendation';
  if (node.evidenceType === 'missing') return 'missing';
  if (node.kind === 'workflow') return 'workflow';
  if (node.kind === 'concept') return 'concept';

  const category = node.metadata.category;
  if (category === 'source') return 'source';
  if (category === 'documentation') return 'documentation';
  if (category === 'test') return 'test';
  if (category === 'configuration') return 'configuration';
  if (category === 'workflow') return 'workflow';
  if (category === 'agent-instruction') return 'agent-instruction';
  if (category === 'generated') return 'generated';
  if (category === 'asset') return 'asset';
  return 'unknown';
}

function semanticTypeForCluster(
  cluster: Pick<RepositoryUniverseCluster, 'id' | 'category'>,
): RepositoryUniverseSemanticType {
  if (cluster.id === 'cluster:repository' || cluster.category === 'repository') return 'repository';
  if (cluster.id === 'cluster:documentation') return 'documentation';
  if (cluster.id === 'cluster:project-memory') return 'agent-instruction';
  if (cluster.id === 'cluster:verification') return 'test';
  if (cluster.id === 'cluster:ci-workflow') return 'workflow';
  if (cluster.id === 'cluster:configuration') return 'configuration';
  if (cluster.id === 'cluster:assets') return 'asset';
  if (cluster.id === 'cluster:context') return 'concept';
  return cluster.category === 'src' || cluster.category === 'app' || cluster.category === 'lib'
    ? 'source'
    : 'folder';
}

function semanticEmphasisForNode(
  node: Pick<RepositoryUniverseNode, 'kind' | 'importance' | 'metadata'>,
): RepositoryUniverseSemanticEmphasis {
  if (node.kind === 'repository') return 'landmark';
  if (node.importance === 'primary') return 'primary';
  if (node.kind === 'folder' && (node.metadata.depth || 0) <= 1) return 'primary';
  if (node.importance === 'supporting' || node.kind === 'concept' || node.kind === 'workflow' || node.kind === 'recommendation') {
    return 'supporting';
  }
  return 'background';
}

export function drawRepositoryUniverseSemanticIcon(
  context: CanvasRenderingContext2D,
  semanticType: RepositoryUniverseSemanticType,
  centerX: number,
  centerY: number,
  size: number,
) {
  const unit = size / 24;
  context.save();
  context.translate(centerX - size / 2, centerY - size / 2);
  context.scale(unit, unit);
  context.lineWidth = 1.75;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
  };
  const rect = (x: number, y: number, width: number, height: number, radius = 0) => {
    if (radius > 0) context.roundRect(x, y, width, height, radius);
    else context.rect(x, y, width, height);
  };
  const circle = (x: number, y: number, radius: number) => {
    context.moveTo(x + radius, y);
    context.arc(x, y, radius, 0, Math.PI * 2);
  };

  if (semanticType === 'repository') {
    rect(3, 4, 7, 6, 1.3); rect(14, 4, 7, 6, 1.3); rect(8.5, 15, 7, 6, 1.3);
    line(6.5, 10, 10.5, 15); line(17.5, 10, 13.5, 15); line(10, 7, 14, 7);
  } else if (semanticType === 'folder') {
    context.moveTo(3, 7); context.lineTo(10, 7); context.lineTo(12, 9); context.lineTo(21, 9);
    context.lineTo(20, 19); context.lineTo(4, 19); context.closePath();
  } else if (semanticType === 'source') {
    context.moveTo(9, 7); context.lineTo(4, 12); context.lineTo(9, 17);
    context.moveTo(15, 7); context.lineTo(20, 12); context.lineTo(15, 17); line(14, 4, 10, 20);
  } else if (semanticType === 'documentation' || semanticType === 'unknown') {
    context.moveTo(6, 3); context.lineTo(15, 3); context.lineTo(20, 8); context.lineTo(20, 21); context.lineTo(6, 21); context.closePath();
    line(15, 3, 15, 8); line(15, 8, 20, 8); line(9, 13, 17, 13); line(9, 17, 15, 17);
  } else if (semanticType === 'test') {
    circle(12, 12, 9); context.moveTo(8, 12); context.lineTo(11, 15); context.lineTo(17, 9);
  } else if (semanticType === 'configuration') {
    line(4, 7, 20, 7); line(4, 12, 20, 12); line(4, 17, 20, 17);
    circle(9, 7, 2); circle(15, 12, 2); circle(10, 17, 2);
  } else if (semanticType === 'workflow') {
    circle(6, 5, 2.2); circle(18, 12, 2.2); circle(6, 19, 2.2);
    line(8.2, 5, 11, 5); context.moveTo(11, 5); context.quadraticCurveTo(14, 5, 14, 9); context.quadraticCurveTo(14, 12, 15.8, 12);
    line(8.2, 19, 11, 19); context.moveTo(11, 19); context.quadraticCurveTo(14, 19, 14, 15); context.quadraticCurveTo(14, 12, 15.8, 12);
  } else if (semanticType === 'agent-instruction') {
    rect(5, 7, 14, 12, 3); line(12, 4, 12, 7); circle(12, 3, 1); circle(9, 12, 1); circle(15, 12, 1); line(9, 16, 15, 16);
  } else if (semanticType === 'generated') {
    context.moveTo(12, 3); context.lineTo(21, 8); context.lineTo(21, 17); context.lineTo(12, 22); context.lineTo(3, 17); context.lineTo(3, 8); context.closePath();
    line(3, 8, 12, 13); line(21, 8, 12, 13); line(12, 13, 12, 22);
  } else if (semanticType === 'asset') {
    rect(3, 4, 18, 16, 2); circle(8, 9, 1.5); context.moveTo(5, 18); context.lineTo(10, 13); context.lineTo(13, 16); context.lineTo(16, 12); context.lineTo(21, 17);
  } else if (semanticType === 'concept') {
    circle(12, 12, 3); circle(5, 7, 2); circle(19, 6, 2); circle(18, 18, 2); circle(5, 18, 2);
    line(7, 8, 9.5, 10); line(17, 7, 14.5, 10); line(16.5, 17, 14.5, 14); line(7, 17, 9.5, 14);
  } else if (semanticType === 'recommendation') {
    circle(12, 10, 7); line(9, 17, 15, 17); line(10, 21, 14, 21); line(12, 3, 12, 1); line(4, 5, 2.5, 3.5); line(20, 5, 21.5, 3.5);
  } else if (semanticType === 'missing') {
    context.moveTo(12, 3); context.lineTo(22, 20); context.lineTo(2, 20); context.closePath(); line(12, 8, 12, 14); circle(12, 17, 0.7);
  }

  context.stroke();
  context.restore();
}

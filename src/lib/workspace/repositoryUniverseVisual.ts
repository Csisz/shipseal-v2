import type { RepositoryUniverseCluster, RepositoryUniverseNode } from './repositoryUniverse';

export interface RepositoryUniverseVisualToken {
  id: string;
  label: string;
  hex: number;
  css: string;
}

// Repository Universe visual grammar:
// hue = cluster membership; size = entity kind and importance;
// brightness/opacity = evidence state; glow = selection/focus;
// relationship lines = evidence strength and current local focus.
export const REPOSITORY_UNIVERSE_CLUSTER_PALETTE: RepositoryUniverseVisualToken[] = [
  { id: 'cyan', label: 'Cyan', hex: 0x38bdf8, css: '#38bdf8' },
  { id: 'violet', label: 'Violet', hex: 0xa78bfa, css: '#a78bfa' },
  { id: 'teal', label: 'Teal', hex: 0x2dd4bf, css: '#2dd4bf' },
  { id: 'blue', label: 'Blue', hex: 0x60a5fa, css: '#60a5fa' },
  { id: 'green', label: 'Green', hex: 0x86efac, css: '#86efac' },
  { id: 'amber', label: 'Amber', hex: 0xfbbf24, css: '#fbbf24' },
  { id: 'coral', label: 'Coral', hex: 0xfb7185, css: '#fb7185' },
  { id: 'magenta', label: 'Magenta', hex: 0xf0abfc, css: '#f0abfc' },
  { id: 'indigo', label: 'Indigo', hex: 0x818cf8, css: '#818cf8' },
  { id: 'slate', label: 'Cool neutral', hex: 0x94a3b8, css: '#94a3b8' },
];

const CLUSTER_COLOR_OVERRIDES: Record<string, string> = {
  'cluster:repository': 'cyan',
  'cluster:documentation': 'violet',
  'cluster:project-memory': 'teal',
  'cluster:verification': 'green',
  'cluster:ci-workflow': 'blue',
  'cluster:configuration': 'indigo',
  'cluster:assets': 'magenta',
  'cluster:context': 'slate',
};

export function repositoryUniverseClusterToken(clusterId: string): RepositoryUniverseVisualToken {
  const override = CLUSTER_COLOR_OVERRIDES[clusterId];
  const overrideToken = override ? REPOSITORY_UNIVERSE_CLUSTER_PALETTE.find(token => token.id === override) : undefined;
  if (overrideToken) return overrideToken;
  return REPOSITORY_UNIVERSE_CLUSTER_PALETTE[stableClusterIndex(clusterId, REPOSITORY_UNIVERSE_CLUSTER_PALETTE.length)];
}

export function repositoryUniverseNodeClusterToken(node: Pick<RepositoryUniverseNode, 'clusterId'>): RepositoryUniverseVisualToken {
  return repositoryUniverseClusterToken(node.clusterId || 'cluster:repository');
}

export function repositoryUniverseClusterLegend(clusters: RepositoryUniverseCluster[]) {
  return clusters.map(cluster => ({
    id: cluster.id,
    label: cluster.label,
    nodeCount: cluster.nodeIds.length,
    token: repositoryUniverseClusterToken(cluster.id),
  }));
}

export function brightenClusterColor(hex: number, amount: number) {
  return blendHex(hex, 0xf8fafc, amount);
}

export function softenClusterColor(hex: number, amount: number) {
  return blendHex(hex, 0x64748b, amount);
}

export function blendHex(first: number, second: number, amount: number) {
  const clamped = Math.max(0, Math.min(1, amount));
  const firstRed = (first >> 16) & 255;
  const firstGreen = (first >> 8) & 255;
  const firstBlue = first & 255;
  const secondRed = (second >> 16) & 255;
  const secondGreen = (second >> 8) & 255;
  const secondBlue = second & 255;
  const red = Math.round(firstRed + (secondRed - firstRed) * clamped);
  const green = Math.round(firstGreen + (secondGreen - firstGreen) * clamped);
  const blue = Math.round(firstBlue + (secondBlue - firstBlue) * clamped);
  return (red << 16) | (green << 8) | blue;
}

function stableClusterIndex(value: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

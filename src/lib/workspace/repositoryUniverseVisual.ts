import type { RepositoryUniverseCluster, RepositoryUniverseNode } from './repositoryUniverse';

export interface RepositoryUniverseVisualToken {
  id: string;
  label: string;
  hex: number;
  css: string;
}

// Renderer-only cinematic colors live together so Ω.17.5 can map them onto
// semantic theme tokens without changing repository or graph semantics.
export const REPOSITORY_UNIVERSE_CINEMATIC_TOKENS = {
  background: 0x000106,
  fog: 0x01030a,
  ambientLight: 0x789dff,
  keyLight: 0xe0fbff,
  coreGlow: 0x4de8ff,
  violetGlow: 0xa78bfa,
  warmGlow: 0xf8c86a,
  selected: 0xe6fdff,
  route: 0xf8c86a,
  search: 0xd8b4fe,
  connectedEdge: 0x8be9ff,
  evidenceEdge: 0x67e8f9,
  heuristicEdge: 0x94a3b8,
  containsEdge: 0x38bdf8,
  relationshipEdge: 0x5eead4,
  repositoryEmissive: 0x0891b2,
  primaryEmissive: 0x2563eb,
  quietEmissive: 0x0b1224,
  proposal: 0x9bdcf3,
  proposalSelected: 0xe0faff,
  starCool: 0xc2ecff,
  starViolet: 0xd8ccff,
  starWarm: 0xffe6a3,
} as const;

// Repository Universe visual grammar:
// hue = cluster membership; size = entity kind and importance;
// brightness/opacity = evidence state; glow = selection/focus;
// relationship lines = evidence strength and current local focus.
export const REPOSITORY_UNIVERSE_CLUSTER_PALETTE: RepositoryUniverseVisualToken[] = [
  { id: 'cyan', label: 'Cyan', hex: 0x22d3ee, css: '#22d3ee' },
  { id: 'violet', label: 'Violet', hex: 0xc084fc, css: '#c084fc' },
  { id: 'teal', label: 'Teal', hex: 0x14b8a6, css: '#14b8a6' },
  { id: 'blue', label: 'Blue', hex: 0x3b82f6, css: '#3b82f6' },
  { id: 'green', label: 'Green', hex: 0x4ade80, css: '#4ade80' },
  { id: 'amber', label: 'Amber', hex: 0xfbbf24, css: '#fbbf24' },
  { id: 'coral', label: 'Coral', hex: 0xfb7185, css: '#fb7185' },
  { id: 'magenta', label: 'Magenta', hex: 0xe879f9, css: '#e879f9' },
  { id: 'indigo', label: 'Indigo', hex: 0x818cf8, css: '#818cf8' },
  { id: 'lime', label: 'Lime', hex: 0xa3e635, css: '#a3e635' },
  { id: 'sky', label: 'Sky', hex: 0x38bdf8, css: '#38bdf8' },
  { id: 'rose', label: 'Rose', hex: 0xf43f5e, css: '#f43f5e' },
  { id: 'slate', label: 'Cool neutral', hex: 0x94a3b8, css: '#94a3b8' },
];

const CLUSTER_COLOR_OVERRIDES: Record<string, string> = {
  'cluster:repository': 'cyan',
  'cluster:documentation': 'violet',
  'cluster:project-memory': 'teal',
  'cluster:verification': 'green',
  'cluster:ci-workflow': 'amber',
  'cluster:configuration': 'indigo',
  'cluster:assets': 'rose',
  'cluster:context': 'slate',
  'cluster:source': 'blue',
  'cluster:src': 'blue',
  'cluster:app': 'sky',
  'cluster:test': 'lime',
  'cluster:tests': 'lime',
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

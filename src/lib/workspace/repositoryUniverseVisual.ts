import type { RepositoryUniverseCluster, RepositoryUniverseNode, RepositoryUniversePosition } from './repositoryUniverse';
import type { ShipSealResolvedTheme } from '@/lib/theme';

export interface RepositoryUniverseVisualToken {
  id: string;
  label: string;
  hex: number;
  css: string;
}

export interface RepositoryUniverseCameraFrame {
  theta: number;
  phi: number;
  radius: number;
  target: RepositoryUniversePosition;
}

const REPOSITORY_UNIVERSE_LAYOUT_SPREAD_XZ = 0.96;
const REPOSITORY_UNIVERSE_LAYOUT_SPREAD_Y = 0.78;

// Renderer-only cinematic colors live together so Ω.17.5 can map them onto
// semantic theme tokens without changing repository or graph semantics.
export const REPOSITORY_UNIVERSE_DARK_TOKENS = {
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
  starOpacity: 0.82,
  starSize: 1.35,
  fogDensity: 0.00027,
  ambientIntensity: 1.18,
  keyIntensity: 1.8,
  coreIntensity: 1.25,
  violetIntensity: 0.42,
  warmIntensity: 0.24,
  nodeEmissivePrimary: 0.38,
  nodeEmissiveQuiet: 0.11,
} as const;

export const REPOSITORY_UNIVERSE_LIGHT_TOKENS = {
  background: 0xe9eef1,
  fog: 0xf2f4f3,
  ambientLight: 0xc5d4df,
  keyLight: 0xffffff,
  coreGlow: 0x167b8f,
  violetGlow: 0x7562b8,
  warmGlow: 0xb97820,
  selected: 0x087c8d,
  route: 0xb76b16,
  search: 0x7251a6,
  connectedEdge: 0x257a91,
  evidenceEdge: 0x2b7184,
  heuristicEdge: 0x667584,
  containsEdge: 0x256f9d,
  relationshipEdge: 0x287a6e,
  repositoryEmissive: 0x0c6074,
  primaryEmissive: 0x244f96,
  quietEmissive: 0xc4ccd2,
  proposal: 0x6b4c9a,
  proposalSelected: 0x493078,
  starCool: 0x8194a3,
  starViolet: 0x9b8db3,
  starWarm: 0xb69a69,
  starOpacity: 0.28,
  starSize: 1.05,
  fogDensity: 0.00018,
  ambientIntensity: 1.65,
  keyIntensity: 1.35,
  coreIntensity: 0.42,
  violetIntensity: 0.14,
  warmIntensity: 0.12,
  nodeEmissivePrimary: 0.13,
  nodeEmissiveQuiet: 0.035,
} as const;

export type RepositoryUniverseRendererTokens = typeof REPOSITORY_UNIVERSE_DARK_TOKENS | typeof REPOSITORY_UNIVERSE_LIGHT_TOKENS;

// Stable dark alias for consumers that do not participate in the application theme.
export const REPOSITORY_UNIVERSE_CINEMATIC_TOKENS = REPOSITORY_UNIVERSE_DARK_TOKENS;

export function repositoryUniverseRendererTokens(theme: ShipSealResolvedTheme): RepositoryUniverseRendererTokens {
  return theme === 'light' ? REPOSITORY_UNIVERSE_LIGHT_TOKENS : REPOSITORY_UNIVERSE_DARK_TOKENS;
}

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

export function repositoryUniverseVisualPosition(
  node: Pick<RepositoryUniverseNode, 'id' | 'position'>,
  rootNodeId: string,
): RepositoryUniversePosition {
  if (node.id === rootNodeId) return { ...node.position };
  return {
    x: node.position.x * REPOSITORY_UNIVERSE_LAYOUT_SPREAD_XZ,
    y: node.position.y * REPOSITORY_UNIVERSE_LAYOUT_SPREAD_Y,
    z: node.position.z * REPOSITORY_UNIVERSE_LAYOUT_SPREAD_XZ,
  };
}

export function repositoryUniverseFocusCameraState<T extends RepositoryUniverseCameraFrame>(
  state: T,
  node: Pick<RepositoryUniverseNode, 'id' | 'kind' | 'position'>,
  rootNodeId: string,
): T {
  const rootSelected = node.id === rootNodeId;
  const focusRadius = node.kind === 'file' ? 240 : 320;
  return {
    ...state,
    radius: rootSelected ? Math.max(state.radius, 560) : Math.min(state.radius, focusRadius),
    target: repositoryUniverseVisualPosition(node, rootNodeId),
  };
}

export function repositoryUniverseInspectorAwareLookTarget(
  state: RepositoryUniverseCameraFrame,
  viewport: { width: number; height: number; fullscreen: boolean; inspectorOpen: boolean },
  amount = 1,
): RepositoryUniversePosition {
  if (!viewport.inspectorOpen || amount <= 0 || viewport.fullscreen) return { ...state.target };
  const height = Math.max(1, viewport.height);
  const worldUnitsPerPixel = (2 * state.radius * Math.tan((45 * Math.PI / 180) / 2)) / height;
  const desktop = viewport.width >= 1024;
  const horizontalPixels = desktop ? Math.min(364, viewport.width * 0.34) / 2 : 0;
  const verticalPixels = desktop ? 0 : Math.min(viewport.height * 0.36, 300) / 2;
  const right = {
    x: Math.sin(state.theta),
    y: 0,
    z: -Math.cos(state.theta),
  };
  const up = {
    x: -Math.cos(state.theta) * Math.cos(state.phi),
    y: Math.sin(state.phi),
    z: -Math.sin(state.theta) * Math.cos(state.phi),
  };
  const horizontalOffset = horizontalPixels * worldUnitsPerPixel * amount;
  const verticalOffset = verticalPixels * worldUnitsPerPixel * amount;
  return {
    x: state.target.x + right.x * horizontalOffset - up.x * verticalOffset,
    y: state.target.y + right.y * horizontalOffset - up.y * verticalOffset,
    z: state.target.z + right.z * horizontalOffset - up.z * verticalOffset,
  };
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

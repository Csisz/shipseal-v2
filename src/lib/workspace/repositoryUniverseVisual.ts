import type { RepositoryUniverseCluster, RepositoryUniverseNode, RepositoryUniversePosition } from './repositoryUniverse';
import { repositoryUniverseSemanticStyle, type RepositoryUniverseSemanticStyle } from './repositoryUniverseSemantics';
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

export type RepositoryUniverseSemanticZoomLevel = 'overview' | 'map' | 'detail' | 'evidence';

export interface RepositoryUniverseSemanticVisibilityState {
  showIcon: boolean;
  showLabel: boolean;
  nodeOpacityMultiplier: number;
}

const REPOSITORY_UNIVERSE_ZOOM_THRESHOLDS = {
  overview: 720,
  map: 430,
  detail: 240,
} as const;

const REPOSITORY_UNIVERSE_LAYOUT_SPREAD_XZ = 0.96;
const REPOSITORY_UNIVERSE_LAYOUT_SPREAD_Y = 0.78;

// Renderer-only cinematic colors live together so Ω.17.5 can map them onto
// semantic theme tokens without changing repository or graph semantics.
export const REPOSITORY_UNIVERSE_DARK_TOKENS = {
  mode: 'dark',
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
  iconSurface: 0x07111f,
  iconInk: 0xe6fdff,
  iconBorder: 0x8be9ff,
  landmarkInk: 0xeafcff,
  landmarkSurface: 0x07101d,
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
  materialMetalness: 0.18,
  materialRoughness: 0.38,
  edgeOpacitySelected: 0.78,
  edgeOpacitySelectedHeuristic: 0.5,
  edgeOpacityFocused: 0.42,
  edgeOpacityContainsQuiet: 0.02,
  edgeOpacityContainsBase: 0.045,
  edgeOpacityQuiet: 0.065,
  edgeOpacityBase: 0.18,
  nodeOpacityQuiet: 0.14,
  nodeOpacityBackground: 0.52,
  nodeOpacityBase: 0.9,
  selectedEmissiveIntensity: 1.62,
  priorityEmissiveIntensity: 0.94,
  routeEmissiveIntensity: 0.92,
  connectedEmissiveIntensity: 0.58,
  primaryEmissiveIntensity: 0.4,
  quietEmissiveIntensity: 0.09,
  haloAdditive: true,
  haloOpacitySelected: 0.58,
  haloOpacityHovered: 0.32,
  haloOpacitySearch: 0.3,
  haloOpacityRoute: 0.26,
  haloOpacityConnected: 0.15,
  haloPulseOpacity: 0.1,
  haloRoutePulseOpacity: 0.04,
  landmarkOpacityOverview: 0.92,
  landmarkOpacityMap: 0.68,
  landmarkOpacityDetail: 0.18,
  edgeOpacityOverview: 0.035,
  edgeOpacityOverviewContains: 0.012,
} as const;

export const REPOSITORY_UNIVERSE_LIGHT_TOKENS = {
  mode: 'light',
  background: 0xd8e2e6,
  fog: 0xe4eaec,
  ambientLight: 0xaec3cf,
  keyLight: 0xffffff,
  coreGlow: 0x0b6578,
  violetGlow: 0x6347a0,
  warmGlow: 0xa85b14,
  selected: 0x075f70,
  route: 0xa6530a,
  search: 0x5d338e,
  connectedEdge: 0x0f6178,
  evidenceEdge: 0x145f73,
  heuristicEdge: 0x536170,
  containsEdge: 0x1e5b86,
  relationshipEdge: 0x17685e,
  repositoryEmissive: 0x0a5364,
  primaryEmissive: 0x1e4387,
  quietEmissive: 0xaab7bf,
  iconSurface: 0xf9fbfa,
  iconInk: 0x143948,
  iconBorder: 0x176b7b,
  landmarkInk: 0x18384a,
  landmarkSurface: 0xf8faf9,
  proposal: 0x54327f,
  proposalSelected: 0x3f226d,
  starCool: 0x667d8d,
  starViolet: 0x81719d,
  starWarm: 0x9b7b46,
  starOpacity: 0.34,
  starSize: 1.12,
  fogDensity: 0.00012,
  ambientIntensity: 1.35,
  keyIntensity: 1.08,
  coreIntensity: 0.28,
  violetIntensity: 0.09,
  warmIntensity: 0.08,
  nodeEmissivePrimary: 0.08,
  nodeEmissiveQuiet: 0.015,
  materialMetalness: 0.1,
  materialRoughness: 0.5,
  edgeOpacitySelected: 0.94,
  edgeOpacitySelectedHeuristic: 0.72,
  edgeOpacityFocused: 0.64,
  edgeOpacityContainsQuiet: 0.06,
  edgeOpacityContainsBase: 0.11,
  edgeOpacityQuiet: 0.14,
  edgeOpacityBase: 0.32,
  nodeOpacityQuiet: 0.24,
  nodeOpacityBackground: 0.68,
  nodeOpacityBase: 0.98,
  selectedEmissiveIntensity: 0.72,
  priorityEmissiveIntensity: 0.38,
  routeEmissiveIntensity: 0.42,
  connectedEmissiveIntensity: 0.26,
  primaryEmissiveIntensity: 0.18,
  quietEmissiveIntensity: 0.025,
  haloAdditive: false,
  haloOpacitySelected: 0.18,
  haloOpacityHovered: 0.1,
  haloOpacitySearch: 0.13,
  haloOpacityRoute: 0.14,
  haloOpacityConnected: 0.07,
  haloPulseOpacity: 0.025,
  haloRoutePulseOpacity: 0.02,
  landmarkOpacityOverview: 0.96,
  landmarkOpacityMap: 0.74,
  landmarkOpacityDetail: 0.2,
  edgeOpacityOverview: 0.09,
  edgeOpacityOverviewContains: 0.035,
} as const;

export type RepositoryUniverseRendererTokens = typeof REPOSITORY_UNIVERSE_DARK_TOKENS | typeof REPOSITORY_UNIVERSE_LIGHT_TOKENS;

// Stable dark alias for consumers that do not participate in the application theme.
export const REPOSITORY_UNIVERSE_CINEMATIC_TOKENS = REPOSITORY_UNIVERSE_DARK_TOKENS;

export function repositoryUniverseRendererTokens(theme: ShipSealResolvedTheme): RepositoryUniverseRendererTokens {
  return theme === 'light' ? REPOSITORY_UNIVERSE_LIGHT_TOKENS : REPOSITORY_UNIVERSE_DARK_TOKENS;
}

export function repositoryUniverseSemanticZoomLevel(radius: number): RepositoryUniverseSemanticZoomLevel {
  if (radius >= REPOSITORY_UNIVERSE_ZOOM_THRESHOLDS.overview) return 'overview';
  if (radius >= REPOSITORY_UNIVERSE_ZOOM_THRESHOLDS.map) return 'map';
  if (radius >= REPOSITORY_UNIVERSE_ZOOM_THRESHOLDS.detail) return 'detail';
  return 'evidence';
}

export function repositoryUniverseSemanticVisibility(
  node: Pick<RepositoryUniverseNode, 'kind' | 'evidenceType' | 'importance' | 'metadata'>,
  state: {
    zoomLevel: RepositoryUniverseSemanticZoomLevel;
    selected?: boolean;
    hovered?: boolean;
    searched?: boolean;
    route?: boolean;
    connected?: boolean;
    focused?: boolean;
    hasSelection?: boolean;
    reducedMotion?: boolean;
  },
): RepositoryUniverseSemanticVisibilityState {
  const semantic = repositoryUniverseSemanticStyle(node);
  const forced = Boolean(state.selected || state.hovered || state.searched || state.route);
  const contextual = Boolean(state.connected || state.focused);
  return {
    showIcon: repositoryUniverseSemanticIconVisible(semantic, state.zoomLevel, forced, contextual),
    showLabel: repositoryUniverseSemanticLabelVisible(semantic, state.zoomLevel, forced, contextual),
    nodeOpacityMultiplier: repositoryUniverseSemanticOpacityMultiplier(semantic, state.zoomLevel, forced, contextual, Boolean(state.hasSelection)),
  };
}

export function repositoryUniverseSemanticIconVisible(
  semantic: RepositoryUniverseSemanticStyle,
  zoomLevel: RepositoryUniverseSemanticZoomLevel,
  forced: boolean,
  contextual: boolean,
) {
  if (forced) return true;
  const priority = semantic.emphasis === 'landmark' || semantic.emphasis === 'primary';
  if (zoomLevel === 'overview') return priority;
  if (zoomLevel === 'map') return priority || semantic.emphasis === 'supporting' || contextual;
  if (zoomLevel === 'detail') return semantic.emphasis !== 'background' || contextual;
  return true;
}

export function repositoryUniverseSemanticLabelVisible(
  semantic: RepositoryUniverseSemanticStyle,
  zoomLevel: RepositoryUniverseSemanticZoomLevel,
  forced: boolean,
  contextual: boolean,
) {
  if (forced) return true;
  const priority = semantic.emphasis === 'landmark' || semantic.emphasis === 'primary';
  if (zoomLevel === 'overview') return semantic.emphasis === 'landmark';
  if (zoomLevel === 'map') return priority || (contextual && semantic.emphasis !== 'background');
  if (zoomLevel === 'detail') return semantic.emphasis !== 'background' || contextual;
  return true;
}

export function repositoryUniverseSemanticOpacityMultiplier(
  semantic: RepositoryUniverseSemanticStyle,
  zoomLevel: RepositoryUniverseSemanticZoomLevel,
  forced: boolean,
  contextual: boolean,
  hasSelection: boolean,
) {
  if (forced) return 1;

  if (zoomLevel === 'overview') return semantic.emphasis === 'background' ? 0.42 : semantic.emphasis === 'supporting' ? 0.66 : 1;
  if (zoomLevel === 'map') return hasSelection && !contextual && semantic.emphasis === 'background' ? 0.5 : semantic.emphasis === 'background' ? 0.72 : 1;
  if (zoomLevel === 'detail') return hasSelection && !contextual && semantic.emphasis === 'background' ? 0.58 : 1;
  return hasSelection && !contextual && semantic.emphasis === 'background' ? 0.66 : 1;
}

export function repositoryUniverseLandmarkOpacity(
  zoomLevel: RepositoryUniverseSemanticZoomLevel,
  tokens: RepositoryUniverseRendererTokens,
) {
  if (zoomLevel === 'overview') return tokens.landmarkOpacityOverview;
  if (zoomLevel === 'map') return tokens.landmarkOpacityMap;
  if (zoomLevel === 'detail') return tokens.landmarkOpacityDetail;
  return 0;
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

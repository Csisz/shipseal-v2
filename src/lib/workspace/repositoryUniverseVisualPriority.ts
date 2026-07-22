export interface RepositoryUniverseVisualPriorityInput {
  visible: boolean;
  selected?: boolean;
  hovered?: boolean;
  matched?: boolean;
  focused?: boolean;
  route?: boolean;
  heatmapValue?: number | null;
  reveal?: boolean;
}

export interface RepositoryUniverseVisualPriority {
  visible: boolean;
  selectionDominant: boolean;
  hoverDominant: boolean;
  searchHighlighted: boolean;
  routeOutlined: boolean;
  heatmapFill: number | null;
  revealAccent: boolean;
}

/** Resolves channel ownership without collapsing independent visual layers into one state. */
export function resolveRepositoryUniverseVisualPriority(input: RepositoryUniverseVisualPriorityInput): RepositoryUniverseVisualPriority {
  if (!input.visible) return { visible: false, selectionDominant: false, hoverDominant: false, searchHighlighted: false, routeOutlined: false, heatmapFill: null, revealAccent: false };
  const selectionDominant = Boolean(input.selected);
  const hoverDominant = !selectionDominant && Boolean(input.hovered);
  return {
    visible: true,
    selectionDominant,
    hoverDominant,
    searchHighlighted: !selectionDominant && Boolean(input.matched),
    routeOutlined: Boolean(input.route),
    heatmapFill: input.heatmapValue == null ? null : Math.max(0, Math.min(1, input.heatmapValue)),
    revealAccent: !selectionDominant && !hoverDominant && !input.matched && !input.route && Boolean(input.reveal),
  };
}

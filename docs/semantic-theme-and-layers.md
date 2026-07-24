# Semantic themes and overlay layers

ShipSeal uses `next-themes` with the local-only `shipseal-theme` preference. Valid values are `light`, `dark`, and `system`. The inline initializer in `index.html` resolves that preference before the application module loads; React then maintains the root `.dark` class through `ThemeProvider`.

Application colors belong in the semantic variables in `src/index.css`. Components should use surface, foreground, border, control, evidence, perspective, and graph variables rather than assuming a dark canvas. Exported HTML, PDF, score, and Delivery Pack generators do not read the application theme.

## Layer contract

The reusable layer variables are:

1. `--layer-canvas`: canvas and renderer background
2. `--layer-graph-overlay`: noninteractive graph decoration and affordances
3. `--layer-context`: repository context and chapter rail
4. `--layer-toolbar`: stage and global toolbars
5. `--layer-inspector`: selected-entity inspector
6. `--layer-popover`: dropdowns, selects, popovers, and context menus
7. `--layer-tooltip`: tooltips
8. `--layer-dialog`: dialogs, sheets, drawers, and fullscreen workspace
9. `--layer-toast`: toast notifications
10. `--layer-critical`: reserved for critical modal overlays

Popover-like UI must use a Radix portal with collision handling instead of an absolutely positioned child of an `overflow-hidden` stage. Dialog and drawer primitives own focus trapping; nonmodal stage menus close on outside interaction or Escape and return focus to their trigger.

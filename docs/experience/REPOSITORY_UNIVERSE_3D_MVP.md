# Repository Universe 3D MVP

Sprint Omega 11 introduces Repository Universe as the spatial exploration layer for the AI Workspace.

## Purpose

Repository Universe turns the analyzed repository inventory into a navigable knowledge space. It does not rescan the repository and does not create a second analysis engine. The model is built from the existing scan report, Workspace Story and Repository Knowledge Model.

## File Inventory

The result report now exposes `analyzedFiles` as metadata-only repository file records:

- repository-relative path
- file size
- ignored state already determined by the scanner

Raw file contents are not included for visualization. Ignored/generated files are not expanded into visible file nodes unless they were intentionally analyzed. When only ignored counts are available, Universe shows an aggregate ignored-context entity.

## Graph Model

`buildRepositoryUniverseModel(report)` creates:

- one `file` node per analyzed file
- `folder` anchors from repository paths
- repository-derived clusters from folder and file category evidence
- a central repository node
- an aggregate ignored-context node when ignored counts exist

The 2D Atlas remains the curated high-signal view. Universe uses the same Workspace Story and Knowledge Model metadata where possible, but removes the high-signal cap for file nodes.

## Relationship Boundaries

Evidence-backed relationships currently include:

- repository/folder/file containment
- known Workspace Story references
- workflow support links
- agent-routing links for AI instruction files
- related-concept links from existing knowledge evidence

Universe does not fabricate imports, calls, tests, configures, documents or semantic similarity edges. Broad associations remain labeled as references, related-concept or heuristic.

## Interaction

The 3D view is lazy-loaded and rendered with Three.js/WebGL. It supports:

- orbit by dragging
- wheel zoom
- right-drag panning
- click selection
- double-click/focus actions
- fullscreen exploration
- all-file search through the DOM controls
- selected-entity inspector outside the canvas
- reduced-motion disabling idle rotation

Atlas 2D remains the accessibility and WebGL fallback view.

## Future Work

Future sprints can add progressive rendering for very large repositories, richer technical relationship extraction, semantic embeddings and true nearest-neighbor exploration. Those are intentionally out of scope for this MVP.

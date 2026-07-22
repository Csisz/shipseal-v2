# Repository Universe motion release

## Architecture

Repository Universe uses direct Three.js with one renderer, one canvas, and one requestAnimationFrame loop. The renderer owns its scene resources explicitly; fullscreen moves the persistent Universe rather than recreating it. Camera damping, focus settlement, node/edge/halo/label interpolation, and coalesced pointer picking all run in that loop without frame-driven React state.

Visual targets are recalculated only for explicit dirty dependencies. Canonical edges are four deterministic `LineSegments` batches with bounded semantic overlays. Labels are eligibility based and bounded; halo and label resources are released through the owned-resource lifecycle. A real unmount disposes each owned geometry, material, and texture exactly once.

## User behaviour

The staged reveal is deterministic: core, primary clusters, important nodes, relationships, supporting nodes, then settled overview. It is interruptible and does not replay for fullscreen, Atlas return, or chapter return while parent state survives. Responsive fullscreen uses dynamic viewport sizing, safe areas, shrink-safe controls, and a mobile inspector composition.

Supported evidence-backed heatmaps are **Importance** and **Connections** only. Risk, security, token, speed, difficulty, and other unsupported scores are intentionally absent. Agent Flight Path keeps its static route overlay and uses bounded, symmetric, direction-neutral pulse points: it conveys relationships, never execution order, arrows, or numbering.

With `prefers-reduced-motion`, reveal and visual states settle immediately, camera intro motion is skipped, and route energy is static while the route overlay remains available.

## Diagnostics and release measurements

Development-only frozen diagnostics report renderer/canvas lifecycle, FPS and renderer counters, batching, labels, halos, reveal, responsive metrics, heatmaps, visual priority, and route-energy ownership. They are absent from production bundles and removed on a genuine Universe unmount.

The current sample baseline is 31 visible entities, 41 canonical edges, four base edge batches, one renderer/canvas, and bounded labels/route pulses (mobile cap 4, desktop cap 8). U7 uses these counters alongside focused tests and browser verification for lifecycle acceptance.

## U7 browser acceptance evidence

Browser acceptance on 2026-07-22 used the built-in `sample-nextjs-app` and the focused-test task `Add tests for the scan flow`. The deterministic mapping produced eight Universe nodes and five existing canonical relationships: the tests folder and `tests/home.spec.ts` containment edge; the architecture-to-README reference; the README-to-AGENTS route; and the `src/index.test.ts` references to `tests/home.spec.ts` and `playwright.config.ts`. A fresh 1440 x 900 context reported 8 route nodes, 5 route edges, 5 eligible/moving pulse points, one renderer, zero renderer disposals, canvas `repository-universe-canvas-1`, four base edge batches, and zero duplicate disposals. Visual inspection confirmed a static route with symmetric, direction-neutral energy and no arrows or numbering.

Agent Flight Path now separates the cached computed route from its visual activation state. A compact, keyboard-accessible `Hide route` / `Show route` button appears only when a route maps existing nodes and exposes its state with `aria-pressed`. Generating a route activates it; hiding retains its task and stable node/edge mappings while removing route emphasis, static route overlays, and moving energy. Showing restores the same cached route without task regeneration, a renderer/canvas replacement, a reveal replay, or route-energy allocation churn.

Search, routed and non-route selection, routed and non-route hover, Importance, Connections, route-plus-heatmap selection, and Current/With ShipSeal coexistence kept selection dominant and did not invent route relationships. Heatmap and selection changes did not rebuild route geometry. During 3.5 seconds of pulse motion, buffer updates advanced while the geometry rebuild count stayed fixed. Five fullscreen enter/exit cycles preserved renderer, canvas, route, camera selection, Connections heatmap, four canonical batches, and the route geometry rebuild count. Atlas return preserved parent route, selection, and heatmap state; the existing Atlas-to-Universe mode switch intentionally remounted the renderer.

A separate clean `prefers-reduced-motion: reduce` context mounted the real Universe through `Explore in Repository Universe`. It immediately reported the settled phase, progress 1, 31 revealed nodes, 41 revealed edges, zero active visual interpolation, and zero programmatic camera motion. Importance, Connections, and Off applied immediately with no residual heatmap interpolation. The same route remained statically visible with 8 nodes, 5 edges, zero pulse points, inactive energy motion, and `routeEnergyReducedMotion: true`; selection, search, heatmap, fullscreen, and Atlas return preserved that state.

Normal-motion route hide/show acceptance completed five consecutive cycles. Active state reported 8 cached and active route nodes, 5 cached and active route edges, five moving pulses, and active motion. Hidden state retained the 8-node/5-edge cache but reported zero active route nodes/edges, zero pulses, inactive motion, and zero route visual emphasis. Geometry rebuild count remained 2, allocation remained 1, and route disposal remained 0 throughout. Connections and Importance heatmaps, selection, fullscreen, and the stable four canonical edge batches remained independent of route visibility.

Reduced-motion hide/show retained the static route when active and immediately removed/restored it when toggled. Both states reported zero moving pulses and inactive route-energy motion with `routeEnergyReducedMotion: true`; selection and heatmap priority remained intact with no interpolation.

Focused active-route hide/show checks passed at 390 x 844, 320 x 568, and 844 x 390. All three used the lower pulse capacity of 4, had zero horizontal document or Universe overflow, kept the heatmap legend and fullscreen exit in bounds, preserved selection dominance, and retained a stable renderer/canvas across fullscreen. Fresh normal-motion, reduced-motion, and mobile contexts recorded zero application console warnings/errors and zero failed network requests. Temporary browser contexts were closed after each run.

Validation after the U7 control change: the focused dashboard suite passed 44/44 tests in 102.99s; the combined focused motion/dashboard run passed 85/85 tests in 99.65s; the TypeScript application check, lint, and production build passed. Two consecutive full `npm test` runs both passed 74 test files with 655 passing tests and one skipped test: 117.51s, then 108.08s (all exit code 0).

## U4C decision and extension rules

Do not introduce `InstancedMesh` yet. The sample remains usable with four canonical edge batches and bounded interaction overlays; instancing would add stable-ID picking and per-instance selection/label/halo complexity. Reassess only with a representative large repository that demonstrates node draw calls as the measured bottleneck. Background file nodes are the only potential candidates; selected, hovered, labelled, and halo-bearing nodes must remain individual interactive overlays.

Future changes must preserve direct Three.js, a single renderer/canvas/RAF loop, stable graph IDs, evidence semantics, Atlas synchronization, fullscreen persistence, reduced-motion semantics, and explicit exactly-once cleanup.

## Known limitations

Browserslist data-age and chunk-size build notices are non-blocking. Atlas folder-to-selection mapping remains an existing edge case. Large-repository acceptance requires representative scanned fixtures rather than fabricated data.

The Agent Flight Path activation/deactivation blocker is resolved. Remaining limitations are the existing Atlas folder-to-selection edge case and the need for representative large-repository fixtures before making large-scale performance claims.

---
name: shipseal-universe-motion
description: Use when auditing, optimizing or modifying ShipSeal Repository Universe rendering, Three.js animation, camera movement, node interaction, route visualization, fullscreen behavior, performance or future heatmap integration.
---

# ShipSeal Repository Universe Motion

## Mission

Make the Repository Universe feel like an intelligent, responsive spatial instrument.

Motion must explain repository structure, relationships, focus, risk and change. Do not add animation only as decoration.

## Current renderer

The Repository Universe uses direct Three.js.

Preserve the existing direct Three.js renderer unless the user explicitly requests a separately justified renderer migration.

Do not introduce:

- React Three Fiber;
- @react-spring/three;
- react-force-graph;
- a second renderer;
- a second animation loop;
- unnecessary production dependencies.

Do not use --force or --legacy-peer-deps.

## Important files

Inspect these first:

- src/components/agentready/RepositoryUniverse3D.tsx
- src/components/agentready/ResultDashboard.tsx
- src/lib/workspace/repositoryUniverse.ts
- src/lib/workspace/repositoryUniverseVisual.ts
- src/lib/workspace/repositoryAgentFlightPath.ts
- src/test/repositoryUniverse.test.ts
- src/test/repositoryUniverse3dLabels.test.ts

## Contracts to preserve

Preserve:

- deterministic graph generation;
- one represented node for every analyzed file;
- stable node and edge IDs;
- current evidence semantics;
- filters and search;
- node selection;
- cluster focus;
- Agent Flight Path routeNodeIds;
- Atlas synchronization;
- Current versus With ShipSeal mode;
- proposal selection and exclusion;
- fullscreen and embedded layouts;
- reduced-motion behavior;
- lazy loading;
- scan, verification and serialization behavior.

## Motion implementation rules

Use the existing requestAnimationFrame loop.

Use delta-time-based damping for:

- camera position;
- camera target;
- camera radius;
- node scale;
- node opacity;
- emissive intensity;
- halo scale and opacity;
- edge opacity;
- cluster ring intensity.

Motion must remain interruptible. A new interaction must retarget the current transition rather than restarting it.

Do not call React setState on every animation frame.

Do not allocate new arrays, vectors, matrices, colors or sets inside high-frequency frame loops unless unavoidable.

## Performance priorities

Improve performance in this order:

1. Stop recalculating unchanged visual targets every frame.
2. Separate target-state calculation from frame interpolation.
3. Cache raycastable objects.
4. Throttle pointer raycasting to animation frames.
5. Combine ordinary edges into LineSegments where practical.
6. Create labels only for nodes that can currently display them.
7. Pool or reuse halo objects.
8. Consider InstancedMesh only for background file nodes after baseline measurements.

Do not begin with a complete instancing rewrite.

## Visual behavior

Initial reveal should:

1. establish the repository core;
2. reveal primary clusters;
3. reveal important nodes;
4. grow meaningful relationships;
5. introduce supporting nodes;
6. settle into an interactive overview.

Selection should:

- smoothly emphasize the selected node;
- emphasize first-degree neighbors;
- softly dim unrelated context;
- keep route highlighting distinguishable;
- avoid abrupt camera jumps;
- preserve repository orientation.

Ambient motion must be subtle and deterministic.

Do not move every node continuously.

## Fullscreen

Avoid rebuilding the complete WebGL scene solely because fullscreen state changed.

Preserve camera and interaction state when entering or leaving fullscreen.

## Verification

After each implementation slice:

1. run the focused tests;
2. run the app typecheck;
3. run lint;
4. run the production build;
5. use Playwright MCP on localhost;
6. inspect console warnings and errors;
7. test desktop and mobile;
8. test rapid repeated selection;
9. test fullscreen entry and exit;
10. test reduced motion;
11. compare before and after screenshots.

Report changed files, verified behavior, performance observations and remaining limitations.

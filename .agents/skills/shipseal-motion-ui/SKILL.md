---

name: shipseal-motion-ui
description: Use for ShipSeal UI/UX, animated interfaces, repository visualizations, loading experiences, neural graphs, Future Pathways, transitions, motion design, and other visual interaction work. Apply ShipSeal's product-specific visual language and motion principles. Do not use for backend-only or unrelated infrastructure work.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# ShipSeal Motion UI

Build ShipSeal interfaces as an AI Repository Intelligence product, not as a conventional dashboard.

## Core visual principles

* Motion must explain intelligence, state, causality, discovery, or progress. Never add motion purely as decoration.
* Prefer revealing information over displaying everything at once.
* Prefer understanding before metrics.
* Prefer exploration before dense controls.
* Prefer evidence before recommendations.
* Keep interfaces visually calm, premium, spacious, and deliberate.
* Use subtle science-fiction influence without turning the UI into cyberpunk decoration.
* Avoid excessive neon, particles, glow, glassmorphism, bouncing, and ornamental animation.

## Repository and neural visualizations

When representing repositories, dependencies, intelligence, routes, or Future Pathways:

* Every visible node and connection must have structural or semantic meaning.
* Never create random dots, disconnected circles, or arbitrary crossing lines to simulate complexity.
* Build graphs from an understandable hierarchy, topology, dependency structure, route, or generated layout.
* Prefer SVG paths or appropriate graph primitives when connections need to animate.
* Make primary paths visually stronger than supporting information.
* Keep secondary nodes and edges quieter until relevant.
* Use motion to show how information propagates through the graph.
* Prefer traveling pulses, path reveals, progressive activation, focus transitions, and restrained glow.
* A user should be able to visually infer where the process started, where it is going, and what is currently active.

## Future Pathways

Future Pathways must feel like a living intelligence map, not a roadmap, tree diagram, flowchart, or static dependency graph.

Use the product rule:

One primary path

* up to two compatible supporting goals
* automatically required dependencies
  = one coherent executable future plan.

The primary path must remain visually dominant.

Supporting paths should feel connected and compatible rather than competing with the main direction.

Required dependencies should be revealed as consequences of the selected future, not presented as equal alternatives.

Transitions between repository understanding and Future Pathways should feel continuous whenever practical.

## Loading and repository analysis

Do not use a generic spinner as the primary repository-analysis experience when a meaningful visualization is appropriate.

Prefer a visualization in which repository understanding visibly emerges over time.

For graph-based loading experiences:

1. Establish an identifiable repository/root state.
2. Reveal meaningful connections progressively.
3. Propagate computation or discovery along those connections.
4. Activate discovered structures in sequence.
5. Transition naturally toward the resulting repository visualization where possible.

Loading animations should reflect real application states whenever those states are available. Do not fake detailed progress when the application cannot support it.

## Implementation

* Use the installed Motion skill for substantial React animation work when appropriate.
* Prefer production React/SVG/CSS implementations over prerecorded video or GIF loaders.
* Use existing ShipSeal design tokens, components, typography, spacing, and architecture before introducing new patterns.
* Use shadcn components or the installed shadcn tooling where they fit, but do not force generic components into distinctive visualization experiences.
* Preserve existing product behavior and architecture unless a change is required for the requested experience.
* Do not rewrite unrelated areas while performing UI work.

## Interaction quality

* Animation should normally feel smooth, cinematic, controlled, and intentional.
* Avoid motion that delays user interaction unnecessarily.
* Maintain responsive layouts.
* Support `prefers-reduced-motion`.
* Avoid unnecessarily expensive DOM, SVG, blur, shadow, or continuous animation work.
* Aim for smooth runtime performance on normal modern hardware.

## Visual verification workflow

For meaningful UI changes:

1. Inspect the existing implementation before modifying it.
2. Implement the smallest coherent version of the intended experience.
3. Run the application.
4. Use Playwright when available to inspect the actual rendered result.
5. Check relevant desktop and mobile viewport sizes.
6. Inspect transitions and important animation states, not only the initial frame.
7. Fix obvious hierarchy, spacing, clipping, contrast, responsiveness, and motion problems.
8. Repeat visual verification after significant fixes.

Do not consider a major visual change finished solely because it compiles.

## Figma

Use Figma tooling when an existing design should be inspected, translated, or compared, or when moving between implementation and editable design materially helps.

Do not introduce a Figma dependency into simple implementation work when the repository itself provides sufficient design context.

## Completion

Before declaring UI work complete:

* verify relevant type checks/tests/builds;
* visually inspect the rendered result when tooling permits;
* confirm responsive behavior;
* confirm reduced-motion behavior for substantial animation;
* summarize what changed and what was visually verified.

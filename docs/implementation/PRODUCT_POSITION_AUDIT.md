# Product Position Audit

Last updated: 2026-07-14

## Purpose

Record the Omega 16.0 code-and-document audit that locks ShipSeal around AI repository intelligence and the Repository Intelligence PR while preserving implemented compatibility contracts.

Canonical decisions:

- Product direction and hierarchy: `docs/vision/POSITIONING.md`.
- Repository Intelligence PR implementation: `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md`.
- Current implementation sequencing: `docs/implementation/IMPLEMENTATION_MASTERPLAN_75.md`.

## Implementation confirmed against code

| Area | Confirmed implementation | Consequence for direction |
| --- | --- | --- |
| Scanner | `scanner.ts` inventories ZIP contents, reads only selected small text/config/document files, excludes binary/generated/vendor paths, enforces limits, and does not execute code. | Deep source understanding needs a new bounded readable-source selection stage; it cannot be claimed from current metadata alone. |
| Readiness and health | `readiness.ts`, `scoring.ts`, and `repositoryHealth/` produce deterministic scores, blockers, evidence, and compatibility reports. | Keep these authoritative and unchanged; do not let a model override blockers. |
| Provider boundary | `ai/types.ts` defines `AIProvider`; `localAiProvider.ts` generates synchronous deterministic narrative from scan metadata. | Reuse the boundary concept, but add a versioned structured deep-intelligence contract instead of treating current local narrative as source understanding. |
| Generated context | `deliveryPack/contextCompression.ts` generates architecture, critical-file, command, risk, task-router, and specialized context concepts; `folderAgents.ts` generates scoped suggestions. | Reuse artifact concepts and generators where compatible, but strengthen content with source responsibilities and statement-level evidence. |
| Workspace model | `workspace/` contains additive intelligence, memory, routing, Repository Universe, transformation, optimization, apply, and verification models. | Extend this foundation rather than replace readiness/export models. |
| Optimization plan | `repositoryOptimizationPlan.ts` maps selected proposals to generated artifacts, destinations, evidence references, conflicts, and ready/review-required/blocked states. | Reuse conflict and disposition concepts for Repository Intelligence artifacts. |
| Apply flow | `repositoryOptimizationApply.ts` prepares a ZIP and PR preview; it does not write the local repository. | Preserve review-first preparation and manual fallback. |
| GitHub PR | Existing GitHub App and temporary-token compatibility paths create branches/files/PRs after explicit UI action. | Do not change permissions or current creation behavior in Omega 16.0. Later integration should reuse this boundary. |
| Rescan | `repositoryVerification.ts` stores a session-local baseline and compares repository identity, path presence, optional content signatures, and neutral metric deltas. | Extend conservatively; do not claim runtime verification or causality. |
| Repository Universe | Current Universe models and 3D UI are implemented and tested against scan/workspace evidence. | Preserve it as the signature, optional advanced experience. Do not remove or make it the paid deliverable. |
| Exports | Delivery Pack manifest v2, PDF/HTML, Client Handoff, `score.json`, readiness packs, and report tests are established. | Keep as supporting outputs and compatibility contracts. |

## Positioning findings

The repository had converged on several overlapping top-level labels: AI Workspace Optimizer, AI Agent Efficiency Platform, Repository Intelligence Platform, Repository Health, and Delivery Pack. These describe useful layers but obscure the concrete outcome.

Omega 16.0 resolves the hierarchy:

1. AI repository intelligence and AI workspace improvement are the primary identity.
2. Repository Intelligence PR is the primary paid outcome.
3. Repository Universe is the preserved signature experience.
4. Client Handoff Pack is secondary and appears after repository understanding.
5. Delivery Packs, reports, readiness, testing, security, MCP, AI Act notes, manifests, and `score.json` are supporting outputs.

## Current versus future claims

### Safe current claims

- ShipSeal scans repository structure and selected text/configuration without executing imported code.
- It detects stack, commands, instructions, tests/CI signals, exclusions, and repository-health/readiness evidence deterministically.
- It generates Delivery Pack and context artifacts and can prepare reviewed readiness/optimization PR flows.
- It has a provider abstraction whose current implementation is local and deterministic.
- It can compare a later matching scan to a session-local baseline conservatively.

### Future claims gated by Omega 16.x

- Understanding source-file and folder responsibilities.
- Explaining critical flows and source relationships deeply.
- Producing consistently repository-specific memory rather than metadata-driven templates.
- Calling a deep-intelligence provider.
- Selling a validated Repository Intelligence PR outcome.

These future claims require the evidence, source-selection, validation, artifact-quality, and evaluation gates in the canonical specification.

## Documents: current, compatibility, and historical

### Current canonical

- `docs/vision/POSITIONING.md`: product direction and hierarchy.
- `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md`: implementation contract.
- `docs/implementation/IMPLEMENTATION_MASTERPLAN_75.md`: sprint sequence.
- `docs/vision/MESSAGING.md`: approved expression of the hierarchy.
- `docs/product/SHIPSEAL_2026_PRODUCT_ROADMAP.md`: long-term roadmap under the locked direction.
- `docs/product/SELLABLE_PRODUCT_BACKLOG.md`: commercial backlog, subordinate to the canonical direction/spec.
- `docs/DOCUMENTATION_INVENTORY.md`: document status map.

### Current compatibility references

- `docs/implementation/WORKSPACE_TRANSFORMATION_PLAN.md`
- `docs/implementation/OPTIMIZATION_APPLY_FLOW.md`
- `docs/implementation/RESCAN_VERIFICATION_LOOP.md`
- `docs/implementation/READINESS_FIX_PACK.md`
- `docs/implementation/SUGGESTED_READINESS_FIX_PACK.md`
- `docs/implementation/CREATE_READINESS_PR_PLAN.md` (explicitly deprecated as a product plan, but useful for implemented endpoint and safety history)
- architecture, GitHub, Delivery Pack, demo, security, and release documents listed in the inventory.

### Historical or deprecated

- `docs/archive/` product bibles and older strategy snapshots are historical references, not current authority.
- `docs/legacy/shipseal_project_documents/` and its ZIP remain quarantined historical material.
- Older Living Repository and experience-bible documents may inform design language but cannot override current direction or implementation constraints.

## Stale claims corrected in current documents

- The product no longer has AI Workspace Optimizer or AI Agent Efficiency Platform as competing canonical identities.
- The roadmap no longer treats Auto-fix PR as wholly future: safe reviewed PR and optimization-apply foundations already exist; Repository Intelligence depth is the missing next layer.
- GitHub App connection, selected-repository scanning, optimization apply preparation, Repository Universe, and rescan verification are acknowledged as implemented foundations.
- The current provider is explicitly local and deterministic, not an external LLM.
- Deep source understanding is explicitly future work, not implied by current generated context files.
- Broken Omega mojibake in the current implementation master plan was repaired; legacy files remain untouched.

## Compatibility language to preserve

- Delivery Pack
- readiness score and readiness thresholds
- Readiness PR endpoint/type names
- Repository Health
- `score.json`
- manifest v2
- Client Handoff reports
- AI Act readiness notes with **This is not legal advice.**

These terms are valid for implemented contracts, but they do not define the top-level product promise.

## Remaining copy debt

README, landing-page copy, dashboard hierarchy, package cards, demo docs, and older product prose still contain bridge language. They should be updated in focused follow-up work, especially Omega 17, rather than through an unreviewable broad rewrite in Omega 16.0.

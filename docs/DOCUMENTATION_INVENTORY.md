# ShipSeal Documentation Inventory

Last updated: 2026-07-14

## Canonical source-of-truth documents

Authority is intentionally narrow:

1. `docs/vision/POSITIONING.md` - canonical product promise, hierarchy, initial market/scope, and anti-positioning.
2. `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md` - canonical implementation specification for the primary paid outcome.
3. `docs/implementation/IMPLEMENTATION_MASTERPLAN_75.md` - canonical current sprint sequence.

No archive, legacy roadmap, product bible, experience bible, or compatibility plan overrides these three documents.

## Current supporting documents

- `README.md` - implemented setup, demo, GitHub, scan, export, and safety overview. It contains bridge language and is not the canonical product-direction document.
- `docs/vision/MESSAGING.md` - approved messaging derived from positioning.
- `docs/vision/SHIPSEAL_VISION.md` - broader vision; subordinate to current positioning.
- `docs/product/SHIPSEAL_2026_PRODUCT_ROADMAP.md` - long-term roadmap under the locked hierarchy.
- `docs/product/SELLABLE_PRODUCT_BACKLOG.md` - commercial and implementation backlog; subordinate to the spec and master plan.
- `docs/implementation/PRODUCT_POSITION_AUDIT.md` - Omega 16.0 code/document audit and current-vs-future claim boundary.
- `docs/ARCHITECTURE.md` - current technical architecture and non-executing scan/export boundaries.
- `docs/implementation/WORKSPACE_TRANSFORMATION_PLAN.md` - compatibility migration notes for workspace and score hierarchy.
- `docs/implementation/DASHBOARD_REDESIGN_PLAN.md` - future dashboard work; Omega 17 now owns the next decomposition.
- `docs/experience/REPOSITORY_UNIVERSE_3D_MVP.md` - implemented Universe architecture and evidence boundaries.
- `docs/implementation/OPTIMIZATION_APPLY_FLOW.md` - implemented optimization ZIP/PR preparation contract.
- `docs/implementation/RESCAN_VERIFICATION_LOOP.md` - implemented session-local verification contract.
- `docs/implementation/READINESS_FIX_PACK.md` and `SUGGESTED_READINESS_FIX_PACK.md` - compatibility pack behavior.
- `docs/github/GITHUB_APP_CONNECT_PLAN.md` - GitHub App connection and permission context.
- `docs/security/CRITICAL_FILES_POLICY.md` - sensitive-file review rules.
- `docs/release/RELEASE_CHECKLIST.md` - release checks.
- Demo, deployment, GitHub import, smoke-test, and sample-review documents remain operational references.

## Deprecated compatibility documents

- `docs/implementation/CREATE_READINESS_PR_PLAN.md` begins with `# DEPRECATED`. Its implemented API names, safety boundary, and historical decisions remain useful compatibility context, but it is not the future product plan.
- Older root-path references inside operational documents may still name pre-reorganization locations such as `docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md`. Correct them when those documents are next edited; do not treat the stale path as authority.

## Historical and archived documents

- `docs/archive/` - prior product bibles and strategic snapshots. Historical reference only.
- `docs/legacy/shipseal_project_documents/` - old Hungarian project-start material. Historical reference only.
- `docs/legacy/shipseal_project_documents.zip` - archived copy of deprecated material.
- Older Living Repository, signature-experience, and experience-bible documents are design history. Repository Universe remains current because the canonical positioning and implemented code preserve it, not because every historical document is current.

Legacy documents are preserved rather than rewritten or deleted.

## Encoding status

- Current edited documents use `Omega` or valid `Ω` characters without mojibake.
- Malformed Omega text in `docs/implementation/IMPLEMENTATION_MASTERPLAN_75.md` was corrected in Omega 16.0.
- Legacy files with encoding corruption remain quarantined and unchanged.
- If mojibake is found in another current document while it is being substantively edited, repair it in the same focused change.

## Compatibility rules

- Delivery Pack, Repository Health, readiness scores, `score.json`, manifest v2, PDF/HTML reports, Client Handoff, and existing PR endpoint names remain valid implemented contracts.
- Supporting-output documentation must keep static/non-executing scan boundaries accurate.
- Applicable client-facing legal or AI Act material must retain: **This is not legal advice.**
- Repository Universe must not be removed or described as deprecated.
- Client Handoff is secondary and post-repository-understanding.
- Deep Repository Intelligence is JS/TS-first until other stacks pass equivalent quality validation.

## Cleanup notes

- Prefer updating canonical files instead of creating parallel product roadmaps.
- Do not delete legacy material without human review.
- Omega 16.0 creates one new canonical implementation document only: `REPOSITORY_INTELLIGENCE_PR_SPEC.md`.
- README and UI copy remain follow-up work; Omega 16.0 is not a landing-page or dashboard rewrite.

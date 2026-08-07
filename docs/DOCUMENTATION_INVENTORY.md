# ShipSeal Documentation Inventory

Last updated: 2026-08-06

## Canonical source-of-truth documents

Authority is intentionally narrow:

1. `docs/vision/POSITIONING.md` - canonical product promise, hierarchy, initial market/scope, and anti-positioning.
2. `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md` - canonical implementation specification for the primary paid outcome.
3. `docs/implementation/SHIPSEAL_OMEGA_18_5_REPOSITORY_FUTURES_PRODUCT_INTERACTION_SPEC.md` - canonical Ω.18.5 product, interaction, conceptual-contract and acceptance specification after human acceptance.
4. `docs/implementation/IMPLEMENTATION_MASTERPLAN_75.md` - canonical current sprint sequence and milestone ledger; the historical filename does not describe current completion.

No archive, legacy roadmap, product bible, experience bible, or compatibility plan overrides these four documents.

## Current supporting documents

- `README.md` - implemented setup, demo, GitHub, scan, export, and safety overview. It contains bridge language and is not the canonical product-direction document.
- `docs/vision/MESSAGING.md` - approved messaging derived from positioning.
- `docs/vision/SHIPSEAL_VISION.md` - broader vision; subordinate to current positioning.
- `docs/product/SHIPSEAL_2026_PRODUCT_ROADMAP.md` - long-term roadmap under the locked hierarchy.
- `docs/product/SELLABLE_PRODUCT_BACKLOG.md` - commercial and implementation backlog; subordinate to the spec and master plan.
- `docs/implementation/PRODUCT_POSITION_AUDIT.md` - Omega 16.0 code/document audit and current-vs-future claim boundary.
- `docs/implementation/SHIPSEAL_OMEGA_18_5_HANDOFF.md` - implementation-grounded Ω.18.5 baseline and prerequisite handoff; subordinate to the canonical Repository Futures specification.
- `docs/ARCHITECTURE.md` - current technical architecture and non-executing scan/export boundaries.
- `docs/implementation/WORKSPACE_TRANSFORMATION_PLAN.md` - compatibility migration notes for workspace and score hierarchy.
- `docs/implementation/DASHBOARD_REDESIGN_PLAN.md` - historical Omega 17 design/implementation record; it does not override the current four-chapter workspace or Repository Futures specification.
- `docs/experience/REPOSITORY_UNIVERSE_3D_MVP.md` - implemented Universe architecture and evidence boundaries.
- `docs/implementation/OPTIMIZATION_APPLY_FLOW.md` - implemented optimization ZIP/PR preparation contract.
- `docs/implementation/RESCAN_VERIFICATION_LOOP.md` - legacy Optimization verification contract and compatibility notes; authoritative durable relationship rules are in `docs/implementation/AUTHORITATIVE_VERIFICATION_RELATIONSHIP.md`.
- `docs/implementation/ACCOUNT_PERSISTENCE_ARCHITECTURE.md` - implemented account/project/scan persistence boundary.
- `docs/implementation/AUTHORITATIVE_VERIFICATION_RELATIONSHIP.md` - authoritative durable baseline-to-rescan relationship contract and known limitations.
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
- Older Living Repository, signature-experience, and experience-bible documents are product-principle/design history. Repository Universe remains current because the canonical roadmap, Repository Futures specification and implemented code preserve it, not because every historical document is a current implementation contract.

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
- Repository Universe must not be removed, described as deprecated or reduced to optional decoration; it is the primary post-scan signature experience for current truth, with progressive WebGL and required accessible alternatives.
- Client Handoff is secondary and post-repository-understanding.
- Deep Repository Intelligence is JS/TS-first until other stacks pass equivalent quality validation.

## Cleanup notes

- Prefer updating canonical files instead of creating parallel product roadmaps.
- Do not delete legacy material without human review.
- Omega 16.0 created `REPOSITORY_INTELLIGENCE_PR_SPEC.md`; Ω.18.5a adds one distinct canonical Repository Futures specification rather than duplicating it across roadmaps.
- Historical planning documents remain preserved and subordinate to the current authority list.

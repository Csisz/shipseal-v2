# Optimization Apply Flow

Sprint Omega.14 connects the Actionable Optimization Plan to a bounded apply preparation path.

The Apply Flow is derived from `RepositoryOptimizationPlan`. It does not rescan the repository, change scoring, create a second analysis engine, or modify Delivery Pack export contracts.

## Model

`OptimizationApplyPlan` is a pure, deterministic model built from the selected Optimization Plan artifacts.

It contains:

- selected generated files
- generated paths and future repository destinations
- create, update and strengthen actions
- readiness state
- conflict notes
- contributing proposal IDs
- evidence references
- Optimization Pack manifest data
- manual apply instructions
- GitHub PR preview data

Blocked items stay represented in the manifest and review notes, but are not written as normal ZIP or PR files.

## Optimization Pack ZIP

The ZIP contains only selected Optimization Plan artifacts and review material:

- selected generated files under `ready/` or `review-required/`
- `optimization-manifest.json`
- `APPLY_INSTRUCTIONS.md`
- `REVIEW_NOTES.md`

The ZIP never writes to the local repository. It is a package for human review.

Review-required files use deterministic review paths. Duplicate package paths are deduplicated deterministically so no ZIP entry silently overwrites another.

## GitHub PR Boundary

The PR preview reuses the existing GitHub App PR endpoint instead of creating a parallel PR system.

PR creation is available only when the scan has a connected GitHub App repository context. The UI requires an explicit confirmation action before calling the GitHub write endpoint.

The PR uses:

- a safe `shipseal/optimization-pack` branch name
- a clear Optimization Pack title and body
- selected PR-ready files only
- review-required and blocked notes in the PR body

ZIP/manual fallback remains visible when GitHub is unavailable or PR creation fails.

## Truthfulness

Omega.14 uses preparation language only:

- prepared
- selected
- generated for review
- ready for package
- review required
- PR preview
- package downloaded
- PR created only after GitHub confirms success

It does not introduce Applied state, verified improvement, token savings, time savings, merge state, deployment state, or rescan comparison.

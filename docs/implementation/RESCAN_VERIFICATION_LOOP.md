# Rescan Verification Loop

Sprint Omega.15 adds the first session-local verification loop for ShipSeal Optimization Packs.

The loop is:

1. scan a repository
2. prepare an Optimization Pack or GitHub PR
3. save a verification baseline
4. apply reviewed changes outside ShipSeal
5. scan the repository again
6. compare the new scan against the saved baseline

The model is intentionally conservative. It does not persist backend history, call GitHub branch comparison APIs, rescan in the background, change scoring, or claim production behavior was verified.

## Model

`repositoryVerification.ts` exposes:

- `RepositoryVerificationBaseline`
- `RepositoryVerificationResult`
- `VerifiedArtifactMatch`
- `WorkspaceMetricComparison`
- `VerificationManifest`

The baseline is derived from the current scan and `OptimizationApplyPlan`. It stores repository identity, scan metadata, selected proposal IDs, selected artifacts, destination paths, readiness states, conflicts, content signatures for generated artifacts, and the Optimization Pack manifest.

It does not store full repository source contents.

## Matching Rules

Automatic verification runs only when the current scan appears to match the saved baseline repository.

Create artifacts:

- absent before and present after: detected after rescan
- absent after: not detected
- no comparable file inventory: not verifiable from static scan

Update and strengthen artifacts:

- matching content signature: content match verified
- path-only match: needs human review
- missing after rescan: missing after rescan

Review-required artifacts stay review-required unless content evidence strongly matches.

Blocked artifacts are represented in counts and notes, but are not counted as detected changes.

## Metric Comparison

Metric deltas are shown only when both baseline and current scans expose comparable values.

The copy uses neutral language:

- observed after rescan
- changed since baseline
- detected in current scan

It does not claim the Optimization Pack caused a score change.

## Visual Behavior

The Repository Atlas gains an `After rescan` view only after a matching later scan exists.

Detected current nodes can be highlighted, but the canonical Atlas and Universe models are not mutated. Repository Universe keeps rendering the current graph rather than fabricated applied nodes.

## Limitations

- Session-local baseline only.
- No backend history.
- No branch diff through GitHub API.
- No production verification.
- Content match requires explicit current content evidence; ordinary scans generally verify file presence only.

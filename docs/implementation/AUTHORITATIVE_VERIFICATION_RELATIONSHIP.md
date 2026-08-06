# Authoritative Verification Relationship

ShipSeal Omega 18.4 records a versioned, owner-scoped relationship between an immutable baseline scan and a later scan. The relationship binds a prepared plan, an optional applied operation or pull request, expected artifacts and statements, repository identity, branch, scanner and measurement versions, derived evidence, and a deterministic relationship fingerprint.

## Truthful lifecycle

Applied does not mean verified. A prepared or applied change remains `pending` until a later compatible scan supplies evidence. Deterministic synthesis can then produce `verified`, `partially-verified`, `unresolved`, `regressed`, or `incompatible`. Incompatible boundaries suppress direct score deltas instead of presenting unlike measurements as comparable.

Compatibility requires the same owner, project, and repository; a baseline, applied, or explicitly compatible branch; equal scanner and measurement boundaries; a later completion timestamp; matching prepared-plan identity; and non-limited evidence. ZIP export is preparation, not proof of application.

## Evidence and comparison

- Artifact expectations retain their operation, matching method, blocking status, path, result, confidence, and evidence identifiers.
- Statement expectations retain deterministic or human-review methods and distinguish confirmed, partial, contradicted, missing, and unavailable evidence.
- Repository graph differences use stable node and relationship identities. They report added, removed, changed, and responsibility-changed nodes, artifact paths, and resolved or new frictions without mutating the canonical graph.
- Score deltas are labeled as observed after rescan and exist only when scanner, measurement, scoring, and scan-boundary versions match.
- Accepted Deep Intelligence findings must retain their request, source-scan, prompt, schema, context, confidence, and evidence bindings. Rejected or mismatched findings remain limitations.
- Opportunity signals are provider-neutral, evidence-backed outputs for a later sprint; they are not Future Pathways and are not emitted from unresolved verification.

## Persistence and ownership

Schema `shipseal.verification-relationship.v2` and algorithm `shipseal.repository-verification.omega18.4.v1` are persisted by migration `0002_verification_relationship_v2`. The database enforces owner/project/baseline access in the persistence layer, rejects repository or timestamp mismatches, and deduplicates retries by owner plus relationship fingerprint. Opening a saved scan restores evidence without rescanning or calling a provider. Project, scan, and account deletion preserve the existing cascade behavior.

The saved-project flow provides **Verify from this baseline**. It restores and validates the baseline, runs a user-initiated later scan through the existing intake, and saves the later scan and relationship back to the same private project. It never mutates GitHub.

## Presentation

The Verify chapter presents one compact outcome and one primary next action, with technical evidence behind disclosure. The existing Atlas and Repository Universe may receive a verification overlay; no second graph is created. Overlays distinguish verified change, partial verification, unresolved work, regressions, newly detected nodes, and unchanged nodes, including a textual legend and DOM state for non-color access.

This verification is deterministic repository evidence, not production or legal verification. This is not legal advice.

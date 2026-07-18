# Implementation Master Plan (75%)

Last updated: 2026-07-17

Product direction is canonical in `docs/vision/POSITIONING.md`. Repository Intelligence PR implementation is canonical in `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md`.

## Guiding principle

Turn repository evidence into knowledge that helps AI coding agents work effectively.

## Completed foundation

- **Omega 6 - Repository DNA:** deterministic repository profile and evidence-oriented understanding.
- **Omega 7 - Repository Intelligence foundation:** workspace summary and confidence language.
- **Omega 8 - Mental Model:** connected repository knowledge.
- **Omega 9 - Living Repository:** guided exploration and Intelligence Reveal.
- **Omega 10-11 - Repository Universe:** 2D/3D visual navigation backed by analyzed-file inventory. Repository Universe remains a signature experience.
- **Omega 13 - Actionable Optimization Plan:** deterministic generator-backed proposals with create, update, strengthen, review-required, and blocked handling.
- **Omega 14 - Apply Flow:** Optimization Pack ZIP, PR preview, and explicit GitHub App creation through the existing write boundary.
- **Omega 15 - Rescan Verification:** session-local baseline and conservative later-scan file/content comparison.

## Current implementation sequence

### Omega 16 - Repository Intelligence PR

- **Omega 16.0:** product direction lock and canonical implementation specification (documentation only).
- **Omega 16.1:** evidence model and repository responsibility extraction - implemented on 2026-07-14; deterministic JS/TS evidence, responsibility, symbol, relationship, exclusion, and folder aggregation tests are in place. Human review remains required before release.
- **Omega 16.2:** bounded JS/TS source selection and context preparation - implemented on 2026-07-14; deterministic ranking, coverage reservations, bounded relationship support, content safety, structural outlines, truncation metadata, selection IDs, and bundle fingerprinting are in place. The result remains an internal future-provider boundary and requires human review before release.
- **Omega 16.3:** deep-intelligence provider boundary and validated result schema - implemented on 2026-07-14; bounded deterministic requests, strict provider-neutral schemas, evidence-authoritative validation, contradiction and sensitive-output rejection, confidence normalization, human-review states, stable finding IDs, and timeout/cancellation handling are in place. No production provider is connected, and the result remains internal pending human review.
- **Omega 16.4:** repository-specific artifact planning, generation and validation - implemented on 2026-07-14; structured evidence-linked statements, deterministic create/update/strengthen/skip/unavailable planning, handwritten-instruction preservation, bounded Markdown rendering, internal evidence manifest generation, deterministic-only fallback, and artifact-set validation are in place. Drafts remain internal and require human review before Omega 16.5 apply integration.
- **Omega 16.5a:** Repository Intelligence artifact review, preview and selection integration - implemented on 2026-07-14; validated Omega 16.4 drafts now adapt into a deterministic review model with conservative defaults, dependency-aware selection, per-artifact acknowledgement, handwritten-preserving previews, a focused Optimization Plan review surface, apply-readiness validation, and an internal selected-artifact payload. No GitHub mutation or production provider is connected, and human review remains required before release.
- **Omega 16.5b:** Repository Intelligence GitHub PR apply integration - implemented on 2026-07-15; the validated selected-artifact payload now carries content-free expected-file fingerprints, a server-only GitHub App boundary revalidates selected targets before preview and again before confirmed mutation, and deterministic create, machine-managed update, handwritten strengthen, branch, file-write, PR, recovery and future-rescan metadata are covered by focused tests. The existing Contents API remains sequential and can leave a reviewable branch without a PR after a partial GitHub failure; no automatic cleanup or merge is attempted.
- **Omega 16.6a:** Repository Intelligence rescan verification model - implemented on 2026-07-15; the internal Omega 16.5b baseline now retains bounded artifact, statement, provenance, managed-section and preservation fingerprints, while `repositoryIntelligenceVerification.ts` validates baseline compatibility and deterministically evaluates repository/branch identity, create/update/strengthen results, current evidence, statement truth, finite quality dimensions, lifecycle and evidence-backed open work. No UI, score, persistence, provider or public export integration was added.
- **Omega 16.6b:** Repository Intelligence verification experience - implemented on 2026-07-15; the validated Omega 16.5b PR response baseline now flows into the existing scanner session, a compatible later scan computes the authoritative Omega 16.6a result once from scanner-loaded content, and focused UI components present lifecycle, artifact states, statement truth, handwritten preservation, non-numeric quality and evidence-backed open work. Previous safe results remain visible during retry/failure, source contents never enter React state, and Optimization Plan verification, scoring, exports, GitHub mutation and Repository Universe remain unchanged.
- **Omega 16.6c:** repository-specificity and acceptance fixes - implemented on 2026-07-15; context guidance now requires sufficient deterministic responsibility evidence, placeholder-only environment templates are safe setup references, and folder responsibility uses confidence-, role- and relationship-weighted significance with explicit dominant, mixed and insufficient-evidence states. The verification summary keeps long repository and branch identity readable on narrow screens. Public exports, scores, GitHub behavior and Repository Universe remain unchanged.

### Omega 17 - Simplified post-scan experience

- **Omega 17.1:** simplified post-scan entry and safe `ResultDashboard` decomposition - implemented on 2026-07-16; the first result composition now leads with conservative repository understanding, at most three deterministic Repository Health frictions, the existing Repository Intelligence review path as the primary action, and Repository Universe as the prominent secondary action. `PostScanOverview`, `ResultChapterNav`, `repositoryFrictions`, and shared result-dashboard types are extracted under `src/components/agentready/result-dashboard/`; complex Universe, review, apply, verification, scoring and export ownership remains in the existing orchestration boundaries.
- **Omega 17.2:** progressive repository story and unified post-scan information architecture - implemented on 2026-07-16; detailed results now use exactly four chapters: Understand, Improve, Verify and Deliver. Workspace Story leads Understand before the existing lazy Repository Universe, evidence and health metrics are supporting disclosures, Repository Intelligence remains the primary Improve flow, verification separates saved baselines from later-scan evidence, and Client Handoff plus unchanged exports are consolidated under Deliver. Presentation boundaries live under `src/components/agentready/result-dashboard/`; scanner, scoring, Repository Intelligence, verification, export serialization and Universe model contracts are unchanged.
- **Omega 17.3:** post-scan performance, progressive loading and technical cleanup - implemented on 2026-07-16. Result chapters now mount on first visit and remain mounted with native inactive hiding; Understand, Improve, Verify and Deliver have independent async boundaries; Repository Universe model/WebGL initialization waits for viewport proximity or explicit intent; Deliver-only preview, report and archive paths remain action/chapter loaded; development fixtures remain excluded from production; React Router future flags are explicit; and lint is clean at zero warnings. The production `ResultDashboard` chunk fell from 549.69 kB to 423.09 kB without changing the accepted post-scan information architecture or Omega 16 contracts.
- Keep Repository Universe as an optional, lazy-loaded signature surface.
- Keep Client Handoff and Delivery Pack outputs available after understanding.

Omega 17 is complete. Remaining production deep-intelligence provider work stays outside this experience sprint.

### Omega P1 - Production deep-intelligence provider integration

- **Omega P1:** implemented on 2026-07-16 behind the existing provider-neutral Omega 16.3 boundary. The optional server-only OpenAI-compatible HTTP adapter receives only the validated bounded request, requires explicit enablement and server credentials, validates structured output and evidence provenance, and falls back atomically to the complete deterministic result for every provider failure. One transient retry, cancellation, timeout, response-size, context-size and single-flight controls are bounded by policy. The review surface discloses deterministic, preparing, enhanced and fallback states without changing artifact review or GitHub confirmation.
- The adapter lives under `api/_lib/repositoryDeepIntelligenceProvider.ts`; `api/repository-intelligence.ts` is its safe HTTP boundary. Client-safe status and request code live in `productionProviderContract.ts` and `deepIntelligenceClient.ts`. No provider SDK was added and the server adapter is absent from browser assets.
- Deterministic evidence remains authoritative. Readiness and Repository Health scoring, public serialization, Delivery Pack and Client Handoff exports, GitHub mutation semantics, rescan verification algorithms, Repository Universe, and the four Omega 17 chapters are unchanged.

### Omega 18 - Minimal commercial foundation

- **Omega 18.1:** account and project persistence foundation - implemented on 2026-07-17 with dedicated GitHub OAuth identity, opaque database-backed sessions, private owner-scoped PostgreSQL projects, immutable scan snapshots, versioned verification relationships, explicit Save project, lazy project/history routes, validated read/write schemas, and cascade-aware scan/project/account deletion. Anonymous scanning remains available; reopening history performs no scan, provider call, GitHub mutation, score recalculation, or verification-algorithm migration.
- **Omega 18.2:** public share page and badge backend - future scope.
- **Omega 18.3:** payment and entitlement - future scope.
- Security, privacy, tenancy, and retention review before release.

## Release gate

A Repository Intelligence sprint ships only if:

- generated facts describe the actual repository rather than generic best practices;
- every factual statement is traceable to evidence;
- unsupported claims are rejected or labeled as limitations;
- source selection is bounded and visible;
- existing handwritten instructions and sensitive areas remain human-reviewable;
- the scan does not execute repository code;
- current readiness thresholds, exports, GitHub permissions, and PR behavior stay compatible unless a later explicit migration changes them;
- Repository Universe remains available;
- Client Handoff remains secondary and post-understanding;
- tests, lint, build, and required human review pass.

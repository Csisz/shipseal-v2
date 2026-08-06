# ShipSeal Ω.18.5 Handoff

Status: specification handoff for the next Codex session

Repository inspected: 2026-08-06

This document describes the repository at the end of Ω.18.4 and its production NodeNext hotfix. It also defines the intended Ω.18.5 direction. Current behavior and future intent are deliberately separated below.

## 1. Repository state

- Branch: `main`.
- Upstream: `origin/main`; inspected branch was `0` ahead and `0` behind.
- Latest commit: `a87c851ed729cd3eec4488e67241bc7d48502678` (`fix(functions): restore NodeNext serverless compilation`).
- Expected next-session baseline: tracked files match `origin/main`. This handoff is intentionally uncommitted until the operator reviews it.
- Inspection caveat: a pre-existing untracked root file, `logo.png`, was present before this handoff. It is not part of Ω.18.4, the NodeNext hotfix, or this document; do not delete, add, or overwrite it without explicit direction.
- Before implementation, run `git status --short --branch`, confirm the expected documentation-only delta, and investigate any other change rather than resetting it.

## 2. Current product flow

1. The landing page states one repository-intelligence promise and leads into source selection.
2. A user chooses a local ZIP, public GitHub URL, connected GitHub App repository, or the sample. ZIP and downloaded archives are inspected as data and are never executed.
3. Optional Project Intake adds delivery context but does not block the first scan.
4. The local scan engine inventories files within bounded scanner rules, extracts deterministic evidence, calculates readiness and Repository Health, and prepares sanitized Repository Intelligence inputs. Public GitHub failure keeps a manual ZIP recovery path.
5. Truthful progress, limited-scan warnings, cancellation, failure recovery, and Intelligence Reveal bridge intake to results.
6. One post-scan workspace exposes four chapters: **Understand**, **Improve**, **Verify**, and **Deliver**. Repository Universe is the signature Understand surface, with a task-oriented agent flight path and progressive disclosures.
7. Improve turns evidence-backed frictions into proposals and generator-backed artifacts. The user reviews a prepared plan, then chooses ZIP/manual export or a connected GitHub PR route.
8. GitHub preview performs repository preflight and bounded diff preparation. Mutation occurs only after explicit confirmation; successful provider evidence may advance the lifecycle to Applied.
9. Verify compares a saved authoritative baseline with a user-initiated compatible later scan. It reports artifact, statement, graph, friction, and compatible score evidence without claiming causation or production correctness.
10. Deliver retains the Client Handoff, PDF/HTML report, Delivery Pack, manifests, `score.json`, and related exports.
11. Anonymous scan and export remain available. GitHub OAuth account sign-in is requested for private projects and saved scans; reopening a saved scan renders the validated snapshot without rescanning, provider execution, or GitHub mutation.

## 3. Completed milestone ledger

The commit history is the authority for what shipped. Some older planning documents use “Ω.18.1” for the account/persistence foundation while the later product sequence also uses Ω.18.1 for the actionable-improvement loop. Preserve the implemented contracts and resolve this numbering overlap in the Ω.18.5 specification rather than renaming history in code.

- **R0 — Truth and Type Safety Release Gate** (`5b1c43e`): locked truthful terminology and release-gate expectations.
- **Repository Universe and workspace evolution** (`06568a7` through `c8f1525`): made one immersive, full-bleed Repository Universe the primary post-scan experience; added cinematic 3D presentation and semantic Light/Dark/System themes.
- **Ω.17 modularity, disclosure, and mobile** (`a92f885`, `26c7b60`, `31119f6`): decomposed the result workspace, strengthened lazy boundaries, added contextual progressive disclosure, and delivered touch-safe mobile/overlay behavior.
- **Ω.17.7 proposal and verification clarity** (`cb81b28`, `cc4bd64`): clarified proposal identities and the Proposed-to-Verified lifecycle, then added a compact accessible verification journey.
- **Ω.17.8 landing, scan, reveal, and secondary surfaces** (`c2cb787`): unified the landing promise and source selection, simplified intake, made scan/reveal states truthful, and updated Privacy, Security, Not Found, Projects, Saved Scan, and account surfaces.
- **Account and persistence foundation**: dedicated GitHub OAuth identity, opaque hashed sessions, owner-scoped private projects, immutable snapshots, deletion behavior, and PostgreSQL persistence. Canonical details are in [Account and Project Persistence Architecture](ACCOUNT_PERSISTENCE_ARCHITECTURE.md).
- **Ω.18.1 — Actionable Improvement Loop** (`b7531d0`): joined friction, evidence, proposals, artifacts, validation, explicit preparation, ZIP, and PR routes without mutating the repository.
- **Ω.18.1a — Prepared Plan Review** (`da0eed1`): added the responsive list/detail review workspace, deterministic previews, and separate export/apply routes.
- **Ω.18.2 — GitHub PR Preview and Apply Hardening** (`6d4b947`): added deterministic prepared snapshots, preflight, bounded diffs, idempotent recovery, explicit confirmation, and truthful Prepared-to-Applied transitions.
- **Deep Intelligence productionization** (`a1ff565`): added bounded/redacted context, budgets, strict provider validation, calibrated confidence, safe fallback, diagnostics, and provider-neutral future-direction candidates.
- **Production auth/route recovery** (`584826b`): guarded lazy routes, centralized production configuration checks, corrected hosted routing, and kept anonymous source paths available when account services are unavailable.
- **Ω.18.4 — Authoritative Rescan Verification** (`7bddc5c`): bound owner/project identity, immutable scans, prepared plans, applied operations, artifacts, statements, graph differences, compatible score deltas, Deep Intelligence provenance, and bounded opportunity signals.
- **Post-Ω.18.4 NodeNext production hotfix** (`a87c851`): restored serverless module loading and added the function-specific compilation gate described below.

Earlier foundations remain active: deterministic Repository DNA and Health, connected repository knowledge, Intelligence Reveal, Repository Universe, the Actionable Optimization Plan, Optimization Pack ZIP/PR preparation, Repository Intelligence evidence/context/artifact pipelines, and session-local legacy Optimization Pack verification.

## 4. Production NodeNext hotfix and release gate

The production failure was not an account-domain logic error. Vercel loaded the account and GitHub route graphs with NodeNext semantics, while the previous root TypeScript checks used a browser/bundler-oriented resolution path. Server-reachable relative imports without explicit ESM extensions failed during function compilation/module loading; a loosely inferred prepared-artifact map also hid the `sourceItemId` contract.

The hotfix:

- uses explicit `.js` specifiers along implicated server-reachable ESM import chains;
- separates lightweight verification version constants and the optimization apply contract from large browser/workspace graphs;
- types the prepared-plan-to-GitHub snapshot from concrete `OptimizationPackFile` values;
- verifies account login/callback/session/logout/delete and GitHub login/callback/repository/optimization route-module loading without real provider mutation;
- adds `tsconfig.functions.json`, which compiles all seven Vercel entrypoints with `module` and `moduleResolution` set to `NodeNext`;
- adds `npm run typecheck:functions`; the root `npm run typecheck` invokes it, and `npm run build` invokes the root typecheck through `prebuild`.

Do not remove the nested function typecheck, weaken it to bundler resolution, omit a Vercel entrypoint, or reintroduce extensionless relative imports anywhere reachable from `api/`.

## 5. Current architecture

### Truthful scan pipeline

`src/lib/scanEngine/`, `src/lib/scanner.ts`, and `src/lib/scoring.ts` own the local-first scan and deterministic measurements. The source boundary supports ZIP, public GitHub, GitHub App archive, and sample flows. Scanner-loaded text may feed bounded preparation but does not become general React state, saved raw source, or executable input. Limited evidence remains labeled limited.

### Repository Universe

`src/lib/workspace/repositoryUniverse.ts` builds the canonical nodes, edges, clusters, file records, counts, and stable identities from the analyzed inventory and Workspace Story knowledge. `RepositoryUniverse3D` is a lazy visualization of that model. Current/proposed and verification states are overlays or derived views of the same authoritative Universe; they must not create a second competing graph instance.

### Modular Result Workspace

`ResultWorkspace` is an orchestration shell around independently lazy Understand, Improve, Verify, and Deliver surfaces. Chapters mount on first visit and retain state. Universe/WebGL, Deep Intelligence review, Delivery previews, PDF, and archive paths remain progressively loaded. The landing, scan, reveal, account, project, saved-scan, privacy, security, and not-found routes share truthful state and responsive surface conventions.

### Actionable improvements and prepared-plan review

The deterministic chain is:

`friction/evidence -> transformation proposal -> optimization plan item -> validation -> prepared plan -> apply plan`.

An improvement exposes its problem, evidence, affected current entities, recommendation, artifacts, expected verification, support, inclusion, and lifecycle. Preparation validates empty/unsupported plans, destinations, action/evidence mismatch, content bounds, collisions, conflicts, readiness, and recovery. The prepared-plan workspace supports responsive list/detail inspection without changing the prepared data.

### GitHub PR preview/apply

ZIP and GitHub start from the same prepared apply plan. GitHub derives a deterministic prepared snapshot, performs repository/base-branch/path/file/precondition checks, and generates bounded diffs before mutation. Apply requires an explicit confirmation and uses the established server-only GitHub App write boundary. It never pushes directly to `main`, never automatically merges, and preserves ZIP/manual recovery.

### Deep Intelligence

Deterministic evidence selection and request construction happen before the optional server-only provider. Only bounded, redacted, repository-relative context is sent. Provider output is untrusted: strict schemas, evidence/path provenance, confidence caps, sensitive-output rejection, human-review classification, time/size budgets, one bounded retry, and atomic deterministic fallback protect the product contract. Provider credentials and server adapter markers must remain absent from browser assets.

### Account authentication and Supabase persistence

Production uses a dedicated GitHub OAuth App for identity and a Supabase-hosted PostgreSQL database operationally; the code intentionally depends only on the PostgreSQL `DATABASE_URL` contract, not a browser Supabase SDK. GitHub App installation/PR authorization remains separate from account OAuth.

Sessions are opaque random bearer tokens; only SHA-256 hashes are stored. Production cookies use the `__Host-` contract with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`. Projects, scans, and verification relationships are private and owner-scoped at every persistence operation. Snapshots store validated derived data, never archives, raw source, provider bodies, OAuth tokens, installation tokens, or environment values.

### Authoritative baseline/rescan verification

`shipseal.verification-relationship.v2` binds an immutable baseline scan to a later scan, a prepared-plan fingerprint, an optional applied operation/PR, expected artifacts/statements, repository/branch identity, measurement versions, Deep Intelligence provenance, and a deterministic fingerprint. Direct comparison requires compatible owner, project, repository, branch, scanner, measurement, time ordering, plan identity, and sufficient evidence. Incompatible boundaries suppress score deltas.

## 6. Contracts that must not regress

- **Determinism and evidence:** identical bounded input yields stable identities, ordering, fingerprints, proposals, artifacts, and verification synthesis. Facts remain traceable; heuristics and limitations stay labeled.
- **One Universe:** one authoritative Repository Universe instance/model supplies current truth. Future, proposed, applied, and verification visuals are derived overlays, not fabricated current nodes or separate graph authorities.
- **Lifecycle truth:** `Proposed != Prepared != Applied != Verified`. ZIP export is preparation/export, PR creation is not merge, and Applied remains pending until compatible rescan evidence exists.
- **Shared prepared snapshot:** ZIP/manual and PR routes use the same selected prepared artifact set and fingerprints. Presentation may differ; content and identity may not drift.
- **Explicit mutation:** GitHub writes require repository preflight, bounded preview, explicit confirmation, authenticated permission, server-side tokens, and provider-confirmed results. No direct-main push or automatic merge.
- **Authenticated ownership:** protected project, scan, and verification reads/writes/deletes derive the owner from the server session and return safe not-found behavior across owners.
- **Bounded Deep Intelligence:** deterministic evidence stays authoritative; context is selected, redacted, bounded, repository-relative, versioned, and fingerprinted; output is strictly validated and can fall back atomically.
- **Saved truth:** saved scans are immutable validated snapshots. Opening history does not rescan, rerun a provider, recalculate scores under a new algorithm, or mutate GitHub. Verification relationships remain versioned and owner-scoped.
- **Experience compatibility:** Light/Dark/System, reduced motion, desktop/mobile layouts, keyboard/touch interaction, overlay stacking/focus, non-color legends, and readable long identities must survive new work.
- **Export compatibility:** Delivery Pack, Client Handoff, PDF/HTML, manifest, `score.json`, Optimization Pack ZIP, and manual recovery remain available and truthful. “This is not legal advice” stays visible in client-facing compliance material.
- **Server compilation:** every server-reachable relative ESM import is NodeNext-safe; `typecheck:functions` remains part of typecheck/build; browser bundles contain no server-only account, persistence, or provider implementation markers.

## 7. Persistence migrations

- `db/migrations/0001_account_persistence.sql`: creates migration tracking plus users, hashed sessions, private owner-scoped projects, immutable scans/snapshots, the initial verification relationship table, indexes, uniqueness rules, and intentional cascades.
- `db/migrations/0002_verification_relationship_v2.sql`: adds prepared-plan, applied-operation, PR/branch/repository, measurement, expected-statement, bounded evidence, and relationship-fingerprint fields and indexes for authoritative Ω.18.4 verification.

Migrations are ordered, idempotent, forward-only production changes. `npm run db:migrate:test` applies the full sequence twice in an isolated in-memory PostgreSQL-compatible database. Never reset production data; production rollback is a reviewed application rollback plus a verified provider backup when required.

## 8. Security status

- Operator-confirmed incident status: the exposed database credential was removed from `.env.example` and rotated at the provider. The repository now leaves `DATABASE_URL` empty in `.env.example`.
- Rotation is an external operational fact and cannot be proven by source alone; the next session must not reproduce, quote, or search-log the retired value.
- No real secret may appear in source, documentation, examples, fixtures, snapshots, generated exports, client bundles, errors, diagnostics, or logs. Test-only values must be unmistakably non-routable placeholders.
- All provider, OAuth, GitHub, and database credentials remain server-only and must never use a `VITE_*` prefix.
- Authentication, persistence, security, privacy, retention, migrations, GitHub mutation, and client-facing claims require human review.

## 9. Repository Futures vision for Ω.18.5

Repository Futures should transform the existing Universe into a cinematic neural future field while preserving current repository truth. Current nodes remain visually grounded; candidate goals, dependencies, gates, artifacts, outcomes, and verified unlocks appear as clearly non-current, evidence-linked overlays.

The intended journey is:

1. choose **one primary future**;
2. optionally add **up to two compatible supporting goals**;
3. include all required dependencies automatically and visibly;
4. place excluded but valuable branches in **Save for later** without losing provenance;
5. synthesize **one executable future plan**, never several competing plans;
6. produce an implementation plan, reviewed generated files, and model-specific prompt packs;
7. apply through confirmed GitHub mutation or export through non-mutating packages;
8. rescan the same owner-scoped repository;
9. verify completion against the authoritative baseline;
10. reveal newly unlocked futures only from compatible, evidence-backed results.

The future field must remain legible without WebGL, motion, hover, or color. Reduced-motion and DOM equivalents are first-class outputs, not fallbacks added at the end.

## 10. Quick Path and Deep Configuration

### Quick Path

For users who want a safe recommendation: ShipSeal ranks evidence-supported primary futures, the user selects one, and deterministic synthesis adds required dependencies plus at most two compatible supporting goals. The user sees the rationale, conflicts, gates, artifact set, verification method, and one final plan before export/apply. No hidden mutation and no silent model choice.

### Deep Configuration

For expert users: expose the same underlying graph with filters and inspectors for evidence, confidence, compatibility, dependencies, conflicts, artifacts, prompts, gates, and saved branches. Users may replace the primary future, include/exclude supporting goals, inspect why a dependency is mandatory, resolve conflicts, choose supported model-specific prompt packs, and review every generated file. Deep Configuration edits the same draft as Quick Path; it does not create a parallel plan engine.

## 11. Required future-model concepts

| Concept | Minimum contract |
| --- | --- |
| Node | Stable ID, kind, lifecycle/currentness, title, repository-specific rationale, evidence IDs/paths, confidence, human-review state, and optional Universe mapping. Kinds must cover repository entities, future goals, dependencies/capabilities, artifacts, gates, and outcomes. |
| Edge | Stable directed relationship with evidence and confidence. Required semantics include supports, requires, conflicts-with, produces, gates, verifies, unlocks, and save-for-later lineage. |
| Path | Exactly one primary goal, zero to two compatible supporting goals, transitive dependency closure, ordered gates/artifacts/outcomes, deterministic fingerprint, and saved alternatives. |
| Dependency | Required versus optional, reason, evidence, satisfaction state, provider/deterministic origin, and cycle-safe resolution. Required dependencies are automatic but never hidden. |
| Conflict | Goal incompatibility, dependency contradiction, target/path collision, action mismatch, unsafe/sensitive target, insufficient evidence, stale identity, or incompatible verification boundary; each has severity and recovery. |
| Artifact | Stable artifact ID, source goal(s), generator, destination, create/update/strengthen action, content fingerprint, review/readiness state, dependencies, and verification expectations. Include implementation plan, generated files, and supported model-specific prompt packs. |
| Gate | Specification acceptance, evidence sufficiency, dependency closure, conflict resolution, human review, prepared-snapshot validation, explicit mutation confirmation, provider success, and compatible rescan verification. |
| Outcome | Prepared, exported, applied, verified, partially verified, unresolved, regressed, incompatible, and future-unlocked states with evidence and an honest next action. |

## 12. Deterministic versus Deep Intelligence responsibilities

| Deterministic ShipSeal | Optional Deep Intelligence |
| --- | --- |
| Owns scan inventory, exclusions, evidence identities, repository/Universe graph, scores, frictions, supported generators, plan validation, dependency closure, conflict rules, fingerprints, lifecycle, persistence, authorization, apply confirmation, and verification synthesis. | May propose repository-specific future-direction candidates, rationale, dependencies, compatibility hints, artifact families, and verification methods from the bounded request. |
| Decides what is safe, supported, comparable, persisted, exported, or eligible for mutation. | Cannot invent evidence, current files, successful commands, applied state, verified outcomes, permissions, or measurements. |
| Produces a complete usable fallback when enhancement is disabled or fails. | Must pass strict schema/provenance validation, confidence caps, budgets, redaction, and human-review policy; rejected output becomes a limitation, not truth. |

The model may enrich candidate meaning; it must never become the authority for repository facts, dependency satisfaction, mutation, or completion.

## 13. Inputs already available to Ω.18.5

### Deterministic future-direction inputs

- Repository Health frictions and Workspace Story evidence.
- Stable Repository Universe nodes, edges, clusters, paths, responsibilities, and evidence types.
- Current transformation domains: project memory, agent routing, and verification path.
- Existing generator-backed proposal families: repository/folder agent instructions, architecture/context memory, task routing, verification strategy, and verification gates.
- Actionable-improvement lifecycle, support, affected entities, artifact destinations, conflicts, readiness, and rescan expectations.
- Prepared plan/apply snapshots, GitHub preflight/diff issues, and artifact/statement verification contracts.

### Validated Deep Intelligence candidates

Accepted `future-direction` findings can already carry a goal, repository-specific rationale, evidence paths and IDs, dependencies, expected artifact families, confidence, verification method, and compatibility hints. These are provider-neutral candidates only; they are not automatically selected Future Paths.

### Verified opportunity signals

Ω.18.4 can derive bounded signals of kinds `friction-resolved`, `capability-added`, `risk-detected`, and `future-unlocked` from compatible outcomes. The schema also reserves `dependency-satisfied`. Signals retain project and source-verification identity, rationale, evidence IDs, related artifacts, and confidence. They are eligible input to future ranking only after deterministic validation; unresolved/incompatible verification emits no opportunity signals, and a signal is not itself a plan or promise.

## 14. Bundle and performance constraints

The existing production bundle report currently shows 36 JavaScript assets totaling 6,380.90 KiB raw / 1,833.46 KiB gzip, with three assets over 500 KiB:

- TypeScript compiler: 3,496.81 KiB raw / 1,001.04 KiB gzip;
- main `index` chunk: 785.95 KiB raw / 233.32 KiB gzip;
- `RepositoryUniverse3D`: 536.74 KiB raw / 137.30 KiB gzip.

`ResultDashboard` is 416.18 KiB raw / 109.65 KiB gzip. The bundle audit reports zero server-only provider markers and zero server-only account/persistence markers in browser assets.

Ω.18.5 must not eagerly add the future engine, prompt-pack generation, extra 3D assets, PDF/ZIP work, or Deep Intelligence code to initial/landing chunks. Reuse the lazy Universe renderer and modular chapters; derive models once, memoize indexed interactions, mount heavy detail only on demand, and preserve responsive input during graph filtering or selection. Do not raise warning thresholds or conceal chunk growth as a substitute for decomposition.

## 15. Remaining warnings and risks

- The TypeScript compiler, main entry, and Three.js Universe chunks remain large; a cinematic future field can worsen memory, interaction latency, and mobile GPU pressure.
- Vite still reports large-chunk warnings, an existing mixed dynamic/static import warning, and stale Browserslist data during build. These are known but not permission to ignore new regressions.
- Public GitHub import remains best-effort and may require the manual ZIP path because of CORS, archive size, branch, or network restrictions.
- Scanning is browser/local-first and cancellation during JSZip work is best-effort. There is no backend worker or scheduled rescan.
- Deep Intelligence uses one configurable OpenAI-compatible server route; token accounting is bounded/configured rather than exact, cancellation depends partly on upstream fetch, and there is no queue or cross-session rate controller.
- GitHub Contents API writes are sequential. A partial provider failure can leave a reviewable branch without a PR; recovery is stage-aware, but there is no destructive automatic cleanup or merge.
- Account OAuth is intentionally production-origin specific and disabled on ordinary Preview deployments. Static-only hosting cannot provide accounts/persistence.
- Saved data is private, but managed database backups can retain encrypted deleted rows until provider retention expires. The operator must keep the actual Supabase backup/retention policy documented.
- Public sharing/badges, payment entitlements, teams/roles, installation webhooks, lifecycle audit logs, and organization governance remain out of scope unless separately specified.
- Legacy sprint numbering is inconsistent around Ω.18.1. Ω.18.5 documentation must establish one canonical ledger without rewriting versioned contracts.
- Verification proves bounded repository evidence, not production behavior, causation, legal compliance, deployment success, or merge state.

## 16. Proposed Ω.18.5a–Ω.18.5g sequence

1. **Ω.18.5a — Accepted specification and terminology.** Define user stories, current-versus-future visual grammar, schemas, lifecycle, Quick/Deep behavior, compatibility, save-for-later semantics, accessibility, performance budgets, and acceptance tests. Reconcile sprint numbering. Documentation only until accepted.
2. **Ω.18.5b — Deterministic Future Graph.** Add versioned node/edge/path/dependency/conflict/gate/outcome schemas and pure synthesis from current evidence, existing proposals, Deep candidates, and verified signals. No UI or mutation.
3. **Ω.18.5c — Quick Path synthesis.** Implement deterministic ranking, one-primary/two-supporting limits, dependency closure, compatibility checks, saved alternatives, and one fingerprinted executable draft with focused tests.
4. **Ω.18.5d — Neural field and Deep Configuration.** Add the future overlay to the one Universe model, DOM/list equivalent, inspectors, filters, mobile sheet behavior, keyboard/touch support, themes, reduced motion, and conflict/dependency editing against the same draft.
5. **Ω.18.5e — Future artifacts and prompt packs.** Generate and validate the implementation plan, repository files, and explicitly supported model-specific prompt packs. Extend prepared review while preserving handwritten content, artifact limits, and shared ZIP/PR snapshot identity.
6. **Ω.18.5f — Apply, rescan, and unlock loop.** Reuse explicit GitHub confirmation/export, owner-scoped baselines, later-scan verification, and opportunity signals. Advance futures only from compatible evidence; keep partial, unresolved, regressed, and incompatible recovery honest.
7. **Ω.18.5g — Performance, accessibility, security, and release.** Enforce bundle/interaction budgets, mobile GPU fallbacks, overlay/focus tests, server NodeNext gate, secret audit, migration review if any, full release validation, dogfood scan, export inspection, and manual production smoke tests.

Each slice should be independently reviewable and must preserve all earlier contracts. A later slice must not be pulled forward merely because its UI is easy to prototype.

## 17. First-session rules

1. **Specification before implementation.** Read this handoff, `README.md`, applicable `AGENTS.md` files, the canonical architecture/verification/apply documents, and the actual source/tests. Produce the Ω.18.5a specification and contract proposal first.
2. **No code until specification acceptance.** Do not edit production TypeScript, UI, migrations, routes, exports, or tests until the operator explicitly accepts the specification. Visual prototypes must also be requested or accepted; do not let a prototype silently become architecture.
3. **The repository is the technical source of truth.** Prompts and handoffs explain intent, but current types, tests, migrations, route graphs, build gates, and committed history decide what exists. When prose conflicts with code, report the conflict and update the specification before implementation.
4. Preserve the working tree. Do not reset or discard unknown changes, and do not assume ownership of `logo.png`.
5. Do not commit, push, deploy, mutate GitHub repositories, rotate credentials, or run production migrations without explicit authorization.

## Canonical references

- [README](../../README.md)
- [Implementation Master Plan](IMPLEMENTATION_MASTERPLAN_75.md)
- [Repository Intelligence PR Specification](REPOSITORY_INTELLIGENCE_PR_SPEC.md)
- [Optimization Apply Flow](OPTIMIZATION_APPLY_FLOW.md)
- [Authoritative Verification Relationship](AUTHORITATIVE_VERIFICATION_RELATIONSHIP.md)
- [Account and Project Persistence Architecture](ACCOUNT_PERSISTENCE_ARCHITECTURE.md)
- [Rescan Verification Loop](RESCAN_VERIFICATION_LOOP.md)
- [Dashboard Redesign and Bundle Baseline](DASHBOARD_REDESIGN_PLAN.md)
- [Motion Language](../experience/MOTION_LANGUAGE.md)
- [Repository Universe 3D MVP](../experience/REPOSITORY_UNIVERSE_3D_MVP.md)

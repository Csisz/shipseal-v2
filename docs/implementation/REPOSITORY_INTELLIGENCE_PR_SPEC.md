# Repository Intelligence PR Specification

Status: canonical implementation specification

Direction lock: Omega 16.0

Last updated: 2026-07-17

Omega 18.1 persistence boundary (2026-07-17): validated Repository Intelligence and verification metadata may be stored only inside an explicitly saved, private, owner-scoped `shipseal.scan-snapshot.v1`. The persistence layer does not change evidence, context, provider, artifact, apply, score, export, verification, or Universe contracts. Opening history validates the stored version and renders the accepted result without rescanning, provider execution, GitHub mutation, or silent verification-algorithm reinterpretation. Raw provider requests/responses, repository archives/source contents, provider secrets, and GitHub tokens are outside the persistence boundary. Architecture details are canonical in `ACCOUNT_PERSISTENCE_ARCHITECTURE.md`.

Implementation status: **Omega 16.1 through Omega 16.6c, Omega 17.1 through Omega 17.3, and Omega P1 are implemented; Omega P1 completed on 2026-07-16 and human review is required before release.** The canonical evidence modules are `src/lib/repositoryIntelligence/evidence.ts` and `src/lib/repositoryIntelligence/repositoryResponsibilities.ts`. The canonical source-selection modules are `src/lib/repositoryIntelligence/contextSelection.ts` and `src/lib/repositoryIntelligence/contextPreparation.ts`. The canonical deep-intelligence boundary is implemented in `deepIntelligenceSchema.ts`, `deepIntelligenceRequest.ts`, `deepIntelligenceProvider.ts`, `deepIntelligenceValidation.ts`, and `deepIntelligenceExecution.ts`; `deepIntelligenceFixtureProvider.ts` remains local deterministic test support. The optional production transport is the server-only `api/_lib/repositoryDeepIntelligenceProvider.ts` adapter behind `api/repository-intelligence.ts`; client-safe status/request handling is in `productionProviderContract.ts` and `deepIntelligenceClient.ts`. Repository-specific artifact drafts are implemented in `artifactSchema.ts`, `artifactPlanning.ts`, `artifactGeneration.ts`, `artifactRendering.ts`, and `artifactValidation.ts`. Review and selection are implemented in `repositoryIntelligenceReview.ts`; expected target-state, structured statement and rendered-content fingerprints extend only its internal selected payload. The pure apply model is `repositoryIntelligenceApply.ts`, the server-only GitHub App mutation route is `api/github-app/create-repository-intelligence-pr.ts`, and the focused confirmation UI is `RepositoryIntelligencePrApply.tsx`. The pure rescan verification model remains unchanged in `repositoryIntelligenceVerification.ts`; `RepositoryIntelligenceVerificationPanel.tsx`, `useRepoScan.ts`, and `ResultDashboard.tsx` consume its bounded result without changing Optimization Plan verification. Stable domain exports remain in `src/lib/repositoryIntelligence/index.ts`.

The pure boundaries are `buildRepositoryIntelligenceEvidence(RepoScanInput)`, `selectRepositoryIntelligenceContext(...)`, `prepareSelectedRepositoryIntelligenceContext(...)`, `prepareRepositoryIntelligenceContext(...)`, `buildRepositoryDeepIntelligenceRequest(...)`, `validateRepositoryDeepIntelligenceResponse(...)`, `planRepositoryIntelligenceArtifacts(...)`, `generateRepositoryIntelligenceArtifacts(...)`, `renderRepositoryIntelligenceArtifact(...)`, `buildRepositoryIntelligenceArtifactManifest(...)`, `validateRepositoryIntelligenceArtifactSet(...)`, `buildRepositoryIntelligenceArtifactReview(...)`, `updateRepositoryIntelligenceReviewSelection(...)`, `validateRepositoryIntelligenceReviewSelection(...)`, and `buildRepositoryIntelligenceSelectedArtifactPayload(...)`. `runRepositoryDeepIntelligence(...)` is the bounded asynchronous wrapper around a caller-supplied provider interface. Prepared context and validated findings remain internal; the UI receives only rendered artifact drafts, bounded evidence summaries, provenance references, selection metadata and fingerprints. None of these objects are attached to Delivery Pack, `score.json`, public manifests, public reports, persistence, or the existing GitHub PR payload.

Omega 16.1 uses the existing scanner safety and framework-detection boundaries. The scanner's existing bounded readable-text pass now includes non-excluded JS/TS source files without executing them. Extraction uses the already-installed TypeScript compiler syntax tree, resolves only existing repository-relative local modules through an indexed path inventory, and falls back to conservative path evidence when source text is unavailable or parsing fails.

Current deterministic limitations: JS/TS files remain subject to the existing 300 KiB per-readable-file and 5 MiB total-readable-text limits; module aliases, dynamic imports, CommonJS `require` relationships, type-checker semantics, call graphs, and business-domain intent are not inferred; framework conventions require corroborating manifest/config evidence; folder output is structured aggregation rather than natural-language architecture; important-child lists are bounded to eight high-confidence files with an explicit limitation when truncated. Generated/vendor, binary, oversized, malformed, missing-target, unsupported, and limited-scan states remain visible rather than being presented as analyzed facts.

Omega 16.6c tightens repository specificity at the artifact boundary. Provider-context inclusion is not itself sufficient for a positive user-facing loading rule: `artifactPlanning.ts` emits one only when the canonical file responsibility exists with confidence of at least `0.65` and the selection is not solely a coverage fallback, folder representative or supporting dependency. Otherwise the selected path is disclosed as a coverage limitation. `.env.example`, `.env.sample`, `.env.template` and environment-qualified variants are deterministic `configuration` evidence and may appear only as setup references; their values remain sanitized by the existing Omega 16.2 environment-template preparation and are never copied into generated guidance.

Folder responsibility aggregation remains in `repositoryResponsibilities.ts` and does not create a second graph. Its explicit deterministic significance rule weights each primary responsibility by role importance and file confidence, adds a bounded relationship-degree contribution of at most 12, then sorts by significance, file count and normalized responsibility. Entry points/bootstrap, agent instructions and API surfaces outweigh test fixtures and utilities. A strongest group with average confidence below `0.75` is `insufficient-evidence`; two leading groups within a `1.5` significance ratio are `mixed`; otherwise the folder is `dominant`. Generated/vendor children remain excluded from usable evidence. This is a structural heuristic, not business-domain inference: close or low-confidence folders remain mixed/insufficient and generated prose names the represented responsibilities rather than claiming raw-file-count primacy.

Omega 16.2 selection is tiered and deterministic: explicit priorities, bounded configuration and documentation/instruction reservations, responsibility/category coverage, folder representatives, ranked candidates, one bounded supporting-relationship expansion, then deterministic fill. Ranking exposes responsibility importance, evidence confidence/state, centrality, uniqueness, parse limitations, size cost, and normalized-path tie-breaking. Path maps, relationship adjacency maps, and ancestor-folder indexes keep practical behavior near `O(F log F + R log R + F * pathDepth)` for `F` files and `R` relationships; source files are not reparsed.

Omega 16.2 content limitations: only scanner-loaded content is eligible; lockfile bodies remain metadata-only; secret-bearing environment paths, credential/private-key paths, generated/vendor files, and binaries are excluded; environment templates have all non-empty values replaced with placeholders; common credential assignments and private-key blocks are redacted defensively. Truncation is line-aware, preserves leading configuration/documentation content or source head/tail sections, retains the Omega 16.1 structural outline, and never treats omitted content as evidence of absence. This is conservative content preparation, not a general security scanner.

Omega 16.3 request and result boundary: request construction verifies the Omega 16.1 and Omega 16.2 schema versions, selected paths, context and content fingerprints, bounded character totals, evidence IDs, selected relationships, capabilities, and sensitive-content exclusions. The deterministic request fingerprint covers the context-bundle fingerprint, policy, requested capabilities, response and prompt-contract versions, safe repository identity, selected bounded content, evidence summaries, responsibility/relationship/framework summaries, limitations, and result limits. It contains no timestamp, credential, unselected source, archive, or absolute local path.

Provider output remains untrusted until strict Zod parsing and deterministic validation. Raw, normalized, validated, rejected, and run-summary types are separate. Validation rejects unknown paths/evidence, contradictory responsibilities or relationship direction, invented verified commands, evidence-free generic claims, generated-source contradictions, false execution claims, unsupported framework/certification claims, secret or private-key material, local paths, and prompt/system-instruction leakage. Provider confidence is capped by deterministic evidence confidence/state, truncation, and inference status. Authentication, authorization, payment, secrets, deletion, deployment, destructive migration, security, legal/compliance, AI Act, privacy, certification, and critical-business-logic findings require human review even when otherwise evidence-linked.

The result policy `shipseal.deep-intelligence-result-policy.v1` defaults to 80 findings, 12 paths per finding, 20 evidence references per finding, 8 relationships per finding, 2,000 characters per text field, 8 artifact targets, 20 warnings, a 1,000,000-character measurable raw-response ceiling, and a 45-second timeout. `runRepositoryDeepIntelligence(...)` performs one supplied-provider call, supports cancellation and a maximum five-minute explicit timeout, returns structured safe failures, and never logs raw provider output or prepared source. Indexed path, evidence, responsibility, and relationship maps keep validation approximately linear in request evidence plus bounded provider output. Provider-neutral domain types remain free of SDK types; production transport, credentials and retry policy are server-only.

### Omega P1 production provider boundary

Omega P1 connects an optional OpenAI-compatible chat-completions transport through the existing provider interface. Native `fetch` is sufficient, so no SDK or dependency was added. The browser sends only the versioned `RepositoryDeepIntelligenceRequest` to `/api/repository-intelligence`; the server validates the request versions, deterministic fingerprint, safe repository-relative paths, evidence references, capabilities, item counts, context characters and sensitive-content exclusions before transmission. The adapter never crawls files or receives an archive, GitHub credential, installation token, ignored vendor file, binary, raw environment value, unselected file or public report object.

Configuration is server-only: `SHIPSEAL_DEEP_INTELLIGENCE_ENABLED`, `SHIPSEAL_DEEP_INTELLIGENCE_PROVIDER`, `SHIPSEAL_DEEP_INTELLIGENCE_MODEL`, `SHIPSEAL_DEEP_INTELLIGENCE_API_KEY`, optional HTTPS `SHIPSEAL_DEEP_INTELLIGENCE_BASE_URL`, `SHIPSEAL_DEEP_INTELLIGENCE_TIMEOUT_MS`, `SHIPSEAL_DEEP_INTELLIGENCE_MAX_OUTPUT_TOKENS`, `SHIPSEAL_DEEP_INTELLIGENCE_MAX_REQUEST_BYTES`, `SHIPSEAL_DEEP_INTELLIGENCE_MAX_RESPONSE_BYTES`, and a non-secret environment label. No provider secret uses a `VITE_` prefix. Deterministic-only operation is the default when disabled or unconfigured.

Policy `shipseal.production-provider-policy.v1` caps inbound request bytes at 700,000, selected context at 350,000 characters, provider response bytes at 1,000,000, output at 6,000 tokens, timeout at 45 seconds, transient retries at one, and retry delay at 1,500 ms. Environment overrides are validated within hard safety bounds. Authentication, cancellation, invalid request/schema/evidence, and oversized output are never retried; eligible network, 429 and 5xx failures receive at most one bounded retry. A result session coalesces repeated enhancement actions into one in-flight request, aborts on scan/reset/unmount, and rejects stale completion through the existing scan token.

Provider output must be JSON matching the existing response schema. The only normalization is removal of one complete Markdown JSON fence. Prose, malformed JSON, missing fields, unsupported artifact targets, unknown paths/evidence, contradictions, unsafe content, excessive output and zero accepted findings are rejected atomically. Only the validated result may rebuild artifact drafts through the existing planner, renderer, validator and review model. Deterministic evidence remains authoritative and provider statements retain interpretation, confidence, evidence references and human-review limits.

Failures are mapped to finite safe categories: disabled, missing credentials, invalid request, timeout, cancellation, rate limit, unavailable, authentication, invalid response, schema validation, evidence validation, response too large and unknown provider error. Every failure preserves the complete deterministic review; no invalid partial finding is mixed in. Server logs contain only request ID, adapter/model, duration, bounded byte counts, status category and retry count—never source, prepared context, generated artifacts, provider bodies, secrets or private tokens.

The review surface exposes deterministic, preparing, enhanced, deterministic-fallback/cancelled and safe-retry states inside the existing Repository Intelligence flow. It does not promote a provider brand, add a chapter, bypass selection/acknowledgement/preview/confirmation, or mutate GitHub. Provider results remain session-local and are not attached to public scans, scores, manifests, Delivery Pack, Client Handoff, persistence or verification baselines. `npm run intelligence:smoke` is deliberately opt-in via `SHIPSEAL_DEEP_INTELLIGENCE_SMOKE=true`, uses one bounded fixture request, prints metadata only and never mutates GitHub; it must not be run without an authorized credential.

Production bundle reporting fails if a known test secret, the server credential name, or the server adapter class appears in browser JavaScript. Current limitations: the transport is one configurable OpenAI-compatible endpoint rather than a provider-selection product; token counts are a configured output limit rather than exact input-token accounting; cancellation depends on upstream fetch support; there is no persistence, entitlement, queue or cross-session rate controller. These remain separate from Omega 18.

Acceptance on 2026-07-16 exercised the production review component through the development-only typed fixture at 1280 x 720 and 390 x 844. Deterministic, preparing, enhanced, fallback and retry disclosures rendered inside the existing review flow; all four Omega 17 chapters remained navigable; the deferred Repository Universe path loaded; long repository and branch identity stayed readable without horizontal overflow; and the browser reported no console warning or error during the provider-state checks. No live provider or GitHub mutation was used.

Omega 16.4 artifact paths are repository destinations, not new Delivery Pack paths. Root and scoped instructions target `AGENTS.md` and selected `<folder>/AGENTS.md`. New memory defaults to `AGENT_MEMORY/ARCHITECTURE.md`, `AGENT_MEMORY/CRITICAL_FILES.md`, `AGENT_MEMORY/COMMAND_MAP.md`, `AGENT_MEMORY/KNOWN_RISKS.md`, `AGENT_MEMORY/TASK_ROUTER.md`, `AGENT_MEMORY/CONTEXT_GUIDANCE.md`, and the internal machine-readable `AGENT_MEMORY/EVIDENCE_MANIFEST.json`. To avoid duplicate concepts, an existing `ARCHITECTURE.md` or `docs/ARCHITECTURE.md`, root `TASK_ROUTER.md`, or root `CONTEXT_GUIDANCE.md` is strengthened in place. Existing Delivery Pack context-compression and folder-agent suggestions remain unchanged compatibility outputs; they are not silently reused as repository-write drafts.

Artifact operations reuse Optimization Plan names: `create`, `update`, `strengthen`, and `unavailable`, with explicit `skip` for sufficiently covered or out-of-scope destinations. Missing targets are created only with substantive provenance. Explicitly ShipSeal-managed files may be updated. Handwritten or partial files are strengthened through proposed additions and are never silently replaced. Sufficient existing coverage is skipped. Insufficient, excluded, unsafe, contradictory, or generic-only output is unavailable or blocked with a reason. Existing instructions that explicitly reject generated instruction additions block the relevant draft.

Every substantive draft sentence is first represented as a structured statement with a stable ID, finite type, target category, paths/symbols, evidence IDs, accepted validated-finding IDs, ShipSeal confidence, validation state, human-review state, limitations, ordering, preservation relationship, and optional rescan target. Markdown is rendered only from those statements. The separate evidence manifest contains artifact/statement fingerprints and provenance but no source contents, raw provider response, prompt, timestamp, secret, token, or local path. Rejected and unavailable deep findings cannot contribute. Accepted-with-limitations and human-review findings remain visibly limited. When no accepted provider finding exists, deterministic-only generation produces only evidence-supported artifacts and marks unsupported risk or deeper coverage unavailable instead of adding filler.

The policy `shipseal.repository-intelligence-artifact-policy.v1` defaults to five folder-level instruction drafts, 60 statements per artifact, 12 critical files, 10 risks, 14 task routes, eight paths per statement, 200,000 rendered characters per artifact, low minimum accepted ShipSeal confidence, human-review finding inclusion, deterministic-only fallback, and handwritten preservation. Planning sorts all evidence, findings, files, folders, relationships, statements and destinations before identity or rendering. Indexed provenance validation is approximately linear in bounded statements plus evidence/findings, apart from deterministic sorting. Current limitations remain static-analysis scope, conservative existing-file classification, bounded representative selection, and no semantic merge of handwritten prose; strengthen output is proposed additions rather than an automatic patch.

Omega 16.5a review architecture reuses rather than replaces the implemented Optimization Plan flow. `RepositoryOptimizationPlanItem` remains the canonical existing generator-backed artifact contract; `ResultDashboard` remains the owner of existing proposal inclusion through `excludedProposalIds`; `OptimizationPlanReview`, `OptimizationPlanArtifactDetail`, and `OptimizationPrFilePreview` remain the existing detail/content/diff-preview surfaces; `buildOptimizationApplyPlan(...)` remains the Optimization Pack and PR preview boundary; and `buildRepositoryVerificationBaseline(...)` remains the rescan baseline boundary. Those contracts and their GitHub behavior are unchanged. Repository Intelligence uses an internal adapter because its statement-level provenance, stable artifact fingerprints, handwritten preservation and per-artifact acknowledgement cannot be reduced safely to the older simplified artifact type.

`repositoryIntelligenceReview.ts` derives review IDs from stable Omega 16.4 artifact IDs and derives selection/payload fingerprints from sorted artifact IDs, rendered fingerprints and acknowledgement fingerprints. Safe validated creates and ShipSeal-managed updates are included by default. Strengthen artifacts, human-review artifacts, blocked artifacts, unavailable artifacts, validation failures and skips are excluded by default; the latter four are not selectable. Dependencies are enforced through category-to-artifact indexes, and excluding a dependency deterministically removes selected dependents. Equivalent regeneration preserves selections; materially changed fingerprints invalidate selection and acknowledgement. Human acknowledgement is per artifact and fingerprint, not a global approval.

Handwritten strengthen previews show only the deterministic `Proposed evidence-backed additions` rendering and state explicitly that existing content is preserved. The future `shipseal.repository-intelligence-selected-artifacts.v1` payload represents these as `proposed-addition`, never as full-file replacement. Apply-readiness validation rejects empty selections, unsafe or blocked targets, validation/provenance mismatches, missing dependencies, destructive handwritten replacement, stale artifact/selection/scan/repository fingerprints, and missing acknowledgements. The payload contains only selected validated target paths, operations, rendered drafts or safe proposed additions, artifact fingerprints and statement provenance; it contains no rejected artifacts, raw provider response, prompt, unrelated source, credential, absolute path or GitHub token. Omega 16.5b must consume this boundary and still implement reviewed write behavior; Omega 16.5a sends nothing to GitHub.

The review UI is a compact progressive-disclosure section inside the existing Improve/Optimization Plan experience. It exposes deterministic versus enhanced mode, operation and review states, filters, repository evidence, referenced paths, limitations, dependencies, preservation behavior, per-artifact acknowledgement and a selected-plan summary. The raw evidence manifest is hidden from normal content preview. Scanner-loaded content is consumed once in the scan/build layer; React receives the safe review session only. The TypeScript-backed extraction/review implementation is dynamically loaded after a scan so it does not inflate the initial application chunk. Checkbox transitions are indexed and do not rerun extraction, selection, parsing or artifact generation, and only the selected artifact detail mounts its full Markdown preview. Repository Universe data links are preserved as target, referenced and affected-folder paths, but Universe visuals remain unchanged.

Omega 16.6a reuses the canonical Optimization rescan pattern—validated baseline, matching later scan, deterministic artifact comparison, limitations and bounded next actions—through a richer internal adapter rather than changing `repositoryVerification.ts`. The `shipseal.repository-intelligence-verification-baseline.v1` baseline records the apply/path compatibility versions, repository and base/PR branches, selected-plan fingerprint, bounded artifact/category/operation fingerprints, structured statement provenance, and strengthen-only managed-section and preservation fingerprints. It contains no source contents, handwritten prose, credentials, provider output, prompt or absolute path. `validateRepositoryIntelligenceVerificationBaseline(...)`, `verifyRepositoryIntelligenceArtifacts(...)`, `compareRepositoryIntelligenceVerification(...)`, and `buildRepositoryIntelligenceOpenWork(...)` remain pure and internal; Omega 16.6b is the future user-facing integration.

Verification states are finite. Artifacts may be exact, present with modifications, strengthened, partial, missing, conflicting, stale, unavailable, not applicable or human-review-required. Statements are separately verified by current deterministic evidence, present in the artifact only, still inferred, contradicted, missing evidence, unavailable or human-review-required. Overall results are fully verified, partially verified, changed, blocked or unavailable. Exact Markdown proves only application identity: it does not prove a statement, runtime behavior, merge, deployment, security, legal/compliance status or provider-derived claim.

Create verification compares readable current full content with the applied fingerprint and distinguishes exact, structurally recognizable later edits, confirmed absence and unavailable coverage. Update verification accepts exact content or later modifications only while compatible ShipSeal-managed identity remains; lost ownership becomes a conflict. Strengthen verification requires exactly one valid managed section, compares its fingerprint, and checks handwritten preservation using ordered fingerprints of the original non-empty lines. This permits additive user-owned edits outside the section while treating removed or changed original lines as unproven content loss. Duplicate, reversed, nested, missing or malformed markers conflict. Human-review requirements remain open even when application is exact.

Repository identity requires the connected GitHub App owner/repository plus the baseline base branch, PR branch or a caller-explicit compatible branch. No Git ancestry is invented. ZIP, sample and public-URL scans cannot silently verify a GitHub baseline. Limited scans convert absent targets/evidence into unavailable rather than missing or contradicted. Current Omega 16.1 evidence is rebuilt once and indexed; file/evidence lookups are approximately linear in scan files, current evidence, bounded artifacts and bounded statements, plus deterministic sorting. Defaults allow 20 artifacts, 1,200 statements, 4,000 provenance references, 500 preservation-line fingerprints, 300 KiB readable verification content per target, 200 limitations and 100 evidence-backed open-work items.

Quality evaluation reports finite states and counts for artifact presence, provenance integrity, evidence freshness, handwritten preservation, command/path accuracy, responsibility coverage, limitation visibility and review completeness. It introduces no score. Lifecycle states distinguish a newly created baseline, awaiting content, a branch without changes, verification eligibility, verified content, later repository changes, stale/incompatible baselines and unavailable verification. Current limitations remain static evidence semantics, no Git ancestry or merge-status proof, no semantic equivalence classification, line-fingerprint rather than AST preservation for handwritten Markdown, and no runtime verification. No Repository Intelligence verification data is attached to scan history, public reports, Delivery Pack, score, manifest or persistence.

Omega 16.6b consumes that model without recreating it in React. A successful Repository Intelligence PR response is schema-validated before its internal baseline is retained in the current application session. On a later scan, the existing scanner's bounded `onScanInput` extension computes verification once from scanner-loaded files; only finite states, fingerprints, repository-relative paths, evidence IDs, limitations and actions enter React state. The prior valid result remains visible while a rescan runs or when verification fails, while a successful compatible scan replaces it atomically. ZIP/sample/public scans and incompatible branches retain the Omega 16.6a blocked or unavailable semantics rather than appearing failed.

`RepositoryIntelligenceVerificationPanel.tsx` provides the focused summary, lifecycle, artifact filters/list, selected-artifact detail, structured-statement status, strengthen preservation, non-numeric quality and evidence-backed open-work surfaces. It translates finite states into plain language and never treats Markdown presence as statement proof. Strengthen detail separates user-owned content preservation from the managed-section fingerprint, so additive handwritten edits are not shown as failures. Diagnostics expose only shortened fingerprints and stable IDs. PR metadata supports opening the PR; the existing scan action supports rescanning the selected repository/branch. No merge, checkout, regeneration write or GitHub mutation action is added.

The verification experience is rendered inside the already lazy-loaded `ResultDashboard` route. The evidence/verification builder remains dynamically imported only after scanner-loaded input is available; filter changes do not rebuild evidence, and only the selected artifact mounts statement detail. No source content is retained in React state. Repository-relative paths remain available for a future safe Repository Universe navigation link, but Omega 16.6b adds no overlay, graph mode or layout logic. Omega 17 is the next sprint and owns broader post-scan decomposition.

This document is the canonical implementation source of truth for the Repository Intelligence PR. Product direction is canonical in `docs/vision/POSITIONING.md`. Existing Delivery Pack, readiness, export, GitHub, and rescan documents remain compatibility references for their implemented contracts.

## 1. Purpose

Define the next ShipSeal implementation sequence that turns the existing deterministic repository scan and review-first apply flow into an evidence-backed, repository-specific paid outcome: the **Repository Intelligence PR**.

The Omega 16.0 direction lock changed documentation only. Implemented Omega 16.1-Omega 16.4 boundaries do not add a production model provider, expand repository-code execution, write scanned repository files, alter GitHub permissions, or change public exports.

## 2. User problem

AI coding agents repeatedly lose time and context when a repository does not explain:

- where responsibilities live;
- which files and flows are critical;
- which commands are real and when to run them;
- how folders relate;
- where local instructions override global guidance;
- which risks or missing context require human judgment.

Existing generic instruction templates can name a detected stack and commands, but they do not reliably explain actual source responsibilities. Users need workspace knowledge derived from the repository itself and delivered as a reviewable change.

## 3. Primary product promise

> ShipSeal helps AI coding agents understand and work inside a repository more effectively.

The central quality rule and release gate is:

> Generated files must describe the actual code structure, responsibilities, commands, relationships and risks of the scanned repository. Generic best-practice templates are not sufficient.

For example, `Run tests before committing` is not sufficient by itself. Acceptable guidance connects a detected command such as `npm test` to `package.json`, the relevant test configuration, the source areas affected, and any limitation that prevents ShipSeal from proving the command succeeds.

## 4. Product hierarchy

1. **Primary identity:** AI repository intelligence and AI workspace improvement.
2. **Primary paid outcome:** Repository Intelligence PR.
3. **Signature experience:** Repository Universe, preserved as visual proof and optional exploration.
4. **Secondary commercial output:** Client Handoff Pack, available after repository understanding as an export path.
5. **Supporting outputs:** Delivery Packs, PDF/HTML reports, security notes, testing outputs, MCP guidance, AI Act documentation, manifests, and `score.json`.

Repository Universe is not removed or deprecated. Client Handoff must not compete with repository intelligence in the hero or first product promise.

## 5. Target user and initial JS/TS scope

The first deep-intelligence release targets builders, freelancers, agencies, and teams using AI coding agents in JavaScript and TypeScript application repositories, especially:

- React and Vite;
- Next.js;
- Node.js and Express;
- comparable JS/TS frontend, backend, and full-stack repositories.

Other stacks continue to receive the current deterministic scan and compatible outputs. Deep generation must be labeled unavailable or limited when a repository falls outside the validated JS/TS scope; it must not imply equivalent quality across unsupported stacks.

## 6. End-to-end user flow

1. Connect a GitHub repository, import a public repository, or upload a ZIP.
2. Run the non-executing deterministic scan.
3. Show free findings about likely agent friction with concrete repository evidence.
4. Prepare a bounded source-selection plan and show limitations before deep processing.
5. Generate validated repository evidence and proposed workspace artifacts.
6. Preview every artifact with create, update, strengthen, skip, unavailable, review-required, or blocked behavior.
7. Let the user select artifacts and explicitly create a reviewed GitHub PR, or download a manual package.
8. Preserve existing handwritten instructions and surface conflicts for review.
9. Rescan the changed repository.
10. Compare the later scan to the saved baseline and report detected changes without claiming causality or runtime correctness.

## 7. Free scan versus paid Repository Intelligence boundary

### Free deterministic scan

The free boundary may include:

- repository structure and detected stack;
- commands declared in supported manifests;
- existing AI instruction and documentation detection;
- tests, CI, security-path, generated/vendor, and scan-limit signals;
- deterministic readiness and repository-health compatibility outputs;
- evidence-backed friction findings when the deterministic engine has enough evidence;
- a preview of candidate repository areas and artifacts;
- existing Repository Universe exploration based on current scan evidence.

### Paid Repository Intelligence PR

The paid outcome adds:

- bounded deep analysis of selected JS/TS source;
- source and folder responsibility extraction;
- architecture, critical-flow, and task-routing synthesis;
- repository-specific root and scoped agent instructions;
- evidence-linked memory artifacts;
- conflict-aware create/update/strengthen/skip decisions;
- a validated manifest connecting generated statements to evidence;
- review-first PR preparation through the existing GitHub write boundary;
- a rescan verification summary after the reviewed change is applied.

Payment entitlements are out of scope for Omega 16.x and arrive only in Omega 18.

## 8. Existing reusable ShipSeal capabilities

Code inspection on 2026-07-14 confirms these reusable capabilities:

- `src/lib/scanner.ts` and `scannerLimits.ts`: browser-side ZIP inventory, safe readable-text extraction for selected config/document formats, path validation, binary/generated/vendor exclusion, and explicit limits. Code is not executed.
- `src/lib/readiness.ts`, `scoring.ts`, and `repositoryHealth/`: deterministic scoring, evidence signals, blockers, summaries, and compatibility reports.
- `src/lib/ai/types.ts` and `localAiProvider.ts`: an existing provider interface and local deterministic narrative implementation. It currently consumes scan metadata, not a deep source evidence graph.
- `src/lib/deliveryPack/contextCompression.ts` and `folderAgents.ts`: compatible generated concepts for architecture, critical files, command map, known risks, task routing, context packs, and folder-level instructions.
- `src/lib/workspace/`: additive workspace, Repository Universe, transformation proposal, optimization plan, apply plan, and verification models.
- `repositoryOptimizationPlan.ts`: generator-backed artifacts with evidence references, destination resolution, conflicts, and ready/review-required/blocked states.
- `repositoryOptimizationApply.ts`: review package and PR preview generation without writing the local repository.
- `src/lib/github/write/` and `api/github-app/create-readiness-pr.ts`: the existing explicit-confirmation GitHub App PR path. Its permissions and creation behavior remain unchanged in this sprint.
- `repositoryVerification.ts`: session-local baseline, repository matching, file-presence/content-signature checks, and neutral metric deltas.
- Delivery Pack manifest v2, `score.json`, PDF/HTML, Client Handoff, readiness packs, and manual ZIP fallback remain compatible supporting outputs.

Current limitation: the scanner records all safe file paths but reads full text only from selected config/document-like files. The current local narrative and many generated artifacts are deterministic summaries of metadata and patterns; they do not yet establish source-symbol responsibilities.

## 9. Proposed architecture

The implementation remains additive:

```text
Repository archive
  -> deterministic inventory and safety filters
  -> deterministic repository facts
  -> evidence records and relationship graph
  -> bounded JS/TS source selection
  -> sanitized context bundle
  -> deep-intelligence provider (optional)
  -> validated candidate facts and artifact statements
  -> artifact planner and conflict detector
  -> Repository Intelligence manifest
  -> review preview / existing GitHub PR boundary
  -> later deterministic rescan verification
```

Recommended modules, subject to implementation review:

- `src/lib/repositoryIntelligence/evidence.ts`
- `src/lib/repositoryIntelligence/extractJsTs.ts`
- `src/lib/repositoryIntelligence/sourceSelection.ts`
- `src/lib/repositoryIntelligence/contextBundle.ts`
- `src/lib/repositoryIntelligence/provider.ts`
- `src/lib/repositoryIntelligence/validation.ts`
- `src/lib/repositoryIntelligence/artifacts.ts`
- `src/lib/repositoryIntelligence/manifest.ts`

The new domain model should reference `ReadinessReport` and workspace models rather than change root readiness semantics or export schemas.

## 10. Deterministic intelligence responsibilities

The deterministic engine is authoritative for:

- normalized file discovery and repository-relative paths;
- archive safety, binary/generated/vendor exclusions, and scan limits;
- stack, framework, package manager, manifest, and command detection;
- existing document and instruction detection;
- test and CI signals;
- source-selection eligibility and budget enforcement;
- evidence IDs, provenance, hashes/signatures, and validation state;
- readiness blockers and workspace compatibility rules;
- whether evidence is sufficient to show a finding;
- path existence and contradictions between provider output and scan facts;
- final create/update/strengthen/skip/unavailable/blocked classification.

Deep output can add interpretation but cannot replace these facts.

## 11. Deep intelligence provider responsibilities

The future provider may enhance:

- architecture and subsystem understanding;
- file and folder responsibilities;
- entry points, critical flows, and cross-file relationships;
- task routing and context-loading guidance;
- repository-specific agent instructions;
- conflicts between docs and code structure;
- code-structure risks and explanations;
- concise artifact wording.

The provider must not:

- override deterministic blockers without cited evidence;
- claim code, tests, builds, or workflows were executed;
- invent files, symbols, commands, imports, or relationships;
- mark unsupported output verified;
- receive secrets, excluded binaries, generated/vendor contents, or unrelated full-repository content;
- silently process the whole repository without selection and budget controls;
- weaken handwritten security, legal, deployment, verification, or review requirements.

The current `AIProvider` interface is reusable conceptually but should not be overloaded with deep results. Introduce a versioned `RepositoryIntelligenceProvider` interface with structured input/output and keep `LocalAIProvider` as the deterministic fallback.

## 12. Repository evidence schema

Proposed TypeScript contract:

```ts
type EvidenceOrigin = 'deterministic' | 'model-derived';
type EvidenceValidation =
  | 'observed'
  | 'validated'
  | 'inferred'
  | 'contradicted'
  | 'rejected'
  | 'missing-context';

interface RepositoryEvidence {
  id: string;
  schemaVersion: 'shipseal.repository-evidence.v1';
  repositoryRelativePath: string;
  symbol?: {
    name: string;
    kind?: string;
    startLine?: number;
    endLine?: number;
  };
  responsibility?: string;
  category:
    | 'structure' | 'stack' | 'command' | 'entry-point'
    | 'responsibility' | 'relationship' | 'test' | 'ci'
    | 'instruction' | 'documentation' | 'risk' | 'exclusion';
  sourceType:
    | 'file-inventory' | 'manifest' | 'config' | 'source'
    | 'test-source' | 'ci-config' | 'documentation' | 'generated-metadata';
  extractedFact: string;
  confidence: number; // 0..1, calibrated by origin and validation
  origin: EvidenceOrigin;
  extractor: { id: string; version: string };
  relatedEvidenceIds: string[];
  relationships: Array<{
    type: 'imports' | 'exports' | 'configures' | 'tests' | 'calls'
      | 'routes-to' | 'owns' | 'documents' | 'contains' | 'depends-on';
    targetPath: string;
    targetSymbol?: string;
  }>;
  affectedArtifacts: Array<{
    path: string;
    statementIds: string[];
  }>;
  validation: {
    state: EvidenceValidation;
    validatorIds: string[];
    reasons: string[];
  };
  limitations: string[];
  contentReference?: {
    contentHash: string;
    selectedRange?: { startLine: number; endLine: number };
    truncated: boolean;
  };
}
```

Model-derived evidence is a candidate interpretation until deterministic validation succeeds. An unsupported claim is rejected, retained in diagnostics if useful, and omitted from user-facing artifacts.

Each generated statement also needs a stable record:

```ts
interface ArtifactStatement {
  id: string;
  artifactPath: string;
  text: string;
  evidenceIds: string[];
  claimType: 'fact' | 'inference' | 'instruction' | 'limitation';
  confidence: number;
  validationState: 'accepted' | 'review-required' | 'rejected';
}
```

## 13. Source-file selection and context-budget strategy

Selection is deterministic, bounded, explainable, and performed after existing exclusions.

### Candidate discovery

1. Always consider critical JS/TS configuration: `package.json`, lockfile identity, `tsconfig*`, Vite/Next config, lint/test config, and relevant `.github/workflows/` files.
2. Include existing root and folder instructions, README files, architecture docs, contribution/security/ownership docs, and AI-tool rules.
3. Detect application entry points from package scripts, framework conventions, exports, and common roots.
4. Discover source roots such as `src/`, `app/`, `pages/`, `server/`, `api/`, `lib/`, and `packages/` only when present.
5. Rank files by deterministic signals: entry-point status, import/export centrality, route registration, public exports, responsibility density, references from config/docs, test linkage, and critical-path patterns.
6. Sample each important folder so smaller subsystems are not hidden by a large central folder.
7. Include representative tests and test/CI configuration.

### Proposed defaults

Exact production limits require measurement. Initial defaults should be explicit configuration, recorded in metadata, and visible to the user. Proposed starting values:

- maximum selected source files: **60**;
- maximum total normalized text: **600,000 characters**;
- maximum per file: **30,000 characters**;
- reserve at least 20% of the budget for config, docs, tests, and cross-folder coverage;
- no more than 40% of selected source text from one folder unless the repository has only one source area.

These are proposed defaults, not locked production promises.

Omega 16.2 implements these as versioned defaults in `shipseal.context-selection-policy.v1`:

- maximum selected files: **60**;
- maximum total included text: **600,000 characters**;
- maximum included text per file: **30,000 characters**;
- critical configuration reserve: **60,000 characters**;
- documentation/instruction reserve: **60,000 characters**;
- maximum supporting files: **12**;
- maximum folder representatives: **3**;
- maximum files per source root: **12** when multiple roots exist;
- maximum source text per root: **40%** when multiple roots exist;
- maximum relationship expansion depth: **1**;
- minimum useful content threshold: **40 characters**, with explicit exceptions for critical and structurally useful small files;
- truncation strategy: **head-tail-with-structural-outline**.

Callers may provide validated overrides. When only a smaller total/file budget is supplied, dependent default reserves and per-file limits scale down deterministically. Negative, inconsistent, excessive-depth, absolute-path, or traversal-bearing policy values are rejected. These defaults are implementation controls, not pricing, entitlement, or provider promises.

### Truncation

- Prefer syntactic top-level units, exports, type declarations, route definitions, and selected function/class bodies over arbitrary byte slicing.
- Preserve line numbers and a content hash.
- Mark every truncated evidence item.
- Never use truncated absence as proof that a symbol or behavior does not exist.

### Exclusions

Exclude secret-looking paths, environment values, credentials, binaries, archives, generated/vendor folders, minified files, large data fixtures, build outputs, coverage, lockfile bodies unless specifically required for package-manager facts, and content outside the configured selection.

### Metadata and operational controls

Record provider, model identifier, provider version, prompt/template version, evidence schema version, selector version, limits, selected/skipped files, truncation, elapsed time, estimated/actual token usage when available, retries, and completion state.

Use a single bounded retry for transient provider errors, an abortable timeout, and no retry for validation failure, unsupported scope, authentication failure, or budget rejection.

## 14. Generated artifact contract

The initial paid set reuses compatible concepts but installs them under a coherent repository-owned namespace:

| Artifact | Initial behavior | Existing compatible output | Decision rule |
| --- | --- | --- | --- |
| `AGENTS.md` | create, update, strengthen, or skip | `01-agent-instructions/AGENTS.md` | Never silently replace handwritten content; propose a merge or reviewed replacement. |
| selected `<folder>/AGENTS.md` | create, strengthen, or skip | `07-context/folder-agents/*/AGENTS.md` | Only for evidence-backed folder responsibilities and local rules. |
| `AGENT_MEMORY/ARCHITECTURE.md` | create, update, strengthen, or unavailable | `07-context/ARCHITECTURE.md` | Must name real areas, entry points, and relationships. |
| `AGENT_MEMORY/CRITICAL_FILES.md` | create, update, strengthen, or unavailable | `07-context/CRITICAL_FILES.md` | Criticality requires evidence and review flags for sensitive areas. |
| `AGENT_MEMORY/COMMAND_MAP.md` | create, update, strengthen, or unavailable | `07-context/COMMAND_MAP.md` | Commands must trace to manifests/config; execution is never implied. |
| `AGENT_MEMORY/KNOWN_RISKS.md` | create, update, strengthen, or unavailable | `07-context/KNOWN_RISKS.md` | Separate observed risks, inferences, and missing context. |
| `AGENT_MEMORY/TASK_ROUTER.md` | create, update, strengthen, or unavailable | `07-context/TASK_ROUTER.md` | Routes must connect task types to real files/folders and verification. |
| `AGENT_MEMORY/CONTEXT_GUIDE.md` | create, update, strengthen, or unavailable | global/specialized context packs | Defines high-signal loading order and exclusions without hiding task-relevant files. |
| `AGENT_MEMORY/REPOSITORY_INTELLIGENCE_MANIFEST.json` | always create for a valid paid result | optimization/Delivery Pack manifests | Connects statements, evidence, validation, provider, selection, and limitations. |

The installed `AGENT_MEMORY/` paths distinguish repository-owned memory from Delivery Pack path `07-context/`. Generator functions may be reused, but content must meet the repository-specific evidence gate. If an equivalent handwritten file exists elsewhere, the planner should strengthen or link it instead of adding a duplicate. Artifact disposition is always visible: `create`, `update`, `strengthen`, `skip`, `unavailable`, or `blocked`.

## 15. Repository Intelligence PR contract

The PR is a new product-level contract built on the existing review-first write boundary, not a change to current PR behavior in Omega 16.0.

Required preview data:

- repository identity and base ref;
- branch and PR title/body preview;
- selected artifacts and destination paths;
- disposition and reason for every proposed or skipped artifact;
- content diff or complete new-file preview;
- evidence coverage and unresolved limitations;
- conflict notes for existing handwritten files;
- human-review flags;
- manifest version and provider/selector metadata;
- explicit confirmation before creation;
- manual ZIP/git fallback.

Rules:

- never push directly to `main`;
- never merge automatically;
- reuse the connected GitHub App boundary and current permissions;
- keep blocked artifacts out of normal PR writes;
- put review-required alternatives under an explicit review path only if the established apply contract still requires it;
- do not silently rename, overwrite, or delete existing repository files;
- record GitHub success before saying the PR was created.

## 16. Evidence and citation requirements

- Every factual artifact statement maps to one or more evidence IDs.
- Every evidence ID resolves to a repository-relative path and source type.
- Include symbol and line/range when the extractor can establish them.
- Instructions cite both the fact that motivates them and the affected repository area.
- Inferences are labeled and cannot be presented as observed facts.
- Missing context is a first-class limitation, not filled with generic advice.
- High-impact claims should have either multiple supporting evidence items or one strong deterministic fact.
- User-visible previews provide path-level citations; the manifest retains statement-level detail.
- Removed or rejected claims remain available in validation diagnostics without entering generated files.

## 17. Validation and safety rules

Before artifact generation or PR inclusion:

1. Every referenced path must exist in the normalized inventory.
2. Referenced symbols must be found by a supported extractor or be labeled inferred and review-required.
3. Commands must be present in a manifest/config evidence item; prose-only commands are marked inferred and excluded from high-confidence instructions by default.
4. Every factual statement must have evidence IDs.
5. Unsupported high-confidence claims are rejected.
6. Contradictions with deterministic evidence fail validation.
7. Security, authentication, payment, deployment, legal, compliance, and sensitive data claims require human review.
8. Generated guidance must not weaken existing security or verification requirements.
9. Handwritten instructions must not be overwritten silently.
10. Generated workflow files remain disabled or example-only unless existing explicit behavior and human opt-in allow otherwise.
11. Limited scans cannot produce a high-confidence paid result.
12. A provider result with invalid schema, unknown paths, missing citations, or budget metadata is rejected or degraded to deterministic fallback.
13. `This is not legal advice.` remains visible in applicable client-facing or AI Act outputs.
14. The scan and deep-generation pipeline must not execute repository code, tests, builds, or workflows.

## 18. Privacy and repository-data boundaries

- ZIP scans remain local/browser-side under the current implementation until a user explicitly chooses future deep processing.
- Before any remote provider call, show that selected repository text will leave the local browser and identify provider/model and selected scope.
- Send only the sanitized, selected context bundle; never the unbounded archive.
- Never send secret-looking files, environment values, credentials, binaries, or excluded generated/vendor content.
- Do not persist raw repository contents in local scan history.
- Future server handling must define retention, logging, deletion, subprocessors, region, and access controls before release.
- Provider prompts and responses must avoid application logs containing source text.
- Evidence hashes and metadata may be retained only under an explicit persistence policy; persistence is out of scope until Omega 18.

## 19. Failure and fallback behavior

| Failure | Behavior |
| --- | --- |
| Unsupported/non-JS/TS deep scope | Keep deterministic scan and existing outputs; label deep Repository Intelligence unavailable. |
| Selection budget exceeded | Reduce by deterministic ranking, preserve coverage reserves, and show skipped/truncated scope. |
| Provider timeout/transient failure | One bounded retry, then deterministic fallback with no paid-quality claim. |
| Invalid provider schema | Reject response; do not generate PR artifacts from it. |
| Unsupported or contradictory claims | Remove rejected statements, downgrade affected artifact, and show validation reasons. |
| Insufficient evidence | Mark artifact unavailable or review-required; do not fill it with a generic template. |
| Existing handwritten conflict | Propose strengthen/update with diff, or skip; never silently overwrite. |
| GitHub unavailable/write failure | Preserve preview and offer Optimization Pack/manual fallback. |
| Limited scan | Block deep PR generation until a complete scan is available. |

The deterministic scan remains useful even when deep intelligence is unavailable.

## 20. Rescan verification behavior

Reuse and extend `repositoryVerification.ts` conservatively:

- save a baseline from the selected Repository Intelligence artifacts and manifest;
- compare only a matching later repository/ref scan;
- distinguish file presence, content signature match, evidence refresh, review-required content, missing artifacts, and non-verifiable state;
- rerun deterministic extraction against the new inventory;
- detect whether cited paths still exist and whether supported facts changed;
- report observed score/evidence deltas without claiming the PR caused them;
- never claim tests, runtime behavior, merge, deployment, or production correctness were verified;
- require human review for strengthen/update artifacts unless content and evidence checks are sufficient.
- keep artifact application identity separate from statement truth; exact Markdown may coexist with inferred, contradicted or review-required statements;
- treat limited-scan absence as unavailable, never as a confirmed missing artifact or contradiction;
- evaluate quality through finite dimension states and counts rather than a readiness or improvement score.

## 21. Repository Universe integration

Repository Universe remains ShipSeal's signature experience and an optional, lazy-loaded advanced surface. It is visual proof that ShipSeal understood the repository, an exploration tool backed by real evidence, and a launch/marketing asset.

Future additive overlays may visualize:

- evidence-backed repository areas;
- file and folder responsibilities;
- current agent friction;
- selected and proposed memory artifacts;
- current versus **With ShipSeal** state;
- findings and their evidence;
- links from a node to the relevant Repository Intelligence artifact and statement.

Universe must use the canonical evidence graph and must not fabricate applied nodes. Major new Universe functionality is not scheduled in Omega 16.x.

## 22. Client Handoff integration

Client Handoff remains a secondary commercial output after repository understanding. It may summarize:

- what ShipSeal inspected;
- selected high-confidence findings and limitations;
- what the Repository Intelligence PR proposes;
- review and verification status;
- links to supporting reports and manifests.

It must not become the primary paid identity or compete with repository intelligence in first-touch messaging. Existing Delivery Pack and report schemas remain unchanged until a separately versioned migration.

## 23. Testing strategy

### Unit tests

- evidence ID stability, normalization, provenance, and validation transitions;
- JS/TS import/export, entry-point, route, and responsibility extraction fixtures;
- source ranking, folder coverage, exclusion, truncation, and budget enforcement;
- provider schema parsing and rejection;
- statement-to-evidence coverage;
- create/update/strengthen/skip/unavailable/blocked decisions;
- handwritten conflict handling;
- manifest determinism and redaction.

### Integration tests

- React/Vite, Next.js, Node/Express, monorepo, and mixed JS/TS fixtures;
- provider success, partial output, hallucinated path, timeout, and invalid schema;
- artifact preview through optimization/apply models;
- GitHub payload compatibility without live writes;
- matching and mismatched rescans.

### Golden quality evaluations

Maintain small representative repositories with reviewer-approved facts. Measure:

- path citation precision;
- responsibility accuracy;
- unsupported-claim rate;
- artifact statement evidence coverage;
- duplicate/generic statement rate;
- useful task-routing coverage;
- human-review acceptance and correction rate.

Release requires zero invented paths/commands in the golden set and 100% evidence linkage for factual statements. Broader accuracy thresholds should be set after baseline evaluation rather than invented in this sprint.

### Compatibility and manual tests

- existing readiness thresholds and score tests;
- Delivery Pack manifest, `score.json`, PDF/HTML, Client Handoff, and PR payload tests;
- no-code-execution and archive safety tests;
- Repository Universe remains available;
- manual preview of every proposed artifact and limitation.

## 24. Performance and cost controls

- deterministic extraction precedes provider work and removes irrelevant content;
- cache extraction by content hash within a session;
- deduplicate identical selected chunks;
- use tiered selection: mandatory facts, central source, then folder samples;
- refuse unbounded full-repository prompts;
- expose selected file count, text size, truncation, and limitations before generation;
- cap retries and concurrent requests;
- make generation cancellable;
- version prompts, selectors, extractors, schemas, provider, and model;
- collect latency/token/cost metadata without source-text logging;
- allow deterministic-only fallback;
- later reprocess only changed evidence when persistence and diff support exist.

## 25. Incremental implementation phases

Numbering continues after the implemented Omega 15 rescan loop. Omega 16 is reserved for Repository Intelligence PR; Omega 17 and Omega 18 remain separate UX and commercial-foundation work to avoid mixing product-quality proof with accounts or billing.

### Omega 16.1 - Evidence model and repository responsibility extraction

- **Goal:** Add versioned evidence records and deterministic JS/TS responsibility facts.
- **Affected areas:** new repository-intelligence domain, report adapters, JS/TS fixtures.
- **Non-goals:** provider calls, artifact prose, GitHub writes.
- **Tests:** path normalization, symbol/range extraction, provenance, relationships, contradiction states.
- **Exit criteria:** real JS/TS fixtures produce stable path/symbol/responsibility evidence with no invented entities.

### Omega 16.2 - JS/TS source selection and context preparation

- **Goal:** Select a bounded, representative, sanitized context bundle.
- **Affected areas:** scanner-readable source boundary, selector, budget metadata, exclusions.
- **Non-goals:** model integration, persistence, broader stack parity.
- **Tests:** Vite/Next/Express/monorepo ranking, folder sampling, secrets, truncation, deterministic output.
- **Exit criteria:** selection is explainable, budgeted, cancellable, and exposes all skipped/truncated limitations.

### Omega 16.3 - Deep intelligence provider boundary and validated result schema

- **Goal:** Add a server-side-ready provider contract without selecting a production vendor or SDK.
- **Status:** Implemented on 2026-07-14 as an internal provider-neutral boundary; no production provider is connected.
- **Affected areas:** provider types, request/result/prompt-contract versions, strict schema normalization, evidence/path/contradiction validation, confidence caps, human-review classification, bounded execution, and deterministic fixture tests.
- **Non-goals:** API keys, entitlement, production provider deployment.
- **Tests:** deterministic requests and findings, valid/partial/invalid results, hallucinated paths/evidence, contradictory responsibilities/relationships/commands, sensitive output, confidence inflation, result limits, timeout, cancellation, and safe provider failure.
- **Exit criteria:** Met for the internal boundary: only validated, evidence-linked candidate facts are artifact-eligible; Omega 16.4 remains responsible for generation.

### Omega 16.4 - Repository-specific artifact generation

- **Goal:** Generate the focused artifact set from accepted evidence.
- **Status:** Implemented on 2026-07-14 as deterministic internal planning, generation, rendering, manifest and validation APIs; no UI, file write, PR or branch integration is connected.
- **Affected areas:** artifact composers, evidence manifest, existing output adapters, conflict policy.
- **Non-goals:** PR creation UI, landing redesign, generic templates as fallback.
- **Tests:** reordered-input determinism, operation selection, equivalent-file skip, handwritten strengthening/conflicts, folder caps, artifact eligibility, deterministic-only fallback, provenance coverage, human-review flags, manifest safety, and unsafe/generic-content rejection.
- **Exit criteria:** Met for internal drafts: every substantive statement carries valid deterministic evidence or an accepted finding, generic shells stay unavailable, and the focused fixture set passes the non-generic quality gate. Omega 16.5 remains the reviewed preview/apply integration.

### Omega 16.5a - Repository Intelligence artifact review, preview and selection integration

- **Goal:** Adapt validated drafts into the existing Optimization Plan experience without changing repositories or GitHub.
- **Status:** Implemented on 2026-07-14 as a deterministic internal review adapter, conservative selection model, focused preview UI, per-artifact acknowledgement, apply-readiness validator and future selected-artifact payload.
- **Affected areas:** review adapter, scanner-to-review session boundary, focused Result Dashboard review components and tests.
- **Non-goals:** GitHub calls, branches, commits, repository writes, production providers, persistence, public schema changes and Repository Universe visuals.
- **Tests:** identity/order determinism, regeneration, defaults, selection/dependencies, handwritten preservation, acknowledgement, provenance, payload safety, filters, detail, blocked states, accessibility and existing Optimization Plan/apply/dashboard regressions.
- **Exit criteria:** Met for review-only integration: users can inspect and select evidence-linked drafts, while unsafe or stale artifacts cannot enter the internal future-PR payload.

### Omega 16.5b - Reviewed GitHub PR apply integration

- **Goal:** Connect only the validated Omega 16.5a selected-artifact payload to the established review-first GitHub boundary.
- **Status:** Implemented on 2026-07-15 through `repositoryIntelligenceApply.ts`, `api/github-app/create-repository-intelligence-pr.ts`, `repositoryIntelligencePrClient.ts`, and `RepositoryIntelligencePrApply.tsx`. Output remains an internal GitHub App/provider boundary and is not attached to Delivery Pack, reports, score, persistence, or Repository Universe.
- **Apply eligibility:** only scans carrying the connected GitHub App installation, owner/repository and known base branch can preview or apply. ZIP, public URL and sample scans retain local artifact review but cannot submit a PR and never request a manual token. The accepted request is bounded to 20 files, 200,000 characters per file, 768 KiB total rendered content, 180-character paths, 20 acknowledgement records, 2,000 provenance references and a 16,000-character PR body.
- **Stale-file revalidation:** the Omega 16.5a payload records deterministic normalized-content fingerprints and ownership/preservation expectations without retaining unrelated file contents. Preview fetches only selected target paths from the GitHub base branch and performs no mutation. Confirmed apply obtains a fresh installation token, repeats repository, base-ref and target reads, and blocks the complete plan when presence, file type, ownership, content or marker state differs. Errors identify paths and recovery actions without returning current content or raw GitHub errors.
- **Operations:** `create` requires a still-missing target and writes the reviewed content exactly with stable final newline behavior. `update` requires an unchanged artifact recognized from ShipSeal-managed metadata and never infers ownership from a path. `strengthen` requires an unchanged handwritten file plus a current artifact acknowledgement; it appends or replaces only the section between `<!-- shipseal:repository-intelligence:start -->` and `<!-- shipseal:repository-intelligence:end -->`, preserving all content outside the section and rejecting missing, duplicate, reversed or ambiguous markers.
- **Confirmation and mutation:** `Preview Repository Intelligence PR` calls the server revalidation route in preview mode. Only the separately checked final `Create Pull Request` action submits `confirmed: true`. Branch names use `shipseal/repository-intelligence-<selected-plan-prefix>` with a deterministic base-commit suffix on collision. The existing server-only installation-token client, base-ref lookup, Contents API and Pull Request API are reused. Equivalent open PRs are returned only when their body contains the same full selected-plan marker; unrelated PRs are not updated.
- **Error recovery and write limitation:** connection, installation, permission, repository, branch, mismatch, stale target, marker, acknowledgement, path, branch, file, partial-write, existing-PR, rate-limit and GitHub availability failures use finite actionable codes. The canonical GitHub writer still makes bounded sequential Contents API commits, so a failure after one or more writes can leave a ShipSeal branch without a PR; the response states that partial condition and ShipSeal performs no destructive branch cleanup. The PR is never opened before all selected writes succeed.
- **Omega 16.6 baseline boundary:** success returns repository/base branch, PR branch and URL/number, selected-plan fingerprint, artifact IDs/fingerprints, target paths, operations and final content fingerprints. This internal metadata does not claim verification and does not alter the current public rescan schema.
- **Affected areas:** PR payload adapter, reviewed write confirmation, failure/manual fallback and later rescan baseline compatibility.
- **Non-goals:** permission expansion, auto-merge, direct `main` writes, workflow activation, payment or production provider selection.
- **Tests:** strict payload and credential rejection, deterministic plan/branch identity, create/update/strengthen stale-state behavior, marker preservation, preview non-mutation, selected-only writes, explicit single confirmation, token/content redaction and focused GitHub App mocks, plus the existing regression suite.
- **Exit criteria:** Met for reviewed apply integration: users can create only explicitly reviewed Repository Intelligence artifacts through unchanged GitHub App permissions and behavior; no automatic merge, default-branch write or production provider is connected.

### Omega 16.6a - Repository Intelligence rescan verification model

- **Goal:** Verify detected repository changes and institutionalize output-quality evaluation.
- **Status:** Implemented on 2026-07-15 as a pure internal baseline validator and artifact/statement comparison model with current deterministic evidence rebuilding, managed-section and handwritten-preservation verification, finite quality dimensions, lifecycle and bounded open work.
- **Affected areas:** richer internal Omega 16.5b baseline metadata, `repositoryIntelligenceVerification.ts`, stable domain exports, focused fixtures and canonical documentation. Existing Optimization verification remains unchanged.
- **Non-goals:** UI integration, causality, runtime verification, GitHub ancestry/merge lookup, provider calls, artifact regeneration, scoring, persistence or backend history.
- **Tests:** baseline versions/limits, repository and branch identity, create/update/strengthen states, exact versus modified content, marker and preservation conflicts, statement evidence/inference/review/contradiction, limited scans, determinism, quality counts, open work, existing apply and Optimization rescan regressions.
- **Exit criteria:** Met for the internal model: a compatible later scan reports conservative artifact and statement states without treating PR creation or Markdown presence as verified repository truth.

### Omega 16.6b - User-facing verification integration

- **Goal:** Present the validated Omega 16.6a result through the existing rescan experience without exaggerating impact.
- **Status:** Implemented on 2026-07-15 through `RepositoryIntelligenceVerificationPanel.tsx`, the validated PR-baseline callback in the existing review/apply components, one-time verification preparation in `useRepoScan.ts`, and bounded orchestration in `Index.tsx` and `ResultDashboard.tsx`.
- **Experience:** the Verify chapter shows repository/branch/scope, lifecycle, applied/exact/modified/missing/conflicting/unavailable/review counts, an evidence-backed next action, accessible filters and one selected artifact detail. Statement truth, managed-section state, handwritten preservation, contradictions, limitations, quality dimensions and open work remain directly sourced from Omega 16.6a.
- **Rescan integration:** the existing GitHub scan action is reused. The baseline and previous valid result survive scanning and failed verification; completed compatible verification replaces the result without retaining scanner-loaded source in React. PR context offers only safe open/rescan/review actions.
- **Bundle and Universe boundary:** the panel is part of the already lazy ResultDashboard chunk and the verification builder is dynamically imported after scan input exists. Repository Universe remains unchanged; repository-relative paths are preserved for future safe navigation.
- **Non-goals:** new verification algorithms, score changes, public export drift, provider calls or Repository Universe redesign.
- **Tests:** plain-language overall states without a score; exact/modified/missing/conflicting/unavailable filters; statement inference/review/contradiction; strengthen preservation; evidence-backed navigation; rescan/result preservation; empty/error states; safe GitHub context; baseline callback validation; and Omega 16.1-Omega 16.6a regressions.
- **Exit criteria:** Met. The UI distinguishes artifact application from statement truth and presents only the authoritative Omega 16.6a result without new GitHub mutation or public schema changes.

### Omega 16.6c - Repository specificity and acceptance fixes

- **Goal:** Correct acceptance findings where provider-context selection could become misleading guidance, raw file counts could misstate folder responsibility, and verification identity metadata could crowd narrow layouts.
- **Status:** Implemented on 2026-07-15 in the existing evidence, artifact-planning and verification-summary modules; no parallel evidence, context or verification domain was added.
- **Context guidance:** positive loading rules require known canonical responsibility evidence and sufficient confidence. Provider-only coverage fallbacks remain limitations. Placeholder environment templates are classified as setup configuration and retain the existing value-redaction boundary.
- **Folder aggregation:** confidence-weighted role significance plus bounded relationship degree yields explicit `dominant`, `mixed` or `insufficient-evidence` state. Folder prose reports mixed or represented responsibilities and never derives primacy from raw file count alone.
- **Responsive verification:** repository and branch identity occupies its own full-width, left-aligned mobile row with bounded word wrapping, while the existing right-aligned desktop layout and primary rescan action remain intact.
- **Tests and acceptance:** focused evidence, context, artifact and verification UI fixtures cover environment templates, unknown/provider-only guidance, clear/mixed/weak folder evidence, sample-project output and long mobile identity metadata; browser acceptance captures the corrected generated guidance, source-folder instructions and narrow verification summary without exposing source or secret content.
- **Acceptance result:** the built-in `sample-nextjs-app -> Improve -> Repository Intelligence PR -> review artifacts` flow and the development-only typed verification fixture passed the desktop and 390 x 844 browser checks on 2026-07-15. With those checks complete, Omega 16 acceptance is unconditional; Omega 17 remains the next sprint.
- **Limitations:** folder significance remains a deterministic structural heuristic; aliases, runtime behavior and business intent remain outside its scope. Environment-template safety assumes scanner-loaded placeholder files and the existing conservative redaction. Responsive acceptance does not add a new UI workflow.
- **Exit criteria:** Met when focused and full regressions plus desktop/mobile browser checks confirm repository-specific output, safe content handling and no public contract, score, GitHub or Repository Universe drift.

### Omega 17 - Simplified post-scan experience and ResultDashboard decomposition

- **Goal:** Make the scan-to-understanding-to-PR flow the clear default and decompose the current dashboard safely.
- **Affected areas:** post-scan information architecture and component boundaries.
- **Non-goals:** new intelligence algorithms, major Repository Universe features, account/payment work.
- **Tests:** primary flow, lazy Universe availability, accessibility, existing export actions.
- **Exit criteria:** the first post-scan path leads with repository understanding and the Repository Intelligence PR while supporting outputs remain accessible.

#### Omega 17.1 implementation status (2026-07-16)

- **Post-scan hierarchy:** `PostScanOverview.tsx` leads with repository identity, stack, branch, a conservative limited-scan state, and no score or export wall. `repositoryFrictions.ts` selects at most three items in canonical blocker-then-top-action order, deduplicates exact semantic matches, and emits an explicit insufficient-evidence state without filler.
- **Component boundary:** `PostScanOverview.tsx`, `ResultChapterNav.tsx`, `repositoryFrictions.ts`, and `types.ts` live under `src/components/agentready/result-dashboard/`. `ResultDashboard.tsx` remains the public orchestrator and retains complex Workspace Story, Universe, Optimization, review/apply, verification and export state.
- **Primary action:** `Review Repository Intelligence PR` switches to Improve, focuses the existing review panel, and reuses its current preparation callback, loading, selection, preview and explicit-confirmation behavior. It performs no direct GitHub mutation.
- **Explore and outputs:** `Explore in Repository Universe` returns to Understand and focuses the existing lazy-loaded Universe/Atlas surface without rescanning or replacing its models. Client Handoff, Delivery Pack and all existing exports remain available as secondary disclosures with unchanged serialization.
- **Protected contracts:** Omega 16 evidence, context, provider, artifact, preservation, apply and verification contracts are unchanged. Readiness and Repository Health scores, public schemas, GitHub permissions/mutation, Optimization verification, and Repository Universe models/interactions are unchanged.
- **Next work:** Omega 17.2 completes the progressive result hierarchy; Omega 17.3 remains pending and owns broader bundle decomposition.

#### Omega 17.2 implementation status (2026-07-16)

- **Four-chapter boundary:** detailed results are organized as Understand, Improve, Verify and Deliver. `ResultChapterShell.tsx`, `chapterContent.tsx`, `chapterState.ts`, the updated `ResultChapterNav.tsx`, and shared result-dashboard types contain the presentation boundary; `ResultDashboard.tsx` remains the orchestration owner.
- **Understand:** deterministic Workspace Story evidence leads the chapter, the existing lazy Repository Universe remains the primary Explore experience, and Repository Health, Repository DNA, Mental Model, scan coverage and technical evidence are supporting disclosures.
- **Improve:** overview friction is expanded into distinct observed-evidence and proposed-improvement stages. Repository Intelligence review and selection remains primary; Optimization Plan, confirmed apply and legacy fix paths remain separate supporting flows with unchanged contracts.
- **Verify:** one conservative baseline-to-rescan introduction precedes the existing Repository Intelligence and Optimization verification surfaces. PR creation or artifact download is not presented as verification, and no verification algorithm or score changed.
- **Deliver:** Client Handoff is the primary delivery route; Delivery Pack, PDF/HTML reports, repository and agent context, specialist outputs and raw compatibility exports retain their existing filenames, availability and serialization.
- **State and deep links:** the Omega 17.1 review and Universe CTAs still select and focus their destinations. Expensive Universe state, review selection, verification and exports remain mounted across chapter navigation; chapter changes do not rescan or mutate GitHub.
- **Protected contracts and next work:** Omega 16 scanning, evidence, providers, artifacts, GitHub apply, verification, readiness scoring, public schemas and Repository Universe model behavior are unchanged. Omega 17.3 remains pending and owns bundle splitting, broader lazy-loading and lint-warning cleanup.

### Omega 18 - Minimal persistence, accounts, public share page, badge and payment entitlement

- **Goal:** Add the smallest commercial state required to sell and share the validated outcome.
- **Affected areas:** accounts, entitlements, persistence, public results, badge backend, payments.
- **Non-goals:** expanding deep intelligence beyond validated JS/TS scope.
- **Tests:** auth boundaries, data retention, tenancy, payment state, public/private access, badge integrity.
- **Exit criteria:** paid access and persisted/shareable results are secure, reviewable, and do not expose repository contents.

## 26. Explicit non-goals

- Adding a provider SDK, browser credential, provider-selection dashboard, persistence, entitlement or uncontrolled provider fan-out.
- Authentication, Stripe, persistence, public badges, or share pages before Omega 18.
- Landing-page redesign in Omega 16.0.
- Major Repository Universe functionality or removing/deprecating Universe.
- Changing readiness thresholds, root score semantics, export schemas, Delivery Pack contracts, or manifest v2.
- Changing GitHub App permissions or current PR creation behavior.
- Executing scanned repository code, tests, builds, or workflows.
- Automatic merge, direct `main` writes, or active workflow generation by default.
- Full semantic parity for non-JS/TS stacks in the first release.
- Legal, security, compliance, or production-readiness guarantees.
- Generic best-practice documents presented as repository intelligence.

## 27. Definition of done

Repository Intelligence PR is done only when:

- product hierarchy matches this specification and `docs/vision/POSITIONING.md`;
- JS/TS scope and unsupported-stack fallback are explicit;
- deterministic evidence and provider interpretation have separate authority;
- source selection is bounded, versioned, and user-visible;
- every factual generated statement maps to valid evidence IDs;
- referenced paths and commands are validated;
- unsupported or contradictory high-confidence claims are rejected;
- artifacts use reviewable create/update/strengthen/skip/unavailable/blocked states;
- existing handwritten instructions are preserved or changed only through an explicit reviewed diff;
- sensitive claims receive human-review flags;
- Repository Universe remains available as the signature, lazy-loaded exploration surface;
- Client Handoff remains secondary and post-understanding;
- existing Delivery Pack, readiness, score, export, and GitHub contracts pass regression tests;
- PR creation remains explicit, review-first, and never pushes to `main`;
- a matching rescan reports conservative observed changes without causality or execution claims;
- golden JS/TS evaluations show zero invented paths/commands and complete evidence linkage;
- privacy, provider metadata, limitations, cost controls, and fallbacks are visible;
- full automated tests, lint, build, and required human review pass before release.

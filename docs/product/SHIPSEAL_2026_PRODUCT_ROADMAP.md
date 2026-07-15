# ShipSeal 2026 Product Roadmap

Last updated: 2026-07-14

This roadmap is subordinate to the canonical product direction in `docs/vision/POSITIONING.md` and the Repository Intelligence PR implementation contract in `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md`.

## Master vision

ShipSeal helps AI coding agents understand and work inside repositories more effectively.

The product loop is:

1. scan the repository;
2. identify where coding agents will struggle;
3. explain findings with concrete repository evidence;
4. generate repository-specific workspace improvements;
5. apply selected improvements through a reviewed GitHub PR;
6. rescan and verify what changed.

The primary paid outcome is the **Repository Intelligence PR**.

## Product hierarchy

- **Primary identity:** AI repository intelligence and AI workspace improvement.
- **Primary paid outcome:** Repository Intelligence PR.
- **Signature experience:** Repository Universe, preserved as optional visual proof and evidence exploration.
- **Secondary commercial output:** Client Handoff Pack after repository understanding.
- **Supporting outputs:** Delivery Packs, PDF/HTML, security and testing outputs, MCP guidance, AI Act notes, readiness, manifests, and `score.json`.

The release gate is repository specificity: generated files must describe real structure, responsibilities, commands, relationships, and risks. Generic templates are not a paid-quality result.

## Current implemented foundation

The repository already contains:

- deterministic browser-side ZIP and GitHub archive scanning with no imported-code execution;
- stack, command, instruction, test/CI, readiness, and Repository Health signals;
- Delivery Pack, PDF/HTML, Client Handoff, manifests, `score.json`, context packs, and folder-agent suggestions;
- a local deterministic narrative provider abstraction;
- Repository Universe and workspace models;
- optimization proposal and plan models with conflict/readiness states;
- an Optimization Pack ZIP and explicit review-first GitHub PR preparation path;
- session-local rescan baselines and conservative later-scan comparison.

This means safe PR preparation, Repository Universe, and basic rescan verification are foundations, not wholly future phases. The next gap is deep, evidence-linked repository specificity.

## 2026 delivery sequence

### Phase A - Repository Intelligence quality (Omega 16)

Goal: make the Repository Intelligence PR trustworthy and repository-specific for JS/TS application repositories.

Work:

- evidence schema and provenance;
- deterministic JS/TS responsibility and relationship extraction;
- bounded source selection and context budgets;
- structured provider boundary without browser secrets;
- validation against paths, commands, symbols, and deterministic blockers;
- root/folder instructions and `AGENT_MEMORY/` artifacts;
- statement-level evidence manifest;
- existing apply/PR integration;
- rescan evidence refresh and golden quality evaluation.

Exit criteria:

- factual generated statements have evidence IDs;
- golden React/Vite, Next.js, and Node/Express fixtures contain no invented paths or commands;
- unsupported claims are rejected;
- existing handwritten instructions are reviewable and never silently replaced;
- current readiness, export, and GitHub contracts remain compatible.

### Phase B - Simplified post-scan experience (Omega 17)

Goal: make repository understanding and the Repository Intelligence PR the obvious path after a scan.

Work:

- decompose `ResultDashboard`;
- simplify the scan-to-findings-to-artifacts-to-PR path;
- keep Repository Universe optional and lazy-loaded;
- keep Client Handoff and other exports accessible after understanding;
- preserve advanced evidence and compatibility views through progressive disclosure.

Exit criteria:

- users understand the core value without a walkthrough;
- Universe remains available and recognizable;
- no existing export path is lost.

### Phase C - Minimal commercial foundation (Omega 18)

Goal: support paid access and shareable results only after intelligence quality is validated.

Work:

- minimal accounts and persistence;
- Repository Intelligence entitlement and payment;
- public share page and badge backend;
- data retention, tenancy, privacy, and audit boundaries;
- metadata/history needed for durable rescan workflows.

Exit criteria:

- repository data remains isolated and governed;
- payment state cannot expose private results;
- public pages and badges are integrity-checked;
- no secrets or raw source are exposed through persistence.

### Phase D - Broader repository intelligence

Goal: expand only after JS/TS quality is measurable.

Possible work:

- validated support for additional stacks;
- incremental/diff-aware evidence refresh;
- richer responsibility and critical-flow extraction;
- measured agent-efficiency analytics;
- organization/team workflows;
- agency and white-label packaging;
- structured multi-perspective review for sensitive changes.

No stack should receive deep-quality claims before it has representative fixtures and release thresholds.

## Repository Universe roadmap role

Repository Universe remains part of ShipSeal. Near-term work should connect existing nodes to evidence and Repository Intelligence artifacts only when the underlying evidence model is ready. Major new Universe functionality is intentionally not scheduled in Omega 16.

Future compatible overlays may show current friction, responsibilities, selected memory, current versus **With ShipSeal**, and links from a node to an evidence-backed artifact. The visualization must not fabricate applied repository state.

## Client Handoff roadmap role

Client Handoff remains commercially useful for agencies and consultants, but it follows repository understanding. It can summarize findings, proposed PR artifacts, review status, and supporting outputs. It is not the hero promise or primary paid identity.

## Trust and compatibility requirements

Across every phase:

- do not execute imported repository code as part of scanning;
- do not send secrets or unbounded repository archives to a model;
- do not let model output override deterministic blockers;
- do not invent files, commands, symbols, or verified states;
- keep writes explicit, branch-based, and human-reviewed;
- keep applicable legal/AI Act output labeled **This is not legal advice.**;
- preserve readiness thresholds and export schemas until a separately planned versioned migration;
- preserve GitHub App permissions and current PR behavior until explicitly reviewed;
- avoid unsupported token, time, cost, security, or production-readiness guarantees.

## Deferred commercial and platform work

The following are deliberately deferred until Omega 18 or later:

- authentication and account management;
- Stripe or other payment implementation;
- persistent repository/source storage;
- public share pages and badge backend;
- broad non-JS/TS deep intelligence;
- automatic merge or direct `main` writes;
- active workflow installation by default;
- major Repository Universe expansion;
- generalized legal or compliance claims.

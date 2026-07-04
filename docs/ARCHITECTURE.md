# ShipSeal Architecture

ShipSeal is currently a local-first React/Vite application. Repository ZIP files are scanned in the browser, readiness reports are generated locally, and exports are produced with browser Blob downloads.

The ShipSeal 2.0 architecture direction is an AI Workspace Optimizer pipeline:

Repository -> Repository Intelligence Engine -> Project Memory Engine -> Context Compression Engine -> Agent Routing Engine -> AI Workspace Analytics -> Delivery Outputs.

Delivery Packs, reports, manifests, `score.json`, and readiness PR files are Delivery Outputs. They remain important, but they should be generated from the workspace engine rather than treated as the product core.

## Current Local Architecture

- UI: React, Vite, shadcn/ui, local state and hooks.
- Scan boundary: `src/lib/scanEngine/`.
- Public GitHub import: `src/lib/github/`.
- Local scanner: `src/lib/scanner.ts` reads ZIP metadata and a bounded text subset with JSZip.
- Main analysis: `src/lib/scoring.ts`, `src/lib/readiness.ts`, and `src/lib/agentPack.ts`.
- MCP analysis: `src/lib/mcpReadiness.ts`.
- AI narrative layer: `src/lib/ai/`.
- Sanitized context layer: `src/lib/repoContextPack.ts`.
- Exports: `src/lib/exports.ts`.
- Local history: metadata-only `localStorage` via `src/lib/scanHistory.ts`.
- Workspace foundation: `src/lib/workspace/` contains shared AI Workspace terminology, future navigation constants, and a lightweight domain model for Workspace Metrics, Repository Intelligence, Project Memory, Context Compression, Agent Routing, and Delivery Outputs.

Uploaded code is never executed. ShipSeal reads filenames, sizes, and selected small text/config files only.

## AI Workspace Foundation

Sprint Omega.3 introduces an additive workspace boundary in `src/lib/workspace/`.

This boundary defines shared terminology and types for:

- AI Workspace
- AI Workspace Quality
- Repository Intelligence
- Repository Friction
- Project Memory
- Context Efficiency
- Agent Productivity
- Delivery Outputs

The workspace foundation does not change scoring behavior. The current deterministic delivery/readiness score remains the root `ReadinessReport.score` and root `score.json.score` for schema v2 compatibility. Repository Health remains the current bridge dashboard metric and is expected to become supporting evidence when AI Workspace Quality is implemented.

Future workspace model construction should reuse existing static scan signals, Repository Health, Repo Context Pack, Context Compression, Agent Operating Mode, and Delivery Pack focus metadata without executing repository code.

## AI Workspace Dashboard

Sprint Omega.4 starts the dashboard transformation without changing backend logic or score calculations.

The dashboard hierarchy is now:

- AI Workspace hero with Workspace Quality as the primary metric.
- Workspace Overview cards for Workspace Quality, Repository Friction, Project Memory, and Agent Productivity.
- Live Agent Simulator MVP as an evidence-driven dashboard section.
- Planned module cards for Project Memory, Agent Heatmap, and Context Timeline.
- Collapsible Workspace evidence for Repository Health, scan evidence, measurement boundaries, and decision details.
- Delivery Outputs section for Delivery Pack preview, PDF/report export, `score.json`, package scope, and project intake.

Repository Health is still the underlying bridge score for Workspace Quality in the current UI. It remains available as supporting evidence and in exports. Agent Heatmap, Context Timeline, Repository Intelligence Engine, and new backend analytics are not implemented in this sprint.

## Live Agent Simulator MVP

The first simulator surface is implemented in `ResultDashboard.tsx` as a UI-only exploration plan. It answers: if an AI coding agent started working on this repository, what would it probably inspect first?

The simulator reuses existing scan evidence from `ReadinessReport`:

- repository source and repository label from `scanEvidence`
- primary stack, languages, frameworks, and run commands from `stack`
- README, architecture, instruction, manifest, and sampled file paths from summary/context-pack file lists
- key folders from `summary.keyFolders`
- generated/vendor ignore signals from `scanSummary`
- current agent-routing and context-waste dimensions from `repositoryHealth`

The simulator does not expose or claim to expose Claude, Codex, GPT, or other model internals. It is labelled as estimated repository exploration based on ShipSeal Repository Intelligence. Context reduction and routing quality are temporary heuristics until a real Repository Intelligence Engine and Workspace Analytics layer exist.

The MVP intentionally does not change scoring weights, Repository Health calculation, score.json, Delivery Pack exports, manifest paths, or GitHub PR behavior.

## Public GitHub Import Flow

Sprint 7 adds a client-side public GitHub import path:

1. The UI accepts a GitHub repository URL and optional branch.
2. `src/lib/github/githubUrl.ts` validates and normalizes public `github.com` repository URLs.
3. `src/lib/github/githubImport.ts` builds a public archive ZIP URL and attempts a browser `fetch`.
4. The downloaded Blob is converted into a File-compatible object.
5. `LocalScanEngine` scans the ZIP with `mode: 'github-public'` and preserves source metadata as `sourceType: github-url`.
6. The final `ReadinessReport` includes lightweight source metadata.

If fetch fails due to CORS, network behavior, private repository access, missing repository, branch mismatch, or ZIP size limits, ShipSeal shows a categorized fallback message. ZIP upload remains the reliable local MVP path. No GitHub token or credential is requested.

Hosted public GitHub import should later move to a same-origin endpoint such as `/api/github-archive?owner=Csisz&repo=shipseal&ref=main`; see [GitHub Import Proxy Plan](GITHUB_IMPORT_PROXY_PLAN.md).

## Source Metadata

Reports, `score.json`, Agent readiness reports, and recent scan history can include:

- `sourceType`: `zip-upload` or `github-url`
- GitHub owner, repo, and branch when applicable
- normalized source URL when applicable

Source metadata is lightweight and does not include raw file contents, downloaded ZIP bytes, generated files, or full Repo Context Packs. Local scan history remains metadata-only.

## Scan Engine Boundary

`ScanEngine` defines:

- `scan(input, callbacks): Promise<ReadinessReport>`
- progress callbacks for step start, step complete, progress, warning, and error
- local mode today, with future worker/backend modes expected

`LocalScanEngine` wraps the current browser scanner and produces the same `ReadinessReport` consumed by the dashboard and exports.

## AI Provider Layer

Sprint 6 introduces `AIProvider` in `src/lib/ai/types.ts`:

- `generateReadinessNarrative(input)`
- `generateAgentInstructions(input)`
- `generateMcpGovernanceNarrative(input)`

The active implementation is `LocalAIProvider`. It is deterministic, template-based, and runs locally from scan metadata. It does not call external AI APIs and does not require API keys.

Generated narrative can explain and enrich reports, but it is never the source of truth for scoring. Main readiness remains:

- score >= 85
- criticalBlockers.length === 0

MCP Readiness remains a separate governance dimension.

## Repo Context Pack

`src/lib/repoContextPack.ts` builds a compact, sanitized Repo Context Pack for future AI providers or coding agents. It includes metadata such as:

- repository name
- detected stack, package manager, scripts, and safe command hints
- key folders and existing instruction files
- scan summary and ignored generated/vendor folders
- critical blockers and improvement signals
- security findings derived from metadata
- MCP summary

It intentionally excludes raw full file contents and secrets. It is exported as `REPO_CONTEXT_PACK.md` and `repo-context-pack.json`, and included under `context/` in the full ZIP export. The context pack is not stored in local scan history.

## Why AI Calls Must Be Server-Side

Future external AI providers must be invoked from a backend or worker service, not directly from the browser:

- API keys must never be exposed to client bundles.
- Provider-specific retry, rate limit, audit, and redaction logic belongs on the server.
- Raw uploaded files should not be sent to AI providers directly.
- AI providers should receive only a sanitized Repo Context Pack.
- Generated narrative must not override deterministic blockers, scores, or policy decisions.

## Local Scanner

The local scanner enforces safety limits before analysis:

- max ZIP size
- max file count
- max readable text file size
- max total readable text budget
- max path length
- unsafe ZIP path rejection
- generated/vendor folder ignoring
- binary-like file ignoring

The scanner may warn for large but valid repositories. It blocks hard-limit violations before scoring to avoid misleading readiness output.

## Future Backend Or Worker Architecture

The next architecture can replace `LocalScanEngine` with one of two implementations:

- Browser/Web Worker scanner: keeps files local while moving ZIP parsing off the main UI thread.
- Backend worker scanner: uploads ZIPs to controlled object storage and scans them in an isolated worker.
- Backend GitHub scanner: fetches repositories through a GitHub App installation for private repos, branches, pull requests, and webhook-triggered rescans.

The UI should continue to talk to the scan engine or API adapter instead of scanner internals.

## Why ZIP Processing Should Move Later

Browser ZIP scanning is good for privacy-first MVP validation, but production teams will eventually need:

- larger repository support
- non-blocking parsing
- better memory isolation
- antivirus and malware scanning
- resumable uploads
- audit logs
- policy-based retention
- repeatable worker environments

## Future API Boundary

`src/lib/api/contracts.ts` documents future endpoints:

- `POST /api/scans`
- `GET /api/scans/:id`
- `GET /api/scans/:id/agent-pack.zip`
- `GET /api/scans/:id/score.json`
- `POST /api/ai/readiness-narrative`
- `POST /api/ai/agent-pack-enhance`
- `POST /api/ai/mcp-governance-narrative`

Future Workspace API candidates:

- `GET /api/scans/:id/workspace`
- `GET /api/scans/:id/workspace-metrics`
- `GET /api/scans/:id/delivery-outputs`

`src/lib/api/localScanAdapter.ts` mimics this behavior in memory without persisting raw files or generated contents.

## Why Private Repos Need Backend/GitHub App

Private repository scanning should not happen through pasted tokens in the browser:

- GitHub tokens must never be exposed in client-side code.
- OAuth and GitHub App installation flows need server-side secret handling.
- Private repo ZIP downloads require authorization, audit logs, retention policy, and least-privilege access.
- PR readiness checks and webhook-based rescans need a durable backend endpoint.
- Backend workers can apply the same no-code-execution scanner limits in a controlled environment.

## Security Principles

- Never execute uploaded code.
- Treat all repository content as untrusted input.
- Reject unsafe archive paths.
- Bound text reading by size and count.
- Ignore generated, vendor, and binary-like content for text analysis.
- Store scan history metadata only.
- Keep MCP recommendations cautious and least-privilege by default.
- Keep AI provider inputs sanitized and metadata-first.
- Keep deterministic readiness and MCP governance separate from generated narrative.

## Future GitHub App Flow

A GitHub App should eventually:

- request least-privilege repository access
- create scan jobs by ref or pull request
- stream status from backend workers
- comment with readiness summaries
- attach generated packs as artifacts or PR suggestions

GitHub integration should not bypass scanner limits or no-execution rules.

## Future AI Provider Abstraction

AgentReady currently makes no external AI calls. Future AI-assisted analysis should continue to sit behind the provider abstraction with:

- explicit user consent
- redaction and minimization
- model/provider selection
- audit logging
- deterministic baseline scoring retained as the source of truth
- server-side API key handling only

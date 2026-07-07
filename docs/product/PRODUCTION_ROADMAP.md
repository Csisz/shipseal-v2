# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# AgentReady Production Roadmap

## 1. Local MVP

- Browser-only ZIP scanning.
- Browser-only public GitHub ZIP import for demo-friendly public repositories.
- Deterministic Agent Readiness and MCP Readiness.
- Local Agent Pack and MCP Governance Pack exports.
- Deterministic local AI narrative generation through `LocalAIProvider`.
- Sanitized Repo Context Pack exports for future AI/coding-agent context.
- Metadata-only local scan history.

## 2. Browser/Web Worker Scanner

- Move ZIP parsing and scan analysis off the main UI thread.
- Keep files local.
- Add cancellable worker messages and progress events.
- Preserve the `ScanEngine` interface.

## 3. Backend Worker Scanner

- Add backend scan jobs.
- Run scanners in isolated worker containers.
- Keep no-code-execution guarantee.
- Enforce archive, text, binary, and path limits server-side.

## 4. Object Storage For Uploads And Outputs

- Store uploaded ZIPs temporarily with strict retention.
- Store generated packs and score exports as short-lived artifacts.
- Add signed URLs and deletion policies.

## 5. Job Queue

- Queue scan jobs with retry and timeout policies.
- Stream progress to the UI.
- Record job state without storing raw repository contents indefinitely.

## 6. AI Provider Abstraction

- Keep deterministic scoring as the baseline.
- Keep `AIProvider` as the boundary for readiness narrative, Agent Pack enhancement, and MCP governance narrative generation.
- Add backend-only provider implementations for selected external models.
- Ensure browser bundles never contain provider API keys.
- Send only sanitized Repo Context Packs to AI providers, not raw uploaded files.
- Support redaction, audit logs, rate limits, prompt/version tracking, and explicit user consent.
- Add provider and model options as future configurable policy, including local/mock, OpenAI-compatible, Anthropic-compatible, and self-hosted choices.

## 7. Backend AI Provider Phase

- Add `POST /api/ai/readiness-narrative`.
- Add `POST /api/ai/agent-pack-enhance`.
- Add `POST /api/ai/mcp-governance-narrative`.
- Run provider calls server-side with secret management.
- Validate that generated narrative cannot mark blocked repositories ready.
- Store AI outputs as derived artifacts with retention controls.

## 8. GitHub App Integration

- Add a GitHub App installation flow for private repository access.
- Scan repositories by branch, commit, or pull request.
- Preserve least-privilege permissions and avoid user-pasted tokens.
- Store source metadata and short-lived artifacts with retention controls.
- Comment readiness summaries.
- Open PRs with generated Agent Packs when requested.

## 9. Private Repo Scanning

- Fetch private repositories server-side through GitHub App installation tokens.
- Scan in isolated workers with the same no-code-execution guarantee.
- Support selected branches, tags, commits, and monorepo paths.
- Avoid storing raw source longer than the configured retention window.

## 10. Webhook-Based Rescan

- Trigger rescans on push, pull request opened/synchronized, and default branch changes.
- Debounce noisy event bursts.
- Keep scan results attached to commit SHA and source metadata.
- Notify teams when readiness drops below policy thresholds.

## 11. PR Readiness Checks

- Publish GitHub Checks for AgentReady score, blockers, MCP Readiness, and changed-file risk.
- Block merges only when organization policy enables required checks.
- Link to generated Agent Pack and Repo Context Pack artifacts.
- Keep AI narrative explanatory and deterministic checks authoritative.

## 12. Auth And Team Dashboard

- Add organizations, roles, scan history, and policy defaults.
- Keep raw source retention minimal and configurable.

## 13. Enterprise Policy Engine

- Enforce required blockers, MCP policies, and export rules.
- Support organization-wide allowlists and deny lists.
- Add audit reporting.

## 14. Self-Hosted Option

- Package scanner workers and policy engine for private deployment.
- Support enterprise storage, identity, and network boundaries.


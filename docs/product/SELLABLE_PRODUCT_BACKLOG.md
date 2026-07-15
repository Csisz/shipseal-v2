# ShipSeal Sellable Product Backlog

Last updated: 2026-07-14

This document lists the remaining functionality needed to turn ShipSeal from a strong MVP prototype into a sellable product. It combines the current product direction, recent implementation progress, and the next feature ideas that fit the ShipSeal positioning.

## Product Positioning

The canonical direction is defined in `docs/vision/POSITIONING.md`; Repository Intelligence PR implementation is defined in `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md`.

ShipSeal helps AI coding agents understand and work inside a repository more effectively. Its primary identity is AI repository intelligence and AI workspace improvement. Its primary paid outcome is the **Repository Intelligence PR**: reviewed, repository-specific memory and instructions derived from real structure, source responsibilities, commands, relationships, and risks.

Repository Universe remains the signature visual proof and optional advanced exploration experience. Client Handoff Pack is a secondary commercial export after repository understanding. Delivery Packs, reports, readiness, testing, security, MCP, AI Act notes, manifests, and `score.json` remain supporting outputs and compatibility contracts.

The first deep-intelligence release is JS/TS-first, especially React, Vite, Next.js, Node.js, and Express. Other stacks retain the deterministic scan until deep quality is validated.

Release gate: generated files must describe the actual repository. Generic best-practice templates are not sufficient.

## Current Working Baseline

Recent progress:

- GitHub App connection works.
- GitHub repository picker works and supports repository search.
- GitHub selected repository scans show a polished scanning state.
- Scan evidence is visible after scan:
  - repository name,
  - branch/ref,
  - source type,
  - archive size,
  - discovered/analyzed/ignored file counts,
  - detected stack,
  - key files found or missing.
- False `Limited Scan` warnings have been reduced for successful full archive scans.
- Goal-based output mapping exists and changes package names/output counts.
- Project package summary readability has been improved.

The next phase should focus on making exports, reports, PR creation, and AI-agent operating guidance feel professional and commercially usable.

## ShipSeal strategic priorities

The immediate priority is Omega 16: evidence, bounded JS/TS source selection, validated deep-intelligence results, repository-specific artifacts, Repository Intelligence PR integration, and rescan quality evaluation. Existing Delivery Pack, report, GitHub App, readiness PR, optimization apply, Repository Universe, and rescan functionality remain foundations.

## Priority: Context Compression Engine

Goal:

Reduce the amount of irrelevant repository context that AI coding agents need to read before making safe changes.

Expected outcomes:

- Generate compressed repository summaries for Codex, Claude Code, Cursor, and similar agents.
- Identify high-signal files, low-signal files, and context that should be excluded from routine agent prompts.
- Produce token-aware context briefs for common workflows such as bug fix, feature work, refactor, test generation, and review.

## Priority: Agent Memory Compiler

Goal:

Compile durable project memory from repository structure, docs, tests, recent readiness outputs, and human-provided project notes.

Expected outcomes:

- Generate reusable agent memory files.
- Separate persistent project facts from temporary scan findings.
- Help agents avoid rediscovering the same context on every session.

## Priority: Folder-level AGENTS

Goal:

Create scoped `AGENTS.md` guidance for important folders and subsystems.

Expected outcomes:

- Recommend where folder-level agent instructions are useful.
- Generate concise instructions for frontend, API, scanner, export, tests, docs, and infrastructure folders.
- Reduce broad top-level instruction files when local folder guidance is safer.

## Priority: Context Packs

Goal:

Package the right context for a selected agent task instead of shipping every generated file to every workflow.

Expected outcomes:

- Generate task-specific context packs.
- Support client handoff, AI agent development, security review, testing, MCP readiness, and refactor contexts.
- Keep context packs aligned with Delivery Pack outputs and readiness PR safe subsets.

## Priority: Agent Efficiency Analytics

Goal:

Measure how ready the repository is for efficient agent work.

Expected outcomes:

- Add an agent efficiency score.
- Surface context size, instruction quality, duplication, missing ownership, and likely token waste.
- Show before/after impact when ShipSeal-generated files are added.

## Priority: Context Waste Analyzer

Goal:

Find files, docs, patterns, and repository structures that cause agents to waste context or repeat work.

Expected outcomes:

- Flag duplicate documentation and stale roadmaps.
- Identify oversized files, noisy folders, outdated generated artifacts, and ambiguous instructions.
- Recommend exclusions or summaries for routine agent sessions.

## Priority: Agent Refactor Suggestions

Goal:

Suggest small, reviewable refactors that make a project easier for AI agents and humans to maintain.

Expected outcomes:

- Recommend documentation, folder, naming, test, and ownership improvements.
- Avoid broad automated rewrites.
- Prioritize changes that reduce agent confusion and improve future PR quality.

## Priority: Repository Intelligence PR

Goal:

Create a reviewed GitHub PR that adds evidence-backed repository memory and agent-workspace improvements to the selected repository.

Expected outcomes:

- Use the connected GitHub App flow.
- Add only generated safe documentation/configuration files.
- Include statement-level evidence, create/update/strengthen/skip decisions, limitations, and human-review flags.
- Reject generic or unsupported artifacts instead of filling the PR with templates.
- Do not include active workflows by default.

## Priority: AI Workspace Optimization

Goal:

Position ShipSeal as the system that converts messy AI-built repos into durable AI workspaces.

Expected outcomes:

- Combine readiness scoring, Delivery Packs, context compression, agent memory, folder-level instructions, and efficiency analytics.
- Support freelancers, agencies, and small teams using Codex, Claude Code, Cursor, GitHub Copilot, and future coding agents.
- Make the long-term product direction clear beyond the original Delivery Pack Generator MVP.

## Definition Of A Sellable MVP

The deep-intelligence product becomes sellable when a user can:

1. Connect GitHub or upload a ZIP.
2. Select a project and scan it reliably.
3. Receive evidence-backed findings about where coding agents will struggle.
4. See the selected source scope, budgets, exclusions, and limitations.
5. Preview repository-specific memory and instructions with citations.
6. Review create, update, strengthen, skip, unavailable, and blocked decisions.
7. Create a reviewed Repository Intelligence PR or download a manual package.
8. Rescan and see conservative detected changes.
9. Open Repository Universe as optional visual evidence exploration.
10. Export a Client Handoff Pack and existing supporting outputs when needed.

## Priority 1: Client Report And Delivery Pack Export Quality

Status: next recommended workstream.

Why it matters:

The user-facing value of ShipSeal is not only the scan result, but the quality of the downloadable package. If the Delivery Pack looks generic, inconsistent, or unfinished, the product will not feel sellable.

Required functionality:

- PDF report should be polished, branded, and client-ready.
- HTML report should match the PDF content and selected goal.
- `score.json`, manifest, dashboard, report, and ZIP contents should agree.
- Selected package/goal must be visible everywhere.
- Scan evidence must be included in the report and exported metadata.
- Generated output list should match the actual files in the Delivery Pack.
- Missing client/agency intake data should be handled gracefully.
- Long package names should wrap cleanly.
- No empty or awkward pages in PDF export.

Acceptance criteria:

- Client handoff, Security/data pre-screen, and Full ShipSeal reports show different selected package details.
- The PDF includes:
  - project name,
  - repository and branch,
  - readiness score,
  - readiness decision,
  - selected package,
  - scan evidence,
  - main strengths,
  - main risks,
  - recommended next actions,
  - generated file list,
  - disclaimer where appropriate.
- The same score, repository, package name, output count, and scan evidence appear in:
  - dashboard,
  - PDF,
  - HTML,
  - `score.json`,
  - manifest.

## Priority 2: Create Readiness PR Finalization

Why it matters:

The strongest product loop is: scan project -> generate fix pack -> create PR. This makes ShipSeal directly useful inside the user's repository.

Required functionality:

- Create PR using the connected GitHub App, not a manual token.
- Use selected repository from the GitHub picker.
- Automatically create a safe branch.
- Add generated readiness/fix-pack files to that branch.
- Open a Pull Request with a clear title and body.
- Show PR link after success.
- Provide friendly errors if:
  - GitHub App is not installed for the repo,
  - branch creation fails,
  - file write fails,
  - PR already exists,
  - repo is read-only or permission-limited.

Acceptance criteria:

- A user can scan `Csisz/shipseal-v2`, generate a fix pack, and create a PR without manually entering a token.
- PR files match the generated Delivery Pack/fix-pack list.
- PR body explains what ShipSeal added and why.
- Failure states offer Retry/Reconnect guidance.

## Priority 3: Goal-Based Delivery Pack Maturity

Why it matters:

Different users want different outcomes. A client handoff pack should not feel identical to an AI-agent-development pack.

Required functionality:

- Goal selection should consistently affect:
  - dashboard summary,
  - generated file list,
  - PDF/HTML report,
  - manifest,
  - `score.json`,
  - Delivery Pack ZIP.
- Full ShipSeal includes all outputs.
- Focused packages include only relevant outputs.

Goal mappings:

### Client Handoff

Outputs:

- client report,
- executive summary,
- readiness decision,
- roadmap,
- delivery manifest.

### AI Agent Development

Outputs:

- `AGENTS.md`,
- `CLAUDE.md`,
- Codex/Cursor guidance,
- repo context pack,
- agent safety notes.

### Testing / Red-Team

Outputs:

- test plan,
- test cases,
- red-team prompts,
- quality gates,
- CI/test recommendations.

### Security / Data Pre-Screen

Outputs:

- security notes,
- env/secrets findings,
- data/privacy checklist,
- risk summary.

### MCP Readiness

Outputs:

- MCP readiness,
- MCP security policy,
- tool allowlist,
- MCP server recommendations.

### AI Act / Transparency

Outputs:

- transparency notice,
- AI Act readiness checklist,
- user-facing disclosure notes,
- legal review questions.

### Full ShipSeal

Outputs:

- all of the above.

## Priority 4: Agent Cost Optimizer

Status: planned feature. Do not implement before report/export and PR flows are stable.

Why it matters:

ShipSeal should not only say whether a project is AI-agent-ready. It should also help users decide how AI agents should work on the project without wasting Codex/Claude token budgets, rate limits, or user time.

Feature summary:

Agent Cost Optimizer helps AI builders keep Codex, Claude, and other coding agents under control. ShipSeal scans the project and generates tailored `AGENTS.md` and `CLAUDE.md` files in different operating modes:

- Maximum Reliability,
- Balanced Productivity,
- Token Saver.

This helps agents avoid unnecessary full-repo scans, repeated builds, broad refactors, and expensive context usage while still giving them enough project knowledge to work safely.

Recommended MVP scope:

- Add Agent Cost Optimizer inside the AI Agent Development pack.
- Do not make it a noisy top-level onboarding step yet.
- Default to Balanced Productivity.
- Generate mode-specific agent instruction files.
- Include a short report section explaining the recommended agent working style.

Operating modes:

### Maximum Reliability Mode

Purpose:

For production preparation, critical business logic, large refactors, security-sensitive work, and client delivery.

Behavior:

- More detailed `AGENTS.md` / `CLAUDE.md`.
- Stronger verification expectations.
- More explicit test/build checks.
- More cautious change workflow.
- Higher token/rate-limit cost.

### Balanced Productivity Mode

Purpose:

Default mode for normal development.

Behavior:

- Keeps important context and guardrails.
- Recommends focused checks.
- Avoids unnecessary full test/build runs after every tiny edit.
- Good balance between safety and speed.

### Token Saver Mode

Purpose:

For Plus/Pro limits, vibe coding, small UI fixes, short iterations, or low-risk edits.

Behavior:

- Shorter `AGENTS.md` / `CLAUDE.md`.
- Work in small scoped steps.
- Avoid opening large files unless needed.
- Avoid full build/test unless explicitly requested.
- Do not commit/push unless explicitly requested.
- At the end, list manual verification commands instead of always running everything.

Scan signals used:

- detected stack,
- large/generated folders,
- vendor folders,
- build/test commands,
- critical folders,
- key files,
- existing agent instruction files,
- folders that should not be read every turn,
- suggested folder-level `AGENTS.md` locations.

Future outputs:

- mode-specific `AGENTS.md`,
- mode-specific `CLAUDE.md`,
- `AGENT_COST_OPTIMIZATION.md`,
- suggested folder-level `AGENTS.md` files,
- agent operating mode recommendation,
- token/rate-limit risk notes.

## Priority 5: Scan Engine Deepening

Why it matters:

Readiness scoring is only credible if the scan engine detects project signals accurately.

Required improvements:

- Better framework detection:
  - Vite,
  - React,
  - Next.js,
  - Node,
  - Python,
  - Flask,
  - Django,
  - static sites,
  - mixed frontend/backend repos.
- Better command detection:
  - test,
  - build,
  - lint,
  - typecheck,
  - e2e.
- Better file signal detection:
  - README,
  - docs,
  - tests,
  - CI,
  - env examples,
  - security docs,
  - agent instruction files,
  - package manager locks,
  - deployment config.
- Ignore generated/vendor folders:
  - `node_modules`,
  - `dist`,
  - `build`,
  - `.next`,
  - `coverage`,
  - `.venv`,
  - large binary/media folders.

Acceptance criteria:

- Scan evidence explains what was read, skipped, and inferred.
- Stack detection is specific enough for user trust.
- Warnings are actionable.

## Priority 6: Score Logic And Explainability

Why it matters:

A score without explanation feels arbitrary. A sellable product needs transparent scoring.

Required functionality:

- Keep global 0-100 score.
- Add category scores:
  - Handoff readiness,
  - Agent readiness,
  - Testing readiness,
  - Security/data readiness,
  - MCP readiness,
  - AI Act/transparency readiness.
- Explain No-Go / Caution / Ready decisions.
- Show why score changed after fixes.
- Avoid overconfident "Ready" language when client/human review is still needed.

Acceptance criteria:

- Users can see why a project scored 56 vs 93.
- Reports cite concrete signals:
  - README found,
  - tests found/missing,
  - CI found/missing,
  - `.env.example` found/missing,
  - AGENTS/CLAUDE found/missing.

## Priority 7: Error Handling And Recovery

Why it matters:

Users will hit GitHub, ZIP, browser, permission, and rate-limit issues. These must feel recoverable.

Required functionality:

- Friendly GitHub App errors.
- Friendly archive download errors.
- Friendly ZIP parse errors.
- Retry button.
- Reconnect GitHub button.
- Use public URL instead option.
- Upload ZIP fallback.
- Clear `Limited Scan` explanation only when actually needed.

Acceptance criteria:

- User never sees raw API errors as the primary message.
- Every failure state suggests a next action.

## Priority 8: Demo And Sales Assets

Why it matters:

The product needs to sell itself before users connect their own repositories.

Required functionality:

- Sample project demo.
- Example Delivery Pack.
- Downloadable sample PDF report.
- Public demo walkthrough.
- Before/after explanation.
- Pricing page cleanup.
- Contact/request-access form.
- Clear privacy and "code is not executed" explanation.

Recommended demo assets:

- `shipseal-v2` self-scan report.
- small weak project scan report.
- before/after readiness fix example.
- sample Readiness PR screenshot or link.

## Priority 9: Security, Privacy, And Trust

Why it matters:

Users are connecting repositories. Trust language and boundaries must be clear.

Required functionality:

- Explain that ShipSeal does not execute repository code.
- Explain static/metadata scan boundaries.
- Explain what data is read.
- Explain what is ignored.
- Explain GitHub App permissions.
- Add privacy/security notice.
- Add client report disclaimer.
- Add "not legal advice" note for AI Act readiness.

Acceptance criteria:

- A cautious technical buyer understands the data boundary.
- A non-technical buyer understands the safety promise.

## Priority 10: Dependency And CI Health

Why it matters:

A sellable product needs a stable build and low-maintenance dependency baseline.

Required functionality:

- `npm test` passes.
- `npm run build` passes.
- GitHub Actions are green.
- Audit known vulnerabilities.
- Use cautious `npm audit fix` only when non-breaking.
- Upgrade deprecated GitHub Actions where practical.

Acceptance criteria:

- Main branch remains deployable.
- CI failures block only real issues.
- Dependency risk is documented.

## Priority 11: Onboarding And Information Architecture

Why it matters:

The user should understand ShipSeal in five seconds.

Required improvements:

- Reduce technical noise on the landing page.
- Make the first action obvious:
  - connect GitHub,
  - upload ZIP,
  - try sample project.
- Explain goals in outcome language:
  - hand over to client,
  - develop safely with AI agents,
  - add tests/red-team prompts,
  - check security/data risk,
  - prepare AI Act transparency,
  - generate everything.
- Keep advanced details collapsed.

Acceptance criteria:

- A non-technical founder understands what to do.
- A developer understands the technical value.

## Priority 12: Commercial Packaging

Why it matters:

ShipSeal needs a clear pricing and packaging model.

Possible tiers:

### Free Demo

- sample project scan,
- limited ZIP scan,
- preview report,
- watermark or limited export.

### Builder

- GitHub scan,
- Delivery Pack download,
- focused packages,
- PDF/HTML report.

### Repository Intelligence

- evidence-backed repository findings,
- bounded JS/TS deep analysis,
- root and selected folder-level `AGENTS.md`,
- repository-specific `AGENT_MEMORY/` artifacts,
- evidence manifest and reviewed Repository Intelligence PR,
- conservative rescan verification,
- supporting Delivery Pack export.

### Agency / White-label

- multi-project workspace flow,
- white-label report,
- client handoff exports,
- reviewed Repository Intelligence PR and compatibility Readiness PR workflows,
- richer export history.

## Suggested Implementation Order

1. Omega 16.1: evidence model and JS/TS responsibility extraction.
2. Omega 16.2: bounded source selection and sanitized context preparation.
3. Omega 16.3: validated deep-intelligence provider boundary.
4. Omega 16.4: repository-specific artifact generation and evidence manifest.
5. Omega 16.5: Repository Intelligence PR preview and existing apply integration.
6. Omega 16.6: rescan verification and quality evaluation.
7. Omega 17: simplified post-scan flow and `ResultDashboard` decomposition.
8. Omega 18: minimal accounts, persistence, sharing, badge, and payment entitlement.

## Near-Term Manual Test Checklist

Before calling a build sellable, test these flows:

1. GitHub App scan: `Csisz/shipseal-v2`.
2. GitHub App scan: a weaker project such as `portfolio_tracker`.
3. ZIP upload scan.
4. Public GitHub URL scan.
5. Client handoff package export.
6. AI agent development package export.
7. Security/data pre-screen export.
8. Full ShipSeal package export.
9. PDF report download.
10. HTML report open.
11. `score.json` export.
12. Delivery Pack ZIP download.
13. Create Readiness PR.
14. GitHub permission error recovery.
15. Failed ZIP parse recovery.

## Open Product Questions

- What measured quality thresholds should join zero invented paths/commands and complete evidence linkage after the first golden JS/TS baseline?
- Which provider/model and repository-data retention policy can satisfy the privacy boundary before production use?
- How should existing handwritten instructions be merged when a line-level structured merge is unsafe?
- Which persistence is minimally necessary for durable rescan history without storing raw source?
- Should PDF reports support white-label branding in the first paid version?
- Should human services stay completely separate from the automated ShipSeal product?
- Should AI Act readiness be framed as legal-adjacent documentation support rather than compliance advice?

# ShipSeal 2026 Product Roadmap

Last updated: 2026-06-22

## Master Vision

ShipSeal turns chaotic AI-built projects into efficient AI workspaces.

The original Delivery Pack Generator remains useful, but it is now the second layer of the product. The strategic product is an AI Agent Efficiency Platform: a system that helps builders, freelancers, agencies, and small teams make projects easier, cheaper, safer, and faster for AI coding agents to work on.

## Positioning

Primary positioning:

AI Agent Efficiency Platform

Secondary value:

Delivery Pack and client handoff reports

ShipSeal should help users answer:

- What does this repository need before a client, teammate, or agent can work safely?
- What context should an agent read first?
- What context can be compressed, summarized, ignored, or moved into scoped guidance?
- Which generated files should go into a Delivery Pack, a report, or a reviewed PR?
- How can this project waste fewer tokens, fewer rate limits, and less human review time?

## Product Pillars

1. Readiness: score the project, explain evidence, and identify missing delivery files.
2. Delivery: generate client reports, Delivery Packs, manifests, score exports, and safe readiness PRs.
3. Agent efficiency: compress context, compile memory, recommend scoped instructions, and reduce token waste.
4. Trust: keep code scanning safe, avoid executing imported code, explain GitHub permissions, and keep generated changes reviewable.
5. Workspace optimization: turn messy AI-built repositories into durable AI workspaces.

## Phase 0 - Stabilization

Goal:

Protect the existing product foundation.

Focus:

- Keep tests and build green.
- Stabilize GitHub App repository selection and scan flow.
- Keep client report, PDF, HTML, score.json, manifest, ZIP, and PR metadata consistent.
- Keep active workflow generation disabled by default.
- Preserve no-code-execution guarantees.

Exit criteria:

ShipSeal has a stable baseline that can be demoed and trusted.

## Phase 1 - Sellable MVP

Goal:

Make ShipSeal commercially presentable.

Focus:

- Polish sample reports and demo projects.
- Improve pricing, contact, and lead-capture paths.
- Make the client report and Delivery Pack feel professional.
- Show before/after examples for agencies and AI freelancers.
- Explain what ShipSeal adds to a repository and why it matters.

Exit criteria:

A user can scan a repo, download a polished package, create a safe PR, and understand the value without a live walkthrough.

## Phase 2 - Trust Layer

Goal:

Make safety and privacy understandable.

Focus:

- Explain GitHub App permissions.
- Explain static scanning and no-code-execution boundaries.
- Add privacy, security, and data-handling pages.
- Make legal and AI Act wording preliminary and non-advisory.
- Make generated PRs clearly review-first.

Exit criteria:

Users understand what ShipSeal reads, what it writes, and what it never does.

## Phase 3 - Agent Cost Optimizer

Goal:

Help users choose how agents should work in the repository.

Focus:

- Maximum Reliability mode.
- Balanced Productivity mode.
- Token Saver mode.
- Mode-specific AGENTS.md and CLAUDE.md guidance.
- A short explanation of expected tradeoffs and review needs.

Exit criteria:

Users can generate agent instructions that reduce unnecessary scans, broad refactors, repeated builds, and token waste.

## Phase 4 - Context Compression Engine

Goal:

Compress repository context into high-signal summaries for agent work.

Focus:

- Identify high-signal and low-signal files.
- Generate task-specific context summaries.
- Reduce repeated context gathering by Codex, Claude Code, Cursor, and future agents.
- Separate stable project facts from temporary scan findings.

Exit criteria:

ShipSeal can produce compact context that agents can use without reading the whole repository.

## Phase 5 - Context Packs

Goal:

Package the right context for the selected job.

Focus:

- Client handoff context.
- Agent development context.
- Security and data review context.
- Testing and red-team context.
- MCP readiness context.
- Refactor and review context.

Exit criteria:

Users can download or attach focused context packs instead of pushing every generated output into every workflow.

## Phase 6 - Folder-level AGENTS

Goal:

Generate scoped instructions where local context matters.

Focus:

- Recommend folders that need local agent guidance.
- Generate concise folder-level AGENTS.md files.
- Keep top-level guidance smaller.
- Clarify local testing, ownership, and boundaries by subsystem.

Exit criteria:

Agents can work inside important folders with less ambiguity and less global context.

## Phase 7 - Skill & MCP Recommendation Engine

Goal:

Recommend useful skills, tools, and MCP servers without making unsafe assumptions.

Focus:

- Detect where skills would improve review, test generation, documentation, or refactor work.
- Recommend MCP servers and tool allowlists.
- Flag MCP security and permission risks.
- Keep recommendations human-reviewed.

Exit criteria:

ShipSeal can recommend agent tooling in a way that is useful, scoped, and safe.

## Phase 8 - Agent Efficiency Analytics

Goal:

Measure agent efficiency as a product metric.

Focus:

- Agent efficiency score.
- Context waste signals.
- Instruction quality signals.
- Duplicate or stale documentation detection.
- Before/after improvement tracking.

Exit criteria:

Users can see why a repository is expensive or confusing for agents and what to fix first.

## Phase 9 - Agent Refactor Suggestions

Goal:

Suggest small changes that make repositories easier for agents and humans.

Focus:

- Documentation structure improvements.
- Folder organization suggestions.
- Test and ownership improvements.
- Context compression opportunities.
- Safe, reviewable refactor candidates.

Exit criteria:

ShipSeal can recommend practical improvements without attempting broad automated rewrites.

## Phase 10 - Review Council

Goal:

Add structured multi-perspective review for important decisions.

Focus:

- Product reviewer.
- Engineering reviewer.
- Security/data reviewer.
- AI governance reviewer.
- Client handoff reviewer.

Exit criteria:

Users can see competing risks and recommendations before merging or delivering a project.

## Phase 11 - Auto-fix PR

Goal:

Create safe, reviewed PRs that apply selected ShipSeal recommendations.

Focus:

- GitHub App branch creation.
- Safe generated files.
- Optional small documentation changes.
- Clear PR bodies and review steps.
- No active workflow generation unless explicitly selected.

Exit criteria:

ShipSeal can move from diagnosis to carefully bounded repository improvements.

## Phase 12 - White-label Agency

Goal:

Make ShipSeal usable by agencies as a branded delivery and optimization layer.

Focus:

- White-label reports.
- Agency project templates.
- Client-facing readiness narratives.
- Reusable workspace optimization packages.
- Team review workflows.

Exit criteria:

Agencies can use ShipSeal as part of their delivery process without exposing internal tooling.

## Long-term Vision - AI Workspace Optimizer

ShipSeal should become an AI Workspace Optimizer.

The long-term product is not only a report generator and not only a compliance checklist. It is a system for keeping AI-built software projects understandable, reviewable, context-efficient, and ready for repeated agent collaboration.

The engine direction is:

Repository -> Repository Intelligence Engine -> Project Memory Engine -> Context Compression Engine -> Agent Routing Engine -> AI Workspace Analytics -> Delivery Outputs.

Future roadmap work should treat AI Workspace Quality as the primary product score. Repository Health remains a supporting repository-state metric, and Delivery Packs, reports, manifests, `score.json`, and readiness PRs remain Delivery Outputs.

In mature form, ShipSeal should:

- compress project context,
- compile durable agent memory,
- create scoped instructions,
- recommend skills and MCP tools,
- measure token waste,
- suggest low-risk refactors,
- generate safe PRs,
- support review councils,
- and produce polished client delivery artifacts.

The product promise:

ShipSeal makes AI projects easier to hand over, easier to review, and easier for agents to improve without wasting the user's context budget.

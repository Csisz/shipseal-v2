# Dashboard Redesign Plan

Last updated: 2026-07-16

## Omega 17.2 implementation status

The detailed post-scan experience now follows one four-chapter repository journey:

1. **Understand** - Workspace Story leads, Repository Universe remains the primary Explore surface, and Repository Health, DNA, Mental Model and scan coverage support the narrative through progressive disclosure.
2. **Improve** - repository friction is expanded from observed evidence into proposed changes, Repository Intelligence review remains primary, and Optimization Plan plus legacy fix paths are supporting structures.
3. **Verify** - the saved baseline, expected change and later rescan are presented as one conservative story; Repository Intelligence and Optimization verification remain distinct and their algorithms are unchanged.
4. **Deliver** - Client Handoff leads the delivery route, followed by the existing Delivery Pack, reports, repository/agent context, specialist outputs and technical exports.

`PostScanOverview` remains the first surface. Its review CTA selects Improve, mounts its lazy chapter when necessary and focuses Repository Intelligence review; its Explore CTA selects Understand, requests the progressive Universe surface and focuses it after mounting. `ResultChapterShell.tsx`, the independent modules under `result-dashboard/chapters/`, `chapterContent.tsx` and `chapterState.ts` provide the chapter presentation boundary while `ResultDashboard.tsx` retains complex orchestration state. Duplicate overview friction cards are not repeated; Improve uses an evidence-to-recommendation progression instead.

Omega 17.3 replaces eager hidden chapter rendering with mount-on-first-visit/retain-after-visit behavior. Inactive visited chapters use native `hidden`, so their local state is retained without leaving focusable or assistive-technology-visible content. Unvisited Deliver and Improve support surfaces do not execute. Calm per-chapter Suspense states and contained error boundaries leave the overview usable during loading failures.

Repository Universe remains the main Explore experience. Its explanatory surface is immediate, while the existing model and lazy 3D implementation are requested only by the Explore CTA, a bounded 240 px IntersectionObserver margin, or the explicit Prepare control. The observer disconnects after intent and on cleanup; one retained `AiWorkspaceHero` instance preserves selection, camera, filters, Atlas fallback and optimizer state. The existing WebGL renderer continues to cancel its animation frame, disconnect its resize observer, remove canvas/document listeners and dispose resources on cleanup.

Client Handoff remains secondary. `DeliveryPackPreview` and `SuggestedReadinessFixPack` are chapter-loaded. PDF (`jspdf`/`html2canvas`) and ZIP (`jszip`) implementations remain dynamic action-only imports; export buttons now expose bounded busy/disabled states to prevent duplicate concurrent generation while preserving filenames, contents and serialization. QA fixtures remain behind `import.meta.env.DEV` plus dynamic imports and do not appear in production assets.

Measured production build comparison:

- modules transformed: 2,244 -> 2,249;
- build render duration: 44.87 s -> 40.52 s on the same checkout;
- `ResultDashboard`: 549.69 kB / 137.77 kB gzip -> 423.09 kB / 107.76 kB gzip;
- Repository Universe: 542.88 kB / 138.29 kB gzip -> 542.94 kB / 138.30 kB gzip (intentionally isolated and behavior-preserving);
- largest entry chunk: 3,785.25 kB / 1,079.21 kB gzip -> unchanged at 3,785.25 kB / 1,079.21 kB gzip;
- chunks above 500 kB: 4 -> 3;
- new async boundaries: Improve 26.81 kB, Verify 25.66 kB, Delivery preview 13.97 kB and Suggested Fix Pack 61.15 kB;
- total emitted JavaScript is approximately 6.27 MiB raw / 1.79 MiB gzip. The small total-size increase is async-boundary/runtime overhead, not duplicated export engines.

`npm run build:report` provides a dependency-free repeatable raw/gzip asset inventory. The remaining large entry chunks belong to the wider intake/scanner application graph, and the 542.94 kB Universe chunk contains the deliberately isolated Three.js renderer. The warning threshold was not raised and no arbitrary vendor chunk rules were added.

Lint moved from 12 warnings to zero. Hook dependencies use current refs or stable callbacks; shadcn files no longer export unused helpers, and the two intentional colocated variant exports have one-line documented Fast Refresh exceptions. React Router v7 transition and splat flags are enabled without upgrading. The previous dashboard Suspense warning is addressed by awaiting lazy behavior in tests. TypeScript diagnostics decreased only by the two small `ResultDashboard` `ignoredFolders` corrections; the unrelated repository backlog remains explicit.

Omega 16 scanner, evidence, artifact, GitHub apply, verification, scoring, serialization and Repository Universe contracts were not changed. No provider was connected, no public serialization changed, no GitHub mutation behavior changed and no verification algorithm changed. Omega 17 is complete.

## Purpose

This plan prepares the dashboard for the ShipSeal 2.0 AI Workspace Optimizer direction without implementing Live Agent Simulator, Agent Heatmap, Context Timeline, scoring changes, or new visual features.

UX direction:

- calm
- minimal
- premium
- outcome-driven
- progressive disclosure
- evidence before recommendations

## Future Navigation

1. Workspace Overview
2. Workspace Quality
3. Repository Friction
4. Project Memory
5. Agent Simulator
6. Heatmap
7. Timeline
8. Delivery Outputs

Agent Simulator, Heatmap, and Timeline should remain planned surfaces until explicitly implemented.

## Current Dashboard Section Classification

| Current section or component | Current role | Future classification |
| --- | --- | --- |
| `RepositoryHealthHero` | Main hero score and status | Workspace, then Repository Friction evidence |
| `RepositoryHealthActions` | Top static repository improvements | Workspace, Repository Friction |
| `RepositoryHealthDimensions` | Five health dimensions | Workspace Quality, Repository Friction, Context / Routing, Delivery Outputs |
| `ScanEvidencePanel` | Static scan source, file counts, stack, key files | Workspace |
| `MeasurementBoundary` | Explains static estimate and no-code-execution boundary | Workspace |
| Project summary card | Repository identity, stack, selected package, readiness status | Workspace |
| `ProjectPackageSummary` | Selected package/output summary | Delivery Outputs |
| `AgentOperatingModeSummary` | Recommended context policy for agent work | Context / Routing |
| Selected packages badges | Export scope | Delivery Outputs |
| Delivery readiness alert | Current go/no-go handoff status | Delivery Outputs |
| Technical readiness details | Legacy delivery readiness categories and score gauge | Delivery Outputs |
| `DecisionSummary` | Risks and next actions for handoff | Workspace, Delivery Outputs |
| `DeliveryPackPreview` | Reports, score.json, ZIP, PDF/HTML export | Delivery Outputs |
| Project context intake panel | Client/report context | Delivery Outputs |
| Suggested Readiness Fix Pack | Optional generated files and PR creation | Enterprise Add-ons, Delivery Outputs |
| AI Readiness Narrative | Deterministic explanation of current readiness | Workspace, Delivery Outputs |
| Critical blockers | Blocking delivery and agent-safety issues | Workspace |
| Optional improvements | Current scoring improvement list | Workspace |
| MCP readiness section | MCP governance and tool risk | Enterprise Add-ons |
| Agent pack tabs | Generated AGENTS, CLAUDE, prompts, testing strategy | Project Memory, Context / Routing |
| Repo context pack copy/export | Sanitized context pack | Project Memory |
| Recent scans | Local metadata history | Timeline |

## Future Grouping

### Workspace

Primary purpose:

- answer "How good is this AI workspace right now?"

Candidate content:

- Workspace Quality
- Repository Friction
- top workspace action
- scan evidence
- measurement boundary

### Project Memory

Primary purpose:

- show what durable project context agents can reuse.

Candidate content:

- compact project facts
- existing instruction files
- generated memory files
- Repo Context Pack
- folder-level AGENTS recommendations

### Context / Routing

Primary purpose:

- show how agents should enter, navigate, and constrain work.

Candidate content:

- Context Efficiency
- Agent Operating Mode
- future Agent Routing
- task routes
- high-signal and low-signal paths

### Delivery Outputs

Primary purpose:

- export client-ready and agent-ready artifacts after workspace understanding.

Candidate content:

- Delivery Pack preview
- PDF/HTML report
- `score.json`
- manifest
- client handoff report
- AI Act readiness notes with "not legal advice"
- testing and red-team files

### Enterprise Add-ons

Primary purpose:

- hold advanced governance, integrations, and organization workflows.

Candidate content:

- MCP readiness
- GitHub App readiness PR
- future Review Council
- future audit logs
- future white-label exports

## Screen-Level Redesign Notes

### Workspace Overview

Show one primary action and one primary diagnosis:

- AI Workspace Quality or bridge metric
- Repository Friction
- top recommended action
- scan source and boundary

Keep delivery exports visible but secondary.

### Workspace Quality

Show dimensions with concise evidence:

- Repository Intelligence
- Project Memory
- Context Efficiency
- Agent Routing
- Verification/Delivery readiness as supporting evidence

### Repository Friction

Show inverse quality signals:

- duplicate knowledge
- oversized files
- generated/vendor noise
- unclear ownership
- ambiguous routes
- hidden commands

### Project Memory

Show what agents can reuse:

- compact memory
- existing instruction files
- generated memory candidates
- missing stable facts

### Agent Simulator

Planned only. Do not implement in this sprint.

Future purpose:

- likely first files
- likely ignored folders
- estimated context reduction
- explanation of routing decisions

### Heatmap

Planned only. Do not implement in this sprint.

Future purpose:

- folder-level repository friendliness
- evidence on hover
- friction hotspots

### Timeline

Planned only. Do not implement in this sprint.

Future purpose:

- AI Workspace Quality over scans
- Context Efficiency over scans
- Repository Friction over scans
- Project Memory Coverage over scans

### Delivery Outputs

Keep existing functionality:

- Delivery Pack ZIP
- PDF/HTML report
- `score.json`
- manifest
- readiness PR flow

The page should present these as outputs generated by the workspace engine, not as the core product.

## Non-Goals For This Plan

- No Live Agent Simulator implementation.
- No Agent Heatmap implementation.
- No Context Timeline implementation.
- No scoring weight changes.
- No Repository Health calculation changes.
- No Delivery Pack removal.
- No GitHub PR behavior changes.
- No new dependencies.

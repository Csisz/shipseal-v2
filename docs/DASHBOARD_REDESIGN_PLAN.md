# Dashboard Redesign Plan

Last updated: 2026-07-04

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

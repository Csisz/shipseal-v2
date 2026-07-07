# Workspace Transformation Plan

Last updated: 2026-07-04

## Purpose

This plan identifies where Repository Health is currently treated as the main product score and defines a safe migration path toward AI Workspace Quality.

No scoring weights, Repository Health calculation, Delivery Pack behavior, GitHub PR behavior, `score.json`, or manifest compatibility are changed by this plan.

## Current Main Score Locations

| File | Current behavior | Transformation note |
| --- | --- | --- |
| `src/components/agentready/ResultDashboard.tsx` | `RepositoryHealthHero` is the first dashboard section. It renders Repository Health score, status, confidence, top action, and export actions. | Replace with Workspace Overview in a future sprint. Keep Repository Health as supporting evidence. |
| `src/components/agentready/ResultDashboard.tsx` | Text says "Repository Health reflects the scanned repository..." and "Repository Health is the primary dashboard summary above." | Reframe to "Workspace Quality is the product headline; Repository Health is the repository-state evidence layer." |
| `src/components/agentready/ResultDashboard.tsx` | `RepositoryHealthActions`, `RepositoryHealthDimensions`, and `MeasurementBoundary` follow the hero. | Move these under Repository Friction or Evidence in the future dashboard IA. |
| `src/test/resultDashboardSummary.test.tsx` | Test explicitly asserts "makes Repository Health the primary dashboard summary." | Replace only when UI hierarchy changes. This test is a marker for the bridge state. |
| `src/lib/exports.ts` | `score.json` includes root readiness score and nested `repositoryHealth`. Manifest metadata includes Repository Health score/status. | Preserve schema v2. Add future `workspace` object additively before any root score change. |
| `src/lib/types.ts` | `ReadinessReport` contains root `score`, `level`, `isReady`, and `repositoryHealth`. | Keep as current report contract. Future workspace model should wrap or reference this report instead of mutating score semantics. |
| `src/lib/deliveryPack/generator.ts` | `REPOSITORY_HEALTH.md` describes Repository Health as "ShipSeal's primary AI Repository Intelligence summary." | Later update to "supporting repository-state summary" once Workspace Quality exists. |
| `src/lib/repoContextPack.ts` | Repo Context Pack includes Repository Health summary/top actions/boundary. | Keep as compact evidence for agents. Future Project Memory should reference this as one signal. |
| `src/lib/report/clientReportHtml.ts` | Client report surfaces Repository Health before delivery readiness score. | Future report order should be Workspace Quality, Repository Friction, Delivery Outputs. |
| `src/test/clientReportHtml.test.ts` | Tests expect Repository Health sections in reports. | Preserve until report redesign. |
| `src/test/deliveryPackExport.test.ts` | Tests expect `REPOSITORY_HEALTH.md`, manifest v2, and score.json Repository Health parity. | Preserve as Delivery Output compatibility. |

## Target Product Hierarchy

1. AI Workspace Quality
2. Repository Friction
3. Project Memory
4. Context Efficiency
5. Agent Productivity
6. Repository Health as supporting evidence
7. Delivery Outputs

## Safe Migration Sequence

### Stage 1 - Foundation

Status: started in Sprint Omega.3.

- Add central workspace terminology and types.
- Document current positioning drift.
- Keep all current score and export contracts intact.

### Stage 2 - Additive Workspace Model

- Build an `AiWorkspaceModel` from existing scan, Repository Health, context pack, Delivery Pack focus, and agent operating mode signals.
- Do not change root `ReadinessReport.score`.
- Add `workspace` to internal models and possibly `score.json` schema v3 as an additive field.

### Stage 3 - Dashboard Bridge

- Introduce Workspace Overview above Repository Health.
- Show AI Workspace Quality as "coming from static workspace signals" only after the model is implemented.
- Keep Delivery Readiness and Repository Health visible through progressive disclosure.

### Stage 4 - Product Score Migration

- Decide whether AI Workspace Quality becomes the root score in a new schema.
- If yes, keep legacy readiness under `legacyReadiness` and preserve old fields for compatibility.
- Update tests, reports, manifests, and docs together.

### Stage 5 - Advanced Experiences

- Implement Agent Simulator, Heatmap, and Timeline only after the foundation score and dashboard hierarchy are stable.

## Architectural Decisions

- Repository Health remains the current bridge metric.
- AI Workspace Quality should not be a rename of Repository Health.
- Delivery readiness remains a deterministic compatibility score.
- Delivery Packs remain export artifacts generated from the workspace engine.
- MCP Readiness remains a separate governance dimension.
- No actual token savings, billing savings, or speed claims should be introduced without measurement.

## Compatibility Requirements

- `score.json` root `score`, `status`, `isReady`, and `categories` remain unchanged for schema v2.
- `legacyReadiness` remains unchanged.
- `repositoryHealth` remains available in `ReadinessReport`, `score.json`, Repo Context Pack, reports, and Delivery Pack exports.
- Manifest v2 and `07-context/REPOSITORY_HEALTH.md` remain intact.
- Readiness PR endpoints and branch behavior remain unchanged.

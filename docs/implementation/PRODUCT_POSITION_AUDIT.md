# Product Position Audit

Last updated: 2026-07-04

## Purpose

This audit identifies places where ShipSeal is still framed mainly as a readiness tool, audit tool, report generator, or Delivery Pack generator. It supports the Sprint Omega.3 transition toward ShipSeal as an AI Workspace Optimizer.

Source documents reviewed:

- `docs/THE_AI_WORKSPACE_BOOK_v0.75.md`
- `docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md`
- `docs/SELLABLE_PRODUCT_BACKLOG.md`
- current README, product docs, dashboard copy, export/report code, and related tests

## Current Positioning State

ShipSeal is in a bridge state.

The newest product docs already point toward AI Workspace Optimization, Repository Intelligence, Project Memory, Context Compression, and Agent Efficiency. The implemented product and many compatibility contracts still use readiness, Repository Health, Delivery Pack, score, report, and PR language because those are the working MVP outputs.

This is acceptable for the transition, but future work should make the hierarchy explicit:

1. AI Workspace Optimizer is the product.
2. AI Workspace Quality is the future primary score.
3. Repository Health is the current bridge metric and later supporting metric.
4. Delivery Packs, reports, manifests, `score.json`, and readiness PRs are outputs.

## Audit Findings

| Area | Current language | Risk | Recommended treatment |
| --- | --- | --- | --- |
| `README.md` demo flow | "calculates a deterministic ShipSeal score", "readiness signal", "Review the ShipSeal score, go/no-go status" | Keeps the demo anchored on readiness and handoff decisions. | Keep for MVP compatibility, but add AI Workspace Quality as the future headline in the next README refresh. |
| `README.md` What Works Now | "Deterministic readiness rule", "Sample report", "Delivery Pack export" | Describes outputs more strongly than workspace optimization. | Reorder around Repository Intelligence, Project Memory, Context Compression, and Agent Productivity. |
| `docs/ARCHITECTURE.md` | "readiness reports are generated locally", "Main readiness remains..." | Architecture still centers readiness as the analysis product. | Add an AI Workspace Foundation section and keep readiness as legacy/delivery compatibility. |
| `docs/SELLABLE_PRODUCT_BACKLOG.md` | "client-ready, agent-ready delivery packages", "Is this project ready to hand over?" | Backlog still opens with the older delivery/readiness promise. | Update Product Positioning to name AI Workspace Optimizer first, with Delivery Pack as an output. |
| `docs/DEMO_SCRIPT.md` | AgentReady and deterministic readiness score language | Demo narrative is from the old category. | Rewrite in a future demo sprint around "Stop wasting AI context" and workspace optimization. |
| `docs/CREATE_READINESS_PR_PLAN.md` | "readiness files", "future scans", "readiness score" | PR flow is named and scoped around readiness. | Keep endpoint/behavior stable. Future copy can describe "workspace optimization PR" while retaining existing API names. |
| `src/components/agentready/ResultDashboard.tsx` | Repository Health is the hero and "primary dashboard summary" | Repository Health is acting as main product score. | Do not change this sprint. Plan a future Workspace Overview where Repository Health becomes supporting evidence. |
| `src/components/agentready/DeliveryPackPreview.tsx` | "ShipSeal score" and Delivery Pack compatibility copy | Score appears as the main value in export preview. | Keep for export compatibility. Later show Workspace Quality first and delivery readiness second. |
| `src/lib/types.ts` | `ReadinessReport`, root `score`, `isReady`, `ReadinessLevel` | Core report type still defines readiness as the root object. | Keep for schema v2. Add workspace domain model alongside it before migrating schema. |
| `src/lib/exports.ts` | root `score`, `status`, `legacyReadiness`, Delivery Pack manifest | `score.json` compatibility depends on legacy readiness roots. | Preserve. Future schema v3 may add `workspace` while retaining legacy roots. |
| `src/lib/deliveryPack/generator.ts` | `REPOSITORY_HEALTH.md`, Delivery Manifest, client reports | Delivery output is already well structured but can read as the product. | Keep as Delivery Outputs layer in the workspace engine. |
| `src/test/resultDashboardSummary.test.tsx` | test named "makes Repository Health the primary dashboard summary" | Test locks current bridge hierarchy. | Leave unchanged until the dashboard redesign sprint. Add plan coverage now. |
| `src/test/readiness.test.ts` | readiness thresholds and AgentReady Certified tests | Legacy readiness rules are protected by tests. | Preserve until explicit score/schema migration. |

## Positive Alignment Already Present

- `README.md` now opens with "AI Repository Optimization Platform."
- `docs/POSITIONING.md` explicitly says ShipSeal should not be positioned primarily as an audit tool or only a Delivery Pack generator.
- `docs/MESSAGING.md` already anchors on "Stop wasting AI context."
- `docs/SHIPSEAL_VISION.md` describes Delivery Packs as outputs rather than identity.
- `docs/SHIPSEAL_BOOK.md` already defines ShipSeal as an AI Workspace Optimizer.
- Repository Health v1 already measures Repository Intelligence, Context Waste, AI Development Readiness, Agent Routing, and Delivery Confidence without changing delivery readiness scoring.

## Language To Retire Or Reframe

Avoid as primary positioning:

- readiness tool
- audit tool
- report generator
- Delivery Pack generator
- founder-reviewed audit
- production security audit
- legal compliance tool

Keep as bounded output or compatibility language:

- delivery readiness
- readiness PR
- Delivery Pack
- score.json
- client handoff report
- AI Act readiness notes, with "not legal advice" retained

## Recommended Copy Hierarchy

Primary:

- ShipSeal is an AI Workspace Optimizer.
- ShipSeal turns repositories into AI-optimized workspaces for coding agents.
- ShipSeal builds Repository Intelligence, Project Memory, Context Compression, Agent Routing, and AI Workspace Analytics.

Secondary:

- Delivery Packs, reports, manifests, score exports, and readiness PRs are Delivery Outputs generated from the workspace engine.

Compatibility:

- The current root ShipSeal score remains the deterministic delivery/readiness score until an explicit schema migration.
- Repository Health remains the current bridge dashboard summary until AI Workspace Quality is implemented.

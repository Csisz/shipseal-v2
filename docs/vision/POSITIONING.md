# ShipSeal Positioning

Last updated: 2026-07-14

This is the canonical source of truth for ShipSeal product direction and hierarchy. The canonical implementation contract for the primary paid outcome is `docs/implementation/REPOSITORY_INTELLIGENCE_PR_SPEC.md`.

## Primary product promise

> ShipSeal helps AI coding agents understand and work inside a repository more effectively.

ShipSeal scans a repository, identifies where coding agents will struggle, explains findings with concrete repository evidence, generates repository-specific workspace improvements, applies selected improvements through a reviewed GitHub PR, and verifies detected changes after a rescan.

## Category and identity

Primary identity:

**AI repository intelligence and AI workspace improvement.**

Approved category language:

- AI Repository Intelligence Platform
- AI repository optimization platform
- the repository-understanding layer between a Git repository and AI coding agents

ShipSeal improves the repository as an agent workspace. It does not replace Claude Code, Codex, Cursor, Windsurf, GitHub Copilot, or similar tools.

## Product hierarchy

### Primary paid outcome

**Repository Intelligence PR**

The PR contains repository-specific workspace knowledge and instructions derived from actual structure, source responsibilities, commands, relationships, and risks. It is reviewed before merge and must not be a collection of generic templates.

### Signature experience

**Repository Universe**

Repository Universe is preserved as:

- visual proof that ShipSeal understood the repository;
- an exploratory interface backed by repository evidence;
- a memorable ShipSeal experience and launch/marketing asset;
- an optional, lazy-loaded advanced surface.

It is not the main paid output, is not removed or deprecated, and does not need major new functionality during the Repository Intelligence PR implementation sprints.

### Secondary commercial output

**Client Handoff Pack**

Client handoff remains available after repository understanding as an export path. It does not compete with AI repository intelligence in the landing-page hero or first promise.

### Supporting outputs

Delivery Packs, PDF/HTML reports, security notes, testing outputs, MCP guidance, AI Act documentation, readiness signals, manifests, and `score.json` remain valid supporting outputs and compatibility contracts. They are not separate top-level product identities.

## Initial target

Deep Repository Intelligence is optimized first for JavaScript and TypeScript application repositories, especially React, Vite, Next.js, Node.js, Express, and similar stacks.

Other stacks continue to receive the current deterministic scan. ShipSeal must not imply equivalent deep-generation quality before a stack has been validated.

## Quality rule

> Generated files must describe the actual code structure, responsibilities, commands, relationships and risks of the scanned repository. Generic best-practice templates are not sufficient.

Every factual generated statement must be traceable to repository evidence. Unsupported claims are rejected or clearly marked as limitations/inferences; they are not presented as verified.

## Target users

- AI freelancers and consultants
- small AI agencies
- indie SaaS builders
- teams maintaining AI-generated or AI-assisted applications
- builders using AI coding agents for repeated repository work

## What ShipSeal is not

ShipSeal is not primarily:

- an audit or founder-review service;
- a generic report or Delivery Pack generator;
- a legal compliance or production security tool;
- a code-execution service;
- a generic instruction-template generator.

Applicable client-facing governance outputs retain the boundary: **This is not legal advice.**

## Packaging direction

The free experience provides deterministic scanning, evidence-backed friction findings, and a preview of improvement opportunities. The paid value centers on the reviewed Repository Intelligence PR. Client Handoff and supporting exports can be packaged alongside or after that outcome.

Authentication, payment entitlements, persistence, public sharing, and badges are later commercial-foundation work and do not redefine the product promise.

# Claude Instructions For ShipSeal

Use this file when Claude or another coding agent works in this repository.

## Default Workflow

1. Read the relevant source files before editing.
2. Keep the sprint scope small.
3. Implement the smallest safe change.
4. Run:

```bash
npm run test
npm run build
```

5. Summarize changed files and any remaining risks.

## Do Not Change Without Human Review

- Scanner safety limits.
- Delivery Pack manifest paths.
- ZIP export structure.
- GitHub archive proxy behavior.
- PDF/report generation dependencies.
- Package dependencies.
- Vercel routing.
- Legal/security disclaimer wording.

## ShipSeal-Specific Context

ShipSeal generates client-ready delivery assets for AI projects:

- Agent instructions.
- Skills pack.
- MCP governance.
- Eval and red-team tests.
- AI Act readiness pre-screen.
- Client handoff report.
- Print-ready HTML report and PDF report.

The app is an MVP. It is not legal advice, not a production security audit, and not a compliance certification.

## Validation Notes

- ZIP upload must keep working.
- Public GitHub import should call `/api/github-archive` first in hosted/Vercel mode.
- Delivery Pack export must stay deterministic.
- Client report should remain readable for non-developer clients.

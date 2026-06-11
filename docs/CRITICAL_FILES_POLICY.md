# Critical Files Policy

ShipSeal agents and contributors must treat these files as critical.

## Critical Files

- `src/lib/scanner.ts`
- `src/lib/scannerLimits.ts`
- `src/lib/exports.ts`
- `src/lib/deliveryPack/**`
- `src/lib/report/**`
- `src/lib/github/**`
- `api/github-archive.ts`
- `package.json`
- `package-lock.json`
- `vercel.json`
- `.github/workflows/**`
- `AGENTS.md`
- `CLAUDE.md`
- `SECURITY.md`
- `docs/RELEASE_CHECKLIST.md`

## Required Review

Changes to critical files require human review because they can affect:

- Whether uploaded code remains non-executable.
- Delivery Pack ZIP structure.
- Client-facing report content.
- PDF report generation.
- Public GitHub import safety.
- Deployment behavior.
- Legal and security claims.

## Validation

Run:

```bash
npm run test
npm run build
```

For public GitHub import, also run `vercel dev` and confirm the first archive request is `/api/github-archive`.

For report changes, validate:

- `CLIENT_HANDOFF_REPORT.md`
- `CLIENT_HANDOFF_REPORT.html`
- PDF report download
- not legal advice disclaimer
- browser Print / Save as PDF fallback

# ShipSeal Release Checklist

## Local Commands

- [ ] `npm install`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run lint`

Known non-blocking warning: shadcn/ui fast-refresh warnings may appear in lint. They are existing warnings and should remain warnings only, not errors.

## Browser Manual Test

- [ ] Open the app locally with `npm run dev`.
- [ ] Open the deployed landing page.
- [ ] Confirm the landing page explains what ShipSeal does.
- [ ] Confirm footer shows `ShipSeal MVP v0.1.0-rc1`.
- [ ] Click `Try sample project`.
- [ ] Confirm the sample report is `sample-nextjs-app`, score `92`, AI Coding Ready, with zero critical blockers.
- [ ] Return to scan flow with `Scan another repo`.

## ZIP Upload Test

- [ ] Upload a small repository ZIP.
- [ ] Confirm progress steps complete.
- [ ] Confirm no uploaded code is executed.
- [ ] Confirm score, blockers, Delivery Pack preview, MCP Governance Pack, and Repo Context Pack render.
- [ ] Upload a non-ZIP file and confirm a friendly validation error.
- [ ] Cancel a scan and confirm no report is shown.

## GitHub Public Import Test

- [ ] Paste a public repo URL such as `https://github.com/owner/repo`.
- [ ] Confirm the app shows public-repo-only guidance.
- [ ] Confirm `/api/github-archive` is the first archive request in hosted/Vercel mode.
- [ ] If proxy import succeeds, confirm the normal scan flow runs.
- [ ] If proxy/direct import fails, confirm the fallback says to download the repository as ZIP and upload it manually.
- [ ] Confirm no tokens, OAuth, credentials, or private repo prompts appear.

## Deployment QA

- [ ] Vercel build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] No environment variables are required.
- [ ] `/api/github-archive?owner=Csisz&repo=shipseal&ref=HEAD` returns a ZIP response on Vercel.
- [ ] Open landing page after deploy.
- [ ] View sample report after deploy.
- [ ] Upload a valid ZIP after deploy.
- [ ] Upload an invalid ZIP after deploy.
- [ ] Test public GitHub import success or graceful fallback.
- [ ] Export ShipSeal Delivery Pack ZIP.
- [ ] Export `score.json`.
- [ ] Open HTML client report.
- [ ] Download PDF client report.
- [ ] Check mobile width.
- [ ] Check browser console for obvious runtime errors.

## Export Test

- [ ] Download `AGENT_READINESS_REPORT.md`.
- [ ] Download `score.json`.
- [ ] Download the full ShipSeal Delivery Pack ZIP.
- [ ] Download `shipseal-client-report-[project].pdf`.
- [ ] Confirm ZIP includes `01-agent-instructions/`.
- [ ] Confirm ZIP includes `03-mcp-governance/`.
- [ ] Confirm ZIP includes `07-context/REPO_CONTEXT_PACK.md` and `07-context/repo-context-pack.json`.

## Safety Checks

- [ ] Confirm uploaded/imported code is never executed.
- [ ] Confirm scan history stores metadata only.
- [ ] Confirm localStorage does not contain raw file contents, Delivery Pack file contents, or full Repo Context Pack contents.
- [ ] Confirm AI narrative does not mark a blocked repo ready.
- [ ] Confirm MCP Readiness remains separate from main Agent Readiness.
- [ ] Confirm AI Act and client report copy says this is not legal advice.

## Accessibility Basics

- [ ] Keyboard can reach scan tabs, buttons, export actions, and reset actions.
- [ ] Focus states are visible.
- [ ] Button labels are clear.
- [ ] Text remains readable on mobile widths.
- [ ] Code previews scroll instead of overflowing the viewport.

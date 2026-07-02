# ShipSeal

ShipSeal is an AI repository optimization platform that turns a codebase into an agent-ready workspace for Claude Code, Codex, Cursor, Windsurf and other AI coding agents.

ShipSeal prepares repositories for AI-native development. It helps teams stop wasting AI context, prepare the repository once, and give every coding agent compact project memory, scoped instructions, and safer operating boundaries.

The current demo-ready MVP scans a repository ZIP or GitHub repository, calculates a deterministic ShipSeal score, explains the readiness signal, and generates AI workspace outputs such as Agent Cost Optimizer guidance, Context Compression, folder-level `AGENTS.md` recommendations, Specialized Context Packs, Skill and MCP recommendations, and a Delivery Pack export with reports, manifests, tests, AI Act readiness notes, repo context, and `score.json`.

ShipSeal analyzes repository structure and metadata. It does not execute uploaded or imported code.

## What Works Now

- ZIP upload scanning in the browser.
- Public GitHub repo import when browser ZIP fetch is available, with a Vercel same-origin proxy option for hosted demos.
- Graceful manual ZIP fallback when GitHub import fails.
- Sample report for `sample-nextjs-app`.
- Deterministic readiness rule: score >= 85 and zero critical blockers.
- AI Readiness Narrative generated locally from scan metadata.
- Agent Cost Optimizer and context compression outputs in the AI agent development package.
- Folder-level `AGENTS.md` recommendations.
- Specialized Context Packs for agent development, handoff, security/data review, testing, MCP readiness, and refactor work.
- Skill and MCP recommendations.
- ShipSeal Delivery Pack export.
- MCP governance outputs.
- Sanitized repo context preview/export.
- Full ZIP export with manifest-based Delivery Pack folders.
- Metadata-only recent scan history.

## Run Locally

```bash
npm install
npm run dev
```

Vite defaults to port `8080`. If that port is busy, Vite may choose another port.

Use `npm run dev` for frontend-only local development. Use `vercel dev` when you also need the Vercel API routes such as `/api/github-archive`, `/api/create-readiness-pr`, `/api/github-app/repositories`, `/api/github-app/archive`, `/api/github-app/create-readiness-pr`, and the legacy `/api/audit-request` contact endpoint.

If `vercel dev` shows a white page with console errors such as `GET /src/main.tsx 404`, `GET /@vite/client 404`, or `GET /@react-refresh 404`, the Vercel/Vite dev configuration is broken. `vercel.json` must use the Vite framework preset and `devCommand: "vite --host 0.0.0.0 --port $PORT"` so Vercel dev can pass its proxy port to the Vite dev server instead of serving the root `index.html` as a static file.

## How To Run The ShipSeal MVP Demo

1. Run `npm install` and `npm run dev`.
2. Open the local Vite URL shown in the terminal.
3. Upload a small non-sensitive repository ZIP or use the sample report.
4. Fill the Project Intake fields with realistic client/project details.
5. Review the ShipSeal score, go/no-go status, risks, and Delivery Pack preview.
6. Click `Download PDF report` for the client-ready PDF, or `Open HTML report` to review the standalone print-ready HTML fallback.
7. Click `Download ShipSeal Delivery Pack`.
8. Open the ZIP and review `06-client-handoff/CLIENT_HANDOFF_REPORT.md`, `06-client-handoff/CLIENT_HANDOFF_REPORT.html`, `04-testing/EVAL_TEST_CASES.md`, `04-testing/RED_TEAM_PROMPTS.md`, `05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md`, and `score.json`.
9. Run `npm run test` and `npm run build` before sharing the demo.

For the full manual checklist, see [ShipSeal Demo Validation](docs/SHIPSEAL_DEMO_VALIDATION.md).

## Public GitHub Import

ShipSeal supports best-effort public GitHub repository import in the browser. Supported examples include `https://github.com/Csisz/shipseal`, `https://github.com/Csisz/shipseal.git`, and `github.com/Csisz/shipseal`. Optional branch input is available when a known public branch should be scanned.

Local mode: ZIP upload is recommended. Direct GitHub ZIP import can be blocked by browser CORS or network restrictions because the app is trying to fetch GitHub's archive from the browser. If import is blocked, download the repository as ZIP from GitHub and upload it manually.

Hosted Vercel mode uses the same-origin proxy endpoint first: `/api/github-archive?owner=Csisz&repo=shipseal&ref=main`. If that proxy fails, the frontend can try direct codeload as a fallback, then shows the ZIP upload fallback if browser restrictions block the download. See [GitHub Import Proxy Plan](docs/GITHUB_IMPORT_PROXY_PLAN.md) for the serverless shape and security notes.

Public GitHub repositories can be scanned through public URL import. A configured GitHub App can also return selected repository metadata and use server-side installation tokens for archive download and Readiness PR creation. Without GitHub App server env, the connected repo UI stays honest and reports that listing is not configured.

Privacy note: uploaded ZIP scanning stays local/browser-side. ShipSeal does not execute uploaded code.

Recommended demo path:

1. Download the repository as ZIP from GitHub.
2. Upload the ZIP to ShipSeal.
3. Generate the Delivery Pack.
4. Open the HTML report and save it as PDF from the browser.

## Deploy Demo

```bash
npm install
npm run test
npm run build
npm run dev
```

For Vercel, use `npm run build` and publish the `dist` directory; the minimal serverless endpoints under `api/` are included for public GitHub archive imports, temporary-token Create Readiness PR, GitHub App repository listing/archive/PR MVP endpoints, and optional contact requests in hosted demos. No environment variables are required for the core scan/export demo.

For Netlify/static-only hosting, the app still works with ZIP upload and sample project flow, but the Vercel API endpoint is not available unless an equivalent same-origin function is implemented. See [Hosted Demo Readiness](docs/HOSTED_DEMO_READINESS.md) for the full deployment and validation checklist.

## Deploy To Vercel

```bash
npm install
npm run test
npm run build
vercel dev
vercel deploy
vercel --prod
```

Use `vercel dev` to verify the frontend and `/api/github-archive` endpoint together before publishing. In local Vite mode, public GitHub import can still hit browser CORS restrictions; in Vercel hosted mode, ShipSeal uses `/api/github-archive` first for public GitHub ZIP import.

Expected dev modes:

- `npm run dev`: Vite frontend only.
- `vercel dev`: Vite frontend plus Vercel API routes.

If `vercel dev` loads a blank page and the browser console shows missing Vite files like `/src/main.tsx`, `/@vite/client`, or `/@react-refresh`, verify that `vercel.json` still contains `framework: "vite"` and `devCommand: "vite --host 0.0.0.0 --port $PORT"`.

Private GitHub repositories require a configured GitHub App installation and server env. ZIP upload remains the stable fallback for demos and client validation. After deployment, run the [Hosted Smoke Test](docs/HOSTED_SMOKE_TEST.md).

### Contact / Request Access Form

The contact CTA opens an in-app form for product feedback, workspace optimization interest, or request-access conversations. The hosted endpoint is still `POST /api/audit-request` for compatibility, but the product offer is not a paid founder review or human audit service.

Set `CONTACT_WEBHOOK_URL` only if the hosted demo should forward contact requests to a webhook. Configure it in Vercel Dashboard -> Project Settings -> Environment Variables, then redeploy Production. If `CONTACT_WEBHOOK_URL` is not configured, the demo validates the form but returns: `Audit request form is not configured yet.`

There is no mailto fallback, database, CRM integration, or fake success state in the MVP.

## Sample / Demo Output

ShipSeal includes a dogfooding sample for a realistic `Customer Support RAG Assistant`. The sample simulates an AI support app that answers questions from a knowledge base, is used in the EU, may handle personal data, generates user-facing AI answers, and has human escalation for uncertain or sensitive cases.

Use the sample to review the quality of the generated Delivery Pack without calling an external AI API or backend service. In the UI, run a normal scan or open the sample report, then click `Load demo project` in the Project Intake panel. Download the ShipSeal Delivery Pack and review the client handoff report, print-ready HTML report, AI Act readiness files, eval/red-team tests, skills pack, MCP governance notes, repo context, and `score.json`.

To review the client report, click `Download PDF report` in the Delivery Pack preview. `Open HTML report` remains available as the standalone print-ready fallback, and `06-client-handoff/CLIENT_HANDOFF_REPORT.html` is still included in the downloaded ZIP. Printing the full dashboard is not the client-report export path. Before sending it to a client, complete the intake fields and confirm the score, risks, AI Act pre-screen, testing summary, next steps roadmap, and disclaimer are appropriate for the project.

The sample is intentionally not perfect. The generated pack should surface missing red-team documentation, transparency notice review, personal data/privacy review, MCP as a future governance item, and legal review recommendations. See [Sample Delivery Pack Review](docs/SAMPLE_DELIVERY_PACK_REVIEW.md) for the full review checklist.

## Suggested Readiness Fix Pack

After a scan, ShipSeal shows a Suggested Readiness Fix Pack with repository files that can improve future readiness scans: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, ownership docs, critical file policy, release checklist, and CI workflow.

These files can be previewed, copied, downloaded as a separate `shipseal-readiness-fix-pack-[repo].zip`, or used to create a reviewed GitHub Pull Request. ShipSeal never pushes directly to `main`.

Delivery Pack and Readiness Fix Pack are intentionally separate:

- Delivery Pack: client handoff package with reports, AI Act readiness, testing pack and agent instructions.
- Readiness Fix Pack: repository files you can add back to your project to improve future scans and make the repo more agent-ready.

See [Readiness Fix Pack](docs/READINESS_FIX_PACK.md) for manual branch and pull request steps.

## Create Readiness PR MVP

The scan result page includes a careful `Create Readiness PR` MVP. It shows the planned branch, PR title, summary, changed files, readiness areas, safety note, workflow-file warning, GitHub connection state, and manual Git fallback.

The recommended path is a connected GitHub App repository. When the scan source includes a GitHub App `installationId`, owner, and repo, ShipSeal can create the Readiness PR via `POST /api/github-app/create-readiness-pr` with a server-side installation token. The user does not paste a token in this path, and the installation token is not returned to the browser.

Advanced / Developer mode still supports a GitHub fine-grained token for testing the older write flow through `POST /api/create-readiness-pr`. The token is used only for that request, is kept in memory, is not stored in `localStorage` or `sessionStorage`, and is not returned in API responses.

When a scan came from GitHub import, ShipSeal can auto-fill repository owner and name from source metadata, the parsed GitHub URL, or a repository name shaped as `owner/repo`. For ZIP uploads, those fields stay empty and editable. The base branch field can be left empty so the serverless endpoint can use the repository default branch.

ShipSeal creates a separate branch such as `shipseal/readiness-pack` or a timestamped fallback branch, uploads the Readiness Fix Pack files, and opens a Pull Request for human review. ShipSeal never pushes directly to `main`.

Recommended flow: `Connect GitHub -> select repository -> scan -> generate -> create PR`. The current GitHub App MVP uses scoped installation tokens server-side for repository listing, archive download, and PR creation. It does not store sessions or add webhook/audit-log hardening yet.

Workflow files such as `.github/workflows/ci.yml` are sensitive and should be reviewed carefully before merging. See [Create Readiness PR Plan](docs/CREATE_READINESS_PR_PLAN.md).

## Connect GitHub Roadmap

The intended production path is `Connect GitHub -> select repository -> scan -> generate Delivery Pack -> create Readiness PR`.

Repository source modes:

- GitHub App connected repo: scan + PR creation.
- Public GitHub URL: scan only + export; PR creation requires GitHub connection later.
- ZIP upload: local/browser scan + export; PR creation requires GitHub connection later or Advanced temporary token mode.

Current MVP:

- public GitHub import for scan inputs,
- temporary token mode for developer/testing PR creation,
- `Connect GitHub` opens the GitHub App install page when frontend app env is configured,
- `/api/github-app/callback` reads `installation_id` and redirects to `/?githubInstallationId=...#scan`,
- `/api/github-app/repositories` returns `not_configured` without server credentials and can list repositories when GitHub App server env is configured,
- `/api/github-app/archive` downloads the selected repository archive with a server-side GitHub App installation token,
- `/api/github-app/create-readiness-pr` creates the ShipSeal branch, writes Readiness Fix Pack files, and opens a PR with a server-side installation token,
- shared GitHub connection state tracks source mode, owner/repo, repository listing capability, and PR creation capability,
- no stored tokens,
- no session database, webhook handling, automatic merge, or direct `main` push.

Frontend demo env:

- `VITE_GITHUB_APP_SLUG`
- `VITE_GITHUB_APP_NAME` optional
- `VITE_GITHUB_APP_INSTALL_URL` optional

The primary `Connect GitHub` action opens `/api/github-app/login` and uses server-side OAuth to discover existing GitHub App installations. `VITE_GITHUB_APP_INSTALL_URL` or `VITE_GITHUB_APP_SLUG` powers the secondary `Install or configure ShipSeal GitHub App` action for first-time installation or changing repository access.

Server-side Vercel env for OAuth connect, repository listing, App archive download, and App PR creation:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_CALLBACK_URL`
- `GITHUB_API_BASE_URL` optional, defaults to `https://api.github.com`

Keep `GITHUB_APP_PRIVATE_KEY` server-side only. If Vercel stores the key on one line, preserve newlines as `\n`; ShipSeal normalizes escaped newlines before signing the GitHub App JWT.

Next:

- callback/session hardening,
- repository selection persistence across refresh,
- clearer private repository scanning UX,
- branch conflict reuse/update behavior,
- audit log for connect, scan, branch, file write, and PR events.

Later:

- private repository support through GitHub App installation,
- selected-repository access by default,
- audit log for connect, scan, branch, file write, and PR events.

See [GitHub App Connect Plan](docs/GITHUB_APP_CONNECT_PLAN.md).

### Create a GitHub App for local/demo testing

In GitHub Developer settings, create a GitHub App named something like `ShipSeal Demo`. Use the Vercel demo URL or localhost as the Homepage URL. Set the Callback URL to the future callback endpoint, such as `/api/github-app/callback`.

Repository permissions:

- Metadata: read
- Contents: read/write
- Pull requests: read/write
- Workflows: read/write optional, only if ShipSeal writes CI workflow files

Install the app only on selected repositories. For a Vercel demo, configure `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_CALLBACK_URL`, `GITHUB_APP_ID`, and `GITHUB_APP_PRIVATE_KEY` as server-side environment variables. Configure `VITE_GITHUB_APP_SLUG` and optionally `VITE_GITHUB_APP_INSTALL_URL` for the secondary install/configure action. Keep the private key and OAuth secret out of frontend env vars. OAuth callback URL should be `https://YOUR_DOMAIN/api/github-app/oauth-callback`; setup callback URL should be `https://YOUR_DOMAIN/api/github-app/callback`.

## MVP Validation Offer

The first offer to validate is simple: ShipSeal turns an AI prototype or client automation repository into an AI-optimized workspace before the next coding agent session.

Target users are AI freelancers, small AI agencies, no-code/low-code AI builders, indie SaaS teams, and consultants delivering AI automations to clients. The pilot packages being tested are Free Demo, Builder, AI Workspace Pro, and Agency / White-label.

To demo the offer, open the sample project, load the demo intake, review the context compression and agent guidance outputs, download the Delivery Pack, and walk through the client handoff report, AI Act readiness files, eval/red-team tests, skills pack, MCP governance, and `score.json`.

## Validate Locally

```bash
npm run test
npm run build
npm run lint
```

Known non-blocking lint warnings: shadcn/ui fast-refresh warnings in shared UI component files.

## Try The Demo

### View Sample Report

Click `View sample report` on the landing page. The sample demonstrates:

- `sample-nextjs-app`
- score `92`
- `AI Coding Ready`
- zero critical blockers
- Next.js / React / TypeScript stack
- Agent instructions and skills pack
- MCP governance
- Eval and red-team tests
- AI Act readiness
- Client handoff report
- Repo context pack

### Test ZIP Upload

1. Export or create a small repository ZIP.
2. Open `Upload ZIP`.
3. Drop or select the ZIP.
4. Click `Analyze repository`.
5. Review the ShipSeal score, go/no-go status, risks, included Delivery Pack files, AI Act readiness, testing status, and client handoff preview.

### Test GitHub Public Import

1. Open `Import from GitHub`.
2. Paste a public URL such as `https://github.com/owner/repo`.
3. Optionally enter a branch.
4. Click `Import public repo`.

Limitations:

- Public repositories only.
- No tokens, credentials, OAuth, or private repo access.
- Browser ZIP fetch may fail due to CORS, network policy, repo availability, branch names, or ZIP size.
- If import fails, download the ZIP from GitHub and upload it manually.

## Architecture

ShipSeal is a React/Vite/shadcn application with local-first scanning.

- `src/lib/scanEngine/`: scan engine boundary and local implementation.
- `src/lib/github/`: public GitHub URL parsing and ZIP import helper.
- `src/lib/scanner.ts`: JSZip-based metadata scanner.
- `src/lib/scoring.ts`: deterministic readiness scoring.
- `src/lib/ai/`: local deterministic AI provider boundary.
- `src/lib/agentPack.ts`: Agent Pack generation.
- `src/lib/mcpReadiness.ts`: MCP readiness and governance pack generation.
- `src/lib/repoContextPack.ts`: sanitized Repo Context Pack generation.
- `src/lib/exports.ts`: `score.json`, file downloads, and ZIP exports.
- `src/lib/scanHistory.ts`: metadata-only local scan history.

## Docs

- [Product Vision](docs/SHIPSEAL_VISION.md)
- [Positioning](docs/POSITIONING.md)
- [Messaging](docs/MESSAGING.md)
- [Documentation Inventory](docs/DOCUMENTATION_INVENTORY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Production Roadmap](docs/PRODUCTION_ROADMAP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [Demo Validation](docs/SHIPSEAL_DEMO_VALIDATION.md)
- [Hosted Demo Readiness](docs/HOSTED_DEMO_READINESS.md)
- [Public GitHub Import Validation](docs/PUBLIC_GITHUB_IMPORT_VALIDATION.md)
- [Sample Delivery Pack Review](docs/SAMPLE_DELIVERY_PACK_REVIEW.md)
- [Sample Repos](docs/SAMPLE_REPOS.md)

## Current Limitations

- No backend worker.
- No database or authentication.
- No payments.
- No private repo access or GitHub App integration.
- No external AI API calls.
- No browser API keys.
- Scan cancellation is best-effort while JSZip work is in progress.
- Main readiness and MCP readiness are heuristic and deterministic.

## Security Note

Uploaded/imported code is never executed. ShipSeal reads filenames, sizes, and selected small text/config files such as `package.json`, `README.md`, `.gitignore`, and instruction files. Secret-looking files are flagged by path. Raw uploaded file contents, downloaded ZIPs, generated packs, and full context packs are not stored in local scan history.

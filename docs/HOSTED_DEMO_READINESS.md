# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# ShipSeal Hosted Demo Readiness

This checklist is for preparing a public, hosted ShipSeal MVP demo on Vercel, Netlify, or a similar static hosting platform.

## Local Run

Frontend-only Vite dev:

```bash
npm install
npm run test
npm run build
npm run dev
```

Open the local Vite URL shown in the terminal. The default local URL is usually `http://localhost:8080`.

Vercel dev with API routes:

```bash
vercel dev
```

Use `vercel dev` when testing `/api/github-archive`, `/api/create-readiness-pr`, `/api/github-app/repositories`, `/api/github-app/archive`, `/api/github-app/create-readiness-pr`, and `/api/audit-request` together with the frontend.

If `vercel dev` opens a white page and the console shows `GET /src/main.tsx 404`, `GET /@vite/client 404`, or `GET /@react-refresh 404`, Vercel is serving the root `index.html` as a static file instead of proxying the Vite dev server. Check that `vercel.json` uses `framework: "vite"` and `devCommand: "vite --host 0.0.0.0 --port $PORT"`.

## Environment Variables

No environment variables are required for the core local-first scan/export demo.

Optional:

- `CONTACT_WEBHOOK_URL`: used by `POST /api/audit-request` to forward founder-reviewed audit requests to a configured webhook.
- `VITE_GITHUB_APP_SLUG`: enables the source-level Connect GitHub install URL.
- `VITE_GITHUB_APP_INSTALL_URL`: optional explicit GitHub App install URL.
- `VITE_GITHUB_APP_NAME`: optional display name for the GitHub App.
- `GITHUB_APP_ID`: server-side GitHub App id for repository listing, archive download, and App PR creation.
- `GITHUB_APP_PRIVATE_KEY`: server-side GitHub App private key for repository listing, archive download, and App PR creation.
- `GITHUB_API_BASE_URL`: optional GitHub API base URL, defaults to `https://api.github.com`.
- `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_WEBHOOK_SECRET`: reserved for later callback/session/webhook hardening.

If `CONTACT_WEBHOOK_URL` is configured, the in-app audit request form validates the payload and forwards it server-side. If it is not configured, the form still validates input but the endpoint returns `503` with `Audit request form is not configured yet.`

Set variables in Vercel Dashboard -> Project Settings -> Environment Variables. Redeploy Production after changing them.

Do not add OpenAI, Anthropic, GitHub private keys, Stripe, or private API keys to the client-side app. `GITHUB_APP_PRIVATE_KEY` must be server-side only. If Vercel stores the private key on one line, preserve newlines as `\n`; ShipSeal normalizes escaped newlines before creating the GitHub App JWT.

## GitHub App Callback, Repository Listing, Archive, And PR

For a hosted GitHub App demo:

1. Create a GitHub App in GitHub Developer settings.
2. Set Callback URL to `https://YOUR_DOMAIN/api/github-app/callback`.
3. Give repository permissions: Metadata read, Contents read/write, Pull requests read/write, and Workflows read/write only if workflow files are written.
4. Install only on selected repositories.
5. Set `VITE_GITHUB_APP_SLUG` or `VITE_GITHUB_APP_INSTALL_URL`.
6. Set `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` when repository listing, archive download, and App PR creation should call GitHub.

After install, GitHub returns to `/api/github-app/callback?installation_id=...&setup_action=...`. ShipSeal redirects to `/?githubInstallationId=...&githubSetupAction=...#scan`, then calls `/api/github-app/repositories?installationId=...`.

If server credentials are missing, the repository selector shows that listing is not configured. If credentials are present, ShipSeal lists `{ id, owner, name, fullName, defaultBranch, private, htmlUrl }` metadata. The selected repository can then be scanned through `/api/github-app/archive`, and the Create Readiness PR modal can create a PR through `/api/github-app/create-readiness-pr` without a pasted token. The MVP still has no session database, webhook processing, audit log, automatic merge, or direct `main` push.

## Vercel Demo Deployment

1. Import the repository into Vercel.
2. Use the default Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Keep `vercel.json`; it sets the Vite framework preset, `devCommand`, API route handling, and SPA fallback.
4. Leave environment variables empty for scan/export-only demos, or set `CONTACT_WEBHOOK_URL` if the audit request form should forward requests.
5. Deploy. Vercel should also expose the serverless endpoint at `/api/github-archive`.
6. After deployment, run the manual demo checks below and [Hosted Smoke Test](HOSTED_SMOKE_TEST.md).

## Netlify Demo Deployment

1. Create a new Netlify site from the repository.
2. Use:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Leave environment variables empty.
4. Deploy.
5. After deployment, run the manual demo checks below.

## What Works Without A Backend

- Landing/pricing validation page.
- Sample project flow.
- ZIP upload scanning in the browser.
- Public GitHub URL import through the Vercel same-origin archive proxy in hosted demos.
- Direct public GitHub URL import when browser/network rules allow fetching the public ZIP.
- Project Intake form.
- Founder-reviewed audit request form validation. Sending requires optional `CONTACT_WEBHOOK_URL`.
- ShipSeal score and preview UI.
- Delivery Pack ZIP export.
- Print-ready HTML client report.
- Browser Print / Save as PDF from the standalone HTML report.
- Metadata-only local recent scan history.

## Not Supported Yet

- Authentication.
- Payment or Stripe checkout.
- CRM integration.
- Backend worker scanning.
- Server-side AI calls.
- Persistent server storage.
- GitHub App session persistence.
- GitHub App webhook processing.
- GitHub App audit history.
- Database-backed audit history.

## Demo Flow

1. Open the hosted URL.
2. Click `Try sample project`.
3. In Project Intake, click `Load demo project`.
4. Click `Download PDF report`, then use `Open HTML report` as the Print / Save as PDF fallback if needed.
5. Click `Download ShipSeal Delivery Pack`.
6. Review `06-client-handoff/CLIENT_HANDOFF_REPORT.html` and `score.json`.
7. Return to the scan form and test ZIP upload.
8. Test public GitHub URL import with `https://github.com/Csisz/shipseal`.
9. If GitHub import fails because of CORS, browser, network, branch, size, or repository availability constraints, download the repository as ZIP and upload it manually.

## Public GitHub Import Notes

- Supported input examples:
  - `https://github.com/Csisz/shipseal`
  - `https://github.com/Csisz/shipseal.git`
  - `github.com/Csisz/shipseal`
- Optional branch input is supported when the branch name is known.
- If no branch is provided, ShipSeal requests the public GitHub archive for `HEAD`; GitHub resolves the repository default branch.
- Public GitHub import is best-effort in the browser. ZIP upload is the recommended fallback for local demos.
- A hosted Vercel public GitHub import can use the same-origin serverless proxy `/api/github-archive?owner=Csisz&repo=shipseal&ref=main`. See [GitHub Import Proxy Plan](GITHUB_IMPORT_PROXY_PLAN.md).
- Static hosts without an equivalent function should use ZIP upload for demos.

## Final Hosted Demo Checklist

- `npm run test` passes locally.
- `npm run build` passes locally.
- Hosted landing page loads.
- Footer shows `ShipSeal MVP v0.1.0-rc1`.
- Sample project opens.
- ZIP upload scan works.
- On Vercel, `/api/github-archive?owner=Csisz&repo=shipseal&ref=main` returns a ZIP response for a public repo.
- Public GitHub URL import succeeds through the proxy or fails with a clear ZIP fallback message.
- Delivery Pack ZIP downloads.
- `CLIENT_HANDOFF_REPORT.html` opens and can be saved as PDF from the browser.


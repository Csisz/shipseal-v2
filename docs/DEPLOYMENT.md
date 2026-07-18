# ShipSeal Deployment

ShipSeal can be deployed as a React/Vite application on Vercel. Netlify/static-only hosting can run the frontend, but needs an equivalent function if public GitHub proxy import should work.

## Build Settings

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none required for deterministic-only operation

## Vercel

1. Import the repository into Vercel.
2. Select the Vite framework preset if prompted.
3. Set build command to `npm run build`.
4. Set output directory to `dist`.
5. Keep the included `vercel.json` so `/api/github-archive` is handled before the SPA fallback.
6. Keep all provider and GitHub credentials server-side. Never use a `VITE_` prefix for private keys.
7. Deploy.

## Netlify

1. Import the repository into Netlify.
2. Set build command to `npm run build`.
3. Set publish directory to `dist`.
4. Leave environment variables empty for the current MVP.
5. Deploy.

## Security Notes

- The current MVP has a minimal Vercel serverless proxy for public GitHub ZIP archives.
- No API keys are required for the complete deterministic flow.
- Optional enhanced Repository Intelligence calls only the configured server provider after an explicit review-flow action.
- Uploaded/imported code is not executed.
- Anonymous recent scan history stores metadata only in browser localStorage. Account-backed projects store validated derived scan snapshots only after an explicit Save project action; repository archives and raw source are not persisted by default.

## Accounts and private project persistence

Omega 18.1 uses a dedicated GitHub OAuth App for identity and PostgreSQL for private server-side projects. Configure `DATABASE_URL`, `SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID`, `SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET`, and `SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL` only in the server environment. Apply `npm run db:migrate` before deploying, and run `npm run db:migrate:test` in validation. Static-only deployments continue to support anonymous scan/export but cannot provide durable accounts.

Sessions use opaque HTTP-only cookies; only token hashes are stored. Projects are owner-scoped and private by default. Saved snapshots contain derived validated results and safe metadata, not ZIP archives, raw provider bodies, provider keys, GitHub tokens, or environment values. Managed PostgreSQL backup retention can delay physical removal from old encrypted backups after live deletion; document the chosen provider's actual retention before launch. Full setup and migration guidance is in [Account and Project Persistence Architecture](implementation/ACCOUNT_PERSISTENCE_ARCHITECTURE.md).

## Optional Deep-Intelligence Provider

Deterministic Repository Intelligence is enabled without configuration and remains the fallback. To test the optional server provider under `vercel dev`, configure server-side values from `.env.example`: enable the provider, choose `openai-compatible`, set a model and API key, and optionally set an HTTPS base URL, bounded timeout/output/request/response limits and a non-secret environment label. Preview and production deployments use the same variables in the hosting environment; tests use mocked transport and deterministic-only development should leave the feature disabled.

The browser never receives the provider key or server adapter. `/api/repository-intelligence` accepts only the already bounded and redacted internal request. Provider failures return safe categories and leave deterministic artifacts ready for review. Do not configure the key as `VITE_*` or place it in frontend build settings.

An authorized real-provider check is opt-in: set `SHIPSEAL_DEEP_INTELLIGENCE_SMOKE=true` plus the server provider variables, then run `npm run intelligence:smoke`. It sends one small controlled fixture, validates structured output, logs metadata only, and performs no GitHub write. Never run it with paid credentials without explicit authorization.

## GitHub Import Limitations

Public GitHub import attempts browser ZIP downloads from GitHub. Browser import may fail because of CORS, network policy, repository availability, branch naming, or ZIP size limits. The supported local fallback is to download the repository as ZIP and upload it manually.

A Vercel hosted demo can use the same-origin serverless proxy at `/api/github-archive?owner=Csisz&repo=shipseal&ref=main`. Static-only hosts without an equivalent function should keep ZIP upload as the main demo path; see [GitHub Import Proxy Plan](GITHUB_IMPORT_PROXY_PLAN.md).

Private repositories require a future backend/GitHub App integration. Do not add user-pasted tokens or private credentials to the browser.

## Manual QA After Deploy

- Open the landing page.
- View the sample report.
- Upload a valid ZIP.
- Upload an invalid ZIP and confirm the friendly error.
- Try a public GitHub import and confirm `/api/github-archive` is the first archive request.
- Export the ShipSeal Delivery Pack ZIP.
- Export `score.json`.
- Check mobile width.
- Check the browser console for obvious runtime errors.
- Confirm footer shows `ShipSeal MVP v0.1.0-rc1`.
- Run [Hosted Smoke Test](HOSTED_SMOKE_TEST.md) before sharing the public link.

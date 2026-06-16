# GitHub App Connect Plan

ShipSeal's ideal production source flow should be:

Connect GitHub -> select repository -> scan -> generate Delivery Pack -> create Readiness PR.

The current MVP keeps temporary token mode for developer testing only. The recommended user flow starts at repository source selection, before scan/import, so the same GitHub connection can support repository listing, archive scanning, and Pull Request creation through a server-side GitHub App installation token.

## Repository Source Modes

- GitHub App connected repo: scan + PR creation for the selected repository.
- Public GitHub URL: public archive scan + export; PR creation requires connecting GitHub later.
- ZIP upload: local/browser scan + export; PR creation requires connecting GitHub later or using developer token fallback.

Shared connection state lives in `src/lib/githubConnection/types.ts` and tracks source mode, owner, repo, default branch, installation id, repository listing capability, and PR creation capability.

## Why GitHub App Instead Of Manual Tokens

A GitHub App is better than asking users to paste personal access tokens because:

- users can install ShipSeal on selected repositories instead of exposing broad account access,
- permissions are explicit and reviewable during installation,
- installation access tokens are generated server-side and short-lived,
- users can revoke the app installation from GitHub,
- ShipSeal does not need to store user PATs,
- the UI can list accessible repositories and create PRs without asking users to understand token scopes.

## Required GitHub App Permissions

Minimum planned permissions:

- Metadata: read
- Contents: read/write
- Pull requests: read/write

Optional permission:

- Workflows: read/write, only if ShipSeal writes `.github/workflows/ci.yml`

Workflow writes should stay visibly warned in the UI because CI workflow files are sensitive repository automation.

## Planned Flow

1. User chooses repository source.
2. User clicks Connect GitHub.
3. User installs or authorizes the ShipSeal GitHub App.
4. GitHub redirects to the callback URL.
5. Backend receives the installation id. Session hardening is still future work.
6. Backend requests an installation access token server-side.
7. UI lists accessible repositories.
8. User selects a repository.
9. ShipSeal scans the repository archive.
10. User previews generated readiness files.
11. ShipSeal creates a branch and opens a Pull Request.

## Security Rules

- Do not store user PAT tokens.
- Keep installation access tokens short-lived and server-side.
- Limit access to selected repositories.
- Never push directly to `main`.
- PR only; no automatic merge.
- Show a separate warning when a workflow file will be created or changed.
- Add an audit log later for connect, scan, branch creation, file writes, and PR creation events.

## Vercel Environment Variables

Frontend MVP configuration:

- `VITE_GITHUB_APP_SLUG`
- `VITE_GITHUB_APP_NAME`
- `VITE_GITHUB_APP_INSTALL_URL`

The primary `Connect GitHub` action opens `/api/github-app/login`, which uses server-side OAuth configuration and redirects to GitHub user authorization. The installation flow is a secondary `Install or configure ShipSeal GitHub App` action. If `VITE_GITHUB_APP_INSTALL_URL` is set, ShipSeal uses that URL for the secondary action. If it is not set but `VITE_GITHUB_APP_SLUG` is present, the frontend builds:

```text
https://github.com/apps/{slug}/installations/new
```

If neither value is configured, the secondary install/configure action is hidden. The primary Connect action still opens the server-side OAuth endpoint, which returns a friendly popup error if OAuth env is missing.

Server-side MVP configuration:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_CALLBACK_URL`
- `GITHUB_API_BASE_URL` optional, defaults to `https://api.github.com`

Planned production hardening:

- `GITHUB_APP_WEBHOOK_SECRET`

The current MVP exchanges OAuth codes only to discover GitHub App installations available to the signed-in user. It does not store sessions, handle webhooks, or persist repository selections beyond local browser state. It does generate GitHub App JWTs server-side, requests short-lived installation tokens, and uses those tokens for repository listing, archive download, and Readiness PR creation.

The repository listing MVP handles callback `installation_id`, calls `/api/github-app/repositories?installationId=...`, and returns `not_configured` when server credentials are missing. When server credentials are present, the endpoint returns minimized repository metadata only.

## Create a GitHub App For Local/Demo Testing

Use GitHub Developer settings to create a demo app:

1. Open GitHub Developer settings.
2. Create a new GitHub App.
3. Set App name to something like `ShipSeal Demo`.
4. Set Homepage URL to the Vercel demo URL or local development URL.
5. Set Callback URL to `https://YOUR_DOMAIN/api/github-app/callback`. For local Vercel dev experiments, use the matching `vercel dev` URL plus `/api/github-app/callback`.
6. Configure repository permissions:
   - Metadata: read
   - Contents: read/write
   - Pull requests: read/write
   - Workflows: read/write, optional and only needed if ShipSeal writes CI workflow files
7. Install only on selected repositories.
8. Copy the app slug from the GitHub App URL and set `VITE_GITHUB_APP_SLUG`.
9. Optionally set `VITE_GITHUB_APP_INSTALL_URL` if the demo should use a fixed install URL.

For Vercel demo testing, add the frontend env vars in Vercel Project Settings -> Environment Variables, then redeploy. Add `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` when repository listing, archive download, and App-based PR creation should call GitHub for real. Store the private key only as a server-side Vercel env var. If Vercel stores the key on one line, preserve newlines as `\n`; ShipSeal normalizes escaped newlines before signing the GitHub App JWT.

Local frontend-only Vite can open the install URL and read callback query params, but API routes such as callback and repository listing require `vercel dev` or a deployed Vercel function.

## MVP Endpoints

The current codebase uses these API route locations:

- `GET /api/github-app/start`
- `GET /api/github-app/callback`
- `GET /api/github-app/repositories`
- `GET /api/github-app/archive`
- `POST /api/github-app/create-readiness-pr`

`/api/github-app/callback` now redirects back to `/?githubInstallationId={installation_id}&githubSetupAction={setup_action}#scan`. The installation id is not an access token; it lets the frontend request repository listing from the backend.

`/api/github-app/start` remains a `501 not_implemented` placeholder because the frontend opens the GitHub install URL directly in this MVP.

`/api/github-app/repositories` returns `501 not_configured` without server credentials. With credentials, it requests an installation access token server-side and returns repositories as `{ id, owner, name, fullName, defaultBranch, private, htmlUrl }`.

`/api/github-app/archive` downloads a selected repository zipball with the installation token and streams the ZIP back to the frontend. It validates owner, repo, ref, installation id, and archive size.

`/api/github-app/create-readiness-pr` creates a `shipseal/...` branch, writes the Readiness Fix Pack files, and opens a Pull Request with the installation token. It rejects direct target branches such as `main`, `master`, `develop`, and `trunk`, and it never returns the installation token.

The next milestone should harden callback/session state, improve private repository scanning UX, add PR conflict reuse/update behavior, and add audit logging.

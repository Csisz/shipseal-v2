# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# GitHub Import Proxy Plan

ShipSeal currently supports ZIP upload as the most reliable local MVP path. Public GitHub URL import is useful for demos, but a browser-only app cannot reliably fetch repository archives from `codeload.github.com` because GitHub archive downloads may be blocked by browser CORS policy, redirects, network policy, or response headers outside ShipSeal's control.

This is not a scanner failure. When direct import is blocked, the supported fallback is:

1. Open the public repository on GitHub.
2. Use `Code` -> `Download ZIP`.
3. Upload the ZIP to ShipSeal.
4. Generate the Delivery Pack and print-ready HTML report.

## Why ZIP Upload Works

ZIP upload uses a local file selected by the user. ShipSeal scans repository structure and metadata in the browser and does not execute uploaded code. No GitHub fetch is required, so CORS does not apply.

## Vercel Serverless Proxy MVP

Hosted Vercel demos can use the same-origin endpoint in `api/github-archive.ts`. It fetches the public GitHub archive server-side and returns the ZIP to the browser with `application/zip`.

Endpoint shape:

```text
/api/github-archive?owner=Csisz&repo=shipseal&ref=main
```

Expected behavior:

- Validate `owner`, `repo`, and optional `ref`.
- Fetch only from GitHub public archive endpoints.
- Return the ZIP response back to the browser.
- Return clear errors for repo not found, ref not found, size limit, rate limit, and unknown failures.
- Do not store ZIP archives persistently.

## Security Rules

- Allow only `github.com` / GitHub archive sources.
- Support only public repositories in the MVP.
- Do not use GitHub tokens for MVP import.
- Do not support private repositories.
- Enforce a maximum ZIP size before scanning.
- Keep scanner-side max file count and safety limits.
- Add stronger rate limiting before production use.
- Do not log sensitive URL query data beyond minimal operational metadata.
- Do not persist downloaded archives.

## Current MVP Status

The code is prepared with:

- Proxy-first frontend import: `/api/github-archive` is attempted before direct `codeload.github.com`.
- Direct browser codeload import remains as a fallback after proxy failure.
- Same-origin proxy import for hosted Vercel demos.
- Error categories for invalid URL, unsupported host, network/CORS blocked, repo not found, branch/ref not found, and unknown import errors.
- A proxy URL builder for `/api/github-archive?owner=&repo=&ref=`.
- A minimal Vercel-compatible endpoint at `api/github-archive.ts`.

This is still an MVP endpoint. It is public-repo-only, tokenless, and not a GitHub App.


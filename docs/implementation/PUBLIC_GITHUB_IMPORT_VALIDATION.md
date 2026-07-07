# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# Public GitHub Import Validation

Use this checklist to validate the public GitHub URL import path for hosted demos and local demos.

## Test URL

Use:

```text
https://github.com/Csisz/shipseal
```

Also test:

```text
https://github.com/Csisz/shipseal.git
github.com/Csisz/shipseal
```

## Manual Steps

1. Run the app locally or open the hosted demo.
2. Go to the scan area.
3. Select `Import from GitHub`.
4. Paste `https://github.com/Csisz/shipseal`.
5. Leave branch empty for the default branch, or enter a known public branch such as `main` if needed.
6. Click `Import public repo`.
7. Wait for the import and scan flow to complete.

## Vercel Proxy Smoke Test

For a Vercel hosted demo, open:

```text
/api/github-archive?owner=Csisz&repo=shipseal&ref=main
```

Expected result: the endpoint returns an `application/zip` response for the public repository archive. If this endpoint is unavailable, use ZIP upload for the demo.

## Expected Result

- The scan runs or fails with a clear fallback message.
- Repository name is recognizable as `Csisz/shipseal`.
- Source metadata uses `sourceType = github-url`.
- GitHub owner and repo metadata are preserved.
- Delivery Pack export works.
- `06-client-handoff/CLIENT_HANDOFF_REPORT.html` is generated.
- `score.json` includes GitHub source metadata.

## Expected Fallback Message

If GitHub import is blocked or unavailable, the UI should explain:

```text
Browser restrictions blocked the GitHub ZIP download. Download the repository as ZIP from GitHub and upload it manually.
```

The GitHub tab should also show:

```text
Local MVP note: if GitHub import is blocked, use Download ZIP on GitHub and upload it here.
```

This fallback is acceptable for the MVP. Browser-based public GitHub import can fail because of CORS, network restrictions, repository availability, branch naming, redirects, or ZIP size limits.

## ZIP Fallback Validation

1. Download the public repository ZIP from GitHub.
2. Switch to `Upload ZIP`.
3. Upload the ZIP manually.
4. Confirm the scan completes.
5. Confirm the Delivery Pack ZIP export works.
6. Confirm `CLIENT_HANDOFF_REPORT.html` is present in the exported Delivery Pack.

## Not In Scope

- Private repository import.
- GitHub App installation.
- OAuth.
- User-pasted tokens.
- Private repository backend proxying. The current proxy is public-repo-only and documented in [GitHub Import Proxy Plan](GITHUB_IMPORT_PROXY_PLAN.md).
- Server-side GitHub workers.


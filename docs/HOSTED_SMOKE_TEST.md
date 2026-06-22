# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# ShipSeal Hosted Smoke Test

Use this checklist before sharing a public Vercel demo link.

Version expected in the footer: `ShipSeal MVP v0.1.0-rc1`.

## A. Basic App Check

1. Open the public demo URL.
2. Confirm the landing page loads.
3. Confirm the browser title contains `ShipSeal`.
4. Confirm the ShipSeal favicon appears.
5. Click `Generate Delivery Pack` or the scan CTA and confirm it scrolls to the scan area.
6. Confirm there is no Lovable or Base44 branding in the visible app chrome.

## B. ZIP Upload Smoke Test

1. Download or prepare a small non-sensitive repository ZIP.
2. Select `Upload ZIP`.
3. Upload the ZIP and start the scan.
4. Confirm the scan completes.
5. Confirm the ShipSeal score appears.
6. Confirm `Download ShipSeal Delivery Pack` is available.
7. Download the Delivery Pack ZIP.
8. Confirm `score.json` is present in the ZIP.

## C. Public GitHub Import Smoke Test

Test URL:

```text
https://github.com/Csisz/shipseal
```

Expected result:

1. Select `Import from GitHub`.
2. Paste the test URL.
3. Leave branch empty unless testing a specific branch.
4. Open DevTools Network tab.
5. Click `Import public repo`.
6. Confirm the first GitHub archive request is `/api/github-archive?owner=Csisz&repo=shipseal&ref=HEAD`.
7. Confirm the first request is not direct `https://codeload.github.com/...`.
8. Confirm the scan completes.
9. Confirm source metadata is shown as GitHub URL source where visible.
10. Confirm Delivery Pack export works.

## D. Client Report Smoke Test

1. After a scan, fill the Project Intake fields with realistic demo details.
2. Click `Download PDF report`.
3. Confirm `shipseal-client-report-[project].pdf` downloads.
4. Click `Open HTML report` and confirm browser `Ctrl+P` / `Save as PDF` remains available as fallback.
5. Confirm this is the client report export path, not dashboard printing.

## E. Failure Smoke Test

1. Try an invalid GitHub URL such as `not a repo`.
2. Confirm the app shows an understandable invalid URL error.
3. Temporarily test a missing branch or unavailable repo if needed.
4. Confirm GitHub import failure explains the ZIP upload fallback:

```text
Download the repository as ZIP from GitHub and upload it manually.
```

## Known Demo Boundaries

- Private GitHub repositories are not supported.
- No GitHub App, OAuth, tokens, auth, payment, database, persistent storage, or server-side AI is included.
- ZIP upload remains the stable fallback path.
- The print-ready report is standalone HTML intended for browser Save as PDF.


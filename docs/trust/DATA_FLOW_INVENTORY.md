# ShipSeal Data-Flow Inventory

Status: implementation audit for Ω.21. Human legal and vendor review is still required.

This inventory describes the current repository. It is not a promise about an unreviewed deployment configuration.

## Data categories

| Data category | Source | Purpose / processing location | Persisted by ShipSeal? | Third party | Deletion / retention behavior | Public disclosure |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub account identity | GitHub OAuth scopes `read:user user:email` | API callback verifies identity and creates an account | GitHub subject ID, returned email, display name, avatar URL; OAuth token is not persisted | GitHub | Account deletion nulls profile fields, replaces provider subject, and marks the row deleted; anonymized row remains | Privacy; GitHub permissions |
| Account session | ShipSeal login | Opaque cookie in browser; SHA-256 token hash in PostgreSQL | Yes, for 14 days unless revoked | Hosting/database provider | Logout revokes the session; account deletion removes sessions | Privacy; Security |
| GitHub App installation identity | GitHub App callback / browser selection | Browser selects installation; API obtains short-lived installation tokens | Installation ID may be in browser local storage and project metadata; installation access token is not persisted in project data | GitHub | Browser storage can be cleared; project/account deletion removes ShipSeal copies; GitHub installation remains until removed in GitHub | Privacy; GitHub permissions |
| Repository metadata and paths | GitHub tree or ZIP central directory | Static discovery, classification, evidence selection, scoring, maps | Paths, sizes, repository identity, branch/ref, coverage, and derived evidence can be in saved scan snapshots | GitHub for connected/public sources | Scan/project/account deletion as described in product; no automatic age window | Privacy |
| Selected source excerpts | Selected GitHub blobs or browser ZIP entries | Deterministic scan in browser; server preparation and AI transmission after explicit Deep Analysis | Original `RepoScanInput.textContents` is not part of the saved project snapshot. Validated AI stage/results may contain short evidence-derived material | GitHub; configured AI provider for Deep Analysis | Provider retention is contract-dependent. Canonical results remain until account deletion; project/scan deletion does not remove account-level AI operations | Privacy; Trust |
| Uploaded ZIP archive | User browser | Random-access central-directory discovery and selective browser decompression | The archive itself is not uploaded or stored by deterministic scanning | None for deterministic scan | Browser/file lifetime; no ShipSeal server copy from the deterministic scan | Privacy; scan entry |
| Deterministic intelligence | Browser scan engine | Scoring, evidence, Repository Intelligence, Universe, exports | Authenticated completed scans autosave a validated derived report snapshot | Hosting/database provider | Until scan/project/account deletion; no automatic age window | Privacy; Trust |
| Future analysis output | Configured AI provider plus server validation | Root/expansion stages, deterministic merge/finalization, durable recovery | Validated stage caches and canonical complete result in AI operation records | Configured OpenAI-compatible endpoint | Until account deletion; preserved across scan/project deletion for billing/recovery integrity | Privacy; Deep Analysis disclosure |
| AI usage and diagnostics | ShipSeal server | Entitlement, reservation, stage lease, provider permit, completion/refund integrity | Operations, stages, ledger/adjustments, fingerprints, safe categories, timings and counters | Hosting/database; AI provider receives prepared request | Until account deletion for owner records; global anonymous budget records can remain operational | Privacy; account usage |
| Operational logs | API functions | Safe request/stage/provider outcomes and timing; repository identities are fingerprinted where logged | Hosting logs, not a ShipSeal application table | Hosting provider | Deployment/provider-configured; no duration encoded in repository | Privacy; Security |
| Launch pageviews | Browser on approved routes | Vercel Web Analytics receives anonymous aggregate pageviews and can derive referrer, country, device, browser, and operating-system dimensions after client-side route filtering | Vercel-managed aggregate analytics; ShipSeal sends no persistent visitor ID | Vercel Web Analytics | Plan/provider-configured; query strings are removed, sensitive routes are suppressed, and project/scan IDs are replaced with placeholders before sending | Privacy |
| Campaign funnel signals | Browser interaction through `POST /api/feedback` | Counts `demo_started`, `scan_completed`, `future_explored`, `signup_intent`, and `upgrade_intent` with product surface and optional allowlisted first-touch UTM dimensions | Safe operational-event row; a signed-in signal can include the existing internal account ID, while first-touch attribution is held only in browser session storage | Hosting/database provider | Session attribution ends with the browser tab; no automatic database age window is encoded | Privacy |
| Project/contact form draft | User browser | Builds a `mailto:` URL | Not sent to ShipSeal API by the current form | User's email client/provider if opened | Controlled by user's mail client/provider | Landing contact disclosure |
| Stripe customer/subscription | Stripe Checkout, Portal, webhook | Subscription authorization and entitlement synchronization | Customer/subscription/price IDs, status, period, cancel flag, webhook event IDs | Stripe | Active/trialing/past-due must end before account deletion. ShipSeal mapping is deleted; Stripe data remains. Event ID can remain linked to the anonymized internal user ID for idempotency | Privacy; Terms; Account deletion |
| Payment-card data | User and Stripe-hosted UI | Payment authorization and management | No card number stored by ShipSeal | Stripe | Governed by Stripe/operator agreement | Privacy; Pricing |
| Browser preferences/history | Browser | Theme, up to five metadata-only recent scans, installation selection | Browser local storage | Google receives normal web request metadata for hosted fonts | Clear in browser; scan history has product clear action | Privacy |

## Repository source flows

### Connected or public GitHub

```text
repository/ref
→ immutable commit SHA
→ tree discovery
→ generated/binary exclusion
→ deterministic evidence selection
→ selected blob reads
→ browser deterministic analysis
```

Normal GitHub scanning does not use the repository ZIP/archive route and does not create a branch or Pull Request.

### Local ZIP

```text
browser Blob
→ central-directory safety checks
→ deterministic evidence selection
→ selected entry decompression
→ browser deterministic analysis
```

The original archive is not uploaded by this flow. A later explicit Deep Analysis can transmit selected evidence derived from it.

## Static-analysis execution audit

Searches across `src/` and `api/` found no repository-input path using `child_process`, shell execution, `eval`, `new Function`, VM evaluation, dependency installation, package-script execution, or dynamic import of imported repository modules. Strings such as `npm test` are generated recommendations, plan text, or detected metadata; they are not invoked.

Supported public claim:

> ShipSeal analyzes repository files statically. Imported repository code is not executed.

## Cookies and browser storage

| Item | Category | Implementation |
| --- | --- | --- |
| `__Host-shipseal_session` | Strictly necessary | HTTP-only, SameSite=Lax, Secure on deployed HTTPS, 14-day max age |
| OAuth state/return cookies | Strictly necessary | HTTP-only, SameSite=Lax, Secure on deployed HTTPS, 10-minute max age and cleared on callback |
| `shipseal-theme` | Preference | Theme preference in local storage |
| `agentready.scanHistory.v1` | Functional | Up to five metadata-only recent scans in local storage |
| GitHub installation selection | Functional | Non-secret installation ID in local storage |
| First-touch campaign attribution | Analytics | One allowlisted UTM source, medium, and campaign tuple in session storage; no visitor ID and no raw URL or referrer |
| Analytics/marketing cookies | None implemented | Vercel Web Analytics and ShipSeal product signals set no analytics or marketing cookie |

The unused shared sidebar component contains a functional cookie helper, but no application route mounts its provider today.

## Third-party implementation inventory

- GitHub: account OAuth, GitHub App repository access, and explicit Pull Request operations.
- Stripe: Checkout, Customer Portal, payments, subscription lifecycle, and webhook events.
- Vercel: repository deployment configuration, function logs, and anonymous aggregate Web Analytics pageviews/referrers when the project dashboard feature is enabled.
- PostgreSQL provider: deployment-configured database; vendor is not identified in code.
- OpenAI-compatible AI endpoint: defaults to the OpenAI API base URL but can be changed through server configuration. The live provider/model and contractual retention/training terms must be verified per deployment.
- Google Fonts: public pages request fonts from `fonts.googleapis.com` and `fonts.gstatic.com`.
- Optional contact webhook exists as a legacy API capability when configured, but the current landing contact surface uses a local `mailto:` draft instead of posting it.

## Human review notes

- The production GitHub App's live permission grants are external configuration and must be compared with the implemented permission table.
- Database/hosting backup deletion and log retention are not encoded.
- Vercel Web Analytics enablement, live plan, retention, and production intake routes are deployment settings and must be verified outside the repository.
- Provider retention, training use, region, international transfers, and subprocessor commitments are not proven by code.
- A formal operator/controller identity, monitored privacy contact, legal bases, governing law, age rules, and monetary refund policy remain business/legal inputs.

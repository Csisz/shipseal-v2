# Account and Project Persistence Architecture

Status: Omega 18.1 implementation decision

Last updated: 2026-07-17

## Decision

ShipSeal uses GitHub OAuth as the first account identity mechanism and PostgreSQL as the durable persistence mechanism. The deployment target remains Vercel serverless functions plus the existing React/Vite client. `postgres` is used only by server modules; browser code talks to bounded same-origin APIs. This avoids custom passwords, keeps identity aligned with the repository workflow, and does not couple account sessions to GitHub App installation access tokens.

Account OAuth uses dedicated `SHIPSEAL_ACCOUNT_GITHUB_*` credentials and callback `/api/account/callback`. The OAuth access token is used once, server-side, to read the GitHub user identity; it is not persisted or returned. Existing GitHub App connect/install/PR authorization remains separate and unchanged.

## Session model

After OAuth callback, ShipSeal creates 32 random bytes with Node's cryptographic random generator. The browser receives only the opaque token in `__Host-shipseal_session`; PostgreSQL stores only its SHA-256 hash. The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, expires after 14 days, and is `Secure` for HTTPS/production requests. OAuth state and safe return paths use separate ten-minute HttpOnly cookies and constant-time state comparison. Every protected route resolves the user from the server-side session; browser-supplied user IDs are ignored. Logout revokes the database session and expires the cookie. Account deletion removes sessions.

This is an opaque server-session design using platform cryptographic primitives, not custom password storage or homemade encryption. No authentication token is stored in `localStorage`, React state, project rows, or scan snapshots.

## Ownership model

Users have non-sequential random IDs. Projects and scans also use random public IDs. Every project stores `owner_user_id`; every scan redundantly stores its owner and belongs to an owned project. Every query includes the authenticated owner. Cross-owner reads, writes, and deletes return the same safe 404 as an unknown ID. Projects are private by default; there is no public listing or sharing endpoint.

A user's GitHub repository is deduplicated by the normalized owner/name identity. Upload projects use a private owner-scoped normalized label. Idempotency keys prevent an interrupted or repeated explicit save from creating a duplicate scan. A different idempotency key creates a new immutable scan.

## Persisted entities

- `shipseal_users`: provider subject, optional email/display name/avatar, timestamps, deletion state.
- `shipseal_sessions`: user, token hash, creation/expiry/revocation timestamps.
- `shipseal_projects`: private owner, source type, safe repository/upload identity, default branch, non-secret GitHub repository/installation references, display name, timestamps, archive state.
- `shipseal_scans`: immutable status/source/counts, scanner and contract versions, deterministic fingerprint, intelligence mode, safe failure category, optional baseline link, validated snapshot.
- `shipseal_verification_relationships`: baseline scan, rescan, algorithm version, state, timestamp, bounded expected artifact IDs.
- `shipseal_schema_migrations`: explicitly applied migration versions.

Foreign keys intentionally cascade when a project/account is deleted. Deleting a baseline scan removes verification relationships that can no longer be truthful. It does not delete a remaining rescan. The project latest-scan timestamp is recalculated after scan deletion.

## Snapshot boundary

`shipseal.scan-snapshot.v1` stores the validated derived `ReadinessReport`, safe provider mode/model metadata, deterministic fingerprint, bounded policy versions, optional artifact-selection identifiers, and optional verification summary. Stored artifact/report bodies are derived outputs needed to reopen the accepted result experience; PostgreSQL/Vercel server access controls protect them, ownership is enforced on every read, and cascade deletion removes them with the scan.

ShipSeal does not persist repository ZIP archives, scanner `textContents`, full source files, provider prompts, raw bounded provider requests, raw provider responses, environment values, private keys, provider API keys, OAuth tokens, GitHub installation tokens, refresh tokens, or webhook secrets. Runtime schemas reject secret-shaped values and forbidden raw-data keys. Source contents already excluded by scanner policy are never reconstructed.

Opening a snapshot validates its exact schema version and safe derived-data shape. Unsupported or malformed history displays an unavailable/older-data state. Opening history does not scan, execute repository code, invoke the provider, or call GitHub mutation APIs. Historic verification keeps its original algorithm version; it is not silently recalculated.

## APIs

- `/api/account/login`, `/callback`, `/session`, `/logout`, `/delete`
- `/api/projects` list and explicit project+initial-scan save
- `/api/projects/:projectId` read, safe metadata update, delete
- `/api/projects/:projectId/scans` bounded list and owner-checked new scan save
- `/api/scans/:scanId` read validated snapshot and delete

Lists are bounded to 50 items per request. Request and response schemas are finite. Raw database errors are never returned. Safe categories distinguish authentication, invalid data, not found, conflict, unsupported version, and unavailable service.

## Migrations and operations

Migration `db/migrations/0001_account_persistence.sql` is explicit and idempotent. It creates owner/project and project/scan indexes, foreign keys, intentional cascades, and migration tracking. It never resets production data.

Local/test setup:

1. Use an isolated PostgreSQL database and set server-only `DATABASE_URL`.
2. Configure the dedicated GitHub OAuth App callback as `http://localhost:3000/api/account/callback` (or the `vercel dev` origin).
3. Run `npm run db:migrate`.
4. `npm run db:migrate:test` applies the migration twice to a clean isolated in-memory PostgreSQL-compatible test database.

Production setup:

1. Provision managed PostgreSQL with encrypted transport and provider-managed storage encryption/backups.
2. Store `DATABASE_URL` and OAuth secrets in Vercel server environment settings, never `VITE_*` values.
3. Apply reviewed migrations before deploying code that depends on them.
4. Use forward-fix migrations for production; rollback means restoring a verified database backup and the compatible application version, not running a destructive automatic reset.

Database backups may retain encrypted deleted rows until the managed provider's backup-retention window expires. ShipSeal removes live records immediately in the transaction but cannot honestly promise immediate physical erasure from already-created backups. The production operator must document the selected provider's retention window before launch.

## Failure behavior and future scope

Database failure never clears the current local scan. Save remains retryable and does not rescan, rerun enhanced intelligence, or mutate GitHub. Reopening failures remain scoped to saved-project navigation. Static-only deployments retain anonymous scan/export behavior but cannot offer durable accounts.

Omega 18.2 public badges/pages and Omega 18.3 payment/entitlement remain future work. There are no teams, roles, public projects, payments, usage enforcement, background provider jobs, or scheduled rescans in Omega 18.1.


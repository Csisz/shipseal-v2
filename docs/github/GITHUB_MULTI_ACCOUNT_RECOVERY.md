# GitHub multi-account connection recovery

This runbook covers production GitHub user authorization and GitHub App installation for `https://www.getshipseal.com`. It does not authorize changing GitHub or Vercel settings without operator review.

## Confirmed implementation findings

- `Connect GitHub` uses the GitHub App OAuth client at `/api/github-app/login`; ShipSeal account sign-in uses a separate OAuth App at `/api/account/login`. Their credentials, callbacks, and sessions must not be interchanged.
- The production apex redirects to the canonical `https://www.getshipseal.com` origin. The generated GitHub App OAuth callback is `https://www.getshipseal.com/api/github-app/oauth-callback`.
- Production safe diagnostics report that the OAuth client, client secret, callback, App ID, private key, and demo installation target are present. Presence alone does not prove they belong to one GitHub App.
- Before this recovery, GitHub App OAuth `state` was generated but not persisted or validated.
- Before this recovery, the browser persisted a raw installation ID in `localStorage`, and repository/scan/PR routes accepted a caller-supplied installation ID without binding it to the authenticated GitHub user.
- Before this recovery, `/api/github-app/callback` accepted an installation ID without validating setup state.
- The reported private-App message is an installation-visibility failure. It does not explain an OAuth authorization 404; OAuth client identity and installation visibility must be diagnosed separately.

The OAuth 404 cannot be conclusively attributed from repository code or safe Vercel metadata alone. The route and canonical redirect URI are correct. A deleted, stale, or different OAuth client remains the leading configuration cause. The recovered login route now verifies `GITHUB_APP_CLIENT_ID` and the configured slug against `GET /app` using the configured App ID/private key before redirecting to GitHub, and returns a safe configuration error on mismatch.

## Recovered security and account model

1. OAuth and installation setup each use a separate, one-time, HttpOnly, SameSite state cookie.
2. The OAuth callback validates state, exchanges the code server-side, reads the authenticated GitHub user, and discovers that user's installations.
3. ShipSeal stores the GitHub user ID/login and authorized installation IDs in an eight-hour, signed HttpOnly connection cookie. The short-lived GitHub user token is kept only in a separate authenticated-encryption, HttpOnly cookie so setup callbacks can prove the returned installation belongs to that user; it is never available to frontend JavaScript or returned in a response. Installation tokens are generated per protected server request and are never stored or returned to the browser.
4. Repository listing, connected evidence acquisition, legacy archive access, and every GitHub App PR route reject installation IDs not present in that signed session.
5. Installation setup validates its state, verifies the installation through the configured GitHub App, independently confirms the installation is visible to the authenticated GitHub user, and only then adds it to that user's connection session.
6. Starting a new OAuth connection clears the prior GitHub connection first. Disconnect clears the server session; no installation authorization is kept in `localStorage`.
7. Revoked or missing installations return a reconnect path instead of exposing raw GitHub responses.
8. Ordinary returning users reuse the signed connection session. The explicit **Switch GitHub account** action alone adds GitHub's supported `prompt=select_account` parameter, so account choice is deliberate without forcing repeat authentication elsewhere.
9. OAuth and setup callbacks render a themed transition, notify their validated same-origin opener, and close the popup where permitted. If the opener cannot be reached, they return in the same tab with a non-sensitive completion marker.
10. While a connection popup is active, ShipSeal refetches the server connection on a validated callback message, window focus, visibility restoration, and a bounded two-minute poll. The server session is authoritative; callback payloads never directly grant repository access.

`GITHUB_APP_CLIENT_SECRET` is the default signing key for the connection cookie. `GITHUB_CONNECTION_SESSION_SECRET` may be set to a separate random value and is recommended for independent rotation.

## GitHub Developer Settings — required operator review

Use the existing production GitHub App unless GitHub no longer allows it to be made public or its credentials cannot be recovered.

For the one production GitHub App used by installation tokens:

- Visibility: **Public**. A private GitHub App can only be installed by its owner and blocks `hvdev23` and other independent accounts.
- Homepage URL: `https://www.getshipseal.com`
- Callback URL: `https://www.getshipseal.com/api/github-app/oauth-callback`
- Setup URL: `https://www.getshipseal.com/api/github-app/callback`
- Request user authorization (OAuth) during installation: **off**. ShipSeal completes the state-validated OAuth user flow first, then uses the Setup URL for installation verification.
- Redirect on update: enable it if repository-access changes should return to ShipSeal.
- App slug: copy the exact slug from this App's public URL.
- Repository permissions: Metadata read-only; Contents read and write; Pull requests read and write. If reviewed fix packs may change workflow files, also review and enable the minimum required Workflows permission.
- Installation choice: allow users to choose all repositories or selected repositories. Do not request organization-wide access outside the user's choice.

On the same GitHub App page, confirm that its numeric App ID, OAuth client ID/client secret, slug, and private key are the identities copied to Vercel. Rotate a secret or private key only when necessary; update Vercel atomically and redeploy. Do not delete the App or create a replacement merely to fix visibility, because that would strand existing installations.

Keep the dedicated `ShipSeal Account` OAuth App separate:

- Homepage: `https://www.getshipseal.com`
- Callback: `https://www.getshipseal.com/api/account/callback`
- Scopes requested by ShipSeal: `read:user user:email`

## Vercel Production settings — required operator review

All of the following server-only values must describe the same public GitHub App:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_CALLBACK_URL=https://www.getshipseal.com/api/github-app/oauth-callback`
- `GITHUB_APP_SLUG=<exact-public-app-slug>`
- `GITHUB_APP_INSTALL_URL=https://github.com/apps/<exact-public-app-slug>/installations/new` (optional when the slug is set)
- `GITHUB_CONNECTION_SESSION_SECRET=<independent-random-secret>` (recommended)
- `GITHUB_API_BASE_URL` should be absent for github.com or exactly `https://api.github.com`.

Frontend `VITE_GITHUB_APP_*` values no longer control authorization or setup routing. They may remain for display compatibility, but they must not point at a different App.

The account OAuth values remain separate: `SHIPSEAL_APP_ORIGIN`, `SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID`, `SHIPSEAL_ACCOUNT_GITHUB_CLIENT_SECRET`, `SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL`, and `DATABASE_URL`.

Current Vercel metadata shows GitHub and account variables scoped to both Preview and Production. Unless a fixed Preview origin and separate Preview OAuth/GitHub App configuration have been intentionally registered, scope production credentials to Production only. Never use the Production account OAuth callback or production database unintentionally from dynamic Preview deployments.

After changing environment values, redeploy Production. An environment edit does not change already-built functions until a deployment uses it.

## Browser acceptance checklist

Use a private/incognito window where useful and inspect network responses without copying tokens.

1. Open `https://getshipseal.com`; confirm it canonicalizes to `https://www.getshipseal.com`.
2. Select **Connect GitHub**. Confirm the UI shows **Authorizing** and GitHub shows the intended production App, not a missing page.
3. Decline OAuth. Confirm ShipSeal shows an actionable retry and no repository data.
4. Connect the primary GitHub account. Confirm its login is shown and an existing installation is reused.
5. If no installation exists, confirm the OAuth transition continues directly into GitHub App installation without another **Connect GitHub** click. Choose **Only select repositories**, authorize one repository, and return to ShipSeal.
6. Confirm only repositories granted to that installation are listed. An unselected private repository must not appear or scan.
7. Select and scan an authorized repository. Confirm commit-bound evidence acquisition succeeds.
8. Preview the existing Readiness/Repository Intelligence PR workflow. Confirm it targets the selected repository and does not mutate before explicit confirmation.
9. Select **Switch GitHub account** without first signing out of GitHub. Confirm GitHub shows its account picker, choose `hvdev23`, and confirm `hvdev23/shipseal-test-repo` appears only after it is granted to the App.
10. Confirm repositories from the first account do not remain and cannot be reached by reusing their prior installation ID.
11. Cancel installation selection. Confirm ShipSeal shows **Reconnect required** or a safe cancellation message.
12. Revoke the ShipSeal installation in GitHub. Retry listing/scanning and confirm ShipSeal asks for reconnection.
13. Use a controlled expired-session test and confirm protected reads and PR actions require reconnection.
14. Complete a popup flow without refreshing the ShipSeal tab. Confirm the username, installation list, and repository picker update immediately and the popup closes where permitted.
15. Block popups and repeat the flow. Confirm ShipSeal uses same-tab navigation, restores the selected scan options, and lists repositories after returning.
16. Complete installation slowly enough to exercise the active-flow polling fallback; confirm it remains bounded and does not poll after success or cancellation.
17. Repeat connection, repository selection, scan, and PR preview in light and dark themes and at desktop/mobile widths.

Do not claim production recovery complete until this checklist has been run against real GitHub accounts and the production deployment.

## Remaining operational risks

- Existing installations remain tied to the existing App; changing App identity in Vercel will make them unavailable.
- OAuth and setup depend on first-party cookies during top-level navigation. Popup-blocked browsers use a same-tab fallback, but browser privacy policies still require real-device verification.
- GitHub permission changes or organization approval policies can still prevent a repository from appearing or a PR from being created.
- No GitHub installation webhook reconciliation is implemented; revocation is detected on the next protected GitHub request.
- Preview OAuth remains unsafe unless it has an explicit stable origin, separate credentials, and registered callbacks.

This runbook is operational guidance, not legal advice.

# GitHub Connect Dogfood Check

Use this checklist on the deployed Vercel app after setting the GitHub App environment variables.

Expected deployed URLs:

- App homepage: `https://shipseal-v2.vercel.app`
- GitHub App setup callback URL: `https://shipseal-v2.vercel.app/api/github-app/callback`
- GitHub OAuth callback URL: `https://shipseal-v2.vercel.app/api/github-app/oauth-callback`
- Login diagnostics: `https://shipseal-v2.vercel.app/api/github-app/login?debug=1`

1. Open ShipSeal and go to the scan section.
2. Click `Connect GitHub`.
3. Confirm a centered GitHub authorization popup opens.
4. Approve ShipSeal or choose the existing installation.
5. Confirm the popup closes or shows `Return to ShipSeal`.
6. Confirm the main ShipSeal page lists repositories in the repository selector.
7. Select a repository and run a scan.
8. Click `Disconnect GitHub` and confirm the repository selector resets.
9. Reconnect and confirm repositories appear without editing GitHub App settings or clicking Save.
10. Confirm `Import public GitHub URL` still works without connecting GitHub.

Required Vercel variables:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_CALLBACK_URL=https://shipseal-v2.vercel.app/api/github-app/oauth-callback`
- `GITHUB_APP_SLUG` or `GITHUB_APP_INSTALL_URL`
- `VITE_GITHUB_APP_SLUG` or `VITE_GITHUB_APP_INSTALL_URL`

GitHub App settings checklist:

- Homepage URL: `https://shipseal-v2.vercel.app`
- Setup URL: `https://shipseal-v2.vercel.app/api/github-app/callback`
- Callback URL for installation setup: `https://shipseal-v2.vercel.app/api/github-app/callback`
- OAuth callback URL: `https://shipseal-v2.vercel.app/api/github-app/oauth-callback`
- The OAuth client ID in `GITHUB_APP_CLIENT_ID` must be the GitHub App OAuth client ID, not the numeric GitHub App ID.

Do not paste private key, OAuth secret, or installation tokens into client-side logs or screenshots.

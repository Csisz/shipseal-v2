# Security Policy

ShipSeal is a local-first demo MVP for repository readiness scanning.

## No Code Execution

ShipSeal does not execute uploaded or imported repository code. The scanner reads ZIP metadata, filenames, sizes, and a bounded subset of small text/config files such as `package.json`, `README.md`, `.gitignore`, `.env.example`, and instruction files.

## Local Browser Scanning And Hosted Proxy

The current MVP runs scanning and generation in the browser. It has no database, authentication, private repository access, external AI API calls, or server-side secret storage.

Hosted Vercel demos include a minimal same-origin proxy at `/api/github-archive` for public GitHub ZIP archives. The proxy is tokenless, public-repo-only, does not persist ZIP files, and must not be used for private repositories. If GitHub import fails, users should download the ZIP manually from GitHub and upload it.

## Secrets

Do not intentionally upload real secrets, production credentials, customer data, or private keys.

ShipSeal detects suspicious credential files by path and filename, including examples such as `.env`, `.env.local`, private key files, `.pem`, `.key`, `credentials.json`, and `serviceAccount.json`. `.env.example` is treated as safe placeholder documentation.

## Responsible Disclosure

For responsible disclosure, contact: security@example.com

Replace this placeholder contact before any production launch.

## Future Hardening

Future backend or worker implementations should add isolated scanning workers, malware checks, strict retention, audit logging, least-privilege GitHub App access, server-side secret management, and redaction controls before handling private repositories.

## Legal And Compliance Disclaimer

ShipSeal readiness output is not legal advice, not a formal legal opinion, not a production security audit, and not a compliance certification. AI Act readiness files are preliminary technical and product-side review aids.

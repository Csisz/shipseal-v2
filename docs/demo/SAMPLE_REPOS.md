# Sample Repository Ideas

Use small repositories for fast local demos. Avoid real secrets and production data.

## Good Demo Repositories

- Small Vite React app with `package.json`, `src/`, `README.md`, `npm run test`, and `npm run build`.
- Next.js app with React, TypeScript, `.env.example`, tests, and CI config.
- Python FastAPI app with `pyproject.toml` or `requirements.txt`, README setup steps, and pytest.
- Repo with clear `AGENTS.md`, `CONTRIBUTING.md`, and `.github/workflows/`.
- Repo with docs and tests that should score close to AI Coding Ready.

## Useful Negative Cases

- Repo with missing README.
- Repo with no tests or build command.
- Repo with no recognizable stack manifest.
- Repo dominated by generated folders such as `node_modules/`, `dist/`, or `build/`.
- Repo with `.env.example`, which should be safe.
- Local-only test repo with an intentionally unsafe `.env` file to verify blocker behavior.

## Safety Notes

- Do not include real secrets.
- Do not include customer data.
- Do not include production credentials.
- Keep ZIP files below the local scan size limit.
- Prefer repositories that can be understood from structure and metadata.

# ShipSeal Codex Instructions

Work in small, targeted changes.

## Scope
- Prefer the smallest safe fix that solves the user's request.
- Do not perform broad refactors unless explicitly requested.
- Do not redesign unrelated screens or change existing app behavior unless asked.
- Keep UI copy client-friendly and understandable for AI freelancers and small agencies.

## Usage limits
- Do not run full test suites, production builds, deployments, commits, or git push unless explicitly requested.
- If verification is needed, provide the exact commands for the user to run manually.
- Accepted validation commands include `npm test`, `npm run test`, and `npm run build` when the user explicitly asks for them.
- Prefer targeted file inspection over scanning the whole repository.
- Avoid opening large generated files, package lock files, build outputs, or dependency folders unless necessary.

## Product boundaries
- Do not add auth, payments, databases, persistent storage, private GitHub import, GitHub App integration, AI2AI integration, or server-side PDF services unless explicitly requested.
- Do not call external AI APIs from this MVP.
- Uploaded or imported code must never be executed.

## ShipSeal safety boundaries

- Validate Delivery Pack export behavior before client-facing release.
- Keep GitHub archive handling through `/api/github-archive` safe and non-executing.
- Client reports must keep the boundary clear: This is not legal advice.

## Editing
- Before editing, identify the likely files involved.
- Edit only the relevant files.
- Preserve ZIP upload as the reliable fallback path.
- For UI work, prioritize readability, spacing, mobile safety, and clear hierarchy.

## Final response
- Summarize what changed briefly.
- List manual test commands or browser checks the user should run.
- Mention if tests/build were not run.
- Do not commit or push unless explicitly asked.

# DEPRECATED

Superseded by:

docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md

# Create Readiness PR Plan

Create Readiness PR is the ShipSeal workflow for proposing repository-ready files through a reviewed pull request.

The current MVP can create a GitHub Pull Request from a connected GitHub App repository after the user reviews the file list and confirms the operation. Advanced / Developer mode still supports a temporary GitHub fine-grained token for testing. The MVP does not request OAuth, store user PAT tokens, push to `main`, or merge automatically.

## Goal

Create Readiness PR should help users add ShipSeal-generated readiness files to their repository so future scans can detect stronger agent instructions, governance, testing, security, and client handoff signals.

## Why Pull Request, Not Main Branch Push

ShipSeal should not push directly to `main`.

A pull request is safer because:

- changes are isolated on a separate branch,
- humans can review every generated file,
- CI can run before merge,
- repository owners keep control,
- merge remains a human decision.

## MVP PR Data

- Branch name: `shipseal/readiness-pack`
- PR title: `Add ShipSeal readiness and agent governance pack`
- PR summary: `This pull request adds ShipSeal-generated agent instructions, governance notes, testing guidance, security review notes and client handoff documentation to improve AI project delivery readiness.`

## Files The PR May Add

- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `docs/CRITICAL_FILES_POLICY.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/OWNERSHIP.md`
- `.github/workflows/ci.yml`

The downloadable Readiness Fix Pack may also include `docs/AGENT_CHANGE_POLICY.md`, `docs/HANDOFF_CHECKLIST.md`, and `docs/AI_ACT_READINESS_NOTES.md`.

## Readiness Areas

- AI agent instruction readiness
- Build, test & quality gates
- Security & secret handling
- Team workflow & governance
- Client handoff quality

These files are expected to improve future ShipSeal scans, depending on repository content and review. ShipSeal should not promise a guaranteed score increase.

## MVP GitHub Access

The recommended MVP path uses a GitHub App installation selected before scanning. When the report source has `githubInstallationId`, owner, and repo metadata, the modal shows the connected repository and can call `POST /api/github-app/create-readiness-pr` without asking the user to paste a token.

Advanced / Developer mode asks the user to paste a GitHub fine-grained token for a single request only. This remains available for developer testing and ZIP/public URL fallback cases.

The temporary token:

- is held in React state only,
- is sent to `/api/create-readiness-pr` only for the request,
- is used server-side only as a GitHub Authorization header,
- is not returned in API responses,
- is not stored in `localStorage` or `sessionStorage`,
- is not written to reports, Delivery Packs, Readiness Fix Packs or logs.

The modal reflects shared GitHub connection state:

- Connected GitHub App repo: `canCreatePullRequest = true`, so the modal can show `Connected repository: owner/repo` and create the PR through the GitHub App endpoint.
- Public GitHub URL: scan/export only; PR creation requires connecting GitHub or using Advanced temporary token mode.
- ZIP upload: local scan/export only; PR creation requires connecting GitHub or using Advanced temporary token mode.

The Advanced token form can reduce manual entry by auto-filling repository owner and name from GitHub import metadata, a parsed GitHub URL such as `https://github.com/Csisz/shipseal`, or a repository name already shaped as `owner/repo`. ZIP uploads can still fill those fields manually.

Base branch is optional in the UI. If the GitHub import later includes default branch metadata, ShipSeal can prefill it. If it is left empty, `/api/create-readiness-pr` resolves the repository default branch through the GitHub API before creating the branch.

GitHub App MVP capabilities:

- read repository metadata,
- download a selected repository archive,
- create a branch,
- create or update files on that branch,
- open a pull request.

GitHub App permissions determine whether private repositories can be accessed, but private repo usage should be tested carefully. The integration should not request broad organization access by default.

## Serverless Endpoints

Temporary token endpoint: `POST /api/create-readiness-pr`

The endpoint:

- validates owner, repo, branch, PR title, PR body and files,
- rejects `main` and `master` as target branch names,
- resolves the repository default branch when base branch is not provided,
- creates `shipseal/readiness-pack` or a timestamped fallback branch if that branch already exists,
- uploads the Readiness Fix Pack files to that branch,
- opens a Pull Request for human review,
- returns only the PR URL, branch name, base branch and file count.

This endpoint still requires a user-provided token and is kept as Advanced / Developer mode.

GitHub App endpoint: `POST /api/github-app/create-readiness-pr`

The endpoint:

- validates installation id, owner, repo, branch, PR title, PR body and files,
- requires the feature branch to use the `shipseal/` prefix,
- rejects `main`, `master`, `develop`, and `trunk` as direct target branch names,
- resolves the repository default branch when base branch is not provided,
- creates `shipseal/readiness-pack` or a timestamped fallback branch if that branch already exists,
- uploads the Readiness Fix Pack files to that branch,
- opens a Pull Request for human review,
- returns only the PR URL, branch name, base branch and file count,
- never returns the GitHub App installation token.

## Security Model

- No direct push to `main`.
- No automatic merge.
- No user PAT token storage in the browser.
- GitHub App installation tokens are requested server-side and short-lived.
- No persistent storage of repository ZIPs or generated file contents unless a future product decision adds explicit storage.
- Generated files should be opened as a PR for human review.
- CI should run before merge.
- Workflow files such as `.github/workflows/ci.yml` must be reviewed carefully before merge.

## GitHub App Flow

Recommended flow: `Connect GitHub -> select repository -> scan -> generate -> create PR`.

Production should continue to harden the GitHub App / Connect GitHub flow:

- user installs or connects the ShipSeal GitHub App before scanning,
- user selects a repository from the connected installation,
- ShipSeal requests narrow repository access,
- ShipSeal uses an installation token to read repository metadata, resolve the default branch, create a feature branch, write the generated files, and open a Pull Request,
- no long-lived user token is stored by ShipSeal,
- every PR still targets a review branch and never pushes directly to `main`.

## Manual Fallback In The MVP

Users can download `shipseal-readiness-fix-pack-[repo].zip` and apply it manually:

```bash
git checkout -b shipseal/readiness-pack

# unzip shipseal-readiness-fix-pack-[repo].zip into the repository root

git add AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md docs/ .github/workflows/ci.yml
git commit -m "Add ShipSeal readiness fix pack"
git push origin shipseal/readiness-pack
```

Then open a Pull Request on GitHub.

## Future Implementation Steps

1. Harden GitHub App callback/session state.
2. Persist selected repository state safely.
3. Improve private repository scanning UX.
4. Improve branch conflict handling and PR reuse.
5. Add richer PR body with scan summary and readiness impact.
6. Add audit logging for connect, scan, branch, file write, and PR events.
7. Merge only after an explicit human decision.


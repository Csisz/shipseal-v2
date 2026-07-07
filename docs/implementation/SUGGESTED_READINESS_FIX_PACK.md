# Suggested Readiness Fix Pack

The Suggested Readiness Fix Pack shows repository files that can improve ShipSeal readiness scoring, agent-readiness, governance, testing, security, and client handoff quality.

The feature is intentionally review-first. Users can download a separate `shipseal-readiness-fix-pack-[repo].zip` and copy those files into the repository root, or use `Create Readiness PR` after reviewing the files, providing a GitHub token, and confirming the operation.

## Why Not Write Directly To Main

Readiness files affect how humans and AI agents operate in a repository. Writing them directly to `main` would be risky because the repository owner should review:

- agent instructions,
- critical file rules,
- CI workflow behavior,
- security language,
- release checklist language,
- ownership and review policy.

## Why Pull Requests Are Safer

`Create Readiness PR` creates a separate branch and opens a pull request for human review. That keeps changes visible, reviewable, reversible, and compatible with normal team workflows.

The current MVP supports this by:

- generating suggested file mappings,
- showing a preview,
- allowing copy/download,
- exporting a separate Readiness Fix Pack ZIP,
- explaining which readiness category each file improves,
- requiring explicit confirmation before creating a GitHub pull request.

## Suggested Files

- `AGENTS.md` - AI agent instruction readiness.
- `CLAUDE.md` - AI agent instruction readiness.
- `CONTRIBUTING.md` - team workflow and governance.
- `SECURITY.md` - security and secret handling.
- `docs/CRITICAL_FILES_POLICY.md` - governance and safety boundaries.
- `docs/RELEASE_CHECKLIST.md` - build, test and quality gates.
- `docs/OWNERSHIP.md` - ownership and review routing.
- `.github/workflows/ci.yml` - automated test/build verification.

Optional MVP files may include:

- `docs/AGENT_CHANGE_POLICY.md` - AI agent change boundaries.
- `docs/HANDOFF_CHECKLIST.md` - client handoff review checklist.
- `docs/AI_ACT_READINESS_NOTES.md` - preliminary technical AI Act readiness notes, not legal advice.

## Manual Git Fallback

```bash
git checkout -b shipseal/readiness-pack

# unzip shipseal-readiness-fix-pack-[repo].zip into the repository root

git add AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md docs/ .github/workflows/ci.yml
git commit -m "Add ShipSeal readiness fix pack"
git push origin shipseal/readiness-pack
```

Then open a Pull Request on GitHub.

## Create Readiness PR MVP

Current MVP flow:

1. Generate suggested readiness files.
2. Create a separate branch.
3. Upload the suggested files.
4. Open a pull request.
5. Let the repository owner review, edit, and merge.

Not included now:

- GitHub OAuth.
- GitHub App.
- Private repository write access.
- Token storage.
- Main branch writes.

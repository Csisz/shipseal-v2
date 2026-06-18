import type { ReadinessPrPlan } from './types';

const files = [
  { path: 'AGENTS.md', readinessCategory: 'AI agent instruction readiness' },
  { path: 'CLAUDE.md', readinessCategory: 'AI agent instruction readiness' },
  { path: 'CONTRIBUTING.md', readinessCategory: 'Team workflow & governance' },
  { path: 'SECURITY.md', readinessCategory: 'Security & secret handling' },
  { path: 'docs/CRITICAL_FILES_POLICY.md', readinessCategory: 'Team workflow & governance / safety' },
  { path: 'docs/RELEASE_CHECKLIST.md', readinessCategory: 'Build, test & quality gates' },
  { path: 'docs/OWNERSHIP.md', readinessCategory: 'Team workflow & governance' },
  { path: '.github/workflows/ci.yml', readinessCategory: 'Build, test & quality gates' },
];

const categories = [
  'AI agent instruction readiness',
  'Build, test & quality gates',
  'Security & secret handling',
  'Team workflow & governance',
  'Client handoff quality',
];

const manualGitSteps = [
  'git checkout -b shipseal/readiness-pack',
  '',
  '# unzip shipseal-readiness-fix-pack-[repo].zip into the repository root',
  '',
  'git add AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md docs/ .github/workflows/ci.yml',
  'git commit -m "Add ShipSeal readiness fix pack"',
  'git push origin shipseal/readiness-pack',
].join('\n');

export function buildReadinessPrPlan(): ReadinessPrPlan {
  return {
    branchName: 'shipseal/readiness-pack',
    title: 'Add ShipSeal readiness pack',
    summary: 'This pull request adds ShipSeal-generated readiness files: agent instructions, governance notes, testing guidance, security review notes and client handoff documentation.',
    files,
    categories,
    manualGitSteps,
    safetyNote: 'ShipSeal will not push directly to main. Uploaded or imported repository code was not executed; this PR contains generated text/config files for human review.',
    expectedImpactNote: 'These files are expected to improve future ShipSeal scans, depending on repository content and review.',
  };
}

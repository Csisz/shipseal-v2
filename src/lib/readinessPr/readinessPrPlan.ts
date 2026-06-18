import type { ReadinessPrPlan } from './types';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack/goalMapping';

const FILE_CATEGORIES: Record<string, string> = {
  'AGENTS.md': 'AI agent instruction readiness',
  'CLAUDE.md': 'AI agent instruction readiness',
  'CONTRIBUTING.md': 'Team workflow & governance',
  'SECURITY.md': 'Security & secret handling',
  'docs/AGENT_CHANGE_POLICY.md': 'AI agent instruction readiness / safety',
  'docs/AI_ACT_READINESS_NOTES.md': 'AI Act readiness / governance',
  'docs/CRITICAL_FILES_POLICY.md': 'Team workflow & governance / safety',
  'docs/HANDOFF_CHECKLIST.md': 'Client handoff quality',
  'docs/OWNERSHIP.md': 'Team workflow & governance',
  'docs/RELEASE_CHECKLIST.md': 'Build, test & quality gates',
  'docs/shipseal/CI_QUALITY_GATE.example.yml': 'Build, test & quality gates',
};

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
  'git add AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md docs/',
  'git commit -m "Add ShipSeal readiness fix pack"',
  'git push origin shipseal/readiness-pack',
].join('\n');

export function buildReadinessPrPlan(selectedPackages: string[] = []): ReadinessPrPlan {
  const focus = resolveDeliveryPackFocus(selectedPackages);
  const files = focus.readinessPrPaths.map(path => ({
    path,
    readinessCategory: FILE_CATEGORIES[path] || 'ShipSeal readiness',
  }));

  return {
    branchName: 'shipseal/readiness-pack',
    title: 'Add ShipSeal readiness pack',
    summary: `This pull request adds a safe starter subset of ShipSeal-generated readiness files for ${focus.packageLabel}. The full Delivery Pack covers: ${focus.packageSummary}`,
    files,
    categories,
    manualGitSteps,
    safetyNote: 'ShipSeal will not push directly to main. Uploaded or imported repository code was not executed; this PR contains generated text/config files for human review.',
    expectedImpactNote: 'These files are expected to improve future ShipSeal scans, depending on repository content and review.',
  };
}

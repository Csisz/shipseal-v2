import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages, type ShipSealPackageId } from '../packages';
import { getDeliveryPackRequiredPaths } from './manifest';

const GOAL_PATH_PREFIXES: Record<ShipSealPackageId, string[]> = {
  'client-handoff': ['06-client-handoff/', '07-context/', 'score.json'],
  'launch-readiness': ['04-testing/', '05-ai-act-readiness/', '06-client-handoff/', 'score.json'],
  'safety-risk': ['03-mcp-governance/', '04-testing/RED_TEAM_PROMPTS.md', '05-ai-act-readiness/', 'score.json'],
  'agent-readiness': ['01-agent-instructions/', '02-skills/', '07-context/', 'score.json'],
  'testing-red-team': ['04-testing/', 'score.json'],
  'rescue-refactor': ['06-client-handoff/NEXT_STEPS_ROADMAP.md', '07-context/', 'score.json'],
  'sales-present': ['06-client-handoff/CLIENT_HANDOFF_REPORT.md', '06-client-handoff/EXECUTIVE_SUMMARY.md', '07-context/', 'score.json'],
  'mcp-readiness': ['03-mcp-governance/', '07-context/', 'score.json'],
  'full-package': [''],
};

export interface DeliveryPackFocus {
  selectedGoals: Array<{ id: ShipSealPackageId; title: string }>;
  emphasizedPaths: string[];
  fullPackage: boolean;
}

export function resolveDeliveryPackFocus(selectedPackages: string[] = []): DeliveryPackFocus {
  const selectedGoals = resolveSelectedPackages(selectedPackages);
  const allPaths = getDeliveryPackRequiredPaths();
  const fullPackage = selectedGoals.includes(FULL_PACKAGE_ID);
  const emphasizedPaths = fullPackage
    ? allPaths
    : allPaths.filter(path => selectedGoals.some(goal => matchesGoalPath(goal, path)));

  return {
    selectedGoals: selectedGoals.map(id => ({ id, title: getShipSealPackage(id)?.title || id })),
    emphasizedPaths,
    fullPackage,
  };
}

function matchesGoalPath(goal: ShipSealPackageId, path: string) {
  return GOAL_PATH_PREFIXES[goal].some(prefix => prefix === '' || path === prefix || path.startsWith(prefix));
}

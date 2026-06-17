import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages, type ShipSealPackageId } from '../packages';
import { getDeliveryPackRequiredPaths } from './manifest';

const ROOT_SCORE = 'score.json';

const GOAL_OUTPUT_PATHS: Record<ShipSealPackageId, string[]> = {
  'client-handoff': [
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.html',
    '06-client-handoff/EXECUTIVE_SUMMARY.md',
    '06-client-handoff/NEXT_STEPS_ROADMAP.md',
    ROOT_SCORE,
  ],
  'launch-readiness': [
    '04-testing/CI_QUALITY_GATE.yml',
    '04-testing/TESTING_STRATEGY.md',
    '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md',
    '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md',
    '05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    '06-client-handoff/EXECUTIVE_SUMMARY.md',
    '06-client-handoff/NEXT_STEPS_ROADMAP.md',
    ROOT_SCORE,
  ],
  'safety-risk': [
    '03-mcp-governance/MCP_SECURITY_POLICY.md',
    '03-mcp-governance/MCP_TOOL_ALLOWLIST.md',
    '04-testing/RED_TEAM_PROMPTS.md',
    '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    ROOT_SCORE,
  ],
  'agent-readiness': [
    '01-agent-instructions/AGENTS.md',
    '01-agent-instructions/CLAUDE.md',
    '01-agent-instructions/CODEX_PROMPTS.md',
    '01-agent-instructions/REVIEWER_PROMPT.md',
    '02-skills/code-review/SKILL.md',
    '02-skills/test-generation/SKILL.md',
    '07-context/REPO_CONTEXT_PACK.md',
    '07-context/repo-context-pack.json',
    ROOT_SCORE,
  ],
  'testing-red-team': [
    '04-testing/EVAL_TEST_CASES.md',
    '04-testing/RED_TEAM_PROMPTS.md',
    '04-testing/TESTING_STRATEGY.md',
    '04-testing/CI_QUALITY_GATE.yml',
    ROOT_SCORE,
  ],
  'rescue-refactor': [
    '01-agent-instructions/REVIEWER_PROMPT.md',
    '06-client-handoff/NEXT_STEPS_ROADMAP.md',
    '07-context/REPO_CONTEXT_PACK.md',
    '07-context/repo-context-pack.json',
    ROOT_SCORE,
  ],
  'sales-present': [
    '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.html',
    '06-client-handoff/EXECUTIVE_SUMMARY.md',
    '07-context/REPO_CONTEXT_PACK.md',
    ROOT_SCORE,
  ],
  'mcp-readiness': [
    '03-mcp-governance/MCP_READINESS.md',
    '03-mcp-governance/MCP_SECURITY_POLICY.md',
    '03-mcp-governance/MCP_SERVER_RECOMMENDATIONS.md',
    '03-mcp-governance/MCP_TOOL_ALLOWLIST.md',
    '07-context/REPO_CONTEXT_PACK.md',
    '07-context/repo-context-pack.json',
    ROOT_SCORE,
  ],
  'full-package': [],
};

const GOAL_LABELS: Record<ShipSealPackageId, string> = {
  'client-handoff': 'Client handoff pack',
  'launch-readiness': 'Launch readiness pack',
  'safety-risk': 'Security and data pre-screen',
  'agent-readiness': 'Agent development pack',
  'testing-red-team': 'Testing and red-team pack',
  'rescue-refactor': 'Rescue and refactor pack',
  'sales-present': 'Sales and presentation pack',
  'mcp-readiness': 'MCP readiness pack',
  'full-package': 'Full ShipSeal package',
};

const GOAL_SUMMARIES: Record<ShipSealPackageId, string> = {
  'client-handoff': 'Client report, executive summary, readiness decision, roadmap, and delivery manifest.',
  'launch-readiness': 'Go/no-go readiness, quality gates, AI Act pre-screen, and client next steps.',
  'safety-risk': 'Security notes, env/secrets signals, data/privacy checklist, and risk summary.',
  'agent-readiness': 'AGENTS.md, CLAUDE.md, Codex guidance, repo context, and agent safety notes.',
  'testing-red-team': 'Testing plan, eval cases, red-team prompts, quality gates, and CI/test recommendations.',
  'rescue-refactor': 'Prioritized fix roadmap, review guidance, and repository context for cleanup.',
  'sales-present': 'Client-facing report, executive summary, transparency draft, and presentation context.',
  'mcp-readiness': 'MCP readiness, MCP security policy, tool allowlist, and server recommendations.',
  'full-package': 'Everything ShipSeal can generate across handoff, agents, testing, safety, MCP, and transparency.',
};

export interface DeliveryPackFocus {
  selectedGoals: Array<{ id: ShipSealPackageId; title: string }>;
  emphasizedPaths: string[];
  generatedPaths: string[];
  manifestPaths: string[];
  fullPackage: boolean;
  packageLabel: string;
  packageSummary: string;
}

export function resolveDeliveryPackFocus(selectedPackages: string[] = []): DeliveryPackFocus {
  const selectedGoals = resolveSelectedPackages(selectedPackages);
  const allPaths = getDeliveryPackRequiredPaths();
  const fullPackage = selectedGoals.includes(FULL_PACKAGE_ID);
  const generatedPaths = fullPackage
    ? allPaths
    : uniquePaths(selectedGoals.flatMap(goal => GOAL_OUTPUT_PATHS[goal])).filter(path => allPaths.includes(path));
  const selectedGoalSummaries = selectedGoals.map(id => GOAL_SUMMARIES[id]);

  return {
    selectedGoals: selectedGoals.map(id => ({ id, title: getShipSealPackage(id)?.title || id })),
    emphasizedPaths: generatedPaths,
    generatedPaths,
    manifestPaths: allPaths,
    fullPackage,
    packageLabel: fullPackage
      ? GOAL_LABELS[FULL_PACKAGE_ID]
      : selectedGoals.length === 1
        ? GOAL_LABELS[selectedGoals[0]]
        : 'Focused ShipSeal pack',
    packageSummary: selectedGoalSummaries.join(' '),
  };
}

function uniquePaths(paths: string[]) {
  return [...new Set(paths)];
}

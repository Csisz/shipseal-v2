import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages, type ShipSealPackageId } from '../packages';
import { getDeliveryPackRequiredPaths } from './manifest';

const ROOT_SCORE = 'score.json';

const GOAL_OUTPUT_PATHS: Record<ShipSealPackageId, string[]> = {
  'client-handoff': [
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.html',
    '06-client-handoff/EXECUTIVE_SUMMARY.md',
    '06-client-handoff/NEXT_STEPS_ROADMAP.md',
    '06-client-handoff/DELIVERY_MANIFEST.md',
    ROOT_SCORE,
  ],
  'launch-readiness': [
    '04-testing/CI_QUALITY_GATE.yml',
    '04-testing/TESTING_STRATEGY.md',
    '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md',
    '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md',
    '05-ai-act-readiness/USER_FACING_DISCLOSURE_NOTES.md',
    '05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    '06-client-handoff/EXECUTIVE_SUMMARY.md',
    '06-client-handoff/NEXT_STEPS_ROADMAP.md',
    ROOT_SCORE,
  ],
  'safety-risk': [
    '08-security-data/SECURITY_NOTES.md',
    '08-security-data/ENV_SECRETS_FINDINGS.md',
    '08-security-data/DATA_PRIVACY_CHECKLIST.md',
    '08-security-data/RISK_SUMMARY.md',
    '08-security-data/HUMAN_APPROVAL_REVIEWERS.md',
    '04-testing/RED_TEAM_PROMPTS.md',
    ROOT_SCORE,
  ],
  'agent-readiness': [
    '01-agent-instructions/AGENTS.md',
    '01-agent-instructions/CLAUDE.md',
    '01-agent-instructions/AGENT_COST_OPTIMIZATION.md',
    '01-agent-instructions/CODEX_PROMPTS.md',
    '01-agent-instructions/CURSOR_RULES.md',
    '01-agent-instructions/REVIEWER_PROMPT.md',
    '01-agent-instructions/AGENT_SAFETY_NOTES.md',
    '02-skills/code-review/SKILL.md',
    '02-skills/test-generation/SKILL.md',
    '07-context/REPO_CONTEXT_PACK.md',
    '07-context/repo-context-pack.json',
    '07-context/ARCHITECTURE.md',
    '07-context/CRITICAL_FILES.md',
    '07-context/COMMAND_MAP.md',
    '07-context/KNOWN_RISKS.md',
    '07-context/TASK_ROUTER.md',
    '07-context/SKILL_RECOMMENDATIONS.md',
    '07-context/MCP_RECOMMENDATIONS.md',
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
    '05-ai-act-readiness/USER_FACING_DISCLOSURE_NOTES.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
    '06-client-handoff/CLIENT_HANDOFF_REPORT.html',
    '06-client-handoff/EXECUTIVE_SUMMARY.md',
    '07-context/REPO_CONTEXT_PACK.md',
    ROOT_SCORE,
  ],
  'ai-act-transparency': [
    '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md',
    '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md',
    '05-ai-act-readiness/USER_FACING_DISCLOSURE_NOTES.md',
    '05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md',
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
  'ai-act-transparency': 'AI Act and transparency pack',
  'full-package': 'Full ShipSeal package',
};

const GOAL_SUMMARIES: Record<ShipSealPackageId, string> = {
  'client-handoff': 'Client report, executive summary, readiness decision, roadmap, and delivery manifest.',
  'launch-readiness': 'Go/no-go readiness, quality gates, AI Act pre-screen, and client next steps.',
  'safety-risk': 'Env/secrets signals, data/privacy checklist, red-team prompts, and risk summary.',
  'agent-readiness': 'AGENTS.md, CLAUDE.md, Codex guidance, repo context, agent safety notes, and tooling recommendations.',
  'testing-red-team': 'Testing plan, eval cases, red-team prompts, quality gates, and CI/test recommendations.',
  'rescue-refactor': 'Prioritized fix roadmap, review guidance, and repository context for cleanup.',
  'sales-present': 'Client-facing report, executive summary, transparency draft, and presentation context.',
  'mcp-readiness': 'MCP readiness, MCP security policy, tool allowlist, and server recommendations.',
  'ai-act-transparency': 'Transparency notice, AI Act readiness checklist, user-facing disclosure notes, and legal review questions.',
  'full-package': 'Everything ShipSeal can generate across handoff, agents, testing, safety, MCP, and transparency.',
};

const GOAL_READINESS_PR_PATHS: Record<ShipSealPackageId, string[]> = {
  'client-handoff': [
    'docs/HANDOFF_CHECKLIST.md',
    'docs/OWNERSHIP.md',
    'docs/RELEASE_CHECKLIST.md',
  ],
  'launch-readiness': [
    'CONTRIBUTING.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/CRITICAL_FILES_POLICY.md',
    'docs/OWNERSHIP.md',
    'docs/shipseal/CI_QUALITY_GATE.example.yml',
  ],
  'safety-risk': [
    'SECURITY.md',
    'docs/CRITICAL_FILES_POLICY.md',
    'docs/OWNERSHIP.md',
  ],
  'agent-readiness': [
    'AGENTS.md',
    'CLAUDE.md',
    'docs/CRITICAL_FILES_POLICY.md',
  ],
  'testing-red-team': [
    'CONTRIBUTING.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/shipseal/CI_QUALITY_GATE.example.yml',
  ],
  'rescue-refactor': [
    'AGENTS.md',
    'docs/AGENT_CHANGE_POLICY.md',
    'docs/CRITICAL_FILES_POLICY.md',
    'docs/OWNERSHIP.md',
  ],
  'sales-present': [
    'docs/HANDOFF_CHECKLIST.md',
    'docs/AI_ACT_READINESS_NOTES.md',
  ],
  'mcp-readiness': [
    'docs/CRITICAL_FILES_POLICY.md',
    'docs/OWNERSHIP.md',
  ],
  'ai-act-transparency': [
    'docs/AI_ACT_READINESS_NOTES.md',
    'docs/HANDOFF_CHECKLIST.md',
    'docs/CRITICAL_FILES_POLICY.md',
  ],
  'full-package': [],
};

export interface DeliveryPackFocus {
  selectedGoals: Array<{ id: ShipSealPackageId; title: string }>;
  emphasizedPaths: string[];
  generatedPaths: string[];
  manifestPaths: string[];
  readinessPrPaths: string[];
  fullPackage: boolean;
  packageLabel: string;
  packageSummary: string;
}

interface DeliveryPackFocusOptions {
  folderAgentPaths?: string[];
}

export function resolveDeliveryPackFocus(selectedPackages: string[] = [], options: DeliveryPackFocusOptions = {}): DeliveryPackFocus {
  const selectedGoals = resolveSelectedPackages(selectedPackages);
  const allPaths = getDeliveryPackRequiredPaths();
  const fullPackage = selectedGoals.includes(FULL_PACKAGE_ID);
  const folderAgentPaths = uniquePaths(options.folderAgentPaths || []);
  const staticPaths = fullPackage
    ? allPaths
    : uniquePaths(selectedGoals.flatMap(goal => GOAL_OUTPUT_PATHS[goal])).filter(path => allPaths.includes(path));
  const generatedPaths = uniquePaths([
    ...staticPaths,
    ...(fullPackage || selectedGoals.includes('agent-readiness') ? folderAgentPaths : []),
  ]);
  const allReadinessPrPaths = uniquePaths(Object.entries(GOAL_READINESS_PR_PATHS)
    .filter(([id]) => id !== FULL_PACKAGE_ID)
    .flatMap(([, paths]) => paths));
  const readinessPrPaths = fullPackage
    ? allReadinessPrPaths
    : uniquePaths(selectedGoals.flatMap(goal => GOAL_READINESS_PR_PATHS[goal]));
  const selectedGoalSummaries = selectedGoals.map(id => GOAL_SUMMARIES[id]);

  return {
    selectedGoals: selectedGoals.map(id => ({ id, title: getShipSealPackage(id)?.title || id })),
    emphasizedPaths: generatedPaths,
    generatedPaths,
    manifestPaths: generatedPaths,
    readinessPrPaths,
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

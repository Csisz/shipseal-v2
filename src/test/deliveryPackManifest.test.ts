import { describe, expect, it } from 'vitest';
import {
  SHIPSEAL_DELIVERY_PACK_MANIFEST,
  getDeliveryPackFileContracts,
  getDeliveryPackRequiredPaths,
} from '@/lib/deliveryPack';

const REQUIRED_PATHS = [
  '01-agent-instructions/AGENTS.md',
  '01-agent-instructions/CLAUDE.md',
  '01-agent-instructions/AGENT_COST_OPTIMIZATION.md',
  '01-agent-instructions/CODEX_PROMPTS.md',
  '01-agent-instructions/CURSOR_RULES.md',
  '01-agent-instructions/REVIEWER_PROMPT.md',
  '01-agent-instructions/AGENT_SAFETY_NOTES.md',
  '02-skills/code-review/SKILL.md',
  '02-skills/test-generation/SKILL.md',
  '02-skills/ai-act-readiness/SKILL.md',
  '02-skills/release-check/SKILL.md',
  '02-skills/client-handoff/SKILL.md',
  '03-mcp-governance/MCP_READINESS.md',
  '03-mcp-governance/MCP_SECURITY_POLICY.md',
  '03-mcp-governance/MCP_SERVER_RECOMMENDATIONS.md',
  '03-mcp-governance/MCP_TOOL_ALLOWLIST.md',
  '04-testing/EVAL_TEST_CASES.md',
  '04-testing/RED_TEAM_PROMPTS.md',
  '04-testing/TESTING_STRATEGY.md',
  '04-testing/CI_QUALITY_GATE.yml',
  '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md',
  '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md',
  '05-ai-act-readiness/USER_FACING_DISCLOSURE_NOTES.md',
  '05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md',
  '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
  '06-client-handoff/CLIENT_HANDOFF_REPORT.html',
  '06-client-handoff/EXECUTIVE_SUMMARY.md',
  '06-client-handoff/NEXT_STEPS_ROADMAP.md',
  '06-client-handoff/DELIVERY_MANIFEST.md',
  '07-context/REPOSITORY_HEALTH.md',
  '07-context/REPO_CONTEXT_PACK.md',
  '07-context/repo-context-pack.json',
  '07-context/ARCHITECTURE.md',
  '07-context/CRITICAL_FILES.md',
  '07-context/COMMAND_MAP.md',
  '07-context/KNOWN_RISKS.md',
  '07-context/TASK_ROUTER.md',
  '07-context/GLOBAL_CONTEXT.md',
  '07-context/QA_CONTEXT.md',
  '07-context/SECURITY_CONTEXT.md',
  '07-context/DOCS_CONTEXT.md',
  '07-context/MCP_CONTEXT.md',
  '07-context/SKILL_RECOMMENDATIONS.md',
  '07-context/MCP_RECOMMENDATIONS.md',
  '08-security-data/SECURITY_NOTES.md',
  '08-security-data/ENV_SECRETS_FINDINGS.md',
  '08-security-data/DATA_PRIVACY_CHECKLIST.md',
  '08-security-data/RISK_SUMMARY.md',
  '08-security-data/HUMAN_APPROVAL_REVIEWERS.md',
  'score.json',
];

describe('ShipSeal Delivery Pack manifest', () => {
  it('contains every required MVP output file', () => {
    const paths = getDeliveryPackRequiredPaths();

    expect(SHIPSEAL_DELIVERY_PACK_MANIFEST.product).toBe('ShipSeal');
    expect(SHIPSEAL_DELIVERY_PACK_MANIFEST.packNameTemplate).toBe('shipseal-delivery-pack-[project]');
    expect(SHIPSEAL_DELIVERY_PACK_MANIFEST.version).toBe(2);
    expect(paths).toEqual(REQUIRED_PATHS);
  });

  it('contains score.json and the required delivery artifacts', () => {
    const paths = getDeliveryPackRequiredPaths();

    expect(paths).toContain('score.json');
    expect(paths).toContain('04-testing/EVAL_TEST_CASES.md');
    expect(paths).toContain('04-testing/RED_TEAM_PROMPTS.md');
    expect(paths).toContain('06-client-handoff/CLIENT_HANDOFF_REPORT.md');
    expect(paths).toContain('06-client-handoff/CLIENT_HANDOFF_REPORT.html');
    expect(paths).toContain('07-context/REPOSITORY_HEALTH.md');
  });

  it('contains at least five SKILL.md files', () => {
    const skillFiles = getDeliveryPackRequiredPaths().filter(path => path.endsWith('/SKILL.md'));

    expect(skillFiles.length).toBeGreaterThanOrEqual(5);
  });

  it('does not contain duplicate paths', () => {
    const paths = getDeliveryPackRequiredPaths();
    const uniquePaths = new Set(paths);

    expect(uniquePaths.size).toBe(paths.length);
  });

  it('marks every manifest entry as required', () => {
    const files = getDeliveryPackFileContracts();

    expect(files.every(file => file.required)).toBe(true);
  });
});

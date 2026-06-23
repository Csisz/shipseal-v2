import type {
  DeliveryPackFileContract,
  DeliveryPackFileKind,
  DeliveryPackManifest,
  DeliveryPackSectionContract,
  DeliveryPackSectionId,
} from './types';

function file(sectionId: DeliveryPackSectionId, folder: string, filename: string, kind: DeliveryPackFileKind = 'markdown'): DeliveryPackFileContract {
  return {
    path: folder ? `${folder}/${filename}` : filename,
    filename,
    sectionId,
    kind,
    required: true,
  };
}

function section(id: DeliveryPackSectionId, folder: string, label: string, filenames: Array<string | [string, DeliveryPackFileKind]>): DeliveryPackSectionContract {
  return {
    id,
    folder,
    label,
    files: filenames.map(entry => {
      const [filename, kind] = Array.isArray(entry) ? entry : [entry, undefined];
      return file(id, folder, filename, kind);
    }),
  };
}

export const SHIPSEAL_DELIVERY_PACK_MANIFEST: DeliveryPackManifest = {
  product: 'ShipSeal',
  packNameTemplate: 'shipseal-delivery-pack-[project]',
  version: 1,
  sections: [
    section('agent-instructions', '01-agent-instructions', 'Agent instructions', [
      'AGENTS.md',
      'CLAUDE.md',
      'AGENT_COST_OPTIMIZATION.md',
      'CODEX_PROMPTS.md',
      'CURSOR_RULES.md',
      'REVIEWER_PROMPT.md',
      'AGENT_SAFETY_NOTES.md',
    ]),
    section('skills', '02-skills', 'Skills', [
      'code-review/SKILL.md',
      'test-generation/SKILL.md',
      'ai-act-readiness/SKILL.md',
      'release-check/SKILL.md',
      'client-handoff/SKILL.md',
    ]),
    section('mcp-governance', '03-mcp-governance', 'MCP governance', [
      'MCP_READINESS.md',
      'MCP_SECURITY_POLICY.md',
      'MCP_SERVER_RECOMMENDATIONS.md',
      'MCP_TOOL_ALLOWLIST.md',
    ]),
    section('testing', '04-testing', 'Testing', [
      'EVAL_TEST_CASES.md',
      'RED_TEAM_PROMPTS.md',
      'TESTING_STRATEGY.md',
      ['CI_QUALITY_GATE.yml', 'yaml'],
    ]),
    section('ai-act-readiness', '05-ai-act-readiness', 'AI Act readiness', [
      'AI_ACT_READINESS_CHECKLIST.md',
      'TRANSPARENCY_NOTICE_DRAFT.md',
      'USER_FACING_DISCLOSURE_NOTES.md',
      'LEGAL_REVIEW_QUESTIONS.md',
    ]),
    section('client-handoff', '06-client-handoff', 'Client handoff', [
      'CLIENT_HANDOFF_REPORT.md',
      ['CLIENT_HANDOFF_REPORT.html', 'html'],
      'EXECUTIVE_SUMMARY.md',
      'NEXT_STEPS_ROADMAP.md',
      'DELIVERY_MANIFEST.md',
    ]),
    section('context', '07-context', 'Context', [
      'REPO_CONTEXT_PACK.md',
      ['repo-context-pack.json', 'json'],
    ]),
    section('security-data', '08-security-data', 'Security and data pre-screen', [
      'SECURITY_NOTES.md',
      'ENV_SECRETS_FINDINGS.md',
      'DATA_PRIVACY_CHECKLIST.md',
      'RISK_SUMMARY.md',
      'HUMAN_APPROVAL_REVIEWERS.md',
    ]),
  ],
  rootFiles: [
    file('root', '', 'score.json', 'json'),
  ],
};

export function getDeliveryPackFileContracts(manifest: DeliveryPackManifest = SHIPSEAL_DELIVERY_PACK_MANIFEST): DeliveryPackFileContract[] {
  return [
    ...manifest.sections.flatMap(sectionContract => sectionContract.files),
    ...manifest.rootFiles,
  ];
}

export function getDeliveryPackRequiredPaths(manifest: DeliveryPackManifest = SHIPSEAL_DELIVERY_PACK_MANIFEST): string[] {
  return getDeliveryPackFileContracts(manifest).map(fileContract => fileContract.path);
}

import type { ProjectIntake } from '../intake';

export type SkillPackPath =
  | '02-skills/code-review/SKILL.md'
  | '02-skills/test-generation/SKILL.md'
  | '02-skills/ai-act-readiness/SKILL.md'
  | '02-skills/release-check/SKILL.md'
  | '02-skills/client-handoff/SKILL.md';

export type SkillsPackFiles = Record<SkillPackPath, string>;

interface SkillSpec {
  path: SkillPackPath;
  title: string;
  whenToUse: string;
  inputs: string[];
  steps: string[];
  output: string[];
  guardrails: string[];
}

export function generateSkillsPackFiles(intake: ProjectIntake): SkillsPackFiles {
  const specs = skillSpecs(intake);
  return specs.reduce((files, spec) => {
    files[spec.path] = renderSkill(spec, intake);
    return files;
  }, {} as SkillsPackFiles);
}

function skillSpecs(intake: ProjectIntake): SkillSpec[] {
  const app = valueOrFallback(intake.appDescription, 'the scanned application');
  const useCase = valueOrFallback(intake.aiUseCase, 'the AI-assisted workflow');

  return [
    {
      path: '02-skills/code-review/SKILL.md',
      title: 'ShipSeal Code Review Skill',
      whenToUse: 'Use when reviewing a proposed code change, generated patch, or pull request before delivery.',
      inputs: ['Diff or changed files', 'AGENTS.md', 'score.json', 'TESTING_STRATEGY.md', 'Known critical blockers'],
      steps: [
        'Read the task intent and affected files before judging the change.',
        'Check correctness, security, regressions, and whether the change respects repository instructions.',
        'Verify that generated/vendor files and secrets were not touched unexpectedly.',
        'Map findings to concrete file paths or missing verification evidence.',
      ],
      output: ['Verdict: approve, request-changes, or block', 'Top findings ordered by severity', 'Tests or commands that should be run', 'Residual risks for handoff'],
      guardrails: ['Do not invent test results.', 'Do not approve changes that hide critical blockers.', 'Do not expose secrets or raw private context.'],
    },
    {
      path: '02-skills/test-generation/SKILL.md',
      title: 'ShipSeal Test Generation Skill',
      whenToUse: 'Use when adding or improving tests for the app, AI workflow, or Delivery Pack outputs.',
      inputs: ['EVAL_TEST_CASES.md', 'RED_TEAM_PROMPTS.md', 'TESTING_STRATEGY.md', 'Target module or workflow', `AI use case: ${useCase}`],
      steps: [
        'Identify the user journey or module under test.',
        'Select happy path, edge case, hallucination, prompt injection, privacy, boundary, and regression checks as relevant.',
        'Write focused tests using the project test framework and existing style.',
        'Keep generated tests deterministic and avoid calling external AI APIs.',
      ],
      output: ['Test file changes or test plan', 'Coverage summary by category', 'Commands to run', 'Known gaps that remain'],
      guardrails: ['Do not add brittle tests that depend on live AI responses.', 'Use synthetic data for privacy and red-team cases.', 'Do not weaken existing assertions.'],
    },
    {
      path: '02-skills/ai-act-readiness/SKILL.md',
      title: 'ShipSeal AI Act Readiness Skill',
      whenToUse: 'Use when preparing preliminary AI Act, transparency, privacy, or human oversight review materials.',
      inputs: ['AI_ACT_READINESS_CHECKLIST.md', 'TRANSPARENCY_NOTICE_DRAFT.md', 'LEGAL_REVIEW_QUESTIONS.md', `App description: ${app}`, `AI use case: ${useCase}`],
      steps: [
        'Summarize intake signals without claiming compliance.',
        'Flag EU use, user-facing AI output, personal data, and missing human approval.',
        'Prepare questions for legal, privacy, and compliance reviewers.',
        'Keep legal conclusions explicitly out of scope.',
      ],
      output: ['Preliminary readiness notes', 'Transparency and privacy review questions', 'Human oversight risks', 'Reviewer-ready open questions'],
      guardrails: ['This is not legal advice. Ez nem jogi tanácsadás.', 'Do not certify compliance.', 'Escalate final classification to qualified legal review.'],
    },
    {
      path: '02-skills/release-check/SKILL.md',
      title: 'ShipSeal Release Check Skill',
      whenToUse: 'Use before packaging, shipping, or handing off the Delivery Pack to a client or implementation team.',
      inputs: ['score.json', 'CLIENT_HANDOFF_REPORT.md', 'TESTING_STRATEGY.md', 'MCP_SECURITY_POLICY.md', 'Critical blockers and warnings'],
      steps: [
        'Confirm all required manifest files are present and non-empty.',
        'Confirm score.json is valid JSON and critical blockers are visible.',
        'Review testing, AI Act, MCP, and client handoff sections for unresolved risks.',
        'List release blockers separately from optional improvements.',
      ],
      output: ['Release readiness verdict', 'Blocking issues', 'Recommended next actions', 'Client-facing risk summary'],
      guardrails: ['Do not hide material risk for presentation polish.', 'Do not mark blocked work as ready.', 'Do not run destructive commands.'],
    },
    {
      path: '02-skills/client-handoff/SKILL.md',
      title: 'ShipSeal Client Handoff Skill',
      whenToUse: 'Use when turning technical scan and readiness outputs into a clear client-facing handoff.',
      inputs: ['CLIENT_HANDOFF_REPORT.md', 'EXECUTIVE_SUMMARY.md', 'NEXT_STEPS_ROADMAP.md', 'score.json', `Client: ${valueOrFallback(intake.clientName, 'not specified')}`],
      steps: [
        'Translate technical findings into plain language.',
        'Separate what is ready, what is risky, and what needs a decision.',
        'Keep recommendations actionable and scoped to the client delivery moment.',
        'Preserve safety, privacy, legal, and human oversight caveats.',
      ],
      output: ['Short executive summary', 'Client-ready handoff notes', 'Prioritized roadmap', 'Decision log or open questions'],
      guardrails: ['Do not overstate readiness.', 'Do not remove disclaimers or unresolved risks.', 'Use respectful, client-friendly wording.'],
    },
  ];
}

function renderSkill(spec: SkillSpec, intake: ProjectIntake) {
  return [
    `# ${spec.title}`,
    '',
    'Generated by ShipSeal.',
    '',
    '## When to use',
    spec.whenToUse,
    '',
    '## Inputs',
    ...spec.inputs.map(input => `- ${input}`),
    '',
    '## Steps',
    ...spec.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Output',
    ...spec.output.map(item => `- ${item}`),
    '',
    '## Guardrails',
    ...spec.guardrails.map(item => `- ${item}`),
    '',
    '## ShipSeal context',
    `- Project: ${intake.projectName}`,
    `- App description: ${valueOrFallback(intake.appDescription, 'not specified')}`,
    `- AI use case: ${valueOrFallback(intake.aiUseCase, 'not specified')}`,
    `- EU use: ${yesNo(intake.usedInEU)}`,
    `- Personal data: ${yesNo(intake.handlesPersonalData)}`,
    `- Human approval: ${yesNo(intake.hasHumanApproval)}`,
    '',
  ].join('\n');
}

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

function valueOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

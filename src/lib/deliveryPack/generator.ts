import type { AgentPackFile, MCPPolicyFile } from '../types';
import { normalizeProjectIntake } from '../intake';
import type { PartialProjectIntake, ProjectIntake } from '../intake';
import { generateAiActReadinessFiles } from './aiActReadiness';
import { generateTestingPackFiles } from './testingPack';
import { generateSkillsPackFiles } from './skillsPack';
import { generateClientHandoffFiles } from './clientHandoff';
import { generateClientReportHtml } from '../report';
import {
  SHIPSEAL_DELIVERY_PACK_MANIFEST,
  getDeliveryPackFileContracts,
} from './manifest';
import { resolveDeliveryPackFocus } from './goalMapping';
import type { DeliveryPackGeneratedFile, DeliveryPackManifest } from './types';

export interface BuildDeliveryPackFilesInput {
  agentFiles: AgentPackFile[];
  mcpFiles?: MCPPolicyFile[];
  contextFiles?: { markdown: string; json: unknown };
  repositoryName?: string;
  scoreJson?: unknown;
  intake?: PartialProjectIntake;
  manifest?: DeliveryPackManifest;
  selectedPackages?: string[];
}

export function buildDeliveryPackFiles(input: BuildDeliveryPackFilesInput): DeliveryPackGeneratedFile[] {
  const manifest = input.manifest || SHIPSEAL_DELIVERY_PACK_MANIFEST;
  const projectName = resolveProjectName(input);
  const intake = normalizeProjectIntake(input.intake, projectName);
  const agentFileByName = new Map(input.agentFiles.map(file => [file.name, file]));
  const mcpFileByName = new Map((input.mcpFiles || []).map(file => [file.filename, file]));
  const focus = resolveDeliveryPackFocus(resolveSelectedPackagesForExport(input.selectedPackages, input.scoreJson));
  const generatedPathSet = new Set(focus.generatedPaths);

  return getDeliveryPackFileContracts(manifest).filter(fileContract => generatedPathSet.has(fileContract.path)).map(fileContract => {
    const sourceContent = resolveSourceContent(fileContract.path, fileContract.filename, {
      agentFileByName,
      mcpFileByName,
      contextFiles: input.contextFiles,
      intake,
      scoreJson: input.scoreJson,
    });

    return {
      path: fileContract.path,
      kind: fileContract.kind,
      content: withGeneratedContent(sourceContent, projectName, fileContract.path, fileContract.kind),
    };
  });
}

function resolveProjectName(input: BuildDeliveryPackFilesInput): string {
  if (input.intake?.projectName?.trim()) return input.intake.projectName.trim();
  if (input.repositoryName?.trim()) return input.repositoryName.trim();

  const scoreRepositoryName = objectValue(input.scoreJson, 'repositoryName');
  if (scoreRepositoryName) return scoreRepositoryName;

  const contextRepositoryName = objectValue(input.contextFiles?.json, 'repositoryName');
  if (contextRepositoryName) return contextRepositoryName;

  return 'repository';
}

function objectValue(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return typeof record[key] === 'string' && record[key].trim() ? record[key].trim() : undefined;
}

function selectedPackagesFromScoreJson(scoreJson: unknown): string[] {
  const source = scoreJson && typeof scoreJson === 'object' ? scoreJson as Record<string, unknown> : {};
  const focus = source.deliveryPackFocus && typeof source.deliveryPackFocus === 'object'
    ? source.deliveryPackFocus as Record<string, unknown>
    : {};
  const selectedGoals = Array.isArray(focus.selectedGoals) ? focus.selectedGoals : [];
  return selectedGoals
    .map(goal => goal && typeof goal === 'object' ? (goal as Record<string, unknown>).id : undefined)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

function resolveSelectedPackagesForExport(selectedPackages: string[] | undefined, scoreJson: unknown): string[] {
  return selectedPackages && selectedPackages.length > 0
    ? selectedPackages
    : selectedPackagesFromScoreJson(scoreJson);
}

function resolveSourceContent(
  path: string,
  filename: string,
  input: {
    agentFileByName: Map<string, AgentPackFile>;
    mcpFileByName: Map<string, MCPPolicyFile>;
    contextFiles?: { markdown: string; json: unknown };
    intake: ProjectIntake;
    scoreJson?: unknown;
  }
): string | unknown {
  const projectName = input.intake.projectName;
  const aiActFiles = generateAiActReadinessFiles(input.intake);
  const testingPackFiles = generateTestingPackFiles(input.intake, input.agentFileByName.get('TESTING_STRATEGY.md')?.content);
  const skillsPackFiles = generateSkillsPackFiles(input.intake);
  const clientHandoffFiles = generateClientHandoffFiles(input.intake, input.scoreJson);

  if (path.startsWith('01-agent-instructions/')) {
    if (path === '01-agent-instructions/CURSOR_RULES.md') return cursorRules(projectName);
    if (path === '01-agent-instructions/AGENT_SAFETY_NOTES.md') return agentSafetyNotes(projectName);
    return input.agentFileByName.get(filename)?.content || markdownPlaceholder(filename, projectName, [
      'This v1 instruction file is included to keep the ShipSeal Delivery Pack complete.',
      'Use it as a review surface for repository-specific operating rules before client handoff.',
    ]);
  }

  if (path.startsWith('02-skills/')) {
    return skillsPackFiles[path as keyof typeof skillsPackFiles] || markdownPlaceholder(filename, projectName, [
      'This v1 skill file is included to keep the ShipSeal Delivery Pack complete.',
      'Review the skill before using it in a live agent workflow.',
    ]);
  }

  if (path.startsWith('03-mcp-governance/')) {
    const mcpContent = input.mcpFileByName.get(filename)?.content || markdownPlaceholder(filename, projectName, [
      'This v1 MCP governance file is included to keep the ShipSeal Delivery Pack complete.',
      'Use read-only defaults, least-privilege access, and human approval for high-risk tool access.',
    ]);
    return path === '03-mcp-governance/MCP_READINESS.md'
      ? appendMcpIntakeContext(mcpContent, input.intake)
      : mcpContent;
  }

  if (path === '04-testing/TESTING_STRATEGY.md') {
    return testingPackFiles.testingStrategy;
  }

  if (path === '04-testing/CI_QUALITY_GATE.yml') {
    return input.agentFileByName.get('CI_QUALITY_GATE.yml')?.content || ciPlaceholder(projectName);
  }

  if (path === '04-testing/EVAL_TEST_CASES.md') return testingPackFiles.evalTestCases;
  if (path === '04-testing/RED_TEAM_PROMPTS.md') return testingPackFiles.redTeamPrompts;

  if (path === '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md') return aiActFiles.checklist;
  if (path === '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md') return aiActFiles.transparencyNotice;
  if (path === '05-ai-act-readiness/USER_FACING_DISCLOSURE_NOTES.md') return disclosureNotes(projectName, input.intake);
  if (path === '05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md') return aiActFiles.legalReviewQuestions;
  if (path === '06-client-handoff/CLIENT_HANDOFF_REPORT.md') return clientHandoffFiles.clientHandoffReport;
  if (path === '06-client-handoff/CLIENT_HANDOFF_REPORT.html') return generateClientReportHtml({ intake: input.intake, scoreJson: input.scoreJson });
  if (path === '06-client-handoff/EXECUTIVE_SUMMARY.md') return clientHandoffFiles.executiveSummary;
  if (path === '06-client-handoff/NEXT_STEPS_ROADMAP.md') return clientHandoffFiles.nextStepsRoadmap;
  if (path === '06-client-handoff/DELIVERY_MANIFEST.md') return deliveryManifest(projectName, input.scoreJson);

  if (path === '07-context/REPO_CONTEXT_PACK.md') {
    return input.contextFiles?.markdown || markdownPlaceholder('REPO_CONTEXT_PACK.md', projectName, [
      'No repository context summary was available for this export.',
      'Re-run the scan with a repository ZIP or public GitHub repository to populate context signals.',
    ]);
  }

  if (path === '07-context/repo-context-pack.json') {
    return input.contextFiles?.json || { repositoryName: projectName, contextAvailable: false };
  }

  if (path === 'score.json') {
    return input.scoreJson || { repositoryName: projectName, scoreAvailable: false };
  }

  if (path.startsWith('08-security-data/')) {
    return securityDataFile(path, projectName, input.intake, input.scoreJson);
  }

  return markdownPlaceholder(filename, projectName, [
    'This v1 output is included to keep the ShipSeal Delivery Pack complete.',
    'Review and enrich it during client handoff preparation.',
  ]);
}

function withGeneratedContent(content: string | unknown, projectName: string, path: string, kind: DeliveryPackGeneratedFile['kind']) {
  if (kind === 'json') return withJsonMetadata(content, projectName, path);
  if (kind === 'html') return typeof content === 'string' ? content.trim() : String(content ?? fallbackText(path, projectName));
  return withTextHeader(content, projectName, path, kind);
}

function withTextHeader(content: string | unknown, projectName: string, path: string, kind: 'markdown' | 'yaml') {
  const text = typeof content === 'string' ? content.trim() : JSON.stringify(content, null, 2);
  const header = kind === 'yaml'
    ? [
        `# ShipSeal Delivery Pack - ${path}`,
        `# Project: ${projectName}`,
        '# Generated by ShipSeal.',
        '',
      ]
    : [
        `# ShipSeal Delivery Pack - ${path}`,
        '',
        `Project: ${projectName}`,
        '',
        'Generated by ShipSeal.',
        '',
      ];

  return `${header.join('\n')}${text || fallbackText(path, projectName)}`;
}

function withJsonMetadata(content: string | unknown, projectName: string, path: string) {
  const value = typeof content === 'string' ? safeJsonParse(content) : content;
  const valueRecord = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const focus = valueRecord.deliveryPackFocus && typeof valueRecord.deliveryPackFocus === 'object'
    ? valueRecord.deliveryPackFocus as Record<string, unknown>
    : {};
  const payload = {
    product: 'ShipSeal',
    title: `ShipSeal Delivery Pack - ${path}`,
    projectName,
    generatedBy: 'Generated by ShipSeal',
    selectedPackage: typeof focus.packageLabel === 'string' ? focus.packageLabel : undefined,
    outputCount: typeof valueRecord.outputCount === 'number' ? valueRecord.outputCount : undefined,
    content: value ?? {},
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return { text: content };
  }
}

function fallbackText(path: string, projectName: string) {
  return `ShipSeal generated ${path} for ${projectName}. Review this v1 content before client delivery.`;
}

function markdownPlaceholder(title: string, projectName: string, bullets: string[]) {
  return [
    `# ${title} - ${projectName}`,
    '',
    'Generated by ShipSeal.',
    '',
    '## Purpose',
    ...bullets.map(bullet => `- ${bullet}`),
    '',
  ].join('\n');
}

function ciPlaceholder(projectName: string) {
  return [
    `# ShipSeal CI quality gate for ${projectName}`,
    '# Generated by ShipSeal.',
    'name: ShipSeal Quality Gate',
    'on:',
    '  pull_request:',
    'jobs:',
    '  quality:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - run: echo "Run project-specific ShipSeal verification commands here"',
    '',
  ].join('\n');
}

function cursorRules(projectName: string) {
  return [
    `# Cursor Guidance - ${projectName}`,
    '',
    'Generated by ShipSeal.',
    '',
    '## Focus',
    '- Start with AGENTS.md, CLAUDE.md, and the repo context pack.',
    '- Keep edits narrow and reviewable.',
    '- Prefer project scripts detected by ShipSeal over guessed commands.',
    '- Do not execute uploaded or imported repository code outside normal reviewed commands.',
    '',
  ].join('\n');
}

function agentSafetyNotes(projectName: string) {
  return [
    `# Agent Safety Notes - ${projectName}`,
    '',
    'Generated by ShipSeal.',
    '',
    '## Safety Rules',
    '- Escalate auth, payment, security, privacy, deployment, and client-facing claims for human review.',
    '- Treat generated reports and Delivery Pack files as review drafts.',
    '- Keep CI/test recommendations as examples unless a maintainer explicitly enables them.',
    '',
  ].join('\n');
}

function disclosureNotes(projectName: string, intake: ProjectIntake) {
  return [
    `# User-Facing Disclosure Notes - ${projectName}`,
    '',
    'Generated by ShipSeal.',
    '',
    '## Draft Disclosure Inputs',
    `- AI use case: ${valueOrNotProvided(intake.aiUseCase)}`,
    `- Target users: ${valueOrNotProvided(intake.targetUsers)}`,
    `- User-facing AI output: ${intakeSignal(intake.generatesUserFacingContent)}`,
    `- EU use signal: ${intakeSignal(intake.usedInEU)}`,
    '',
    '## Review Notes',
    '- Explain when users are interacting with AI-generated or AI-assisted output.',
    '- Explain whether a human reviews important outputs before client or end-user delivery.',
    '- This is product documentation support, not legal advice.',
    '',
  ].join('\n');
}

function deliveryManifest(projectName: string, scoreJson: unknown) {
  const score = scoreJson && typeof scoreJson === 'object' ? scoreJson as Record<string, unknown> : {};
  const focus = score.deliveryPackFocus && typeof score.deliveryPackFocus === 'object'
    ? score.deliveryPackFocus as Record<string, unknown>
    : {};
  const source = score.source && typeof score.source === 'object' ? score.source as Record<string, unknown> : {};
  const evidence = score.scanEvidence && typeof score.scanEvidence === 'object' ? score.scanEvidence as Record<string, unknown> : {};
  const packageLabel = typeof focus.packageLabel === 'string' ? focus.packageLabel : 'Full ShipSeal package';
  const files = Array.isArray(score.generatedFiles) ? score.generatedFiles.filter((file): file is string => typeof file === 'string') : [];
  const repositoryName = stringField(score, 'repositoryName') || projectName;
  const branchOrRef = stringField(evidence, 'branchOrRef') || stringField(source, 'githubBranch') || stringField(source, 'githubDefaultBranch') || 'default ref';
  const readinessScore = typeof score.score === 'number' ? `${score.score}/100` : 'Not available';
  const readinessDecision = stringField(score, 'status') || 'Not available';
  const sourceType = stringField(evidence, 'sourceType') || stringField(source, 'sourceType') || 'unknown source';
  const analyzedFiles = numberOrUnknown(evidence.analyzedFileCount);
  const discoveredFiles = numberOrUnknown(evidence.discoveredFileCount);
  const warningCount = numberOrUnknown(evidence.warningCount);

  return [
    `# Delivery Manifest - ${projectName}`,
    '',
    'Generated by ShipSeal.',
    '',
    `Project: ${projectName}`,
    `Repository: ${repositoryName}`,
    `Branch / ref: ${branchOrRef}`,
    `Selected package: ${packageLabel}`,
    `Output count: ${typeof score.outputCount === 'number' ? score.outputCount : files.length}`,
    `Readiness score: ${readinessScore}`,
    `Readiness decision: ${readinessDecision}`,
    '',
    '## Scan Evidence',
    `- Source: ${sourceType}`,
    `- Files analyzed: ${analyzedFiles}`,
    `- Files discovered: ${discoveredFiles}`,
    `- Warnings: ${warningCount}`,
    `- Code execution: ShipSeal did not execute repository code.`,
    '',
    '## Generated Outputs',
    ...(files.length ? files.map(file => `- ${file}`) : ['- score.json']),
    '',
  ].join('\n');
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberOrUnknown(value: unknown) {
  return typeof value === 'number' ? String(value) : 'unknown';
}

function securityDataFile(path: string, projectName: string, intake: ProjectIntake, scoreJson: unknown) {
  const score = scoreJson && typeof scoreJson === 'object' ? scoreJson as Record<string, unknown> : {};
  const blockers = Array.isArray(score.criticalBlockers) ? score.criticalBlockers : [];
  const common = [
    `Project: ${projectName}`,
    `Client: ${valueOrNotProvided(intake.clientName)}`,
    `Handles personal data: ${intakeSignal(intake.handlesPersonalData)}`,
    `Human approval/reviewer ownership: ${intakeSignal(intake.hasHumanApproval)}`,
    '',
  ];

  if (path.endsWith('ENV_SECRETS_FINDINGS.md')) {
    return [
      '# Environment And Secrets Findings',
      '',
      ...common,
      '- Review `.env`, credentials, tokens, and deployment secrets before delivery.',
      '- Confirm `.env.example` contains only safe placeholder values.',
      '',
    ].join('\n');
  }

  if (path.endsWith('DATA_PRIVACY_CHECKLIST.md')) {
    return [
      '# Data And Privacy Checklist',
      '',
      ...common,
      '- Confirm what personal, sensitive, or business-critical data may be processed.',
      '- Confirm retention, deletion, logging, and third-party processor notes.',
      '- Confirm privacy/GDPR review where relevant.',
      '',
    ].join('\n');
  }

  if (path.endsWith('RISK_SUMMARY.md')) {
    return [
      '# Security/Data Risk Summary',
      '',
      ...common,
      `- Critical blocker count: ${blockers.length}`,
      '- Review authentication, authorization, secret handling, data handling, and deployment risk before client handoff.',
      '',
    ].join('\n');
  }

  if (path.endsWith('HUMAN_APPROVAL_REVIEWERS.md')) {
    return [
      '# Human Approval And Reviewer Ownership',
      '',
      ...common,
      '- Assign product, engineering, security/data, and client handoff reviewers before final delivery.',
      '- Require explicit approval for security, privacy, legal/compliance, auth, payment, and deployment changes.',
      '',
    ].join('\n');
  }

  return [
    '# Security Notes',
    '',
    ...common,
    '- ShipSeal performs static review and does not execute repository code.',
    '- Review env/secrets signals, data handling, human approval, and risk summary before client delivery.',
    '',
  ].join('\n');
}

function appendMcpIntakeContext(content: string, intake: ProjectIntake) {
  return [
    content.trim(),
    '',
    '## Project intake context',
    `- Client: ${valueOrNotProvided(intake.clientName)}`,
    `- Agency: ${valueOrNotProvided(intake.agencyName)}`,
    `- App description: ${valueOrNotProvided(intake.appDescription)}`,
    `- AI use case: ${valueOrNotProvided(intake.aiUseCase)}`,
    `- AI provider/model: ${valueOrNotProvided(intake.aiProvider)} / ${valueOrNotProvided(intake.modelName)}`,
    `- Target users: ${valueOrNotProvided(intake.targetUsers)}`,
    `- EU users intended: ${intakeSignal(intake.usedInEU)}`,
    `- Handles personal, sensitive or business-critical data: ${intakeSignal(intake.handlesPersonalData)}`,
    `- Human review or approval: ${intakeSignal(intake.hasHumanApproval)}`,
    '',
  ].join('\n');
}

function valueOrNotProvided(value?: string) {
  return value?.trim() || 'Not provided';
}

function intakeSignal(value: boolean) {
  return value ? 'yes' : 'Needs confirmation';
}

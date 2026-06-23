import type { AgentOperatingModeId } from '../types';

interface FolderAgentInput {
  projectName: string;
  contextJson?: unknown;
  scoreJson?: unknown;
}

interface FolderAgentSource {
  projectName: string;
  stack: string;
  scripts: Record<string, string>;
  sampleFiles: string[];
  keyFolders: string[];
  operatingMode: string;
}

const FOLDER_AGENT_ROOT = '07-context/folder-agents';

const CANDIDATE_FOLDERS = [
  'src',
  'src/components',
  'src/lib',
  'api',
  'src/test',
  'tests',
  'docs',
] as const;

export function getFolderAgentSuggestionPaths(contextJson?: unknown): string[] {
  const source = buildSource({ projectName: 'repository', contextJson });
  return [
    `${FOLDER_AGENT_ROOT}/root/AGENTS.md`,
    ...CANDIDATE_FOLDERS
      .filter(folder => folderExists(source, folder))
      .map(folder => `${FOLDER_AGENT_ROOT}/${folder}/AGENTS.md`),
  ];
}

export function generateFolderAgentSuggestionFiles(input: FolderAgentInput): Record<string, string> {
  const source = buildSource(input);
  const files: Record<string, string> = {
    [`${FOLDER_AGENT_ROOT}/root/AGENTS.md`]: rootAgent(source),
  };

  for (const folder of CANDIDATE_FOLDERS) {
    if (folderExists(source, folder)) {
      files[`${FOLDER_AGENT_ROOT}/${folder}/AGENTS.md`] = folderAgent(source, folder);
    }
  }

  return files;
}

function buildSource(input: FolderAgentInput): FolderAgentSource {
  const context = asRecord(input.contextJson);
  const score = asRecord(input.scoreJson);
  const mode = asRecord(score.agentOperatingMode);

  return {
    projectName: stringValue(context.repositoryName) || stringValue(score.repositoryName) || input.projectName,
    stack: stringValue(context.detectedStack) || stringValue(asRecord(score.detectedStack).primary) || 'not detected',
    scripts: stringRecord(context.scripts),
    sampleFiles: stringArray(context.sampleFiles),
    keyFolders: stringArray(context.keyFolders),
    operatingMode: stringValue(mode.label) || operatingModeLabel(stringValue(mode.id) as AgentOperatingModeId | ''),
  };
}

function rootAgent(source: FolderAgentSource) {
  return [
    '# AGENTS.md - root suggestion',
    '',
    'Suggested folder-level AGENTS.md files. Review before copying into your repository.',
    '',
    '## Purpose',
    '- Top-level agent operating instructions for this project.',
    '- Use this file together with `07-context/ARCHITECTURE.md` and `07-context/TASK_ROUTER.md`.',
    '',
    '## Project Summary',
    `- Project: ${source.projectName}`,
    `- Detected stack: ${source.stack}`,
    `- Recommended operating mode: ${source.operatingMode}`,
    '',
    '## Operating Rules',
    '- Do not start by reading the whole repository.',
    '- Read `07-context/ARCHITECTURE.md` before opening broad context.',
    '- Use `07-context/TASK_ROUTER.md` to choose the smallest useful file set.',
    '- Keep edits narrow and reviewable.',
    '',
    '## Verification Policy',
    ...verificationBullets(source),
    '',
  ].join('\n');
}

function folderAgent(source: FolderAgentSource, folder: typeof CANDIDATE_FOLDERS[number]) {
  const guidance = folderGuidance(folder);

  return [
    `# AGENTS.md - ${folder} suggestion`,
    '',
    'Suggested folder-level AGENTS.md files. Review before copying into your repository.',
    '',
    `## Scope: ${folder}/`,
    ...guidance.scope.map(item => `- ${item}`),
    '',
    '## Local Rules',
    ...guidance.rules.map(item => `- ${item}`),
    '',
    '## Verification',
    ...guidance.verification.map(item => `- ${item}`),
    ...verificationBullets(source).slice(0, 1),
    '',
  ].join('\n');
}

function folderGuidance(folder: typeof CANDIDATE_FOLDERS[number]) {
  if (folder === 'src/components') {
    return {
      scope: ['Use for UI components and reusable interface pieces.'],
      rules: ['Inspect nearby component tests first if available.', 'Avoid touching data/export logic unless the task requires it.'],
      verification: ['Run focused UI or component tests when available.'],
    };
  }

  if (folder === 'src/lib') {
    return {
      scope: ['Use for core logic, pack generation, scan/report/export helpers, and shared utilities.'],
      rules: ['Avoid broad UI changes from this folder.', 'Keep exported contracts stable unless tests and callers are updated.'],
      verification: ['Run focused unit tests around changed helpers.'],
    };
  }

  if (folder === 'api') {
    return {
      scope: ['Use for API routes and integration boundaries.'],
      rules: ['Do not expose secrets or tokens.', 'Prefer mocked network tests for GitHub App or external-service behavior.'],
      verification: ['Run API-focused tests and check friendly error handling.'],
    };
  }

  if (folder === 'src/test' || folder === 'tests') {
    return {
      scope: ['Use for tests close to changed behavior.'],
      rules: ['Avoid brittle text-only assertions when UI copy may change.', 'Prefer scoped queries and role-based queries for UI tests.'],
      verification: ['Run the smallest relevant test file before broad suites.'],
    };
  }

  if (folder === 'docs') {
    return {
      scope: ['Use for product, governance, and delivery documentation.'],
      rules: ['Keep docs aligned with the current ShipSeal 2.0 product direction.', 'Do not reintroduce deprecated founder-review positioning.'],
      verification: ['Check related dogfooding documentation tests if documentation contract phrases change.'],
    };
  }

  return {
    scope: ['Use for application source files and feature implementation.'],
    rules: ['Open only the files needed for the task.', 'Use TASK_ROUTER.md before expanding into unrelated folders.'],
    verification: ['Prefer focused tests tied to the changed feature.'],
  };
}

function verificationBullets(source: FolderAgentSource) {
  const bullets = [
    source.scripts.test ? `Focused tests: use \`${source.scripts.test}\` or a narrower project-supported variant when available.` : 'Focused tests: no test script was detected.',
    source.scripts.build ? `Full build: use \`${source.scripts.build}\` for production preparation or shared logic changes.` : 'Full build: no build script was detected.',
    'For Token Saver work, list manual verification commands unless the user asks you to run them.',
  ];

  return bullets.map(item => `- ${item}`);
}

function folderExists(source: FolderAgentSource, folder: string) {
  const normalized = normalizeFolder(folder);
  return source.keyFolders.some(keyFolder => normalizeFolder(keyFolder) === normalized)
    || source.sampleFiles.some(path => path === normalized || path.startsWith(`${normalized}/`));
}

function normalizeFolder(folder: string) {
  return folder.replace(/^\.?\//, '').replace(/\/+$/, '');
}

function operatingModeLabel(id: AgentOperatingModeId | '') {
  if (id === 'maximum-reliability') return 'Maximum Reliability';
  if (id === 'token-saver') return 'Token Saver';
  return 'Balanced Productivity';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [];
}

function stringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

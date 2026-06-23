interface ContextCompressionInput {
  projectName: string;
  contextJson?: unknown;
  scoreJson?: unknown;
}

interface ContextSource {
  projectName: string;
  stack: string;
  languages: string[];
  frameworks: string[];
  packageManager: string;
  scripts: Record<string, string>;
  runCommands: Array<{ label: string; cmd: string }>;
  keyFolders: string[];
  sampleFiles: string[];
  ignoredFolders: string[];
  instructionFiles: string[];
  blockers: Array<{ id: string; title: string; detail: string }>;
  improvements: Array<{ id: string; title: string; category?: string }>;
  warnings: string[];
  limitedScan: boolean;
  keyFilesFound: Record<string, boolean>;
}

export function generateContextCompressionFiles(input: ContextCompressionInput): Record<string, string> {
  const source = buildContextSource(input);

  return {
    '07-context/ARCHITECTURE.md': architecture(source),
    '07-context/CRITICAL_FILES.md': criticalFiles(source),
    '07-context/COMMAND_MAP.md': commandMap(source),
    '07-context/KNOWN_RISKS.md': knownRisks(source),
    '07-context/TASK_ROUTER.md': taskRouter(source),
  };
}

function buildContextSource(input: ContextCompressionInput): ContextSource {
  const context = asRecord(input.contextJson);
  const score = asRecord(input.scoreJson);
  const scanSummary = asRecord(score.scanSummary);
  const scanEvidence = asRecord(score.scanEvidence);

  return {
    projectName: stringValue(context.repositoryName) || stringValue(score.repositoryName) || input.projectName,
    stack: stringValue(context.detectedStack) || stringValue(asRecord(score.detectedStack).primary) || 'not detected',
    languages: stringArray(context.languages).length ? stringArray(context.languages) : stringArray(scanEvidence.topLanguages),
    frameworks: stringArray(context.frameworks).length ? stringArray(context.frameworks) : stringArray(scanEvidence.topFrameworks),
    packageManager: stringValue(context.packageManager) || 'not detected',
    scripts: stringRecord(context.scripts),
    runCommands: commandArray(context.runCommands),
    keyFolders: stringArray(context.keyFolders),
    sampleFiles: stringArray(context.sampleFiles),
    ignoredFolders: stringArray(context.ignoredFolders).length ? stringArray(context.ignoredFolders) : stringArray(scanSummary.ignoredGeneratedFolders),
    instructionFiles: stringArray(context.existingInstructionFiles),
    blockers: arrayValue(context.blockers).map(asRecord).map(blocker => ({
      id: stringValue(blocker.id),
      title: stringValue(blocker.title) || 'Readiness risk',
      detail: stringValue(blocker.detail) || 'No detail provided by scan.',
    })),
    improvements: arrayValue(context.improvements).map(asRecord).map(improvement => ({
      id: stringValue(improvement.id),
      title: stringValue(improvement.title) || 'Recommended improvement',
      category: stringValue(improvement.category),
    })),
    warnings: stringArray(asRecord(context.scanSummary).warnings).length
      ? stringArray(asRecord(context.scanSummary).warnings)
      : stringArray(scanSummary.warnings),
    limitedScan: asRecord(context.scanSummary).limited === true || scanEvidence.limitedScan === true || scanSummary.limited === true,
    keyFilesFound: booleanRecord(scanEvidence.keyFilesFound),
  };
}

function architecture(source: ContextSource) {
  const frontend = matchingPaths(source, [/^(src\/)?(app|pages|components)\//i, /^src\/app/i, /^src\/components/i]);
  const backend = matchingPaths(source, [/^(src\/)?api\//i, /\/api\//i, /^server\//i, /^prisma\//i]);
  const docs = matchingPaths(source, [/^readme\.md$/i, /^docs\//i, /^contributing\.md$/i]);
  const tests = matchingPaths(source, [/(\.|-)(test|spec)\.[cm]?[jt]sx?$/i, /(^|\/)(tests?|__tests__)\//i]);

  return [
    '# ARCHITECTURE.md',
    '',
    'Compact project map for AI coding agents. Use this before opening broad repository context.',
    '',
    '## Detected Stack',
    `- Primary stack: ${source.stack}`,
    `- Languages: ${inlineList(source.languages)}`,
    `- Frameworks: ${inlineList(source.frameworks)}`,
    `- Package manager: ${source.packageManager}`,
    '',
    '## Main Project Type',
    `- ${projectType(source)}`,
    '',
    '## Important Folders',
    mdList(source.keyFolders.map(folder => `${folder}/`), 'No important folders detected by scan.'),
    '',
    '## Likely Frontend Areas',
    mdList(frontend, 'No frontend area detected from sampled paths.'),
    '',
    '## Likely Backend Areas',
    mdList(backend, 'No backend/API area detected from sampled paths.'),
    '',
    '## Documentation Locations',
    mdList(docs, 'No documentation files detected from sampled paths.'),
    '',
    '## Test Locations',
    mdList(tests, 'No test locations detected from sampled paths.'),
    '',
    '## Generated Or Vendor Folders To Avoid',
    mdList(source.ignoredFolders, 'No generated/vendor folders were reported as ignored.'),
    '',
  ].join('\n');
}

function criticalFiles(source: ContextSource) {
  const first = orderedKnownPaths(source, [
    /^readme\.md$/i,
    /^package\.json$/i,
    /^agents\.md$/i,
    /^claude\.md$/i,
    /^tsconfig\.json$/i,
    /^vite\.config\./i,
    /^next\.config\./i,
  ]);
  const ui = matchingPaths(source, [/^(src\/)?(app|pages|components)\//i, /^src\/App\.[jt]sx?$/i]);
  const exportReport = matchingPaths(source, [/report/i, /export/i, /deliveryPack/i, /delivery-pack/i]);
  const github = matchingPaths(source, [/github/i, /^api\/github/i, /\/api\/github/i, /\.github\//i]);
  const tests = matchingPaths(source, [/(\.|-)(test|spec)\.[cm]?[jt]sx?$/i, /(^|\/)(tests?|__tests__)\//i]);

  return [
    '# CRITICAL_FILES.md',
    '',
    'Do not start by reading the whole repository.',
    'Start with these scan-supported paths and expand only when the task requires it.',
    '',
    sectionList('Inspect first', first),
    sectionList('Likely useful for UI work', ui),
    sectionList('Likely useful for export/report work', exportReport),
    sectionList('Likely useful for GitHub integration', github),
    sectionList('Likely useful for tests', tests),
    sectionList('Existing agent instruction files', source.instructionFiles),
    '',
  ].filter(Boolean).join('\n');
}

function commandMap(source: ContextSource) {
  const scripts = source.scripts;
  const commands: Array<[string, string | undefined]> = [
    ['install', installCommand(source.packageManager)],
    ['dev', scripts.dev],
    ['test', scripts.test],
    ['build', scripts.build],
    ['lint', scripts.lint],
    ['typecheck', scripts.typecheck || scripts['type-check']],
    ['e2e', scripts.e2e || scripts['test:e2e'] || scripts.playwright],
  ];

  return [
    '# COMMAND_MAP.md',
    '',
    'Detected commands and verification guidance for AI coding agents.',
    '',
    '## Commands',
    ...commands.flatMap(([label, command]) => [
      `### ${label}`,
      command ? `- \`${command}\`` : '- No command detected for this category.',
      '',
    ]),
    '## Verification Guidance',
    '- Run full verification for production preparation, large refactors, shared logic, auth, security, data, export, or GitHub integration changes.',
    '- Use focused tests for small scoped edits when a relevant test file or script is known.',
    '- For Token Saver work, list manual verification commands instead of running everything unless the user asks you to run them.',
    '- Do not execute imported repository code outside normal reviewed project commands.',
    '',
    '## Suggested Commands From Scan',
    mdList(source.runCommands.map(command => `${command.label}: \`${command.cmd}\``), 'No safe suggested commands detected.'),
    '',
  ].join('\n');
}

function knownRisks(source: ContextSource) {
  const risks: string[] = [];
  const keyFiles = source.keyFilesFound;

  if (source.limitedScan) risks.push('Limited scan warning: repository analysis was incomplete.');
  if (keyFiles.readme === false) risks.push('Missing README signal.');
  if (keyFiles.tests === false) risks.push('Missing tests signal.');
  if (keyFiles.ciConfig === false) risks.push('Missing CI configuration signal.');
  if (keyFiles.envExample === false) risks.push('Missing env example signal.');
  if (keyFiles.agentInstructions === false) risks.push('Missing AGENTS.md signal.');
  if (keyFiles.claudeInstructions === false) risks.push('Missing CLAUDE.md signal.');
  if (source.ignoredFolders.length) risks.push(`Generated/vendor folders ignored: ${source.ignoredFolders.join(', ')}.`);
  for (const warning of source.warnings) risks.push(`Scan warning: ${warning}`);
  for (const blocker of source.blockers) risks.push(`${blocker.title}: ${blocker.detail}`);
  for (const improvement of source.improvements.slice(0, 8)) risks.push(`Improvement signal: ${improvement.title}${improvement.category ? ` (${improvement.category})` : ''}.`);

  return [
    '# KNOWN_RISKS.md',
    '',
    'Risks below are based only on existing ShipSeal scan and readiness signals.',
    '',
    mdList(unique(risks), 'No risks detected from available scan signals.'),
    '',
  ].join('\n');
}

function taskRouter(source: ContextSource) {
  const ui = matchingPaths(source, [/^(src\/)?(app|pages|components)\//i, /^src\/App\.[jt]sx?$/i]);
  const exportReport = matchingPaths(source, [/report/i, /export/i, /deliveryPack/i, /delivery-pack/i]);
  const github = matchingPaths(source, [/github/i, /^api\/github/i, /\/api\/github/i, /\.github\//i]);
  const tests = matchingPaths(source, [/(\.|-)(test|spec)\.[cm]?[jt]sx?$/i, /(^|\/)(tests?|__tests__)\//i]);
  const security = matchingPaths(source, [/security/i, /\.env/i, /privacy/i, /auth/i]);

  return [
    '# TASK_ROUTER.md',
    '',
    'Use this to open fewer files before making changes.',
    '',
    routeBlock('UI changes', ui, focusedTestCommand(source)),
    routeBlock('Export/report changes', exportReport, focusedTestCommand(source)),
    routeBlock('GitHub integration', github, focusedTestCommand(source)),
    routeBlock('Testing changes', tests, testCommand(source)),
    routeBlock('Security/data review', security, 'List manual verification steps and require human review for secrets, auth, privacy, and deployment changes.'),
    '',
  ].join('\n');
}

function routeBlock(title: string, paths: string[], testGuidance: string) {
  return [
    `## ${title}`,
    'Inspect first:',
    mdList(paths, 'No task-specific path detected from sampled files.'),
    'Verification:',
    `- ${testGuidance}`,
    '',
  ].join('\n');
}

function sectionList(title: string, values: string[]) {
  return values.length ? [`## ${title}`, mdList(values, ''), ''].join('\n') : '';
}

function matchingPaths(source: ContextSource, patterns: RegExp[]) {
  return unique(source.sampleFiles.filter(path => patterns.some(pattern => pattern.test(path)))).slice(0, 10);
}

function orderedKnownPaths(source: ContextSource, patterns: RegExp[]) {
  const paths: string[] = [];
  for (const pattern of patterns) {
    const match = source.sampleFiles.find(path => pattern.test(path));
    if (match) paths.push(match);
  }
  return unique(paths);
}

function projectType(source: ContextSource) {
  const stack = [source.stack, ...source.frameworks].join(' ').toLowerCase();
  if (/next|react|vite|vue|svelte|frontend/.test(stack)) return 'Frontend or full-stack web application signal detected.';
  if (/express|node|api|server|backend/.test(stack)) return 'Backend/API application signal detected.';
  if (/python|django|fastapi|flask/.test(stack)) return 'Python application signal detected.';
  return 'Project type not detected from available scan signals.';
}

function installCommand(packageManager: string) {
  if (/pnpm/i.test(packageManager)) return 'pnpm install';
  if (/yarn/i.test(packageManager)) return 'yarn install';
  if (/bun/i.test(packageManager)) return 'bun install';
  if (/npm/i.test(packageManager)) return 'npm install';
  return undefined;
}

function focusedTestCommand(source: ContextSource) {
  const scripts = source.scripts;
  if (scripts.test) return `Prefer focused tests with \`${scripts.test}\` when possible; run full verification for shared or high-risk changes.`;
  return 'No test command detected for this category. Provide manual verification commands.';
}

function testCommand(source: ContextSource) {
  return source.scripts.test ? `Run \`${source.scripts.test}\` or a narrower project-supported test command.` : 'No test command detected for this category.';
}

function mdList(values: string[], fallback: string) {
  const clean = values.map(value => value.trim()).filter(Boolean);
  return clean.length ? clean.map(value => `- ${value}`).join('\n') : `- ${fallback}`;
}

function inlineList(values: string[]) {
  return values.length ? values.join(', ') : 'not detected';
}

function unique(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return arrayValue(value).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function stringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function booleanRecord(value: unknown): Record<string, boolean> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
}

function commandArray(value: unknown): Array<{ label: string; cmd: string }> {
  return arrayValue(value)
    .map(asRecord)
    .map(command => ({ label: stringValue(command.label), cmd: stringValue(command.cmd) }))
    .filter(command => command.label && command.cmd);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

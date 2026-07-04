import { buildToolingRecommendationBundleFromExports, type McpToolRecommendation } from '../toolingRecommendations';

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
  testFrameworks: string[];
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
  sourceType: string;
  repositoryFullName: string;
  branchOrRef: string;
  packageLabel: string;
  packageSummary: string;
  agentOperatingMode: {
    label: string;
    summary: string;
    expectedTokenUsage: string;
  };
  generatedFiles: string[];
  mcpRecommendations: McpToolRecommendation[];
  mcpRiskFindings: Array<{ title: string; severity: string; description: string; recommendation: string }>;
  mcpGeneratedFiles: string[];
}

export function generateContextCompressionFiles(input: ContextCompressionInput): Record<string, string> {
  const source = buildContextSource(input);

  return {
    '07-context/ARCHITECTURE.md': architecture(source),
    '07-context/CRITICAL_FILES.md': criticalFiles(source),
    '07-context/COMMAND_MAP.md': commandMap(source),
    '07-context/KNOWN_RISKS.md': knownRisks(source),
    '07-context/TASK_ROUTER.md': taskRouter(source),
    '07-context/GLOBAL_CONTEXT.md': globalContext(source),
    '07-context/QA_CONTEXT.md': qaContext(source),
    '07-context/SECURITY_CONTEXT.md': securityContext(source),
    '07-context/DOCS_CONTEXT.md': docsContext(source),
    '07-context/MCP_CONTEXT.md': mcpContext(source),
  };
}

function buildContextSource(input: ContextCompressionInput): ContextSource {
  const context = asRecord(input.contextJson);
  const score = asRecord(input.scoreJson);
  const scanSummary = asRecord(score.scanSummary);
  const scanEvidence = asRecord(score.scanEvidence);
  const source = asRecord(score.source);
  const focus = asRecord(score.deliveryPackFocus);
  const agentOperatingMode = asRecord(score.agentOperatingMode);
  const mcpReadiness = asRecord(score.mcpReadiness);
  const toolingRecommendations = buildToolingRecommendationBundleFromExports(input.scoreJson, input.contextJson);

  return {
    projectName: stringValue(context.repositoryName) || stringValue(score.repositoryName) || input.projectName,
    stack: stringValue(context.detectedStack) || stringValue(asRecord(score.detectedStack).primary) || 'not detected',
    languages: stringArray(context.languages).length ? stringArray(context.languages) : stringArray(scanEvidence.topLanguages),
    frameworks: stringArray(context.frameworks).length ? stringArray(context.frameworks) : stringArray(scanEvidence.topFrameworks),
    testFrameworks: stringArray(asRecord(score.detectedStack).testFrameworks),
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
    sourceType: stringValue(scanEvidence.sourceType) || stringValue(source.sourceType) || 'not detected',
    repositoryFullName: stringValue(scanEvidence.repositoryFullName) || stringValue(score.repositoryName) || input.projectName,
    branchOrRef: stringValue(scanEvidence.branchOrRef) || stringValue(source.githubBranch) || stringValue(source.githubDefaultBranch) || 'default ref',
    packageLabel: stringValue(focus.packageLabel) || 'Full ShipSeal package',
    packageSummary: stringValue(focus.packageSummary) || 'No package summary detected.',
    agentOperatingMode: {
      label: stringValue(agentOperatingMode.label) || 'Not detected',
      summary: stringValue(agentOperatingMode.summary) || 'No operating mode summary detected.',
      expectedTokenUsage: stringValue(agentOperatingMode.expectedTokenUsage) || 'Not detected',
    },
    generatedFiles: stringArray(focus.generatedFiles).length ? stringArray(focus.generatedFiles) : stringArray(score.generatedFiles),
    mcpRecommendations: toolingRecommendations.mcpTools,
    mcpRiskFindings: arrayValue(mcpReadiness.riskFindings).map(asRecord).map(finding => ({
      title: stringValue(finding.title) || 'MCP risk finding',
      severity: stringValue(finding.severity) || 'Not detected',
      description: stringValue(finding.description) || 'No description provided by scan.',
      recommendation: stringValue(finding.recommendation) || 'Review before enabling MCP/tool access.',
    })),
    mcpGeneratedFiles: stringArray(mcpReadiness.generatedFiles),
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
  const folderAgents = folderAgentLocations(source);

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
    sectionList('Suggested local agent instruction locations', folderAgents),
    sectionList('Existing agent instruction files', source.instructionFiles),
    '## Specialized context packs',
    '- General agent memory: `07-context/GLOBAL_CONTEXT.md`',
    '- Testing work: `07-context/QA_CONTEXT.md`',
    '- Security/data review: `07-context/SECURITY_CONTEXT.md`',
    '- Documentation/handoff work: `07-context/DOCS_CONTEXT.md`',
    '- MCP/tooling work: `07-context/MCP_CONTEXT.md`',
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
    '- For Focused Context work, list manual verification commands instead of running everything unless the user asks you to run them.',
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
  const folderAgents = folderAgentLocations(source);

  return [
    '# TASK_ROUTER.md',
    '',
    'Use this to open fewer files before making changes.',
    '',
    '## Folder-level AGENTS suggestions',
    'Suggested folder-level AGENTS.md files are generated in `07-context/folder-agents/` when scan signals support them. Review before copying them into the repository.',
    mdList(folderAgents, 'No folder-level AGENTS suggestions detected.'),
    '',
    '## Specialized context starting points',
    '- General coding work: start with `07-context/GLOBAL_CONTEXT.md`.',
    '- Testing work: start with `07-context/QA_CONTEXT.md`.',
    '- Security/data review: start with `07-context/SECURITY_CONTEXT.md`.',
    '- Documentation or handoff work: start with `07-context/DOCS_CONTEXT.md`.',
    '- MCP/tooling work: start with `07-context/MCP_CONTEXT.md`.',
    '',
    routeBlock('UI changes', ui, focusedTestCommand(source)),
    routeBlock('Export/report changes', exportReport, focusedTestCommand(source)),
    routeBlock('GitHub integration', github, focusedTestCommand(source)),
    routeBlock('Testing changes', tests, testCommand(source)),
    routeBlock('Security/data review', security, 'List manual verification steps and require human review for secrets, auth, privacy, and deployment changes.'),
    '',
  ].join('\n');
}

function globalContext(source: ContextSource) {
  return [
    '# GLOBAL_CONTEXT.md',
    '',
    'General compact project memory for AI coding agents. Use this before opening broader repository context.',
    '',
    '## Project',
    `- Project name: ${source.projectName}`,
    `- Detected stack: ${source.stack}`,
    `- Languages: ${inlineList(source.languages)}`,
    `- Frameworks: ${inlineList(source.frameworks)}`,
    `- Source type: ${source.sourceType}`,
    `- Repository / branch: ${source.repositoryFullName} @ ${source.branchOrRef}`,
    `- Package / goal: ${source.packageLabel}`,
    `- Package summary: ${source.packageSummary}`,
    '',
    '## Recommended operating mode',
    `- Mode: ${source.agentOperatingMode.label}`,
    `- Expected context use: ${source.agentOperatingMode.expectedTokenUsage}`,
    `- Summary: ${source.agentOperatingMode.summary}`,
    '',
    '## Key folders',
    mdList(source.keyFolders.map(folder => `${folder}/`), 'No key folders detected by scan.'),
    '',
    '## Key files',
    mdList(orderedKnownPaths(source, [/^readme\.md$/i, /^package\.json$/i, /^agents\.md$/i, /^claude\.md$/i, /^tsconfig\.json$/i, /^vite\.config\./i, /^next\.config\./i]), 'No key files detected from sampled paths.'),
    '',
    '## Verification commands',
    mdList(source.runCommands.map(command => `${command.label}: \`${command.cmd}\``), 'No verification commands detected.'),
    '',
    '## Related context',
    '- Task routing: `07-context/TASK_ROUTER.md`',
    '- Critical file map: `07-context/CRITICAL_FILES.md`',
    '- Known risks: `07-context/KNOWN_RISKS.md`',
    '',
  ].join('\n');
}

function qaContext(source: ContextSource) {
  const testFiles = matchingPaths(source, [/(\.|-)(test|spec)\.[cm]?[jt]sx?$/i, /(^|\/)(tests?|__tests__|e2e)\//i, /playwright\.config\./i, /cypress\//i]);
  const testingFiles = matchingPaths(source, [/testing/i, /quality/i, /ci/i, /\.github\/workflows\//i]);
  const missingRisks = [
    source.keyFilesFound.tests === false ? 'Missing tests signal in scan evidence.' : '',
    source.keyFilesFound.ciConfig === false ? 'Missing CI workflow signal in scan evidence.' : '',
    !source.scripts.test ? 'No test script detected.' : '',
  ].filter(Boolean);
  const suggestedAreas = unique([
    ...matchingPaths(source, [/^(src\/)?(app|pages|components)\//i]).map(path => `UI flow around ${path}`),
    ...matchingPaths(source, [/api\//i, /server\//i, /routes?\//i]).map(path => `API behavior around ${path}`),
    ...matchingPaths(source, [/report/i, /export/i, /manifest/i]).map(path => `Export/report behavior around ${path}`),
  ]).slice(0, 8);

  return [
    '# QA_CONTEXT.md',
    '',
    'Context for QA and test-generation agents. Do not invent tests; use only scan-supported files, commands, and risks.',
    '',
    '## Detected test files and folders',
    mdList(testFiles, 'No test files or folders detected from sampled paths.'),
    '',
    '## Detected test frameworks',
    mdList(source.testFrameworks, 'No test framework detected.'),
    '',
    '## Test command',
    source.scripts.test ? `- \`${source.scripts.test}\`` : '- No test command detected.',
    '',
    '## Missing test risks',
    mdList(missingRisks, 'No missing test risk detected from scan evidence.'),
    '',
    '## Suggested focused test areas',
    mdList(suggestedAreas, 'No focused test areas detected from sampled paths.'),
    '',
    '## Quality gates and testing-related files',
    mdList(testingFiles, 'No testing or quality-gate files detected from sampled paths.'),
    '',
  ].join('\n');
}

function securityContext(source: ContextSource) {
  const envFiles = matchingPaths(source, [/\.env/i]);
  const securityDocs = matchingPaths(source, [/^security\.md$/i, /security/i, /privacy/i, /auth/i, /codeowners/i]);
  const githubApiAreas = matchingPaths(source, [/github/i, /^api\//i, /\/api\//i, /server/i, /routes?\//i]);
  const securityRisks = unique([
    ...source.blockers.filter(blocker => /secret|security|env|auth|privacy|data|limited/i.test(`${blocker.id} ${blocker.title} ${blocker.detail}`)).map(blocker => `${blocker.title}: ${blocker.detail}`),
    ...source.improvements.filter(improvement => /security|secret|env|privacy|gitignore|auth|data/i.test(`${improvement.id} ${improvement.title} ${improvement.category}`)).map(improvement => `Improvement signal: ${improvement.title}${improvement.category ? ` (${improvement.category})` : ''}.`),
  ]);
  const mcpRisks = source.mcpRiskFindings.map(finding => `${finding.severity}: ${finding.title} - ${finding.recommendation}`);

  return [
    '# SECURITY_CONTEXT.md',
    '',
    'Context for security and data review agents. This is not legal advice, a compliance certification, or a production security audit.',
    '',
    '## Env and example files',
    mdList(envFiles, 'No env/example file detected from sampled paths.'),
    '',
    '## Secrets and data-handling signals',
    mdList(securityRisks, 'No security/data readiness risks detected from available scan signals.'),
    '',
    '## Security docs detected',
    mdList(securityDocs, 'No security/privacy/auth documentation detected from sampled paths.'),
    '',
    '## GitHub, App, and API areas',
    mdList(githubApiAreas, 'No GitHub/App/API areas detected from sampled paths.'),
    '',
    '## MCP/tool risk notes',
    mdList(mcpRisks, 'No MCP/tool-specific risk notes detected.'),
    '',
  ].join('\n');
}

function docsContext(source: ContextSource) {
  const docs = matchingPaths(source, [/^readme\.md$/i, /^docs\//i, /^contributing\.md$/i, /^security\.md$/i, /^agents\.md$/i, /^claude\.md$/i]);
  const generatedReports = source.generatedFiles.filter(path => /client-handoff|report|executive|roadmap|manifest|transparency|disclosure|context/i.test(path));
  const docRisks = unique(source.improvements
    .filter(improvement => /readme|docs|architecture|contributing|handoff|documentation|instructions/i.test(`${improvement.id} ${improvement.title} ${improvement.category}`))
    .map(improvement => `Improvement signal: ${improvement.title}${improvement.category ? ` (${improvement.category})` : ''}.`));
  const deprecatedWarnings = source.sampleFiles.some(path => /founder|audit/i.test(path))
    ? ['Founder/audit-related path signal detected. Confirm positioning remains current and not deprecated.']
    : [];

  return [
    '# DOCS_CONTEXT.md',
    '',
    'Context for documentation and handoff agents. Use this to improve docs without scanning everything first.',
    '',
    '## README and docs detected',
    mdList(docs, 'No README/docs files detected from sampled paths.'),
    '',
    '## Missing docs risks',
    mdList(docRisks, 'No documentation improvement risk detected from scan signals.'),
    '',
    '## Client handoff and generated report files',
    mdList(generatedReports, 'No generated handoff/report files detected in the selected package.'),
    '',
    '## Documentation improvement suggestions',
    mdList([
      source.keyFilesFound.readme === false ? 'Add or improve README before handoff.' : '',
      source.keyFilesFound.agentInstructions === false ? 'Add or review AGENTS.md guidance for AI-agent work.' : '',
      source.keyFilesFound.claudeInstructions === false ? 'Add or review CLAUDE.md/Cursor guidance if those agents are used.' : '',
      ...docRisks,
    ].filter(Boolean), 'No documentation suggestions detected from scan signals.'),
    '',
    '## Deprecated positioning warnings',
    mdList(deprecatedWarnings, 'No deprecated positioning warning detected from available scan signals.'),
    '',
  ].join('\n');
}

function mcpContext(source: ContextSource) {
  const existingMcpFiles = matchingPaths(source, [/\bmcp\b/i, /\.mcp\./i, /mcp[_-]/i]);
  const toolSignals = unique([
    ...source.mcpRecommendations.flatMap(rec => rec.signals),
    ...matchingPaths(source, [/github/i, /playwright/i, /cypress/i, /prisma/i, /database/i, /schema/i, /vercel/i, /deploy/i]),
  ]);
  const recommendedTools = source.mcpRecommendations.map(rec => `${rec.toolName} (${rec.confidence}): ${rec.whyRecommended}`);
  const riskNotes = source.mcpRiskFindings.map(finding => `${finding.severity}: ${finding.title} - ${finding.recommendation}`);

  return [
    '# MCP_CONTEXT.md',
    '',
    'Context for MCP and tooling recommendations. ShipSeal does not install MCP servers or write MCP configuration automatically.',
    '',
    '## Existing MCP files detected',
    mdList(existingMcpFiles, 'No existing MCP files detected from sampled paths.'),
    '',
    '## Tool and data source signals',
    mdList(toolSignals, 'No tool/data source signal detected beyond the base repository scan.'),
    '',
    '## Recommended MCP tools',
    mdList(recommendedTools, 'No MCP tool recommendations generated from scan signals.'),
    '',
    '## Allowlist and security notes',
    mdList([
      ...source.mcpGeneratedFiles.map(file => `Review generated MCP governance file: ${file}`),
      ...riskNotes,
    ], 'No MCP allowlist/security notes detected.'),
    '',
    '## Read-only vs write-capable caution',
    '- Prefer read-only MCP access by default.',
    '- Require human approval for write-capable tools, deploys, workflow reruns, database writes, migrations, production data reads, and browser flows involving credentials or payments.',
    '- Do not claim compatibility or enable tools unless the repository owner confirms the environment and permissions.',
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

function folderAgentLocations(source: ContextSource) {
  const candidates = ['root', 'src', 'src/components', 'src/lib', 'api', 'src/test', 'tests', 'docs'];
  return candidates
    .filter(folder => folder === 'root' || source.keyFolders.includes(folder) || source.sampleFiles.some(path => path === folder || path.startsWith(`${folder}/`)))
    .map(folder => `07-context/folder-agents/${folder}/AGENTS.md`);
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

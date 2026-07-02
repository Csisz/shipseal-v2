import type { ReadinessReport } from './types';

export type ToolingRecommendationConfidence = 'High' | 'Medium' | 'Low';

export interface SkillRecommendation {
  name: string;
  whyRecommended: string;
  expectedBenefit: string;
  confidence: ToolingRecommendationConfidence;
  signals: string[];
}

export interface McpToolRecommendation {
  toolName: string;
  whyRecommended: string;
  expectedBenefit: string;
  confidence: ToolingRecommendationConfidence;
  signals: string[];
}

export interface ToolingRecommendationBundle {
  version: 1;
  source: 'shipseal-static-scan';
  generatedFrom: 'existing-scan-signals';
  futureCatalogReady: {
    skillMarketplace: false;
    communitySkills: false;
    customSkills: false;
    mcpCatalogs: false;
  };
  skills: SkillRecommendation[];
  mcpTools: McpToolRecommendation[];
}

interface RecommendationSource {
  repoName: string;
  frameworks: string[];
  languages: string[];
  scripts: Record<string, string>;
  testFrameworks: string[];
  keyFolders: string[];
  sampleFiles: string[];
  existingInstructionFiles: string[];
  ignoredFolders: string[];
  securityFindings: string[];
  blockers: Array<{ id?: string; title?: string; detail?: string }>;
  improvements: Array<{ id?: string; title?: string; category?: string; detail?: string }>;
  sourceType?: string;
  githubOwner?: string;
  githubRepo?: string;
  scanEvidence?: {
    sourceType?: string;
    keyFilesFound?: Record<string, unknown>;
    analyzedFileCount?: number;
    discoveredFileCount?: number;
  };
  mcpCategories: string[];
}

export function buildToolingRecommendationBundle(report: ReadinessReport): ToolingRecommendationBundle {
  return recommendationsFromSource({
    repoName: report.repoName,
    frameworks: report.stack.frameworks,
    languages: report.stack.languages,
    scripts: report.stack.scripts,
    testFrameworks: report.stack.testFrameworks,
    keyFolders: report.repoContextPack.keyFolders,
    sampleFiles: report.repoContextPack.sampleFiles,
    existingInstructionFiles: report.repoContextPack.existingInstructionFiles,
    ignoredFolders: report.repoContextPack.ignoredFolders,
    securityFindings: report.repoContextPack.securityFindings,
    blockers: report.blockers,
    improvements: report.improvements,
    sourceType: report.source.sourceType,
    githubOwner: report.source.githubOwner,
    githubRepo: report.source.githubRepo,
    scanEvidence: report.scanEvidence,
    mcpCategories: report.mcpReadiness.recommendedServerCategories.map(rec => rec.category),
  });
}

export function buildToolingRecommendationBundleFromExports(scoreJson?: unknown, contextJson?: unknown): ToolingRecommendationBundle {
  const score = scoreSource(scoreJson);
  const context = asRecord(contextJson);
  const detectedStack = asRecord(score.detectedStack);
  const repoContext = asRecord(score.repoContextPack);
  const scanEvidence = asRecord(score.scanEvidence);
  const source = asRecord(score.source);
  const mcpReadiness = asRecord(score.mcpReadiness);
  const mcpCategories = arrayValue(mcpReadiness.recommendedServerCategories)
    .map(asRecord)
    .map(rec => stringValue(rec.category) || stringValue(rec.label))
    .filter((value): value is string => Boolean(value));

  return recommendationsFromSource({
    repoName: stringValue(score.repositoryName) || stringValue(context.repositoryName) || 'repository',
    frameworks: stringArray(detectedStack.frameworks, context.frameworks),
    languages: stringArray(detectedStack.languages, context.languages),
    scripts: recordOfStrings(detectedStack.scripts) || recordOfStrings(context.scripts) || {},
    testFrameworks: stringArray(detectedStack.testFrameworks),
    keyFolders: stringArray(repoContext.keyFolders, context.keyFolders),
    sampleFiles: stringArray(context.sampleFiles),
    existingInstructionFiles: stringArray(repoContext.existingInstructionFiles, context.existingInstructionFiles),
    ignoredFolders: stringArray(repoContext.ignoredFolders, context.ignoredFolders),
    securityFindings: stringArray(context.securityFindings),
    blockers: arrayValue(score.criticalBlockers).map(asRecord),
    improvements: arrayValue(score.improvements).map(asRecord),
    sourceType: stringValue(source.sourceType),
    githubOwner: stringValue(source.githubOwner),
    githubRepo: stringValue(source.githubRepo),
    scanEvidence: {
      sourceType: stringValue(scanEvidence.sourceType),
      keyFilesFound: asRecord(scanEvidence.keyFilesFound),
      analyzedFileCount: numberValue(scanEvidence.analyzedFileCount),
      discoveredFileCount: numberValue(scanEvidence.discoveredFileCount),
    },
    mcpCategories,
  });
}

export function recommendationCounts(bundle: ToolingRecommendationBundle) {
  return {
    skills: bundle.skills.length,
    mcpTools: bundle.mcpTools.length,
  };
}

export function renderSkillRecommendationsMarkdown(projectName: string, bundle: ToolingRecommendationBundle) {
  return [
    `# Skill Recommendations - ${projectName}`,
    '',
    'Generated by ShipSeal from existing static scan signals.',
    '',
    '## Scope',
    '- Recommendations are practical AI coding skills for human review.',
    '- ShipSeal does not install skills, configure agents, or call external marketplaces.',
    '- Confidence is based only on detected project signals already present in the scan.',
    '',
    '## Future-ready structure',
    '- Skill marketplace: not implemented.',
    '- Community skills: not implemented.',
    '- Custom skills: not implemented.',
    '- Automatic installation: not implemented.',
    '',
    '## Recommended skills',
    bundle.skills.length
      ? bundle.skills.map(renderSkillRecommendation).join('\n\n')
      : 'No skill recommendations were generated because ShipSeal did not detect enough supporting scan signals.',
    '',
  ].join('\n');
}

export function renderMcpRecommendationsMarkdown(projectName: string, bundle: ToolingRecommendationBundle) {
  return [
    `# MCP Recommendations - ${projectName}`,
    '',
    'Generated by ShipSeal from existing static scan signals.',
    '',
    '## Scope',
    '- Recommendations identify MCP servers/tools that may be useful after human review.',
    '- ShipSeal does not install MCP servers, write MCP configuration, or claim runtime compatibility.',
    '- Confidence is based only on detected project signals already present in the scan.',
    '',
    '## Future-ready structure',
    '- MCP catalogs: not implemented.',
    '- Marketplace lookup: not implemented.',
    '- Automatic MCP configuration: not implemented.',
    '- Tool analytics: not implemented.',
    '',
    '## Recommended MCP tools',
    bundle.mcpTools.length
      ? bundle.mcpTools.map(renderMcpRecommendation).join('\n\n')
      : 'No MCP tool recommendations were generated because ShipSeal did not detect enough supporting scan signals.',
    '',
  ].join('\n');
}

function recommendationsFromSource(source: RecommendationSource): ToolingRecommendationBundle {
  return {
    version: 1,
    source: 'shipseal-static-scan',
    generatedFrom: 'existing-scan-signals',
    futureCatalogReady: {
      skillMarketplace: false,
      communitySkills: false,
      customSkills: false,
      mcpCatalogs: false,
    },
    skills: buildSkillRecommendations(source),
    mcpTools: buildMcpRecommendations(source),
  };
}

function buildSkillRecommendations(source: RecommendationSource): SkillRecommendation[] {
  const recs: SkillRecommendation[] = [];
  const paths = normalizedPaths(source.sampleFiles);
  const textSignals = searchableText(source);
  const frontend = isFrontendHeavy(source, paths);
  const tests = testSignal(source, paths);
  const security = securitySignal(source, textSignals);
  const reports = reportExportSignal(source, paths, textSignals);
  const github = githubSignal(source, paths);
  const docs = documentationSignal(source, paths);

  if (frontend.length) {
    recs.push(skill('react-ui',
      'Frontend stack signals were detected.',
      'Helps agents make UI changes that match the detected React/frontend project structure.',
      confidenceForFrontend(source),
      frontend));
    recs.push(skill('component-review',
      'Component or UI folder signals were detected.',
      'Adds focused review for component boundaries, props, state, and reusable UI patterns.',
      'Medium',
      frontend));
    recs.push(skill('accessibility-review',
      'User interface framework signals were detected.',
      'Prompts agents to check keyboard, semantic markup, labels, and visible interaction states during UI work.',
      'Medium',
      frontend));
  }

  if (tests.length) {
    recs.push(skill('test-generation',
      'Testing framework, test script, or test files were detected.',
      'Helps agents add focused tests using the project testing style already visible in the scan.',
      tests.length > 1 ? 'High' : 'Medium',
      tests));
    recs.push(skill('test-maintenance',
      'Existing test signals suggest tests may need upkeep as features change.',
      'Keeps generated and existing tests aligned with build/test commands and project risk areas.',
      tests.length > 1 ? 'High' : 'Medium',
      tests));
  }

  if (security.length) {
    recs.push(skill('security-review',
      'Security, secret-handling, or privacy readiness signals were detected.',
      'Adds a review path for auth, secrets, data handling, permissions, and risky generated changes.',
      security.some(signal => /secret|credential/i.test(signal)) ? 'High' : 'Medium',
      security));
    if (security.some(signal => /secret|credential|env/i.test(signal))) {
      recs.push(skill('secrets-review',
        'Env/secrets signals were detected in scan findings or readiness gaps.',
        'Focuses agent review on credential files, .env handling, placeholders, and secret rotation notes.',
        'High',
        security.filter(signal => /secret|credential|env/i.test(signal))));
    }
  }

  if (reports.length) {
    recs.push(skill('report-review',
      'Report, PDF, HTML, manifest, or export paths were detected.',
      'Helps review client-facing report wording, output lists, disclaimers, and generated artifact consistency.',
      reports.length > 1 ? 'High' : 'Medium',
      reports));
    recs.push(skill('export-validation',
      'Export or manifest-related paths were detected.',
      'Checks that generated output lists, ZIP contents, reports, and metadata stay consistent.',
      reports.length > 1 ? 'High' : 'Medium',
      reports));
  }

  if (github.length) {
    recs.push(skill('github-review',
      'GitHub source, CI, workflow, or repository ownership signals were detected.',
      'Helps agents inspect PR, branch, workflow, and repository-operation changes with tighter review boundaries.',
      source.githubOwner || source.scanEvidence?.sourceType === 'github-app' ? 'High' : 'Medium',
      github));
  }

  if (docs.length) {
    recs.push(skill('documentation-maintenance',
      'Documentation files or a docs folder were detected.',
      'Keeps README, architecture notes, runbooks, and generated guidance in sync as the project evolves.',
      docs.length > 1 ? 'High' : 'Medium',
      docs));
  }

  return uniqueByName(recs);
}

function buildMcpRecommendations(source: RecommendationSource): McpToolRecommendation[] {
  const recs: McpToolRecommendation[] = [];
  const paths = normalizedPaths(source.sampleFiles);
  const textSignals = searchableText(source);
  const github = githubSignal(source, paths);
  const filesystem = filesystemSignal(source);
  const database = databaseSignal(paths, textSignals);
  const browser = browserSignal(source, paths, textSignals);
  const deployment = deploymentSignal(paths, textSignals);
  const docs = documentationSignal(source, paths);

  if (github.length) {
    recs.push(mcp('github MCP',
      'GitHub, CI, workflow, or repository ownership signals were detected.',
      'Can provide controlled read-heavy issue, PR, branch, and workflow context after human approval.',
      source.githubOwner || source.scanEvidence?.sourceType === 'github-app' ? 'High' : 'Medium',
      github));
  }

  if (filesystem.length) {
    recs.push(mcp('filesystem MCP',
      'Repository structure indicates broad file navigation could help agent work.',
      'Can help agents inspect project files with scoped, least-privilege local filesystem access.',
      source.scanEvidence?.analyzedFileCount && source.scanEvidence.analyzedFileCount >= 40 ? 'High' : 'Medium',
      filesystem));
  }

  if (database.length) {
    recs.push(mcp(databaseToolName(database),
      'Database, schema, migration, or ORM signals were detected.',
      'Can expose schema and migration metadata for safer data-model work after human review.',
      database.some(signal => /postgres|sqlite/i.test(signal)) ? 'High' : 'Medium',
      database));
  }

  if (browser.length) {
    recs.push(mcp('playwright MCP',
      'Browser/e2e testing signals were detected.',
      'Can help agents verify local UI flows and smoke tests when scoped to safe test environments.',
      browser.some(signal => /playwright/i.test(signal)) ? 'High' : 'Medium',
      browser));
  }

  if (deployment.length) {
    recs.push(mcp(deployment.some(signal => /vercel/i.test(signal)) ? 'vercel MCP' : 'deployment visibility MCP',
      'Deployment or CI/CD visibility signals were detected.',
      'Can provide read-only preview, deployment, or workflow status context after access review.',
      deployment.some(signal => /vercel/i.test(signal)) ? 'High' : 'Medium',
      deployment));
  }

  if (docs.length) {
    recs.push(mcp('documentation MCP',
      'Documentation signals were detected.',
      'Can expose curated project docs or framework docs as read-only context for agents.',
      'Medium',
      docs));
  }

  return uniqueByToolName(recs);
}

function skill(name: string, whyRecommended: string, expectedBenefit: string, confidence: ToolingRecommendationConfidence, signals: string[]): SkillRecommendation {
  return { name, whyRecommended, expectedBenefit, confidence, signals: signals.slice(0, 5) };
}

function mcp(toolName: string, whyRecommended: string, expectedBenefit: string, confidence: ToolingRecommendationConfidence, signals: string[]): McpToolRecommendation {
  return { toolName, whyRecommended, expectedBenefit, confidence, signals: signals.slice(0, 5) };
}

function isFrontendHeavy(source: RecommendationSource, paths: string[]) {
  const signals: string[] = [];
  const frontendFrameworks = source.frameworks.filter(framework => /react|next|vite|vue|svelte/i.test(framework));
  if (frontendFrameworks.length) signals.push(`Detected frontend framework(s): ${frontendFrameworks.join(', ')}`);
  if (paths.some(path => /\.(tsx|jsx|vue|svelte)$/.test(path))) signals.push('Frontend component file extensions were sampled.');
  if (signals.length && source.keyFolders.some(folder => /components|pages|app/i.test(folder))) signals.push(`UI folder(s): ${source.keyFolders.filter(folder => /components|pages|app/i.test(folder)).join(', ')}`);
  return signals;
}

function confidenceForFrontend(source: RecommendationSource): ToolingRecommendationConfidence {
  if (source.frameworks.some(framework => /react|next/i.test(framework))) return 'High';
  return 'Medium';
}

function testSignal(source: RecommendationSource, paths: string[]) {
  const signals: string[] = [];
  if (source.testFrameworks.length) signals.push(`Detected test framework(s): ${source.testFrameworks.join(', ')}`);
  if (Object.keys(source.scripts).some(name => /test|e2e|spec/i.test(name))) signals.push('Package scripts include test/e2e commands.');
  if (paths.some(path => /(\.test\.|\.spec\.|tests?\/|e2e\/|playwright)/i.test(path))) signals.push('Test files or test folders were sampled.');
  return signals;
}

function securitySignal(source: RecommendationSource, textSignals: string) {
  const signals: string[] = [];
  if (source.securityFindings.length) signals.push(...source.securityFindings.slice(0, 3));
  if (source.blockers.some(blocker => /secret|credential|security|env/i.test(`${blocker.id} ${blocker.title} ${blocker.detail}`))) signals.push('Critical blocker includes security, credential, or env risk.');
  if (source.improvements.some(improvement => /security|secret|env|privacy|gitignore/i.test(`${improvement.id} ${improvement.title} ${improvement.category} ${improvement.detail}`))) signals.push('Readiness improvements include security, env, privacy, or secret-handling gaps.');
  if (/security|auth|privacy|credential|secret|\.env/i.test(textSignals)) signals.push('Security/auth/privacy terms appear in scanned paths or scripts.');
  return uniqueStrings(signals);
}

function reportExportSignal(source: RecommendationSource, paths: string[], textSignals: string) {
  const signals: string[] = [];
  const reportPaths = paths.filter(path => /report|export|manifest|pdf|html|delivery|handoff/i.test(path));
  if (reportPaths.length) signals.push(`Report/export paths sampled: ${reportPaths.slice(0, 3).join(', ')}`);
  if (/report|export|manifest|pdf|html|delivery|handoff/i.test(textSignals)) signals.push('Report/export terms appear in scanned paths or scripts.');
  if (source.keyFolders.some(folder => /report|export|delivery|handoff/i.test(folder))) signals.push(`Report/export folder(s): ${source.keyFolders.filter(folder => /report|export|delivery|handoff/i.test(folder)).join(', ')}`);
  return uniqueStrings(signals);
}

function githubSignal(source: RecommendationSource, paths: string[]) {
  const signals: string[] = [];
  if (source.githubOwner && source.githubRepo) signals.push(`GitHub repository source: ${source.githubOwner}/${source.githubRepo}`);
  if (source.scanEvidence?.sourceType === 'github-app' || source.scanEvidence?.sourceType === 'public-github') signals.push(`Scan source: ${source.scanEvidence.sourceType}`);
  if (paths.some(path => /^\.github\//i.test(path))) signals.push('GitHub workflow or repository metadata paths were sampled.');
  if (source.scanEvidence?.keyFilesFound?.ciConfig === true) signals.push('CI workflow was found in scan evidence.');
  if (source.existingInstructionFiles.some(file => /codeowners/i.test(file))) signals.push('Repository ownership file was detected.');
  return uniqueStrings(signals);
}

function documentationSignal(source: RecommendationSource, paths: string[]) {
  const signals: string[] = [];
  if (source.keyFolders.includes('docs')) signals.push('docs folder detected.');
  if (paths.some(path => /(^|\/)readme(\.md)?$/i.test(path))) signals.push('README was sampled.');
  const docPaths = paths.filter(path => /\.md$/i.test(path) || /^docs\//i.test(path));
  if (docPaths.length >= 2) signals.push(`Documentation-like paths sampled: ${docPaths.slice(0, 3).join(', ')}`);
  return uniqueStrings(signals);
}

function filesystemSignal(source: RecommendationSource) {
  const signals: string[] = [];
  const analyzed = source.scanEvidence?.analyzedFileCount || 0;
  const discovered = source.scanEvidence?.discoveredFileCount || 0;
  if (analyzed >= 20) signals.push(`${analyzed} files analyzed by ShipSeal.`);
  if (discovered >= 40) signals.push(`${discovered} files discovered by ShipSeal.`);
  if (source.keyFolders.length >= 4) signals.push(`Multiple key folders detected: ${source.keyFolders.slice(0, 5).join(', ')}`);
  if (source.ignoredFolders.length) signals.push(`Generated/vendor folders ignored: ${source.ignoredFolders.slice(0, 3).join(', ')}`);
  return uniqueStrings(signals);
}

function databaseSignal(paths: string[], textSignals: string) {
  const signals: string[] = [];
  if (/postgres|postgresql|pg\b/i.test(textSignals)) signals.push('Postgres terms detected in scanned paths or scripts.');
  if (/sqlite/i.test(textSignals)) signals.push('SQLite terms detected in scanned paths or scripts.');
  if (/prisma|schema\.prisma/i.test(textSignals) || paths.some(path => /prisma\/|schema\.prisma$/i.test(path))) signals.push('Prisma schema or ORM path detected.');
  if (/supabase/i.test(textSignals)) signals.push('Supabase database signal detected.');
  if (/migrations?|database|db\/|schema/i.test(textSignals)) signals.push('Database, schema, or migration terms detected.');
  return uniqueStrings(signals);
}

function browserSignal(source: RecommendationSource, paths: string[], textSignals: string) {
  const signals: string[] = [];
  if (source.testFrameworks.some(framework => /playwright/i.test(framework))) signals.push('Playwright test framework detected.');
  if (/playwright/i.test(textSignals) || paths.some(path => /playwright\.config|e2e\//i.test(path))) signals.push('Playwright/e2e path or script detected.');
  if (/cypress/i.test(textSignals) || paths.some(path => /cypress\//i.test(path))) signals.push('Cypress/browser-test path or script detected.');
  return uniqueStrings(signals);
}

function deploymentSignal(paths: string[], textSignals: string) {
  const signals: string[] = [];
  if (/vercel/i.test(textSignals) || paths.some(path => /vercel\.json$/i.test(path))) signals.push('Vercel deployment signal detected.');
  if (/netlify|render|fly\.io|railway|deploy|deployment/i.test(textSignals)) signals.push('Deployment or hosting term detected.');
  if (paths.some(path => /^\.github\/workflows\//i.test(path))) signals.push('CI workflow path detected.');
  return uniqueStrings(signals);
}

function databaseToolName(signals: string[]) {
  if (signals.some(signal => /sqlite/i.test(signal))) return 'sqlite MCP';
  if (signals.some(signal => /postgres|supabase/i.test(signal))) return 'postgres MCP';
  return 'database schema MCP';
}

function searchableText(source: RecommendationSource) {
  return [
    source.frameworks.join(' '),
    source.languages.join(' '),
    Object.entries(source.scripts).map(([name, command]) => `${name} ${command}`).join(' '),
    source.keyFolders.join(' '),
    source.sampleFiles.join(' '),
    source.existingInstructionFiles.join(' '),
    source.mcpCategories.join(' '),
  ].join(' ').toLowerCase();
}

function normalizedPaths(paths: string[]) {
  return paths.map(path => path.replace(/\\/g, '/').toLowerCase());
}

function renderSkillRecommendation(rec: SkillRecommendation) {
  return [
    `### ${rec.name}`,
    `- Skill name: ${rec.name}`,
    `- Why it was recommended: ${rec.whyRecommended}`,
    `- Expected benefit: ${rec.expectedBenefit}`,
    `- Confidence: ${rec.confidence}`,
    '- Supporting scan signals:',
    ...rec.signals.map(signal => `  - ${signal}`),
  ].join('\n');
}

function renderMcpRecommendation(rec: McpToolRecommendation) {
  return [
    `### ${rec.toolName}`,
    `- Tool name: ${rec.toolName}`,
    `- Why it was recommended: ${rec.whyRecommended}`,
    `- Expected benefit: ${rec.expectedBenefit}`,
    `- Confidence: ${rec.confidence}`,
    '- Supporting scan signals:',
    ...rec.signals.map(signal => `  - ${signal}`),
  ].join('\n');
}

function scoreSource(scoreJson: unknown): Record<string, unknown> {
  const source = asRecord(scoreJson);
  const wrapped = asRecord(source.content);
  return Object.keys(wrapped).length ? wrapped : source;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringArray(...values: unknown[]) {
  return values.flatMap(value => arrayValue(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0));
}

function recordOfStrings(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function uniqueByName(recs: SkillRecommendation[]) {
  const seen = new Set<string>();
  return recs.filter(rec => {
    if (seen.has(rec.name)) return false;
    seen.add(rec.name);
    return true;
  });
}

function uniqueByToolName(recs: McpToolRecommendation[]) {
  const seen = new Set<string>();
  return recs.filter(rec => {
    if (seen.has(rec.toolName)) return false;
    seen.add(rec.toolName);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

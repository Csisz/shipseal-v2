import { detectStack } from '../stack';
import { scoreRepo } from '../scoring';
import { detectEntryPointCandidates, detectSourceFolders } from '../sourceDetection';
import type { RepoScanInput } from '../types';
import { classifyRepositoryFiles, isInstructionPath } from './classifyFiles';
import type {
  ClassifiedRepositoryFile,
  DocumentationDuplicateGroup,
  DocumentationFamilyGroup,
  HealthBlocker,
  HealthDimensionId,
  HealthSignal,
  RepositoryHealthSignals,
} from './types';

const LARGE_RELEVANT_FILE_BYTES = 128 * 1024;
const GIANT_RELEVANT_FILE_BYTES = 512 * 1024;

const CI_WORKFLOW_RE = /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i;
const LOCKFILE_RE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|bun\.lock|poetry\.lock|cargo\.lock|go\.sum|gemfile\.lock|composer\.lock)$/i;
const ROOT_INSTRUCTION_RE = /^(agents\.md|claude\.md|codex\.md|\.cursorrules|\.cursor\/rules(?:\/.*)?)$/i;
const FOLDER_INSTRUCTION_RE = /(^|\/)(agents\.md|claude\.md|codex\.md|\.cursor\/rules(?:\/.*)?$)/i;

type SignalFacts = {
  input: RepoScanInput;
  files: ClassifiedRepositoryFile[];
  paths: Set<string>;
  lowerPaths: Set<string>;
  stack: ReturnType<typeof detectStack>;
  textContents: Record<string, string>;
  duplicateDocumentationGroups: DocumentationDuplicateGroup[];
  documentationFamilies: DocumentationFamilyGroup[];
  entryPointCandidates: string[];
  sourceFolders: string[];
  blockers: HealthBlocker[];
};

export function extractRepositoryHealthSignals(input: RepoScanInput): RepositoryHealthSignals {
  const files = classifyRepositoryFiles(input);
  const stack = detectStack(input);
  const blockers = scoreRepo(input, stack).blockers.map(blocker => ({
    ...blocker,
    evidence: [blocker.detail],
  }));
  const duplicateDocumentationGroups = findExactDuplicateDocumentation(input, files);
  const documentationFamilies = groupDocumentationFamilies(files);
  const entryPointCandidates = detectEntryPointCandidates(input);
  const sourceFolders = detectSourceFolders(input);

  const facts: SignalFacts = {
    input,
    files,
    paths: new Set(files.map(file => file.path)),
    lowerPaths: new Set(files.map(file => file.path.toLowerCase())),
    stack,
    textContents: input.textContents,
    duplicateDocumentationGroups,
    documentationFamilies,
    entryPointCandidates,
    sourceFolders,
    blockers,
  };

  return {
    files,
    signals: [
      ...repositoryIntelligenceSignals(facts),
      ...contextWasteSignals(facts),
      ...aiDevelopmentReadinessSignals(facts),
      ...agentRoutingSignals(facts),
      ...deliveryConfidenceSignals(facts),
    ],
    duplicateDocumentationGroups,
    documentationFamilies,
    entryPointCandidates,
    sourceFolders,
    blockers,
  };
}

function repositoryIntelligenceSignals(facts: SignalFacts): HealthSignal[] {
  const readmePaths = findPaths(facts, /(^|\/)readme(\.md)?$/i);
  const docsIndexPaths = findPaths(facts, /(^|\/)(docs\/(index|readme)|documentation_(index|inventory)|docs\/documentation_inventory)\.md$/i);
  const rootInstructions = findPaths(facts, ROOT_INSTRUCTION_RE);
  const sourceFolders = facts.sourceFolders;
  const stackConfig = findPaths(facts, /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle|composer\.json|gemfile)$/i);
  const conflicts = facts.documentationFamilies.filter(group => group.activePaths.length > 1);

  return [
    signal('repo.readme', 'repositoryIntelligence', 'Repository overview is discoverable', readmePaths.length ? 'pass' : 'fail', 5, readmePaths.length ? 5 : 0, evidenceOr(readmePaths, 'No README file found.'), 'repo.readme'),
    signal('repo.docs-index', 'repositoryIntelligence', 'Documentation has a compact index', docsIndexPaths.length ? 'pass' : 'fail', 3, docsIndexPaths.length ? 3 : 0, evidenceOr(docsIndexPaths, 'No docs index or documentation inventory file found.'), 'repo.docs-index'),
    signal('repo.canonical-docs', 'repositoryIntelligence', 'Canonical documentation families are unambiguous', conflicts.length === 0 ? 'pass' : 'fail', 5, conflicts.length === 0 ? 5 : 0, conflicts.length ? conflicts.map(group => `${group.family}: ${group.activePaths.join(', ')}`) : ['No active canonical documentation conflicts detected.'], 'repo.canonical-docs'),
    signal('repo.instructions-root', 'repositoryIntelligence', 'Root agent instructions exist', rootInstructions.length ? 'pass' : 'fail', 4, rootInstructions.length ? 4 : 0, evidenceOr(rootInstructions, 'No root AGENTS.md, CLAUDE.md, Codex, Cursor, or equivalent instruction file found.'), 'repo.instructions-root'),
    signal('repo.source-map', 'repositoryIntelligence', 'Source and stack anchors are identifiable', sourceFolders.length && stackConfig.length ? 'pass' : sourceFolders.length || stackConfig.length ? 'partial' : 'fail', 3, sourceFolders.length && stackConfig.length ? 3 : sourceFolders.length || stackConfig.length ? 1.5 : 0, [
      sourceFolders.length ? `Source folders: ${sourceFolders.join(', ')}` : 'No common source folder detected.',
      stackConfig.length ? `Stack config: ${stackConfig.slice(0, 5).join(', ')}` : 'No stack manifest/config file detected.',
    ], 'repo.source-map'),
  ];
}

function contextWasteSignals(facts: SignalFacts): HealthSignal[] {
  const realFiles = facts.files.filter(file => !file.isDir);
  const generatedFiles = realFiles.filter(file => file.generatedOrVendor);
  const totalBytes = sum(realFiles.map(file => file.size));
  const generatedBytes = sum(generatedFiles.map(file => file.size));
  const relevantFiles = realFiles.filter(file => !file.generatedOrVendor && !file.binaryLike);
  const largeRelevant = relevantFiles.filter(file => file.size >= LARGE_RELEVANT_FILE_BYTES);
  const giantRelevant = relevantFiles.filter(file => file.size >= GIANT_RELEVANT_FILE_BYTES);
  const activeDocs = facts.files.filter(file => file.activeDocumentation);
  const conflicts = facts.documentationFamilies.filter(group => group.activePaths.length > 1);
  const compactAnchors = findCompactContextAnchors(facts);
  const generatedRatio = realFiles.length ? generatedFiles.length / realFiles.length : 0;
  const generatedByteRatio = totalBytes ? generatedBytes / totalBytes : 0;
  const entryPointStatus = facts.entryPointCandidates.length === 0 ? 'fail' : facts.entryPointCandidates.length > 5 ? 'partial' : 'pass';
  const entryPointEvidence = facts.entryPointCandidates.length
    ? [`Entry point candidates: ${facts.entryPointCandidates.join(', ')}`]
    : facts.sourceFolders.length
      ? [`Importable source package or source folder detected: ${facts.sourceFolders.join(', ')}. Executable entry point not detected.`]
      : ['No entry point candidate or source package detected.'];

  return [
    riskSignal('waste.generated-file-ratio', 'Generated/vendor file ratio is controlled', generatedRatio > 0.5 ? 'fail' : generatedRatio > 0.15 ? 'partial' : 'pass', 20, generatedRatio > 0.5 ? 20 : generatedRatio > 0.15 ? 10 : 0, [`Generated/vendor files: ${generatedFiles.length} of ${realFiles.length}.`], 'waste.generated-file-ratio'),
    riskSignal('waste.generated-byte-ratio', 'Generated/vendor byte ratio is controlled', generatedByteRatio > 0.5 ? 'fail' : generatedByteRatio > 0.15 ? 'partial' : 'pass', 15, generatedByteRatio > 0.5 ? 15 : generatedByteRatio > 0.15 ? 7.5 : 0, [`Generated/vendor bytes: ${generatedBytes} of ${totalBytes}.`], 'waste.generated-byte-ratio'),
    riskSignal('waste.large-relevant-files', 'Relevant files are not oversized', giantRelevant.length ? 'fail' : largeRelevant.length ? 'partial' : 'pass', 15, giantRelevant.length ? 15 : largeRelevant.length ? 7.5 : 0, giantRelevant.length ? giantRelevant.map(file => `Giant relevant file: ${file.path} (${file.size} bytes)`) : largeRelevant.length ? largeRelevant.map(file => `Large relevant file: ${file.path} (${file.size} bytes)`) : ['No oversized relevant files detected.'], 'waste.large-relevant-files'),
    riskSignal('waste.duplicate-docs', 'Readable documentation has no exact duplicates', facts.duplicateDocumentationGroups.length ? 'fail' : 'pass', 15, facts.duplicateDocumentationGroups.length ? 15 : 0, facts.duplicateDocumentationGroups.length ? facts.duplicateDocumentationGroups.map(group => `Duplicate docs: ${group.paths.join(', ')}`) : ['No exact duplicate readable documentation detected.'], 'waste.duplicate-docs'),
    riskSignal('waste.active-doc-sprawl', 'Active documentation set is compact', activeDocs.length > 20 ? 'fail' : activeDocs.length > 10 ? 'partial' : 'pass', 10, activeDocs.length > 20 ? 10 : activeDocs.length > 10 ? 5 : 0, [`Active documentation files: ${activeDocs.length}.`], 'waste.active-doc-sprawl'),
    riskSignal('waste.canonical-conflicts', 'Canonical documentation families do not conflict', conflicts.length ? 'fail' : 'pass', 10, conflicts.length ? 10 : 0, conflicts.length ? conflicts.map(group => `${group.family}: ${group.activePaths.join(', ')}`) : ['No active canonical document conflicts detected.'], 'waste.canonical-conflicts'),
    riskSignal('waste.compact-anchor-missing', 'Compact context anchors are present', compactAnchors.status, 10, compactAnchors.earned, compactAnchors.evidence, 'waste.compact-anchor-missing'),
    riskSignal('waste.entrypoint-ambiguity', 'Entry point routing is not ambiguous', entryPointStatus, 5, entryPointStatus === 'fail' ? 5 : entryPointStatus === 'partial' ? 2.5 : 0, entryPointEvidence, 'waste.entrypoint-ambiguity'),
  ];
}

function aiDevelopmentReadinessSignals(facts: SignalFacts): HealthSignal[] {
  const scripts = facts.stack.scripts || {};
  const scriptNames = Object.keys(scripts);
  const runCommandLabels = facts.stack.runCommands.map(command => command.label.toLowerCase());
  const hasBuild = !!scripts.build || runCommandLabels.includes('build');
  const hasTest = !!scripts.test || hasAny(facts, /(^|\/)(tests?|__tests__)\/|(\.|-)(test|spec)\.[cm]?[jt]sx?$/i);
  const hasLintOrTypecheck = !!scripts.lint || !!scripts.typecheck || runCommandLabels.includes('lint') || runCommandLabels.includes('typecheck') || hasAny(facts, /(^|\/)(eslint\.config\.[jt]s|tsconfig\.json)$/i);
  const scriptEarned = [hasBuild, hasTest, hasLintOrTypecheck].filter(Boolean).length;
  const ciWorkflows = findPaths(facts, CI_WORKFLOW_RE);
  const ciCrossRef = classifyCiScriptCrossReference(facts, ciWorkflows, scriptNames);
  const lockfiles = findPaths(facts, LOCKFILE_RE);

  return [
    signal('ai.stack-detected', 'aiDevelopmentReadiness', 'Technology stack is detected', facts.stack.primary !== 'Unknown' ? 'pass' : 'fail', 5, facts.stack.primary !== 'Unknown' ? 5 : 0, [`Detected stack: ${facts.stack.primary}.`], 'ai.stack-detected'),
    signal('ai.package-scripts', 'aiDevelopmentReadiness', 'Build, test, and quality commands are declared', scriptEarned === 3 ? 'pass' : scriptEarned > 0 ? 'partial' : 'fail', 8, (scriptEarned / 3) * 8, facts.stack.runCommands.length ? [`Detected verification commands: ${facts.stack.runCommands.map(command => `${command.label}: ${command.cmd}`).join('; ')}`] : scriptNames.length ? [`Package scripts: ${scriptNames.join(', ')}`] : ['No build, test, lint, or typecheck command detected.'], 'ai.package-scripts'),
    signal('ai.tests-present', 'aiDevelopmentReadiness', 'Test signal exists', hasTest ? 'pass' : 'fail', 5, hasTest ? 5 : 0, hasTest ? ['Test script or test files detected.'] : ['No test script or test file pattern detected.'], 'ai.tests-present'),
    signal('ai.ci-workflow', 'aiDevelopmentReadiness', 'CI workflow exists', ciWorkflows.length ? 'pass' : 'fail', 4, ciWorkflows.length ? 4 : 0, evidenceOr(ciWorkflows, 'No .github/workflows YAML file detected.'), 'ai.ci-workflow'),
    signal('ai.ci-script-cross-reference', 'aiDevelopmentReadiness', 'CI references repository scripts', ciCrossRef.status, 4, ciCrossRef.earned, ciCrossRef.evidence, 'ai.ci-script-cross-reference'),
    signal('ai.lockfile', 'aiDevelopmentReadiness', 'Dependency lockfile exists', lockfiles.length ? 'pass' : 'fail', 3, lockfiles.length ? 3 : 0, evidenceOr(lockfiles, 'No dependency lockfile detected.'), 'ai.lockfile'),
  ];
}

function agentRoutingSignals(facts: SignalFacts): HealthSignal[] {
  const rootInstructions = findPaths(facts, ROOT_INSTRUCTION_RE);
  const nestedInstructions = facts.files
    .filter(file => !file.isDir && isInstructionPath(file.path) && !ROOT_INSTRUCTION_RE.test(file.path))
    .map(file => file.path);
  const taskRouter = findPaths(facts, /(^|\/)(task_router|task-router|agent_router|agent-routing|routing)\.md$/i);
  const commandMap = findPaths(facts, /(^|\/)(commands|command_map|command-map|developer_commands|runbook)\.md$|(^|\/)makefile$/i);
  const criticalPolicy = findPaths(facts, /(^|\/)(critical_files_policy|critical-files-policy|codeowners|security)\.md$|(^|\/)codeowners$/i);
  const knownRisks = findPaths(facts, /(^|\/)(risks|risk_register|known_risks|security)\.md$/i);
  const entryStatus = facts.entryPointCandidates.length === 0 ? 'fail' : facts.entryPointCandidates.length > 5 ? 'partial' : 'pass';
  const folderInstructionCoverage = classifyFolderInstructionCoverage(facts, nestedInstructions);
  const entryPointEvidence = facts.entryPointCandidates.length
    ? [`Entry point candidates: ${facts.entryPointCandidates.join(', ')}`]
    : facts.sourceFolders.length
      ? [`Importable source package or source folder detected: ${facts.sourceFolders.join(', ')}. Executable entry point not detected.`]
      : ['No entry point candidate or source package detected.'];

  return [
    signal('route.root-instructions', 'agentRouting', 'Root agent instruction file is available', rootInstructions.length ? 'pass' : 'fail', 6, rootInstructions.length ? 6 : 0, evidenceOr(rootInstructions, 'No root agent instruction file detected.'), 'route.root-instructions'),
    signal('route.folder-instructions', 'agentRouting', 'Folder-level instructions guide focused work', folderInstructionCoverage.status, 4, folderInstructionCoverage.earned, folderInstructionCoverage.evidence, folderInstructionCoverage.status === 'not-applicable' ? undefined : 'route.folder-instructions'),
    signal('route.task-router', 'agentRouting', 'Task router maps work to starting folders', taskRouter.length ? 'pass' : 'fail', 5, taskRouter.length ? 5 : 0, evidenceOr(taskRouter, 'No task router document detected.'), 'route.task-router'),
    signal('route.command-map', 'agentRouting', 'Command map is documented', commandMap.length ? 'pass' : Object.keys(facts.stack.scripts).length ? 'partial' : 'fail', 4, commandMap.length ? 4 : Object.keys(facts.stack.scripts).length ? 2 : 0, commandMap.length ? commandMap : Object.keys(facts.stack.scripts).length ? [`Package scripts can seed a command map: ${Object.keys(facts.stack.scripts).join(', ')}`] : ['No command map or package scripts detected.'], 'route.command-map'),
    signal('route.critical-policy', 'agentRouting', 'Critical file policy is discoverable', criticalPolicy.length ? 'pass' : 'fail', 4, criticalPolicy.length ? 4 : 0, evidenceOr(criticalPolicy, 'No critical files policy, SECURITY.md, or CODEOWNERS signal detected.'), 'route.critical-policy'),
    signal('route.known-risks', 'agentRouting', 'Known risks are documented', knownRisks.length ? 'pass' : 'fail', 3, knownRisks.length ? 3 : 0, evidenceOr(knownRisks, 'No known risks, risk register, or security review document detected.'), 'route.known-risks'),
    signal('route.entry-point-clarity', 'agentRouting', 'Entry points are clear enough to route tasks', entryStatus, 4, entryStatus === 'pass' ? 4 : entryStatus === 'partial' ? 2 : 0, entryPointEvidence, 'route.entry-point-clarity'),
  ];
}

function findCompactContextAnchors(facts: SignalFacts) {
  const anchors: string[] = [];
  if (hasAny(facts, /(^|\/)readme(\.md)?$/i)) anchors.push('README/project overview');
  if (hasAny(facts, /(^|\/)docs\/(index|readme)\.md$/i)) anchors.push('docs index');
  if (hasAny(facts, /(^|\/)(architecture|arch|system-design)\.md$/i) || hasAny(facts, /(^|\/)docs\/.*(architecture|arch|system-design).*\.md$/i)) anchors.push('architecture summary');
  if (hasAny(facts, /(^|\/)(task_router|task-router|agent_router|agent-routing|routing)\.md$/i)) anchors.push('task router');
  if (hasAny(facts, /(^|\/)(commands|command_map|command-map|developer_commands|runbook)\.md$|(^|\/)makefile$/i)) anchors.push('command map');
  if (hasAny(facts, ROOT_INSTRUCTION_RE)) anchors.push('root agent instructions');

  if (anchors.length === 0) {
    return {
      status: 'fail' as const,
      earned: 10,
      evidence: ['No compact README, docs index, architecture summary, task router, command map, or root instruction anchor found.'],
    };
  }
  if (anchors.length === 1) {
    return {
      status: 'partial' as const,
      earned: 5,
      evidence: [`Compact context anchor detected: ${anchors[0]}.`],
    };
  }
  return {
    status: 'pass' as const,
    earned: 0,
    evidence: [`Compact context anchors detected: ${anchors.join(', ')}.`],
  };
}

function classifyFolderInstructionCoverage(facts: SignalFacts, nestedInstructions: string[]) {
  const areas = relevantWorkAreas(facts);
  if (areas.length <= 1 && facts.files.filter(file => !file.isDir && !file.generatedOrVendor && !file.binaryLike).length <= 8) {
    return {
      status: 'not-applicable' as const,
      earned: 0,
      evidence: ['Repository is small enough that root guidance is sufficient; folder-level instructions are not applicable.'],
    };
  }
  if (areas.length === 0) {
    return {
      status: 'not-applicable' as const,
      earned: 0,
      evidence: ['No distinct source, docs, test, or service work areas detected for folder-level instructions.'],
    };
  }
  if (nestedInstructions.length === 0) {
    return {
      status: 'fail' as const,
      earned: 0,
      evidence: [`Relevant work areas need local guidance: ${areas.join(', ')}. No nested instruction files detected.`],
    };
  }

  const instructionFolders = nestedInstructions.map(path => path.split('/').slice(0, -1).join('/')).filter(Boolean);
  const covered = areas.filter(area => instructionFolders.some(folder => area === folder || area.startsWith(`${folder}/`) || folder.startsWith(`${area}/`)));
  if (covered.length >= areas.length) {
    return {
      status: 'pass' as const,
      earned: 4,
      evidence: [`Folder instruction coverage: ${covered.join(', ')}.`, `Nested instructions: ${nestedInstructions.join(', ')}`],
    };
  }
  if (covered.length > 0) {
    const missing = areas.filter(area => !covered.includes(area));
    return {
      status: 'partial' as const,
      earned: 2,
      evidence: [`Covered work areas: ${covered.join(', ')}.`, `Missing local guidance for: ${missing.join(', ')}.`],
    };
  }
  return {
    status: 'fail' as const,
    earned: 0,
    evidence: [`Nested instructions exist but do not cover detected work areas: ${areas.join(', ')}.`, `Nested instructions: ${nestedInstructions.join(', ')}`],
  };
}

function relevantWorkAreas(facts: SignalFacts): string[] {
  const areas = new Set<string>();
  for (const folder of facts.sourceFolders) areas.add(folder);
  if (facts.files.some(file => !file.isDir && file.activeDocumentation && /^docs\//i.test(file.path))) areas.add('docs');
  if (facts.files.some(file => !file.isDir && file.kind === 'test')) areas.add('tests');
  if (facts.files.some(file => !file.isDir && /^api\//i.test(file.path))) areas.add('api');
  if (facts.files.some(file => !file.isDir && /^server\//i.test(file.path))) areas.add('server');
  return [...areas].sort();
}

function deliveryConfidenceSignals(facts: SignalFacts): HealthSignal[] {
  const deploymentDocs = findPaths(facts, /(^|\/)(deploy|deployment|hosting|infrastructure|vercel|netlify)\.md$|(^|\/)dockerfile$|(^|\/)vercel\.json$/i);
  const rollbackRunbookRelease = findPaths(facts, /(^|\/)(rollback|runbook|release|release_checklist|incident_response)\.md$/i);
  const securityPolicy = findPaths(facts, /(^|\/)(security|privacy|data_privacy)\.md$/i);
  const envExample = findPaths(facts, /(^|\/)\.env(\.[^./]+)?\.example$|(^|\/)\.env\.example$/i);
  const gitignore = findPaths(facts, /(^|\/)\.gitignore$/i);
  const criticalBlockers = facts.blockers.filter(blocker => ['secrets', 'no_stack', 'no_build_test_lint'].includes(blocker.id));

  return [
    signal('delivery.deployment-docs', 'deliveryConfidence', 'Deployment path is documented', deploymentDocs.length ? 'pass' : 'fail', 5, deploymentDocs.length ? 5 : 0, evidenceOr(deploymentDocs, 'No deployment, hosting, Docker, or Vercel deployment signal detected.'), 'delivery.deployment-docs'),
    signal('delivery.rollback-runbook-release', 'deliveryConfidence', 'Rollback, release, or runbook guidance exists', rollbackRunbookRelease.length ? 'pass' : 'fail', 5, rollbackRunbookRelease.length ? 5 : 0, evidenceOr(rollbackRunbookRelease, 'No rollback, runbook, release checklist, or incident response document detected.'), 'delivery.rollback-runbook-release'),
    signal('delivery.security-policy', 'deliveryConfidence', 'Security or data handling review anchor exists', securityPolicy.length ? 'pass' : 'fail', 4, securityPolicy.length ? 4 : 0, evidenceOr(securityPolicy, 'No SECURITY.md, privacy, or data handling document detected.'), 'delivery.security-policy'),
    signal('delivery.env-and-ignore', 'deliveryConfidence', 'Environment and ignored output boundaries are visible', envExample.length && gitignore.length ? 'pass' : envExample.length || gitignore.length ? 'partial' : 'fail', 4, envExample.length && gitignore.length ? 4 : envExample.length || gitignore.length ? 2 : 0, [
      envExample.length ? `Env examples: ${envExample.join(', ')}` : 'No .env.example detected.',
      gitignore.length ? `Ignore files: ${gitignore.join(', ')}` : 'No .gitignore detected.',
    ], 'delivery.env-and-ignore'),
    signal('delivery.critical-blockers', 'deliveryConfidence', 'No critical delivery blockers were detected', criticalBlockers.length ? 'fail' : 'pass', 7, criticalBlockers.length ? 0 : 7, criticalBlockers.length ? criticalBlockers.map(blocker => blocker.detail) : ['No secret, stack, or verification-command blocker detected by the existing readiness scorer.'], 'delivery.critical-blockers'),
  ];
}

function classifyCiScriptCrossReference(facts: SignalFacts, ciWorkflows: string[], scriptNames: string[]) {
  if (ciWorkflows.length === 0) {
    return { status: 'not-applicable' as const, earned: 0, evidence: ['No CI workflow exists, so script cross-reference is not applicable.'] };
  }
  const readable = ciWorkflows.filter(path => facts.textContents[path]);
  if (readable.length === 0) {
    return { status: 'unknown' as const, earned: 0, evidence: [`CI workflow exists but readable content was not available: ${ciWorkflows.join(', ')}`] };
  }
  const combined = readable.map(path => facts.textContents[path]).join('\n').toLowerCase();
  const referenced = scriptNames.filter(name => new RegExp(`\\b(npm|pnpm|yarn|bun)\\s+(run\\s+)?${escapeRegExp(name)}\\b`).test(combined));
  if (referenced.length > 0) return { status: 'pass' as const, earned: 4, evidence: [`CI references scripts: ${referenced.join(', ')}`] };
  if (/\b(npm|pnpm|yarn|bun)\s+(install|ci)\b/.test(combined)) return { status: 'partial' as const, earned: 2, evidence: ['CI installs dependencies but does not reference detected package scripts.'] };
  return { status: 'fail' as const, earned: 0, evidence: ['CI workflow content does not reference detected package scripts.'] };
}

function findExactDuplicateDocumentation(input: RepoScanInput, files: ClassifiedRepositoryFile[]): DocumentationDuplicateGroup[] {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    if (file.kind !== 'documentation' || file.generatedOrVendor || file.binaryLike) continue;
    const content = input.textContents[file.path];
    if (!content) continue;
    const normalized = normalizeDocumentationContent(content);
    if (!normalized) continue;
    const hash = stableHash(normalized);
    groups.set(hash, [...(groups.get(hash) || []), file.path]);
  }
  return [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([hash, paths]) => ({ hash, paths: paths.sort() }))
    .sort((a, b) => a.paths[0].localeCompare(b.paths[0]));
}

function groupDocumentationFamilies(files: ClassifiedRepositoryFile[]): DocumentationFamilyGroup[] {
  const groups = new Map<string, DocumentationFamilyGroup>();
  for (const file of files) {
    if (file.kind !== 'documentation') continue;
    const family = documentationFamily(file.path);
    if (!family) continue;
    const existing = groups.get(family) || { family, activePaths: [], legacyPaths: [] };
    if (file.legacyDocumentation) existing.legacyPaths.push(file.path);
    else existing.activePaths.push(file.path);
    groups.set(family, existing);
  }
  return [...groups.values()].map(group => ({
    family: group.family,
    activePaths: group.activePaths.sort(),
    legacyPaths: group.legacyPaths.sort(),
  })).sort((a, b) => a.family.localeCompare(b.family));
}

function documentationFamily(path: string): string | null {
  const lower = path.toLowerCase();
  const base = lower.split('/').pop() || lower;
  if (/^docs\/readme\.md$/.test(lower)) return null;
  if (/readme(\.md)?$/.test(base)) return 'readme';
  if (/(architecture|arch|system-design)/.test(base)) return 'architecture';
  if (/(contributing|development|developer-guide)/.test(base)) return 'contributing';
  if (/(security|privacy|data-protection|data_privacy)/.test(base)) return 'security';
  if (/(testing|qa|quality)/.test(base)) return 'testing';
  if (/(deploy|deployment)/.test(base)) return 'deployment';
  if (/(release|rollback|runbook)/.test(base)) return 'release';
  if (/(roadmap|product|business|implementation|blueprint|plan)/.test(base)) return 'planning';
  return null;
}

function normalizeDocumentationContent(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/^Generated by ShipSeal\.?\s*$/gim, '')
    .replace(/\bGenerated at:\s*.+$/gim, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function signal(
  id: string,
  dimension: HealthDimensionId,
  label: string,
  status: HealthSignal['status'],
  weight: number,
  earned: number,
  evidence: string[],
  recommendationId?: string,
): HealthSignal {
  return { id, dimension, label, status, weight, earned, evidence, recommendationId };
}

function riskSignal(
  id: string,
  label: string,
  status: HealthSignal['status'],
  weight: number,
  earned: number,
  evidence: string[],
  recommendationId?: string,
): HealthSignal {
  return signal(id, 'contextWaste', label, status, weight, earned, evidence, recommendationId);
}

function findPaths(facts: SignalFacts, pattern: RegExp): string[] {
  return facts.files
    .filter(file => !file.isDir && pattern.test(file.path))
    .map(file => file.path)
    .sort();
}

function hasAny(facts: SignalFacts, pattern: RegExp): boolean {
  return facts.files.some(file => !file.isDir && pattern.test(file.path));
}

function evidenceOr(paths: string[], fallback: string): string[] {
  return paths.length ? paths : [fallback];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import type { ReadinessReport } from '../types';
import type { RepositoryAtlasModel } from './workspaceStory';
import type { RepositoryUniverseModel } from './repositoryUniverse';

export type AgentFlightPathConfidence = 'high' | 'medium' | 'low' | 'unavailable';
export type AgentFlightPathEvidenceState = 'evidence' | 'heuristic';
export type AgentFlightPathStepType =
  | 'start-here'
  | 'understand-context'
  | 'inspect-implementation'
  | 'check-ui'
  | 'check-api-boundary'
  | 'verify-behavior'
  | 'review-risk'
  | 'avoid-noise';

export interface AgentFlightPathRequest {
  task: string;
  report?: ReadinessReport | null;
  universe?: RepositoryUniverseModel | null;
  atlas?: RepositoryAtlasModel | null;
}

export interface AgentFlightPathEvidence {
  label: string;
  source: string;
  state: AgentFlightPathEvidenceState;
  path?: string;
  universeNodeId?: string;
  atlasNodeId?: string;
}

export interface AgentFlightPathStep {
  id: string;
  order: number;
  type: AgentFlightPathStepType;
  title: string;
  path?: string;
  nodeId?: string;
  atlasNodeId?: string;
  entityKind?: string;
  reason: string;
  evidenceState: AgentFlightPathEvidenceState;
  confidence: AgentFlightPathConfidence;
  command?: AgentFlightPathCommand;
}

export interface AgentFlightPathContextFile {
  path: string;
  label: string;
  role: 'starting-point' | 'supporting-context' | 'verification' | 'instruction' | 'fallback';
  reason: string;
  evidenceState: AgentFlightPathEvidenceState;
  universeNodeId?: string;
  atlasNodeId?: string;
}

export interface AgentFlightPathAvoidance {
  path: string;
  reason: string;
  evidenceState: AgentFlightPathEvidenceState;
}

export interface AgentFlightPathCommand {
  label: string;
  cmd: string;
  reason: string;
}

export interface AgentFlightPathReviewGate {
  id: string;
  label: string;
  reason: string;
}

export interface RepositoryAgentFlightPath {
  id: string;
  task: string;
  normalizedTaskIntent: string;
  status: 'ready' | 'needs-clarification' | 'unavailable';
  confidence: AgentFlightPathConfidence;
  summary: string;
  routeSteps: AgentFlightPathStep[];
  contextFiles: AgentFlightPathContextFile[];
  avoidances: AgentFlightPathAvoidance[];
  commands: AgentFlightPathCommand[];
  reviewGates: AgentFlightPathReviewGate[];
  clarificationSuggestions: string[];
  evidence: AgentFlightPathEvidence[];
  routeNodeIds: {
    universeNodeIds: string[];
    atlasNodeIds: string[];
  };
  prompt: string;
  metadata: {
    generatedFrom: 'existing-scan-evidence';
    graphMapping: 'mapped-existing-nodes-only' | 'limited';
    routeNodeCount: number;
  };
}

type IntentId = 'payment' | 'auth' | 'security' | 'ui' | 'pdf-report' | 'testing' | 'github' | 'scan' | 'docs' | 'general';

interface IntentProfile {
  id: IntentId;
  label: string;
  keywords: string[];
  pathPatterns: RegExp[];
  commandPatterns: RegExp;
  stepTitle: string;
}

const INTENTS: IntentProfile[] = [
  {
    id: 'payment',
    label: 'payment or billing work',
    keywords: ['billing', 'payment', 'stripe', 'checkout', 'subscription', 'invoice'],
    pathPatterns: [/billing|payment|stripe|checkout|subscription|invoice/i, /api|server|route|lib/i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect billing-related implementation points',
  },
  {
    id: 'auth',
    label: 'authentication work',
    keywords: ['auth', 'login', 'user', 'session', 'password', 'permission'],
    pathPatterns: [/auth|login|user|session|permission|middleware/i, /api|server|route|lib/i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect authentication boundary',
  },
  {
    id: 'security',
    label: 'security or data handling work',
    keywords: ['security', 'privacy', 'secret', 'token', 'data', 'compliance'],
    pathPatterns: [/security|privacy|secret|token|env|config|middleware/i, /api|server|route|lib/i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect safety and data boundary',
  },
  {
    id: 'ui',
    label: 'UI or layout work',
    keywords: ['ui', 'layout', 'mobile', 'pricing', 'landing', 'page', 'button', 'style', 'css', 'responsive'],
    pathPatterns: [/pricing|landing|page|component|layout|style|css|tailwind|theme/i, /^src\/|^app\/|^pages\/|^components\//i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect the likely UI surface',
  },
  {
    id: 'pdf-report',
    label: 'report or export work',
    keywords: ['pdf', 'report', 'export', 'delivery', 'html', 'score', 'manifest'],
    pathPatterns: [/pdf|report|export|delivery|score|manifest|client|handoff/i, /^src\/lib\/|^src\/components\//i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect report and export implementation',
  },
  {
    id: 'testing',
    label: 'testing or verification work',
    keywords: ['test', 'tests', 'qa', 'coverage', 'spec', 'vitest', 'playwright'],
    pathPatterns: [/test|spec|__tests__|coverage|playwright|vitest/i],
    commandPatterns: /test|coverage|vitest|jest|playwright/i,
    stepTitle: 'Start with existing tests',
  },
  {
    id: 'github',
    label: 'GitHub or PR workflow work',
    keywords: ['github', 'pr', 'pull', 'branch', 'repo', 'repository'],
    pathPatterns: [/github|pull|pr|branch|archive|repo/i, /^api\/|^src\/lib\/github/i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect GitHub workflow boundary',
  },
  {
    id: 'scan',
    label: 'scan or archive work',
    keywords: ['scan', 'scanner', 'zip', 'archive', 'upload', 'import'],
    pathPatterns: [/scan|scanner|zip|archive|upload|import|dropzone/i, /^src\/lib\/|^src\/hooks\//i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Inspect scan flow and archive handling',
  },
  {
    id: 'docs',
    label: 'documentation or project memory work',
    keywords: ['docs', 'documentation', 'readme', 'architecture', 'agents', 'instructions'],
    pathPatterns: [/readme|docs|documentation|architecture|agents|claude|instructions/i],
    commandPatterns: /build|lint|test|typecheck/i,
    stepTitle: 'Start with project documentation',
  },
];

const CLARIFICATION_SUGGESTIONS = [
  'Fix the mobile pricing layout',
  'Improve PDF export',
  'Add tests for the scan flow',
];

export function buildRepositoryAgentFlightPath({
  task,
  report,
  universe,
  atlas,
}: AgentFlightPathRequest): RepositoryAgentFlightPath {
  const trimmedTask = task.trim();
  if (!report) return unavailableFlightPath(trimmedTask);

  const normalized = normalizeTask(trimmedTask);
  const vague = isVagueTask(normalized);
  const intents = detectIntents(normalized);
  const primaryIntent = intents[0] || generalIntent();
  const pathIndex = buildPathIndex(report, universe || null, atlas || null);
  const docs = rankedByPatterns(pathIndex, [/^readme\b/i, /(^|\/)docs?\//i, /architecture/i], 3);
  const instructions = rankedByPatterns(pathIndex, [/agents\.md$/i, /claude\.md$/i, /cursor|copilot|instructions/i], 2);
  const implementation = rankedByPatterns(pathIndex, primaryIntent.pathPatterns, 6);
  const tests = rankedByPatterns(pathIndex, [/test|spec|__tests__|playwright|vitest/i], 4);
  const fallbackSource = rankedByPatterns(pathIndex, [/^src\/|^app\/|^pages\/|^components\/|^lib\//i], 4);
  const starts = implementation.length ? implementation : fallbackSource;
  const confidence = confidenceFor(vague, implementation.length, primaryIntent.id, docs.length + instructions.length, tests.length);
  const status = vague ? 'needs-clarification' : 'ready';
  const contextFiles = uniqueContextFiles([
    ...starts.slice(0, 4).map(item => contextFile(item, 'starting-point', reasonForStart(primaryIntent, implementation.length > 0), implementation.length > 0 ? 'evidence' : 'heuristic')),
    ...docs.map(item => contextFile(item, 'supporting-context', 'Use this to understand repository conventions and user-facing context.', 'evidence')),
    ...instructions.map(item => contextFile(item, 'instruction', 'Use this as durable project memory for the coding agent.', 'evidence')),
    ...tests.map(item => contextFile(item, 'verification', 'Use this to understand existing verification patterns.', 'evidence')),
  ]).slice(0, 10);
  const commands = detectedCommands(report, primaryIntent, status);
  const avoidances = detectedAvoidances(report);
  const reviewGates = reviewGatesFor(intents, normalized);
  const evidence = evidenceFor(contextFiles, commands, avoidances, primaryIntent, implementation.length > 0);
  const routeSteps = buildSteps({
    primaryIntent,
    contextFiles,
    commands,
    reviewGates,
    avoidances,
    implementationMapped: implementation.length > 0,
  });
  const routeNodeIds = mappedRouteNodeIds(contextFiles, routeSteps);
  const summary = summaryFor(trimmedTask, primaryIntent, confidence, implementation.length > 0, vague);
  const id = `agent-flight-path:${stableId(`${report.repoName}:${trimmedTask}:${contextFiles.map(file => file.path).join('|')}:${commands.map(command => command.cmd).join('|')}`)}`;
  const prompt = buildCopyPrompt({
    task: trimmedTask,
    summary,
    contextFiles,
    commands,
    avoidances,
    reviewGates,
    confidence,
  });

  return {
    id,
    task: trimmedTask,
    normalizedTaskIntent: primaryIntent.label,
    status,
    confidence,
    summary,
    routeSteps,
    contextFiles,
    avoidances,
    commands,
    reviewGates,
    clarificationSuggestions: status === 'needs-clarification' ? CLARIFICATION_SUGGESTIONS : [],
    evidence,
    routeNodeIds,
    prompt,
    metadata: {
      generatedFrom: 'existing-scan-evidence',
      graphMapping: routeNodeIds.universeNodeIds.length || routeNodeIds.atlasNodeIds.length ? 'mapped-existing-nodes-only' : 'limited',
      routeNodeCount: routeNodeIds.universeNodeIds.length + routeNodeIds.atlasNodeIds.length,
    },
  };
}

function unavailableFlightPath(task: string): RepositoryAgentFlightPath {
  return {
    id: `agent-flight-path:unavailable:${stableId(task || 'empty')}`,
    task,
    normalizedTaskIntent: 'scan required',
    status: 'unavailable',
    confidence: 'unavailable',
    summary: 'Scan a repository first to generate an agent route.',
    routeSteps: [],
    contextFiles: [],
    avoidances: [],
    commands: [],
    reviewGates: [],
    clarificationSuggestions: CLARIFICATION_SUGGESTIONS,
    evidence: [],
    routeNodeIds: { universeNodeIds: [], atlasNodeIds: [] },
    prompt: 'Scan a repository first to generate an agent route.',
    metadata: {
      generatedFrom: 'existing-scan-evidence',
      graphMapping: 'limited',
      routeNodeCount: 0,
    },
  };
}

interface PathCandidate {
  path: string;
  label: string;
  kind: string;
  category?: string;
  universeNodeId?: string;
  atlasNodeId?: string;
}

function buildPathIndex(report: ReadinessReport, universe: RepositoryUniverseModel | null, atlas: RepositoryAtlasModel | null) {
  const byPath = new Map<string, PathCandidate>();
  const add = (candidate: PathCandidate) => {
    const normalized = normalizePath(candidate.path);
    if (!normalized) return;
    const existing = byPath.get(normalized);
    byPath.set(normalized, {
      ...existing,
      ...candidate,
      path: normalized,
      universeNodeId: existing?.universeNodeId || candidate.universeNodeId,
      atlasNodeId: existing?.atlasNodeId || candidate.atlasNodeId,
    });
  };

  for (const file of report.analyzedFiles || report.sampleFiles || []) {
    if (!file.ignored) add({ path: file.path, label: basename(file.path), kind: 'file' });
  }
  for (const folder of report.summary.keyFolders || []) {
    add({ path: folder, label: folder, kind: 'folder' });
  }
  for (const file of report.summary.instructionFiles || []) {
    add({ path: file, label: basename(file), kind: 'file', category: 'agent-instruction' });
  }
  for (const node of universe?.nodes || []) {
    if (node.path) {
      add({
        path: node.path,
        label: node.label || basename(node.path),
        kind: node.kind,
        category: String(node.metadata.category || ''),
        universeNodeId: node.id,
        atlasNodeId: typeof node.metadata.atlasNodeId === 'string' ? node.metadata.atlasNodeId : undefined,
      });
    }
  }
  for (const node of atlas?.nodes || []) {
    if (node.path) {
      add({
        path: node.path,
        label: node.label || basename(node.path),
        kind: node.kind,
        category: String(node.metadata.category || ''),
        atlasNodeId: node.id,
      });
    }
  }

  return [...byPath.values()].sort((first, second) => first.path.localeCompare(second.path));
}

function rankedByPatterns(candidates: PathCandidate[], patterns: RegExp[], limit: number) {
  return candidates
    .map(candidate => ({
      candidate,
      score: patterns.reduce((score, pattern, index) => score + (pattern.test(candidate.path) || pattern.test(candidate.label) || pattern.test(candidate.category || '') ? 10 - index : 0), 0)
        + (candidate.kind === 'folder' ? 2 : 0),
    }))
    .filter(item => item.score > 0)
    .sort((first, second) => second.score - first.score || first.candidate.path.localeCompare(second.candidate.path))
    .slice(0, limit)
    .map(item => item.candidate);
}

function detectIntents(normalized: string) {
  const matches = INTENTS
    .map(intent => ({
      intent,
      score: intent.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .filter(item => item.score > 0)
    .sort((first, second) => second.score - first.score || first.intent.label.localeCompare(second.intent.label))
    .map(item => item.intent);
  return matches.length ? matches : [generalIntent()];
}

function generalIntent(): IntentProfile {
  return {
    id: 'general',
    label: 'general repository work',
    keywords: [],
    pathPatterns: [/^readme/i, /^src\/|^app\/|^pages\/|^components\/|^lib\//i],
    commandPatterns: /test|build|lint|typecheck/i,
    stepTitle: 'Start with high-signal repository areas',
  };
}

function detectedCommands(report: ReadinessReport, intent: IntentProfile, status: RepositoryAgentFlightPath['status']) {
  if (status === 'needs-clarification') return report.stack.runCommands
    .filter(command => /test|build|lint|typecheck/i.test(`${command.label} ${command.cmd}`))
    .slice(0, 3)
    .map(command => ({ ...command, reason: 'Detected command that can verify broad repository changes.' }));

  return report.stack.runCommands
    .filter(command => intent.commandPatterns.test(`${command.label} ${command.cmd}`))
    .slice(0, 4)
    .map(command => ({ ...command, reason: commandReason(command.cmd) }));
}

function detectedAvoidances(report: ReadinessReport): AgentFlightPathAvoidance[] {
  const ignoredFileFolders = (report.analyzedFiles || report.sampleFiles || [])
    .filter(file => file.ignored)
    .map(file => topLevelPathSegment(file.path))
    .filter(Boolean);
  const folders = [...new Set([...(report.scanSummary.ignoredGeneratedFolders || []), ...(report.repoContextPack.ignoredFolders || []), ...ignoredFileFolders])];
  return folders.slice(0, 8).map(path => ({
    path,
    reason: 'Detected generated/vendor context. Avoid unless the task specifically requires it.',
    evidenceState: 'evidence',
  }));
}

function reviewGatesFor(intents: IntentProfile[], normalized: string): AgentFlightPathReviewGate[] {
  const ids = new Set(intents.map(intent => intent.id));
  const gates: AgentFlightPathReviewGate[] = [];
  const add = (id: string, label: string, reason: string) => {
    if (!gates.some(gate => gate.id === id)) gates.push({ id, label, reason });
  };

  if (ids.has('payment')) add('payment', 'Payment and billing review', 'Billing work can affect money movement, subscriptions or customer trust.');
  if (ids.has('auth')) add('auth', 'Authentication review', 'Auth/session changes should be reviewed for access-control impact.');
  if (ids.has('security') || /secret|token|privacy|data|security/i.test(normalized)) add('security', 'Security and data review', 'Security or data-handling changes need human review before release.');
  if (ids.has('github')) add('github', 'GitHub write boundary', 'Do not create branches, commits or PRs unless explicitly requested.');
  if (ids.has('scan')) add('scan-engine', 'Scanner behavior review', 'Scanner/import changes affect repository evidence and export trust.');
  if (ids.has('pdf-report')) add('client-claims', 'Client-facing output review', 'Report/export changes can affect client-facing claims and should stay conservative.');
  if (/deploy|ci|workflow|release|production/i.test(normalized)) add('deployment', 'Deployment and CI review', 'Deployment or CI changes can affect release safety.');
  return gates;
}

function buildSteps({
  primaryIntent,
  contextFiles,
  commands,
  reviewGates,
  avoidances,
  implementationMapped,
}: {
  primaryIntent: IntentProfile;
  contextFiles: AgentFlightPathContextFile[];
  commands: AgentFlightPathCommand[];
  reviewGates: AgentFlightPathReviewGate[];
  avoidances: AgentFlightPathAvoidance[];
  implementationMapped: boolean;
}) {
  const steps: AgentFlightPathStep[] = [];
  const add = (step: Omit<AgentFlightPathStep, 'id' | 'order'>) => {
    const order = steps.length + 1;
    steps.push({ ...step, id: `flight-step:${order}:${stableId(`${step.title}:${step.path || ''}`)}`, order });
  };
  const start = contextFiles.find(file => file.role === 'starting-point') || contextFiles[0];
  const docs = contextFiles.find(file => file.role === 'supporting-context' || file.role === 'instruction');
  const verify = contextFiles.find(file => file.role === 'verification');

  if (start) {
    add({
      type: implementationMapped ? 'start-here' : 'inspect-implementation',
      title: implementationMapped ? primaryIntent.stepTitle : 'Start with likely source areas',
      path: start.path,
      nodeId: start.universeNodeId,
      atlasNodeId: start.atlasNodeId,
      entityKind: start.role,
      reason: start.reason,
      evidenceState: start.evidenceState,
      confidence: implementationMapped ? 'medium' : 'low',
    });
  }
  if (docs) {
    add({
      type: 'understand-context',
      title: 'Read project context before editing',
      path: docs.path,
      nodeId: docs.universeNodeId,
      atlasNodeId: docs.atlasNodeId,
      entityKind: docs.role,
      reason: docs.reason,
      evidenceState: docs.evidenceState,
      confidence: 'medium',
    });
  }
  if (verify || commands[0]) {
    add({
      type: 'verify-behavior',
      title: 'Verify with detected project commands',
      path: verify?.path,
      nodeId: verify?.universeNodeId,
      atlasNodeId: verify?.atlasNodeId,
      entityKind: verify?.role,
      reason: verify?.reason || 'Use detected command evidence to verify the task.',
      evidenceState: verify ? verify.evidenceState : 'evidence',
      confidence: commands.length ? 'medium' : 'low',
      command: commands[0],
    });
  }
  if (reviewGates.length) {
    add({
      type: 'review-risk',
      title: 'Pause for human review gates',
      reason: reviewGates.map(gate => gate.label).join(', '),
      evidenceState: 'heuristic',
      confidence: 'medium',
    });
  }
  if (avoidances.length) {
    add({
      type: 'avoid-noise',
      title: 'Avoid generated context unless needed',
      path: avoidances[0].path,
      reason: avoidances[0].reason,
      evidenceState: 'evidence',
      confidence: 'medium',
    });
  }
  return steps;
}

function contextFile(candidate: PathCandidate, role: AgentFlightPathContextFile['role'], reason: string, evidenceState: AgentFlightPathEvidenceState): AgentFlightPathContextFile {
  return {
    path: candidate.path,
    label: candidate.label,
    role,
    reason,
    evidenceState,
    universeNodeId: candidate.universeNodeId,
    atlasNodeId: candidate.atlasNodeId,
  };
}

function uniqueContextFiles(files: AgentFlightPathContextFile[]) {
  const seen = new Set<string>();
  return files.filter(file => {
    if (seen.has(file.path)) return false;
    seen.add(file.path);
    return true;
  });
}

function mappedRouteNodeIds(contextFiles: AgentFlightPathContextFile[], steps: AgentFlightPathStep[]) {
  return {
    universeNodeIds: [...new Set([...contextFiles.map(file => file.universeNodeId), ...steps.map(step => step.nodeId)].filter(Boolean) as string[])],
    atlasNodeIds: [...new Set([...contextFiles.map(file => file.atlasNodeId), ...steps.map(step => step.atlasNodeId)].filter(Boolean) as string[])],
  };
}

function evidenceFor(
  contextFiles: AgentFlightPathContextFile[],
  commands: AgentFlightPathCommand[],
  avoidances: AgentFlightPathAvoidance[],
  intent: IntentProfile,
  implementationMapped: boolean
): AgentFlightPathEvidence[] {
  return [
    ...contextFiles.map(file => ({
      label: file.path,
      source: 'Repository graph',
      state: file.evidenceState,
      path: file.path,
      universeNodeId: file.universeNodeId,
      atlasNodeId: file.atlasNodeId,
    })),
    ...commands.map(command => ({
      label: command.cmd,
      source: command.label,
      state: 'evidence' as const,
    })),
    ...avoidances.map(avoidance => ({
      label: avoidance.path,
      source: 'Ignored generated folder',
      state: 'evidence' as const,
      path: avoidance.path,
    })),
    {
      label: implementationMapped ? `${intent.label} matched scanned paths` : `No exact ${intent.label} path was detected`,
      source: 'Deterministic task routing',
      state: implementationMapped ? 'evidence' : 'heuristic',
    },
  ];
}

function buildCopyPrompt({
  task,
  summary,
  contextFiles,
  commands,
  avoidances,
  reviewGates,
  confidence,
}: {
  task: string;
  summary: string;
  contextFiles: AgentFlightPathContextFile[];
  commands: AgentFlightPathCommand[];
  avoidances: AgentFlightPathAvoidance[];
  reviewGates: AgentFlightPathReviewGate[];
  confidence: AgentFlightPathConfidence;
}) {
  const start = contextFiles.filter(file => file.role === 'starting-point').slice(0, 5).map(file => `- ${file.path} (${file.evidenceState})`);
  const supporting = contextFiles.filter(file => file.role !== 'starting-point').slice(0, 5).map(file => `- ${file.path} (${file.role})`);
  return [
    `Task: ${task || 'Describe the task first.'}`,
    `ShipSeal route confidence: ${confidence}. ${summary}`,
    '',
    'Start with:',
    ...(start.length ? start : ['- No exact starting file was detected. Start with the listed supporting context and ask before broad repository scans.']),
    '',
    'Supporting context:',
    ...(supporting.length ? supporting : ['- No additional context files were detected.']),
    '',
    'Avoid unless needed:',
    ...(avoidances.length ? avoidances.slice(0, 5).map(item => `- ${item.path}: ${item.reason}`) : ['- No generated/vendor folders were reported by the scan.']),
    '',
    'Detected commands:',
    ...(commands.length ? commands.map(command => `- ${command.cmd}`) : ['- No verified command detected. Ask the user before running project commands.']),
    '',
    'Human review gates:',
    ...(reviewGates.length ? reviewGates.map(gate => `- ${gate.label}: ${gate.reason}`) : ['- No special review gate detected from the task wording.']),
    '',
    'Instructions:',
    '- Use the route above before reading broadly.',
    '- Do not claim the route is complete or guaranteed.',
    '- Do not commit or push unless explicitly requested.',
    '- End with a concise implementation summary and verification results.',
  ].join('\n').slice(0, 3800);
}

function summaryFor(task: string, intent: IntentProfile, confidence: AgentFlightPathConfidence, implementationMapped: boolean, vague: boolean) {
  if (vague) return 'The task is broad, so ShipSeal is showing a safe low-confidence route through documentation, source areas and verification commands.';
  if (implementationMapped) return `Suggested route for "${task}" using detected ${intent.label} evidence.`;
  return `No exact ${intent.label} file was detected. ShipSeal is routing through likely repository areas and marking those steps as heuristic.`;
}

function confidenceFor(vague: boolean, implementationCount: number, intentId: IntentId, supportCount: number, testCount: number): AgentFlightPathConfidence {
  if (vague) return 'low';
  if (implementationCount >= 2 && supportCount > 0 && (testCount > 0 || intentId !== 'testing')) return 'high';
  if (implementationCount > 0 || supportCount > 0) return 'medium';
  return 'low';
}

function reasonForStart(intent: IntentProfile, exactMatch: boolean) {
  if (exactMatch) return `Matched the task to scanned ${intent.label} paths.`;
  return `No exact ${intent.label} file was detected; this is a likely source/context route from repository structure.`;
}

function commandReason(cmd: string) {
  if (/test|vitest|jest|playwright|coverage/i.test(cmd)) return 'Detected verification command relevant to the task.';
  if (/build/i.test(cmd)) return 'Detected build command for integration confidence.';
  if (/lint|typecheck|tsc/i.test(cmd)) return 'Detected static check command for safer edits.';
  return 'Detected project command from scan evidence.';
}

function normalizeTask(task: string) {
  return task.toLowerCase().replace(/[^a-z0-9\s/.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isVagueTask(normalized: string) {
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  return /^(make|improve|fix|update|change|clean|refactor|do)\s+(it|this|things|stuff|better|repo|repository|code)(\s+better)?$/i.test(normalized);
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

function basename(path: string) {
  return normalizePath(path).split('/').filter(Boolean).pop() || path;
}

function topLevelPathSegment(path: string) {
  return normalizePath(path).split('/').filter(Boolean)[0] || '';
}

function stableId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'route';
}

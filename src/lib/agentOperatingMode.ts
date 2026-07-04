import type { AgentOperatingModeId, AgentPackFile, ReadinessReport } from './types';

export interface AgentOperatingMode {
  id: AgentOperatingModeId;
  label: string;
  shortLabel: string;
  expectedTokenUsage: string;
  confidence: string;
  summary: string;
  bestFor: string[];
  rules: string[];
  verification: string[];
  tradeoffs: string[];
}

export const DEFAULT_AGENT_OPERATING_MODE: AgentOperatingModeId = 'balanced-productivity';

export const AGENT_OPERATING_MODES: AgentOperatingMode[] = [
  {
    id: 'maximum-reliability',
    label: 'Maximum Reliability',
    shortLabel: 'Reliability',
    expectedTokenUsage: 'Broader context coverage',
    confidence: 'Maximum confidence',
    summary: 'Best for production preparation, large refactors, and security-sensitive work.',
    bestFor: ['Production preparation', 'Large refactors', 'Security-sensitive work'],
    rules: [
      'Read AGENTS.md, CLAUDE.md, the task, nearby source files, related tests, and relevant config before editing.',
      'Prefer a short implementation plan before code changes.',
      'Use cautious, reviewable diffs and avoid broad rewrites unless explicitly requested.',
      'Check security, data, deployment, and compatibility risks before declaring the task done.',
    ],
    verification: [
      'Run targeted tests for the changed area.',
      'Run full test/build commands when the change touches shared logic, security, exports, or production paths.',
      'Report commands run, skipped commands, and any residual risk.',
    ],
    tradeoffs: [
      'Uses more context before editing.',
      'Runs stronger verification more often.',
      'Slower, but better when mistakes are expensive.',
    ],
  },
  {
    id: 'balanced-productivity',
    label: 'Balanced Context',
    shortLabel: 'Balanced',
    expectedTokenUsage: 'Balanced context use',
    confidence: 'Recommended default',
    summary: 'Recommended default for normal development without excessive context or verification cycles.',
    bestFor: ['Daily development', 'Feature work', 'Normal iterations'],
    rules: [
      'Read the task, AGENTS.md, and only the files needed for the change.',
      'Prefer existing project patterns and keep edits scoped.',
      'Avoid unnecessary full repository scans after tiny edits.',
      'Use full test/build only when the touched surface justifies it.',
    ],
    verification: [
      'Run targeted tests when practical.',
      'Provide manual full verification commands if full test/build was not run.',
      'Summarize changed files and behavior clearly.',
    ],
    tradeoffs: [
      'Uses enough context for safe edits without reading everything.',
      'Prefers targeted checks for small changes.',
      'Escalates to full verification when shared or risky code changes.',
    ],
  },
  {
    id: 'token-saver',
    label: 'Focused Context',
    shortLabel: 'Focused',
    expectedTokenUsage: 'Lowest context use',
    confidence: 'Fastest iteration',
    summary: 'Best for low-risk UI tweaks and short iterations where a narrow working set is enough.',
    bestFor: ['Low-risk UI tweaks', 'Short iterations', 'Narrow working sets'],
    rules: [
      'Do not scan the whole repository unless needed.',
      'Do not open large files unless directly relevant.',
      'Avoid full build/test unless explicitly requested.',
      'Do not commit or push unless explicitly requested.',
      'Prefer concise updates and manual verification commands.',
    ],
    verification: [
      'Run the smallest relevant check only when useful.',
      'List exact manual commands for the user.',
      'Call out anything not verified.',
    ],
    tradeoffs: [
      'Uses less context and asks the user to verify more.',
      'Skips broad repository reads unless the task needs them.',
      'Good for speed, but not for security-sensitive or production changes.',
    ],
  },
];

export function getAgentOperatingMode(id: AgentOperatingModeId = DEFAULT_AGENT_OPERATING_MODE): AgentOperatingMode {
  return AGENT_OPERATING_MODES.find(mode => mode.id === id) || AGENT_OPERATING_MODES[1];
}

export function resolveAgentOperatingMode(id?: string): AgentOperatingModeId {
  return AGENT_OPERATING_MODES.some(mode => mode.id === id)
    ? id as AgentOperatingModeId
    : DEFAULT_AGENT_OPERATING_MODE;
}

export function selectionUsesAgentDevelopment(selectedPackages: string[] = []) {
  return selectedPackages.includes('agent-readiness') || selectedPackages.includes('full-package');
}

export function applyAgentOperatingModeToFiles(report: ReadinessReport, modeId: AgentOperatingModeId = DEFAULT_AGENT_OPERATING_MODE): AgentPackFile[] {
  const mode = getAgentOperatingMode(modeId);
  const costFile = buildAgentCostOptimizationFile(report, mode);
  const nextFiles = report.agentPack.map(file => {
    if (file.name === 'AGENTS.md') {
      return {
        ...file,
        content: `${stripExistingModeSection(file.content, 'Agent Cost Optimizer')}\n\n${agentModeSection(report, mode)}\n`,
      };
    }
    if (file.name === 'CLAUDE.md') {
      return {
        ...file,
        content: `${stripExistingModeSection(file.content, 'Agent operating mode')}\n\n${claudeModeSection(mode)}\n`,
      };
    }
    if (file.name === 'AGENT_COST_OPTIMIZATION.md') return costFile;
    return file;
  });

  if (nextFiles.some(file => file.name === 'AGENT_COST_OPTIMIZATION.md')) return nextFiles;

  const claudeIndex = nextFiles.findIndex(file => file.name === 'CLAUDE.md');
  if (claudeIndex < 0) return [costFile, ...nextFiles];
  return [
    ...nextFiles.slice(0, claudeIndex + 1),
    costFile,
    ...nextFiles.slice(claudeIndex + 1),
  ];
}

export function buildAgentOperatingModeSummary(modeId: AgentOperatingModeId = DEFAULT_AGENT_OPERATING_MODE) {
  const mode = getAgentOperatingMode(modeId);
  return {
    id: mode.id,
    label: mode.label,
    summary: mode.summary,
    expectedTokenUsage: mode.expectedTokenUsage,
    confidence: mode.confidence,
  };
}

function agentModeSection(report: ReadinessReport, mode: AgentOperatingMode) {
  return [
    '## Agent Cost Optimizer',
    `Recommended operating mode: ${mode.label}`,
    '',
    `Expected context use: ${mode.expectedTokenUsage}`,
    `Confidence profile: ${mode.confidence}`,
    '',
    mode.summary,
    '',
    `Reason: ${modeReason(report, mode)}`,
    '',
    'ShipSeal helps AI coding agents avoid unnecessary context usage and excessive verification cycles by matching the agent workflow to the project and task risk.',
    '',
    '### Mode rules',
    ...mode.rules.map(rule => `- ${rule}`),
    '',
    '### Verification expectations',
    ...mode.verification.map(rule => `- ${rule}`),
    '',
    '### Expected tradeoffs',
    ...mode.tradeoffs.map(rule => `- ${rule}`),
    '',
    '### Scan signals used',
    ...scanSignalLines(report),
  ].join('\n');
}

function claudeModeSection(mode: AgentOperatingMode) {
  return [
    '## Agent operating mode',
    `Recommended operating mode: ${mode.label}`,
    '',
    `Expected context use: ${mode.expectedTokenUsage}`,
    '',
    mode.summary,
    '',
    `Reason: ${modeReason(undefined, mode)}`,
    '',
    '### Claude Code behavior',
    ...mode.rules.map(rule => `- ${rule}`),
  ].join('\n');
}

function buildAgentCostOptimizationFile(report: ReadinessReport, mode: AgentOperatingMode): AgentPackFile {
  const content = [
    `# AGENT_COST_OPTIMIZATION.md - ${report.repoName}`,
    '',
    'Generated by ShipSeal.',
    '',
    `Recommended operating mode: ${mode.label}`,
    '',
    `Expected context use: ${mode.expectedTokenUsage}`,
    `Confidence profile: ${mode.confidence}`,
    '',
    mode.summary,
    '',
    `Reason: ${modeReason(report, mode)}`,
    '',
    'ShipSeal helps AI coding agents avoid unnecessary context usage and excessive verification cycles. It does not promise fixed savings; it gives the agent a clearer operating policy.',
    '',
    '## Best fit',
    ...mode.bestFor.map(item => `- ${item}`),
    '',
    '## Operating rules',
    ...mode.rules.map(rule => `- ${rule}`),
    '',
    '## Verification',
    ...mode.verification.map(rule => `- ${rule}`),
    '',
    '## Expected tradeoffs',
    ...mode.tradeoffs.map(rule => `- ${rule}`),
    '',
    '## Scan signals used',
    ...scanSignalLines(report),
    '',
    '## Manual verification commands',
    ...manualCommandLines(report),
    '',
  ].join('\n');

  return {
    name: 'AGENT_COST_OPTIMIZATION.md',
    language: 'markdown',
    description: `Agent operating mode guidance for ${mode.label}.`,
    content,
  };
}

function scanSignalLines(report: ReadinessReport) {
  return [
    `- Stack: ${report.stack.primary}`,
    `- Languages: ${report.stack.languages.join(', ') || 'unknown'}`,
    `- Frameworks: ${report.stack.frameworks.join(', ') || 'none detected'}`,
    `- Build commands: ${commandsByLabel(report, 'build')}`,
    `- Test commands: ${commandsByLabel(report, 'test')}`,
    `- Key folders: ${report.summary.keyFolders.join(', ') || 'none detected'}`,
    `- Generated/vendor folders ignored: ${report.scanSummary.ignoredGeneratedFolders.join(', ') || 'none reported'}`,
    `- Existing instruction files: ${report.summary.instructionFiles.join(', ') || 'none detected'}`,
  ];
}

function manualCommandLines(report: ReadinessReport) {
  if (!report.stack.runCommands.length) return ['- No project commands were detected. Add manual verification commands before relying on this pack.'];
  return report.stack.runCommands.map(command => `- ${command.label}: \`${command.cmd}\``);
}

function commandsByLabel(report: ReadinessReport, label: string) {
  const matches = report.stack.runCommands.filter(command => command.label.toLowerCase().includes(label));
  return matches.length ? matches.map(command => `\`${command.cmd}\``).join(', ') : 'not detected';
}

function modeReason(report: ReadinessReport | undefined, mode: AgentOperatingMode) {
  if (mode.id === 'maximum-reliability') {
    return 'Use this when confidence matters more than a narrow working set, especially around production, large refactors, security, data handling, or deployment changes.';
  }
  if (mode.id === 'token-saver') {
    return 'Use this for short, low-risk iterations where avoiding extra file reads, broad repo scans, and full verification cycles matters most.';
  }

  if (!report) {
    return 'Project size and detected stack suggest that normal development can safely avoid excessive build/test cycles while keeping useful guardrails.';
  }

  const commandSignal = report.stack.runCommands.length
    ? `Detected project commands (${report.stack.runCommands.map(command => command.label).join(', ')}) can be used selectively.`
    : 'No project commands were detected, so manual verification guidance should stay explicit.';

  return `Project size (${report.fileCount.toLocaleString()} files) and detected stack (${report.stack.primary}) suggest that normal development can safely avoid excessive build/test cycles. ${commandSignal}`;
}

function stripExistingModeSection(content: string, heading: string) {
  const pattern = new RegExp(`\\n\\n## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*$`, 'i');
  return content.trim().replace(pattern, '').trim();
}

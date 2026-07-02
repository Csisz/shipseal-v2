import type { HealthDimensionId, HealthRecommendation, HealthSignal } from './types';

type RecommendationTemplate = Omit<HealthRecommendation, 'evidence'>;

const RECOMMENDATION_TEMPLATES: Record<string, RecommendationTemplate> = {
  'repo.readme': {
    id: 'repo.readme',
    title: 'Add a compact repository README',
    whyItMatters: 'Agents need a fast, authoritative overview before choosing files or commands.',
    action: 'Create README.md with purpose, setup, core folders, and the smallest safe verification commands.',
    dimensions: ['repositoryIntelligence'],
    suggestedTargetPath: 'README.md',
    potentialDimensionGain: 5,
    priority: 'High',
  },
  'repo.docs-index': {
    id: 'repo.docs-index',
    title: 'Create a documentation index',
    whyItMatters: 'A docs index reduces routing ambiguity when several project documents exist.',
    action: 'Create docs/README.md linking the current architecture, delivery, testing, and operating docs.',
    dimensions: ['repositoryIntelligence', 'contextWaste'],
    suggestedTargetPath: 'docs/README.md',
    potentialDimensionGain: 6,
    priority: 'Medium',
  },
  'repo.canonical-docs': {
    id: 'repo.canonical-docs',
    title: 'Resolve duplicate canonical documentation families',
    whyItMatters: 'Multiple active docs for the same topic make agents choose between competing sources.',
    action: 'Keep one active document per family and move obsolete versions under docs/archive/ with clear dates.',
    dimensions: ['repositoryIntelligence', 'contextWaste'],
    suggestedTargetPath: 'docs/archive/',
    potentialDimensionGain: 10,
    priority: 'High',
  },
  'repo.instructions-root': {
    id: 'repo.instructions-root',
    title: 'Add root agent instructions',
    whyItMatters: 'A root instruction file gives coding agents repository-wide safety and verification boundaries.',
    action: 'Create AGENTS.md with repository scope, safe commands, critical files, and review expectations.',
    dimensions: ['repositoryIntelligence', 'agentRouting'],
    suggestedTargetPath: 'AGENTS.md',
    potentialDimensionGain: 10,
    priority: 'High',
  },
  'repo.source-map': {
    id: 'repo.source-map',
    title: 'Clarify source and stack anchors',
    whyItMatters: 'Agents work faster when they can identify the source folders and stack manifest without guessing.',
    action: 'Add or document the primary source folders and stack manifest in README.md or docs/README.md.',
    dimensions: ['repositoryIntelligence'],
    suggestedTargetPath: 'README.md',
    potentialDimensionGain: 3,
    priority: 'Medium',
  },
  'waste.generated-file-ratio': {
    id: 'waste.generated-file-ratio',
    title: 'Exclude generated and vendor folders from scans',
    whyItMatters: 'Generated files add repository noise and make static context selection less reliable.',
    action: 'Keep node_modules, dist, build, coverage, vendor, and similar outputs out of repository archives and .gitignore them.',
    dimensions: ['contextWaste'],
    suggestedTargetPath: '.gitignore',
    potentialDimensionGain: 20,
    priority: 'High',
  },
  'waste.generated-byte-ratio': {
    id: 'waste.generated-byte-ratio',
    title: 'Reduce generated/vendor byte weight',
    whyItMatters: 'Large generated/vendor artifacts dominate static scan evidence even when file counts look acceptable.',
    action: 'Remove committed build artifacts or move them outside the repository archive used for ShipSeal scans.',
    dimensions: ['contextWaste'],
    suggestedTargetPath: '.gitignore',
    potentialDimensionGain: 15,
    priority: 'High',
  },
  'waste.large-relevant-files': {
    id: 'waste.large-relevant-files',
    title: 'Split or summarize oversized relevant files',
    whyItMatters: 'Very large source or documentation files are difficult for agents to inspect precisely.',
    action: 'Split giant files by responsibility or add a compact companion summary that points to the important sections.',
    dimensions: ['contextWaste'],
    potentialDimensionGain: 15,
    priority: 'High',
  },
  'waste.duplicate-docs': {
    id: 'waste.duplicate-docs',
    title: 'Remove exact duplicate documentation',
    whyItMatters: 'Exact duplicate docs waste context and create uncertainty about which copy is canonical.',
    action: 'Keep one canonical copy and replace duplicates with links or archive notes.',
    dimensions: ['contextWaste'],
    suggestedTargetPath: 'docs/archive/',
    potentialDimensionGain: 15,
    priority: 'High',
  },
  'waste.active-doc-sprawl': {
    id: 'waste.active-doc-sprawl',
    title: 'Archive obsolete active documentation',
    whyItMatters: 'A large active doc set increases context selection work before coding can begin.',
    action: 'Move obsolete documents under docs/archive/ and keep docs/README.md as the active index.',
    dimensions: ['contextWaste'],
    suggestedTargetPath: 'docs/archive/',
    potentialDimensionGain: 10,
    priority: 'Medium',
  },
  'waste.canonical-conflicts': {
    id: 'waste.canonical-conflicts',
    title: 'Choose one canonical document per topic',
    whyItMatters: 'Conflicting active architecture, planning, testing, or delivery docs increase agent routing friction.',
    action: 'Merge or archive competing documents for the same family and link the active one from docs/README.md.',
    dimensions: ['contextWaste', 'repositoryIntelligence'],
    suggestedTargetPath: 'docs/README.md',
    potentialDimensionGain: 10,
    priority: 'High',
  },
  'waste.compact-anchor-missing': {
    id: 'waste.compact-anchor-missing',
    title: 'Add a compact context anchor',
    whyItMatters: 'Agents need one small starting point before reading deeper project material.',
    action: 'Create README.md, AGENTS.md, or docs/README.md with links to the current source, docs, and commands.',
    dimensions: ['contextWaste', 'repositoryIntelligence'],
    suggestedTargetPath: 'docs/README.md',
    potentialDimensionGain: 10,
    priority: 'High',
  },
  'waste.entrypoint-ambiguity': {
    id: 'waste.entrypoint-ambiguity',
    title: 'Clarify application entry points',
    whyItMatters: 'Ambiguous entry points make agents spend static-analysis effort before making a safe change.',
    action: 'Document the primary app entry points in docs/TASK_ROUTER.md or README.md.',
    dimensions: ['contextWaste', 'agentRouting'],
    suggestedTargetPath: 'docs/TASK_ROUTER.md',
    potentialDimensionGain: 5,
    priority: 'Medium',
  },
  'ai.stack-detected': {
    id: 'ai.stack-detected',
    title: 'Add a recognizable stack manifest',
    whyItMatters: 'Build and test recommendations need a detected stack boundary.',
    action: 'Add the appropriate manifest such as package.json, pyproject.toml, go.mod, Cargo.toml, or pom.xml.',
    dimensions: ['aiDevelopmentReadiness'],
    potentialDimensionGain: 5,
    priority: 'High',
  },
  'ai.package-scripts': {
    id: 'ai.package-scripts',
    title: 'Declare build, test, and quality scripts',
    whyItMatters: 'Agents need explicit local commands to verify their changes without guessing.',
    action: 'Add package scripts for build, test, lint or typecheck, matching the repository stack.',
    dimensions: ['aiDevelopmentReadiness'],
    suggestedTargetPath: 'package.json',
    potentialDimensionGain: 8,
    priority: 'High',
  },
  'ai.tests-present': {
    id: 'ai.tests-present',
    title: 'Add a test signal',
    whyItMatters: 'A deterministic test entry gives agents a focused way to check behavior.',
    action: 'Add a test script or a small tests/ fixture that matches the current framework.',
    dimensions: ['aiDevelopmentReadiness'],
    suggestedTargetPath: 'package.json',
    potentialDimensionGain: 5,
    priority: 'High',
  },
  'ai.ci-workflow': {
    id: 'ai.ci-workflow',
    title: 'Add a reviewed CI workflow',
    whyItMatters: 'CI files show intended verification flow, although their presence does not prove commands pass.',
    action: 'Create a human-reviewed workflow that installs dependencies and runs the existing build/test scripts.',
    dimensions: ['aiDevelopmentReadiness'],
    suggestedTargetPath: '.github/workflows/ci.yml',
    potentialDimensionGain: 4,
    priority: 'Medium',
  },
  'ai.ci-script-cross-reference': {
    id: 'ai.ci-script-cross-reference',
    title: 'Align CI with package scripts',
    whyItMatters: 'CI is more useful when it references the same commands agents should run locally.',
    action: 'Update the CI workflow to call detected scripts such as npm run build and npm run test.',
    dimensions: ['aiDevelopmentReadiness'],
    suggestedTargetPath: '.github/workflows/ci.yml',
    potentialDimensionGain: 4,
    priority: 'Medium',
  },
  'ai.lockfile': {
    id: 'ai.lockfile',
    title: 'Commit a dependency lockfile',
    whyItMatters: 'A lockfile makes install behavior more repeatable for local and CI verification.',
    action: 'Commit the lockfile generated by the repository package manager.',
    dimensions: ['aiDevelopmentReadiness'],
    potentialDimensionGain: 3,
    priority: 'Medium',
  },
  'route.root-instructions': {
    id: 'route.root-instructions',
    title: 'Add root agent routing instructions',
    whyItMatters: 'Root instructions establish repository-wide agent behavior and safety rules.',
    action: 'Create AGENTS.md with change boundaries, commands, and escalation notes.',
    dimensions: ['agentRouting'],
    suggestedTargetPath: 'AGENTS.md',
    potentialDimensionGain: 6,
    priority: 'High',
  },
  'route.folder-instructions': {
    id: 'route.folder-instructions',
    title: 'Add folder-level agent instructions for key areas',
    whyItMatters: 'Folder instructions help agents route UI, API, test, and docs work directly to the right place.',
    action: 'Add focused AGENTS.md files under important folders such as src/, api/, docs/, or tests/.',
    dimensions: ['agentRouting'],
    suggestedTargetPath: 'src/AGENTS.md',
    potentialDimensionGain: 4,
    priority: 'Medium',
  },
  'route.task-router': {
    id: 'route.task-router',
    title: 'Create a task router',
    whyItMatters: 'A task router maps common change types to folders and verification commands.',
    action: 'Create docs/TASK_ROUTER.md mapping UI, API, documentation, and test changes to starting folders and focused commands.',
    dimensions: ['agentRouting', 'contextWaste'],
    suggestedTargetPath: 'docs/TASK_ROUTER.md',
    potentialDimensionGain: 8,
    priority: 'High',
  },
  'route.command-map': {
    id: 'route.command-map',
    title: 'Document the command map',
    whyItMatters: 'A command map tells agents which commands are safe, focused, and relevant.',
    action: 'Create docs/COMMANDS.md from the existing package scripts and CI commands.',
    dimensions: ['agentRouting'],
    suggestedTargetPath: 'docs/COMMANDS.md',
    potentialDimensionGain: 4,
    priority: 'Medium',
  },
  'route.critical-policy': {
    id: 'route.critical-policy',
    title: 'Document critical file policy',
    whyItMatters: 'Critical file policies keep agents cautious around deployment, auth, security, and data handling.',
    action: 'Create docs/CRITICAL_FILES_POLICY.md listing sensitive paths and human-review requirements.',
    dimensions: ['agentRouting', 'deliveryConfidence'],
    suggestedTargetPath: 'docs/CRITICAL_FILES_POLICY.md',
    potentialDimensionGain: 6,
    priority: 'High',
  },
  'route.known-risks': {
    id: 'route.known-risks',
    title: 'Document known risks',
    whyItMatters: 'Known risk notes prevent repeated rediscovery and guide safer changes.',
    action: 'Create docs/KNOWN_RISKS.md with current risks, owners, and review expectations.',
    dimensions: ['agentRouting', 'deliveryConfidence'],
    suggestedTargetPath: 'docs/KNOWN_RISKS.md',
    potentialDimensionGain: 3,
    priority: 'Medium',
  },
  'route.entry-point-clarity': {
    id: 'route.entry-point-clarity',
    title: 'Document entry point routing',
    whyItMatters: 'Entry point notes reduce ambiguity before agents edit application code.',
    action: 'Add entry point notes to docs/TASK_ROUTER.md or README.md.',
    dimensions: ['agentRouting', 'contextWaste'],
    suggestedTargetPath: 'docs/TASK_ROUTER.md',
    potentialDimensionGain: 4,
    priority: 'Medium',
  },
  'delivery.deployment-docs': {
    id: 'delivery.deployment-docs',
    title: 'Document deployment flow',
    whyItMatters: 'Deployment notes help reviewers understand release impact without assuming infrastructure behavior.',
    action: 'Create docs/DEPLOYMENT.md with environment, build, deploy, and rollback touchpoints.',
    dimensions: ['deliveryConfidence'],
    suggestedTargetPath: 'docs/DEPLOYMENT.md',
    potentialDimensionGain: 5,
    priority: 'Medium',
  },
  'delivery.rollback-runbook-release': {
    id: 'delivery.rollback-runbook-release',
    title: 'Add release and rollback guidance',
    whyItMatters: 'Release and rollback notes improve handoff confidence for client-facing delivery.',
    action: 'Create docs/RELEASE_CHECKLIST.md or docs/RUNBOOK.md with review steps and rollback owner notes.',
    dimensions: ['deliveryConfidence'],
    suggestedTargetPath: 'docs/RELEASE_CHECKLIST.md',
    potentialDimensionGain: 5,
    priority: 'Medium',
  },
  'delivery.security-policy': {
    id: 'delivery.security-policy',
    title: 'Add security and data handling review anchor',
    whyItMatters: 'Security/data notes make sensitive areas visible before agent-assisted changes.',
    action: 'Create SECURITY.md or docs/DATA_PRIVACY_CHECKLIST.md with human-review boundaries.',
    dimensions: ['deliveryConfidence'],
    suggestedTargetPath: 'SECURITY.md',
    potentialDimensionGain: 4,
    priority: 'High',
  },
  'delivery.env-and-ignore': {
    id: 'delivery.env-and-ignore',
    title: 'Make environment and ignored outputs explicit',
    whyItMatters: 'Environment examples and ignore rules reduce accidental secret or generated-output handling.',
    action: 'Add .env.example and .gitignore entries for generated outputs and local secret files.',
    dimensions: ['deliveryConfidence'],
    suggestedTargetPath: '.env.example',
    potentialDimensionGain: 4,
    priority: 'High',
  },
  'delivery.critical-blockers': {
    id: 'delivery.critical-blockers',
    title: 'Resolve critical readiness blockers',
    whyItMatters: 'Critical blockers prevent a repository from being treated as delivery-ready for agent work.',
    action: 'Address the detected blocker before relying on agent-assisted delivery workflows.',
    dimensions: ['deliveryConfidence'],
    potentialDimensionGain: 7,
    priority: 'High',
  },
};

export function buildRepositoryHealthRecommendations(signals: HealthSignal[], maxActions = 5): HealthRecommendation[] {
  return signals
    .filter(signal => signal.status === 'fail' || signal.status === 'partial')
    .map(signal => recommendationForSignal(signal))
    .filter((recommendation): recommendation is HealthRecommendation => !!recommendation)
    .sort(compareRecommendations)
    .slice(0, maxActions);
}

export function recommendationForSignal(signal: HealthSignal): HealthRecommendation | null {
  if (!signal.recommendationId) return null;
  const template = RECOMMENDATION_TEMPLATES[signal.recommendationId];
  if (!template) return null;
  return {
    ...template,
    evidence: signal.evidence,
    dimensions: [...template.dimensions] as HealthDimensionId[],
  };
}

export function hasRecommendationForFailedSignal(signal: HealthSignal): boolean {
  if (signal.status !== 'fail') return true;
  return !!recommendationForSignal(signal);
}

function compareRecommendations(a: HealthRecommendation, b: HealthRecommendation): number {
  const priority = priorityRank(b.priority) - priorityRank(a.priority);
  if (priority !== 0) return priority;
  const gain = b.potentialDimensionGain - a.potentialDimensionGain;
  if (gain !== 0) return gain;
  return a.id.localeCompare(b.id);
}

function priorityRank(priority: HealthRecommendation['priority']): number {
  if (priority === 'High') return 3;
  if (priority === 'Medium') return 2;
  return 1;
}

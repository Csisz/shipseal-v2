import type { RepositoryTransformationDomain } from '../repositoryTransformation.js';
import { normalizeRepositoryFuturePath } from './identity.js';
import type { RepositoryFutureDependencyDefinition } from './schema.js';

export const REPOSITORY_FUTURE_CAPABILITIES = {
  repositoryEvidence: 'repository-evidence',
  repositoryQuality: 'repository-quality',
  riskRemediation: 'risk-remediation',
  projectMemory: 'project-memory',
  architectureMemory: 'architecture-memory',
  agentInstructions: 'agent-instructions',
  folderAgentGuidance: 'folder-agent-guidance',
  agentRouting: 'agent-routing',
  taskRouting: 'task-routing',
  verificationStrategy: 'verification-strategy',
  verificationGates: 'verification-gates',
  testingCiGuidance: 'testing-ci-guidance',
  dependencyReadiness: 'dependency-readiness',
  repositoryCapability: 'repository-capability',
} as const;

export const DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS: RepositoryFutureDependencyDefinition[] = [
  definition(REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence, 'Repository evidence', 'Bounded current repository evidence is required before a future recommendation can become executable.', []),
  definition(REPOSITORY_FUTURE_CAPABILITIES.repositoryQuality, 'Repository quality', 'Repository quality work must remain tied to current deterministic friction.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.riskRemediation, 'Risk remediation', 'Risk remediation requires current evidence and human review where sensitive.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.projectMemory, 'Project memory', 'Project memory must be grounded in current repository evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.architectureMemory, 'Architecture memory', 'Architecture memory depends on current repository evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.agentInstructions, 'Agent instructions', 'Agent instructions depend on current repository evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.folderAgentGuidance, 'Folder agent guidance', 'Scoped guidance depends on repository-level agent instructions.', [REPOSITORY_FUTURE_CAPABILITIES.agentInstructions]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.agentRouting, 'Agent routing', 'Agent routing depends on current repository evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.taskRouting, 'Task routing', 'Task routing depends on project memory and current evidence.', [REPOSITORY_FUTURE_CAPABILITIES.projectMemory]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy, 'Verification strategy', 'Verification strategy depends on current repository evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.verificationGates, 'Verification gates', 'Verification gates depend on an explicit verification strategy.', [REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.testingCiGuidance, 'Testing and CI guidance', 'Testing and CI guidance depends on current repository evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.dependencyReadiness, 'Dependency readiness', 'Dependency readiness is derived from compatible verification evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
  definition(REPOSITORY_FUTURE_CAPABILITIES.repositoryCapability, 'Repository capability', 'A repository capability must remain grounded in current evidence.', [REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence]),
].sort((left, right) => left.id.localeCompare(right.id));

const DEPENDENCY_ALIASES = new Map<string, string>([
  ['repository evidence', REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence],
  ['repository intelligence', REPOSITORY_FUTURE_CAPABILITIES.repositoryEvidence],
  ['project memory', REPOSITORY_FUTURE_CAPABILITIES.projectMemory],
  ['repository memory', REPOSITORY_FUTURE_CAPABILITIES.projectMemory],
  ['architecture memory', REPOSITORY_FUTURE_CAPABILITIES.architectureMemory],
  ['architecture context', REPOSITORY_FUTURE_CAPABILITIES.architectureMemory],
  ['agent instructions', REPOSITORY_FUTURE_CAPABILITIES.agentInstructions],
  ['agents instructions', REPOSITORY_FUTURE_CAPABILITIES.agentInstructions],
  ['folder agent guidance', REPOSITORY_FUTURE_CAPABILITIES.folderAgentGuidance],
  ['folder instructions', REPOSITORY_FUTURE_CAPABILITIES.folderAgentGuidance],
  ['agent routing', REPOSITORY_FUTURE_CAPABILITIES.agentRouting],
  ['task routing', REPOSITORY_FUTURE_CAPABILITIES.taskRouting],
  ['task router', REPOSITORY_FUTURE_CAPABILITIES.taskRouting],
  ['verification strategy', REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy],
  ['verification gate', REPOSITORY_FUTURE_CAPABILITIES.verificationGates],
  ['verification gates', REPOSITORY_FUTURE_CAPABILITIES.verificationGates],
  ['testing guidance', REPOSITORY_FUTURE_CAPABILITIES.testingCiGuidance],
  ['ci guidance', REPOSITORY_FUTURE_CAPABILITIES.testingCiGuidance],
]);

export function repositoryFutureCapabilityForDomain(domain: RepositoryTransformationDomain) {
  if (domain === 'project-memory') return REPOSITORY_FUTURE_CAPABILITIES.projectMemory;
  if (domain === 'agent-routing') return REPOSITORY_FUTURE_CAPABILITIES.agentRouting;
  return REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy;
}

export function repositoryFutureCapabilityForArtifactFamily(family: string) {
  const normalized = family.trim().toLowerCase();
  if (normalized.includes('folder-agent')) return REPOSITORY_FUTURE_CAPABILITIES.folderAgentGuidance;
  if (normalized.includes('agent') && normalized.includes('instruction')) return REPOSITORY_FUTURE_CAPABILITIES.agentInstructions;
  if (normalized.includes('architecture')) return REPOSITORY_FUTURE_CAPABILITIES.architectureMemory;
  if (normalized.includes('task-router')) return REPOSITORY_FUTURE_CAPABILITIES.taskRouting;
  if (normalized.includes('verification-gate')) return REPOSITORY_FUTURE_CAPABILITIES.verificationGates;
  if (normalized.includes('verification')) return REPOSITORY_FUTURE_CAPABILITIES.verificationStrategy;
  if (normalized.includes('command') || normalized.includes('known-risk') || normalized.includes('critical-file') || normalized.includes('context-guide')) {
    return REPOSITORY_FUTURE_CAPABILITIES.projectMemory;
  }
  return REPOSITORY_FUTURE_CAPABILITIES.repositoryCapability;
}

export function repositoryFutureArtifactFamilyForPath(path: string) {
  const normalized = normalizeRepositoryFuturePath(path).toLowerCase();
  if (/folder-agents\/.+\/agents\.md$/.test(normalized)) return 'folder-agent-instructions';
  if (normalized.endsWith('/agents.md') || normalized === 'agents.md') return 'agents-instructions';
  if (normalized.includes('architecture')) return 'architecture';
  if (normalized.includes('critical_files')) return 'critical-files';
  if (normalized.includes('task_router')) return 'task-router';
  if (normalized.includes('command_map')) return 'command-map';
  if (normalized.includes('known_risks')) return 'known-risks';
  if (normalized.includes('context_guide')) return 'context-guide';
  if (normalized.includes('verification') && normalized.includes('gate')) return 'verification-gate';
  if (normalized.includes('verification') || normalized.startsWith('04-testing/')) return 'verification-strategy';
  return 'repository-intelligence-artifact';
}

export function resolveKnownRepositoryFutureCapability(value: string, definitions = DEFAULT_REPOSITORY_FUTURE_DEPENDENCY_DEFINITIONS) {
  const normalized = normalizeCapabilityText(value);
  const byId = new Map(definitions.map(item => [item.id, item.id]));
  return byId.get(normalized) || DEPENDENCY_ALIASES.get(normalized);
}

function definition(id: string, title: string, rationale: string, requires: string[]): RepositoryFutureDependencyDefinition {
  return { id, title, rationale, requires: [...requires].sort((left, right) => left.localeCompare(right)) };
}

function normalizeCapabilityText(value: string) {
  return value.trim().toLowerCase().replace(/[_/]+/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-');
}

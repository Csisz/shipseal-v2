export const AI_WORKSPACE_TERM_IDS = [
  'aiWorkspace',
  'aiWorkspaceQuality',
  'repositoryIntelligence',
  'repositoryFriction',
  'projectMemory',
  'contextEfficiency',
  'agentProductivity',
  'deliveryOutputs',
] as const;

export type AiWorkspaceTermId = typeof AI_WORKSPACE_TERM_IDS[number];

export interface AiWorkspaceTerm {
  id: AiWorkspaceTermId;
  label: string;
  shortLabel: string;
  definition: string;
  role: 'core-product' | 'primary-metric' | 'engine-layer' | 'supporting-output';
}

export const AI_WORKSPACE_TERMS: Record<AiWorkspaceTermId, AiWorkspaceTerm> = {
  aiWorkspace: {
    id: 'aiWorkspace',
    label: 'AI Workspace',
    shortLabel: 'Workspace',
    definition: 'A repository prepared so AI coding agents can understand, navigate, verify, and improve it with less repeated context discovery.',
    role: 'core-product',
  },
  aiWorkspaceQuality: {
    id: 'aiWorkspaceQuality',
    label: 'AI Workspace Quality',
    shortLabel: 'Workspace Quality',
    definition: 'The primary future product score for how effectively an AI coding agent can become productive inside the repository.',
    role: 'primary-metric',
  },
  repositoryIntelligence: {
    id: 'repositoryIntelligence',
    label: 'Repository Intelligence',
    shortLabel: 'Repository Intelligence',
    definition: 'Structured understanding of layout, framework, architecture, commands, docs, tests, instructions, generated folders, and repository relationships.',
    role: 'engine-layer',
  },
  repositoryFriction: {
    id: 'repositoryFriction',
    label: 'Repository Friction',
    shortLabel: 'Friction',
    definition: 'The inverse pressure on AI Workspace Quality: duplicate knowledge, oversized files, unclear routing, hidden commands, and repeated context loading.',
    role: 'primary-metric',
  },
  projectMemory: {
    id: 'projectMemory',
    label: 'Project Memory',
    shortLabel: 'Memory',
    definition: 'Durable project facts and guidance that prevent agents from rediscovering the same repository context each session.',
    role: 'engine-layer',
  },
  contextEfficiency: {
    id: 'contextEfficiency',
    label: 'Context Efficiency',
    shortLabel: 'Context Efficiency',
    definition: 'How well the repository separates high-signal context from low-signal or task-irrelevant context for agent work.',
    role: 'primary-metric',
  },
  agentProductivity: {
    id: 'agentProductivity',
    label: 'Agent Productivity',
    shortLabel: 'Productivity',
    definition: 'A future analytics dimension for how quickly and safely agents can select files, follow routes, and verify changes.',
    role: 'primary-metric',
  },
  deliveryOutputs: {
    id: 'deliveryOutputs',
    label: 'Delivery Outputs',
    shortLabel: 'Outputs',
    definition: 'Reports, Delivery Packs, manifests, score exports, readiness PR files, and client handoff artifacts produced from the workspace engine.',
    role: 'supporting-output',
  },
};

export const AI_WORKSPACE_ENGINE_PIPELINE = [
  'Repository',
  'Repository Intelligence Engine',
  'Project Memory Engine',
  'Context Compression Engine',
  'Agent Routing Engine',
  'AI Workspace Analytics',
  'Delivery Outputs',
] as const;

export const FUTURE_AI_WORKSPACE_NAVIGATION = [
  'Workspace Overview',
  'Workspace Quality',
  'Repository Friction',
  'Project Memory',
  'Agent Simulator',
  'Heatmap',
  'Timeline',
  'Delivery Outputs',
] as const;

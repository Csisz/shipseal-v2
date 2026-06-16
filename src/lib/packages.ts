import {
  Bot,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Megaphone,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Outcome-first ShipSeal goals shown in the landing page and pre-scan flow.
 * The full package remains a shortcut; generation still uses the existing
 * delivery-pack path and required output contracts.
 */

export type ShipSealGoalId =
  | 'client-handoff'
  | 'launch-readiness'
  | 'safety-risk'
  | 'agent-readiness'
  | 'testing-red-team'
  | 'rescue-refactor'
  | 'sales-present'
  | 'mcp-readiness'
  | 'full-package';

export interface ShipSealGoal {
  id: ShipSealGoalId;
  title: string;
  sentence: string;
  chips: string[];
  includes: string[];
  icon: LucideIcon;
  recommended?: boolean;
}

export type ShipSealPackageId = ShipSealGoalId;
export type ShipSealPackage = ShipSealGoal;

export const FULL_PACKAGE_ID: ShipSealGoalId = 'full-package';

export const SHIPSEAL_GOALS: ShipSealGoal[] = [
  {
    id: 'client-handoff',
    title: 'Prepare for client handoff',
    sentence: 'Create a professional handoff report, known limitations, setup notes and next steps for your client.',
    chips: ['Handoff report', 'Setup notes', 'Next steps'],
    includes: [
      'Client handoff report',
      'Executive summary',
      'Known limitations',
      'Setup notes',
      'Next steps',
    ],
    icon: PackageCheck,
  },
  {
    id: 'launch-readiness',
    title: 'Prepare for launch or production',
    sentence: 'Check blockers before pilot or production: go/no-go risks, release checklist and missing readiness signals.',
    chips: ['Go/no-go', 'Release checks', 'Risks'],
    includes: [
      'Go/no-go summary',
      'Release readiness checklist',
      'Missing readiness signals',
      'Priority blockers',
    ],
    icon: Gauge,
  },
  {
    id: 'safety-risk',
    title: 'Make it safer',
    sentence: 'Review secrets, auth, data handling, prompt injection risks and tool/MCP access boundaries.',
    chips: ['Secrets', 'Data risk', 'Tool access'],
    includes: [
      'Security and data risk notes',
      'Prompt injection risk prompts',
      'Tool access boundaries',
      'Human approval checks',
    ],
    icon: ShieldCheck,
  },
  {
    id: 'agent-readiness',
    title: 'Make it easier to build with AI agents',
    sentence: 'Generate AGENTS.md, CLAUDE.md, Codex/Cursor/Windsurf rules, repo context and safe edit instructions.',
    chips: ['AGENTS.md', 'Repo context', 'Safe edits'],
    includes: [
      'AI agent instructions',
      'Repo context pack',
      'Codex prompts',
      'Safe editing rules',
    ],
    icon: Bot,
  },
  {
    id: 'testing-red-team',
    title: 'Create tests and red-team prompts',
    sentence: 'Generate eval tests, edge cases, hallucination traps, prompt injection tests and manual QA checklists.',
    chips: ['Eval tests', 'Red-team', 'QA'],
    includes: [
      'Eval test cases',
      'Red-team prompts',
      'Testing strategy',
      'Manual QA checklist',
    ],
    icon: FlaskConical,
  },
  {
    id: 'rescue-refactor',
    title: 'Rescue or refactor the project',
    sentence: 'Find technical debt, confusing files, oversized components and create a prioritized fix roadmap.',
    chips: ['Debt', 'Cleanup', 'Roadmap'],
    includes: [
      'Technical debt review',
      'Confusing file map',
      'Oversized component notes',
      'Prioritized fix roadmap',
    ],
    icon: Wrench,
  },
  {
    id: 'sales-present',
    title: 'Make it easier to sell or present',
    sentence: 'Prepare positioning, landing page copy, demo script, FAQ and onboarding material.',
    chips: ['Positioning', 'Demo script', 'FAQ'],
    includes: [
      'Positioning notes',
      'Demo script',
      'FAQ',
      'Onboarding material',
    ],
    icon: Megaphone,
  },
  {
    id: 'mcp-readiness',
    title: 'MCP readiness and tool integration',
    sentence: 'Recommend useful public MCP servers, decide whether a custom MCP server is justified, and prepare MCP governance notes.',
    chips: ['MCP servers', 'Governance', 'Allowlist'],
    includes: [
      'MCP readiness report',
      'MCP server recommendations',
      'MCP security policy',
      'Tool allowlist',
    ],
    icon: ClipboardCheck,
  },
  {
    id: 'full-package',
    title: 'Full ShipSeal package',
    sentence: 'Prepare everything together: handoff, AI-agent readiness, safety, testing, MCP readiness, transparency notes and improvement roadmap.',
    chips: ['Recommended', 'One ZIP', 'All outputs'],
    includes: [
      'Client handoff',
      'AI-agent readiness',
      'Safety and data risk notes',
      'Testing and red-team pack',
      'MCP readiness',
      'AI Act / transparency readiness',
      'Readiness score and fix pack',
    ],
    icon: Sparkles,
    recommended: true,
  },
];

export const SHIPSEAL_PACKAGES = SHIPSEAL_GOALS;

export function getShipSealPackage(id: string): ShipSealPackage | undefined {
  return SHIPSEAL_GOALS.find(pack => pack.id === id);
}

/**
 * Normalizes a selection for reporting. Choosing the full package, or reaching
 * this function without a pre-scan choice, means "everything".
 */
export function resolveSelectedPackages(selected: string[]): ShipSealPackageId[] {
  const valid = selected.filter((id): id is ShipSealPackageId => Boolean(getShipSealPackage(id)));
  if (valid.length === 0 || valid.includes(FULL_PACKAGE_ID)) {
    return [FULL_PACKAGE_ID];
  }
  return valid;
}

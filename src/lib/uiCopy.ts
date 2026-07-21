import type { ReadinessLevel } from './types';
import type { ShipSealPackageId } from './packages';

export function criticalBlockersEmptyStateText(isReady: boolean) {
  return isReady
    ? 'No critical blockers. Your repository is AI Coding Ready.'
    : 'No critical blockers were found. Improve the remaining score categories to reach AI Coding Ready.';
}

export function displayReadinessLevel(level: ReadinessLevel): string {
  // Keep the legacy serialized value compatible while avoiding an unsupported certification claim in display copy.
  return level === 'AgentReady Certified' ? 'AI Coding Ready' : level;
}

const DEFAULT_ALMOST_THERE_MESSAGE = 'Almost there - improve a few areas to reach AI Coding Ready.';

const GOAL_ALMOST_THERE_MESSAGES: Partial<Record<ShipSealPackageId, string>> = {
  'client-handoff': 'Almost there - improve a few areas before handing this project to a client.',
  'agent-readiness': DEFAULT_ALMOST_THERE_MESSAGE,
  'testing-red-team': 'Almost there - strengthen testing coverage and release confidence.',
  'safety-risk': 'Almost there - improve a few areas to strengthen security and data readiness.',
  'mcp-readiness': 'Almost there - improve tool readiness and MCP safety.',
  'ai-act-transparency': 'Almost there - clarify transparency, oversight, and legal-review questions.',
  'full-package': 'Almost there - improve a few areas before treating this project as fully sealed.',
};

export function readinessStatusMessageForPackage(statusMessage: string, selectedPackages: ShipSealPackageId[]) {
  if (statusMessage !== DEFAULT_ALMOST_THERE_MESSAGE) return statusMessage;
  const selected = selectedPackages[0] || 'full-package';
  return GOAL_ALMOST_THERE_MESSAGES[selected] || statusMessage;
}

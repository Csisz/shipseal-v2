import type { ReadinessLevel } from './types';

export function criticalBlockersEmptyStateText(isReady: boolean) {
  return isReady
    ? 'No critical blockers. Your repository is AI Coding Ready.'
    : 'No critical blockers were found. Improve the remaining score categories to reach AI Coding Ready.';
}

export function displayReadinessLevel(level: ReadinessLevel): string {
  return level === 'AgentReady Certified' ? 'ShipSeal Certified' : level;
}

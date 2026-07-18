import type { ReadinessReport } from '@/lib/types';
import type { RepositoryFriction } from './types';

const MAX_REPOSITORY_FRICTIONS = 3;

export function selectRepositoryFrictions(
  repositoryHealth: ReadinessReport['repositoryHealth'],
): RepositoryFriction[] {
  const candidates: RepositoryFriction[] = [
    ...repositoryHealth.blockers.map(blocker => ({
      id: `blocker:${blocker.id}`,
      title: blocker.title,
      detail: blocker.detail,
      source: 'blocker' as const,
      evidence: blocker.evidence[0],
    })),
    ...repositoryHealth.topActions.map(action => ({
      id: `top-action:${action.id}`,
      title: action.title,
      detail: action.whyItMatters,
      source: 'top-action' as const,
      evidence: action.evidence[0],
      recommendation: action.action,
    })),
  ];

  const selected: RepositoryFriction[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = normalizeFrictionText(`${candidate.title}\n${candidate.detail}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(candidate);
    if (selected.length === MAX_REPOSITORY_FRICTIONS) return selected;
  }

  if (selected.length > 0) return selected;
  return [{
    id: 'insufficient-evidence',
    title: 'Insufficient evidence for repository-specific friction',
    detail: 'The current scan did not produce a deterministic blocker or top action. Review scan limitations before drawing a conclusion.',
    source: 'insufficient-evidence',
  }];
}

function normalizeFrictionText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

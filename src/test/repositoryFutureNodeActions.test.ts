import { describe, expect, it } from 'vitest';
import { resolveRepositoryFutureNodeActions } from '@/components/agentready/result-workspace/futures/repositoryFutureNodeActions';
import type { RepositoryFutureStageCandidate } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

function candidate(overrides: Partial<RepositoryFutureStageCandidate> = {}): RepositoryFutureStageCandidate {
  return {
    goalId: 'goal:candidate',
    title: 'Candidate future',
    fit: 'Strong fit',
    role: 'candidate',
    origin: 'Deterministic evidence',
    capabilityId: 'capability:candidate',
    confidence: 'high',
    compatibility: 'compatible',
    eligibleAsPrimary: true,
    humanReviewRequired: false,
    evidenceCount: 1,
    mappedEvidenceCount: 1,
    universeNodeIds: [],
    ...overrides,
  };
}

function ids(value: RepositoryFutureStageCandidate, hasPrimary: boolean, supportCount: number) {
  return resolveRepositoryFutureNodeActions({ candidate: value, hasPrimary, supportCount }).map(action => action.id);
}

describe('Omega 18.5-V5 Future node action resolver', () => {
  it('offers only an explicit primary action from an empty plan', () => {
    expect(ids(candidate(), false, 0)).toEqual(['make-primary']);
  });

  it('offers primary replacement, support addition and save for a compatible option', () => {
    expect(ids(candidate(), true, 1)).toEqual(['make-primary', 'add-support', 'save-for-later']);
  });

  it('switches to bounded support replacement when the two-support limit is reached', () => {
    const actions = resolveRepositoryFutureNodeActions({
      candidate: candidate({ replaceableSupportGoalIds: ['goal:support-b', 'goal:support-a'] }),
      hasPrimary: true,
      supportCount: 2,
    });
    expect(actions.map(action => action.id)).toEqual(['make-primary', 'replace-support', 'save-for-later']);
    expect(actions.find(action => action.id === 'replace-support')?.replacementGoalIds).toEqual(['goal:support-b', 'goal:support-a']);
    expect(ids(candidate({ role: 'blocked', compatibility: 'blocked', compatibilityReasons: ['The active draft already has two supporting goals.'], replaceableSupportGoalIds: ['goal:support-a'] }), true, 2))
      .toEqual(['make-primary', 'replace-support', 'save-for-later']);
  });

  it('does not invent a replacement when no existing support is compatible to replace', () => {
    expect(ids(candidate({ replaceableSupportGoalIds: [] }), true, 2)).toEqual(['make-primary', 'save-for-later']);
  });

  it('offers removal only for an active support and no actions for the primary', () => {
    expect(ids(candidate({ role: 'supporting' }), true, 1)).toEqual(['remove-support']);
    expect(ids(candidate({ role: 'primary' }), true, 1)).toEqual([]);
  });

  it('offers restore and an eligible primary action for an explicitly saved option', () => {
    expect(ids(candidate({ role: 'saved', savedForLater: true }), true, 0)).toEqual(['restore', 'make-primary']);
    expect(ids(candidate({ role: 'saved', eligibleAsPrimary: false }), true, 0)).toEqual(['restore']);
  });

  it('keeps incompatible and blocked options inspectable without support actions', () => {
    expect(ids(candidate({ role: 'blocked', compatibility: 'incompatible' }), true, 0)).toEqual(['make-primary', 'save-for-later']);
    expect(ids(candidate({ role: 'blocked', compatibility: 'blocked', eligibleAsPrimary: false }), true, 0)).toEqual(['save-for-later']);
  });

  it('marks every mutation from a review-sensitive option for review', () => {
    const actions = resolveRepositoryFutureNodeActions({
      candidate: candidate({ compatibility: 'compatible-with-review', humanReviewRequired: true }),
      hasPrimary: true,
      supportCount: 0,
    });
    expect(actions).not.toHaveLength(0);
    expect(actions.every(action => action.reviewRequired)).toBe(true);
  });
});

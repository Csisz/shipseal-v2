import type { RepositoryFutureStageCandidate } from './futurePathwaysPresentation';

export type RepositoryFutureNodeActionId =
  | 'make-primary'
  | 'add-support'
  | 'remove-support'
  | 'replace-support'
  | 'save-for-later'
  | 'restore';

export interface RepositoryFutureNodeAction {
  id: RepositoryFutureNodeActionId;
  label: string;
  reviewRequired: boolean;
  replacementGoalIds: string[];
}

/** Presentation-only resolver. Domain commands still validate every mutation. */
export function resolveRepositoryFutureNodeActions(input: {
  candidate: RepositoryFutureStageCandidate;
  hasPrimary: boolean;
  supportCount: number;
}): RepositoryFutureNodeAction[] {
  const { candidate, hasPrimary, supportCount } = input;
  const reviewRequired = candidate.compatibility === 'compatible-with-review' || candidate.humanReviewRequired;
  const action = (id: RepositoryFutureNodeActionId, label: string, replacementGoalIds: string[] = []): RepositoryFutureNodeAction => ({
    id,
    label,
    reviewRequired,
    replacementGoalIds,
  });

  if (candidate.role === 'primary') return [];
  if (candidate.role === 'supporting') return [action('remove-support', 'Remove support')];
  if (candidate.role === 'saved') {
    return [
      action('restore', 'Return to options'),
      ...(candidate.eligibleAsPrimary ? [action('make-primary', 'Make primary')] : []),
    ];
  }

  const actions: RepositoryFutureNodeAction[] = [];
  if (candidate.eligibleAsPrimary) actions.push(action('make-primary', hasPrimary ? 'Replace primary' : 'Make primary'));
  if (hasPrimary) {
    if (supportCount >= 2 && candidate.replaceableSupportGoalIds?.length) {
      actions.push(action('replace-support', 'Replace a support', candidate.replaceableSupportGoalIds));
    } else if (supportCount < 2 && ['compatible', 'compatible-with-review'].includes(candidate.compatibility)) {
      actions.push(action('add-support', 'Add as support'));
    }
  }
  if (hasPrimary) actions.push(action('save-for-later', 'Save for later'));
  return actions;
}

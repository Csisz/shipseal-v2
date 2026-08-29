import type {
  AiOperationCompletionState,
  AiOperationRecoveryAction,
} from '../aiOperationRecoveryContract.js';
import type { RepositoryIntelligenceProviderStatus } from './productionProviderContract.js';

export type RepositoryFutureAvailability =
  | 'ready'
  | 'startable'
  | 'running'
  | 'resumable'
  | 'temporarily-unavailable'
  | 'terminal';

export interface RepositoryFutureAvailabilityOperationState {
  completionState?: AiOperationCompletionState;
  recoveryAction?: AiOperationRecoveryAction;
}

const TEMPORARY_FAILURE_CATEGORIES = new Set([
  'global_ai_budget_exhausted',
  'global_ai_capacity_reached',
  'usage_temporarily_unavailable',
  'provider_unavailable',
  'rate_limited',
  'request_timeout',
]);

/**
 * One presentation authority for whether Repository Futures can be opened,
 * started, resumed, or only observed. A new analysis is deliberately distinct
 * from retrying a historical operation.
 */
export function resolveRepositoryFutureAvailability(
  status?: RepositoryIntelligenceProviderStatus,
  operationState: RepositoryFutureAvailabilityOperationState = {},
): RepositoryFutureAvailability {
  const diagnostics = status && 'diagnostics' in status ? status.diagnostics : undefined;
  const completionState = operationState.completionState ?? diagnostics?.operationCompletionState;
  const recoveryAction = operationState.recoveryAction ?? diagnostics?.operationRecoveryAction;

  if (!status || status.state === 'enhanced' || completionState === 'ready' || recoveryAction === 'open_result') {
    return 'ready';
  }
  if (
    status.state === 'deterministic'
    || completionState === 'refunded'
    || recoveryAction === 'start_new_analysis'
  ) {
    return 'startable';
  }
  if (status.state === 'preparing' || completionState === 'running' || recoveryAction === 'wait_for_active_lease') {
    return 'running';
  }
  if (
    recoveryAction === 'resume_stale_lease'
    || recoveryAction === 'retry_stage'
    || recoveryAction === 'integrity_recovery'
    || completionState === 'retryable'
    || status.state === 'cancelled'
  ) {
    return 'resumable';
  }
  if (status.state === 'fallback' && TEMPORARY_FAILURE_CATEGORIES.has(status.category)) {
    return 'temporarily-unavailable';
  }
  if (status.state === 'fallback' && status.retryable) return 'resumable';
  return 'terminal';
}


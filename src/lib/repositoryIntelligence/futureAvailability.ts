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

export type RepositoryFutureReadinessState =
  | 'not-started'
  | 'queued'
  | 'analyzing'
  | 'synthesizing'
  | 'validating'
  | 'ready'
  | 'failed';

export interface RepositoryFutureReadiness {
  state: RepositoryFutureReadinessState;
  label: string;
  description: string;
  /**
   * Visual position within the known pipeline. This is deliberately a
   * milestone indicator, not a claimed completion percentage.
   */
  milestoneProgress: number;
  busy: boolean;
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
  const userUnitState = diagnostics?.operationUserUnitState;

  if (!status || status.state === 'enhanced' || completionState === 'ready' || recoveryAction === 'open_result') {
    return 'ready';
  }
  if (
    status.state === 'deterministic'
    || completionState === 'refunded'
    || recoveryAction === 'start_new_analysis'
    || userUnitState === 'released'
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

/**
 * Converts the provider's durable pipeline stages into user-facing readiness.
 * No timer or invented work unit is used; expansion progress only advances
 * when the server confirms a completed pathway batch.
 */
export function resolveRepositoryFutureReadiness(
  status?: RepositoryIntelligenceProviderStatus,
  hasValidatedFutures = false,
): RepositoryFutureReadiness {
  if (status?.state === 'enhanced' || hasValidatedFutures && status?.state !== 'preparing') {
    return {
      state: 'ready',
      label: 'Ready',
      description: 'Validated Repository Futures are ready to explore.',
      milestoneProgress: 1,
      busy: false,
    };
  }

  if (!status || status.state === 'deterministic' || resolveRepositoryFutureAvailability(status) === 'startable') {
    return {
      state: 'not-started',
      label: 'Not started',
      description: 'Repository understanding is complete. Future analysis is ready to begin.',
      milestoneProgress: 0,
      busy: false,
    };
  }

  if (status.state === 'fallback' || status.state === 'cancelled') {
    return {
      state: 'failed',
      label: 'Future analysis could not complete',
      description: status.message || 'The analysis stopped before validated Future paths were ready.',
      milestoneProgress: 0,
      busy: false,
    };
  }

  if (!status.productStage) {
    return {
      state: 'queued',
      label: 'Queued',
      description: status.message || 'Repository understanding is complete. Future analysis is queued.',
      milestoneProgress: 0.12,
      busy: true,
    };
  }

  if (status.productStage === 'roots') {
    return {
      state: 'analyzing',
      label: 'Analyzing repository futures',
      description: status.message,
      milestoneProgress: 0.3,
      busy: true,
    };
  }

  if (status.productStage === 'expansion') {
    const confirmedRatio = status.totalBatches
      ? Math.min(1, Math.max(0, (status.completedBatches || 0) / status.totalBatches))
      : 0;
    return {
      state: 'synthesizing',
      label: 'Synthesizing future paths',
      description: status.message,
      milestoneProgress: 0.45 + confirmedRatio * 0.3,
      busy: true,
    };
  }

  return {
    state: 'validating',
    label: 'Validating compatible futures',
    description: status.message,
    milestoneProgress: status.productStage === 'finalizing' ? 0.92 : 0.84,
    busy: true,
  };
}


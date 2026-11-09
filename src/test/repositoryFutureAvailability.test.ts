import { describe, expect, it } from 'vitest';
import {
  resolveRepositoryFutureAvailability,
  resolveRepositoryFutureReadiness,
  type RepositoryIntelligenceProviderStatus,
} from '@/lib/repositoryIntelligence';
import { selectRepositoryFutureRecoveryOperationId } from '@/lib/aiOperationRecovery';

const refundedStatus: RepositoryIntelligenceProviderStatus = {
  state: 'fallback',
  deepState: 'failed',
  category: 'operation_conflict',
  retryable: false,
  message: 'Historical operation was refunded.',
  diagnostics: {
    costEstimate: 'unavailable',
    operationCompletionState: 'refunded',
    operationUserUnitState: 'refunded',
    operationRecoveryAction: 'start_new_analysis',
  },
};

const releasedStatus: RepositoryIntelligenceProviderStatus = {
  state: 'fallback',
  deepState: 'rejected',
  category: 'evidence_validation_failed',
  retryable: false,
  message: 'The prior generation failed without using the allowance.',
  diagnostics: {
    costEstimate: 'unavailable',
    operationCompletionState: 'terminal',
    operationUserUnitState: 'released',
    operationRecoveryAction: 'terminal_failure',
  },
};

describe('Repository Future availability', () => {
  it.each([
    [{ state: 'enhanced', retryable: false, message: 'Ready', providerId: 'fixture' } as const, 'ready'],
    [{ state: 'deterministic', retryable: false, message: 'Not started' } as const, 'startable'],
    [refundedStatus, 'startable'],
    [releasedStatus, 'startable'],
    [{ state: 'preparing', retryable: false, message: 'Running' } as const, 'running'],
    [{ state: 'fallback', deepState: 'failed', category: 'operation_conflict', retryable: false, message: 'Active', diagnostics: { costEstimate: 'unavailable', operationRecoveryAction: 'wait_for_active_lease' } } as const, 'running'],
    [{ state: 'fallback', deepState: 'failed', category: 'operation_conflict', retryable: true, message: 'Resume', diagnostics: { costEstimate: 'unavailable', operationRecoveryAction: 'resume_stale_lease' } } as const, 'resumable'],
    [{ state: 'fallback', deepState: 'failed', category: 'rate_limited', retryable: true, message: 'Busy' } as const, 'temporarily-unavailable'],
    [{ state: 'fallback', deepState: 'failed', category: 'operation_conflict', retryable: false, message: 'Terminal', diagnostics: { costEstimate: 'unavailable', operationRecoveryAction: 'terminal_failure' } } as const, 'terminal'],
  ])('maps the provider/recovery contract to %s', (status, expected) => {
    expect(resolveRepositoryFutureAvailability(status)).toBe(expected);
  });

  it('treats a refunded completion as startable even though it is not retryable', () => {
    expect(refundedStatus.retryable).toBe(false);
    expect(resolveRepositoryFutureAvailability(refundedStatus)).toBe('startable');
  });

  it('offers a fresh explicit start after a failed generation released its reservation', () => {
    expect(releasedStatus.retryable).toBe(false);
    expect(resolveRepositoryFutureAvailability(releasedStatus)).toBe('startable');
  });

  it('keeps a canonical complete result ahead of historical recovery metadata', () => {
    expect(resolveRepositoryFutureAvailability(
      { state: 'enhanced', retryable: false, message: 'Ready', providerId: 'fixture' },
      { completionState: 'ready', recoveryAction: 'open_result' },
    )).toBe('ready');
  });

  it('never reuses refunded history as execution recovery authority', () => {
    expect(selectRepositoryFutureRecoveryOperationId({
      publicOperationId: `op_${'r'.repeat(24)}`,
      recoveryAction: 'start_new_analysis',
    })).toBeUndefined();
    expect(selectRepositoryFutureRecoveryOperationId({
      publicOperationId: `op_${'a'.repeat(24)}`,
      recoveryAction: 'retry_stage',
    })).toBe(`op_${'a'.repeat(24)}`);
  });

  it.each([
    [{ state: 'deterministic', retryable: false, message: 'Ready to start' } as const, 'not-started', 'Not started'],
    [{ state: 'preparing', retryable: false, message: 'Waiting' } as const, 'queued', 'Queued'],
    [{ state: 'preparing', retryable: false, message: 'Roots', productStage: 'roots' } as const, 'analyzing', 'Analyzing repository futures'],
    [{ state: 'preparing', retryable: false, message: 'Expansion', productStage: 'expansion', completedBatches: 2, totalBatches: 4 } as const, 'synthesizing', 'Synthesizing future paths'],
    [{ state: 'preparing', retryable: false, message: 'Merge', productStage: 'merging' } as const, 'validating', 'Validating compatible futures'],
    [{ state: 'enhanced', retryable: false, message: 'Ready', providerId: 'fixture' } as const, 'ready', 'Ready'],
    [{ state: 'fallback', deepState: 'failed', category: 'request_timeout', retryable: true, message: 'Timed out' } as const, 'failed', 'Future analysis could not complete'],
  ])('maps provider milestones to honest readiness for %s', (status, expectedState, expectedLabel) => {
    expect(resolveRepositoryFutureReadiness(status)).toMatchObject({ state: expectedState, label: expectedLabel });
  });

  it('only advances expansion progress from server-confirmed batches', () => {
    const started = resolveRepositoryFutureReadiness({ state: 'preparing', retryable: false, message: 'Expansion', productStage: 'expansion', completedBatches: 0, totalBatches: 4 });
    const confirmed = resolveRepositoryFutureReadiness({ state: 'preparing', retryable: false, message: 'Expansion', productStage: 'expansion', completedBatches: 2, totalBatches: 4 });
    expect(started.milestoneProgress).toBe(0.45);
    expect(confirmed.milestoneProgress).toBe(0.6);
  });
});

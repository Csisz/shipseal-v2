import { describe, expect, it } from 'vitest';
import {
  resolveRepositoryFutureAvailability,
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

describe('Repository Future availability', () => {
  it.each([
    [{ state: 'enhanced', retryable: false, message: 'Ready', providerId: 'fixture' } as const, 'ready'],
    [{ state: 'deterministic', retryable: false, message: 'Not started' } as const, 'startable'],
    [refundedStatus, 'startable'],
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
});

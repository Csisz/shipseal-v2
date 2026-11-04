import { describe, expect, it, vi } from 'vitest';
import { watchRepositoryFutureOperation } from '@/lib/aiOperationRecovery';
import type { AiOperationStatusSnapshot, PersistedRepositoryFutureProgress } from '@/lib/aiOperationRecoveryContract';

function operation(overrides: Partial<AiOperationStatusSnapshot> = {}): AiOperationStatusSnapshot {
  return {
    publicOperationId: 'RI-progress-fixture', operationState: 'running', rootStageState: 'succeeded',
    retryable: true, completionState: 'running', cacheAvailable: false, rootCacheAvailable: true,
    completedExpansionCount: 1, expectedExpansionCount: 4, leaseExpiresAt: '2026-11-04T17:00:00.000Z',
    userUnitState: 'reserved', recoveryAction: 'wait_for_active_lease', integrityRecoveryAttemptsUsed: 0,
    reconciliationOutcome: 'not-required', lastServerConfirmedAt: '2026-11-04T16:00:00.000Z',
    ...overrides,
  };
}

function progress(status: AiOperationStatusSnapshot): PersistedRepositoryFutureProgress {
  return { operation: status, root: null, expansionBatches: [], lastServerConfirmedAt: status.lastServerConfirmedAt! };
}

describe('Repository Future durable progress watcher', () => {
  it('polls only the owner-scoped progress endpoint and stops when the saved result is ready', async () => {
    const snapshots = [
      progress(operation()),
      progress(operation({ operationState: 'succeeded', completionState: 'ready', cacheAvailable: true,
        completedExpansionCount: 4, leaseExpiresAt: null, userUnitState: 'consumed', recoveryAction: 'open_result',
        lastServerConfirmedAt: '2026-11-04T16:01:00.000Z' })),
    ];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/account/ai-operation-status?includeProgress=1&publicOperationId=RI-progress-fixture');
      return new Response(JSON.stringify({ progress: snapshots.shift() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const observed: PersistedRepositoryFutureProgress[] = [];

    const settled = await watchRepositoryFutureOperation({
      publicOperationId: 'RI-progress-fixture', fetcher: fetcher as typeof fetch,
      wait: async () => undefined, onProgress: value => observed.push(value),
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(observed).toHaveLength(2);
    expect(settled?.operation.recoveryAction).toBe('open_result');
  });

  it('exposes a stale lease as recoverable without issuing a provider request', async () => {
    const stale = progress(operation({ operationState: 'retryable_failure', completionState: 'retryable',
      leaseExpiresAt: null, recoveryAction: 'retry_stage' }));
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ progress: stale }), { status: 200 }));

    const settled = await watchRepositoryFutureOperation({
      publicOperationId: 'RI-progress-fixture', fetcher: fetcher as typeof fetch, wait: async () => undefined,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(settled?.operation).toMatchObject({ recoveryAction: 'retry_stage', retryable: true });
  });
});

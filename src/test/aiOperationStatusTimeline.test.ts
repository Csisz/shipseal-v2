import { describe, expect, it, vi } from 'vitest';
import { getRepositoryFutureOperationStatus } from '@/lib/aiOperationRecovery';

const operation = {
  publicOperationId: `op_${'t'.repeat(24)}`,
  operationState: 'retryable_failure' as const,
  rootStageState: 'succeeded' as const,
  retryable: true,
  completionState: 'retryable' as const,
  cacheAvailable: false,
  rootCacheAvailable: true,
  completedExpansionCount: 1,
  expectedExpansionCount: 3,
  leaseExpiresAt: null,
  userUnitState: 'reserved' as const,
  recoveryAction: 'retry_stage' as const,
  integrityRecoveryAttemptsUsed: 0,
  reconciliationOutcome: 'not-required' as const,
};

describe('Future operation status timeline', () => {
  it('treats a pre-operation 404 as expected, then resolves the persisted operation after authorization', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'not_found' } }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ operation }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    const lookup = {
      requestFingerprint: 'analysis-fingerprint-1234',
      repositoryIdentity: 'github:csisz/shipseal-v2',
    };

    await expect(getRepositoryFutureOperationStatus(lookup, fetcher as typeof fetch)).resolves.toBeNull();
    await expect(getRepositoryFutureOperationStatus(lookup, fetcher as typeof fetch)).resolves.toEqual(operation);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toContain('requestFingerprint=analysis-fingerprint-1234');
    expect(String(fetcher.mock.calls[1][0])).toContain('repositoryIdentity=github%3Acsisz%2Fshipseal-v2');
  });
});


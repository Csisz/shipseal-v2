import { describe, expect, it } from 'vitest';
import {
  buildOperationDiagnostic,
  classifyAttentionOperation,
  resolveConfiguredProviderLimit,
} from '../../api/_lib/adminDiagnostics';
import { operationSupportReference } from '@/lib/supportReference';

const now = new Date('2026-09-11T12:00:00.000Z');
const baseOperation = {
  public_operation_id: 'op_01JABCdef23456789xyzQRST',
  operation_kind: 'repository_futures',
  state: 'running',
  reserved_user_units: 1,
  consumed_user_units: 0,
  refunded_user_units: 0,
  released_at: null,
  reconciliation_outcome: null,
  result_exists: false,
  created_at: '2026-09-11T10:00:00.000Z',
  updated_at: '2026-09-11T10:05:00.000Z',
};

describe('admin operational diagnostics', () => {
  it('uses the configured provider limit without requiring a budget-window row', () => {
    expect(resolveConfiguredProviderLimit({ SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: '100' })).toEqual({ state: 'configured', limit: 100 });
    expect(resolveConfiguredProviderLimit({})).toEqual({ state: 'not_configured', limit: null });
    expect(resolveConfiguredProviderLimit({ SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: '0' })).toEqual({ state: 'invalid', limit: null });
    expect(resolveConfiguredProviderLimit({ SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY: 'lots' })).toEqual({ state: 'invalid', limit: null });
  });

  it('keeps an active lease out of Needs attention and classifies an expired lease as recovery, not running', () => {
    expect(classifyAttentionOperation({ ...baseOperation, active_lease_expires_at: '2026-09-11T12:03:00.000Z' }, now)).toBeNull();
    expect(classifyAttentionOperation({ ...baseOperation, active_lease_expires_at: null }, now)).toMatchObject({
      classification: 'needs_recovery',
      reason: 'Lease expired; recovery is available',
      userUnitState: 'reserved',
    });
  });

  it('does not surface refunded or released history as an active alert', () => {
    expect(classifyAttentionOperation({ ...baseOperation, state: 'terminal_failure', reserved_user_units: 0, consumed_user_units: 1, refunded_user_units: 1, released_at: now.toISOString(), reconciliation_outcome: 'refunded' }, now)).toBeNull();
    expect(classifyAttentionOperation({ ...baseOperation, state: 'terminal_failure', reserved_user_units: 0, released_at: now.toISOString() }, now)).toBeNull();
  });

  it('surfaces a consumed unit without a durable result for billing-integrity review', () => {
    expect(classifyAttentionOperation({ ...baseOperation, state: 'succeeded', reserved_user_units: 0, consumed_user_units: 1 }, now)).toMatchObject({
      classification: 'billing_integrity_review',
      reason: 'Consumed unit has no durable result',
      userUnitState: 'consumed',
    });
  });

  it('builds a safe support diagnosis without internal IDs or payloads', () => {
    const diagnostic = buildOperationDiagnostic(baseOperation, [{
      stage_kind: 'roots', state: 'running', lease_expires_at: '2026-09-11T10:06:00.000Z',
      updated_at: '2026-09-11T10:05:00.000Z', last_failure_category: null,
    }], [{
      category: 'ai_stage', action: 'roots.authorize', status: 'succeeded', safe_category: null,
      created_at: '2026-09-11T10:05:00.000Z',
    }], now);
    expect(diagnostic).toMatchObject({
      supportReference: operationSupportReference(baseOperation.public_operation_id),
      diagnosticState: 'needs_recovery',
      userUnitState: 'reserved',
      resultExists: false,
      canRetry: true,
      recoveryAction: 'Resume stale lease',
    });
    expect(JSON.stringify(diagnostic)).not.toContain('repository_identity');
    expect(JSON.stringify(diagnostic)).not.toContain('canonical_complete_response');
  });

  it('derives a stable, case-safe, closed-beta-scale reference from the public operation ID', () => {
    const reference = operationSupportReference(baseOperation.public_operation_id);
    expect(reference).toBe('RI-789XYZQRST');
    expect(operationSupportReference(baseOperation.public_operation_id)).toBe(reference);
    expect(reference).toMatch(/^RI-[A-Z0-9]{10}$/);
  });
});

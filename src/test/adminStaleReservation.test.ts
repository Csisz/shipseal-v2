import { describe, expect, it, vi } from 'vitest';
import { assessStaleReservationRelease, releaseStaleReservation } from '../../api/_lib/adminStaleReservation';

const NOW = new Date('2026-09-15T12:00:00.000Z');
const base = {
  id: 'aio_internal', public_operation_id: `op_${'s'.repeat(24)}`, owner_user_id: 'usr_owner', project_id: 'prj_owner',
  state: 'running', reserved_user_units: 1, consumed_user_units: 0, refunded_user_units: 0,
  released_at: null, completed_at: null, result_exists: false, active_lease_exists: false,
  active_provider_permit_exists: false, project_exists: true, superseding_result_exists: true,
  updated_at: '2026-09-10T12:00:00.000Z',
};

describe('admin stale reservation release', () => {
  it('allows only provably stale superseded or orphaned reservations', () => {
    expect(assessStaleReservationRelease(base, NOW)).toMatchObject({ eligible: true, classification: 'superseded' });
    expect(assessStaleReservationRelease({ ...base, superseding_result_exists: false, project_exists: false }, NOW)).toMatchObject({ eligible: true, classification: 'orphaned' });
    expect(assessStaleReservationRelease({ ...base, superseding_result_exists: false }, NOW)).toMatchObject({ eligible: false, reason: expect.stringMatching(/reachable project/i) });
    expect(assessStaleReservationRelease({ ...base, updated_at: '2026-09-15T11:30:00.000Z' }, NOW)).toMatchObject({ eligible: false, reason: expect.stringMatching(/stale threshold/i) });
  });

  it('rejects active, consumed, and completed operations', () => {
    expect(assessStaleReservationRelease({ ...base, active_lease_exists: true }, NOW).eligible).toBe(false);
    expect(assessStaleReservationRelease({ ...base, active_provider_permit_exists: true }, NOW).eligible).toBe(false);
    expect(assessStaleReservationRelease({ ...base, reserved_user_units: 0, consumed_user_units: 1 }, NOW).eligible).toBe(false);
    expect(assessStaleReservationRelease({ ...base, result_exists: true }, NOW).eligible).toBe(false);
  });

  it('reports an already-released operation idempotently', () => {
    expect(assessStaleReservationRelease({ ...base, reserved_user_units: 0, released_at: NOW.toISOString() }, NOW)).toMatchObject({
      eligible: false, alreadyReleased: true,
    });
  });

  it('writes one release ledger entry and records success plus duplicate audit events', async () => {
    const statements: string[] = [];
    let released = false;
    const transaction = vi.fn(async (strings: TemplateStringsArray) => {
      const statement = strings.join('?').replace(/\s+/g, ' ').trim();
      statements.push(statement);
      if (statement.startsWith('select o.*')) return [{ ...base, reserved_user_units: released ? 0 : 1, released_at: released ? NOW.toISOString() : null }];
      if (statement.startsWith('update public.shipseal_ai_operations')) {
        if (released) return [];
        released = true;
        return [{ id: base.id, owner_user_id: base.owner_user_id, project_id: base.project_id }];
      }
      return [];
    });
    const sql = Object.assign(vi.fn(async (strings: TemplateStringsArray) => {
      statements.push(strings.join('?').replace(/\s+/g, ' ').trim());
      return [];
    }), { begin: vi.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)) });

    await expect(releaseStaleReservation(sql as never, base.public_operation_id, 'usr_admin', NOW)).resolves.toMatchObject({ status: 'released' });
    await expect(releaseStaleReservation(sql as never, base.public_operation_id, 'usr_admin', NOW)).resolves.toMatchObject({ status: 'already_released' });
    expect(statements.filter(statement => statement.startsWith('insert into public.shipseal_ai_usage_ledger'))).toHaveLength(1);
    expect(statements.filter(statement => statement.startsWith('insert into public.shipseal_operational_events'))).toHaveLength(2);
    expect(statements.some(statement => statement.includes('shipseal_ai_usage_adjustments'))).toBe(false);
  });
});

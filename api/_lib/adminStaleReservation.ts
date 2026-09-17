import { randomBytes } from 'node:crypto';
import type { Sql } from 'postgres';
import { recordOperationalEvent } from './operationalEvents.js';

const STALE_RESERVATION_AGE_MS = 24 * 60 * 60 * 1_000;

export type StaleReservationClassification = 'superseded' | 'orphaned';
export type StaleReservationDecision =
  | { eligible: true; classification: StaleReservationClassification; reason: string }
  | { eligible: false; classification: null; reason: string; alreadyReleased?: boolean };

export function assessStaleReservationRelease(operation: Record<string, unknown>, now: Date): StaleReservationDecision {
  const reserved = Number(operation.reserved_user_units || 0) === 1;
  const consumed = Number(operation.consumed_user_units || 0) === 1;
  const refunded = Number(operation.refunded_user_units || 0) === 1;
  const released = Boolean(operation.released_at);
  if (!reserved && released && !consumed) {
    return { eligible: false, classification: null, reason: 'This reservation has already been released.', alreadyReleased: true };
  }
  if (!reserved) return { eligible: false, classification: null, reason: 'No held reservation exists.' };
  if (consumed || refunded) return { eligible: false, classification: null, reason: 'Consumed or refunded operations cannot use stale release.' };
  if (operation.result_exists) return { eligible: false, classification: null, reason: 'A durable completed Future exists.' };
  if (operation.active_lease_exists || operation.active_provider_permit_exists) {
    return { eligible: false, classification: null, reason: 'The operation still has active execution authority.' };
  }
  if (!['reserved', 'running', 'retryable_failure'].includes(String(operation.state || ''))) {
    return { eligible: false, classification: null, reason: 'The operation is not in a releasable incomplete state.' };
  }
  const updatedAt = Date.parse(String(operation.updated_at || ''));
  if (!Number.isFinite(updatedAt) || now.getTime() - updatedAt < STALE_RESERVATION_AGE_MS) {
    return { eligible: false, classification: null, reason: 'The operation has not exceeded the stale threshold.' };
  }
  if (operation.superseding_result_exists) {
    return { eligible: true, classification: 'superseded', reason: 'A newer durable Future supersedes this unreachable incomplete operation.' };
  }
  if (operation.project_exists === false) {
    return { eligible: true, classification: 'orphaned', reason: 'The owning project is no longer reachable.' };
  }
  return { eligible: false, classification: null, reason: 'The operation still has a reachable project and no superseding result.' };
}

export async function releaseStaleReservation(
  sql: Sql,
  publicOperationId: string,
  adminUserId: string,
  now = new Date(),
) {
  const outcome = await sql.begin(async transaction => {
    const [operation] = await transaction<Record<string, unknown>[]>`
      select o.*,
        (o.canonical_complete_response is not null and o.completed_at is not null and o.refunded_user_units = 0) as result_exists,
        exists (
          select 1 from public.shipseal_ai_operation_stages s
          where s.operation_id = o.id and s.state = 'running' and s.lease_expires_at > ${now.toISOString()}
        ) as active_lease_exists,
        exists (
          select 1 from public.shipseal_ai_provider_permits p
          where p.operation_id = o.id and p.state = 'acquired' and p.expires_at > ${now.toISOString()}
        ) as active_provider_permit_exists,
        exists (
          select 1 from public.shipseal_projects p
          where p.owner_user_id = o.owner_user_id and p.repository_identity = o.repository_identity and p.deleted_at is null
        ) as project_exists,
        exists (
          select 1 from public.shipseal_ai_operations newer
          where newer.id <> o.id
            and newer.owner_user_id = o.owner_user_id
            and newer.operation_kind = o.operation_kind
            and newer.repository_identity = o.repository_identity
            and newer.created_at > o.created_at
            and newer.canonical_complete_response is not null
            and newer.completed_at is not null
            and newer.refunded_user_units = 0
        ) as superseding_result_exists
      from public.shipseal_ai_operations o
      where o.public_operation_id = ${publicOperationId}
      limit 1 for update
    `;
    if (!operation) return { status: 'not_found' as const };
    const decision = assessStaleReservationRelease(operation, now);
    if (!decision.eligible) {
      return 'alreadyReleased' in decision && decision.alreadyReleased
        ? { status: 'already_released' as const, publicOperationId }
        : { status: 'rejected' as const, publicOperationId, reason: decision.reason };
    }
    const reason = `admin-stale-${decision.classification}-reservation-release`;
    const updated = await transaction<Record<string, unknown>[]>`
      update public.shipseal_ai_operations set
        state = 'terminal_failure', reserved_user_units = 0,
        terminal_failure_category = ${reason}, released_at = ${now.toISOString()},
        reconciliation_outcome = 'not-required', reconciled_at = ${now.toISOString()},
        updated_at = ${now.toISOString()}
      where id = ${String(operation.id)}
        and reserved_user_units = 1 and consumed_user_units = 0 and refunded_user_units = 0
        and released_at is null and canonical_complete_response is null and completed_at is null
        and not exists (
          select 1 from public.shipseal_ai_operation_stages s
          where s.operation_id = ${String(operation.id)} and s.state = 'running' and s.lease_expires_at > ${now.toISOString()}
        )
        and not exists (
          select 1 from public.shipseal_ai_provider_permits p
          where p.operation_id = ${String(operation.id)} and p.state = 'acquired' and p.expires_at > ${now.toISOString()}
        )
      returning id, owner_user_id, project_id
    `;
    if (!updated[0]) return { status: 'rejected' as const, publicOperationId, reason: 'Operation state changed before release.' };
    await transaction`
      insert into public.shipseal_ai_usage_ledger (
        id, owner_user_id, operation_id, entry_kind, reserved_unit_delta, consumed_unit_delta, reason, created_at
      ) values (
        ${`ald_${randomBytes(18).toString('base64url')}`}, ${String(operation.owner_user_id)}, ${String(operation.id)},
        'release', -1, 0, ${reason}, ${now.toISOString()}
      )
    `;
    return {
      status: 'released' as const,
      publicOperationId,
      classification: decision.classification,
      reason,
      ownerUserId: String(operation.owner_user_id),
      projectId: operation.project_id ? String(operation.project_id) : undefined,
    };
  });
  if (outcome.status === 'released') {
    await recordOperationalEvent(sql, {
      category: 'billing',
      action: 'stale_reservation.release',
      status: 'succeeded',
      userId: adminUserId,
      projectId: outcome.projectId,
      publicOperationId,
      safeCategory: outcome.classification,
      metadata: { classification: outcome.classification, reason: outcome.reason },
    });
  } else if (outcome.status === 'already_released') {
    await recordOperationalEvent(sql, {
      category: 'billing', action: 'stale_reservation.release', status: 'duplicate',
      userId: adminUserId, publicOperationId, safeCategory: 'already-released',
    });
  }
  return outcome;
}

import { operationSupportReference } from '../../src/lib/supportReference.js';
import { assessStaleReservationRelease } from './adminStaleReservation.js';

export type ProviderLimitState = 'configured' | 'not_configured' | 'invalid';

export interface ConfiguredProviderLimit {
  state: ProviderLimitState;
  limit: number | null;
}

export function resolveConfiguredProviderLimit(env: NodeJS.ProcessEnv = process.env): ConfiguredProviderLimit {
  const raw = env.SHIPSEAL_AI_GLOBAL_PROVIDER_CALL_LIMIT_PER_DAY?.trim();
  if (!raw) return { state: 'not_configured', limit: null };
  if (!/^\d+$/.test(raw)) return { state: 'invalid', limit: null };
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000_000) return { state: 'invalid', limit: null };
  return { state: 'configured', limit };
}

export function isLeaseActive(leaseExpiresAt: unknown, now: Date) {
  if (!leaseExpiresAt) return false;
  const expiresAt = new Date(String(leaseExpiresAt)).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function classifyAttentionOperation(operation: Record<string, unknown>, now: Date) {
  const refunded = Number(operation.refunded_user_units || 0) === 1;
  const reserved = Number(operation.reserved_user_units || 0) === 1;
  const consumed = Number(operation.consumed_user_units || 0) === 1;
  const released = Boolean(operation.released_at);
  const activeLease = isLeaseActive(operation.active_lease_expires_at, now);
  const reviewRequired = operation.reconciliation_outcome === 'review-required';

  if (refunded || consumed && operation.result_exists || released && !reviewRequired) return null;
  if (activeLease) return null;
  if (reviewRequired) return attentionItem(operation, 'operator_review', 'Operator review required');
  if (consumed && !operation.result_exists) {
    return attentionItem(operation, 'billing_integrity_review', 'Consumed unit has no durable result');
  }
  if (!reserved) return null;
  if (operation.state === 'terminal_failure') {
    return attentionItem(operation, 'billing_release_required', 'Reserved unit was not released');
  }
  if (operation.state === 'retryable_failure') {
    return attentionItem(operation, 'needs_recovery', 'Retryable operation needs recovery');
  }
  return attentionItem(operation, 'needs_recovery', 'Lease expired; recovery is available');
}

export function buildOperationDiagnostic(
  operation: Record<string, unknown>,
  stages: Record<string, unknown>[],
  events: Record<string, unknown>[],
  now: Date,
) {
  const staleRelease = assessStaleReservationRelease(operation, now);
  const activeStage = stages.find(stage => stage.state === 'running' && isLeaseActive(stage.lease_expires_at, now));
  const staleStage = stages.find(stage => stage.state === 'running' && !isLeaseActive(stage.lease_expires_at, now));
  const retryableStage = stages.find(stage => stage.state === 'retryable_failure');
  const failedStage = stages.find(stage => stage.state === 'terminal_failure') || retryableStage;
  const refunded = Number(operation.refunded_user_units || 0) === 1;
  const consumed = Number(operation.consumed_user_units || 0) === 1;
  const reserved = Number(operation.reserved_user_units || 0) === 1;
  const released = Boolean(operation.released_at);
  const resultExists = Boolean(operation.result_exists) && !refunded;
  const unitState = refunded ? 'refunded' : consumed ? 'consumed' : reserved ? 'reserved' : released ? 'released' : 'none';
  const recoveryAction = resultExists
    ? 'Open saved result'
    : refunded
      ? 'Start a new analysis'
      : activeStage
        ? 'Wait for active lease'
        : staleStage
          ? 'Resume stale lease'
          : retryableStage || reserved
            ? 'Retry saved operation'
            : 'No safe retry available';
  const diagnosticState = resultExists
    ? 'completed'
    : refunded || released
      ? 'resolved'
      : activeStage
        ? 'active'
        : staleStage || retryableStage || reserved
          ? 'needs_recovery'
          : operation.state === 'terminal_failure'
            ? 'terminal'
            : 'historical';
  const timeline = [
    ...stages.map(stage => ({
      at: iso(stage.updated_at),
      kind: 'stage',
      label: `${String(stage.stage_kind)} · ${String(stage.state)}`,
      detail: stage.last_failure_category ? String(stage.last_failure_category) : null,
    })),
    ...events.map(event => ({
      at: iso(event.created_at),
      kind: 'event',
      label: `${String(event.category)} · ${String(event.action)} · ${String(event.status)}`,
      detail: event.safe_category ? String(event.safe_category) : null,
    })),
  ].filter(item => item.at).sort((left, right) => right.at!.localeCompare(left.at!));

  return {
    publicOperationId: String(operation.public_operation_id),
    supportReference: operationSupportReference(String(operation.public_operation_id)),
    operationKind: String(operation.operation_kind),
    operationState: String(operation.state),
    diagnosticState,
    summary: diagnosticSummary(diagnosticState, failedStage),
    failureCategory: operation.terminal_failure_category ? String(operation.terminal_failure_category) : failedStage?.last_failure_category ? String(failedStage.last_failure_category) : null,
    userUnitState: unitState,
    resultExists,
    canRetry: ['Resume stale lease', 'Retry saved operation', 'Start a new analysis'].includes(recoveryAction),
    recoveryAction,
    leaseExpiresAt: activeStage?.lease_expires_at ? iso(activeStage.lease_expires_at) : null,
    createdAt: iso(operation.created_at),
    updatedAt: iso(operation.updated_at),
    completedAt: iso(operation.completed_at),
    releasedAt: iso(operation.released_at),
    reconciliationOutcome: operation.reconciliation_outcome ? String(operation.reconciliation_outcome) : 'not-required',
    staleRelease,
    timeline,
  };
}

function attentionItem(operation: Record<string, unknown>, classification: string, reason: string) {
  const publicOperationId = String(operation.public_operation_id || '');
  const userUnitState = Number(operation.refunded_user_units || 0) === 1
    ? 'refunded'
    : Number(operation.consumed_user_units || 0) === 1
      ? 'consumed'
      : Number(operation.reserved_user_units || 0) === 1
        ? 'reserved'
        : operation.released_at ? 'released' : 'none';
  return {
    publicOperationId,
    supportReference: operationSupportReference(publicOperationId),
    operationKind: String(operation.operation_kind || ''),
    operationState: String(operation.state || ''),
    classification,
    reason,
    userUnitState,
    updatedAt: iso(operation.updated_at),
  };
}

function diagnosticSummary(state: string, failedStage: Record<string, unknown> | undefined) {
  if (state === 'completed') return 'A durable Future result exists and the operation completed.';
  if (state === 'resolved') return 'The operation is historical and no user unit remains at risk.';
  if (state === 'active') return 'A stage has a currently active lease.';
  if (state === 'needs_recovery') return 'The operation is not actively running and has a safe recovery path.';
  if (failedStage) return `The ${String(failedStage.stage_kind)} stage failed.`;
  return 'No active work or recoverable result is associated with this operation.';
}

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import postgres from 'postgres';
import { readAccountSession } from './_lib/accountSession.js';
import { validateAccountDatabaseUrl } from './_lib/authConfig.js';
import { isAdminSession, supportLookup } from './_lib/adminAuth.js';
import { buildOperationDiagnostic, classifyAttentionOperation, resolveConfiguredProviderLimit } from './_lib/adminDiagnostics.js';
import { releaseStaleReservation } from './_lib/adminStaleReservation.js';

type Request = IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined> };
export default async function handler(req: Request, res: ServerResponse) {
  const session = await readAccountSession(req);
  if (!isAdminSession(session)) return send(res, 404, { error: { code: 'not_found', message: 'Not found.' } });
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: { code: 'method_not_allowed', message: 'Use GET or POST.' } });
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) return send(res, 503, { error: { code: 'admin_unavailable', message: 'Operations data is unavailable.' } });
  try {
    validateAccountDatabaseUrl(databaseUrl);
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5, prepare: false });
    try {
      if (req.method === 'POST') {
        const action = new URL(req.url || '/', 'https://shipseal.local').searchParams.get('action');
        if (action !== 'release-stale-reservation') return send(res, 404, { error: { code: 'not_found', message: 'Not found.' } });
        const body = await readBody(req);
        const publicOperationId = typeof body.publicOperationId === 'string' ? body.publicOperationId.trim() : '';
        if (!/^op_[A-Za-z0-9_-]{20,80}$/.test(publicOperationId)) {
          return send(res, 400, { error: { code: 'invalid_request', message: 'A valid public operation ID is required.' } });
        }
        const outcome = await releaseStaleReservation(sql, publicOperationId, session!.user.id);
        if (outcome.status === 'not_found') return send(res, 404, { error: { code: 'not_found', message: 'Not found.' } });
        if (outcome.status === 'rejected') return send(res, 409, { error: { code: 'stale_release_rejected', message: outcome.reason } });
        return send(res, 200, outcome);
      }
      const q = supportLookup(req);
      const providerLimit = resolveConfiguredProviderLimit();
      const [overview, attentionCandidates, events, operations] = await Promise.all([
        sql<Record<string, unknown>[]>`select
          (select count(*)::int from public.shipseal_scans where created_at >= now() - interval '24 hours') as scans_24h,
          (select count(*)::int from public.shipseal_scans where status = 'completed' and created_at >= now() - interval '24 hours') as scans_succeeded_24h,
          (select count(*)::int from public.shipseal_scans where status <> 'completed' and created_at >= now() - interval '24 hours') as scans_failed_24h,
          (select count(*)::int from public.shipseal_ai_operations where created_at >= now() - interval '24 hours') as ai_started_24h,
          (select count(*)::int from public.shipseal_ai_operations where state = 'succeeded' and created_at >= now() - interval '24 hours') as ai_completed_24h,
          (select count(*)::int from public.shipseal_ai_operations where state = 'retryable_failure' and created_at >= now() - interval '24 hours') as ai_retryable_24h,
          (select count(*)::int from public.shipseal_ai_operations where state = 'terminal_failure' and created_at >= now() - interval '24 hours') as ai_failed_24h,
          (select count(distinct o.id)::int from public.shipseal_ai_operations o join public.shipseal_ai_operation_stages s on s.operation_id = o.id where s.state = 'running' and s.lease_expires_at > now() and not (o.canonical_complete_response is not null and o.completed_at is not null and o.refunded_user_units = 0)) as ai_in_progress,
          coalesce((select provider_call_count from public.shipseal_ai_budget_windows where window_key = (now() at time zone 'utc')::date limit 1), 0)::int as provider_calls_today,
          (select count(*)::int from public.shipseal_billing_events where processed_at >= now() - interval '24 hours') as stripe_events_24h,
          (select count(*)::int from public.shipseal_operational_events where category = 'github' and status = 'failed' and created_at >= now() - interval '24 hours') as github_failures_24h`,
        sql<Record<string, unknown>[]>`select o.public_operation_id, o.operation_kind, o.state, o.terminal_failure_category, o.reserved_user_units, o.consumed_user_units, o.refunded_user_units, o.released_at, o.reconciliation_outcome, o.updated_at, (o.canonical_complete_response is not null and o.completed_at is not null) as result_exists, (select max(s.lease_expires_at) from public.shipseal_ai_operation_stages s where s.operation_id = o.id and s.state = 'running' and s.lease_expires_at > now()) as active_lease_expires_at from public.shipseal_ai_operations o where (o.reserved_user_units = 1 and o.consumed_user_units = 0 and o.refunded_user_units = 0 and o.released_at is null) or o.reconciliation_outcome = 'review-required' or (o.consumed_user_units = 1 and o.refunded_user_units = 0 and (o.canonical_complete_response is null or o.completed_at is null)) order by o.updated_at desc limit 100`,
        sql<Record<string, unknown>[]>`select event_id, category, action, status, safe_category, public_operation_id, stage, duration_ms, provider_calls, deployment_id, created_at from public.shipseal_operational_events union all select event_id, 'stripe_webhook' as category, event_type as action, 'succeeded' as status, null as safe_category, null as public_operation_id, null as stage, null::integer as duration_ms, null::integer as provider_calls, null as deployment_id, processed_at as created_at from public.shipseal_billing_events order by created_at desc limit 50`,
        q ? sql<Record<string, unknown>[]>`select o.*,
          (o.canonical_complete_response is not null and o.completed_at is not null) as result_exists,
          exists (select 1 from public.shipseal_ai_operation_stages s where s.operation_id = o.id and s.state = 'running' and s.lease_expires_at > now()) as active_lease_exists,
          exists (select 1 from public.shipseal_ai_provider_permits p where p.operation_id = o.id and p.state = 'acquired' and p.expires_at > now()) as active_provider_permit_exists,
          exists (select 1 from public.shipseal_projects p where p.owner_user_id = o.owner_user_id and p.repository_identity = o.repository_identity and p.deleted_at is null) as project_exists,
          exists (select 1 from public.shipseal_ai_operations newer where newer.id <> o.id and newer.owner_user_id = o.owner_user_id and newer.operation_kind = o.operation_kind and newer.repository_identity = o.repository_identity and newer.created_at > o.created_at and newer.canonical_complete_response is not null and newer.completed_at is not null and newer.refunded_user_units = 0) as superseding_result_exists
          from public.shipseal_ai_operations o where lower(o.public_operation_id) = lower(${q}) or o.id = ${q} or ('RI-' || upper(right(regexp_replace(o.public_operation_id, '[^A-Za-z0-9]', '', 'g'), 10))) = upper(${q}) limit 1` : Promise.resolve([]),
      ]);
      const now = new Date();
      const overviewPayload = {
        ...(overview[0] || {}),
        provider_call_limit: providerLimit.limit,
        provider_limit_state: providerLimit.state,
      };
      const needsAttention = attentionCandidates
        .map(operation => classifyAttentionOperation(operation, now))
        .filter(Boolean)
        .slice(0, 25);
      let operation = null;
      if (operations[0]) {
        const operationId = String(operations[0].id);
        const [stages, operationEvents] = await Promise.all([
          sql<Record<string, unknown>[]>`select stage_kind, state, attempt_count, provider_call_count, lease_expires_at, last_failure_category, created_at, updated_at, succeeded_at from public.shipseal_ai_operation_stages where operation_id = ${operationId} order by created_at asc`,
          sql<Record<string, unknown>[]>`select category, action, status, safe_category, stage, duration_ms, provider_calls, deployment_id, created_at from public.shipseal_operational_events where public_operation_id = ${String(operations[0].public_operation_id)} order by created_at asc`,
        ]);
        operation = buildOperationDiagnostic(operations[0], stages, operationEvents, now);
      }
      return send(res, 200, { overview: overviewPayload, needsAttention, recentEvents: events, operation });
    } finally { await sql.end({ timeout: 1 }); }
  } catch { return send(res, 503, { error: { code: 'admin_unavailable', message: 'Operations data is temporarily unavailable.' } }); }
}
function send(res: ServerResponse, status: number, payload: unknown) { res.statusCode = status; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); }

async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body) as Record<string, unknown>;
    return req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.length;
    if (total > 8_192) throw new Error('Request body is too large.');
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
}

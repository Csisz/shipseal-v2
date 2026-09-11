import type { IncomingMessage, ServerResponse } from 'node:http';
import postgres from 'postgres';
import { readAccountSession } from './_lib/accountSession.js';
import { validateAccountDatabaseUrl } from './_lib/authConfig.js';
import { isAdminSession, supportLookup } from './_lib/adminAuth.js';

type Request = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
export default async function handler(req: Request, res: ServerResponse) {
  const session = await readAccountSession(req);
  if (!isAdminSession(session)) return send(res, 404, { error: { code: 'not_found', message: 'Not found.' } });
  if (req.method !== 'GET') return send(res, 405, { error: { code: 'method_not_allowed', message: 'Use GET.' } });
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) return send(res, 503, { error: { code: 'admin_unavailable', message: 'Operations data is unavailable.' } });
  try {
    validateAccountDatabaseUrl(databaseUrl);
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5, prepare: false });
    try {
      const q = supportLookup(req);
      const [overview, attention, events, operations] = await Promise.all([
        sql<Record<string, unknown>[]>`select
          (select count(*)::int from public.shipseal_scans where created_at >= now() - interval '24 hours') as scans_24h,
          (select count(*)::int from public.shipseal_scans where status = 'completed' and created_at >= now() - interval '24 hours') as scans_succeeded_24h,
          (select count(*)::int from public.shipseal_scans where status <> 'completed' and created_at >= now() - interval '24 hours') as scans_failed_24h,
          (select count(*)::int from public.shipseal_ai_operations where created_at >= now() - interval '24 hours') as ai_started_24h,
          (select count(*)::int from public.shipseal_ai_operations where state = 'succeeded' and created_at >= now() - interval '24 hours') as ai_completed_24h,
          (select count(*)::int from public.shipseal_ai_operations where state = 'retryable_failure' and created_at >= now() - interval '24 hours') as ai_retryable_24h,
          (select count(*)::int from public.shipseal_ai_operations where state = 'terminal_failure' and created_at >= now() - interval '24 hours') as ai_failed_24h,
          (select count(*)::int from public.shipseal_ai_operations where reserved_user_units = 1 and consumed_user_units = 0 and released_at is null) as ai_in_progress,
          (select provider_call_count from public.shipseal_ai_budget_windows where window_key = current_date limit 1) as provider_calls_today,
          (select provider_call_limit from public.shipseal_ai_budget_windows where window_key = current_date limit 1) as provider_call_limit,
          (select count(*)::int from public.shipseal_billing_events where processed_at >= now() - interval '24 hours') as stripe_events_24h,
          (select count(*)::int from public.shipseal_operational_events where category = 'github' and status = 'failed' and created_at >= now() - interval '24 hours') as github_failures_24h`,
        sql<Record<string, unknown>[]>`select public_operation_id, operation_kind, state, terminal_failure_category, reserved_user_units, consumed_user_units, refunded_user_units, updated_at from public.shipseal_ai_operations where (reserved_user_units = 1 and consumed_user_units = 0 and released_at is null) or state in ('retryable_failure','terminal_failure') order by updated_at desc limit 25`,
        sql<Record<string, unknown>[]>`select event_id, category, action, status, safe_category, public_operation_id, stage, duration_ms, provider_calls, deployment_id, created_at from public.shipseal_operational_events order by created_at desc limit 50`,
        q ? sql<Record<string, unknown>[]>`select public_operation_id, operation_kind, state, repository_identity, reserved_user_units, consumed_user_units, refunded_user_units, provider_attempt_count, terminal_failure_category, created_at, updated_at, succeeded_at, completed_at from public.shipseal_ai_operations where public_operation_id = ${q} or id = ${q} or ('RI-' || upper(right(regexp_replace(public_operation_id, '[^A-Za-z0-9]', '', 'g'), 10))) = upper(${q}) limit 1` : Promise.resolve([]),
      ]);
      return send(res, 200, { overview: overview[0] || {}, needsAttention: attention, recentEvents: events, operation: operations[0] || null });
    } finally { await sql.end({ timeout: 1 }); }
  } catch { return send(res, 503, { error: { code: 'admin_unavailable', message: 'Operations data is temporarily unavailable.' } }); }
}
function send(res: ServerResponse, status: number, payload: unknown) { res.statusCode = status; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); }

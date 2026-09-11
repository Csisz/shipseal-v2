import { randomBytes } from 'node:crypto';
import type { Sql } from 'postgres';
import { operationSupportReference } from '../../src/lib/supportReference.js';

export type OperationalEventCategory = 'auth' | 'github' | 'ingestion' | 'scan' | 'persistence' | 'ai_operation' | 'ai_stage' | 'provider' | 'billing' | 'stripe_webhook' | 'github_mutation' | 'export' | 'system';
export type OperationalEventStatus = 'started' | 'succeeded' | 'failed' | 'retryable' | 'duplicate' | 'ignored';
export interface OperationalEventInput {
  category: OperationalEventCategory;
  action: string;
  status: OperationalEventStatus;
  userId?: string;
  projectId?: string;
  scanId?: string;
  publicOperationId?: string;
  stage?: string;
  safeCategory?: string;
  durationMs?: number;
  providerCalls?: number;
  deploymentId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const SECRET_KEY = /(token|secret|password|cookie|authorization|prompt|response|source|content|body|database|stripe)/i;
export function sanitizeOperationalMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => !SECRET_KEY.test(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value))));
}
export function supportReference(publicOperationId: string) {
  return operationSupportReference(publicOperationId) || `RI-${randomBytes(5).toString('hex').toUpperCase()}`;
}
export async function recordOperationalEvent(sql: Sql, input: OperationalEventInput) {
  const eventId = `evt_${randomBytes(12).toString('base64url')}`;
  try {
    await sql`
      insert into public.shipseal_operational_events
        (id, event_id, category, action, status, user_id, project_id, scan_id, public_operation_id, stage, safe_category, duration_ms, provider_calls, deployment_id, metadata)
      values
        (${eventId}, ${eventId}, ${input.category}, ${input.action}, ${input.status}, ${input.userId || null}, ${input.projectId || null}, ${input.scanId || null}, ${input.publicOperationId || null}, ${input.stage || null}, ${input.safeCategory || null}, ${input.durationMs ?? null}, ${input.providerCalls ?? null}, ${(input.deploymentId || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || null)}, ${JSON.stringify(sanitizeOperationalMetadata(input.metadata))}::jsonb)
    `;
  } catch {
    // Observability must never break a successful product transaction.
  }
  return eventId;
}

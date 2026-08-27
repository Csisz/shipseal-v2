import type { IncomingMessage, ServerResponse } from 'node:http';
import { readAccountSession } from '../../_lib/accountSession.js';
import { AiUsageAuthorizationService } from '../../_lib/aiUsage.js';

type RequestWithQuery = IncomingMessage & { query?: Record<string, string | string[] | undefined> };

export default async function handler(req: RequestWithQuery, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return send(res, 405, { error: { code: 'method_not_allowed', message: 'Use GET.' } });
  const session = await readAccountSession(req);
  if (!session) return send(res, 401, { error: { code: 'authentication_required', message: 'Sign in to restore Repository Futures.' } });
  const result = await new AiUsageAuthorizationService().getOperationResult(session.user.id, lookup(req));
  if (!result) return send(res, 404, { error: { code: 'result_unavailable', message: 'A durable Future result is not available yet.' } });
  return send(res, 200, { result });
}

function lookup(req: RequestWithQuery) {
  const query = req.query || Object.fromEntries(new URL(req.url || '/', 'https://shipseal.local').searchParams);
  return {
    publicOperationId: first(query.publicOperationId),
    requestFingerprint: first(query.requestFingerprint),
    repositoryIdentity: first(query.repositoryIdentity),
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

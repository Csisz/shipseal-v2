import type { IncomingMessage, ServerResponse } from 'node:http';
import { readAccountSession } from '../../_lib/accountSession.js';
import { AiUsageAuthorizationService } from '../../_lib/aiUsage.js';

type RequestWithQuery = IncomingMessage & { query?: Record<string, string | string[] | undefined> };

export default async function handler(req: RequestWithQuery, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return send(res, 405, { error: { code: 'method_not_allowed', message: 'Use GET.' } });
  const session = await readAccountSession(req);
  if (!session) return send(res, 401, { error: { code: 'authentication_required', message: 'Sign in to inspect Future analysis status.' } });
  const query = queryOf(req);
  const service = new AiUsageAuthorizationService();
  if (first(query.includeProgress) === '1') {
    const progress = await service.getOperationProgress(session.user.id, lookup(req, query));
    if (!progress) return send(res, 404, { error: { code: 'not_found', message: 'No matching Future analysis was found.' } });
    return send(res, 200, { operation: progress.operation, progress });
  }
  const operation = await service.getOperationStatus(session.user.id, lookup(req, query));
  if (!operation) return send(res, 404, { error: { code: 'not_found', message: 'No matching Future analysis was found.' } });
  return send(res, 200, { operation });
}

function queryOf(req: RequestWithQuery) {
  return req.query || Object.fromEntries(new URL(req.url || '/', 'https://shipseal.local').searchParams);
}

function lookup(req: RequestWithQuery, query = queryOf(req)) {
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

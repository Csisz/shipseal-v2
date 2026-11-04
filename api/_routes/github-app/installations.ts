import type { IncomingMessage, ServerResponse } from 'node:http';

type QueryValue = string | string[] | undefined;
type VercelLikeRequest = IncomingMessage & {
  query?: Record<string, QueryValue>;
};

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function queryFromRequest(req: VercelLikeRequest) {
  if (req.query) return req.query;
  const parsed = new URL(req.url || '/', 'https://shipseal.local');
  return {
    code: parsed.searchParams.get('code') || undefined,
  };
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { status: 'method_not_allowed', code: 'github_api_error', message: 'Use GET.' });
    return;
  }

  void firstValue(queryFromRequest(req).code);
  sendJson(res, 410, {
    status: 'deprecated',
    code: 'user_authorization_failed',
    message: 'Use the state-validated GitHub connection callback.',
  });
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAndListInstallations } from '../_lib/githubAppOAuth.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../_lib/githubAppTypes.js';

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

  const code = (firstValue(queryFromRequest(req).code) || '').trim();
  if (!code) {
    sendJson(res, 400, {
      status: 'invalid_request',
      code: 'user_authorization_failed',
      message: 'GitHub authorization code is required.',
    });
    return;
  }

  try {
    const installations = await authorizeAndListInstallations(code);
    sendJson(res, 200, {
      status: 'ok',
      installations: installations.map(installation => ({ ...installation, id: String(installation.id) })),
    });
  } catch (error) {
    if (error instanceof GitHubAppNotConfiguredError) {
      sendJson(res, 501, { status: 'not_configured', code: error.code, message: error.message });
      return;
    }
    if (error instanceof GitHubAppApiError) {
      sendJson(res, error.status >= 400 && error.status < 600 ? error.status : 502, {
        status: 'github_error',
        code: error.code,
        message: error.message,
      });
      return;
    }
    sendJson(res, 502, {
      status: 'github_error',
      code: 'github_api_error',
      message: 'GitHub installation discovery failed.',
    });
  }
}

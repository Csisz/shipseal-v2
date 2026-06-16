import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { buildGitHubOAuthAuthorizeUrl, getGitHubAppOAuthConfig } from '../_lib/githubAppOAuth';
import { GitHubAppNotConfiguredError } from '../_lib/githubAppTypes';

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
    redirectUri: parsed.searchParams.get('redirectUri') || undefined,
  };
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function callbackUrl(req: VercelLikeRequest, explicit?: string) {
  if (explicit?.trim()) return explicit.trim();
  const host = req.headers.host || 'localhost:8080';
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/github-app/oauth-callback`;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { status: 'method_not_allowed', message: 'Use GET.' });
    return;
  }

  try {
    const config = getGitHubAppOAuthConfig();
    const query = queryFromRequest(req);
    const state = randomBytes(12).toString('hex');
    const redirectUri = callbackUrl(req, firstValue(query.redirectUri));
    const authorizeUrl = buildGitHubOAuthAuthorizeUrl({ clientId: config.clientId, state, redirectUri });
    res.statusCode = 302;
    res.setHeader('Location', authorizeUrl);
    res.end();
  } catch (error) {
    if (error instanceof GitHubAppNotConfiguredError) {
      sendJson(res, 501, {
        status: 'not_configured',
        code: error.code,
        message: error.message,
      });
      return;
    }
    sendJson(res, 502, {
      status: 'github_error',
      code: 'github_api_error',
      message: 'GitHub connection could not start.',
    });
  }
}

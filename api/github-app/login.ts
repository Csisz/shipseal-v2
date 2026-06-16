import type { IncomingMessage, ServerResponse } from 'node:http';

type QueryValue = string | string[] | undefined;
type VercelLikeRequest = IncomingMessage & {
  query?: Record<string, QueryValue>;
};

type LoginErrorCode =
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'invalid_callback_url'
  | 'login_redirect_failed';

class GitHubLoginError extends Error {
  constructor(public readonly code: LoginErrorCode, message: string, public readonly status = 500) {
    super(message);
    this.name = 'GitHubLoginError';
  }
}

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function queryFromRequest(req: VercelLikeRequest): Record<string, QueryValue> {
  if (req.query) return req.query;
  const parsed = new URL(req.url || '/', 'https://shipseal.local');
  return {
    redirectUri: parsed.searchParams.get('redirectUri') || undefined,
  };
}

function safeHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendSafeError(res: ServerResponse, error: unknown) {
  if (error instanceof GitHubLoginError) {
    sendJson(res, error.status, {
      status: 'error',
      code: error.code,
      message: error.message,
    });
    return;
  }

  sendJson(res, 500, {
    status: 'error',
    code: 'login_redirect_failed',
    message: 'GitHub login redirect could not be created.',
  });
}

export function getGitHubLoginConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = (env.GITHUB_APP_CLIENT_ID || '').trim();
  const clientSecret = (env.GITHUB_APP_CLIENT_SECRET || '').trim();
  const callbackUrl = (env.GITHUB_APP_CALLBACK_URL || '').trim();

  if (!clientId) {
    throw new GitHubLoginError('missing_client_id', 'GitHub App OAuth client ID is missing.', 501);
  }
  if (!clientSecret) {
    throw new GitHubLoginError('missing_client_secret', 'GitHub App OAuth client secret is missing.', 501);
  }

  return { clientId, callbackUrl };
}

export function resolveCallbackUrl(req: VercelLikeRequest, explicit?: string, configured?: string) {
  const candidate = explicit?.trim() || configured?.trim();
  if (candidate) return assertValidCallbackUrl(candidate);

  const host = safeHeader(req.headers?.host) || 'localhost:8080';
  const forwardedProto = safeHeader(req.headers?.['x-forwarded-proto']);
  const forwardedHost = safeHeader(req.headers?.['x-forwarded-host']);
  const proto = (forwardedProto || (host.includes('localhost') ? 'http' : 'https')).split(',')[0].trim();
  const publicHost = (forwardedHost || host).split(',')[0].trim();

  return assertValidCallbackUrl(`${proto}://${publicHost}/api/github-app/oauth-callback`);
}

function assertValidCallbackUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new GitHubLoginError('invalid_callback_url', 'GitHub App callback URL is invalid.', 500);
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/api/github-app/oauth-callback') {
    throw new GitHubLoginError('invalid_callback_url', 'GitHub App callback URL must point to /api/github-app/oauth-callback.', 500);
  }

  return parsed.toString();
}

async function createState() {
  try {
    const crypto = await import('node:crypto');
    return crypto.randomBytes(12).toString('hex');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function buildGitHubLoginAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  try {
    if (req.method && req.method !== 'GET') {
      sendJson(res, 405, {
        status: 'error',
        code: 'login_redirect_failed',
        message: 'Use GET.',
      });
      return;
    }

    const config = getGitHubLoginConfig();
    const query = queryFromRequest(req);
    const redirectUri = resolveCallbackUrl(req, firstValue(query.redirectUri), config.callbackUrl);
    const state = await createState();
    const authorizeUrl = buildGitHubLoginAuthorizeUrl({
      clientId: config.clientId,
      redirectUri,
      state,
    });

    res.statusCode = 302;
    res.setHeader('Location', authorizeUrl);
    res.end();
  } catch (error) {
    sendSafeError(res, error);
  }
}

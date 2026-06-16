import type { IncomingMessage, ServerResponse } from 'node:http';

type QueryValue = string | string[] | undefined;
type VercelLikeRequest = IncomingMessage & {
  query?: Record<string, QueryValue>;
};

type LoginFlow = 'oauth_authorize' | 'app_install';
type LoginErrorCode =
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'invalid_client_id_format'
  | 'invalid_oauth_config'
  | 'invalid_callback_url'
  | 'missing_install_url'
  | 'login_redirect_failed';

interface LoginDecision {
  ok: boolean;
  flow: LoginFlow;
  redirectUrl?: string;
  redirectUri: string;
  requiredCallbackUrl: string;
  authorizeUrlHost?: string;
  authorizeUrlPath?: string;
  fallbackInstallUrl?: string;
  clientIdPresent: boolean;
  clientIdLooksValid: boolean;
  clientSecretPresent: boolean;
  callbackUrlConfigured: boolean;
  callbackUrlUsable: boolean;
  invalidFields: string[];
  missingEnv: string[];
  errorCode?: LoginErrorCode;
  message?: string;
}

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
    debug: parsed.searchParams.get('debug') || undefined,
    redirectUri: parsed.searchParams.get('redirectUri') || undefined,
    flow: parsed.searchParams.get('flow') || undefined,
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

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendPopupError(res: ServerResponse, status: number, input: { code: LoginErrorCode; message: string; missingEnv?: string[] }) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub connection needs configuration</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.5; color: #111827; }
      code { background: #f3f4f6; border-radius: 4px; padding: 0.1rem 0.25rem; }
      button, a { display: inline-block; margin-right: 0.75rem; margin-top: 1rem; }
    </style>
  </head>
  <body>
    <h1>GitHub login is not configured correctly.</h1>
    <p>${htmlEscape(input.message)}</p>
    <p>Safe error code: <code>${htmlEscape(input.code)}</code></p>
    ${input.missingEnv?.length ? `<p>Missing configuration: <code>${htmlEscape(input.missingEnv.join(', '))}</code></p>` : ''}
    <button type="button" onclick="window.close()">Close and retry</button>
    <a href="/#scan" target="_self">Use public GitHub URL instead</a>
  </body>
</html>`);
}

function sendDebugError(res: ServerResponse, error: unknown) {
  if (error instanceof GitHubLoginError) {
    sendJson(res, error.status, {
      ok: false,
      flow: 'oauth_authorize',
      clientIdPresent: false,
      clientIdLooksValid: false,
      clientSecretPresent: false,
      callbackUrlConfigured: false,
      callbackUrlUsable: error.code !== 'invalid_callback_url',
      missingEnv: [],
      invalidFields: error.code === 'invalid_callback_url' ? ['GITHUB_APP_CALLBACK_URL'] : [],
      errorCode: error.code,
      message: error.message,
    });
    return;
  }

  sendJson(res, 500, {
    ok: false,
    flow: 'oauth_authorize',
    clientIdPresent: false,
    clientIdLooksValid: false,
    clientSecretPresent: false,
    callbackUrlConfigured: false,
    callbackUrlUsable: false,
    missingEnv: [],
    invalidFields: [],
    errorCode: 'login_redirect_failed',
    message: 'GitHub login redirect could not be created.',
  });
}

function sendSafeError(res: ServerResponse, error: unknown) {
  if (error instanceof GitHubLoginError) {
    sendPopupError(res, error.status, {
      code: error.code,
      message: error.message,
    });
    return;
  }

  sendPopupError(res, 500, {
    code: 'login_redirect_failed',
    message: 'GitHub login redirect could not be created.',
  });
}

function serverEnv(env: NodeJS.ProcessEnv = process.env) {
  const clientId = (env.GITHUB_APP_CLIENT_ID || '').trim();
  const clientSecret = (env.GITHUB_APP_CLIENT_SECRET || '').trim();
  const callbackUrl = (env.GITHUB_APP_CALLBACK_URL || '').trim();
  const installUrl = (env.GITHUB_APP_INSTALL_URL || env.VITE_GITHUB_APP_INSTALL_URL || '').trim();
  const slug = (env.GITHUB_APP_SLUG || env.VITE_GITHUB_APP_SLUG || '').trim();
  return { clientId, clientSecret, callbackUrl, installUrl, slug };
}

function clientIdInvalidReasons(clientId: string) {
  const reasons: string[] = [];
  if (!clientId) return reasons;
  if (/\s/.test(clientId)) reasons.push('GITHUB_APP_CLIENT_ID');
  if (clientId.length < 8 || clientId.length > 128) reasons.push('GITHUB_APP_CLIENT_ID');
  if (!/^[A-Za-z0-9._-]+$/.test(clientId)) reasons.push('GITHUB_APP_CLIENT_ID');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(clientId)) reasons.push('GITHUB_APP_CLIENT_ID');
  if (/PRIVATE_KEY|BEGIN|END|-----|github_pat_|ghp_|gho_|ghu_|ghs_|ghr_|sk-/i.test(clientId)) {
    reasons.push('GITHUB_APP_CLIENT_ID');
  }
  return Array.from(new Set(reasons));
}

function buildInstallUrl(input: { installUrl?: string; slug?: string }) {
  if (input.installUrl?.trim()) return assertGitHubUrl(input.installUrl.trim(), '/apps/');
  if (input.slug?.trim()) return `https://github.com/apps/${encodeURIComponent(input.slug.trim())}/installations/new`;
  return '';
}

function tryBuildInstallUrl(input: { installUrl?: string; slug?: string }) {
  try {
    return { url: buildInstallUrl(input) };
  } catch (error) {
    return { url: '', error };
  }
}

function assertGitHubUrl(value: string, requiredPathPrefix?: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new GitHubLoginError('missing_install_url', 'GitHub App install URL is invalid.', 500);
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
    throw new GitHubLoginError('missing_install_url', 'GitHub App install URL must use https://github.com.', 500);
  }
  if (requiredPathPrefix && !parsed.pathname.startsWith(requiredPathPrefix)) {
    throw new GitHubLoginError('missing_install_url', 'GitHub App install URL must point to a GitHub App installation page.', 500);
  }
  return parsed.toString();
}

export function resolveCallbackUrl(req: VercelLikeRequest, explicit?: string, configured?: string, env: NodeJS.ProcessEnv = process.env) {
  const candidate = explicit?.trim() || configured?.trim();
  if (candidate) return assertValidCallbackUrl(candidate, env);

  const host = safeHeader(req.headers?.host) || 'localhost:8080';
  const forwardedProto = safeHeader(req.headers?.['x-forwarded-proto']);
  const forwardedHost = safeHeader(req.headers?.['x-forwarded-host']);
  const proto = (forwardedProto || (host.includes('localhost') ? 'http' : 'https')).split(',')[0].trim();
  const publicHost = (forwardedHost || host).split(',')[0].trim();

  return assertValidCallbackUrl(`${proto}://${publicHost}/api/github-app/oauth-callback`, env);
}

function assertValidCallbackUrl(value: string, env: NodeJS.ProcessEnv = process.env) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new GitHubLoginError('invalid_callback_url', 'GitHub App callback URL is invalid.', 500);
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/api/github-app/oauth-callback') {
    throw new GitHubLoginError('invalid_callback_url', 'GitHub App callback URL must point to /api/github-app/oauth-callback.', 500);
  }
  if (env.VERCEL === '1' && parsed.protocol !== 'https:') {
    throw new GitHubLoginError('invalid_callback_url', 'GitHub App callback URL must be HTTPS in production.', 500);
  }
  if (env.VERCEL === '1' && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) {
    throw new GitHubLoginError('invalid_callback_url', 'GitHub App callback URL cannot be localhost in production.', 500);
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

function safeUrlParts(value?: string) {
  if (!value) return {};
  const parsed = new URL(value);
  return {
    authorizeUrlHost: parsed.hostname,
    authorizeUrlPath: parsed.pathname,
  };
}

async function decideLogin(req: VercelLikeRequest): Promise<LoginDecision> {
  const query = queryFromRequest(req);
  const env = serverEnv();
  const missingEnv: string[] = [];
  const invalidFields: string[] = [];
  const clientIdPresent = !!env.clientId;
  const clientIdInvalid = clientIdInvalidReasons(env.clientId);
  const clientIdLooksValid = clientIdPresent && clientIdInvalid.length === 0;
  const clientSecretPresent = !!env.clientSecret;
  const redirectUri = resolveCallbackUrl(req, firstValue(query.redirectUri), env.callbackUrl);
  const callbackUrlConfigured = !!env.callbackUrl;
  const callbackUrlUsable = true;
  const requiredCallbackUrl = redirectUri;
  const requestedFlow = firstValue(query.flow);
  const fallback = tryBuildInstallUrl({ installUrl: env.installUrl, slug: env.slug });
  const fallbackInstallUrl = fallback.url;
  invalidFields.push(...clientIdInvalid);

  if (requestedFlow === 'install') {
    if (fallback.error) throw fallback.error;
    if (!fallbackInstallUrl) missingEnv.push('GITHUB_APP_INSTALL_URL or GITHUB_APP_SLUG');
    return {
      ok: !!fallbackInstallUrl,
      flow: 'app_install',
      redirectUrl: fallbackInstallUrl || undefined,
      redirectUri,
      requiredCallbackUrl,
      ...safeUrlParts(fallbackInstallUrl),
      fallbackInstallUrl,
      clientIdPresent,
      clientIdLooksValid,
      clientSecretPresent,
      callbackUrlConfigured,
      callbackUrlUsable,
      invalidFields,
      missingEnv,
      errorCode: fallbackInstallUrl ? undefined : 'missing_install_url',
      message: fallbackInstallUrl
        ? 'Opening the GitHub App installation/configuration flow.'
        : 'GitHub App installation URL is not configured.',
    };
  }

  if (!clientSecretPresent) missingEnv.push('GITHUB_APP_CLIENT_SECRET');
  if (!clientIdPresent) missingEnv.push('GITHUB_APP_CLIENT_ID');

  if (clientIdPresent && clientSecretPresent && clientIdLooksValid) {
    const authorizeUrl = buildGitHubLoginAuthorizeUrl({
      clientId: env.clientId,
      redirectUri,
      state: await createState(),
    });
    return {
      ok: true,
      flow: 'oauth_authorize',
      redirectUrl: authorizeUrl,
      redirectUri,
      requiredCallbackUrl,
      ...safeUrlParts(authorizeUrl),
      fallbackInstallUrl,
      clientIdPresent,
      clientIdLooksValid,
      clientSecretPresent,
      callbackUrlConfigured,
      callbackUrlUsable,
      invalidFields,
      missingEnv,
    };
  }

  const errorCode: LoginErrorCode = !clientIdPresent
    ? 'missing_client_id'
    : !clientSecretPresent
      ? 'missing_client_secret'
      : !clientIdLooksValid
        ? 'invalid_client_id_format'
        : 'invalid_oauth_config';
  return {
    ok: false,
    flow: 'oauth_authorize',
    redirectUri,
    requiredCallbackUrl,
    fallbackInstallUrl,
    clientIdPresent,
    clientIdLooksValid,
    clientSecretPresent,
    callbackUrlConfigured,
    callbackUrlUsable,
    invalidFields,
    missingEnv,
    errorCode,
    message: 'GitHub login is not configured correctly.',
  };
}

function debugPayload(decision: LoginDecision) {
  return {
    ok: decision.ok,
    flow: decision.flow,
    authorizeUrlHost: decision.authorizeUrlHost,
    authorizeUrlPath: decision.authorizeUrlPath,
    clientIdPresent: decision.clientIdPresent,
    clientIdLooksValid: decision.clientIdLooksValid,
    clientSecretPresent: decision.clientSecretPresent,
    redirectUri: decision.redirectUri,
    redirectUriOrigin: new URL(decision.redirectUri).origin,
    redirectUriPathname: new URL(decision.redirectUri).pathname,
    requiredCallbackUrl: decision.requiredCallbackUrl,
    fallbackInstallUrl: decision.fallbackInstallUrl,
    callbackUrlConfigured: decision.callbackUrlConfigured,
    callbackUrlUsable: decision.callbackUrlUsable,
    missingEnv: decision.missingEnv,
    invalidFields: decision.invalidFields,
    errorCode: decision.errorCode,
    message: decision.message,
  };
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  try {
    if (req.method && req.method !== 'GET') {
      sendPopupError(res, 405, {
        code: 'login_redirect_failed',
        message: 'Use GET.',
      });
      return;
    }

    const query = queryFromRequest(req);
    const debug = firstValue(query.debug) === '1';
    let decision: LoginDecision;
    try {
      decision = await decideLogin(req);
    } catch (error) {
      if (debug) {
        sendDebugError(res, error);
        return;
      }
      throw error;
    }

    if (debug) {
      sendJson(res, decision.ok ? 200 : 500, debugPayload(decision));
      return;
    }

    if (!decision.ok || !decision.redirectUrl) {
      sendPopupError(res, 500, {
        code: decision.errorCode || 'login_redirect_failed',
        message: decision.message || 'GitHub login redirect could not be created.',
        missingEnv: decision.missingEnv,
      });
      return;
    }

    res.statusCode = 302;
    res.setHeader('Location', decision.redirectUrl);
    res.end();
  } catch (error) {
    sendSafeError(res, error);
  }
}

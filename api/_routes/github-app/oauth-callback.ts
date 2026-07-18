import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAndListInstallations } from '../../_lib/githubAppOAuth.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../../_lib/githubAppTypes.js';

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
    error: parsed.searchParams.get('error') || undefined,
    error_description: parsed.searchParams.get('error_description') || undefined,
    debug: parsed.searchParams.get('debug') || undefined,
  };
}

function safeHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getInstallFallbackUrl(env: NodeJS.ProcessEnv = process.env) {
  const installUrl = (env.GITHUB_APP_INSTALL_URL || env.VITE_GITHUB_APP_INSTALL_URL || '').trim();
  const slug = (env.GITHUB_APP_SLUG || env.VITE_GITHUB_APP_SLUG || '').trim();
  if (installUrl) {
    try {
      const parsed = new URL(installUrl);
      if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') return parsed.toString();
    } catch {
      return '';
    }
  }
  return slug ? `https://github.com/apps/${encodeURIComponent(slug)}/installations/new` : '';
}

function sendHtml(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
  title: string,
  options: { actionHref?: string; actionLabel?: string; autoClose?: boolean } = {}
) {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const autoClose = options.autoClose !== false;
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
  </head>
  <body>
    <p>${htmlEscape(title)}</p>
    <p><a href="/#scan">Return to ShipSeal</a></p>
    ${options.actionHref && options.actionLabel ? `<p><a href="${htmlEscape(options.actionHref)}">${htmlEscape(options.actionLabel)}</a></p>` : ''}
    <script>
      (function () {
        var message = ${safeJson};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, window.location.origin);
        }
        ${autoClose ? 'window.setTimeout(function () { window.close(); }, 100);' : ''}
      }());
    </script>
  </body>
</html>`);
}

function errorPayload(code: string, message: string) {
  return {
    type: code === 'no_installations' ? 'shipseal:github-install-required' : 'shipseal:github-error',
    source: 'shipseal-github-connect',
    status: 'error',
    code,
    message,
  };
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function resolveCallbackUrl(req: VercelLikeRequest, env: NodeJS.ProcessEnv = process.env) {
  const configured = (env.GITHUB_APP_CALLBACK_URL || '').trim();
  if (configured) return configured;
  const host = safeHeader(req.headers?.host) || 'localhost:8080';
  const forwardedProto = safeHeader(req.headers?.['x-forwarded-proto']);
  const proto = (forwardedProto || (host.includes('localhost') ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host.split(',')[0].trim()}/api/github-app/oauth-callback`;
}

function isCallbackUrlUsable(value: string, env: NodeJS.ProcessEnv = process.env) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.pathname !== '/api/github-app/oauth-callback') return false;
    if (env.VERCEL === '1' && parsed.protocol !== 'https:') return false;
    if (env.VERCEL === '1' && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function sendSafeFailure(res: ServerResponse, error: unknown, title = 'GitHub connection failed.') {
  if (error instanceof GitHubAppNotConfiguredError) {
    sendHtml(res, 501, errorPayload(error.code, error.message), 'GitHub connection is not configured.');
    return;
  }
  if (error instanceof GitHubAppApiError) {
    sendHtml(res, error.status >= 400 && error.status < 600 ? error.status : 502, errorPayload(error.code, error.message), title);
    return;
  }
  sendHtml(res, 502, errorPayload('github_api_error', 'GitHub connection failed.'), title);
}

function sendDebug(res: ServerResponse, req: VercelLikeRequest, input: { codePresent: boolean; tokenExchangeAttempted?: boolean; tokenExchangeStatus?: string; installationsAttempted?: boolean; safeErrorCode?: string }) {
  const callbackUrl = resolveCallbackUrl(req);
  sendJson(res, input.safeErrorCode ? 500 : 200, {
    codePresent: input.codePresent,
    clientIdPresent: !!(process.env.GITHUB_APP_CLIENT_ID || '').trim(),
    clientSecretPresent: !!(process.env.GITHUB_APP_CLIENT_SECRET || '').trim(),
    callbackUrlUsable: isCallbackUrlUsable(callbackUrl),
    tokenExchangeAttempted: !!input.tokenExchangeAttempted,
    tokenExchangeStatus: input.tokenExchangeStatus || 'not_attempted',
    installationsAttempted: !!input.installationsAttempted,
    safeErrorCode: input.safeErrorCode,
  });
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  try {
    if (req.method && req.method !== 'GET') {
      sendHtml(res, 405, errorPayload('github_api_error', 'Use GET.'), 'GitHub connection failed.');
      return;
    }

    const query = queryFromRequest(req);
    const debug = firstValue(query.debug) === '1';
    const error = (firstValue(query.error) || '').trim();
    const errorDescription = (firstValue(query.error_description) || '').trim();
    const code = (firstValue(query.code) || '').trim();
    const callbackUrl = resolveCallbackUrl(req);

    if (debug) {
      sendDebug(res, req, {
        codePresent: !!code,
        tokenExchangeAttempted: false,
        installationsAttempted: false,
        safeErrorCode: error ? (error === 'access_denied' ? 'github_oauth_denied' : 'github_oauth_error') : !code ? 'missing_oauth_code' : undefined,
      });
      return;
    }

    if (error) {
      const codeName = error === 'access_denied' ? 'github_oauth_denied' : 'github_oauth_error';
      sendHtml(
        res,
        400,
        errorPayload(codeName, errorDescription || 'GitHub authorization was not completed.'),
        'GitHub authorization was not completed.'
      );
      return;
    }

    if (!code) {
      sendHtml(
        res,
        400,
        errorPayload('missing_oauth_code', 'GitHub authorization did not return a code.'),
        'GitHub authorization was not completed.'
      );
      return;
    }

    if (!isCallbackUrlUsable(callbackUrl)) {
      sendHtml(
        res,
        500,
        errorPayload('github_oauth_error', 'GitHub OAuth callback URL is not valid.'),
        'GitHub connection failed.'
      );
      return;
    }

    const installations = await authorizeAndListInstallations(code, { redirectUri: callbackUrl });
    if (installations.length === 0) {
      const installUrl = getInstallFallbackUrl();
      sendHtml(
        res,
        200,
        errorPayload('no_installations', 'No ShipSeal GitHub App installations were found for this GitHub account.'),
        'Install ShipSeal GitHub App to choose repositories.',
        {
          actionHref: installUrl || undefined,
          actionLabel: installUrl ? 'Install ShipSeal GitHub App' : undefined,
          autoClose: false,
        }
      );
      return;
    }

    const payload = {
      type: installations.length === 1 ? 'shipseal:github-connected' : 'shipseal:github-installations',
      source: 'shipseal-github-connect',
      status: 'ok',
      setupAction: 'oauth',
      installationId: installations.length === 1 ? String(installations[0].id) : undefined,
      installations: installations.map(installation => ({
        ...installation,
        id: String(installation.id),
      })),
    };
    sendHtml(res, 200, payload, 'GitHub connected. You can return to ShipSeal.');
  } catch (err) {
    sendSafeFailure(res, err);
  }
}

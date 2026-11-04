import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeGitHubConnection } from '../../_lib/githubAppOAuth.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../../_lib/githubAppTypes.js';
import { AuthConfigurationError, resolveGitHubOAuthCallbackUrl, safeAuthDiagnostic } from '../../_lib/authConfig.js';
import { consumeGitHubFlowState, writeGitHubConnectionSession, writePendingGitHubUserToken } from '../../_lib/githubConnectionSession.js';
import { renderGitHubTransitionPage } from '../../_lib/githubCallbackPage.js';

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
    state: parsed.searchParams.get('state') || undefined,
    debug: parsed.searchParams.get('debug') || undefined,
  };
}

function sendHtml(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
  title: string,
  options: { nextUrl?: string; fallbackUrl?: string; message?: string; notifyOpener?: boolean; closePopup?: boolean } = {}
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(renderGitHubTransitionPage({
    payload,
    title,
    message: options.message || 'Returning to ShipSeal…',
    nextUrl: options.nextUrl,
    fallbackUrl: options.fallbackUrl,
    notifyOpener: options.notifyOpener,
    closePopup: options.closePopup,
  }));
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
  return resolveGitHubOAuthCallbackUrl(req, '', env);
}

function isCallbackUrlUsable(value: string, env: NodeJS.ProcessEnv = process.env) {
  try {
    resolveGitHubOAuthCallbackUrl({ headers: {} }, value, env);
    return true;
  } catch {
    return false;
  }
}

function sendSafeFailure(res: ServerResponse, error: unknown, title = 'GitHub connection failed.') {
  if (error instanceof AuthConfigurationError) {
    sendHtml(res, 503, errorPayload(error.code, error.message), 'GitHub connection is not configured.');
    return;
  }
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
    const state = (firstValue(query.state) || '').trim();
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

    if (!consumeGitHubFlowState(req, res, 'oauth', state)) {
      sendHtml(
        res,
        400,
        errorPayload('invalid_oauth_state', 'GitHub authorization expired or could not be verified. Start Connect GitHub again.'),
        'GitHub authorization expired.'
      );
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

    const connection = await authorizeGitHubConnection(code, { redirectUri: callbackUrl });
    const installations = connection.installations;
    writeGitHubConnectionSession(req, res, {
      githubUserId: String(connection.user.id),
      githubLogin: connection.user.login,
      installations,
      selectedInstallationId: installations.length === 1 ? String(installations[0].id) : undefined,
    });
    writePendingGitHubUserToken(req, res, {
      githubUserId: String(connection.user.id),
      token: connection.accessToken,
      apiBaseUrl: connection.apiBaseUrl,
    });
    if (installations.length === 0) {
      sendHtml(
        res,
        200,
        {
          ...errorPayload('no_installations', 'No ShipSeal GitHub App installations were found for this GitHub account.'),
          githubLogin: connection.user.login,
        },
        'Install ShipSeal GitHub App to choose repositories.',
        {
          nextUrl: '/api/github-app/login?flow=install',
          fallbackUrl: '/?githubConnection=reconnect-required#scan',
          message: 'GitHub is connected. Opening repository selection…',
          notifyOpener: false,
          closePopup: false,
        }
      );
      return;
    }

    const payload = {
      type: installations.length === 1 ? 'shipseal:github-connected' : 'shipseal:github-installations',
      source: 'shipseal-github-connect',
      status: 'ok',
      setupAction: 'oauth',
      githubLogin: connection.user.login,
      installationId: installations.length === 1 ? String(installations[0].id) : undefined,
      installations: installations.map(installation => ({
        ...installation,
        id: String(installation.id),
      })),
    };
    sendHtml(res, 200, payload, 'GitHub connected', {
      message: 'Your authorized repositories are ready in ShipSeal.',
      fallbackUrl: '/?githubConnection=connected#scan',
    });
  } catch (err) {
    console.error('[shipseal-github-oauth-callback]', safeAuthDiagnostic(err));
    sendSafeFailure(res, err);
  }
}

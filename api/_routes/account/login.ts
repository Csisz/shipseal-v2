import type { IncomingMessage, ServerResponse } from 'node:http';
import { createOAuthState, safeReturnPath } from '../../_lib/accountSession.js';
import { AuthConfigurationError, getAccountOAuthConfig, safeAuthDiagnostic, validateAccountRequestOrigin } from '../../_lib/authConfig.js';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sendUnavailable(res: ServerResponse, error: unknown) {
  const diagnostic = safeAuthDiagnostic(error);
  const message = 'Account sign-in is unavailable on this deployment. Anonymous scanning, ZIP upload, and public URL scanning remain available.';
  const payload = JSON.stringify({ source: 'shipseal-account', status: 'unavailable', code: diagnostic.code, message }).replace(/</g, '\\u003c');
  res.statusCode = error instanceof AuthConfigurationError ? 503 : 500;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ShipSeal sign-in unavailable</title></head><body><main><h1>Sign-in is temporarily unavailable.</h1><p>${escapeHtml(message)}</p><button type="button" onclick="window.close()">Return to ShipSeal</button></main><script>(function(){if(window.opener&&!window.opener.closed)window.opener.postMessage(${payload},window.location.origin);}());</script></body></html>`);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method && req.method !== 'GET') { res.statusCode = 405; res.end('Use GET.'); return; }
  try {
    const settings = getAccountOAuthConfig();
    validateAccountRequestOrigin(req, settings);
    const returnTo = safeReturnPath(new URL(req.url || '/', 'https://shipseal.local').searchParams.get('returnTo') || '/');
    const state = createOAuthState(res, req, returnTo);
    const params = new URLSearchParams({ client_id: settings.clientId, redirect_uri: settings.callbackUrl, state, scope: settings.scope });
    res.statusCode = 302;
    res.setHeader('Location', `https://github.com/login/oauth/authorize?${params}`);
    res.end();
  } catch (error) {
    console.error('[shipseal-account-login]', safeAuthDiagnostic(error));
    sendUnavailable(res, error);
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createOAuthState, safeReturnPath } from '../_lib/accountSession.js';

function config(env: NodeJS.ProcessEnv = process.env) {
  const clientId = (env.SHIPSEAL_ACCOUNT_GITHUB_CLIENT_ID || '').trim();
  const callbackUrl = (env.SHIPSEAL_ACCOUNT_GITHUB_CALLBACK_URL || '').trim();
  if (!clientId || !callbackUrl) return null;
  const parsed = new URL(callbackUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/api/account/callback') return null;
  if ((env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') && parsed.protocol !== 'https:') return null;
  return { clientId, callbackUrl };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method && req.method !== 'GET') { res.statusCode = 405; res.end('Use GET.'); return; }
  const settings = config();
  if (!settings) { res.statusCode = 503; res.end('ShipSeal account sign-in is not configured.'); return; }
  const returnTo = safeReturnPath(new URL(req.url || '/', 'https://shipseal.local').searchParams.get('returnTo') || '/');
  const state = createOAuthState(res, req, returnTo);
  const params = new URLSearchParams({ client_id: settings.clientId, redirect_uri: settings.callbackUrl, state, scope: 'read:user user:email' });
  res.statusCode = 302;
  res.setHeader('Location', `https://github.com/login/oauth/authorize?${params}`);
  res.end();
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { consumeOAuthState, createAccountSession, revokeAccountSession } from '../../_lib/accountSession.js';
import { getAccountPersistenceStore } from '../../_lib/accountPersistence.js';
import { AuthConfigurationError, getAccountOAuthConfig, safeAuthDiagnostic } from '../../_lib/authConfig.js';

interface GitHubUser { id?: number; login?: string; name?: string | null; email?: string | null; avatar_url?: string | null }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', 'https://shipseal.local');
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const consumed = consumeOAuthState(req, res, state);
    if (!consumed.valid || !code) throw new Error('OAuth state is invalid or expired.');
    const config = getAccountOAuthConfig();
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callbackUrl, code }),
    });
    const tokenBody = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !tokenBody.access_token) throw new Error('GitHub identity could not be verified.');
    const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: 'application/vnd.github+json' } });
    const githubUser = await userResponse.json() as GitHubUser;
    if (!userResponse.ok || !githubUser.id || !githubUser.login) throw new Error('GitHub identity could not be loaded.');
    const store = getAccountPersistenceStore();
    const user = await store.upsertOAuthUser({
      providerSubject: String(githubUser.id), email: githubUser.email || null,
      displayName: githubUser.name || githubUser.login, avatarUrl: githubUser.avatar_url || null,
    });
    await revokeAccountSession(req, res, store);
    await createAccountSession(req, res, user.id, store);
    res.statusCode = 302;
    res.setHeader('Location', consumed.returnTo);
    res.end();
  } catch (error) {
    console.error('[shipseal-account-callback]', safeAuthDiagnostic(error));
    res.statusCode = 302;
    res.setHeader('Location', error instanceof AuthConfigurationError
      ? '/?accountError=sign-in-unavailable'
      : '/?accountError=sign-in-failed');
    res.end();
  }
}

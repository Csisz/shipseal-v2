import type { PersistedUser, PersistenceApiErrorCode } from './schema';

function isUser(value: unknown): value is PersistedUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(user.id)
    && (user.email === null || typeof user.email === 'string')
    && (user.displayName === null || typeof user.displayName === 'string')
    && (user.avatarUrl === null || typeof user.avatarUrl === 'string');
}

async function sessionRequest(path: string, init?: RequestInit) {
  let response: Response;
  try { response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
  catch { throw new Error('account_unavailable'); }
  const body = await response.json().catch(() => null) as { user?: unknown; error?: { code?: PersistenceApiErrorCode } } | null;
  if (!response.ok) throw new Error(body?.error?.code || 'account_unavailable');
  return body;
}

export async function getCurrentUserSession(): Promise<PersistedUser | null> {
  const body = await sessionRequest('/api/account/session');
  if (body?.user === null || body?.user === undefined) return null;
  if (!isUser(body.user)) throw new Error('invalid_account_response');
  return body.user;
}

export async function logoutCurrentUserSession() {
  await sessionRequest('/api/account/logout', { method: 'POST', body: '{}' });
}

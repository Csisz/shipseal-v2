import type { PersistedUser, PersistenceApiErrorCode } from './schema';
import { isAccountAiUsageSummary, type AccountAiUsageSummary } from '../entitlements/contract';
import { isProductModeSnapshot, STANDARD_PRODUCT_MODE, type ProductModeSnapshot } from '../productMode';

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
  const body = await response.json().catch(() => null) as { user?: unknown; productMode?: unknown; error?: { code?: PersistenceApiErrorCode } } | null;
  if (!response.ok) throw new Error(body?.error?.code || 'account_unavailable');
  return body;
}

export async function getCurrentUserSession(): Promise<PersistedUser | null> {
  return (await getCurrentAccountSession()).user;
}

export async function getCurrentAccountSession(): Promise<{ user: PersistedUser | null; productMode: ProductModeSnapshot }> {
  const body = await sessionRequest('/api/account/session');
  const productMode = body?.productMode === undefined ? STANDARD_PRODUCT_MODE : body.productMode;
  if (!isProductModeSnapshot(productMode)) throw new Error('invalid_product_mode_response');
  const user = body?.user === null || body?.user === undefined
    ? null
    : isUser(body.user) ? body.user : null;
  if (body?.user !== null && body?.user !== undefined && !user) throw new Error('invalid_account_response');
  return { user, productMode };
}

export async function logoutCurrentUserSession() {
  await sessionRequest('/api/account/logout', { method: 'POST', body: '{}' });
}

export async function getCurrentUserAiUsage(): Promise<AccountAiUsageSummary> {
  const body = await sessionRequest('/api/account/usage');
  if (!isAccountAiUsageSummary(body)) throw new Error('invalid_usage_response');
  return body;
}

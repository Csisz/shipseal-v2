import type { IncomingMessage } from 'node:http';
import type { SessionRecord } from './accountPersistence.js';

export function adminUserIds(env: NodeJS.ProcessEnv = process.env) {
  return new Set((env.SHIPSEAL_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean));
}
export function isAdminSession(session: SessionRecord | null, env: NodeJS.ProcessEnv = process.env) {
  return Boolean(session?.user.id && adminUserIds(env).has(session.user.id));
}
export function supportLookup(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'https://shipseal.local');
  return url.searchParams.get('q')?.trim().slice(0, 160) || '';
}

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAccountPersistenceStore, type AccountPersistenceStore, type SessionRecord } from './accountPersistence.js';

export const ACCOUNT_SESSION_COOKIE = '__Host-shipseal_session';
export const ACCOUNT_OAUTH_STATE_COOKIE = '__Host-shipseal_oauth_state';
export const ACCOUNT_RETURN_COOKIE = '__Host-shipseal_auth_return';
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const OAUTH_STATE_SECONDS = 60 * 10;

function cookies(req: IncomingMessage) {
  const result = new Map<string, string>();
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { result.set(name, decodeURIComponent(value)); } catch { /* Ignore malformed cookies. */ }
  }
  return result;
}

function cookie(name: string, value: string, options: { maxAge: number; production: boolean }) {
  const secure = options.production ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${options.maxAge}${secure}`;
}

export function isProductionRequest(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env) {
  const forwarded = Array.isArray(req.headers['x-forwarded-proto']) ? req.headers['x-forwarded-proto'][0] : req.headers['x-forwarded-proto'];
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production' || forwarded === 'https';
}

export function appendSetCookies(res: ServerResponse, values: string[]) {
  const existing = res.getHeader('Set-Cookie');
  const prior = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...prior, ...values]);
}

export function createOAuthState(res: ServerResponse, req: IncomingMessage, returnTo: string) {
  const state = randomBytes(24).toString('base64url');
  const production = isProductionRequest(req);
  appendSetCookies(res, [
    cookie(ACCOUNT_OAUTH_STATE_COOKIE, state, { maxAge: OAUTH_STATE_SECONDS, production }),
    cookie(ACCOUNT_RETURN_COOKIE, safeReturnPath(returnTo), { maxAge: OAUTH_STATE_SECONDS, production }),
  ]);
  return state;
}

export function consumeOAuthState(req: IncomingMessage, res: ServerResponse, receivedState: string) {
  const stored = cookies(req).get(ACCOUNT_OAUTH_STATE_COOKIE) || '';
  const valid = stored.length === receivedState.length && stored.length >= 20 && timingSafeEqual(Buffer.from(stored), Buffer.from(receivedState));
  const production = isProductionRequest(req);
  appendSetCookies(res, [
    cookie(ACCOUNT_OAUTH_STATE_COOKIE, '', { maxAge: 0, production }),
    cookie(ACCOUNT_RETURN_COOKIE, '', { maxAge: 0, production }),
  ]);
  return { valid, returnTo: safeReturnPath(cookies(req).get(ACCOUNT_RETURN_COOKIE) || '/') };
}

export function safeReturnPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\0') || value.length > 500) return '/';
  return value;
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createAccountSession(req: IncomingMessage, res: ServerResponse, userId: string, store: AccountPersistenceStore = getAccountPersistenceStore()) {
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
  await store.createSession({ userId, tokenHash: hashSessionToken(token), createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
  appendSetCookies(res, [cookie(ACCOUNT_SESSION_COOKIE, token, { maxAge: SESSION_SECONDS, production: isProductionRequest(req) })]);
}

export async function readAccountSession(req: IncomingMessage, store: AccountPersistenceStore = getAccountPersistenceStore()): Promise<SessionRecord | null> {
  const token = cookies(req).get(ACCOUNT_SESSION_COOKIE);
  if (!token || token.length < 32 || token.length > 100) return null;
  return store.getSession(hashSessionToken(token), new Date().toISOString());
}

export async function revokeAccountSession(req: IncomingMessage, res: ServerResponse, store: AccountPersistenceStore = getAccountPersistenceStore()) {
  const token = cookies(req).get(ACCOUNT_SESSION_COOKIE);
  if (token) await store.revokeSession(hashSessionToken(token));
  appendSetCookies(res, [cookie(ACCOUNT_SESSION_COOKIE, '', { maxAge: 0, production: isProductionRequest(req) })]);
}

export function sessionCookieValue(req: IncomingMessage) {
  return cookies(req).get(ACCOUNT_SESSION_COOKIE) || null;
}


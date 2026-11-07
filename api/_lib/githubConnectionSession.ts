import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GitHubAppInstallationSummary } from './githubAppTypes.js';

const CONNECTION_SECONDS = 60 * 60 * 8;
const STATE_SECONDS = 60 * 10;
const COOKIE_VERSION = 1;
const MAX_INSTALLATIONS = 100;

type FlowStateKind = 'oauth' | 'setup';

interface GitHubConnectionPayload {
  v: typeof COOKIE_VERSION;
  sessionId?: string;
  githubUserId: string;
  githubLogin: string;
  installations: Array<[string, string, string?]>;
  selectedInstallationId?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface GitHubConnectionSession {
  sessionId: string;
  githubUserId: string;
  githubLogin: string;
  installations: Array<{ id: string; accountLogin: string; accountType?: string }>;
  selectedInstallationId?: string;
  expiresAt: string;
}

export class GitHubConnectionSessionError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: 'github_session_expired' | 'installation_not_authorized',
    message: string,
  ) {
    super(message);
    this.name = 'GitHubConnectionSessionError';
  }
}

function clean(value: string | undefined) {
  return (value || '').trim();
}

function isSecureRequest(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env) {
  const forwardedValue = req.headers?.['x-forwarded-proto'];
  const forwarded = Array.isArray(forwardedValue) ? forwardedValue[0] : forwardedValue;
  return env.VERCEL === '1'
    || env.VERCEL_ENV === 'production'
    || env.VERCEL_ENV === 'preview'
    || env.NODE_ENV === 'production'
    || (forwarded || '').split(',')[0].trim() === 'https';
}

function cookieNames(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env) {
  const prefix = isSecureRequest(req, env) ? '__Host-' : '';
  return {
    connection: `${prefix}shipseal_github_connection`,
    oauthState: `${prefix}shipseal_github_oauth_state`,
    setupState: `${prefix}shipseal_github_setup_state`,
    userToken: `${prefix}shipseal_github_user_token`,
  };
}

function readCookies(req: IncomingMessage) {
  const result = new Map<string, string>();
  for (const part of (req.headers?.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { result.set(name, decodeURIComponent(value)); } catch { /* Ignore malformed cookies. */ }
  }
  return result;
}

function serializeCookie(req: IncomingMessage, name: string, value: string, maxAge: number, env: NodeJS.ProcessEnv = process.env) {
  const secure = isSecureRequest(req, env) ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function appendCookie(res: ServerResponse, value: string) {
  const existing = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : undefined;
  const prior = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...prior, value]);
}

function signingSecret(env: NodeJS.ProcessEnv = process.env) {
  const value = clean(env.GITHUB_CONNECTION_SESSION_SECRET) || clean(env.GITHUB_APP_CLIENT_SECRET);
  if (!value) throw new Error('GitHub connection session signing is not configured.');
  return value;
}

function sign(value: string, env: NodeJS.ProcessEnv = process.env) {
  return createHmac('sha256', `shipseal-github-connection-v1\0${signingSecret(env)}`).update(value).digest('base64url');
}

function tokenEncryptionKey(env: NodeJS.ProcessEnv = process.env) {
  return createHmac('sha256', `shipseal-github-user-token-v1\0${signingSecret(env)}`).update('encryption-key').digest();
}

export function writePendingGitHubUserToken(
  req: IncomingMessage,
  res: ServerResponse,
  input: { githubUserId: string; token: string; apiBaseUrl: string },
  options: { env?: NodeJS.ProcessEnv; now?: () => Date } = {},
) {
  const env = options.env || process.env;
  const now = Math.floor((options.now?.() || new Date()).getTime() / 1000);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenEncryptionKey(env), iv);
  const plaintext = JSON.stringify({ v: 1, u: input.githubUserId, t: input.token, a: input.apiBaseUrl, e: now + CONNECTION_SECONDS });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const value = `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  appendCookie(res, serializeCookie(req, cookieNames(req, env).userToken, value, CONNECTION_SECONDS, env));
}

export function readPendingGitHubUserToken(
  req: IncomingMessage,
  options: { env?: NodeJS.ProcessEnv; now?: () => Date } = {},
): { githubUserId: string; token: string; apiBaseUrl: string } | null {
  const env = options.env || process.env;
  const value = readCookies(req).get(cookieNames(req, env).userToken) || '';
  const [ivValue, tagValue, encryptedValue, extra] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue || extra) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', tokenEncryptionKey(env), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext) as { v?: number; u?: string; t?: string; a?: string; e?: number };
    const now = Math.floor((options.now?.() || new Date()).getTime() / 1000);
    if (parsed.v !== 1 || !parsed.u || !parsed.t || !parsed.a || typeof parsed.e !== 'number' || parsed.e <= now) return null;
    return { githubUserId: parsed.u, token: parsed.t, apiBaseUrl: parsed.a };
  } catch {
    return null;
  }
}

function encodePayload(payload: GitHubConnectionPayload, env: NodeJS.ProcessEnv = process.env) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, env)}`;
}

function decodePayload(value: string, env: NodeJS.ProcessEnv = process.env): GitHubConnectionPayload | null {
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra) return null;
  const expected = sign(body, env);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<GitHubConnectionPayload>;
    if (parsed.v !== COOKIE_VERSION
      || typeof parsed.githubUserId !== 'string'
      || typeof parsed.githubLogin !== 'string'
      || !Array.isArray(parsed.installations)
      || typeof parsed.issuedAt !== 'number'
      || typeof parsed.expiresAt !== 'number') return null;
    return parsed as GitHubConnectionPayload;
  } catch {
    return null;
  }
}

function toPublicSession(payload: GitHubConnectionPayload): GitHubConnectionSession {
  return {
    sessionId: payload.sessionId || '',
    githubUserId: payload.githubUserId,
    githubLogin: payload.githubLogin,
    installations: payload.installations.map(([id, accountLogin, accountType]) => ({
      id,
      accountLogin,
      ...(accountType ? { accountType } : {}),
    })),
    selectedInstallationId: payload.selectedInstallationId,
    expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
  };
}

function stateCookieName(req: IncomingMessage, kind: FlowStateKind, env: NodeJS.ProcessEnv = process.env) {
  const names = cookieNames(req, env);
  return kind === 'oauth' ? names.oauthState : names.setupState;
}

export function createGitHubFlowState(
  req: IncomingMessage,
  res: ServerResponse,
  kind: FlowStateKind,
  env: NodeJS.ProcessEnv = process.env,
) {
  const state = randomBytes(32).toString('base64url');
  const name = stateCookieName(req, kind, env);
  appendCookie(res, serializeCookie(req, name, state, STATE_SECONDS, env));
  return state;
}

export function consumeGitHubFlowState(
  req: IncomingMessage,
  res: ServerResponse,
  kind: FlowStateKind,
  receivedState: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const name = stateCookieName(req, kind, env);
  const storedState = readCookies(req).get(name) || '';
  appendCookie(res, serializeCookie(req, name, '', 0, env));
  return storedState.length === receivedState.length
    && storedState.length >= 32
    && timingSafeEqual(Buffer.from(storedState), Buffer.from(receivedState));
}

export function clearGitHubConnectionSession(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv = process.env,
) {
  const names = cookieNames(req, env);
  appendCookie(res, serializeCookie(req, names.connection, '', 0, env));
  appendCookie(res, serializeCookie(req, names.userToken, '', 0, env));
  appendCookie(res, serializeCookie(req, names.oauthState, '', 0, env));
  appendCookie(res, serializeCookie(req, names.setupState, '', 0, env));
}

export function writeGitHubConnectionSession(
  req: IncomingMessage,
  res: ServerResponse,
  input: {
    githubUserId: string;
    githubLogin: string;
    installations: Array<GitHubAppInstallationSummary | { id: string; accountLogin: string; accountType?: string }>;
    selectedInstallationId?: string;
  },
  options: { env?: NodeJS.ProcessEnv; now?: () => Date } = {},
) {
  const env = options.env || process.env;
  const now = Math.floor((options.now?.() || new Date()).getTime() / 1000);
  const installations = input.installations
    .slice(0, MAX_INSTALLATIONS)
    .map(installation => [String(installation.id), installation.accountLogin, installation.accountType] as [string, string, string?]);
  const allowed = new Set(installations.map(([id]) => id));
  const selectedInstallationId = input.selectedInstallationId && allowed.has(input.selectedInstallationId)
    ? input.selectedInstallationId
    : undefined;
  const payload: GitHubConnectionPayload = {
    v: COOKIE_VERSION,
    sessionId: randomBytes(16).toString('base64url'),
    githubUserId: input.githubUserId,
    githubLogin: input.githubLogin,
    installations,
    ...(selectedInstallationId ? { selectedInstallationId } : {}),
    issuedAt: now,
    expiresAt: now + CONNECTION_SECONDS,
  };
  const encoded = encodePayload(payload, env);
  if (encoded.length > 3_800) {
    payload.installations = installations.map(([id]) => [id, '']);
  }
  appendCookie(res, serializeCookie(req, cookieNames(req, env).connection, encodePayload(payload, env), CONNECTION_SECONDS, env));
  return toPublicSession(payload);
}

export function readGitHubConnectionSession(
  req: IncomingMessage,
  options: { env?: NodeJS.ProcessEnv; now?: () => Date } = {},
): GitHubConnectionSession | null {
  const env = options.env || process.env;
  const value = readCookies(req).get(cookieNames(req, env).connection) || '';
  if (!value) return null;
  const payload = decodePayload(value, env);
  if (!payload) return null;
  const now = Math.floor((options.now?.() || new Date()).getTime() / 1000);
  if (payload.expiresAt <= now || payload.issuedAt > now + 60) return null;
  return toPublicSession(payload);
}

export function requireGitHubConnectionSession(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env) {
  const session = readGitHubConnectionSession(req, { env });
  if (!session) {
    throw new GitHubConnectionSessionError(401, 'github_session_expired', 'GitHub connection expired. Reconnect GitHub.');
  }
  return session;
}

export function requireAuthorizedGitHubInstallation(
  req: IncomingMessage,
  installationId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const session = requireGitHubConnectionSession(req, env);
  if (!session.installations.some(installation => installation.id === installationId)) {
    throw new GitHubConnectionSessionError(403, 'installation_not_authorized', 'This GitHub App installation is not authorized for the connected account.');
  }
  return session;
}

export function selectGitHubInstallation(
  req: IncomingMessage,
  res: ServerResponse,
  installationId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const session = requireAuthorizedGitHubInstallation(req, installationId, env);
  return writeGitHubConnectionSession(req, res, {
    githubUserId: session.githubUserId,
    githubLogin: session.githubLogin,
    installations: session.installations,
    selectedInstallationId: installationId,
  }, { env });
}

export function addAuthorizedGitHubInstallation(
  req: IncomingMessage,
  res: ServerResponse,
  installation: GitHubAppInstallationSummary,
  env: NodeJS.ProcessEnv = process.env,
) {
  const session = requireGitHubConnectionSession(req, env);
  const installations = [
    ...session.installations.filter(candidate => candidate.id !== String(installation.id)),
    { ...installation, id: String(installation.id) },
  ];
  return writeGitHubConnectionSession(req, res, {
    githubUserId: session.githubUserId,
    githubLogin: session.githubLogin,
    installations,
    selectedInstallationId: String(installation.id),
  }, { env });
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { PersistenceConflictError, PersistenceUnavailableError, getAccountPersistenceStore, type AccountPersistenceStore } from './accountPersistence.js';
import { readAccountSession } from './accountSession.js';

export type VercelAccountRequest = IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined> };

export function sendAccountJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendAccountError(res: ServerResponse, status: number, code: string, message: string) {
  sendAccountJson(res, status, { error: { code, message } });
}

export async function readJsonBody(req: VercelAccountRequest, maxBytes = 5_000_000): Promise<unknown> {
  if (req.body !== undefined) {
    const length = Buffer.byteLength(JSON.stringify(req.body));
    if (length > maxBytes) throw new AccountRequestError(413, 'invalid_request', 'Request body is too large.');
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new AccountRequestError(413, 'invalid_request', 'Request body is too large.');
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new AccountRequestError(400, 'invalid_request', 'Request body must be valid JSON.'); }
}

export function queryValue(req: VercelAccountRequest, name: string) {
  const value = req.query?.[name];
  if (Array.isArray(value)) return value[0];
  if (value !== undefined) return value;
  return new URL(req.url || '/', 'https://shipseal.local').searchParams.get(name) || undefined;
}

export function boundedPagination(req: VercelAccountRequest, defaultLimit = 25) {
  const limit = Math.min(50, Math.max(1, Number(queryValue(req, 'limit') || defaultLimit) || defaultLimit));
  const offset = Math.min(10_000, Math.max(0, Number(queryValue(req, 'offset') || 0) || 0));
  return { limit, offset };
}

export class AccountRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'AccountRequestError'; }
}

export async function requireAccount(req: IncomingMessage, store: AccountPersistenceStore = getAccountPersistenceStore()) {
  const session = await readAccountSession(req, store);
  if (!session) throw new AccountRequestError(401, 'authentication_required', 'Sign in to access saved projects.');
  return session;
}

export function handleAccountRouteError(res: ServerResponse, error: unknown) {
  if (error instanceof AccountRequestError) return sendAccountError(res, error.status, error.code, error.message);
  if (error instanceof z.ZodError) return sendAccountError(res, 400, 'invalid_request', 'The persistence request is invalid.');
  if (error instanceof PersistenceConflictError) return sendAccountError(res, 409, 'conflict', error.message);
  if (error instanceof PersistenceUnavailableError) return sendAccountError(res, 503, 'unavailable', 'Saved projects are temporarily unavailable.');
  return sendAccountError(res, 500, 'unknown_error', 'The persistence request could not be completed.');
}


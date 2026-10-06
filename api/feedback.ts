import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { readJsonBody, sendAccountError, sendAccountJson, type VercelAccountRequest } from './_lib/accountHttp.js';
import { readAccountSession } from './_lib/accountSession.js';
import { PersistenceUnavailableError } from './_lib/accountPersistence.js';
import { feedbackRequestSchema, getProductFeedbackStore, type FeedbackRequest } from './_lib/productFeedback.js';

type RateEntry = { count: number; resetAt: number };
const rateEntries = new Map<string, RateEntry>();
const rateSalt = randomBytes(24).toString('base64url');
const RATE_WINDOW_MS = 10 * 60 * 1000;

function ephemeralRateKey(req: IncomingMessage, userId: string | null) {
  if (userId) return `user:${userId}`;
  const forwarded = Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for'];
  const address = String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return `anonymous:${createHash('sha256').update(`${rateSalt}:${address}`).digest('hex')}`;
}

function rateLimited(key: string, authenticated: boolean, now = Date.now()) {
  const limit = authenticated ? 30 : 10;
  const current = rateEntries.get(key);
  if (!current || current.resetAt <= now) {
    rateEntries.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  if (req.method !== 'POST') return sendAccountError(res, 405, 'method_not_allowed', 'Use POST.');
  try {
    const session = await readAccountSession(req).catch(() => null);
    const userId = session?.user.id || null;
    if (rateLimited(ephemeralRateKey(req, userId), Boolean(userId))) {
      return sendAccountError(res, 429, 'rate_limited', 'Feedback is temporarily limited. Please try again later.');
    }
    const parsed = feedbackRequestSchema.parse(await readJsonBody(req, 8_192)) as FeedbackRequest;
    const body: FeedbackRequest = userId || parsed.kind === 'signal'
      ? parsed
      : { ...parsed, contactAllowed: false, projectId: null, scanId: null };
    const store = getProductFeedbackStore();
    if (body.kind === 'feedback') await store.submit(body, userId);
    else await store.signal(body, userId);
    return sendAccountJson(res, 201, { ok: true });
  } catch (error) {
    if (error instanceof ZodError) return sendAccountError(res, 400, 'invalid_feedback', 'Feedback contains an unsupported or invalid value.');
    if (error instanceof PersistenceUnavailableError) return sendAccountError(res, 503, 'feedback_unavailable', 'Feedback is temporarily unavailable.');
    return sendAccountError(res, 503, 'feedback_unavailable', 'Feedback could not be saved. Please try again.');
  }
}

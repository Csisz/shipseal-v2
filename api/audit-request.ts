import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_REQUEST_SOURCE = 'shipseal-contact-request';

type QueryBody = Record<string, unknown>;
type VercelLikeRequest = IncomingMessage & {
  body?: unknown;
};

export interface AuditRequestPayload {
  name: string;
  company: string;
  email: string;
  phoneOrOtherContact: string;
  projectUrl: string;
  message: string;
  consent: true;
  source: 'shipseal-contact-request';
}

export interface AuditRequestValidationError {
  status: number;
  error: string;
}

export function validateAuditRequestPayload(input: unknown): AuditRequestPayload | AuditRequestValidationError {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 400, error: 'Invalid contact request payload.' };
  }

  const body = input as QueryBody;
  const name = clean(body.name);
  const company = clean(body.company);
  const email = clean(body.email);
  const phoneOrOtherContact = clean(body.phoneOrOtherContact);
  const projectUrl = clean(body.projectUrl);
  const message = clean(body.message);
  const source = clean(body.source) || CONTACT_REQUEST_SOURCE;
  const consent = body.consent === true;
  const website = clean(body.website);

  if (website) {
    return { status: 400, error: 'Invalid contact request payload.' };
  }
  if (!email && !phoneOrOtherContact) {
    return { status: 400, error: 'Email or phone/other contact is required.' };
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { status: 400, error: 'Invalid email address.' };
  }
  if (!message) {
    return { status: 400, error: 'Message or project summary is required.' };
  }
  if (!consent) {
    return { status: 400, error: 'Consent is required.' };
  }

  return {
    name,
    company,
    email,
    phoneOrOtherContact,
    projectUrl,
    message,
    consent: true,
    source: source === CONTACT_REQUEST_SOURCE ? CONTACT_REQUEST_SOURCE : CONTACT_REQUEST_SOURCE,
  };
}

function isValidationError(value: AuditRequestPayload | AuditRequestValidationError): value is AuditRequestValidationError {
  return 'error' in value;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 4000) : '';
}

async function readJsonBody(req: VercelLikeRequest): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    return req.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('payload-too-large');
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new Error('payload-too-large');
  }

  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function forwardAuditRequestToWebhook(payload: AuditRequestPayload, webhookUrl: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, {
      error: error instanceof Error && error.message === 'payload-too-large'
        ? 'Contact request payload is too large.'
        : 'Invalid JSON payload.',
    });
    return;
  }

  const validated = validateAuditRequestPayload(body);
  if (isValidationError(validated)) {
    sendJson(res, validated.status, { error: validated.error });
    return;
  }

  const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
  if (!webhookUrl) {
    sendJson(res, 503, { error: 'Contact form is not configured yet.' });
    return;
  }

  try {
    const forwarded = await forwardAuditRequestToWebhook(validated, webhookUrl);
    if (!forwarded) {
      sendJson(res, 502, { error: 'Contact request webhook did not accept the request.' });
      return;
    }
  } catch {
    sendJson(res, 502, { error: 'Contact request webhook could not be reached.' });
    return;
  }

  sendJson(res, 200, { ok: true });
}

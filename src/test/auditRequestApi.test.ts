import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, {
  forwardAuditRequestToWebhook,
  validateAuditRequestPayload,
} from '../../api/audit-request';

const VALID_PAYLOAD = {
  name: 'Ada',
  company: 'Acme AI',
  email: 'ada@example.com',
  phoneOrOtherContact: '',
  projectUrl: 'https://github.com/acme/support-rag',
  message: 'Please review this AI handoff.',
  consent: true,
  source: 'shipseal-contact-request',
};

function createResponse() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(value: string) {
      this.body = value;
    },
    json() {
      return JSON.parse(this.body);
    },
    headers,
  };
}

describe('audit request API', () => {
  const originalWebhookUrl = process.env.CONTACT_WEBHOOK_URL;

  afterEach(() => {
    if (originalWebhookUrl === undefined) {
      delete process.env.CONTACT_WEBHOOK_URL;
    } else {
      process.env.CONTACT_WEBHOOK_URL = originalWebhookUrl;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects missing contact, missing message, and missing consent', () => {
    expect(validateAuditRequestPayload({ ...VALID_PAYLOAD, email: '', phoneOrOtherContact: '' }))
      .toEqual({ status: 400, error: 'Email or phone/other contact is required.' });
    expect(validateAuditRequestPayload({ ...VALID_PAYLOAD, message: '' }))
      .toEqual({ status: 400, error: 'Message or project summary is required.' });
    expect(validateAuditRequestPayload({ ...VALID_PAYLOAD, consent: false }))
      .toEqual({ status: 400, error: 'Consent is required.' });
  });

  it('returns 503 when CONTACT_WEBHOOK_URL is not configured', async () => {
    delete process.env.CONTACT_WEBHOOK_URL;
    const req = { method: 'POST', body: VALID_PAYLOAD };
    const res = createResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'Contact form is not configured yet.' });
  });

  it('forwards valid payloads to CONTACT_WEBHOOK_URL when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const payload = validateAuditRequestPayload(VALID_PAYLOAD);
    if ('error' in payload) throw new Error(payload.error);

    const forwarded = await forwardAuditRequestToWebhook(payload, 'https://example.com/audit-webhook', fetchMock as never);

    expect(forwarded).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/audit-webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  });

  it('handler forwards through the configured webhook', async () => {
    process.env.CONTACT_WEBHOOK_URL = 'https://example.com/audit-webhook';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const req = { method: 'POST', body: VALID_PAYLOAD };
    const res = createResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/audit-webhook', expect.objectContaining({ method: 'POST' }));
  });
});

import type { ServerResponse } from 'node:http';
import { sendAccountError, sendAccountJson, type VercelAccountRequest } from '../../_lib/accountHttp.js';
import { BillingRequestError, BillingService, isBillingConfigurationError, readRawBillingBody } from '../../_lib/stripeBilling.js';

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    const signatureHeader = req.headers['stripe-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) return sendAccountError(res, 400, 'invalid_signature', 'Stripe webhook signature is required.');
    const result = await new BillingService().handleWebhook(await readRawBillingBody(req), signature);
    sendAccountJson(res, 200, { received: true, state: result.state });
  } catch (error) {
    if (error instanceof BillingRequestError) return sendAccountError(res, error.status, error.code, error.message);
    if (isBillingConfigurationError(error)) return sendAccountError(res, 503, 'billing_not_configured', 'Billing is not configured for this deployment.');
    sendAccountError(res, 503, 'billing_sync_unavailable', 'Stripe billing state could not be synchronized yet.');
  }
}

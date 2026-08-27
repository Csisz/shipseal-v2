import type { ServerResponse } from 'node:http';
import { z } from 'zod';
import { getAccountPersistenceStore } from '../../_lib/accountPersistence.js';
import { handleAccountRouteError, readJsonBody, requireAccount, sendAccountError, sendAccountJson, type VercelAccountRequest } from '../../_lib/accountHttp.js';
import { BillingRequestError, BillingService, isBillingConfigurationError } from '../../_lib/stripeBilling.js';

const portalSchema = z.object({
  returnTo: z.string().min(1).max(500),
  portalAttemptId: z.string().uuid(),
}).strict();

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    const session = await requireAccount(req, getAccountPersistenceStore());
    const input = portalSchema.parse(await readJsonBody(req, 10_000)) as {
      returnTo: string; portalAttemptId: string;
    };
    sendAccountJson(res, 200, await new BillingService().createPortalSession(session.user, input));
  } catch (error) {
    if (error instanceof BillingRequestError) return sendAccountError(res, error.status, error.code, error.message);
    if (isBillingConfigurationError(error)) return sendAccountError(res, 503, 'billing_not_configured', 'Billing is not configured for this deployment.');
    handleAccountRouteError(res, error);
  }
}

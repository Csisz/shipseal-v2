import type { ServerResponse } from 'node:http';
import { z } from 'zod';
import { getAccountPersistenceStore } from '../../_lib/accountPersistence.js';
import { AccountRequestError, handleAccountRouteError, readJsonBody, requireAccount, sendAccountJson, type VercelAccountRequest } from '../../_lib/accountHttp.js';
import { revokeAccountSession } from '../../_lib/accountSession.js';
import { getBillingPersistenceStore } from '../../_lib/billingPersistence.js';

const bodySchema = z.object({ confirmation: z.literal('DELETE MY SHIPSEAL ACCOUNT') }).strict();

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    const store = getAccountPersistenceStore();
    const session = await requireAccount(req, store);
    bodySchema.parse(await readJsonBody(req, 1_000));
    const billingStore = getBillingPersistenceStore();
    const billing = await billingStore.getAccountBillingSummary(session.user.id);
    if (billing.stripeStatus && ['active', 'trialing', 'past_due'].includes(billing.stripeStatus)) {
      throw new AccountRequestError(409, 'billing_subscription_active', 'Manage and end the Stripe subscription before deleting this ShipSeal account.');
    }
    await billingStore.deleteBillingProfile(session.user.id);
    await store.deleteAccount(session.user.id);
    await revokeAccountSession(req, res, store);
    sendAccountJson(res, 200, { ok: true });
  } catch (error) { handleAccountRouteError(res, error); }
}

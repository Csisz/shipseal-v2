import type { ServerResponse } from 'node:http';
import { z } from 'zod';
import { getAccountPersistenceStore } from '../_lib/accountPersistence.js';
import { handleAccountRouteError, readJsonBody, requireAccount, sendAccountJson, type VercelAccountRequest } from '../_lib/accountHttp.js';
import { revokeAccountSession } from '../_lib/accountSession.js';

const bodySchema = z.object({ confirmation: z.literal('DELETE MY SHIPSEAL ACCOUNT') }).strict();

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    const store = getAccountPersistenceStore();
    const session = await requireAccount(req, store);
    bodySchema.parse(await readJsonBody(req, 1_000));
    await store.deleteAccount(session.user.id);
    await revokeAccountSession(req, res, store);
    sendAccountJson(res, 200, { ok: true });
  } catch (error) { handleAccountRouteError(res, error); }
}

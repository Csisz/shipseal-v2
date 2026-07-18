import type { ServerResponse } from 'node:http';
import { getAccountPersistenceStore } from '../../_lib/accountPersistence.js';
import { AccountRequestError, handleAccountRouteError, queryValue, requireAccount, sendAccountJson, type VercelAccountRequest } from '../../_lib/accountHttp.js';

function scanId(req: VercelAccountRequest) {
  const direct = queryValue(req, 'scanId');
  const value = direct || new URL(req.url || '/', 'https://shipseal.local').pathname.split('/').filter(Boolean).at(-1) || '';
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(value)) throw new AccountRequestError(404, 'not_found', 'Saved scan was not found.');
  return value;
}

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    const store = getAccountPersistenceStore();
    const session = await requireAccount(req, store);
    const id = scanId(req);
    if (req.method === 'GET' || !req.method) {
      const saved = await store.getScan(session.user.id, id);
      if (!saved) throw new AccountRequestError(404, 'not_found', 'Saved scan was not found.');
      sendAccountJson(res, 200, saved);
      return;
    }
    if (req.method === 'DELETE') {
      if (!await store.deleteScan(session.user.id, id)) throw new AccountRequestError(404, 'not_found', 'Saved scan was not found.');
      sendAccountJson(res, 200, { ok: true });
      return;
    }
    res.statusCode = 405; res.end();
  } catch (error) { handleAccountRouteError(res, error); }
}

import type { ServerResponse } from 'node:http';
import { getAccountPersistenceStore } from '../_lib/accountPersistence.js';
import { AccountRequestError, handleAccountRouteError, queryValue, requireAccount, sendAccountJson, type VercelAccountRequest } from '../_lib/accountHttp.js';
import { readJsonBody } from '../_lib/accountHttp.js';
import { z } from 'zod';

const updateSchema = z.object({ displayName: z.string().trim().min(1).max(200).optional(), defaultBranch: z.string().trim().max(250).nullable().optional(), archived: z.boolean().optional() }).strict().refine(value => Object.keys(value).length > 0);

function projectId(req: VercelAccountRequest) {
  const direct = queryValue(req, 'projectId');
  const value = direct || new URL(req.url || '/', 'https://shipseal.local').pathname.split('/').filter(Boolean).at(-1) || '';
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(value)) throw new AccountRequestError(404, 'not_found', 'Saved project was not found.');
  return value;
}

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    const store = getAccountPersistenceStore();
    const session = await requireAccount(req, store);
    const id = projectId(req);
    if (req.method === 'GET' || !req.method) {
      const project = await store.getProject(session.user.id, id);
      if (!project) throw new AccountRequestError(404, 'not_found', 'Saved project was not found.');
      const scanLimit = Math.min(50, Math.max(1, Number(queryValue(req, 'scanLimit') || 25) || 25));
      const scans = await store.listScans(session.user.id, id, scanLimit, 0);
      sendAccountJson(res, 200, { project, scans });
      return;
    }
    if (req.method === 'DELETE') {
      if (!await store.deleteProject(session.user.id, id)) throw new AccountRequestError(404, 'not_found', 'Saved project was not found.');
      sendAccountJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'PATCH') {
      const updated = await store.updateProject(session.user.id, id, updateSchema.parse(await readJsonBody(req, 5_000)));
      if (!updated) throw new AccountRequestError(404, 'not_found', 'Saved project was not found.');
      sendAccountJson(res, 200, { project: updated });
      return;
    }
    res.statusCode = 405; res.end();
  } catch (error) { handleAccountRouteError(res, error); }
}

import type { ServerResponse } from 'node:http';
import { getAccountPersistenceStore } from '../_lib/accountPersistence.js';
import { boundedPagination, handleAccountRouteError, readJsonBody, requireAccount, sendAccountJson, type VercelAccountRequest } from '../_lib/accountHttp.js';
import { saveProjectRequestSchema } from '../../src/lib/persistence/schema.js';

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    const store = getAccountPersistenceStore();
    const session = await requireAccount(req, store);
    if (req.method === 'GET' || !req.method) {
      const { limit, offset } = boundedPagination(req);
      sendAccountJson(res, 200, { projects: await store.listProjects(session.user.id, limit, offset) });
      return;
    }
    if (req.method === 'POST') {
      const input = saveProjectRequestSchema.parse(await readJsonBody(req));
      const saved = await store.saveProjectAndScan(session.user.id, input);
      sendAccountJson(res, 201, saved);
      return;
    }
    res.statusCode = 405; res.end();
  } catch (error) { handleAccountRouteError(res, error); }
}


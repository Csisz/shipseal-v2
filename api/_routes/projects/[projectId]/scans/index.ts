import type { ServerResponse } from 'node:http';
import { getAccountPersistenceStore } from '../../../../_lib/accountPersistence.js';
import { AccountRequestError, boundedPagination, handleAccountRouteError, queryValue, readJsonBody, requireAccount, sendAccountJson, type VercelAccountRequest } from '../../../../_lib/accountHttp.js';
import { saveProjectRequestSchema } from '../../../../../src/lib/persistence/schema.js';

function projectId(req: VercelAccountRequest) {
  const value = queryValue(req, 'projectId') || new URL(req.url || '/', 'https://shipseal.local').pathname.split('/').filter(Boolean).at(-3) || '';
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(value)) throw new AccountRequestError(404, 'not_found', 'Saved project was not found.');
  return value;
}

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    const store = getAccountPersistenceStore();
    const session = await requireAccount(req, store);
    const id = projectId(req);
    const project = await store.getProject(session.user.id, id);
    if (!project) throw new AccountRequestError(404, 'not_found', 'Saved project was not found.');
    if (req.method === 'GET' || !req.method) {
      const { limit, offset } = boundedPagination(req);
      sendAccountJson(res, 200, { scans: await store.listScans(session.user.id, id, limit, offset) });
      return;
    }
    if (req.method === 'POST') {
      const input = saveProjectRequestSchema.parse(await readJsonBody(req));
      input.project = {
        sourceType: project.sourceType, repositoryOwner: project.repositoryOwner, repositoryName: project.repositoryName,
        uploadLabel: project.uploadLabel, defaultBranch: project.defaultBranch, githubRepositoryId: project.githubRepositoryId,
        githubInstallationId: project.githubInstallationId, displayName: project.displayName,
      };
      const saved = await store.saveProjectAndScan(session.user.id, input);
      if (saved.project.id !== id) throw new AccountRequestError(409, 'conflict', 'Scan repository identity does not match the saved project.');
      sendAccountJson(res, 201, { scan: saved.scan });
      return;
    }
    res.statusCode = 405; res.end();
  } catch (error) { handleAccountRouteError(res, error); }
}

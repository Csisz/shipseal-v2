import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAccountRouteError, sendAccountJson } from '../../_lib/accountHttp.js';
import { revokeAccountSession } from '../../_lib/accountSession.js';
import { clearGitHubConnectionSession } from '../../_lib/githubConnectionSession.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    await revokeAccountSession(req, res);
    clearGitHubConnectionSession(req, res);
    sendAccountJson(res, 200, { ok: true });
  } catch (error) { handleAccountRouteError(res, error); }
}

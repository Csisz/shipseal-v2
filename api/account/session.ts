import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendAccountJson, handleAccountRouteError } from '../_lib/accountHttp.js';
import { readAccountSession } from '../_lib/accountSession.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method && req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
    const session = await readAccountSession(req);
    sendAccountJson(res, 200, { user: session?.user || null });
  } catch (error) { handleAccountRouteError(res, error); }
}


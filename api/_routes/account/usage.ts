import type { ServerResponse } from 'node:http';
import { AiUsageAuthorizationService, AiUsageDeniedError } from '../../_lib/aiUsage.js';
import { getAccountPersistenceStore } from '../../_lib/accountPersistence.js';
import {
  handleAccountRouteError,
  requireAccount,
  sendAccountError,
  sendAccountJson,
  type VercelAccountRequest,
} from '../../_lib/accountHttp.js';

export default async function handler(req: VercelAccountRequest, res: ServerResponse) {
  try {
    if (req.method && req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
    const session = await requireAccount(req, getAccountPersistenceStore());
    const usage = await new AiUsageAuthorizationService().getUsageSummary(session.user.id);
    sendAccountJson(res, 200, { ...usage });
  } catch (error) {
    if (error instanceof AiUsageDeniedError) {
      sendAccountError(res, error.status, error.category, 'AI usage information is temporarily unavailable.');
      return;
    }
    handleAccountRouteError(res, error);
  }
}

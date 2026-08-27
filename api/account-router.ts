import type { IncomingMessage, ServerResponse } from 'node:http';
import { safeAuthDiagnostic } from './_lib/authConfig.js';

type RoutedRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
type AccountHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;
type AccountModule = { default: AccountHandler };

const loaders: Readonly<Record<string, () => Promise<AccountModule>>> = {
  'ai-operation-result': () => import('./_routes/account/ai-operation-result.js'),
  'ai-operation-status': () => import('./_routes/account/ai-operation-status.js'),
  callback: () => import('./_routes/account/callback.js'),
  delete: () => import('./_routes/account/delete.js'),
  login: () => import('./_routes/account/login.js'),
  logout: () => import('./_routes/account/logout.js'),
  session: () => import('./_routes/account/session.js'),
  usage: () => import('./_routes/account/usage.js'),
};

export default async function handler(req: RoutedRequest, res: ServerResponse) {
  const route = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  const load = route ? loaders[route] : undefined;
  if (!load) {
    res.statusCode = 404;
    res.end();
    return;
  }
  try {
    const selected = await load();
    await selected.default(req, res);
  } catch (error) {
    console.error('[shipseal-account-router]', { route, ...safeAuthDiagnostic(error) });
    if (res.headersSent) { res.end(); return; }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { code: 'account_route_unavailable', message: 'This account operation is temporarily unavailable. Anonymous scanning remains available.' } }));
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import callback from './_routes/account/callback.js';
import deleteAccount from './_routes/account/delete.js';
import login from './_routes/account/login.js';
import logout from './_routes/account/logout.js';
import session from './_routes/account/session.js';

type RoutedRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
type AccountHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;

const handlers: Readonly<Record<string, AccountHandler>> = {
  callback,
  delete: deleteAccount,
  login,
  logout,
  session,
};

export default async function handler(req: RoutedRequest, res: ServerResponse) {
  const route = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  const selected = route ? handlers[route] : undefined;
  if (!selected) {
    res.statusCode = 404;
    res.end();
    return;
  }
  await selected(req, res);
}

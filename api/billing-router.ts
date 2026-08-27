import type { IncomingMessage, ServerResponse } from 'node:http';

type RoutedRequest = IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined> };
type BillingHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;
type BillingModule = { default: BillingHandler };

const loaders: Readonly<Record<string, () => Promise<BillingModule>>> = {
  'create-checkout-session': () => import('./_routes/billing/create-checkout-session.js'),
  'create-portal-session': () => import('./_routes/billing/create-portal-session.js'),
  webhook: () => import('./_routes/billing/webhook.js'),
};

export const config = { api: { bodyParser: false } };

export default async function handler(req: RoutedRequest, res: ServerResponse) {
  const route = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  const load = route ? loaders[route] : undefined;
  if (!load) { res.statusCode = 404; res.end(); return; }
  try {
    const selected = await load();
    await selected.default(req, res);
  } catch (error) {
    console.error('[shipseal-billing-router]', {
      route,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message.replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g, '[redacted]') : 'Unknown billing failure',
    });
    if (res.headersSent) { res.end(); return; }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: { code: 'billing_unavailable', message: 'Billing is temporarily unavailable. No access change was made.' } }));
  }
}

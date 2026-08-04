import type { IncomingMessage, ServerResponse } from 'node:http';
import { safeAuthDiagnostic } from './_lib/authConfig.js';

type RoutedRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
type GitHubAppHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;
type GitHubAppModule = { default: GitHubAppHandler };

const loaders: Readonly<Record<string, () => Promise<GitHubAppModule>>> = {
  archive: () => import('./_routes/github-app/archive.js'),
  callback: () => import('./_routes/github-app/callback.js'),
  'create-readiness-pr': () => import('./_routes/github-app/create-readiness-pr.js'),
  'create-repository-intelligence-pr': () => import('./_routes/github-app/create-repository-intelligence-pr.js'),
  'create-optimization-pr': () => import('./_routes/github-app/create-optimization-pr.js'),
  installations: () => import('./_routes/github-app/installations.js'),
  login: () => import('./_routes/github-app/login.js'),
  'oauth-callback': () => import('./_routes/github-app/oauth-callback.js'),
  repositories: () => import('./_routes/github-app/repositories.js'),
  start: () => import('./_routes/github-app/login.js'),
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
    console.error('[shipseal-github-router]', { route, ...safeAuthDiagnostic(error) });
    if (res.headersSent) { res.end(); return; }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { code: 'github_route_unavailable', message: 'GitHub connection is temporarily unavailable. Use ZIP upload or a public repository URL.' } }));
  }
}

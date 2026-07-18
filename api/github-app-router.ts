import type { IncomingMessage, ServerResponse } from 'node:http';
import archive from './_routes/github-app/archive.js';
import callback from './_routes/github-app/callback.js';
import createReadinessPr from './_routes/github-app/create-readiness-pr.js';
import createRepositoryIntelligencePr from './_routes/github-app/create-repository-intelligence-pr.js';
import installations from './_routes/github-app/installations.js';
import login from './_routes/github-app/login.js';
import oauthCallback from './_routes/github-app/oauth-callback.js';
import repositories from './_routes/github-app/repositories.js';

type RoutedRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
type GitHubAppHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;

const handlers: Readonly<Record<string, GitHubAppHandler>> = {
  archive,
  callback,
  'create-readiness-pr': createReadinessPr,
  'create-repository-intelligence-pr': createRepositoryIntelligencePr,
  installations,
  login,
  'oauth-callback': oauthCallback,
  repositories,
  start: login,
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

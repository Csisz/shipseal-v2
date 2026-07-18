import type { IncomingMessage, ServerResponse } from 'node:http';
import project from './_routes/projects/[projectId].js';
import projectScans from './_routes/projects/[projectId]/scans/index.js';
import projects from './_routes/projects/index.js';
import scan from './_routes/scans/[scanId].js';

type RoutedRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown };
type PersistenceHandler = (req: RoutedRequest, res: ServerResponse) => Promise<void>;

const handlers: Readonly<Record<string, PersistenceHandler>> = {
  project,
  'project-scans': projectScans,
  projects,
  scan,
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

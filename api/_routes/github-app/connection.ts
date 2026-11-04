import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  clearGitHubConnectionSession,
  readGitHubConnectionSession,
  selectGitHubInstallation,
  GitHubConnectionSessionError,
  writeGitHubConnectionSession,
} from '../../_lib/githubConnectionSession.js';

type VercelLikeRequest = IncomingMessage & { body?: unknown };

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req: VercelLikeRequest) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.byteLength;
    if (total > 10_000) throw new Error('payload-too-large');
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as unknown;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (!req.method || req.method === 'GET') {
    let session = readGitHubConnectionSession(req);
    if (!session) {
      sendJson(res, 401, {
        status: 'reconnect_required',
        code: 'github_session_expired',
        message: 'GitHub connection expired. Reconnect GitHub.',
      });
      return;
    }
    if (!session.sessionId) {
      session = writeGitHubConnectionSession(req, res, {
        githubUserId: session.githubUserId,
        githubLogin: session.githubLogin,
        installations: session.installations,
        selectedInstallationId: session.selectedInstallationId,
      });
    }
    sendJson(res, 200, { status: 'connected', connection: session });
    return;
  }

  if (req.method === 'DELETE') {
    clearGitHubConnectionSession(req, res);
    sendJson(res, 200, { status: 'disconnected' });
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = await readBody(req) as { installationId?: unknown };
      const installationId = typeof body?.installationId === 'string' ? body.installationId.trim() : '';
      if (!/^\d+$/.test(installationId)) {
        sendJson(res, 400, { status: 'invalid_request', code: 'installation_not_authorized', message: 'Choose a valid GitHub installation.' });
        return;
      }
      const session = selectGitHubInstallation(req, res, installationId);
      sendJson(res, 200, { status: 'connected', connection: session });
    } catch (error) {
      if (error instanceof GitHubConnectionSessionError) {
        sendJson(res, error.status, { status: 'reconnect_required', code: error.code, message: error.message });
        return;
      }
      sendJson(res, 400, { status: 'invalid_request', code: 'invalid_request', message: 'GitHub installation selection was invalid.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  sendJson(res, 405, { status: 'method_not_allowed', message: 'Use GET, POST, or DELETE.' });
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../../_lib/githubAppTypes.js';
import { createGitHubInstallationClient } from '../../_lib/githubAppClient.js';

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

type QueryValue = string | string[] | undefined;
type VercelLikeRequest = IncomingMessage & {
  query?: Record<string, QueryValue>;
};

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function queryFromRequest(req: VercelLikeRequest) {
  if (req.query) return req.query;
  const parsed = new URL(req.url || '/', 'https://shipseal.local');
  return {
    installationId: parsed.searchParams.get('installationId') || undefined,
    owner: parsed.searchParams.get('owner') || undefined,
    repo: parsed.searchParams.get('repo') || undefined,
    ref: parsed.searchParams.get('ref') || undefined,
  };
}

function isSafeRepoPart(value: string) {
  return value.length > 0 && value.length <= 100 && OWNER_REPO_PATTERN.test(value);
}

function isSafeRef(value: string) {
  return value.length > 0 &&
    value.length <= 160 &&
    REF_PATTERN.test(value) &&
    !value.includes('..') &&
    !value.startsWith('/') &&
    !value.endsWith('/');
}

function encodeRef(ref: string) {
  return ref.split('/').map(part => encodeURIComponent(part)).join('/');
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function downloadGitHubAppArchive(input: {
  installationId: string;
  owner: string;
  repo: string;
  ref?: string;
}, options: Parameters<typeof createGitHubInstallationClient>[1] = {}) {
  const client = await createGitHubInstallationClient(input.installationId, options);
  return client.getRaw(`/repos/${input.owner}/${input.repo}/zipball/${encodeRef(input.ref || 'HEAD')}`);
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  const query = queryFromRequest(req);
  const installationId = (firstValue(query.installationId) || '').trim();
  const owner = (firstValue(query.owner) || '').trim();
  const repo = (firstValue(query.repo) || '').trim().replace(/\.git$/i, '');
  const ref = (firstValue(query.ref) || 'HEAD').trim();

  if (!/^[0-9]+$/.test(installationId)) {
    sendJson(res, 400, { status: 'invalid_request', message: 'A valid installationId query parameter is required.' });
    return;
  }
  if (!isSafeRepoPart(owner)) {
    sendJson(res, 400, { status: 'invalid_request', message: 'A valid owner query parameter is required.' });
    return;
  }
  if (!isSafeRepoPart(repo)) {
    sendJson(res, 400, { status: 'invalid_request', message: 'A valid repo query parameter is required.' });
    return;
  }
  if (!isSafeRef(ref)) {
    sendJson(res, 400, { status: 'invalid_request', message: 'A valid ref query parameter is required.' });
    return;
  }

  try {
    const response = await downloadGitHubAppArchive({ installationId, owner, repo, ref });
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > MAX_ARCHIVE_BYTES) {
      sendJson(res, 413, { status: 'too_large', message: 'GitHub repository ZIP is too large for the ShipSeal MVP import limit.' });
      return;
    }
    const archive = Buffer.from(await response.arrayBuffer());
    if (archive.byteLength > MAX_ARCHIVE_BYTES) {
      sendJson(res, 413, { status: 'too_large', message: 'GitHub repository ZIP is too large for the ShipSeal MVP import limit.' });
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${owner}-${repo}-${ref.replace(/[^A-Za-z0-9_.-]+/g, '-')}.zip"`);
    res.setHeader('Content-Length', String(archive.byteLength));
    res.end(archive);
  } catch (error) {
    if (error instanceof GitHubAppNotConfiguredError) {
      sendJson(res, 501, { status: 'not_configured', code: error.code, message: 'GitHub App server credentials are not configured yet.' });
      return;
    }
    sendJson(res, error instanceof GitHubAppApiError && error.status === 404 ? 404 : 502, {
      status: 'github_error',
      code: error instanceof GitHubAppApiError ? error.code : 'github_api_error',
      message: error instanceof Error ? error.message : 'GitHub App archive download failed.',
    });
  }
}

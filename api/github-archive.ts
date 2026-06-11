import type { IncomingMessage, ServerResponse } from 'node:http';

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/;
const MAX_OWNER_REPO_LENGTH = 100;
const MAX_REF_LENGTH = 160;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

export interface GitHubArchiveParams {
  owner: string;
  repo: string;
  ref: string;
}

export interface GitHubArchiveValidationError {
  status: number;
  error: string;
}

type QueryValue = string | string[] | undefined;
type QueryLike = Record<string, QueryValue>;
type VercelLikeRequest = IncomingMessage & {
  query?: QueryLike;
};

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function queryFromRequest(req: VercelLikeRequest): QueryLike {
  if (req.query) return req.query;
  const parsed = new URL(req.url || '/', 'https://shipseal.local');
  return {
    owner: parsed.searchParams.get('owner') || undefined,
    repo: parsed.searchParams.get('repo') || undefined,
    ref: parsed.searchParams.get('ref') || undefined,
  };
}

function isSafeName(value: string) {
  return value.length > 0 && value.length <= MAX_OWNER_REPO_LENGTH && OWNER_REPO_PATTERN.test(value);
}

function isSafeRef(value: string) {
  return (
    value.length > 0 &&
    value.length <= MAX_REF_LENGTH &&
    REF_PATTERN.test(value) &&
    !value.includes('..') &&
    !value.startsWith('/') &&
    !value.endsWith('/')
  );
}

function encodeRef(ref: string) {
  return ref.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function validateGitHubArchiveParams(query: QueryLike): GitHubArchiveParams | GitHubArchiveValidationError {
  const owner = (firstValue(query.owner) || '').trim();
  const repo = (firstValue(query.repo) || '').trim().replace(/\.git$/i, '');
  const ref = (firstValue(query.ref) || 'HEAD').trim();

  if (!isSafeName(owner)) {
    return { status: 400, error: 'Invalid GitHub owner parameter.' };
  }
  if (!isSafeName(repo)) {
    return { status: 400, error: 'Invalid GitHub repo parameter.' };
  }
  if (!isSafeRef(ref)) {
    return { status: 400, error: 'Invalid GitHub ref parameter.' };
  }

  return { owner, repo, ref };
}

export function buildGitHubArchiveUrl(params: GitHubArchiveParams) {
  return `https://codeload.github.com/${params.owner}/${params.repo}/zip/${encodeRef(params.ref)}`;
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function isValidationError(value: GitHubArchiveParams | GitHubArchiveValidationError): value is GitHubArchiveValidationError {
  return 'error' in value;
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed. Use GET.' });
    return;
  }

  const validated = validateGitHubArchiveParams(queryFromRequest(req));
  if (isValidationError(validated)) {
    sendJson(res, validated.status, { error: validated.error });
    return;
  }

  let response: Response;
  try {
    response = await fetch(buildGitHubArchiveUrl(validated), { method: 'GET', redirect: 'follow' });
  } catch {
    sendJson(res, 502, { error: 'GitHub archive download failed. Download the repository as ZIP from GitHub and upload it manually.' });
    return;
  }

  if (!response.ok) {
    const status = response.status === 404 ? 404 : 502;
    sendJson(res, status, {
      error: response.status === 404
        ? 'GitHub repository or ref was not found. Confirm the public repo and branch, or upload the ZIP manually.'
        : 'GitHub archive is unavailable. Upload the repository ZIP manually.',
    });
    return;
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > MAX_ARCHIVE_BYTES) {
    sendJson(res, 413, { error: 'GitHub repository ZIP is too large for the ShipSeal MVP import limit.' });
    return;
  }

  const archive = Buffer.from(await response.arrayBuffer());
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    sendJson(res, 413, { error: 'GitHub repository ZIP is too large for the ShipSeal MVP import limit.' });
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${validated.owner}-${validated.repo}-${validated.ref.replace(/[^A-Za-z0-9_.-]+/g, '-')}.zip"`);
  res.setHeader('Content-Length', String(archive.byteLength));
  res.end(archive);
}

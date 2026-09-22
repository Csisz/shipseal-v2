import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../../_lib/githubAppTypes.js';
import { createGitHubInstallationClient, type GitHubInstallationClient } from '../../_lib/githubAppClient.js';

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const FORBIDDEN_TARGET_BRANCHES = new Set(['main', 'master', 'develop', 'trunk']);
const MAX_FILES = 20;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_BODY_BYTES = 768 * 1024;

interface GitHubAppPrFile {
  path: string;
  content: string;
}

interface GitHubAppPrRequest {
  mode?: 'preview' | 'apply';
  installationId: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName: string;
  prTitle: string;
  prBody: string;
  files: GitHubAppPrFile[];
  confirmed?: boolean;
  expectedBaseSha?: string;
  reviewFingerprint?: string;
}

type VercelLikeRequest = IncomingMessage & {
  body?: unknown;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeRepoPart(value: string) {
  return value.length > 0 && value.length <= 100 && OWNER_REPO_PATTERN.test(value);
}

function isSafeBranch(value: string) {
  return value.length > 0 &&
    value.length <= 160 &&
    BRANCH_PATTERN.test(value) &&
    !value.includes('..') &&
    !value.startsWith('/') &&
    !value.endsWith('/');
}

function isForbiddenBranch(value: string) {
  return FORBIDDEN_TARGET_BRANCHES.has(value.toLowerCase());
}

function isSafeShipSealBranch(value: string) {
  return value.startsWith('shipseal/') && isSafeBranch(value) && !isForbiddenBranch(value);
}

function isSafeRepoPath(value: string) {
  return Boolean(value) &&
    value.length <= 180 &&
    !value.includes('..') &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    /^[A-Za-z0-9._/-]+$/.test(value);
}

function encodeBranch(branch: string) {
  return branch.split('/').map(part => encodeURIComponent(part)).join('/');
}

function timestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
  ].join('');
}

function toBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

async function readJsonBody(req: VercelLikeRequest): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    return req.body;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_BODY_BYTES) throw new Error('payload-too-large');
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function validateGitHubAppPrRequest(input: unknown): GitHubAppPrRequest | { status: number; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { status: 400, error: 'Invalid GitHub App PR payload.' };
  const body = input as Record<string, unknown>;
  const modeValue = clean(body.mode);
  const mode = modeValue === 'preview' || modeValue === 'apply' ? modeValue : undefined;
  const installationId = clean(body.installationId);
  const owner = clean(body.owner);
  const repo = clean(body.repo).replace(/\.git$/i, '');
  const baseBranch = clean(body.baseBranch);
  const branchName = clean(body.branchName) || 'shipseal/readiness-pack';
  const prTitle = clean(body.prTitle);
  const prBody = clean(body.prBody);
  const files = Array.isArray(body.files) ? body.files : [];
  const confirmed = body.confirmed === true;
  const expectedBaseSha = clean(body.expectedBaseSha);
  const reviewFingerprint = clean(body.reviewFingerprint);

  if (modeValue && !mode) return { status: 400, error: 'Invalid Readiness PR operation mode.' };
  if (!/^[0-9]+$/.test(installationId)) return { status: 400, error: 'A valid installationId is required.' };
  if (!isSafeRepoPart(owner)) return { status: 400, error: 'Invalid GitHub owner.' };
  if (!isSafeRepoPart(repo)) return { status: 400, error: 'Invalid GitHub repo.' };
  if (baseBranch && !isSafeBranch(baseBranch)) return { status: 400, error: 'Invalid base branch.' };
  if (!isSafeShipSealBranch(branchName)) return { status: 400, error: 'Target branch must use the shipseal/ prefix and must not be main, master, develop, or trunk.' };
  if (!prTitle) return { status: 400, error: 'Pull request title is required.' };
  if (!prBody) return { status: 400, error: 'Pull request summary is required.' };
  if (!files.length) return { status: 400, error: 'Readiness Fix Pack files are required.' };
  if (files.length > MAX_FILES) return { status: 400, error: 'Too many files for the Create Readiness PR MVP.' };
  if (mode === 'preview' && confirmed) return { status: 400, error: 'Preview cannot be confirmed as a mutation.' };
  if (mode === 'apply' && !confirmed) return { status: 400, error: 'Explicit confirmation is required before creating the Pull Request.' };
  if (mode === 'apply' && !/^[a-f0-9]{40}$/i.test(expectedBaseSha)) return { status: 400, error: 'The reviewed base commit is missing or invalid.' };
  if (mode === 'apply' && !/^[a-f0-9]{64}$/i.test(reviewFingerprint)) return { status: 400, error: 'The reviewed change fingerprint is missing or invalid.' };

  const normalizedFiles: GitHubAppPrFile[] = [];
  for (const item of files) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { status: 400, error: 'Invalid file entry.' };
    const file = item as Record<string, unknown>;
    const path = clean(file.path);
    const content = typeof file.content === 'string' ? file.content : '';
    if (!isSafeRepoPath(path)) return { status: 400, error: 'Invalid file path in Readiness Fix Pack.' };
    if (!content.trim()) return { status: 400, error: 'Readiness Fix Pack files must not be empty.' };
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) return { status: 400, error: 'A Readiness Fix Pack file is too large for the MVP.' };
    normalizedFiles.push({ path, content });
  }

  return {
    mode,
    installationId,
    owner,
    repo,
    baseBranch: baseBranch || undefined,
    branchName,
    prTitle,
    prBody,
    files: normalizedFiles,
    confirmed,
    expectedBaseSha: expectedBaseSha || undefined,
    reviewFingerprint: reviewFingerprint || undefined,
  };
}

function isValidationError(value: GitHubAppPrRequest | { status: number; error: string }): value is { status: number; error: string } {
  return 'error' in value;
}

async function getDefaultBranch(client: GitHubInstallationClient, owner: string, repo: string) {
  const metadata = await client.getJson<{ default_branch?: string }>(`/repos/${owner}/${repo}`);
  return metadata.default_branch || 'main';
}

async function resolveBase(client: GitHubInstallationClient, request: GitHubAppPrRequest) {
  const baseBranch = request.baseBranch && request.baseBranch !== 'HEAD'
    ? request.baseBranch
    : await getDefaultBranch(client, request.owner, request.repo);
  const baseRef = await client.getJson<{ object: { sha: string } }>(`/repos/${request.owner}/${request.repo}/git/ref/heads/${encodeBranch(baseBranch)}`);
  return { baseBranch, baseSha: baseRef.object.sha };
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function reviewFingerprint(request: GitHubAppPrRequest, baseBranch: string, baseSha: string) {
  return sha256(JSON.stringify({
    repository: `${request.owner}/${request.repo}`,
    baseBranch,
    baseSha,
    branchName: request.branchName,
    prTitle: request.prTitle,
    prBody: request.prBody,
    files: request.files.map(file => ({ path: file.path, content: file.content })),
  }));
}

function contentLines(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n');
  if (!normalized) return [];
  const lines = normalized.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function unifiedReview(path: string, beforeContent: string, afterContent: string) {
  const before = contentLines(beforeContent);
  const after = contentLines(afterContent);
  if (!before.length) {
    return [
      '--- /dev/null',
      `+++ b/${path}`,
      `@@ -0,0 +1,${after.length} @@`,
      ...after.map(line => `+${line}`),
    ].join('\n');
  }
  return [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ reviewed before (${before.length} lines) / after (${after.length} lines) @@`,
    ...before.map(line => `-${line}`),
    ...after.map(line => `+${line}`),
  ].join('\n');
}

async function readBaseFile(client: GitHubInstallationClient, request: GitHubAppPrRequest, baseBranch: string, file: GitHubAppPrFile) {
  const encodedPath = file.path.split('/').map(part => encodeURIComponent(part)).join('/');
  const current = await client.getJson<{ type?: string; content?: string; encoding?: string } | unknown[]>(
    `/repos/${request.owner}/${request.repo}/contents/${encodedPath}?ref=${encodeURIComponent(baseBranch)}`,
    { optional404: true }
  );
  if (!current) return { action: 'create' as const, beforeContent: '' };
  if (Array.isArray(current) || current.type !== 'file' || current.encoding !== 'base64' || typeof current.content !== 'string') {
    throw new GitHubAppApiError(422, `ShipSeal cannot safely review the current repository target: ${file.path}.`, 'github_api_error');
  }
  return {
    action: 'update' as const,
    beforeContent: Buffer.from(current.content.replace(/\s/g, ''), 'base64').toString('utf8'),
  };
}

export async function previewReadinessPrWithGitHubApp(
  request: GitHubAppPrRequest,
  options: Parameters<typeof createGitHubInstallationClient>[1] = {}
) {
  const client = await createGitHubInstallationClient(request.installationId, options);
  const { baseBranch, baseSha } = await resolveBase(client, request);
  const files = await Promise.all(request.files.map(async file => {
    const current = await readBaseFile(client, request, baseBranch, file);
    const additions = contentLines(file.content).length;
    const deletions = contentLines(current.beforeContent).length;
    return {
      path: file.path,
      action: current.action,
      beforeContent: current.beforeContent,
      afterContent: file.content,
      unifiedDiff: unifiedReview(file.path, current.beforeContent, file.content),
      additions,
      deletions,
      contentFingerprint: sha256(file.content),
    };
  }));
  return {
    ok: true as const,
    mode: 'preview' as const,
    plan: {
      repository: `${request.owner}/${request.repo}`,
      baseBranch,
      baseSha,
      branchName: request.branchName,
      prTitle: request.prTitle,
      files,
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
      fingerprint: reviewFingerprint(request, baseBranch, baseSha),
    },
  };
}

async function createSafeBranch(client: GitHubInstallationClient, request: GitHubAppPrRequest, baseSha: string, now = () => new Date()) {
  try {
    await client.postJson(`/repos/${request.owner}/${request.repo}/git/refs`, {
      ref: `refs/heads/${request.branchName}`,
      sha: baseSha,
    });
    return request.branchName;
  } catch (error) {
    if (!(error instanceof GitHubAppApiError) || error.status !== 422) {
      throw new GitHubAppApiError(error instanceof GitHubAppApiError ? error.status : 502, 'ShipSeal could not create the readiness branch.', error instanceof GitHubAppApiError ? error.code : 'github_api_error');
    }
    const fallback = `${request.branchName}-${timestamp(now())}`;
    try {
      await client.postJson(`/repos/${request.owner}/${request.repo}/git/refs`, {
        ref: `refs/heads/${fallback}`,
        sha: baseSha,
      });
    } catch (fallbackError) {
      throw new GitHubAppApiError(fallbackError instanceof GitHubAppApiError ? fallbackError.status : 502, 'ShipSeal could not create a timestamped readiness branch. A ShipSeal branch may already exist, or the repository may be read-only.', fallbackError instanceof GitHubAppApiError ? fallbackError.code : 'github_api_error');
    }
    return fallback;
  }
}

async function putFile(client: GitHubInstallationClient, request: GitHubAppPrRequest, branchName: string, file: GitHubAppPrFile) {
  const encodedPath = file.path.split('/').map(part => encodeURIComponent(part)).join('/');
  try {
    const current = await client.getJson<{ sha?: string }>(
      `/repos/${request.owner}/${request.repo}/contents/${encodedPath}?ref=${encodeURIComponent(branchName)}`,
      { optional404: true }
    );
    await client.putJson(`/repos/${request.owner}/${request.repo}/contents/${encodedPath}`, {
      message: `Add ${file.path} from ShipSeal Readiness Fix Pack`,
      content: toBase64(file.content),
      branch: branchName,
      ...(current?.sha ? { sha: current.sha } : {}),
    });
  } catch (error) {
    throw new GitHubAppApiError(error instanceof GitHubAppApiError ? error.status : 502, `ShipSeal could not write generated readiness file: ${file.path}.`, error instanceof GitHubAppApiError ? error.code : 'github_api_error');
  }
}

export async function createReadinessPrWithGitHubApp(
  request: GitHubAppPrRequest,
  options: Parameters<typeof createGitHubInstallationClient>[1] & { now?: () => Date } = {}
) {
  const client = await createGitHubInstallationClient(request.installationId, options);
  const { baseBranch, baseSha } = await resolveBase(client, request);
  if (request.mode === 'apply') {
    if (request.expectedBaseSha !== baseSha) {
      throw new GitHubAppApiError(409, 'The base branch changed after review. Refresh the preview before creating the Pull Request.', 'github_api_error');
    }
    if (request.reviewFingerprint !== reviewFingerprint(request, baseBranch, baseSha)) {
      throw new GitHubAppApiError(409, 'The reviewed file plan changed. Refresh the preview before creating the Pull Request.', 'github_api_error');
    }
  }
  const branchName = await createSafeBranch(client, request, baseSha, options.now);

  for (const file of request.files) {
    await putFile(client, request, branchName, file);
  }

  let pr: { html_url: string };
  try {
    pr = await client.postJson<{ html_url: string }>(`/repos/${request.owner}/${request.repo}/pulls`, {
      title: request.prTitle,
      head: branchName,
      base: baseBranch,
      body: request.prBody,
    });
  } catch (error) {
    throw new GitHubAppApiError(error instanceof GitHubAppApiError ? error.status : 502, 'GitHub could not open the Pull Request. A similar PR may already exist for this branch.', error instanceof GitHubAppApiError ? error.code : 'github_api_error');
  }

  return {
    mode: 'apply' as const,
    prUrl: pr.html_url,
    branchName,
    baseBranch,
    fileCount: request.files.length,
  };
}

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, {
      error: error instanceof Error && error.message === 'payload-too-large' ? 'Create Readiness PR payload is too large.' : 'Invalid JSON payload.',
    });
    return;
  }

  const validated = validateGitHubAppPrRequest(body);
  if (isValidationError(validated)) {
    sendJson(res, validated.status, { error: validated.error });
    return;
  }

  try {
    if (validated.mode === 'preview') {
      const result = await previewReadinessPrWithGitHubApp(validated);
      sendJson(res, 200, result);
      return;
    }
    const result = await createReadinessPrWithGitHubApp(validated);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    if (error instanceof GitHubAppNotConfiguredError) {
      sendJson(res, 501, {
        status: 'not_configured',
        error: 'GitHub App server credentials are not configured yet.',
      });
      return;
    }
    const friendly = userFacingGitHubAppPrError(error);
    sendJson(res, friendly.status, { error: friendly.error });
  }
}

function userFacingGitHubAppPrError(error: unknown) {
  if (!(error instanceof GitHubAppApiError)) {
    return { status: 502, error: 'GitHub App Create Readiness PR failed. Retry or reconnect GitHub.' };
  }
  const lower = error.message.toLowerCase();

  if (error.status === 409) return { status: 409, error: error.message };
  if (error.status === 401) return { status: 401, error: 'GitHub App installation token could not be used. Reconnect GitHub and retry.' };
  if (error.status === 403) return { status: 403, error: 'GitHub App does not have permission to write to this repository. Check Contents and Pull requests permissions.' };
  if (error.status === 404) return { status: 404, error: 'GitHub App installation or selected repository was not found. Reconnect GitHub and select the repository again.' };
  if (lower.includes('branch')) return { status: 422, error: error.message };
  if (lower.includes('file')) return { status: 422, error: error.message };
  if (lower.includes('pull request')) return { status: 422, error: error.message };
  return { status: 502, error: 'GitHub App Create Readiness PR failed. Check repository access and retry.' };
}

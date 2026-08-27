import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGitHubInstallationClient } from './_lib/githubAppClient.js';
import {
  finalizeRepositoryEvidence,
  selectRepositoryEvidence,
  type DiscoveredRepositoryEntry,
} from '../src/lib/repositoryEvidence.js';
import { isGeneratedOrVendorPath } from '../src/lib/scannerLimits.js';
import type { RepoScanInput, ScanSourceMetadata } from '../src/lib/types.js';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TREE_REQUESTS = 160;
const MAX_TOTAL_REQUESTS = 520;
const MAX_DISCOVERED_ENTRIES = 150_000;
const MAX_GITHUB_SELECTED_TEXT_FILES = 160;
const BLOB_CONCURRENCY = 5;
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/;

type EvidenceRequest = {
  source: 'public-github' | 'github-app';
  owner: string;
  repo: string;
  ref?: string;
  installationId?: string;
};

type GitHubTreeEntry = { path?: string; mode?: string; type?: 'blob' | 'tree'; sha?: string; size?: number };
type GitHubTree = { sha?: string; truncated?: boolean; tree?: GitHubTreeEntry[] };
type GitHubCommit = { sha?: string; commit?: { tree?: { sha?: string } } };
type GitHubBlob = { encoding?: string; content?: string; size?: number };

interface GitHubJsonClient {
  get<T>(path: string, signal: AbortSignal): Promise<{ data: T; headers: Headers }>;
}

export interface GitHubEvidenceAcquisition {
  input: RepoScanInput;
  commitSha: string;
  requestCount: number;
}

export async function acquireGitHubRepositoryEvidence(
  request: EvidenceRequest,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<GitHubEvidenceAcquisition> {
  validateEvidenceRequest(request);
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  const client = request.source === 'github-app'
    ? await installationJsonClient(request.installationId!, options.fetcher)
    : publicJsonClient(options.fetcher || fetch);
  let requestCount = 0;
  let rateLimitRemaining: number | undefined;
  const get = async <T,>(path: string) => {
    if (controller.signal.aborted) throw new DOMException('Repository indexing cancelled.', 'AbortError');
    if (requestCount >= MAX_TOTAL_REQUESTS) throw new Error('GitHub evidence request safety budget was reached.');
    requestCount += 1;
    const response = await client.get<T>(path, controller.signal);
    const remaining = Number(response.headers.get('x-ratelimit-remaining'));
    if (Number.isFinite(remaining)) rateLimitRemaining = remaining;
    return response.data;
  };

  try {
    const ref = request.ref?.trim() || 'HEAD';
    const base = `/repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(request.repo)}`;
    const commit = await get<GitHubCommit>(`${base}/commits/${encodeRef(ref)}`);
    const commitSha = requiredSha(commit.sha, 'commit');
    const rootTreeSha = requiredSha(commit.commit?.tree?.sha, 'root tree');
    const recursive = await get<GitHubTree>(`${base}/git/trees/${rootTreeSha}?recursive=1`);
    let discoveryComplete = recursive.truncated !== true;
    let discovered: DiscoveredRepositoryEntry[];
    if (!recursive.truncated) {
      discovered = normalizeTreeEntries(recursive.tree || []);
    } else {
      const traversed = await traverseTrees(get, base, rootTreeSha);
      discovered = traversed.entries;
      discoveryComplete = traversed.complete;
    }

    const publicToken = process.env.SHIPSEAL_GITHUB_PUBLIC_TOKEN || process.env.GITHUB_TOKEN;
    const selection = selectRepositoryEvidence(discovered, {
      discoveryComplete,
      maximumFiles: request.source === 'public-github' && !publicToken ? 48 : MAX_GITHUB_SELECTED_TEXT_FILES,
    });
    const selectedBySha = selection.selected.filter(entry => entry.objectId);
    const textContents: Record<string, string> = {};
    let cursor = 0;
    const workers = Array.from({ length: Math.min(BLOB_CONCURRENCY, selectedBySha.length) }, async () => {
      while (cursor < selectedBySha.length) {
        const index = cursor;
        cursor += 1;
        const entry = selectedBySha[index];
        const blob = await get<GitHubBlob>(`${base}/git/blobs/${entry.objectId}`);
        if (blob.encoding !== 'base64' || typeof blob.content !== 'string') continue;
        const bytes = Buffer.from(blob.content.replace(/\s/g, ''), 'base64');
        if (bytes.includes(0)) {
          selection.summary.binaryFilesIgnored += 1;
          continue;
        }
        textContents[entry.path] = bytes.toString('utf8');
      }
    });
    await Promise.all(workers);

    const source: ScanSourceMetadata = {
      sourceType: request.source === 'github-app' ? 'github-app' : 'github-public',
      githubOwner: request.owner,
      githubRepo: request.repo,
      githubBranch: ref,
      githubInstallationId: request.installationId,
      sourceUrl: `https://github.com/${request.owner}/${request.repo}/tree/${commitSha}`,
    };
    const input = finalizeRepositoryEvidence(`${request.owner}/${request.repo}`, source, selection, textContents);
    input.scanSummary!.sourceCommitSha = commitSha;
    input.scanSummary!.sourceRequestCount = requestCount;
    input.scanSummary!.sourceRateLimitRemaining = rateLimitRemaining;
    return { input, commitSha, requestCount };
  } finally {
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}

async function traverseTrees(
  get: <T>(path: string) => Promise<T>,
  base: string,
  rootSha: string,
) {
  const queue: Array<{ sha: string; prefix: string }> = [{ sha: rootSha, prefix: '' }];
  const entries: DiscoveredRepositoryEntry[] = [];
  let treeRequests = 0;
  while (queue.length && treeRequests < MAX_TREE_REQUESTS) {
    const current = queue.shift()!;
    const tree = await get<GitHubTree>(`${base}/git/trees/${current.sha}`);
    treeRequests += 1;
    for (const raw of tree.tree || []) {
      if (!raw.path || !raw.sha || (raw.type !== 'blob' && raw.type !== 'tree')) continue;
      const path = current.prefix ? `${current.prefix}/${raw.path}` : raw.path;
      if (raw.type === 'tree') {
        entries.push({ path, size: 0, isDir: true, objectId: raw.sha });
        if (!isGeneratedOrVendorPath(path)) queue.push({ sha: raw.sha, prefix: path });
      } else {
        entries.push({ path, size: Math.max(0, raw.size || 0), objectId: raw.sha });
      }
      if (entries.length >= MAX_DISCOVERED_ENTRIES) return { entries, complete: false };
    }
  }
  return { entries, complete: queue.length === 0 };
}

function normalizeTreeEntries(entries: GitHubTreeEntry[]) {
  return entries
    .filter(entry => entry.path && entry.sha && (entry.type === 'blob' || entry.type === 'tree'))
    .map(entry => ({
      path: entry.path!, size: entry.type === 'blob' ? Math.max(0, entry.size || 0) : 0,
      isDir: entry.type === 'tree', objectId: entry.sha,
    }));
}

function publicJsonClient(fetcher: typeof fetch): GitHubJsonClient {
  const token = process.env.SHIPSEAL_GITHUB_PUBLIC_TOKEN || process.env.GITHUB_TOKEN;
  return {
    async get<T>(path: string, signal: AbortSignal) {
      const response = await fetcher(`https://api.github.com${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'ShipSeal-Repository-Evidence',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      });
      if (!response.ok) throw githubResponseError(response);
      return { data: await response.json() as T, headers: response.headers };
    },
  };
}

async function installationJsonClient(installationId: string, fetcher?: typeof fetch): Promise<GitHubJsonClient> {
  const client = await createGitHubInstallationClient(installationId, { fetcher });
  return {
    get: <T,>(path: string, signal: AbortSignal) => client.getJsonWithHeaders<T>(path, { signal }),
  };
}

function githubResponseError(response: Response) {
  if (response.status === 429 || response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') return new Error('GitHub request capacity is temporarily unavailable. Try again after the rate limit resets.');
  if (response.status === 403) return new Error('GitHub denied access to this repository or ref.');
  if (response.status === 404) return new Error('Repository or ref was not found, or is not accessible.');
  return new Error(`GitHub repository indexing failed with HTTP ${response.status}.`);
}

function requiredSha(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new Error(`GitHub did not return a valid immutable ${label} SHA.`);
  return value;
}

function encodeRef(value: string) {
  return value.split('/').map(part => encodeURIComponent(part)).join('/');
}

function validateEvidenceRequest(request: EvidenceRequest) {
  if (!NAME_PATTERN.test(request.owner) || request.owner.length > 100) throw new Error('Invalid GitHub owner.');
  if (!NAME_PATTERN.test(request.repo) || request.repo.length > 100) throw new Error('Invalid GitHub repository.');
  const ref = request.ref?.trim() || 'HEAD';
  if (!REF_PATTERN.test(ref) || ref.length > 160 || ref.includes('..') || ref.startsWith('/') || ref.endsWith('/')) throw new Error('Invalid GitHub ref.');
  if (request.source === 'github-app' && !/^\d+$/.test(request.installationId || '')) throw new Error('Invalid GitHub App installation.');
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request is too large.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as EvidenceRequest;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const controller = new AbortController();
  req.once('aborted', () => controller.abort());
  try {
    const request = await readJson(req);
    const result = await acquireGitHubRepositoryEvidence(request, { signal: controller.signal });
    sendJson(res, 200, result);
  } catch (error) {
    if (controller.signal.aborted) return;
    const message = error instanceof Error ? error.message : 'Repository evidence acquisition failed.';
    const status = /invalid|too large|safety|exceeds/i.test(message) ? 400 : /not found|not accessible/i.test(message) ? 404 : /capacity|rate limit/i.test(message) ? 429 : 502;
    sendJson(res, status, { error: message });
  }
}

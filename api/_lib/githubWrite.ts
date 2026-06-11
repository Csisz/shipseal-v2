export interface GitHubWriteFile {
  path: string;
  content: string;
}

export interface CreateReadinessPrRequest {
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName: string;
  prTitle: string;
  prBody: string;
  files: GitHubWriteFile[];
  githubToken: string;
}

export interface CreateReadinessPrResult {
  pullRequestUrl: string;
  branchName: string;
  baseBranch: string;
  fileCount: number;
}

export interface GitHubWriteValidationError {
  status: number;
  error: string;
}

export interface GitHubWriteClientOptions {
  fetcher?: typeof fetch;
  now?: () => Date;
}

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const FORBIDDEN_TARGET_BRANCHES = new Set(['main', 'master']);
const MAX_OWNER_REPO_LENGTH = 100;
const MAX_BRANCH_LENGTH = 160;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 128 * 1024;

export function validateCreateReadinessPrRequest(input: unknown): CreateReadinessPrRequest | GitHubWriteValidationError {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 400, error: 'Invalid Create Readiness PR payload.' };
  }

  const body = input as Record<string, unknown>;
  const owner = clean(body.owner);
  const repo = clean(body.repo).replace(/\.git$/i, '');
  const baseBranch = clean(body.baseBranch);
  const branchName = clean(body.branchName) || 'shipseal/readiness-pack';
  const prTitle = clean(body.prTitle);
  const prBody = clean(body.prBody);
  const githubToken = clean(body.githubToken);
  const files = Array.isArray(body.files) ? body.files : [];

  if (!githubToken) return { status: 401, error: 'GitHub token is required.' };
  if (!isSafeRepoPart(owner)) return { status: 400, error: 'Invalid GitHub owner.' };
  if (!isSafeRepoPart(repo)) return { status: 400, error: 'Invalid GitHub repo.' };
  if (baseBranch && !isSafeBranch(baseBranch)) return { status: 400, error: 'Invalid base branch.' };
  if (!isSafeBranch(branchName)) return { status: 400, error: 'Invalid target branch.' };
  if (isForbiddenBranch(branchName)) return { status: 400, error: 'ShipSeal will not write directly to main or master.' };
  if (!prTitle) return { status: 400, error: 'Pull request title is required.' };
  if (!prBody) return { status: 400, error: 'Pull request summary is required.' };
  if (!files.length) return { status: 400, error: 'Readiness Fix Pack files are required.' };
  if (files.length > MAX_FILES) return { status: 400, error: 'Too many files for the Create Readiness PR MVP.' };

  const normalizedFiles: GitHubWriteFile[] = [];
  for (const item of files) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { status: 400, error: 'Invalid file entry.' };
    }
    const file = item as Record<string, unknown>;
    const path = clean(file.path);
    const content = typeof file.content === 'string' ? file.content : '';
    if (!isSafeRepoPath(path)) return { status: 400, error: 'Invalid file path in Readiness Fix Pack.' };
    if (!content.trim()) return { status: 400, error: 'Readiness Fix Pack files must not be empty.' };
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
      return { status: 400, error: 'A Readiness Fix Pack file is too large for the MVP.' };
    }
    normalizedFiles.push({ path, content });
  }

  return {
    owner,
    repo,
    baseBranch: baseBranch || undefined,
    branchName,
    prTitle,
    prBody,
    files: normalizedFiles,
    githubToken,
  };
}

export function isValidationError(value: CreateReadinessPrRequest | GitHubWriteValidationError): value is GitHubWriteValidationError {
  return 'error' in value;
}

export async function createReadinessPrOnGitHub(
  request: CreateReadinessPrRequest,
  options: GitHubWriteClientOptions = {}
): Promise<CreateReadinessPrResult> {
  const fetcher = options.fetcher || fetch;
  const api = new GitHubApiClient(request.githubToken, fetcher);
  const baseBranch = request.baseBranch && request.baseBranch !== 'HEAD'
    ? request.baseBranch
    : await getDefaultBranch(api, request.owner, request.repo);
  const baseRef = await api.getJson<{ object: { sha: string } }>(`/repos/${request.owner}/${request.repo}/git/ref/heads/${encodeBranch(baseBranch)}`);
  const branchName = await createSafeBranch(api, request, baseRef.object.sha, options.now);

  for (const file of request.files) {
    await putFile(api, request, branchName, file);
  }

  const pr = await api.postJson<{ html_url: string }>('/repos/' + request.owner + '/' + request.repo + '/pulls', {
    title: request.prTitle,
    head: branchName,
    base: baseBranch,
    body: request.prBody,
  });

  return {
    pullRequestUrl: pr.html_url,
    branchName,
    baseBranch,
    fileCount: request.files.length,
  };
}

async function getDefaultBranch(api: GitHubApiClient, owner: string, repo: string) {
  const metadata = await api.getJson<{ default_branch?: string }>(`/repos/${owner}/${repo}`);
  return metadata.default_branch || 'main';
}

async function createSafeBranch(api: GitHubApiClient, request: CreateReadinessPrRequest, baseSha: string, now = () => new Date()) {
  try {
    await api.postJson(`/repos/${request.owner}/${request.repo}/git/refs`, {
      ref: `refs/heads/${request.branchName}`,
      sha: baseSha,
    });
    return request.branchName;
  } catch (error) {
    if (!(error instanceof GitHubWriteError) || error.status !== 422) throw error;
    const fallback = `${request.branchName}-${timestamp(now())}`;
    await api.postJson(`/repos/${request.owner}/${request.repo}/git/refs`, {
      ref: `refs/heads/${fallback}`,
      sha: baseSha,
    });
    return fallback;
  }
}

async function putFile(api: GitHubApiClient, request: CreateReadinessPrRequest, branchName: string, file: GitHubWriteFile) {
  const encodedPath = file.path.split('/').map(part => encodeURIComponent(part)).join('/');
  const current = await api.getJson<{ sha?: string }>(
    `/repos/${request.owner}/${request.repo}/contents/${encodedPath}?ref=${encodeURIComponent(branchName)}`,
    { optional404: true }
  );
  await api.putJson(`/repos/${request.owner}/${request.repo}/contents/${encodedPath}`, {
    message: `Add ${file.path} from ShipSeal Readiness Fix Pack`,
    content: toBase64(file.content),
    branch: branchName,
    ...(current?.sha ? { sha: current.sha } : {}),
  });
}

class GitHubApiClient {
  constructor(private readonly token: string, private readonly fetcher: typeof fetch) {}

  async getJson<T>(path: string, options: { optional404?: boolean } = {}) {
    return this.requestJson<T>('GET', path, undefined, options);
  }

  async postJson<T>(path: string, body: unknown) {
    return this.requestJson<T>('POST', path, body);
  }

  async putJson<T>(path: string, body: unknown) {
    return this.requestJson<T>('PUT', path, body);
  }

  private async requestJson<T>(method: string, path: string, body?: unknown, options: { optional404?: boolean } = {}): Promise<T> {
    const response = await this.fetcher(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (options.optional404 && response.status === 404) return null as T;
    if (!response.ok) throw await GitHubWriteError.fromResponse(response);
    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }
}

export class GitHubWriteError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GitHubWriteError';
  }

  static async fromResponse(response: Response) {
    let message = '';
    try {
      const payload = await response.json();
      message = typeof payload?.message === 'string' ? payload.message : '';
    } catch {
      message = '';
    }
    return new GitHubWriteError(response.status, message || `GitHub API request failed with status ${response.status}.`);
  }
}

export function userFacingGitHubWriteError(error: unknown) {
  if (!(error instanceof GitHubWriteError)) {
    return { status: 502, error: 'GitHub write request failed. Check network access and try again.' };
  }

  if (error.status === 401) return { status: 401, error: 'GitHub token is invalid or expired.' };
  if (error.status === 403) {
    const lower = error.message.toLowerCase();
    return {
      status: 403,
      error: lower.includes('rate limit')
        ? 'GitHub rate limit reached. Try again later.'
        : 'GitHub token does not have enough permission for this repository.',
    };
  }
  if (error.status === 404) return { status: 404, error: 'GitHub repository, branch, or file path was not found.' };
  if (error.status === 422) return { status: 422, error: 'Pull request creation failed or a similar PR may already exist.' };
  return { status: 502, error: 'GitHub write request failed. Review the repository and token permissions.' };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeRepoPart(value: string) {
  return value.length > 0 && value.length <= MAX_OWNER_REPO_LENGTH && OWNER_REPO_PATTERN.test(value);
}

function isSafeBranch(value: string) {
  return value.length > 0 &&
    value.length <= MAX_BRANCH_LENGTH &&
    BRANCH_PATTERN.test(value) &&
    !value.includes('..') &&
    !value.startsWith('/') &&
    !value.endsWith('/');
}

function isForbiddenBranch(value: string) {
  return FORBIDDEN_TARGET_BRANCHES.has(value.toLowerCase());
}

function isSafeRepoPath(value: string) {
  return Boolean(value) &&
    value.length <= 180 &&
    !value.includes('..') &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    /^[A-Za-z0-9._\/-]+$/.test(value);
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

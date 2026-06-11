import { SCANNER_LIMITS } from '../scannerLimits';
import type { ScanSourceMetadata } from '../types';
import { parseGitHubUrl } from './githubUrl';

export type GitHubImportErrorCategory =
  | 'invalid-url'
  | 'unsupported-host'
  | 'network-cors-blocked'
  | 'repo-not-found'
  | 'branch-ref-not-found'
  | 'zip-too-large'
  | 'unknown-import-error';

export type GitHubImportStrategy = 'proxy-first' | 'direct-browser-codeload' | 'same-origin-proxy';

export interface GitHubImportInput {
  url: string;
  branch?: string;
  strategy?: GitHubImportStrategy;
  proxyEndpoint?: string;
}

export interface GitHubImportCallbacks {
  onStepStart?: (step: string, index: number) => void;
  onStepComplete?: (step: string, index: number) => void;
  onProgress?: (progress: number) => void;
}

export interface ImportedGitHubRepo {
  file: File;
  source: ScanSourceMetadata;
}

export interface GitHubAppArchiveImportInput {
  installationId: string;
  owner: string;
  repo: string;
  ref?: string;
}

export const GITHUB_ZIP_FALLBACK_MESSAGE = 'Download the repository as ZIP from GitHub and upload it manually.';
export const GITHUB_CORS_FALLBACK_MESSAGE = 'Browser restrictions blocked the GitHub ZIP download. Download the repository as ZIP from GitHub and upload it manually.';

export class GitHubImportError extends Error {
  category: GitHubImportErrorCategory;
  fallbackMessage: string;

  constructor(message = GITHUB_ZIP_FALLBACK_MESSAGE, category: GitHubImportErrorCategory = 'unknown-import-error') {
    super(message);
    this.name = 'GitHubImportError';
    this.category = category;
    this.fallbackMessage = GITHUB_ZIP_FALLBACK_MESSAGE;
  }
}

function encodeBranch(branch: string) {
  return branch.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function buildGitHubCodeloadUrl(owner: string, repo: string, ref = 'HEAD') {
  return `https://codeload.github.com/${owner}/${repo}/zip/${encodeBranch(ref)}`;
}

export function buildGitHubZipUrl(owner: string, repo: string, branch?: string) {
  return branch
    ? buildGitHubCodeloadUrl(owner, repo, `refs/heads/${branch}`)
    : buildGitHubCodeloadUrl(owner, repo, 'HEAD');
}

export function buildGitHubArchiveProxyUrl(owner: string, repo: string, ref?: string, endpoint = '/api/github-archive') {
  const params = new URLSearchParams({ owner, repo });
  if (ref?.trim()) params.set('ref', ref.trim());
  return `${endpoint}?${params.toString()}`;
}

export const buildGitHubProxyImportUrl = buildGitHubArchiveProxyUrl;

interface DirectBrowserCodeloadInput {
  owner: string;
  repo: string;
  branch?: string;
}

function classifyParseError(error: unknown): GitHubImportErrorCategory {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Only public github.com')) return 'unsupported-host';
  return 'invalid-url';
}

export async function directBrowserCodeloadImport(input: DirectBrowserCodeloadInput): Promise<Blob> {
  const zipUrl = buildGitHubZipUrl(input.owner, input.repo, input.branch);
  return fetchGitHubArchiveBlob(zipUrl, input);
}

export async function proxyGitHubArchiveImport(input: DirectBrowserCodeloadInput & { endpoint?: string }): Promise<Blob> {
  const zipUrl = buildGitHubArchiveProxyUrl(input.owner, input.repo, input.branch || 'HEAD', input.endpoint);
  return fetchGitHubArchiveBlob(zipUrl, input);
}

async function fetchGitHubArchiveBlob(zipUrl: string, input: DirectBrowserCodeloadInput): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(zipUrl, { method: 'GET', redirect: 'follow' });
  } catch {
    throw new GitHubImportError(GITHUB_CORS_FALLBACK_MESSAGE, 'network-cors-blocked');
  }

  if (!response.ok) {
    if (response.status === 404 && input.branch) {
      throw new GitHubImportError(
        `GitHub branch or ref "${input.branch}" was not found. ${GITHUB_ZIP_FALLBACK_MESSAGE}`,
        'branch-ref-not-found'
      );
    }
    if (response.status === 404 || response.status === 403) {
      throw new GitHubImportError(
        `Repository was not found, is private, or cannot be fetched from the browser. ${GITHUB_ZIP_FALLBACK_MESSAGE}`,
        'repo-not-found'
      );
    }
    throw new GitHubImportError(`GitHub import failed with HTTP ${response.status}. ${GITHUB_ZIP_FALLBACK_MESSAGE}`, 'unknown-import-error');
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > SCANNER_LIMITS.maxZipSizeBytes) {
    throw new GitHubImportError(
      'GitHub repository ZIP is too large for local scanning. Download a smaller repository ZIP or remove generated folders before uploading manually.',
      'zip-too-large'
    );
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new GitHubImportError(`GitHub ZIP download could not be read. ${GITHUB_ZIP_FALLBACK_MESSAGE}`, 'unknown-import-error');
  }

  if (blob.size > SCANNER_LIMITS.maxZipSizeBytes) {
    throw new GitHubImportError(
      'GitHub repository ZIP is too large for local scanning. Download a smaller repository ZIP or remove generated folders before uploading manually.',
      'zip-too-large'
    );
  }

  return blob;
}

export async function proxyFirstGitHubArchiveImport(input: DirectBrowserCodeloadInput & { endpoint?: string }): Promise<Blob> {
  try {
    return await proxyGitHubArchiveImport(input);
  } catch {
    return directBrowserCodeloadImport(input);
  }
}

function resolveGitHubImportStrategy(input: GitHubImportInput): GitHubImportStrategy {
  return input.strategy || 'proxy-first';
}

function step(callbacks: GitHubImportCallbacks, index: number, progress: number, complete = false) {
  const label = index === 0 ? 'Validating GitHub URL' : 'Downloading public repository ZIP';
  if (complete) {
    callbacks.onStepComplete?.(label, index);
  } else {
    callbacks.onStepStart?.(label, index);
  }
  callbacks.onProgress?.(progress);
}

export async function importPublicGitHubRepo(input: GitHubImportInput, callbacks: GitHubImportCallbacks = {}): Promise<ImportedGitHubRepo> {
  step(callbacks, 0, 5);
  let parsed: ReturnType<typeof parseGitHubUrl>;
  try {
    parsed = parseGitHubUrl(input.url);
  } catch (error) {
    throw new GitHubImportError(error instanceof Error ? error.message : 'Enter a valid public GitHub repository URL.', classifyParseError(error));
  }
  const branch = input.branch?.trim() || parsed.branch;
  if (branch && (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..') || branch.length > 120)) {
    throw new GitHubImportError('GitHub branch contains unsupported characters.', 'invalid-url');
  }
  step(callbacks, 0, 12, true);

  step(callbacks, 1, 18);
  const strategy = resolveGitHubImportStrategy(input);
  const importInput = { owner: parsed.owner, repo: parsed.repo, branch, endpoint: input.proxyEndpoint };
  const blob = strategy === 'same-origin-proxy'
    ? await proxyGitHubArchiveImport(importInput)
    : strategy === 'direct-browser-codeload'
      ? await directBrowserCodeloadImport(importInput)
      : await proxyFirstGitHubArchiveImport(importInput);

  step(callbacks, 1, 28, true);

  const fileName = `${parsed.owner}-${parsed.repo}${branch ? `-${branch.replace(/[^A-Za-z0-9_.-]+/g, '-')}` : ''}.zip`;
  return {
    file: new File([blob], fileName, { type: 'application/zip' }),
    source: {
      sourceType: 'github-url',
      githubOwner: parsed.owner,
      githubRepo: parsed.repo,
      githubBranch: branch,
      sourceUrl: branch ? `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}` : parsed.normalizedUrl,
    },
  };
}

export async function importGitHubAppRepoArchive(input: GitHubAppArchiveImportInput): Promise<ImportedGitHubRepo> {
  const params = new URLSearchParams({
    installationId: input.installationId,
    owner: input.owner,
    repo: input.repo,
  });
  if (input.ref?.trim()) params.set('ref', input.ref.trim());
  const blob = await fetchGitHubArchiveBlob(`/api/github-app/archive?${params.toString()}`, {
    owner: input.owner,
    repo: input.repo,
    branch: input.ref,
  });
  const fileName = `${input.owner}-${input.repo}${input.ref ? `-${input.ref.replace(/[^A-Za-z0-9_.-]+/g, '-')}` : ''}.zip`;

  return {
    file: new File([blob], fileName, { type: 'application/zip' }),
    source: {
      sourceType: 'github-url',
      githubOwner: input.owner,
      githubRepo: input.repo,
      githubBranch: input.ref,
      githubDefaultBranch: input.ref,
      githubInstallationId: input.installationId,
      sourceUrl: input.ref ? `https://github.com/${input.owner}/${input.repo}/tree/${input.ref}` : `https://github.com/${input.owner}/${input.repo}`,
    },
  };
}

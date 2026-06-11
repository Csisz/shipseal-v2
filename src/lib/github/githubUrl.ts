export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  normalizedUrl: string;
  defaultZipUrl: string;
}

const MAX_GITHUB_URL_LENGTH = 300;
const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;

function stripGitSuffix(repo: string) {
  return repo.replace(/\.git$/i, '');
}

function zipBranch(branch?: string) {
  return branch ? `refs/heads/${branch}` : 'HEAD';
}

export function buildDefaultGitHubZipUrl(owner: string, repo: string, branch?: string) {
  return `https://codeload.github.com/${owner}/${repo}/zip/${zipBranch(branch)}`;
}

export function parseGitHubUrl(rawValue: string): ParsedGitHubUrl {
  const raw = rawValue.trim();

  if (!raw) throw new Error('Enter a public GitHub repository URL.');
  if (raw.length > MAX_GITHUB_URL_LENGTH) throw new Error('GitHub URL is too long.');
  if (/\s/.test(raw)) throw new Error('GitHub URL cannot contain whitespace.');

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error('Enter a valid GitHub repository URL.');
  }

  if (url.username || url.password) {
    throw new Error('GitHub URLs with credentials are not allowed.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS GitHub URLs are supported.');
  }

  if (url.hostname.toLowerCase() !== 'github.com') {
    throw new Error('Only public github.com repository URLs are supported.');
  }

  const parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  const owner = parts[0];
  const repo = parts[1] ? stripGitSuffix(parts[1]) : '';

  if (!owner || !repo) throw new Error('GitHub URL must include an owner and repository name.');
  if (!OWNER_REPO_PATTERN.test(owner) || !OWNER_REPO_PATTERN.test(repo)) {
    throw new Error('GitHub owner or repository contains unsupported characters.');
  }

  let branch: string | undefined;
  if (parts[2] === 'tree') {
    branch = parts.slice(3).join('/');
    if (!branch) throw new Error('GitHub branch URL is missing the branch name.');
    if (branch.length > 120 || !BRANCH_PATTERN.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
      throw new Error('GitHub branch contains unsupported characters.');
    }
  } else if (parts.length > 2) {
    throw new Error('Only repository root URLs and tree branch URLs are supported.');
  }

  const normalizedUrl = `https://github.com/${owner}/${repo}${branch ? `/tree/${branch}` : ''}`;

  return {
    owner,
    repo,
    branch,
    normalizedUrl,
    defaultZipUrl: buildDefaultGitHubZipUrl(owner, repo, branch),
  };
}

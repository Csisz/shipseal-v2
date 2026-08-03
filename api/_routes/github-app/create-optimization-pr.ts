import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGitHubInstallationClient, type GitHubInstallationClient } from '../../_lib/githubAppClient.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../../_lib/githubAppTypes.js';
import {
  OPTIMIZATION_GITHUB_APPLY_LIMITS,
  buildOptimizationGithubApplyPlan,
  optimizationPlanMarker,
  validateOptimizationGithubApplyRequest,
  type OptimizationGithubApplyIssue,
  type OptimizationGithubApplyIssueCode,
  type OptimizationGithubApplyPlan,
  type OptimizationGithubApplyProgress,
  type OptimizationGithubApplyRequest,
  type OptimizationGithubCurrentFile,
} from '../../../src/lib/workspace/repositoryOptimizationGithubApply.js';

const MAX_BODY_BYTES = OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumTotalBytes + 128 * 1024;
type VercelLikeRequest = IncomingMessage & { body?: unknown };

export async function prepareOrApplyOptimizationPr(
  request: OptimizationGithubApplyRequest,
  options: Parameters<typeof createGitHubInstallationClient>[1] = {},
) {
  const requestIssues = validateOptimizationGithubApplyRequest(request);
  if (requestIssues.length) throw new OptimizationGithubApplyServerError(requestIssues[0], 400, undefined, requestIssues);

  const client = await createGitHubInstallationClient(request.installationId, options);
  const repository = await client.getJson<{
    default_branch?: string;
    archived?: boolean;
    disabled?: boolean;
    permissions?: { push?: boolean };
  }>(`/repos/${request.owner}/${request.repo}`);
  if (!repository) throw applyError('repository-unavailable', 'The selected repository is no longer available.', 'Reconnect GitHub and select the repository again.', 404, progress('repository-validation', request));
  const baseBranch = request.baseBranch || repository.default_branch || '';
  const baseRef = await client.getJson<{ object?: { sha?: string } }>(`/repos/${request.owner}/${request.repo}/git/ref/heads/${encodeBranch(baseBranch)}`, { optional404: true });
  const baseCommit = baseRef?.object?.sha;
  if (!baseCommit) throw applyError('base-branch-missing', 'The reviewed base branch no longer exists.', 'Rescan the repository using its current base branch.', 404, progress('repository-validation', request));

  const baseFiles = await readFiles(client, request, baseBranch);
  const branchName = request.prepared.suggestedBranchName;
  const branchRef = await client.getJson<{ object?: { sha?: string } }>(`/repos/${request.owner}/${request.repo}/git/ref/heads/${encodeBranch(branchName)}`, { optional404: true });
  const branchFiles = branchRef?.object?.sha ? await readFiles(client, request, branchName) : undefined;
  const openPullRequests = await findOpenPullRequests(client, request.owner, request.repo, baseBranch);
  const marker = optimizationPlanMarker(request.prepared.fingerprint);
  const matchingPr = openPullRequests.find(pr => pr.body?.includes(marker));
  const conflictingPr = matchingPr ? undefined : openPullRequests.find(pr => pr.head?.ref === branchName);
  const plan = buildOptimizationGithubApplyPlan({
    request,
    currentRepositoryState: {
      owner: request.owner,
      repo: request.repo,
      baseBranch,
      baseCommit,
      archived: repository.archived === true,
      disabled: repository.disabled === true,
      canPush: repository.permissions?.push !== false,
      files: baseFiles,
      ...(branchFiles ? { branch: { name: branchName, files: branchFiles } } : {}),
      ...(matchingPr ? { existingPullRequest: { url: matchingPr.html_url, number: matchingPr.number, branchName: matchingPr.head?.ref || branchName, matching: true } }
        : conflictingPr ? { existingPullRequest: { url: conflictingPr.html_url, number: conflictingPr.number, branchName, matching: false } } : {}),
    },
  });

  if (request.mode === 'preview') return { mode: 'preview' as const, plan };
  if (request.expectedPreviewFingerprint !== plan.fingerprint || request.expectedBaseCommit !== plan.repository.baseCommit) {
    throw applyError('stale-target-file', 'Repository state changed after the reviewed preview.', 'Refresh repository state and review the updated diff before confirming again.', 409, progress('repository-validation', request));
  }
  if (!plan.applyReady) throw new OptimizationGithubApplyServerError(plan.validation.blockingIssues[0], 409, progress('repository-validation', request), plan.validation.blockingIssues);
  if (matchingPr) return successResult(plan, matchingPr.html_url, matchingPr.number, matchingPr.head?.ref || branchName, true, false);

  const completedSteps: OptimizationGithubApplyProgress['completedSteps'] = ['validated-repository'];
  let createdBranch = false;
  if (!branchFiles) {
    try {
      await client.postJson(`/repos/${request.owner}/${request.repo}/git/refs`, { ref: `refs/heads/${branchName}`, sha: baseCommit });
      createdBranch = true;
      completedSteps.push('created-branch');
    } catch (error) {
      throw mutationError(error, 'branch-creation-failed', 'GitHub could not create the reviewed ShipSeal branch.', 'Refresh repository state; if the branch now exists, review it before retrying.', {
        ...progress('branch-creation', request), completedSteps, branchName, branchUrl: branchUrl(request.owner, request.repo, branchName),
      });
    }
  } else {
    completedSteps.push('created-branch');
  }

  const pendingFiles = plan.files.filter(file => file.status === 'ready');
  let written = 0;
  for (const file of pendingFiles) {
    try {
      await client.putJson(`/repos/${request.owner}/${request.repo}/contents/${encodePath(file.path)}`, {
        message: `${operationVerb(file.action)} ${file.path} with ShipSeal Optimization Plan`,
        content: Buffer.from(file.nextContent, 'utf8').toString('base64'),
        branch: branchName,
        ...(file.writeSha ? { sha: file.writeSha } : {}),
      });
      written += 1;
    } catch (error) {
      const totalWritten = plan.summary.alreadyAppliedCount + written;
      throw mutationError(error, totalWritten > 0 ? 'partial-write-state' : 'file-write-failed', totalWritten > 0
        ? `GitHub contains ${totalWritten} of ${plan.files.length} reviewed file writes, but no pull request was opened.`
        : `GitHub did not accept the reviewed write for ${file.path}.`,
      'Open the ShipSeal branch and refresh repository state before a stage-aware retry.', {
        completedSteps,
        failedStep: 'file-write',
        writtenFileCount: totalWritten,
        totalFileCount: plan.files.length,
        branchName,
        branchUrl: branchUrl(request.owner, request.repo, branchName),
      });
    }
  }
  completedSteps.push('wrote-files');

  let pr: { html_url: string; number?: number };
  try {
    pr = await client.postJson(`/repos/${request.owner}/${request.repo}/pulls`, {
      title: plan.pullRequest.title,
      head: branchName,
      base: baseBranch,
      body: plan.pullRequest.body,
    });
  } catch (error) {
    throw mutationError(error, 'pull-request-creation-failed', 'All reviewed files are on the ShipSeal branch, but GitHub did not open the pull request.', 'Open the prepared branch and create the pull request manually, or retry after refreshing repository state.', {
      completedSteps,
      failedStep: 'pull-request-creation',
      writtenFileCount: plan.files.length,
      totalFileCount: plan.files.length,
      branchName,
      branchUrl: branchUrl(request.owner, request.repo, branchName),
    });
  }
  completedSteps.push('opened-pull-request');
  return successResult(plan, pr.html_url, pr.number, branchName, false, !createdBranch);
}

async function readFiles(client: GitHubInstallationClient, request: OptimizationGithubApplyRequest, branch: string) {
  const files: OptimizationGithubCurrentFile[] = [];
  for (const file of request.prepared.files) files.push(await readCurrentFile(client, request.owner, request.repo, branch, file.path));
  return files;
}

async function readCurrentFile(client: GitHubInstallationClient, owner: string, repo: string, branch: string, path: string): Promise<OptimizationGithubCurrentFile> {
  const value = await client.getJson<{ type?: string; content?: string; encoding?: string; sha?: string } | unknown[]>(`/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, { optional404: true });
  if (!value) return { path, kind: 'missing' };
  if (Array.isArray(value) || value.type === 'dir') return { path, kind: 'directory' };
  if (value.type !== 'file' || value.encoding !== 'base64' || typeof value.content !== 'string') return { path, kind: 'excluded' };
  return { path, kind: 'file', content: Buffer.from(value.content.replace(/\s/g, ''), 'base64').toString('utf8'), sha: value.sha };
}

async function findOpenPullRequests(client: GitHubInstallationClient, owner: string, repo: string, base: string) {
  return client.getJson<Array<{ html_url: string; number?: number; body?: string; head?: { ref?: string } }>>(`/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100`);
}

function successResult(plan: OptimizationGithubApplyPlan, prUrl: string, prNumber: number | undefined, branchName: string, existing: boolean, resumed: boolean) {
  return {
    mode: 'apply' as const,
    ok: true as const,
    existing,
    resumed,
    prUrl,
    prNumber,
    repository: `${plan.repository.owner}/${plan.repository.repo}`,
    baseBranch: plan.repository.baseBranch,
    branchName,
    fileCount: plan.files.length,
    operationCounts: {
      create: plan.summary.createCount,
      update: plan.summary.updateCount,
      strengthen: plan.summary.strengthenCount,
    },
    preparedPlanId: plan.preparedPlanId,
    applyPlanId: plan.applyPlanId,
    appliedAt: new Date().toISOString(),
  };
}

export class OptimizationGithubApplyServerError extends Error {
  constructor(
    public readonly issue: OptimizationGithubApplyIssue,
    public readonly status: number,
    public readonly progress?: OptimizationGithubApplyProgress,
    public readonly issues: OptimizationGithubApplyIssue[] = [issue],
  ) {
    super(issue.message);
    this.name = 'OptimizationGithubApplyServerError';
  }
}

function applyError(code: OptimizationGithubApplyIssueCode, message: string, nextAction: string, status: number, applyProgress?: OptimizationGithubApplyProgress) {
  return new OptimizationGithubApplyServerError({ code, message, nextAction }, status, applyProgress);
}

function mutationError(
  error: unknown,
  fallbackCode: OptimizationGithubApplyIssueCode,
  fallbackMessage: string,
  fallbackNextAction: string,
  applyProgress: OptimizationGithubApplyProgress,
) {
  if (error instanceof GitHubAppApiError) {
    if (error.status === 401) return applyError('installation-unavailable', 'The GitHub App installation became unavailable during mutation.', 'Reconnect GitHub, then refresh repository state before retrying.', 401, applyProgress);
    if (error.status === 403) return applyError('permission-missing', 'GitHub App repository permission changed during mutation.', 'Check Contents and Pull requests permissions, reconnect GitHub, then refresh the branch state.', 403, applyProgress);
    if (error.status === 429) return applyError('rate-limit', 'GitHub rate limited the reviewed mutation.', 'Wait for the rate limit to reset, then refresh repository state and retry the unchanged prepared snapshot.', 429, applyProgress);
  }
  return applyError(fallbackCode, fallbackMessage, fallbackNextAction, 502, applyProgress);
}

export function normalizeOptimizationGithubError(error: unknown) {
  if (error instanceof OptimizationGithubApplyServerError) return { status: error.status, issue: error.issue, issues: error.issues, progress: error.progress };
  if (error instanceof GitHubAppNotConfiguredError) return normalized(501, 'installation-unavailable', 'GitHub App server credentials are not configured.', 'Configure or reconnect the ShipSeal GitHub App.');
  if (error instanceof GitHubAppApiError) {
    if (error.status === 401) return normalized(401, 'installation-unavailable', 'The GitHub App installation token could not be used.', 'Reconnect GitHub and retry.');
    if (error.status === 403) return normalized(403, 'permission-missing', 'The GitHub App lacks repository write or pull request permission.', 'Check Contents and Pull requests permissions, then reconnect.');
    if (error.status === 429) return normalized(429, 'rate-limit', 'GitHub rate limit reached.', 'Wait, then retry the unchanged prepared snapshot.');
    if (error.status === 404) return normalized(404, 'repository-unavailable', 'The repository, installation, or base branch is unavailable.', 'Reconnect GitHub, select the repository, and rescan.');
  }
  return normalized(502, 'github-unavailable', 'GitHub could not complete the Optimization PR request.', 'Retry, reconnect GitHub, or download the unchanged Optimization Package.');
}

function normalized(status: number, code: OptimizationGithubApplyIssueCode, message: string, nextAction: string) { return { status, issue: { code, message, nextAction } }; }
function progress(failedStep: NonNullable<OptimizationGithubApplyProgress['failedStep']>, request: OptimizationGithubApplyRequest): OptimizationGithubApplyProgress { return { completedSteps: [], failedStep, writtenFileCount: 0, totalFileCount: request.prepared.files.length }; }
function branchUrl(owner: string, repo: string, branch: string) { return `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch)}`; }
function operationVerb(value: string) { return value === 'create' ? 'Create' : value === 'update' ? 'Update' : 'Strengthen'; }
function encodePath(path: string) { return path.split('/').map(encodeURIComponent).join('/'); }
function encodeBranch(branch: string) { return branch.split('/').map(encodeURIComponent).join('/'); }

async function readJsonBody(req: VercelLikeRequest) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = []; let total = 0;
  for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); total += value.byteLength; if (total > MAX_BODY_BYTES) throw new Error('payload-too-large'); chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function sendJson(res: ServerResponse, status: number, payload: unknown) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); }

export default async function handler(req: VercelLikeRequest, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: { code: 'invalid-payload', message: 'Method not allowed.', nextAction: 'Use the Optimization PR preview or confirmation action.' } });
  let body: unknown;
  try { body = await readJsonBody(req); } catch (error) { return sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, { error: { code: 'invalid-payload', message: 'The request is invalid or too large.', nextAction: 'Prepare a smaller reviewed plan.' } }); }
  const issues = validateOptimizationGithubApplyRequest(body);
  if (issues.length) return sendJson(res, 400, { error: issues[0], issues });
  try {
    const result = await prepareOrApplyOptimizationPr(body as OptimizationGithubApplyRequest);
    return sendJson(res, 200, result);
  } catch (error) {
    const normalizedError = normalizeOptimizationGithubError(error);
    return sendJson(res, normalizedError.status, { error: normalizedError.issue, ...('issues' in normalizedError ? { issues: normalizedError.issues } : {}), ...('progress' in normalizedError && normalizedError.progress ? { progress: normalizedError.progress } : {}) });
  }
}

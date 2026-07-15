import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGitHubInstallationClient, type GitHubInstallationClient } from '../_lib/githubAppClient.js';
import { GitHubAppApiError, GitHubAppNotConfiguredError } from '../_lib/githubAppTypes.js';
import {
  buildRepositoryIntelligenceGithubApplyPlan,
  validateRepositoryIntelligenceGithubApplyRequest,
  type RepositoryIntelligenceApplyErrorCode,
  type RepositoryIntelligenceApplyIssue,
  type RepositoryIntelligenceCurrentFileState,
  type RepositoryIntelligenceGithubApplyRequest,
} from '../../src/lib/repositoryIntelligence/repositoryIntelligenceApply.js';

const MAX_BODY_BYTES = 900 * 1024;
type VercelLikeRequest = IncomingMessage & { body?: unknown };

export async function prepareOrApplyRepositoryIntelligencePr(
  request: RepositoryIntelligenceGithubApplyRequest,
  options: Parameters<typeof createGitHubInstallationClient>[1] = {},
) {
  const client = await createGitHubInstallationClient(request.installationId, options);
  const repository = await client.getJson<{ default_branch?: string }>(`/repos/${request.owner}/${request.repo}`);
  if (!repository) throw applyError('repository-not-found', 'The selected repository is no longer available.', 'Reconnect GitHub and select the repository again.', 404);
  const baseBranch = request.baseBranch || repository.default_branch || '';
  const baseRef = await client.getJson<{ object?: { sha?: string } }>(`/repos/${request.owner}/${request.repo}/git/ref/heads/${encodeBranch(baseBranch)}`);
  const baseCommit = baseRef?.object?.sha;
  if (!baseCommit) throw applyError('base-branch-missing', 'The reviewed base branch no longer exists.', 'Rescan the repository using its current base branch.', 404);

  const files: RepositoryIntelligenceCurrentFileState[] = [];
  for (const artifact of request.selectedPayload.artifacts) {
    files.push(await readCurrentFile(client, request.owner, request.repo, baseBranch, artifact.targetPath));
  }
  const plan = buildRepositoryIntelligenceGithubApplyPlan({
    request,
    currentRepositoryState: { owner: request.owner, repo: request.repo, baseBranch, baseCommit, files },
  });
  if (!plan.applyReady) throw new RepositoryIntelligenceApplyServerError(plan.blockingErrors[0], 409, plan.blockingErrors);

  if (request.mode === 'preview') return { mode: 'preview' as const, plan: publicPlan(plan) };
  if (!request.confirmed) throw applyError('invalid-payload', 'Explicit confirmation is required.', 'Review the preview and confirm Create Pull Request.', 400);

  const existing = await findOpenPullRequests(client, request.owner, request.repo, baseBranch);
  const matching = existing.find(pr => pr.body?.includes(`shipseal:repository-intelligence-plan:${plan.selectedPlanFingerprint}`));
  if (matching) return successResult(plan, matching.html_url, matching.number, matching.head?.ref || plan.proposedBranchName, true);
  if (existing.some(pr => pr.head?.ref === plan.proposedBranchName)) {
    throw applyError('pull-request-already-exists', 'A different open Pull Request already uses the proposed Repository Intelligence branch.', 'Review or close the existing PR, then regenerate the plan.', 409);
  }

  const branchName = await createBranch(client, request.owner, request.repo, plan.proposedBranchName, baseCommit);
  let written = 0;
  try {
    for (const file of plan.files) {
      await client.putJson(`/repos/${request.owner}/${request.repo}/contents/${encodePath(file.path)}`, {
        message: `${operationVerb(file.operation)} ${file.path} with ShipSeal Repository Intelligence`,
        content: Buffer.from(file.finalContent, 'utf8').toString('base64'),
        branch: branchName,
        ...(file.blobSha ? { sha: file.blobSha } : {}),
      });
      written += 1;
    }
  } catch {
    const code = written > 0 ? 'partial-write-state' : 'file-write-failed';
    throw applyError(code, written > 0
      ? `GitHub accepted ${written} of ${plan.files.length} file writes, but no Pull Request was opened.`
      : 'GitHub did not accept the reviewed file writes.',
    'Inspect the ShipSeal branch in GitHub before retrying; no PR was opened.', 502);
  }

  let pr: { html_url: string; number?: number };
  try {
    pr = await client.postJson(`/repos/${request.owner}/${request.repo}/pulls`, {
      title: plan.pullRequestTitle,
      head: branchName,
      base: baseBranch,
      body: plan.pullRequestBody.replace(`Proposed branch: \`${plan.proposedBranchName}\``, `Proposed branch: \`${branchName}\``),
    });
  } catch {
    throw applyError('pull-request-creation-failed', 'All reviewed files were written to the ShipSeal branch, but GitHub did not open the Pull Request.', 'Open the branch in GitHub and create the PR manually, or retry after checking permissions.', 502);
  }
  return successResult(plan, pr.html_url, pr.number, branchName, false);
}

async function readCurrentFile(client: GitHubInstallationClient, owner: string, repo: string, branch: string, path: string): Promise<RepositoryIntelligenceCurrentFileState> {
  const value = await client.getJson<{ type?: string; content?: string; encoding?: string; sha?: string } | unknown[]>(
    `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
    { optional404: true },
  );
  if (!value) return { path, kind: 'missing' };
  if (Array.isArray(value) || value.type === 'dir') return { path, kind: 'directory' };
  if (value.type !== 'file' || value.encoding !== 'base64' || typeof value.content !== 'string') return { path, kind: 'excluded' };
  return { path, kind: 'file', content: Buffer.from(value.content.replace(/\s/g, ''), 'base64').toString('utf8'), blobSha: value.sha };
}

async function findOpenPullRequests(client: GitHubInstallationClient, owner: string, repo: string, base: string) {
  return client.getJson<Array<{ html_url: string; number?: number; body?: string; head?: { ref?: string } }>>(
    `/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100`,
  );
}

async function createBranch(client: GitHubInstallationClient, owner: string, repo: string, desired: string, sha: string) {
  try {
    await client.postJson(`/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${desired}`, sha });
    return desired;
  } catch (error) {
    if (!(error instanceof GitHubAppApiError) || error.status !== 422) throw applyError('branch-creation-failed', 'GitHub could not create the Repository Intelligence branch.', 'Check Contents permission and retry.', 502);
  }
  const fallback = `${desired}-${sha.slice(0, 7)}`;
  try {
    await client.postJson(`/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${fallback}`, sha });
    return fallback;
  } catch {
    throw applyError('branch-already-exists', 'The Repository Intelligence branch and its safe fallback already exist.', 'Review the existing branch or regenerate after the base branch changes.', 409);
  }
}

function publicPlan(plan: ReturnType<typeof buildRepositoryIntelligenceGithubApplyPlan>) {
  return {
    version: plan.version,
    repository: plan.repository,
    baseBranch: plan.baseBranch,
    baseCommit: plan.baseCommit.slice(0, 12),
    proposedBranchName: plan.proposedBranchName,
    pullRequestTitle: plan.pullRequestTitle,
    selectedPlanFingerprint: plan.selectedPlanFingerprint,
    files: plan.files.map(file => ({ path: file.path, operation: file.operation, artifactId: file.artifactId, artifactFingerprint: file.artifactFingerprint, finalContentFingerprint: file.finalContentFingerprint, humanReviewAcknowledged: file.humanReviewAcknowledged })),
    operationCounts: plan.operationCounts,
    acknowledgementCount: plan.acknowledgementCount,
    provenanceReferenceCount: plan.provenanceReferenceCount,
    warnings: plan.warnings,
    applyReady: plan.applyReady,
    fingerprint: plan.fingerprint,
  };
}

function successResult(plan: ReturnType<typeof buildRepositoryIntelligenceGithubApplyPlan>, prUrl: string, prNumber: number | undefined, branchName: string, existing: boolean) {
  return {
    mode: 'apply' as const,
    ok: true as const,
    existing,
    prUrl,
    prNumber,
    title: plan.pullRequestTitle,
    repository: `${plan.repository.owner}/${plan.repository.repo}`,
    baseBranch: plan.baseBranch,
    branchName,
    selectedArtifactCount: plan.files.length,
    operationCounts: plan.operationCounts,
    baseline: {
      schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1',
      applySchemaVersion: plan.version,
      pathPolicyVersion: 'shipseal.repository-path-policy.v1',
      repository: plan.repository,
      baseBranch: plan.baseBranch,
      prBranch: branchName,
      selectedPlanFingerprint: plan.selectedPlanFingerprint,
      artifacts: plan.files.map(file => ({
        artifactId: file.artifactId, category: file.category, artifactFingerprint: file.artifactFingerprint,
        targetPath: file.path, operation: file.operation, finalContentFingerprint: file.finalContentFingerprint,
        expectedManagedSectionFingerprint: file.expectedManagedSectionFingerprint,
        expectedPreservationFingerprint: file.expectedPreservationFingerprint,
        preservedLineFingerprints: file.preservedLineFingerprints,
        humanReviewRequired: file.humanReviewAcknowledged || file.statementProvenance.some(statement => statement.humanReviewRequired),
        statements: file.statementProvenance,
      })),
      prUrl,
      prNumber,
    },
  };
}

export class RepositoryIntelligenceApplyServerError extends Error {
  constructor(public readonly issue: RepositoryIntelligenceApplyIssue, public readonly status: number, public readonly issues: RepositoryIntelligenceApplyIssue[] = [issue]) {
    super(issue.message);
    this.name = 'RepositoryIntelligenceApplyServerError';
  }
}

function applyError(code: RepositoryIntelligenceApplyErrorCode, message: string, nextAction: string, status: number) {
  return new RepositoryIntelligenceApplyServerError({ code, message, nextAction }, status);
}

export function normalizeRepositoryIntelligenceGithubError(error: unknown) {
  if (error instanceof RepositoryIntelligenceApplyServerError) return { status: error.status, issue: error.issue, issues: error.issues };
  if (error instanceof GitHubAppNotConfiguredError) return { status: 501, issue: { code: 'github-connection-required' as const, message: 'GitHub App server credentials are not configured.', nextAction: 'Configure or reconnect the ShipSeal GitHub App.' } };
  if (error instanceof GitHubAppApiError) {
    if (error.status === 401) return normalized(401, 'installation-unavailable', 'The GitHub App installation token could not be used.', 'Reconnect GitHub and retry.');
    if (error.status === 403) return error.message.toLowerCase().includes('rate limit')
      ? normalized(429, 'rate-limit', 'GitHub rate limit reached.', 'Wait and retry the unchanged reviewed plan.')
      : normalized(403, 'repository-permission-missing', 'The GitHub App lacks repository write or Pull Request permission.', 'Check Contents and Pull requests permissions, then reconnect.');
    if (error.status === 404) return normalized(404, 'repository-not-found', 'The repository, installation, or base branch is unavailable.', 'Reconnect GitHub, select the repository, and rescan.');
  }
  return normalized(502, 'github-unavailable', 'GitHub could not complete the Repository Intelligence request.', 'Retry, or use the reviewed local preview until GitHub is available.');
}

function normalized(status: number, code: RepositoryIntelligenceApplyErrorCode, message: string, nextAction: string) { return { status, issue: { code, message, nextAction } }; }
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
  if (req.method !== 'POST') return sendJson(res, 405, { error: { code: 'invalid-payload', message: 'Method not allowed.', nextAction: 'Use the Repository Intelligence preview or confirmation action.' } });
  let body: unknown;
  try { body = await readJsonBody(req); } catch (error) { return sendJson(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, { error: { code: 'invalid-payload', message: 'The request is invalid or too large.', nextAction: 'Rebuild a smaller reviewed selection.' } }); }
  const validation = validateRepositoryIntelligenceGithubApplyRequest(body);
  if (!validation.valid || !validation.request) return sendJson(res, 400, { error: validation.issues[0], issues: validation.issues });
  try {
    const result = await prepareOrApplyRepositoryIntelligencePr(validation.request);
    return sendJson(res, 200, result);
  } catch (error) {
    const normalizedError = normalizeRepositoryIntelligenceGithubError(error);
    return sendJson(res, normalizedError.status, { error: normalizedError.issue, ...('issues' in normalizedError ? { issues: normalizedError.issues } : {}) });
  }
}

import { stableContextFingerprint } from '../repositoryIntelligence/contextSelection.js';
import type { OptimizationPackFile } from './repositoryOptimizationApplyContract.js';

export const OPTIMIZATION_GITHUB_APPLY_VERSION = 'shipseal.optimization-github-apply.v1' as const;

export const OPTIMIZATION_GITHUB_APPLY_LIMITS = Object.freeze({
  maximumFiles: 20,
  maximumFileBytes: 128 * 1024,
  maximumTotalBytes: 768 * 1024,
  maximumPathLength: 180,
  maximumPullRequestBodyCharacters: 16_000,
  maximumDiffLines: 400,
});

export type OptimizationGithubApplyAction = Exclude<OptimizationPackFile['action'], 'unavailable'>;
export type OptimizationGithubApplyIssueCode =
  | 'invalid-payload' | 'stale-prepared-plan' | 'repository-mismatch' | 'repository-unavailable'
  | 'repository-read-only' | 'base-branch-missing' | 'unsafe-path' | 'file-limit'
  | 'target-now-exists' | 'target-disappeared' | 'stale-target-file'
  | 'branch-conflict' | 'branch-creation-failed' | 'file-write-failed' | 'partial-write-state'
  | 'pull-request-creation-failed' | 'pull-request-already-exists'
  | 'installation-unavailable' | 'permission-missing' | 'rate-limit' | 'github-unavailable';

export interface OptimizationGithubApplyIssue {
  code: OptimizationGithubApplyIssueCode;
  message: string;
  nextAction: string;
  path?: string;
}

export interface OptimizationGithubPreparedFile {
  artifactId: string;
  path: string;
  action: OptimizationGithubApplyAction;
  readiness: OptimizationPackFile['readiness'];
  nextContent: string;
  contentHash: string;
  sizeBytes: number;
}

export interface OptimizationGithubPreparedSnapshot {
  preparedPlanId: string;
  sourcePlanId: string;
  applyPlanId: string;
  repository: {
    name: string;
    fullName?: string;
    sourceType: string;
    ref?: string;
  };
  selectedProposalIds: string[];
  manifestFingerprint: string;
  suggestedBranchName: string;
  pullRequestTitle: string;
  pullRequestBody: string;
  files: OptimizationGithubPreparedFile[];
  fingerprint: string;
}

export interface OptimizationGithubApplyRequest {
  version: typeof OPTIMIZATION_GITHUB_APPLY_VERSION;
  mode: 'preview' | 'apply';
  installationId: string;
  owner: string;
  repo: string;
  baseBranch: string;
  prepared: OptimizationGithubPreparedSnapshot;
  confirmed: boolean;
  expectedPreviewFingerprint?: string;
  expectedBaseCommit?: string;
}

export interface OptimizationGithubCurrentFile {
  path: string;
  kind: 'missing' | 'file' | 'directory' | 'excluded';
  content?: string;
  sha?: string;
}

export interface OptimizationGithubRepositoryState {
  owner: string;
  repo: string;
  baseBranch: string;
  baseCommit: string;
  archived: boolean;
  disabled: boolean;
  canPush: boolean;
  files: OptimizationGithubCurrentFile[];
  branch?: {
    name: string;
    files: OptimizationGithubCurrentFile[];
  };
  existingPullRequest?: { url: string; number?: number; branchName: string; matching: boolean };
}

export interface OptimizationGithubApplyPlanFile extends OptimizationGithubPreparedFile {
  previousContent?: string;
  previousSha?: string;
  writeSha?: string;
  previousContentHash?: string;
  diff: string;
  addedLines: number;
  removedLines: number;
  diffTruncated: boolean;
  status: 'ready' | 'already-applied' | 'blocked';
  validationMessage: string;
}

export interface OptimizationGithubApplyPlan {
  version: typeof OPTIMIZATION_GITHUB_APPLY_VERSION;
  preparedPlanId: string;
  applyPlanId: string;
  repository: { owner: string; repo: string; baseBranch: string; baseCommit: string };
  branch: {
    suggestedName: string;
    existingState: 'available' | 'matching' | 'partial' | 'conflict';
  };
  files: OptimizationGithubApplyPlanFile[];
  pullRequest: { title: string; body: string };
  summary: {
    totalFiles: number;
    createCount: number;
    updateCount: number;
    strengthenCount: number;
    totalBytes: number;
    alreadyAppliedCount: number;
  };
  validation: { blockingIssues: OptimizationGithubApplyIssue[]; warnings: OptimizationGithubApplyIssue[] };
  existingPullRequest?: OptimizationGithubRepositoryState['existingPullRequest'];
  applyReady: boolean;
  fingerprint: string;
}

export interface OptimizationGithubApplyProgress {
  completedSteps: Array<'validated-repository' | 'created-branch' | 'wrote-files' | 'opened-pull-request'>;
  failedStep?: 'installation-validation' | 'repository-validation' | 'branch-creation' | 'file-write' | 'pull-request-creation';
  writtenFileCount: number;
  totalFileCount: number;
  branchName?: string;
  branchUrl?: string;
  prUrl?: string;
}

export interface OptimizationGithubPreparedPlanSource {
  id: string;
  sourcePlanId: string;
  selectedProposalIds: string[];
  applyPlan: {
    id: string;
    files: OptimizationPackFile[];
    manifest: {
      repository: { name: string; fullName?: string; sourceType: string; ref?: string };
    };
    prPreview: {
      branchName: string;
      title: string;
      body: string;
      files: Array<{
        path: string;
        generatedPath: string;
        action: OptimizationPackFile['action'];
        readiness: OptimizationPackFile['readiness'];
        content: string;
      }>;
    };
  };
}

export function buildOptimizationGithubPreparedSnapshot(prepared: OptimizationGithubPreparedPlanSource): OptimizationGithubPreparedSnapshot {
  const applyPlan = prepared.applyPlan;
  const byPrPath = new Map<string, OptimizationPackFile>(applyPlan.files.map(file => [file.prPath, file]));
  const files = applyPlan.prPreview.files.map(file => {
    const source = byPrPath.get(file.path);
    const action = file.action;
    if (action === 'unavailable') throw new Error(`Blocked artifact cannot enter GitHub apply: ${file.path}`);
    return {
      artifactId: source?.sourceItemId || file.generatedPath,
      path: file.path,
      action,
      readiness: file.readiness,
      nextContent: file.content,
      contentHash: optimizationContentFingerprint(file.content),
      sizeBytes: byteLength(file.content),
    };
  }).sort((left, right) => left.path.localeCompare(right.path) || left.artifactId.localeCompare(right.artifactId));
  const manifestFingerprint = stableContextFingerprint(applyPlan.manifest);
  const operationId = stableContextFingerprint({
    applyPlanId: applyPlan.id,
    manifestFingerprint,
    files: files.map(file => ({ artifactId: file.artifactId, path: file.path, action: file.action, contentHash: file.contentHash })),
  }).slice(0, 12);
  const core = {
    preparedPlanId: prepared.id,
    sourcePlanId: prepared.sourcePlanId,
    applyPlanId: applyPlan.id,
    repository: {
      name: applyPlan.manifest.repository.name,
      fullName: applyPlan.manifest.repository.fullName,
      sourceType: applyPlan.manifest.repository.sourceType,
      ref: applyPlan.manifest.repository.ref,
    },
    selectedProposalIds: [...prepared.selectedProposalIds].sort(),
    manifestFingerprint,
    suggestedBranchName: `${applyPlan.prPreview.branchName}-${operationId}`,
    pullRequestTitle: applyPlan.prPreview.title,
    pullRequestBody: applyPlan.prPreview.body,
    files,
  };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

export function buildOptimizationGithubApplyPlan(input: {
  request: OptimizationGithubApplyRequest;
  currentRepositoryState: OptimizationGithubRepositoryState;
}): OptimizationGithubApplyPlan {
  const validation = validateOptimizationGithubApplyRequest(input.request);
  const blockingIssues = [...validation];
  const warnings: OptimizationGithubApplyIssue[] = [];
  const { request, currentRepositoryState: current } = input;
  const currentByPath = new Map(current.files.map(file => [file.path, file]));
  const branchByPath = new Map(current.branch?.files.map(file => [file.path, file]) || []);

  if (`${current.owner}/${current.repo}`.toLowerCase() !== `${request.owner}/${request.repo}`.toLowerCase()) {
    blockingIssues.push(issue('repository-mismatch', 'The connected repository differs from the reviewed prepared plan.', 'Reconnect and prepare the plan for the selected repository.'));
  }
  if (current.baseBranch !== request.baseBranch) blockingIssues.push(issue('repository-mismatch', 'The selected base branch differs from the reviewed plan.', 'Rescan and reprepare the selected base branch.'));
  if (current.archived || current.disabled) blockingIssues.push(issue('repository-read-only', 'The selected repository is archived or disabled.', 'Use the ZIP fallback or select a writable repository.'));
  if (!current.canPush) blockingIssues.push(issue('permission-missing', 'The GitHub App does not currently have repository write access.', 'Reconnect GitHub with Contents and Pull requests permissions.'));

  const fullName = request.prepared.repository.fullName;
  if (fullName && fullName.toLowerCase() !== `${request.owner}/${request.repo}`.toLowerCase()) {
    blockingIssues.push(issue('repository-mismatch', 'The prepared snapshot belongs to a different repository.', 'Rescan the connected repository and prepare a new plan.'));
  }
  if (request.prepared.repository.ref && request.prepared.repository.ref !== request.baseBranch) {
    blockingIssues.push(issue('repository-mismatch', 'The prepared snapshot used a different repository ref.', 'Rescan the selected base branch and prepare again.'));
  }

  const files = request.prepared.files.map(file => {
    const base = currentByPath.get(file.path) || { path: file.path, kind: 'missing' as const };
    const branch = branchByPath.get(file.path) || { path: file.path, kind: 'missing' as const };
    let fileIssue: OptimizationGithubApplyIssue | undefined;
    if (base.kind === 'directory' || base.kind === 'excluded') fileIssue = issue('stale-target-file', 'The target is not a writable text file.', 'Rescan and prepare a supported repository target.', file.path);
    else if (file.action === 'create' && base.kind !== 'missing') fileIssue = issue('target-now-exists', 'A file now exists at a reviewed create target.', 'Refresh repository state, then rescan and reprepare.', file.path);
    else if (file.action !== 'create' && base.kind === 'missing') fileIssue = issue('target-disappeared', 'A reviewed update target no longer exists.', 'Refresh repository state, then rescan and reprepare.', file.path);
    if (fileIssue) blockingIssues.push(fileIssue);

    const previousContent = base.kind === 'file' ? normalizeContent(base.content || '') : '';
    const nextContent = normalizeContent(file.nextContent);
    const diff = buildOptimizationFileDiff(file.path, previousContent, nextContent);
    let status: OptimizationGithubApplyPlanFile['status'] = fileIssue ? 'blocked' : 'ready';
    let validationMessage = fileIssue?.message || 'Repository target matches the reviewed action.';
    let writeSha = base.sha;
    if (current.branch) {
      const branchContent = branch.kind === 'file' ? normalizeContent(branch.content || '') : '';
      const branchHash = branch.kind === 'file' ? optimizationContentFingerprint(branchContent) : undefined;
      const baseHash = base.kind === 'file' ? optimizationContentFingerprint(previousContent) : undefined;
      if (branchHash === file.contentHash) {
        status = 'already-applied';
        validationMessage = 'The existing ShipSeal branch already contains the reviewed content.';
      } else if ((file.action === 'create' && branch.kind === 'missing') || (file.action !== 'create' && branch.kind === 'file' && branchHash === baseHash)) {
        writeSha = branch.sha;
        validationMessage = 'The existing ShipSeal branch can safely resume this reviewed write.';
      } else {
        const conflict = issue('branch-conflict', 'The existing ShipSeal branch contains content that does not match the base branch or reviewed artifact.', 'Open the existing branch for review or prepare a fresh plan after repository changes.', file.path);
        blockingIssues.push(conflict);
        status = 'blocked';
        validationMessage = conflict.message;
      }
    }
    return {
      ...file,
      nextContent,
      previousContent: base.kind === 'file' ? previousContent : undefined,
      previousSha: base.sha,
      writeSha,
      previousContentHash: base.kind === 'file' ? optimizationContentFingerprint(previousContent) : undefined,
      diff: diff.text,
      addedLines: diff.addedLines,
      removedLines: diff.removedLines,
      diffTruncated: diff.truncated,
      status,
      validationMessage,
    };
  });

  const suggestedName = request.prepared.suggestedBranchName;
  const alreadyAppliedCount = files.filter(file => file.status === 'already-applied').length;
  const branchState: OptimizationGithubApplyPlan['branch']['existingState'] = !current.branch ? 'available'
    : files.some(file => file.status === 'blocked') ? 'conflict'
      : alreadyAppliedCount === files.length ? 'matching' : 'partial';
  if (current.existingPullRequest && !current.existingPullRequest.matching) {
    blockingIssues.push(issue('pull-request-already-exists', 'A different open pull request already uses the reviewed ShipSeal branch.', 'Open the existing pull request or prepare a fresh plan.'));
  }
  const operationCounts = { create: 0, update: 0, strengthen: 0 };
  for (const file of files) operationCounts[file.action] += 1;
  const body = ensurePlanMarker(request.prepared.pullRequestBody, request.prepared.fingerprint).slice(0, OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumPullRequestBodyCharacters);
  const withoutFingerprint = {
    version: OPTIMIZATION_GITHUB_APPLY_VERSION,
    preparedPlanId: request.prepared.preparedPlanId,
    applyPlanId: request.prepared.applyPlanId,
    repository: { owner: request.owner, repo: request.repo, baseBranch: current.baseBranch, baseCommit: current.baseCommit },
    branch: { suggestedName, existingState: branchState },
    files,
    pullRequest: { title: request.prepared.pullRequestTitle, body },
    summary: {
      totalFiles: files.length,
      createCount: operationCounts.create,
      updateCount: operationCounts.update,
      strengthenCount: operationCounts.strengthen,
      totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      alreadyAppliedCount,
    },
    validation: { blockingIssues: dedupeIssues(blockingIssues), warnings },
    existingPullRequest: current.existingPullRequest,
    applyReady: blockingIssues.length === 0 && files.length === request.prepared.files.length,
  };
  return { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) };
}

export function validateOptimizationGithubApplyRequest(input: unknown): OptimizationGithubApplyIssue[] {
  const issues: OptimizationGithubApplyIssue[] = [];
  if (!isRecord(input)) return [issue('invalid-payload', 'The Optimization PR request is invalid.', 'Reopen the prepared plan preview.')];
  if (containsCredentialField(input)) issues.push(issue('invalid-payload', 'GitHub credentials must not be included in the Optimization PR payload.', 'Reconnect with the GitHub App and reopen the prepared plan preview.'));
  const request = input as unknown as OptimizationGithubApplyRequest;
  if (request.version !== OPTIMIZATION_GITHUB_APPLY_VERSION) issues.push(issue('invalid-payload', 'The Optimization PR request version is unsupported.', 'Reopen the prepared plan preview.'));
  if (!['preview', 'apply'].includes(request.mode)) issues.push(issue('invalid-payload', 'The request mode is invalid.', 'Open a fresh PR preview.'));
  if (request.mode === 'preview' && request.confirmed) issues.push(issue('invalid-payload', 'Preview requests cannot confirm a mutation.', 'Open the preview without confirmation.'));
  if (request.mode === 'apply' && (!request.confirmed || !request.expectedPreviewFingerprint || !request.expectedBaseCommit)) issues.push(issue('invalid-payload', 'Apply requires explicit confirmation of the reviewed repository preview.', 'Review the current preview and confirm it again.'));
  if (!/^\d+$/.test(String(request.installationId || ''))) issues.push(issue('installation-unavailable', 'A valid GitHub App installation is required.', 'Reconnect GitHub and select the repository again.'));
  if (!safeRepoPart(request.owner) || !safeRepoPart(request.repo)) issues.push(issue('invalid-payload', 'Repository owner or name is invalid.', 'Select the connected repository again.'));
  if (!safeBranch(request.baseBranch)) issues.push(issue('base-branch-missing', 'A safe base branch is required.', 'Rescan the selected repository branch.'));
  if (!isRecord(request.prepared) || !Array.isArray(request.prepared.files)) return [...issues, issue('invalid-payload', 'The prepared snapshot is missing.', 'Prepare the selected plan again.')];
  const preparedCore = omitFingerprint(request.prepared);
  if (request.prepared.fingerprint !== stableContextFingerprint(preparedCore)) issues.push(issue('stale-prepared-plan', 'The prepared snapshot fingerprint no longer matches its reviewed contents.', 'Reprepare and review the plan.'));
  if (!safeShipSealBranch(request.prepared.suggestedBranchName)) issues.push(issue('invalid-payload', 'The proposed branch is outside the ShipSeal branch namespace.', 'Prepare a new plan.'));
  if (!request.prepared.pullRequestTitle.trim() || !request.prepared.pullRequestBody.trim()) issues.push(issue('invalid-payload', 'Pull request metadata is incomplete.', 'Prepare a new plan.'));
  if (!request.prepared.files.length || request.prepared.files.length > OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumFiles) issues.push(issue('file-limit', `Optimization PRs support 1-${OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumFiles} files.`, 'Reduce the selected artifact set and prepare again.'));
  let totalBytes = 0;
  const paths = new Set<string>();
  for (const file of request.prepared.files) {
    if (!safeRepoPath(file.path) || file.path.length > OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumPathLength) issues.push(issue('unsafe-path', 'An Optimization PR path is unsafe.', 'Remove the artifact and prepare again.', file.path));
    if (paths.has(file.path)) issues.push(issue('invalid-payload', 'The prepared snapshot contains a duplicate target path.', 'Prepare a plan with one artifact per target.', file.path));
    paths.add(file.path);
    if (!['create', 'update', 'strengthen'].includes(file.action)) issues.push(issue('invalid-payload', 'An artifact has an unsupported write action.', 'Remove the artifact and prepare again.', file.path));
    const bytes = byteLength(file.nextContent || '');
    totalBytes += bytes;
    if (!file.nextContent?.trim() || bytes !== file.sizeBytes || file.contentHash !== optimizationContentFingerprint(file.nextContent || '')) issues.push(issue('stale-prepared-plan', 'A prepared artifact no longer matches its reviewed hash and size.', 'Reprepare and review the artifact.', file.path));
    if (bytes > OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumFileBytes) issues.push(issue('file-limit', 'A prepared artifact exceeds the 128 KiB GitHub write limit.', 'Use the ZIP fallback or reduce the artifact size.', file.path));
  }
  if (totalBytes > OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumTotalBytes) issues.push(issue('file-limit', 'The prepared artifact set exceeds the 768 KiB GitHub write limit.', 'Reduce the selected artifact set or use the ZIP fallback.'));
  return dedupeIssues(issues);
}

export function buildOptimizationFileDiff(path: string, previous: string, next: string, maximumLines: number = OPTIMIZATION_GITHUB_APPLY_LIMITS.maximumDiffLines) {
  const previousLines = normalizeContent(previous).split('\n');
  const nextLines = normalizeContent(next).split('\n');
  if (previousLines.at(-1) === '') previousLines.pop();
  if (nextLines.at(-1) === '') nextLines.pop();
  let prefix = 0;
  while (prefix < previousLines.length && prefix < nextLines.length && previousLines[prefix] === nextLines[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previousLines.length - prefix && suffix < nextLines.length - prefix && previousLines[previousLines.length - 1 - suffix] === nextLines[nextLines.length - 1 - suffix]) suffix += 1;
  const removed = previousLines.slice(prefix, previousLines.length - suffix);
  const added = nextLines.slice(prefix, nextLines.length - suffix);
  const changed = [...removed.map(line => `-${line}`), ...added.map(line => `+${line}`)];
  const truncated = changed.length > maximumLines;
  const visible = changed.slice(0, maximumLines);
  return {
    text: [`--- current/${path}`, `+++ prepared/${path}`, `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`, ...visible, ...(truncated ? [`... ${changed.length - visible.length} changed lines omitted by preview limit ...`] : [])].join('\n'),
    addedLines: added.length,
    removedLines: removed.length,
    truncated,
  };
}

export function optimizationContentFingerprint(content: string) {
  return stableContextFingerprint(normalizeContent(content));
}

export function optimizationPlanMarker(fingerprint: string) {
  return `<!-- shipseal:optimization-apply-plan:${fingerprint} -->`;
}

function ensurePlanMarker(body: string, fingerprint: string) {
  const marker = optimizationPlanMarker(fingerprint);
  return body.includes(marker) ? body : `${body.trim()}\n\n${marker}`;
}
function normalizeContent(value: string) { return value.replace(/\r\n?/g, '\n'); }
function byteLength(value: string) { return new TextEncoder().encode(value).byteLength; }
function issue(code: OptimizationGithubApplyIssueCode, message: string, nextAction: string, path?: string): OptimizationGithubApplyIssue { return { code, message, nextAction, ...(path ? { path } : {}) }; }
function dedupeIssues(values: OptimizationGithubApplyIssue[]) { const seen = new Set<string>(); return values.filter(value => { const key = `${value.code}:${value.path || ''}:${value.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function omitFingerprint<T extends { fingerprint: string }>(value: T): Omit<T, 'fingerprint'> { const { fingerprint: _fingerprint, ...rest } = value; return rest; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function containsCredentialField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredentialField);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => /(token|secret|password|credential|privatekey)/i.test(key.replace(/[^a-z]/gi, '')) || containsCredentialField(nested));
}
function safeRepoPart(value: string) { return typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(value); }
function safeBranch(value: string) { return typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..') && !value.startsWith('/') && !value.endsWith('/'); }
function safeShipSealBranch(value: string) { return value.startsWith('shipseal/') && safeBranch(value) && !['main', 'master', 'develop', 'trunk'].includes(value.toLowerCase()); }
function safeRepoPath(value: string) { const lower = String(value || '').toLowerCase(); return Boolean(value) && !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..') && /^[A-Za-z0-9._/-]+$/.test(value) && !lower.startsWith('.git/') && !lower.includes('/node_modules/') && !/(^|\/)\.env($|\.)/.test(lower); }

import type {
  OptimizationGithubApplyIssue,
  OptimizationGithubApplyPlan,
  OptimizationGithubApplyProgress,
  OptimizationGithubApplyRequest,
} from '@/lib/workspace';

export interface OptimizationPrPreviewResponse {
  mode: 'preview';
  plan: OptimizationGithubApplyPlan;
}

export interface OptimizationPrApplyResponse {
  mode: 'apply';
  ok: true;
  existing: boolean;
  resumed: boolean;
  prUrl: string;
  prNumber?: number;
  repository: string;
  baseBranch: string;
  branchName: string;
  fileCount: number;
  operationCounts: { create: number; update: number; strengthen: number };
  preparedPlanId: string;
  applyPlanId: string;
  appliedAt: string;
}

export class OptimizationPrClientError extends Error {
  constructor(
    public readonly issue: OptimizationGithubApplyIssue,
    public readonly status: number,
    public readonly progress?: OptimizationGithubApplyProgress,
    public readonly issues: OptimizationGithubApplyIssue[] = [issue],
  ) {
    super(issue.message);
    this.name = 'OptimizationPrClientError';
  }
}

export async function submitOptimizationPrRequest(
  request: OptimizationGithubApplyRequest,
): Promise<OptimizationPrPreviewResponse | OptimizationPrApplyResponse> {
  const response = await fetch('/api/github-app/create-optimization-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const value = payload && typeof payload === 'object' ? payload as { error?: unknown; issues?: unknown; progress?: unknown } : {};
    const fallback: OptimizationGithubApplyIssue = {
      code: 'github-unavailable',
      message: 'GitHub could not complete the Optimization PR request.',
      nextAction: 'Retry, reconnect GitHub, or download the Optimization Package.',
    };
    const issue = isIssue(value.error) ? value.error : fallback;
    const issues = Array.isArray(value.issues) ? value.issues.filter(isIssue) : [issue];
    throw new OptimizationPrClientError(issue, response.status, isProgress(value.progress) ? value.progress : undefined, issues.length ? issues : [issue]);
  }
  return payload as OptimizationPrPreviewResponse | OptimizationPrApplyResponse;
}

function isIssue(value: unknown): value is OptimizationGithubApplyIssue {
  return Boolean(value) && typeof value === 'object' && typeof (value as OptimizationGithubApplyIssue).code === 'string' && typeof (value as OptimizationGithubApplyIssue).message === 'string' && typeof (value as OptimizationGithubApplyIssue).nextAction === 'string';
}

function isProgress(value: unknown): value is OptimizationGithubApplyProgress {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as OptimizationGithubApplyProgress).completedSteps) && typeof (value as OptimizationGithubApplyProgress).writtenFileCount === 'number';
}


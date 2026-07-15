import type {
  RepositoryIntelligenceApplyIssue,
  RepositoryIntelligenceGithubApplyRequest,
} from '@/lib/repositoryIntelligence';

export interface RepositoryIntelligencePrPreviewResponse {
  mode: 'preview';
  plan: {
    repository: { owner: string; repo: string };
    baseBranch: string;
    baseCommit: string;
    proposedBranchName: string;
    pullRequestTitle: string;
    selectedPlanFingerprint: string;
    files: Array<{ path: string; operation: 'create' | 'update' | 'strengthen'; artifactId: string; finalContentFingerprint: string; humanReviewAcknowledged: boolean }>;
    operationCounts: { create: number; update: number; strengthen: number };
    warnings: string[];
    applyReady: boolean;
    fingerprint: string;
  };
}

export interface RepositoryIntelligencePrApplyResponse {
  mode: 'apply';
  ok: true;
  existing: boolean;
  prUrl: string;
  prNumber?: number;
  title: string;
  repository: string;
  baseBranch: string;
  branchName: string;
  selectedArtifactCount: number;
  operationCounts: { create: number; update: number; strengthen: number };
  baseline: unknown;
}

export class RepositoryIntelligencePrClientError extends Error {
  constructor(public readonly issue: RepositoryIntelligenceApplyIssue, public readonly status: number) {
    super(issue.message);
    this.name = 'RepositoryIntelligencePrClientError';
  }
}

export async function submitRepositoryIntelligencePrRequest(
  request: RepositoryIntelligenceGithubApplyRequest,
): Promise<RepositoryIntelligencePrPreviewResponse | RepositoryIntelligencePrApplyResponse> {
  const response = await fetch('/api/github-app/create-repository-intelligence-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const errorValue = payload && typeof payload === 'object' && 'error' in payload ? (payload as { error?: unknown }).error : undefined;
    const issue = errorValue && typeof errorValue === 'object' ? errorValue as RepositoryIntelligenceApplyIssue : {
      code: 'github-unavailable',
      message: 'GitHub could not prepare the Repository Intelligence Pull Request.',
      nextAction: 'Retry or reconnect GitHub.',
    };
    throw new RepositoryIntelligencePrClientError(issue, response.status);
  }
  return payload as RepositoryIntelligencePrPreviewResponse | RepositoryIntelligencePrApplyResponse;
}

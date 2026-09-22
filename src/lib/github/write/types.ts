export interface CreateReadinessPrFilePayload {
  path: string;
  content: string;
}

export interface CreateReadinessPrPayload {
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName: string;
  prTitle: string;
  prBody: string;
  files: CreateReadinessPrFilePayload[];
  githubToken: string;
}

export interface CreateReadinessPrResponse {
  ok: true;
  pullRequestUrl: string;
  branchName: string;
  baseBranch: string;
  fileCount: number;
}

export interface CreateGitHubAppReadinessPrPayload {
  mode?: 'preview' | 'apply';
  installationId: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName: string;
  prTitle: string;
  prBody: string;
  files: CreateReadinessPrFilePayload[];
  confirmed?: boolean;
  expectedBaseSha?: string;
  reviewFingerprint?: string;
}

export interface CreateGitHubAppReadinessPrResponse {
  ok: true;
  mode?: 'apply';
  prUrl: string;
  branchName: string;
  baseBranch: string;
  fileCount: number;
}

export interface ReadinessPrReviewedFile {
  path: string;
  action: 'create' | 'update';
  beforeContent: string;
  afterContent: string;
  unifiedDiff: string;
  additions: number;
  deletions: number;
  contentFingerprint: string;
}

export interface CreateGitHubAppReadinessPrPreviewResponse {
  ok: true;
  mode: 'preview';
  plan: {
    repository: string;
    baseBranch: string;
    baseSha: string;
    branchName: string;
    prTitle: string;
    files: ReadinessPrReviewedFile[];
    additions: number;
    deletions: number;
    fingerprint: string;
  };
}

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
  installationId: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName: string;
  prTitle: string;
  prBody: string;
  files: CreateReadinessPrFilePayload[];
}

export interface CreateGitHubAppReadinessPrResponse {
  ok: true;
  prUrl: string;
  branchName: string;
  baseBranch: string;
  fileCount: number;
}

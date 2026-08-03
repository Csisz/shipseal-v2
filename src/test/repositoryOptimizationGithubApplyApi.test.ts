import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  OptimizationGithubApplyServerError,
  prepareOrApplyOptimizationPr,
} from '../../api/_routes/github-app/create-optimization-pr';
import {
  OPTIMIZATION_GITHUB_APPLY_VERSION,
  optimizationContentFingerprint,
  type OptimizationGithubApplyRequest,
  type OptimizationGithubPreparedSnapshot,
} from '@/lib/workspace';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { GITHUB_APP_ID: '999', GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() } as NodeJS.ProcessEnv;

function preparedSnapshot(files: Array<{ artifactId: string; path: string; action: 'create' | 'update' | 'strengthen'; content: string }> = [{ artifactId: 'artifact-agents', path: 'AGENTS.md', action: 'create', content: '# ShipSeal agent guidance\n' }]): OptimizationGithubPreparedSnapshot {
  const preparedFiles = files.map(file => ({
    artifactId: file.artifactId,
    path: file.path,
    action: file.action,
    readiness: 'ready' as const,
    nextContent: file.content,
    contentHash: optimizationContentFingerprint(file.content),
    sizeBytes: new TextEncoder().encode(file.content).byteLength,
  }));
  const core = {
    preparedPlanId: 'prepared:plan',
    sourcePlanId: 'source-plan',
    applyPlanId: 'apply-plan',
    repository: { name: 'acme/demo', fullName: 'acme/demo', sourceType: 'github-app', ref: 'main' },
    selectedProposalIds: ['proposal-1'],
    manifestFingerprint: 'manifest-fingerprint',
    suggestedBranchName: 'shipseal/optimization-pack-0123456789ab',
    pullRequestTitle: 'Add ShipSeal optimization pack',
    pullRequestBody: 'ShipSeal prepared reviewed repository improvements. Human review and a later verification scan are required.',
    files: preparedFiles,
  };
  return { ...core, fingerprint: stableContextFingerprint(core) };
}

function request(mode: 'preview' | 'apply', prepared = preparedSnapshot()): OptimizationGithubApplyRequest {
  return {
    version: OPTIMIZATION_GITHUB_APPLY_VERSION,
    mode,
    installationId: '123',
    owner: 'acme',
    repo: 'demo',
    baseBranch: 'main',
    prepared,
    confirmed: mode === 'apply',
    ...(mode === 'apply' ? { expectedPreviewFingerprint: 'replace-from-preview', expectedBaseCommit: 'abcdef1234567890' } : {}),
  };
}

function githubMock(options: {
  baseFiles?: Record<string, string>;
  branchFiles?: Record<string, string>;
  canPush?: boolean;
  archived?: boolean;
  existingPulls?: Array<{ html_url: string; number: number; body: string; head: { ref: string } }>;
  failBranch?: boolean;
  failWriteAt?: number;
  failWriteStatus?: number;
  failPr?: boolean;
} = {}) {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const baseFiles = new Map(Object.entries(options.baseFiles || {}));
  const branchFiles = new Map(Object.entries(options.branchFiles || {}));
  const pulls = [...(options.existingPulls || [])];
  let branchExists = options.branchFiles !== undefined;
  let baseSha = 'abcdef1234567890';
  let writeCount = 0;
  const fetcher = vi.fn(async (urlValue: string, init?: RequestInit) => {
    const url = String(urlValue);
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, body });
    if (url.endsWith('/access_tokens')) return response(201, { token: 'installation-token-secret' });
    if (url.endsWith('/repos/acme/demo')) return response(200, { default_branch: 'main', archived: options.archived === true, disabled: false, permissions: { push: options.canPush !== false } });
    if (url.endsWith('/git/ref/heads/main')) return response(200, { object: { sha: baseSha } });
    if (url.includes('/git/ref/heads/shipseal/optimization-pack-0123456789ab')) return branchExists ? response(200, { object: { sha: 'branch-sha' } }) : response(404, { message: 'Not Found' });
    if (url.includes('/contents/') && method === 'GET') {
      const path = decodeURIComponent(url.split('/contents/')[1].split('?')[0]);
      const ref = decodeURIComponent(new URL(url).searchParams.get('ref') || '');
      const content = ref === 'main' ? baseFiles.get(path) : branchFiles.get(path);
      return content === undefined ? response(404, { message: 'Not Found' }) : response(200, { type: 'file', encoding: 'base64', content: Buffer.from(content).toString('base64'), sha: `${ref || 'base'}-${path}-sha` });
    }
    if (url.includes('/pulls?state=open')) return response(200, pulls);
    if (url.endsWith('/git/refs') && method === 'POST') {
      if (options.failBranch) return response(422, { message: 'branch conflict raw detail' });
      branchExists = true;
      for (const [path, content] of baseFiles) branchFiles.set(path, content);
      return response(201, { ref: 'created' });
    }
    if (url.includes('/contents/') && method === 'PUT') {
      writeCount += 1;
      if (options.failWriteAt === writeCount) return response(options.failWriteStatus || 500, { message: 'secret raw write failure' });
      const path = decodeURIComponent(url.split('/contents/')[1]);
      branchFiles.set(path, Buffer.from(String(body?.content || ''), 'base64').toString('utf8'));
      return response(201, { content: { sha: `written-${writeCount}` } });
    }
    if (url.endsWith('/pulls') && method === 'POST') {
      if (options.failPr) return response(500, { message: 'secret raw pr failure' });
      const pull = { html_url: 'https://github.com/acme/demo/pull/7', number: 7, body: String(body?.body || ''), head: { ref: String(body?.head || '') } };
      pulls.push(pull);
      return response(201, pull);
    }
    return response(500, { message: 'unexpected raw response' });
  });
  return {
    calls,
    baseFiles,
    branchFiles,
    setBaseSha(value: string) { baseSha = value; },
    options: { fetcher: fetcher as never, env },
  };
}

async function previewAndApply(previewRequest: OptimizationGithubApplyRequest, mock: ReturnType<typeof githubMock>) {
  const preview = await prepareOrApplyOptimizationPr(previewRequest, mock.options);
  if (preview.mode !== 'preview') throw new Error('Expected preview.');
  const apply = request('apply', previewRequest.prepared);
  apply.expectedPreviewFingerprint = preview.plan.fingerprint;
  apply.expectedBaseCommit = preview.plan.repository.baseCommit;
  return { preview, apply };
}

function response(status: number, payload: unknown) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => payload } as Response;
}

describe('Optimization GitHub App preview and mutation boundary', () => {
  it('rejects credential-bearing payloads before GitHub authentication', async () => {
    const mock = githubMock();
    const unsafeRequest = { ...request('preview'), githubToken: 'user-provided-pat' } as OptimizationGithubApplyRequest;
    await expect(prepareOrApplyOptimizationPr(unsafeRequest, mock.options)).rejects.toMatchObject({
      status: 400,
      issue: { code: 'invalid-payload' },
    });
    expect(mock.calls).toHaveLength(0);
  });

  it('previews repository state and accurate create diff without repository mutation', async () => {
    const mock = githubMock();
    const result = await prepareOrApplyOptimizationPr(request('preview'), mock.options);
    expect(result.mode).toBe('preview');
    if (result.mode !== 'preview') throw new Error('Expected preview.');
    expect(result.plan).toMatchObject({ applyReady: true, summary: { createCount: 1, totalFiles: 1 }, branch: { existingState: 'available' } });
    expect(result.plan.files[0].diff).toContain('+# ShipSeal agent guidance');
    expect(mock.calls.some(call => ['POST', 'PUT'].includes(call.method) && !call.url.endsWith('/access_tokens'))).toBe(false);
    expect(JSON.stringify(result)).not.toContain('installation-token-secret');
  });

  it('blocks existing create targets and missing update targets during preview', async () => {
    const createMock = githubMock({ baseFiles: { 'AGENTS.md': '# Existing\n' } });
    const createPreview = await prepareOrApplyOptimizationPr(request('preview'), createMock.options);
    if (createPreview.mode !== 'preview') throw new Error('Expected preview.');
    expect(createPreview.plan.validation.blockingIssues).toContainEqual(expect.objectContaining({ code: 'target-now-exists', path: 'AGENTS.md' }));

    const updatePrepared = preparedSnapshot([{ artifactId: 'artifact-readme', path: 'README.md', action: 'update', content: '# Prepared\n' }]);
    const updateMock = githubMock();
    const updatePreview = await prepareOrApplyOptimizationPr(request('preview', updatePrepared), updateMock.options);
    if (updatePreview.mode !== 'preview') throw new Error('Expected preview.');
    expect(updatePreview.plan.validation.blockingIssues).toContainEqual(expect.objectContaining({ code: 'target-disappeared', path: 'README.md' }));
  });

  it('blocks archived or permission-limited repositories before confirmation', async () => {
    const mock = githubMock({ canPush: false, archived: true });
    const result = await prepareOrApplyOptimizationPr(request('preview'), mock.options);
    if (result.mode !== 'preview') throw new Error('Expected preview.');
    expect(result.plan.applyReady).toBe(false);
    expect(result.plan.validation.blockingIssues.map(issue => issue.code)).toEqual(expect.arrayContaining(['repository-read-only', 'permission-missing']));
  });

  it('creates the reviewed branch, writes the exact prepared payload, and opens one PR after confirmation', async () => {
    const mock = githubMock();
    const { preview, apply } = await previewAndApply(request('preview'), mock);
    const result = await prepareOrApplyOptimizationPr(apply, mock.options);
    expect(result).toMatchObject({ mode: 'apply', ok: true, existing: false, fileCount: 1, preparedPlanId: 'prepared:plan' });
    const mutations = mock.calls.filter(call => ['POST', 'PUT'].includes(call.method) && !call.url.endsWith('/access_tokens'));
    expect(mutations.map(call => call.url.split('/repos/acme/demo')[1])).toEqual(['/git/refs', '/contents/AGENTS.md', '/pulls']);
    expect(mutations[1].body?.content).toBe(Buffer.from(preview.plan.files[0].nextContent).toString('base64'));
  });

  it('reports branch creation failure before any file write or pull request', async () => {
    const mock = githubMock({ failBranch: true });
    const { apply } = await previewAndApply(request('preview'), mock);
    await expect(prepareOrApplyOptimizationPr(apply, mock.options)).rejects.toMatchObject({
      issue: { code: 'branch-creation-failed' },
      progress: {
        failedStep: 'branch-creation',
        completedSteps: ['validated-repository'],
        writtenFileCount: 0,
      },
    });
    expect(mock.calls.some(call => call.method === 'PUT')).toBe(false);
    expect(mock.calls.some(call => call.url.endsWith('/pulls') && call.method === 'POST')).toBe(false);
  });

  it('returns an existing matching PR on a repeated confirmation instead of duplicating mutation', async () => {
    const mock = githubMock();
    const { apply } = await previewAndApply(request('preview'), mock);
    await prepareOrApplyOptimizationPr(apply, mock.options);
    const mutationsBeforeRetry = mock.calls.filter(call => ['POST', 'PUT'].includes(call.method) && !call.url.endsWith('/access_tokens')).length;
    const retryPreview = await prepareOrApplyOptimizationPr(request('preview'), mock.options);
    if (retryPreview.mode !== 'preview') throw new Error('Expected preview.');
    const retry = request('apply');
    retry.expectedPreviewFingerprint = retryPreview.plan.fingerprint;
    retry.expectedBaseCommit = retryPreview.plan.repository.baseCommit;
    const result = await prepareOrApplyOptimizationPr(retry, mock.options);
    expect(result).toMatchObject({ mode: 'apply', existing: true, prUrl: 'https://github.com/acme/demo/pull/7' });
    expect(mock.calls.filter(call => ['POST', 'PUT'].includes(call.method) && !call.url.endsWith('/access_tokens')).length).toBe(mutationsBeforeRetry);
  });

  it('resumes a matching existing branch from the next incomplete stage', async () => {
    const prepared = preparedSnapshot([{ artifactId: 'artifact-readme', path: 'README.md', action: 'update', content: '# Prepared\n' }]);
    const mock = githubMock({ baseFiles: { 'README.md': '# Current\n' }, branchFiles: { 'README.md': '# Current\n' } });
    const { preview, apply } = await previewAndApply(request('preview', prepared), mock);
    expect(preview.plan.branch.existingState).toBe('partial');
    const result = await prepareOrApplyOptimizationPr(apply, mock.options);
    expect(result).toMatchObject({ mode: 'apply', resumed: true });
    expect(mock.calls.filter(call => call.url.endsWith('/git/refs') && call.method === 'POST')).toHaveLength(0);
    expect(mock.calls.some(call => call.url.includes('/contents/README.md') && call.method === 'PUT')).toBe(true);
  });

  it('reports exact partial-write state and never opens a PR after a later file fails', async () => {
    const prepared = preparedSnapshot([
      { artifactId: 'artifact-a', path: 'A.md', action: 'create', content: '# A\n' },
      { artifactId: 'artifact-b', path: 'B.md', action: 'create', content: '# B\n' },
    ]);
    const mock = githubMock({ failWriteAt: 2 });
    const { apply } = await previewAndApply(request('preview', prepared), mock);
    await expect(prepareOrApplyOptimizationPr(apply, mock.options)).rejects.toMatchObject({
      issue: { code: 'partial-write-state' },
      progress: { failedStep: 'file-write', writtenFileCount: 1, totalFileCount: 2, branchUrl: expect.stringContaining('/tree/') },
    });
    expect(mock.calls.filter(call => call.url.endsWith('/pulls') && call.method === 'POST')).toHaveLength(0);
  });

  it('preserves rate-limit stage and branch recovery state during file mutation', async () => {
    const prepared = preparedSnapshot([
      { artifactId: 'artifact-a', path: 'AGENTS.md', action: 'create', content: '# A\n' },
    ]);
    const mock = githubMock({ failWriteAt: 1, failWriteStatus: 429 });
    const { apply } = await previewAndApply(request('preview', prepared), mock);
    await expect(prepareOrApplyOptimizationPr(apply, mock.options)).rejects.toMatchObject({
      status: 429,
      issue: { code: 'rate-limit' },
      progress: {
        failedStep: 'file-write',
        completedSteps: ['validated-repository', 'created-branch'],
        writtenFileCount: 0,
        branchName: prepared.suggestedBranchName,
      },
    });
  });

  it('reports PR failure after all reviewed files are present on the branch', async () => {
    const mock = githubMock({ failPr: true });
    const { apply } = await previewAndApply(request('preview'), mock);
    await expect(prepareOrApplyOptimizationPr(apply, mock.options)).rejects.toMatchObject({
      issue: { code: 'pull-request-creation-failed' },
      progress: { failedStep: 'pull-request-creation', writtenFileCount: 1, totalFileCount: 1 },
    });
  });

  it('invalidates confirmation when the base ref changes after preview', async () => {
    const mock = githubMock();
    const { apply } = await previewAndApply(request('preview'), mock);
    mock.setBaseSha('different-base-sha');
    await expect(prepareOrApplyOptimizationPr(apply, mock.options)).rejects.toMatchObject({ issue: { code: 'stale-target-file' }, status: 409 });
    expect(mock.calls.some(call => call.url.endsWith('/git/refs') && call.method === 'POST')).toBe(false);
  });

  it('invalidates an update confirmation when repository content changes after preview', async () => {
    const prepared = preparedSnapshot([{ artifactId: 'artifact-readme', path: 'README.md', action: 'update', content: '# Prepared\n' }]);
    const mock = githubMock({ baseFiles: { 'README.md': '# Current\n' } });
    const { apply } = await previewAndApply(request('preview', prepared), mock);
    mock.baseFiles.set('README.md', '# Changed after preview\n');
    await expect(prepareOrApplyOptimizationPr(apply, mock.options)).rejects.toMatchObject({
      issue: { code: 'stale-target-file' },
      status: 409,
    });
    expect(mock.calls.some(call => call.method === 'PUT')).toBe(false);
  });

  it('requires explicit confirmation and the exact reviewed preview identity', async () => {
    const invalid = request('apply');
    invalid.confirmed = false;
    await expect(prepareOrApplyOptimizationPr(invalid, githubMock().options)).rejects.toBeInstanceOf(OptimizationGithubApplyServerError);
  });
});

import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { prepareOrApplyRepositoryIntelligencePr } from '../../api/_routes/github-app/create-repository-intelligence-pr';
import {
  REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_REVIEW_VERSION,
  REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
  type RepositoryIntelligenceGithubApplyRequest,
  validateRepositoryIntelligenceVerificationBaseline,
} from '@/lib/repositoryIntelligence';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';

function makeRequest(mode: 'preview' | 'apply'): RepositoryIntelligenceGithubApplyRequest {
  const artifact = {
    artifactId: 'artifact-create', category: 'architecture-memory' as const, targetPath: 'AGENT_MEMORY/ARCHITECTURE.md', operation: 'create' as const,
    content: '# Repository Architecture\n\n- `src/main.tsx` is the application entry point.\n', applyRepresentation: 'create-file' as const,
    contentFingerprint: stableContextFingerprint('# Repository Architecture\n\n- `src/main.tsx` is the application entry point.\n'),
    expectedFileState: { presence: 'missing' as const, ownership: 'missing' as const, preservationMode: 'create-new' as const },
    artifactFingerprint: 'artifactfingerprint1', statementProvenance: [{ statementId: 'statement', statementType: 'repository-fact' as const, statementText: 'src/main.tsx is an application entry point.', validationState: 'verified' as const, evidenceIds: ['evidence'], findingIds: [], referencedPaths: ['src/main.tsx'], humanReviewRequired: false }],
  };
  const selected = {
    version: REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
    artifactSchemaVersion: REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
    reviewVersion: REPOSITORY_INTELLIGENCE_REVIEW_VERSION,
    repository: { name: 'demo', sourceType: 'github-app' as const, fullName: 'acme/demo', ref: 'main' },
    repositoryIdentityFingerprint: 'repository', scanIdentity: 'scan', artifactSetFingerprint: 'set',
    selectedPlanFingerprint: '0123456789abcdef0123456789abcdef', artifacts: [artifact],
  };
  const selectedPayload = { ...selected, fingerprint: stableContextFingerprint(selected) };
  return { version: REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION, mode, confirmed: mode === 'apply', installationId: '123', owner: 'acme', repo: 'demo', baseBranch: 'main', analysisMode: 'deterministic-repository-evidence', selectedPayload };
}

function githubMock(options: { existingPulls?: unknown[]; failWrite?: boolean } = {}) {
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const fetcher = vi.fn(async (urlValue: string, init?: RequestInit) => {
    const url = String(urlValue); const method = init?.method || 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/access_tokens')) return response(201, { token: 'installation-token-secret' });
    if (url.endsWith('/repos/acme/demo')) return response(200, { default_branch: 'main' });
    if (url.endsWith('/git/ref/heads/main')) return response(200, { object: { sha: 'abcdef1234567890' } });
    if (url.includes('/contents/AGENT_MEMORY/ARCHITECTURE.md?ref=main')) return response(404, { message: 'Not Found' });
    if (url.includes('/pulls?state=open')) return response(200, options.existingPulls || []);
    if (url.endsWith('/git/refs')) return response(201, { ref: 'created' });
    if (url.includes('/contents/AGENT_MEMORY/ARCHITECTURE.md') && method === 'PUT') return options.failWrite ? response(500, { message: 'raw secret failure' }) : response(201, { content: { sha: 'new' } });
    if (url.endsWith('/pulls') && method === 'POST') return response(201, { html_url: 'https://github.com/acme/demo/pull/7', number: 7 });
    return response(500, { message: 'unexpected secret raw message' });
  });
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { calls, options: { fetcher: fetcher as never, env: { GITHUB_APP_ID: '999', GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() } as NodeJS.ProcessEnv } };
}

function response(status: number, payload: unknown) { return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => payload } as Response; }

describe('Repository Intelligence GitHub App mutation boundary', () => {
  it('previews by reading only selected base-branch targets and performs no mutation', async () => {
    const mock = githubMock();
    const result = await prepareOrApplyRepositoryIntelligencePr(makeRequest('preview'), mock.options);
    expect(result.mode).toBe('preview');
    expect(mock.calls.some(call => ['POST', 'PUT'].includes(call.method) && !call.url.endsWith('/access_tokens'))).toBe(false);
    expect(JSON.stringify(result)).not.toContain('installation-token-secret');
    expect(JSON.stringify(result)).not.toContain('# Repository Architecture');
  });

  it('creates the branch, writes exactly selected files, then opens one PR after confirmation', async () => {
    const mock = githubMock();
    const result = await prepareOrApplyRepositoryIntelligencePr(makeRequest('apply'), mock.options);
    expect(result.mode).toBe('apply');
    if (result.mode !== 'apply') throw new Error('Expected apply response.');
    expect(result).toMatchObject({ mode: 'apply', ok: true, prUrl: 'https://github.com/acme/demo/pull/7', selectedArtifactCount: 1 });
    expect(validateRepositoryIntelligenceVerificationBaseline(result.baseline).valid).toBe(true);
    const mutationCalls = mock.calls.filter(call => ['POST', 'PUT'].includes(call.method) && !call.url.endsWith('/access_tokens'));
    expect(mutationCalls.map(call => call.url.split('/repos/acme/demo')[1])).toEqual(['/git/refs', '/contents/AGENT_MEMORY/ARCHITECTURE.md', '/pulls']);
    expect(mutationCalls[1].body.content).toBe(Buffer.from(makeRequest('apply').selectedPayload.artifacts[0].content, 'utf8').toString('base64'));
    expect(JSON.stringify(result)).not.toContain('installation-token-secret');
  });

  it('returns an equivalent open PR instead of creating a duplicate', async () => {
    const reviewed = makeRequest('apply');
    const mock = githubMock({ existingPulls: [{ html_url: 'https://github.com/acme/demo/pull/3', number: 3, body: `<!-- shipseal:repository-intelligence-plan:${reviewed.selectedPayload.selectedPlanFingerprint} -->`, head: { ref: 'shipseal/existing' } }] });
    const result = await prepareOrApplyRepositoryIntelligencePr(reviewed, mock.options);
    expect(result).toMatchObject({ existing: true, prUrl: 'https://github.com/acme/demo/pull/3', branchName: 'shipseal/existing' });
    expect(mock.calls.some(call => call.url.endsWith('/git/refs'))).toBe(false);
  });

  it('never opens a PR after a file-write failure and does not expose the raw GitHub response', async () => {
    const mock = githubMock({ failWrite: true });
    await expect(prepareOrApplyRepositoryIntelligencePr(makeRequest('apply'), mock.options)).rejects.toMatchObject({ issue: { code: 'file-write-failed' } });
    expect(mock.calls.filter(call => call.url.endsWith('/pulls') && call.method === 'POST')).toHaveLength(0);
  });
});

import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import repositoryEvidenceHandler from '../../api/repository-evidence';
import { importGitHubAppEvidence, importPublicGitHubEvidence, type GitHubImportError } from '@/lib/github/githubImport';
import { validateRepositoryEvidenceApiSuccess, type RepositoryEvidenceApiSuccess } from '@/lib/github/repositoryEvidenceApiContract';
import { LocalScanEngine } from '@/lib/scanEngine';
import { createEmptyScanSummary } from '@/lib/scannerLimits';
import type { RepoScanInput, ScanSourceMetadata } from '@/lib/types';

const COMMIT_SHA = 'a'.repeat(40);
const TREE_SHA = 'b'.repeat(40);
const BLOB_SHA = 'c'.repeat(40);

afterEach(() => vi.unstubAllGlobals());

describe('repository evidence API contract', () => {
  it('accepts the canonical HTTP 200 response and sends prepared evidence directly to the scanner', async () => {
    const payload = successPayload('github-public');
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse(payload));
    vi.stubGlobal('fetch', fetcher);

    const imported = await importPublicGitHubEvidence({ url: 'https://github.com/Csisz/portfolio_tracker', branch: 'main' });
    const report = await new LocalScanEngine().scan({
      preparedEvidence: imported.scanInput,
      mode: 'github-public',
      source: imported.scanInput.source,
    });

    expect(imported).toEqual(payload);
    expect(report.repoName).toBe('Csisz/portfolio_tracker');
    expect(report.scanSummary.sourceCommitSha).toBe(COMMIT_SHA);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe('/api/repository-evidence');
    expect(fetcher.mock.calls.some(call => /archive|zipball|codeload/i.test(String(call[0])))).toBe(false);
  });

  it('rejects the old input alias as an internal contract error', async () => {
    const canonical = successPayload('github-public');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      input: canonical.scanInput,
      commitSha: canonical.commitSha,
      requestCount: canonical.requestCount,
    })));

    await expect(importPublicGitHubEvidence({ url: 'https://github.com/Csisz/portfolio_tracker' }))
      .rejects.toMatchObject({
        category: 'repository-evidence-contract-error',
        message: 'ShipSeal received an unexpected repository-index response. Please retry.',
        repositoryEvidenceDiagnostics: {
          httpStatus: 200,
          contentType: 'application/json; charset=utf-8',
          responseCategory: 'contract_validation_failed',
        },
      } satisfies Partial<GitHubImportError>);
  });

  it.each([
    ['short commit SHA', (payload: Record<string, unknown>) => { payload.commitSha = 'abc'; }],
    ['fractional request count', (payload: Record<string, unknown>) => { payload.requestCount = 1.5; }],
    ['missing file array', (payload: Record<string, unknown>) => { (payload.scanInput as Record<string, unknown>).files = null; }],
    ['non-object text contents', (payload: Record<string, unknown>) => { (payload.scanInput as Record<string, unknown>).textContents = []; }],
    ['empty repository name', (payload: Record<string, unknown>) => { (payload.scanInput as Record<string, unknown>).repoName = ' '; }],
    ['mismatched scan summary identity', (payload: Record<string, unknown>) => {
      const scanInput = payload.scanInput as Record<string, unknown>;
      (scanInput.scanSummary as Record<string, unknown>).sourceRequestCount = 8;
    }],
  ] as const)('rejects structurally invalid success payloads: %s', (_label, mutate) => {
    const payload = structuredClone(successPayload('github-public')) as unknown as Record<string, unknown>;
    mutate(payload);
    expect(validateRepositoryEvidenceApiSuccess(payload)).toMatchObject({ valid: false });
  });

  it('rejects an HTML HTTP 200 response without parsing it as GitHub success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<body>SPA shell</body>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })));

    await expect(importPublicGitHubEvidence({ url: 'https://github.com/Csisz/portfolio_tracker' }))
      .rejects.toMatchObject({
        category: 'repository-evidence-contract-error',
        message: 'ShipSeal received an unexpected repository-index response. Please retry.',
        repositoryEvidenceDiagnostics: {
          httpStatus: 200,
          contentType: 'text/html; charset=utf-8',
          responseCategory: 'non_json_response',
        },
      } satisfies Partial<GitHubImportError>);
  });

  it('uses the same response contract for connected GitHub App evidence', async () => {
    const payload = successPayload('github-app');
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse(payload));
    vi.stubGlobal('fetch', fetcher);

    const imported = await importGitHubAppEvidence({
      installationId: '12345', owner: 'Csisz', repo: 'Cantu', ref: 'main',
    });

    expect(imported).toEqual(payload);
    expect(imported.scanInput.source).toMatchObject({ sourceType: 'github-app', githubInstallationId: '12345' });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      source: 'github-app', installationId: '12345', owner: 'Csisz', repo: 'Cantu', ref: 'main',
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('/api/repository-evidence');
  });

  it.each([
    ['repository_not_found', 'repo-not-found'],
    ['permission_denied', 'repository-evidence-permission-denied'],
    ['rate_limited', 'repository-evidence-rate-limited'],
    ['service_unavailable', 'repository-evidence-service-unavailable'],
    ['safety_budget_reached', 'repository-evidence-budget-reached'],
  ] as const)('maps %s failures without reporting a misleading HTTP 200 GitHub error', async (serverCategory, clientCategory) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Safe server failure.', category: serverCategory }, 503)));
    await expect(importPublicGitHubEvidence({ url: 'https://github.com/Csisz/portfolio_tracker' }))
      .rejects.toMatchObject({ category: clientCategory } satisfies Partial<GitHubImportError>);
  });

  it('emits the canonical scanInput field from the server handler', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/commits/')) return jsonResponse({ sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } });
      if (url.includes('/git/trees/')) return jsonResponse({ truncated: false, tree: [
        { path: 'README.md', type: 'blob', sha: BLOB_SHA, size: 20 },
      ] });
      if (url.includes('/git/blobs/')) return jsonResponse({ encoding: 'base64', content: Buffer.from('# Repository').toString('base64') });
      return jsonResponse({ message: 'not found' }, 404);
    }));
    const req = Readable.from([JSON.stringify({ source: 'public-github', owner: 'Csisz', repo: 'portfolio_tracker', ref: 'main' })]);
    Object.assign(req, { method: 'POST', url: '/api/repository-evidence' });
    const res = responseStub();

    await repositoryEvidenceHandler(req as never, res as never);

    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body) as unknown;
    expect(validateRepositoryEvidenceApiSuccess(payload)).toMatchObject({ valid: true });
    expect(payload).not.toHaveProperty('input');
    expect(payload).toHaveProperty('scanInput');
  });
});

function successPayload(sourceType: 'github-public' | 'github-app'): RepositoryEvidenceApiSuccess {
  const source: ScanSourceMetadata = {
    sourceType,
    githubOwner: 'Csisz',
    githubRepo: sourceType === 'github-app' ? 'Cantu' : 'portfolio_tracker',
    githubBranch: 'main',
    ...(sourceType === 'github-app' ? { githubInstallationId: '12345' } : {}),
  };
  const scanInput: RepoScanInput = {
    repoName: `Csisz/${source.githubRepo}`,
    source,
    files: [
      { path: 'README.md', size: 15 },
      { path: 'package.json', size: 62 },
      { path: 'src/index.ts', size: 23 },
    ],
    textContents: {
      'README.md': '# Repository',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
      'src/index.ts': 'export const ok = true;',
    },
    scanSummary: {
      ...createEmptyScanSummary(),
      totalFilesFound: 3,
      discoveredFiles: 3,
      selectedTextFiles: 3,
      analyzedTextFiles: 3,
      filesAnalyzed: 3,
      representedFiles: 3,
      sourceCommitSha: COMMIT_SHA,
      sourceRequestCount: 7,
    },
  };
  return { scanInput, commitSha: COMMIT_SHA, requestCount: 7 };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function responseStub() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string | string[]) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
  };
}

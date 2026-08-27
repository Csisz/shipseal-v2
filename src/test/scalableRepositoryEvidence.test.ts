import { generateKeyPairSync } from 'node:crypto';
import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireGitHubRepositoryEvidence } from '../../api/repository-evidence';
import { buildReport } from '@/lib/readiness';
import { selectRepositoryEvidence } from '@/lib/repositoryEvidence';
import { LocalScanEngine } from '@/lib/scanEngine';
import { scanZipFile } from '@/lib/scanner';
import { createEmptyScanSummary } from '@/lib/scannerLimits';

const COMMIT_SHA = 'a'.repeat(40);
const TREE_SHA = 'b'.repeat(40);
const BLOB_SHA = 'c'.repeat(40);
const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('scalable repository evidence', () => {
  it('selects high-value evidence deterministically and distributes a monorepo budget across areas', () => {
    const entries = [
      { path: 'README.md', size: 500 },
      { path: 'package.json', size: 500 },
      { path: 'tsconfig.json', size: 500 },
      ...Array.from({ length: 24 }, (_, index) => ({ path: `packages/p${String(index).padStart(2, '0')}/src/index.ts`, size: 100 })),
    ];
    const first = selectRepositoryEvidence(entries, { maximumFiles: 10, maximumBytes: 10_000 });
    const second = selectRepositoryEvidence([...entries].reverse(), { maximumFiles: 10, maximumBytes: 10_000 });
    expect(first.selected.map(entry => entry.path)).toEqual(second.selected.map(entry => entry.path));
    expect(first.selected.map(entry => entry.path)).toEqual(expect.arrayContaining(['README.md', 'package.json', 'tsconfig.json']));
    expect(new Set(first.selected.filter(entry => entry.path.startsWith('packages/')).map(entry => entry.path.split('/').slice(0, 2).join('/'))).size).toBeGreaterThan(4);
    expect(first.summary.scanMode).toBe('bounded');
  });

  it('indexes a >5000-file, >25 MB-equivalent GitHub tree without requesting an archive', async () => {
    const tree = Array.from({ length: 6_001 }, (_, index) => ({
      path: `packages/pkg-${String(index).padStart(4, '0')}/src/index.ts`,
      type: 'blob', sha: BLOB_SHA, size: 50_000,
    }));
    tree.push({ path: 'README.md', type: 'blob', sha: BLOB_SHA, size: 500 } as never);
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      calls.push(value);
      if (value.includes('/commits/')) return json({ sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } });
      if (value.includes('/git/trees/')) return json({ sha: TREE_SHA, truncated: false, tree });
      if (value.includes('/git/blobs/')) return json({ encoding: 'base64', content: Buffer.from('export const value = true;').toString('base64'), size: 26 });
      return new Response(null, { status: 404 });
    });
    const result = await acquireGitHubRepositoryEvidence(
      { source: 'public-github', owner: 'Csisz', repo: 'large-repo', ref: 'main' },
      { fetcher: fetcher as typeof fetch },
    );
    expect(result.scanInput.scanSummary).toMatchObject({ scanMode: 'bounded', discoveredFiles: 6002 });
    expect(result.scanInput.files.length).toBeLessThan(400);
    expect(result.scanInput.scanSummary?.analyzedTextFiles).toBeGreaterThan(1);
    expect(calls.some(url => /zipball|codeload|github-archive/.test(url))).toBe(false);
    expect(calls.filter(url => url.includes('/git/blobs/')).length).toBeLessThanOrEqual(320);
  });

  it('keeps connected GitHub App intake on installation-authenticated selective evidence through report creation', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env = {
      ...ORIGINAL_ENV,
      GITHUB_APP_ID: '999',
      GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
    };
    const calls: Array<{ url: string; authorization: string }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('authorization') || '';
      calls.push({ url, authorization });
      if (url.endsWith('/app/installations/12345/access_tokens')) {
        expect(init?.method).toBe('POST');
        expect(authorization).toMatch(/^Bearer [^.]+\.[^.]+\.[^.]+$/);
        return json({ token: 'installation-token' }, 201);
      }
      expect(authorization).toBe('Bearer installation-token');
      if (url.includes('/commits/')) return json({ sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } });
      if (url.includes('/git/trees/')) return json({ truncated: false, tree: [
        { path: 'README.md', type: 'blob', sha: BLOB_SHA, size: 20 },
        { path: 'package.json', type: 'blob', sha: 'd'.repeat(40), size: 40 },
        { path: 'src/index.ts', type: 'blob', sha: 'e'.repeat(40), size: 30 },
      ] });
      if (url.includes('/git/blobs/')) return json({
        encoding: 'base64',
        content: Buffer.from(url.endsWith(BLOB_SHA) ? '# Cantu' : 'export const ready = true;').toString('base64'),
      });
      return json({ message: 'not found' }, 404);
    });

    const acquired = await acquireGitHubRepositoryEvidence(
      { source: 'github-app', installationId: '12345', owner: 'Csisz', repo: 'Cantu', ref: 'main' },
      { fetcher: fetcher as typeof fetch },
    );
    const report = await new LocalScanEngine().scan({
      preparedEvidence: acquired.scanInput,
      mode: 'github-public',
      source: acquired.scanInput.source,
    });

    expect(acquired.commitSha).toBe(COMMIT_SHA);
    expect(acquired.scanInput.scanSummary?.sourceCommitSha).toBe(COMMIT_SHA);
    expect(acquired.scanInput.source).toMatchObject({ sourceType: 'github-app', githubInstallationId: '12345' });
    expect(report.repoName).toBe('Csisz/Cantu');
    expect(report.scanSummary.sourceCommitSha).toBe(COMMIT_SHA);
    expect(calls.some(call => /archive|zipball|codeload/i.test(call.url))).toBe(false);
    expect(calls.filter(call => call.url.includes('/git/blobs/')).length).toBeGreaterThan(0);
  });

  it('prunes generated/vendor content before GitHub blob reads', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes('/commits/')) return json({ sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } });
      if (value.includes('/git/trees/')) return json({ truncated: false, tree: [
        { path: 'README.md', type: 'blob', sha: BLOB_SHA, size: 20 },
        { path: 'node_modules/vendor/index.js', type: 'blob', sha: 'd'.repeat(40), size: 20 },
        { path: 'dist/bundle.js', type: 'blob', sha: 'e'.repeat(40), size: 20 },
      ] });
      if (value.includes(`/git/blobs/${BLOB_SHA}`)) return json({ encoding: 'base64', content: Buffer.from('# Readme').toString('base64') });
      throw new Error(`Generated blob was read: ${value}`);
    });
    const result = await acquireGitHubRepositoryEvidence(
      { source: 'public-github', owner: 'Csisz', repo: 'generated-heavy' },
      { fetcher: fetcher as typeof fetch },
    );
    expect(result.scanInput.scanSummary?.generatedVendorFilesIgnored).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('recovers truncated recursive trees through bounded subtree traversal and prunes generated subtrees', async () => {
    const appTreeSha = 'd'.repeat(40);
    const generatedTreeSha = 'e'.repeat(40);
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      calls.push(value);
      if (value.includes('/commits/')) return json({ sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } });
      if (value.endsWith(`/git/trees/${TREE_SHA}?recursive=1`)) return json({ sha: TREE_SHA, truncated: true, tree: [] });
      if (value.endsWith(`/git/trees/${TREE_SHA}`)) return json({ tree: [
        { path: 'README.md', type: 'blob', sha: BLOB_SHA, size: 20 },
        { path: 'apps', type: 'tree', sha: appTreeSha },
        { path: 'node_modules', type: 'tree', sha: generatedTreeSha },
      ] });
      if (value.endsWith(`/git/trees/${appTreeSha}`)) return json({ tree: [
        { path: 'index.ts', type: 'blob', sha: 'f'.repeat(40), size: 30 },
      ] });
      if (value.includes('/git/blobs/')) return json({ encoding: 'base64', content: Buffer.from('export const ready = true;').toString('base64') });
      throw new Error(`Unexpected GitHub request: ${value}`);
    });

    const result = await acquireGitHubRepositoryEvidence(
      { source: 'public-github', owner: 'Csisz', repo: 'truncated-tree' },
      { fetcher: fetcher as typeof fetch },
    );

    expect(result.scanInput.scanSummary).toMatchObject({ discoveryComplete: true, discoveredFiles: 2 });
    expect(calls.some(url => url.endsWith(`/git/trees/${generatedTreeSha}`))).toBe(false);
    expect(Object.keys(result.scanInput.textContents)).toEqual(expect.arrayContaining(['README.md', 'apps/index.ts']));
  });

  it('reads a large local ZIP selectively without calling whole-file arrayBuffer', async () => {
    const zip = new JSZip();
    zip.file('repo/README.md', '# Large local repository');
    for (let index = 0; index < 80; index += 1) zip.file(`repo/packages/p${index}/src/index.ts`, `export const value${index} = '${'x'.repeat(40_000)}';`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const file = new File([blob], 'large-local.zip', { type: 'application/zip' });
    Object.defineProperty(file, 'arrayBuffer', { value: () => { throw new Error('whole-file arrayBuffer must not be used'); } });
    const result = await scanZipFile(file);
    expect(result.scanSummary?.scanMode).toBe('bounded');
    expect(result.scanSummary?.budgetExcludedFiles).toBeGreaterThan(0);
    expect(result.textContents['README.md']).toContain('Large local repository');
  });

  it('rejects suspicious archive expansion safely', async () => {
    const zip = new JSZip();
    zip.file('repo/docs/repeated.txt', 'A'.repeat(2 * 1024 * 1024));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    await expect(scanZipFile(new File([blob], 'bomb.zip', { type: 'application/zip' })))
      .rejects.toThrow(/compression ratio/i);
  });

  it('treats absent evidence as unobserved when discovery was incomplete', () => {
    const report = buildReport({
      repoName: 'limited-repository',
      files: [{ path: 'README.md', size: 20 }],
      textContents: { 'README.md': '# Observed evidence' },
      scanSummary: {
        ...createEmptyScanSummary(),
        scanMode: 'limited-fallback', discoveryComplete: false,
        discoveredFiles: 1, discoveredDirectories: 0, eligibleTextFiles: 1,
        selectedTextFiles: 1, analyzedTextFiles: 1, analyzedTextBytes: 19,
        generatedVendorFilesIgnored: 0, binaryFilesIgnored: 0, oversizedTextFilesIgnored: 0,
        budgetExcludedFiles: 0, boundedReasons: ['GitHub discovery was incomplete.'],
        selectionPolicyVersion: 'shipseal.repository-evidence.v1', representedFiles: 1,
      },
    });
    expect(report.blockers.map(blocker => blocker.id)).not.toEqual(expect.arrayContaining(['no_stack', 'no_build_test_lint', 'no_agent_context']));
    expect(report.improvements).toHaveLength(0);
    expect(report.categories.flatMap(category => category.items).filter(item => !item.passed))
      .toEqual(expect.arrayContaining([expect.objectContaining({ observed: false })]));
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '4000' },
  });
}

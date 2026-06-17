import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import {
  buildGitHubArchiveProxyUrl,
  buildGitHubCodeloadUrl,
  buildGitHubProxyImportUrl,
  buildGitHubZipUrl,
  GitHubImportError,
  importGitHubAppRepoArchive,
  importPublicGitHubRepo,
} from '@/lib/github/githubImport';
import { LocalScanEngine } from '@/lib/scanEngine';
import type { ScanSourceMetadata } from '@/lib/types';
import JSZip from 'jszip';

async function demoZipFile(name = 'shipseal-main.zip') {
  const zip = new JSZip();
  zip.file('shipseal-main/package.json', JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }));
  zip.file('shipseal-main/README.md', '# ShipSeal\n\n## Overview\nDemo public repo.\n\n## Setup\nnpm install\n');
  zip.file('shipseal-main/src/index.ts', 'export const ok = true;');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const file = new File([bytes], name, { type: 'application/zip' }) as File & { __zipBytes?: Uint8Array };
  file.__zipBytes = bytes;
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) });
  return file;
}

async function zipResponse(file: File, headers: Headers) {
  const bytes = (file as File & { __zipBytes?: Uint8Array }).__zipBytes;
  return new Response(bytes || await file.arrayBuffer(), { status: 200, headers });
}

describe('public GitHub import helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses supported public GitHub URL formats', () => {
    for (const value of [
      'https://github.com/Csisz/shipseal',
      'https://github.com/Csisz/shipseal.git',
      'github.com/Csisz/shipseal',
    ]) {
      const parsed = parseGitHubUrl(value);

      expect(parsed.owner).toBe('Csisz');
      expect(parsed.repo).toBe('shipseal');
      expect(parsed.normalizedUrl).toBe('https://github.com/Csisz/shipseal');
    }
  });

  it('returns invalid URL errors for unsupported values', () => {
    expect(() => parseGitHubUrl('not a repo')).toThrow('whitespace');
    expect(() => parseGitHubUrl('https://gitlab.com/Csisz/shipseal')).toThrow('Only public github.com');
  });

  it('builds a codeload ZIP URL for default and explicit branches', () => {
    expect(buildGitHubCodeloadUrl('Csisz', 'shipseal', 'main')).toBe('https://codeload.github.com/Csisz/shipseal/zip/main');
    expect(buildGitHubZipUrl('Csisz', 'shipseal')).toBe('https://codeload.github.com/Csisz/shipseal/zip/HEAD');
    expect(buildGitHubZipUrl('Csisz', 'shipseal', 'main')).toBe('https://codeload.github.com/Csisz/shipseal/zip/refs/heads/main');
  });

  it('builds a future same-origin proxy import URL', () => {
    expect(buildGitHubArchiveProxyUrl('Csisz', 'shipseal', 'main')).toBe('/api/github-archive?owner=Csisz&repo=shipseal&ref=main');
    expect(buildGitHubProxyImportUrl('Csisz', 'shipseal', 'main')).toBe('/api/github-archive?owner=Csisz&repo=shipseal&ref=main');
    expect(buildGitHubProxyImportUrl('Csisz', 'shipseal')).toBe('/api/github-archive?owner=Csisz&repo=shipseal');
  });

  it('keeps github-url source metadata when public import succeeds', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size) });
    const fetchMock = vi.fn(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    const imported = await importPublicGitHubRepo({ url: 'github.com/Csisz/shipseal', branch: 'main' });

    expect(fetchMock).toHaveBeenCalledWith('/api/github-archive?owner=Csisz&repo=shipseal&ref=main', { method: 'GET', redirect: 'follow' });
    expect(imported.file.name).toBe('Csisz-shipseal-main.zip');
    expect(imported.source).toMatchObject({
      sourceType: 'github-url',
      githubOwner: 'Csisz',
      githubRepo: 'shipseal',
      githubBranch: 'main',
      sourceUrl: 'https://github.com/Csisz/shipseal/tree/main',
    } satisfies ScanSourceMetadata);
  });

  it('can import through the same-origin proxy strategy', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size) });
    const fetchMock = vi.fn(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    const imported = await importPublicGitHubRepo({
      url: 'github.com/Csisz/shipseal',
      branch: 'main',
      strategy: 'same-origin-proxy',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/github-archive?owner=Csisz&repo=shipseal&ref=main', { method: 'GET', redirect: 'follow' });
    expect(imported.source.sourceType).toBe('github-url');
  });

  it('uses the same-origin proxy first by default with HEAD ref', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size) });
    const fetchMock = vi.fn(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    await importPublicGitHubRepo({ url: 'github.com/Csisz/shipseal' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/github-archive?owner=Csisz&repo=shipseal&ref=HEAD', { method: 'GET', redirect: 'follow' });
  });

  it('falls back to direct codeload after a proxy error', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size) });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'proxy unavailable' }), { status: 502 }))
      .mockImplementationOnce(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    const imported = await importPublicGitHubRepo({ url: 'github.com/Csisz/shipseal' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/github-archive?owner=Csisz&repo=shipseal&ref=HEAD', { method: 'GET', redirect: 'follow' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://codeload.github.com/Csisz/shipseal/zip/HEAD', { method: 'GET', redirect: 'follow' });
    expect(imported.source.sourceType).toBe('github-url');
  });

  it('falls back to direct codeload when the proxy returns an HTML app shell with HTTP 200', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size), 'content-type': 'application/zip' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('<!doctype html><html><body>Vite app</body></html>', {
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
      }))
      .mockImplementationOnce(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    const imported = await importPublicGitHubRepo({ url: 'github.com/Csisz/shipseal' });
    const report = await new LocalScanEngine().scan({
      file: imported.file,
      mode: 'github-public',
      source: imported.source,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/github-archive?owner=Csisz&repo=shipseal&ref=HEAD', { method: 'GET', redirect: 'follow' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://codeload.github.com/Csisz/shipseal/zip/HEAD', { method: 'GET', redirect: 'follow' });
    expect(report.scanSummary.limited).toBe(false);
    expect(report.scanSummary.archiveDiagnostics?.startsWithZipMagic).toBe(true);
    expect(report.scanSummary.archiveDiagnostics?.contentKind).toBe('zip');
  });

  it('can use direct-browser codeload as an explicit fallback strategy', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size) });
    const fetchMock = vi.fn(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    await importPublicGitHubRepo({
      url: 'github.com/Csisz/shipseal',
      strategy: 'direct-browser-codeload',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://codeload.github.com/Csisz/shipseal/zip/HEAD', { method: 'GET', redirect: 'follow' });
  });

  it('returns a clear fallback message when public import fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network blocked');
    }));

    await expect(importPublicGitHubRepo({ url: 'https://github.com/Csisz/shipseal' }))
      .rejects
      .toMatchObject({
        name: 'GitHubImportError',
        category: 'network-cors-blocked',
        message: 'Browser restrictions blocked the GitHub ZIP download. Download the repository as ZIP from GitHub and upload it manually.',
        fallbackMessage: 'Download the repository as ZIP from GitHub and upload it manually.',
      } satisfies Partial<GitHubImportError>);
  });

  it('categorizes repo and branch lookup failures separately', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));

    await expect(importPublicGitHubRepo({ url: 'https://github.com/Csisz/shipseal' }))
      .rejects
      .toMatchObject({ category: 'repo-not-found' } satisfies Partial<GitHubImportError>);

    await expect(importPublicGitHubRepo({ url: 'https://github.com/Csisz/shipseal', branch: 'missing-ref' }))
      .rejects
      .toMatchObject({ category: 'branch-ref-not-found' } satisfies Partial<GitHubImportError>);
  });

  it('categorizes unsupported hosts separately from malformed URLs', async () => {
    await expect(importPublicGitHubRepo({ url: 'https://gitlab.com/Csisz/shipseal' }))
      .rejects
      .toMatchObject({ category: 'unsupported-host' } satisfies Partial<GitHubImportError>);

    await expect(importPublicGitHubRepo({ url: 'not a repo' }))
      .rejects
      .toMatchObject({ category: 'invalid-url' } satisfies Partial<GitHubImportError>);
  });

  it('imports a selected GitHub App repository archive with installation metadata', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size) });
    const fetchMock = vi.fn(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    const imported = await importGitHubAppRepoArchive({
      installationId: '12345',
      owner: 'Csisz',
      repo: 'shipseal',
      ref: 'main',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/github-app/archive?installationId=12345&owner=Csisz&repo=shipseal&ref=main', { method: 'GET', redirect: 'follow' });
    expect(imported.file.name).toBe('Csisz-shipseal-main.zip');
    expect(imported.source).toMatchObject({
      sourceType: 'github-url',
      githubOwner: 'Csisz',
      githubRepo: 'shipseal',
      githubBranch: 'main',
      githubDefaultBranch: 'main',
      githubInstallationId: '12345',
      sourceUrl: 'https://github.com/Csisz/shipseal/tree/main',
    } satisfies ScanSourceMetadata);
  });

  it('scans a selected GitHub App repository archive as a full real-repo scan', async () => {
    const file = await demoZipFile();
    const headers = new Headers({ 'content-length': String(file.size), 'content-type': 'application/zip' });
    const fetchMock = vi.fn(async () => zipResponse(file, headers));
    vi.stubGlobal('fetch', fetchMock);

    const imported = await importGitHubAppRepoArchive({
      installationId: '12345',
      owner: 'Csisz',
      repo: 'shipseal',
      ref: 'main',
    });
    const report = await new LocalScanEngine().scan({
      file: imported.file,
      mode: 'github-public',
      source: imported.source,
    });

    expect(report.repoName).toBe('Csisz/shipseal');
    expect(report.fileCount).toBeGreaterThan(0);
    expect(report.repoContextPack.scripts).toMatchObject({ test: 'vitest', build: 'vite build' });
    expect(report.scanSummary.limited).toBe(false);
    expect(report.blockers.map(blocker => blocker.id)).not.toContain('limited-scan');
  });

  it('returns a friendly error when a selected GitHub App archive cannot be downloaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'upstream failed' }), { status: 502 })));

    await expect(importGitHubAppRepoArchive({
      installationId: '12345',
      owner: 'Csisz',
      repo: 'shipseal',
      ref: 'main',
    })).rejects.toMatchObject({
      name: 'GitHubImportError',
      category: 'unknown-import-error',
      message: 'GitHub import failed with HTTP 502. Download the repository as ZIP from GitHub and upload it manually.',
    } satisfies Partial<GitHubImportError>);
  });

  it('ZIP upload flow still works with zip-upload source metadata', async () => {
    const file = await demoZipFile('zip-upload.zip');
    const report = await new LocalScanEngine().scan({
      file,
      mode: 'local',
      source: { sourceType: 'zip-upload' },
    });

    expect(report.source.sourceType).toBe('zip-upload');
    expect(report.repoName).toBeTruthy();
  });
});

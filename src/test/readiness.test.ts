import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { LIMITED_SCAN_WARNING, scanZipFile } from '@/lib/scanner';
import { SCANNER_LIMITS, getUnsafeZipPathReason } from '@/lib/scannerLimits';
import { LocalScanEngine, ScanCancelledError } from '@/lib/scanEngine';
import type { CreateScanRequest, ScanJobResult } from '@/lib/api/contracts';
import { clearLocalScanJobs, createLocalScanJob, getLocalScanJobResult, getLocalScanJobStatus } from '@/lib/api/localScanAdapter';
import { evaluateReadiness, isSecretFilePath } from '@/lib/scoring';
import {
  buildAgentPackZipBlob,
  buildAgentPackZipFilename,
  buildRepoContextPackJson,
  buildScoreJson,
  MCP_GOVERNANCE_FOLDER,
  REPO_CONTEXT_FOLDER,
  REQUIRED_AGENT_PACK_FILES,
} from '@/lib/exports';
import { REQUIRED_MCP_POLICY_FILES } from '@/lib/mcpReadiness';
import { getDeliveryPackRequiredPaths } from '@/lib/deliveryPack/manifest';
import { saveScanHistory, scanHistoryStorageKey } from '@/lib/scanHistory';
import { validateZipUpload } from '@/lib/uploadValidation';
import type { CriticalBlocker, RepoScanInput } from '@/lib/types';
import { LocalAIProvider } from '@/lib/ai';
import { buildGitHubZipUrl, GitHubImportError, importPublicGitHubRepo } from '@/lib/github/githubImport';
import { parseGitHubUrl } from '@/lib/github/githubUrl';
import { criticalBlockersEmptyStateText } from '@/lib/uiCopy';
import { SHIPSEAL_VERSION } from '@/lib/version';
import { generateClientReportHtml } from '@/lib/report';
import { normalizeProjectIntake } from '@/lib/intake';

function scanInput(files: string[], textContents: Record<string, string> = {}): RepoScanInput {
  return {
    repoName: 'test-repo',
    files: files.map(path => ({ path, size: textContents[path]?.length ?? 100 })),
    textContents,
  };
}

async function zipFile(name: string, entries: Record<string, string | Uint8Array>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type: 'application/zip' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('secret file detection', () => {
  it('does not produce a secret blocker for a clean repo with package.json, README.md, and .gitignore', () => {
    const report = buildReport(scanInput(
      ['package.json', 'README.md', '.gitignore'],
      {
        'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
        'README.md': '# Test Repo\n\n## Overview\nA clean repository.\n\n## Setup\nnpm install\nnpm test\n',
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      }
    ));

    expect(report.blockers.find(blocker => blocker.id === 'secrets')).toBeUndefined();
  });

  it('produces a secret blocker for .env', () => {
    const report = buildReport(scanInput(
      ['package.json', 'README.md', '.gitignore', '.env'],
      {
        'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
        'README.md': '# Test Repo\n\n## Overview\nA repository.\n\n## Setup\nnpm install\n',
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      }
    ));

    expect(report.blockers.find(blocker => blocker.id === 'secrets')?.detail).toContain('.env');
  });

  it('does not flag .env.example as a secret file', () => {
    expect(isSecretFilePath('.env.example')).toBe(false);
    expect(isSecretFilePath('config/.env.example')).toBe(false);
  });

  it('flags only risky secret-like filenames', () => {
    expect(isSecretFilePath('README.md')).toBe(false);
    expect(isSecretFilePath('src/private_key_notes.ts')).toBe(false);
    expect(isSecretFilePath('private_key')).toBe(true);
    expect(isSecretFilePath('private_key.prod')).toBe(true);
    expect(isSecretFilePath('deploy/serviceAccount.json')).toBe(true);
    expect(isSecretFilePath('tls/server.pem')).toBe(true);
    expect(isSecretFilePath('tls/server.key')).toBe(true);
  });
});

describe('readiness logic', () => {
  const criticalBlocker: CriticalBlocker = {
    id: 'secrets',
    title: 'Suspicious secret files found',
    detail: 'Detected: .env',
  };

  it('marks score >= 85 with zero blockers as AI Coding Ready', () => {
    const readiness = evaluateReadiness(85, []);

    expect(readiness.isReady).toBe(true);
    expect(readiness.level).toBe('AI Coding Ready');
    expect(readiness.statusMessage).toBe('Your repository is AI Coding Ready.');
  });

  it('never marks a repo with critical blockers as AI Coding Ready', () => {
    const readiness = evaluateReadiness(98, [criticalBlocker]);

    expect(readiness.isReady).toBe(false);
    expect(readiness.level).not.toBe('AI Coding Ready');
    expect(readiness.level).not.toBe('AgentReady Certified');
    expect(readiness.statusMessage).toBe('Critical blockers must be resolved before this repo can be AI Coding Ready.');
  });

  it('marks score >= 95 with zero blockers as AgentReady Certified', () => {
    const readiness = evaluateReadiness(95, []);

    expect(readiness.isReady).toBe(true);
    expect(readiness.level).toBe('AgentReady Certified');
  });

  it('keeps the sample report AI Coding Ready when no blockers exist', () => {
    const report = buildSampleReport();
    const readiness = evaluateReadiness(report.score, report.blockers);

    expect(report.blockers).toHaveLength(0);
    expect(report.isReady).toBe(true);
    expect(readiness.statusMessage).toBe('Your repository is AI Coding Ready.');
  });
});

describe('Sprint 8 demo readiness polish', () => {
  it('version marker exists for RC1', () => {
    expect(SHIPSEAL_VERSION).toBe('0.1.0-rc1');
  });

  it('.env.example does not contain real API keys', () => {
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');

    expect(envExample).toContain('ShipSeal currently does not require client-side environment variables');
    expect(envExample).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(envExample).not.toMatch(/ghp_[A-Za-z0-9]/);
    expect(envExample).not.toMatch(/AIza[A-Za-z0-9_-]/);
    expect(envExample).not.toMatch(/=[^\s#]+/);
  });

  it('sample report has a valid ReadinessReport shape', () => {
    const report = buildSampleReport();

    expect(report.repoName).toBe('sample-nextjs-app');
    expect(report.score).toBe(92);
    expect(report.level).toBe('AI Coding Ready');
    expect(report.source.sourceType).toBe('zip-upload');
    expect(report.scanSummary).toBeDefined();
    expect(report.aiNarrative.executiveSummary).toContain('sample-nextjs-app');
    expect(report.repoContextPack.repositoryName).toBe('sample-nextjs-app');
  });

  it('sample report is AI Coding Ready with zero blockers', () => {
    const report = buildSampleReport();

    expect(report.isReady).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(evaluateReadiness(report.score, report.blockers).statusMessage).toBe('Your repository is AI Coding Ready.');
  });

  it('sample report includes Agent Pack, MCP Governance Pack and Repo Context Pack', () => {
    const report = buildSampleReport();

    expect(report.agentPack.map(file => file.name)).toEqual([...REQUIRED_AGENT_PACK_FILES]);
    expect(report.mcpReadiness.generatedFiles.map(file => file.filename)).toEqual([...REQUIRED_MCP_POLICY_FILES]);
    expect(report.contextPack).toContain('REPO_CONTEXT_PACK.md');
    expect(report.repoContextPack.contentPolicy.rawFileContentsIncluded).toBe(false);
  });

  it('GitHub URL empty validation returns friendly error', async () => {
    await expect(importPublicGitHubRepo({ url: '' })).rejects.toMatchObject({
      name: 'GitHubImportError',
      message: 'Enter a public GitHub repository URL.',
    });
  });

  it('scan cancelled state does not produce report', async () => {
    const engine = new LocalScanEngine();
    const file = await zipFile('cancel-state-repo.zip', {
      'cancel-state-repo/package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      'cancel-state-repo/README.md': '# Cancel State Repo\n',
    });
    const controller = new AbortController();
    controller.abort();

    let report = null;
    try {
      report = await engine.scan({ file, mode: 'local', signal: controller.signal });
    } catch {
      report = null;
    }

    expect(report).toBeNull();
  });

  it('no critical blockers empty state helper is reassuring', () => {
    expect(criticalBlockersEmptyStateText(true)).toBe('No critical blockers. Your repository is AI Coding Ready.');
    expect(criticalBlockersEmptyStateText(false)).toContain('No critical blockers were found');
  });

  it('score.json includes source metadata, scanSummary, aiNarrative, mcpReadiness and repoContextPack metadata', () => {
    const report = buildSampleReport();
    const scoreJson = buildScoreJson(report);

    expect(scoreJson.source.sourceType).toBe('zip-upload');
    expect(scoreJson.scanSummary.totalFilesFound).toBeGreaterThan(0);
    expect(scoreJson.aiNarrative.executiveSummary).toContain(report.repoName);
    expect(scoreJson.mcpReadiness.status).toBe(report.mcpReadiness.status);
    expect(scoreJson.repoContextPack).toMatchObject({
      repositoryName: report.repoName,
      rawFileContentsIncluded: false,
    });
  });

  it('marks ZIP parse fallback reports as limited in score.json and client report HTML', async () => {
    const engine = new LocalScanEngine();
    const report = await engine.scan({
      file: new File(['not a real zip'], 'broken-repo.zip', { type: 'application/zip' }),
      mode: 'local',
      source: { sourceType: 'zip-upload' },
    });
    const scoreJson = buildScoreJson(report);
    const html = generateClientReportHtml({
      intake: normalizeProjectIntake({ projectName: 'Broken Repo' }, 'Broken Repo'),
      scoreJson,
    });

    expect(scoreJson.scanSummary.scanMode).toBe('limited-fallback');
    expect(scoreJson.scanSummary.limited).toBe(true);
    expect(scoreJson.isReady).toBe(false);
    expect(scoreJson.status).toBe('Not Ready');
    expect(scoreJson.criticalBlockers.map(blocker => blocker.id)).toContain('limited-scan');
    expect(scoreJson.scanSummary.warnings.join('\n')).toContain(LIMITED_SCAN_WARNING);
    expect(scoreJson.mcpReadiness.status).toBe('Provisional MCP Readiness');
    expect(scoreJson.mcpReadiness.summary).toContain('Provisional MCP Readiness');
    expect(scoreJson.scanSummary.archiveDiagnostics?.inputKind).toBe('invalid-zip');
    expect(html).toContain('Limited scan');
    expect(html).toContain('complete client handoff audit');
  });

  it('classifies HTML error responses saved as ZIPs in limited scan diagnostics', async () => {
    const engine = new LocalScanEngine();
    const report = await engine.scan({
      file: new File(['<!doctype html><html><body>GitHub error</body></html>'], 'github-error.zip', { type: 'application/zip' }),
      mode: 'github-public',
      source: { sourceType: 'github-url', githubOwner: 'Csisz', githubRepo: 'shipseal' },
    });

    expect(report.scanSummary.limited).toBe(true);
    expect(report.scanSummary.archiveDiagnostics?.inputKind).toBe('html-error-response');
    expect(report.mcpReadiness.status).toBe('Provisional MCP Readiness');
  });
});

describe('Sprint 2 exports', () => {
  it('generates every required Agent Pack file', () => {
    const report = buildSampleReport();
    const names = report.agentPack.map(file => file.name);

    expect(names).toEqual([...REQUIRED_AGENT_PACK_FILES]);
  });

  it('generates non-empty project-specific content for every Agent Pack file', () => {
    const report = buildSampleReport();

    for (const file of report.agentPack) {
      expect(file.content.trim().length).toBeGreaterThan(40);
      expect(file.content).toContain(report.repoName);
    }
  });

  it('does not duplicate the Repository-specific AI guidance heading in AGENTS.md', () => {
    const report = buildSampleReport();
    const agents = report.agentPack.find(file => file.name === 'AGENTS.md')?.content || '';

    expect(agents.match(/Repository-specific AI guidance/g) || []).toHaveLength(1);
  });

  it('builds a valid score.json export shape', () => {
    const report = buildSampleReport();
    const scoreJson = buildScoreJson(report);

    expect(scoreJson).toMatchObject({
      repositoryName: report.repoName,
      scanTimestamp: report.scannedAt,
      score: report.score,
      status: report.level,
      isReady: report.isReady,
      criticalBlockers: report.blockers,
      improvements: report.improvements,
      categories: report.categories,
      detectedStack: report.stack,
      scanSummary: report.scanSummary,
      generatedFiles: expect.arrayContaining(getDeliveryPackRequiredPaths()),
    });
    expect(scoreJson.generatedFiles).toEqual(expect.arrayContaining(getDeliveryPackRequiredPaths()));
    expect(scoreJson.generatedFiles).toContain('07-context/folder-agents/root/AGENTS.md');
    expect(scoreJson.mcpReadiness).toMatchObject({
      score: report.mcpReadiness.score,
      status: report.mcpReadiness.status,
      summary: report.mcpReadiness.summary,
      recommendedServerCategories: report.mcpReadiness.recommendedServerCategories,
      riskFindings: report.mcpReadiness.riskFindings,
      generatedFiles: report.mcpReadiness.generatedFiles.map(file => file.filename),
    });
  });

  it('sanitizes the Agent Pack ZIP filename', () => {
    expect(buildAgentPackZipFilename('My Repo! Sprint 2.zip')).toBe('shipseal-delivery-pack-my-repo-sprint-2.zip');
    expect(buildAgentPackZipFilename('...')).toBe('shipseal-delivery-pack-repository.zip');
  });
});

describe('scan engine boundary', () => {
  it('parses a GitHub-style ZIP with a top-level folder and detects real project files', async () => {
    const file = await zipFile('shipseal-main.zip', {
      'shipseal-main/package.json': JSON.stringify({
        scripts: { test: 'vitest', build: 'vite build' },
        dependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^5.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
      }),
      'shipseal-main/src/main.tsx': 'import React from "react";',
      'shipseal-main/src/App.test.tsx': 'import { describe } from "vitest";',
      'shipseal-main/README.md': '# ShipSeal\n\n## Setup\nnpm install\n',
      'shipseal-main/vite.config.ts': 'import { defineConfig } from "vite";',
      'shipseal-main/tsconfig.json': JSON.stringify({ compilerOptions: {} }),
    });

    const input = await scanZipFile(file, { sourceType: 'github-url', githubOwner: 'Csisz', githubRepo: 'shipseal', githubBranch: 'main' });

    expect(input.scanSummary?.limited).toBe(false);
    expect(input.scanSummary?.archiveDiagnostics?.inputKind).toBe('github-zipball');
    expect(input.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'package.json',
      'src/main.tsx',
      'src/App.test.tsx',
      'README.md',
      'vite.config.ts',
      'tsconfig.json',
    ]));
    expect(input.textContents['package.json']).toContain('vite');
    expect(input.textContents['vite.config.ts']).toContain('defineConfig');
  });

  it('does not use fallback for a valid GitHub-style Vite ZIP', async () => {
    const engine = new LocalScanEngine();
    const file = await zipFile('shipseal-main.zip', {
      'shipseal-main/package.json': JSON.stringify({
        scripts: { test: 'vitest', build: 'vite build' },
        dependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^5.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
      }),
      'shipseal-main/src/main.tsx': 'import React from "react";',
      'shipseal-main/src/App.test.tsx': 'import { describe } from "vitest";',
      'shipseal-main/README.md': '# ShipSeal\n\n## Setup\nnpm install\n',
      'shipseal-main/vite.config.ts': 'import { defineConfig } from "vite";',
      'shipseal-main/tsconfig.json': JSON.stringify({ compilerOptions: {} }),
    });

    const report = await engine.scan({
      file,
      mode: 'github-public',
      source: { sourceType: 'github-url', githubOwner: 'Csisz', githubRepo: 'shipseal', githubBranch: 'main' },
    });

    expect(report.scanSummary.scanMode).toBe('full');
    expect(report.scanSummary.limited).toBe(false);
    expect(report.scanSummary.warnings.join('\n')).not.toContain('fallback scan');
    expect(report.stack.primary).toContain('Vite');
    expect(report.summary.keyFolders).toContain('src');
    expect(report.stack.testFrameworks).toContain('Vitest');
  });

  it('LocalScanEngine returns a valid ReadinessReport for a mock ZIP', async () => {
    const engine = new LocalScanEngine();
    const file = await zipFile('engine-repo.zip', {
      'engine-repo/package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
      'engine-repo/README.md': '# Engine Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\n',
      'engine-repo/.env.example': 'TOKEN=\n',
      'engine-repo/src/index.ts': 'export const ok = true;',
    });

    const report = await engine.scan({ file, mode: 'local' });

    expect(report.repoName).toBe('engine-repo');
    expect(report.score).toBeGreaterThan(0);
    expect(report.agentPack.map(file => file.name)).toEqual([...REQUIRED_AGENT_PACK_FILES]);
    expect(report.mcpReadiness.generatedFiles.map(file => file.filename)).toEqual([...REQUIRED_MCP_POLICY_FILES]);
  });

  it('scan engine rejects invalid non-ZIP input', async () => {
    const engine = new LocalScanEngine();
    const file = new File(['not a zip'], 'repo.txt', { type: 'text/plain' });

    await expect(engine.scan({ file, mode: 'local' })).rejects.toThrow('Only .zip files are accepted.');
  });

  it('cancelled scan does not return a final report', async () => {
    const engine = new LocalScanEngine();
    const file = await zipFile('cancel-repo.zip', {
      'cancel-repo/package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      'cancel-repo/README.md': '# Cancel Repo\n',
    });
    const controller = new AbortController();
    controller.abort();

    await expect(engine.scan({ file, mode: 'local', signal: controller.signal })).rejects.toBeInstanceOf(ScanCancelledError);
  });

  it('future API contract types compile', () => {
    const request: CreateScanRequest = {
      mode: 'zip-upload',
      repositoryName: 'contract-repo',
      fileName: 'contract-repo.zip',
      fileSizeBytes: 1234,
    };

    expect(request.mode).toBe('zip-upload');
  });

  it('local scan adapter creates a job and returns a completed result', async () => {
    clearLocalScanJobs();
    const file = await zipFile('adapter-repo.zip', {
      'adapter-repo/package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
      'adapter-repo/README.md': '# Adapter Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\n',
      'adapter-repo/src/index.ts': 'export const ok = true;',
    });

    const created = createLocalScanJob(file);
    expect(created.scanId).toMatch(/^local-/);

    let result: ReturnType<typeof getLocalScanJobResult> | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = getLocalScanJobStatus(created.scanId);
      if ('status' in status && status.status === 'completed') {
        result = getLocalScanJobResult(created.scanId);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    expect(result).toBeTruthy();
    expect((result as ScanJobResult).status).toBe('completed');
    expect((result as ScanJobResult).report.repoName).toBe('adapter-repo');
    expect((result as ScanJobResult).scoreJson.mcpReadiness).toBeDefined();
    expect((result as ScanJobResult).generatedFiles.deliveryPack).toEqual((result as ScanJobResult).scoreJson.generatedFiles);
    clearLocalScanJobs();
  });
});

describe('Sprint 7 GitHub public repo import', () => {
  it('GitHub URL parser accepts valid repo URLs', () => {
    const parsed = parseGitHubUrl('https://github.com/agentready/demo-repo/');

    expect(parsed).toMatchObject({
      owner: 'agentready',
      repo: 'demo-repo',
      normalizedUrl: 'https://github.com/agentready/demo-repo',
      defaultZipUrl: 'https://codeload.github.com/agentready/demo-repo/zip/HEAD',
    });
  });

  it('GitHub URL parser accepts .git suffix and protocol-less URLs', () => {
    const parsed = parseGitHubUrl('github.com/agentready/demo-repo.git');

    expect(parsed.owner).toBe('agentready');
    expect(parsed.repo).toBe('demo-repo');
    expect(parsed.normalizedUrl).toBe('https://github.com/agentready/demo-repo');
  });

  it('GitHub URL parser accepts tree branch URLs', () => {
    const parsed = parseGitHubUrl('https://github.com/agentready/demo-repo/tree/feature/public-import');

    expect(parsed).toMatchObject({
      owner: 'agentready',
      repo: 'demo-repo',
      branch: 'feature/public-import',
      normalizedUrl: 'https://github.com/agentready/demo-repo/tree/feature/public-import',
      defaultZipUrl: 'https://codeload.github.com/agentready/demo-repo/zip/refs/heads/feature/public-import',
    });
  });

  it('GitHub URL parser rejects non-GitHub URLs', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/agentready/demo-repo')).toThrow('Only public github.com');
  });

  it('GitHub URL parser rejects URLs with credentials', () => {
    expect(() => parseGitHubUrl('https://token@github.com/agentready/demo-repo')).toThrow('credentials');
  });

  it('GitHub ZIP URL builder returns expected URL shape', () => {
    expect(buildGitHubZipUrl('agentready', 'demo-repo')).toBe('https://codeload.github.com/agentready/demo-repo/zip/HEAD');
    expect(buildGitHubZipUrl('agentready', 'demo-repo', 'feature/public-import')).toBe('https://codeload.github.com/agentready/demo-repo/zip/refs/heads/feature/public-import');
  });

  it('GitHub import failure returns user-friendly fallback error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    await expect(importPublicGitHubRepo({ url: 'https://github.com/agentready/demo-repo' }))
      .rejects
      .toMatchObject({
        name: 'GitHubImportError',
        category: 'network-cors-blocked',
        message: 'Browser restrictions blocked the GitHub ZIP download. Download the repository as ZIP from GitHub and upload it manually.',
        fallbackMessage: 'Download the repository as ZIP from GitHub and upload it manually.',
      } satisfies Partial<GitHubImportError>);
  });

  it('scan input source metadata is preserved in report', async () => {
    const engine = new LocalScanEngine();
    const file = await zipFile('demo-repo-main.zip', {
      'demo-repo-main/package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
      'demo-repo-main/README.md': '# Demo Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\n',
      'demo-repo-main/src/index.ts': 'export const ok = true;',
    });

    const report = await engine.scan({
      file,
      mode: 'github-public',
      source: {
        sourceType: 'github-url',
        githubOwner: 'agentready',
        githubRepo: 'demo-repo',
        githubBranch: 'main',
        sourceUrl: 'https://github.com/agentready/demo-repo/tree/main',
      },
    });

    expect(report.repoName).toBe('agentready/demo-repo');
    expect(report.source).toMatchObject({
      sourceType: 'github-url',
      githubOwner: 'agentready',
      githubRepo: 'demo-repo',
      githubBranch: 'main',
    });
  });

  it('score.json includes source metadata', () => {
    const report = buildReport({
      ...scanInput(
        ['package.json', 'README.md', 'src/index.ts'],
        {
          'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
          'README.md': '# Demo Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\n',
        }
      ),
      repoName: 'agentready/demo-repo',
      source: {
        sourceType: 'github-url',
        githubOwner: 'agentready',
        githubRepo: 'demo-repo',
        githubBranch: 'main',
        sourceUrl: 'https://github.com/agentready/demo-repo/tree/main',
      },
    });
    const scoreJson = buildScoreJson(report);

    expect(scoreJson.source).toMatchObject({
      sourceType: 'github-url',
      githubOwner: 'agentready',
      githubRepo: 'demo-repo',
      githubBranch: 'main',
    });
  });

  it('scan history stores GitHub metadata only', () => {
    window.localStorage.clear();
    const report = buildReport({
      ...scanInput(
        ['package.json', 'README.md', 'src/index.ts'],
        {
          'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
          'README.md': '# Demo Repo\n\nPRIVATE_RAW_CONTENT_SHOULD_NOT_BE_STORED\n\n## Setup\nnpm install\n',
        }
      ),
      repoName: 'agentready/demo-repo',
      source: {
        sourceType: 'github-url',
        githubOwner: 'agentready',
        githubRepo: 'demo-repo',
        githubBranch: 'main',
        sourceUrl: 'https://github.com/agentready/demo-repo/tree/main',
      },
    });

    const history = saveScanHistory(report);
    const stored = window.localStorage.getItem(scanHistoryStorageKey()) || '';

    expect(history[0]).toMatchObject({
      sourceType: 'github-url',
      githubOwner: 'agentready',
      githubRepo: 'demo-repo',
      githubBranch: 'main',
    });
    expect(stored).not.toContain('PRIVATE_RAW_CONTENT_SHOULD_NOT_BE_STORED');
    expect(stored).not.toContain('repoContextPack');
    expect(stored).not.toContain('AGENTS.md');
    window.localStorage.clear();
  });

  it('ZIP upload flow still works with zip-upload source metadata', async () => {
    const engine = new LocalScanEngine();
    const file = await zipFile('zip-repo.zip', {
      'zip-repo/package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
      'zip-repo/README.md': '# Zip Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\n',
      'zip-repo/src/index.ts': 'export const ok = true;',
    });

    const report = await engine.scan({ file, mode: 'local', source: { sourceType: 'zip-upload' } });

    expect(report.repoName).toBe('zip-repo');
    expect(report.source.sourceType).toBe('zip-upload');
    expect(report.agentPack.map(file => file.name)).toEqual([...REQUIRED_AGENT_PACK_FILES]);
  });

  it('Agent Pack ZIP export uses the ShipSeal Delivery Pack folders', async () => {
    const report = buildSampleReport();
    const blob = await buildAgentPackZipBlob(
      report.agentPack,
      report.mcpReadiness.generatedFiles,
      { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
      { repositoryName: report.repoName, scoreJson: buildScoreJson(report) }
    );
    const zip = await JSZip.loadAsync(blob);

    for (const filename of ['AGENTS.md', 'CLAUDE.md', 'CODEX_PROMPTS.md', 'REVIEWER_PROMPT.md']) {
      expect(zip.file(`01-agent-instructions/${filename}`)).toBeTruthy();
    }
    for (const filename of REQUIRED_MCP_POLICY_FILES) {
      expect(zip.file(`${MCP_GOVERNANCE_FOLDER}/${filename}`)).toBeTruthy();
    }
    expect(zip.file('04-testing/TESTING_STRATEGY.md')).toBeTruthy();
    expect(zip.file('04-testing/CI_QUALITY_GATE.yml')).toBeTruthy();
    expect(zip.file(`${REPO_CONTEXT_FOLDER}/REPO_CONTEXT_PACK.md`)).toBeTruthy();
    expect(zip.file(`${REPO_CONTEXT_FOLDER}/repo-context-pack.json`)).toBeTruthy();
    expect(zip.file('score.json')).toBeTruthy();
  });
});

describe('MCP Readiness v1', () => {
  it('returns a valid MCP report with score between 0 and 100', () => {
    const report = buildSampleReport();

    expect(report.mcpReadiness.score).toBeGreaterThanOrEqual(0);
    expect(report.mcpReadiness.score).toBeLessThanOrEqual(100);
    expect(report.mcpReadiness.status).toMatch(/MCP Ready/);
    expect(report.mcpReadiness.summary).toContain(report.repoName);
    expect(Array.isArray(report.mcpReadiness.recommendedServerCategories)).toBe(true);
    expect(Array.isArray(report.mcpReadiness.riskFindings)).toBe(true);
  });

  it('gives a clean frontend repo at least Basic MCP Ready', () => {
    const report = buildReport(scanInput(
      ['package.json', 'README.md', '.env.example', 'src/App.tsx', 'src/App.test.tsx'],
      {
        'package.json': JSON.stringify({
          scripts: { build: 'vite build', test: 'vitest', lint: 'eslint .' },
          dependencies: { react: '^18.3.1', vite: '^5.4.0' },
          devDependencies: { vitest: '^3.2.4' },
        }),
        'README.md': '# Frontend\n\n## Overview\nA React app.\n\n## Setup\nnpm install\nnpm run test\n',
        '.env.example': 'VITE_API_URL=\n',
      }
    ));

    expect(report.mcpReadiness.score).toBeGreaterThanOrEqual(40);
    expect(report.mcpReadiness.status).not.toBe('Not MCP Ready');
  });

  it('adds a risk finding and score penalty for secret blockers', () => {
    const cleanReport = buildReport(scanInput(
      ['package.json', 'README.md', '.env.example', 'src/App.tsx'],
      {
        'package.json': JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' } }),
        'README.md': '# Clean\n\n## Overview\nA clean repo.\n\n## Setup\nnpm install\n',
        '.env.example': 'TOKEN=\n',
      }
    ));
    const riskyReport = buildReport(scanInput(
      ['package.json', 'README.md', '.env.example', 'src/App.tsx', '.env'],
      {
        'package.json': JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' } }),
        'README.md': '# Risky\n\n## Overview\nA risky repo.\n\n## Setup\nnpm install\n',
        '.env.example': 'TOKEN=\n',
      }
    ));

    expect(riskyReport.blockers.find(blocker => blocker.id === 'secrets')).toBeDefined();
    expect(riskyReport.mcpReadiness.riskFindings.some(finding => finding.severity === 'Critical')).toBe(true);
    expect(riskyReport.mcpReadiness.score).toBeLessThan(cleanReport.mcpReadiness.score);
  });

  it('generates all four MCP policy files with project-specific content', () => {
    const report = buildSampleReport();
    const names = report.mcpReadiness.generatedFiles.map(file => file.filename);

    expect(names).toEqual([...REQUIRED_MCP_POLICY_FILES]);
    for (const file of report.mcpReadiness.generatedFiles) {
      expect(file.content.trim().length).toBeGreaterThan(40);
      expect(file.content).toContain(report.repoName);
    }
  });

  it('includes MCP policy files under the ShipSeal governance folder in the full ZIP export', async () => {
    const report = buildSampleReport();
    const blob = await buildAgentPackZipBlob(report.agentPack, report.mcpReadiness.generatedFiles);
    const zip = await JSZip.loadAsync(blob);

    for (const filename of ['AGENTS.md', 'CLAUDE.md', 'CODEX_PROMPTS.md', 'REVIEWER_PROMPT.md']) {
      expect(zip.file(`01-agent-instructions/${filename}`)).toBeTruthy();
    }
    for (const filename of REQUIRED_MCP_POLICY_FILES) {
      expect(zip.file(`${MCP_GOVERNANCE_FOLDER}/${filename}`)).toBeTruthy();
    }
  });
});

describe('Sprint 6 AI provider and Repo Context Pack', () => {
  it('LocalAIProvider returns deterministic non-empty readiness narrative', async () => {
    const report = buildSampleReport();
    const provider = new LocalAIProvider();
    const input = {
      repositoryName: report.repoName,
      score: report.score,
      level: report.level,
      isReady: report.isReady,
      stack: report.stack,
      summary: report.summary,
      categories: report.categories,
      blockers: report.blockers,
      improvements: report.improvements,
      scanSummary: report.scanSummary,
      mcpReadiness: report.mcpReadiness,
    };

    const first = await provider.generateReadinessNarrative(input);
    const second = await provider.generateReadinessNarrative(input);

    expect(first).toEqual(second);
    expect(first.executiveSummary.length).toBeGreaterThan(40);
    expect(first.nextBestActions.length).toBeGreaterThan(0);
    expect(first.confidenceNote).toContain('deterministic');
  });

  it('ready repo narrative says the repo is AI Coding Ready', () => {
    const report = buildSampleReport();

    expect(report.isReady).toBe(true);
    expect(report.aiNarrative.executiveSummary).toContain('is AI Coding Ready');
    expect(report.aiNarrative.blockerExplanation).toContain('No critical blockers');
  });

  it('blocked repo narrative does not claim readiness', () => {
    const report = buildReport(scanInput(
      ['package.json', 'README.md', '.gitignore', '.env', 'src/index.ts'],
      {
        'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build', lint: 'eslint .' } }),
        'README.md': '# Blocked Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\nnpm test\n',
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      }
    ));

    expect(report.blockers.some(blocker => blocker.id === 'secrets')).toBe(true);
    expect(report.isReady).toBe(false);
    expect(report.aiNarrative.executiveSummary).toContain('is not AI Coding Ready');
    expect(report.aiNarrative.executiveSummary).not.toContain('is AI Coding Ready at');
  });

  it('AI narrative does not override critical blockers', () => {
    const report = buildReport(scanInput(
      ['package.json', 'README.md', '.gitignore', '.env', 'src/index.ts', 'src/index.test.ts'],
      {
        'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build', lint: 'eslint .' } }),
        'README.md': '# Blocked Repo\n\n## Overview\nA documented repo.\n\n## Setup\nnpm install\nnpm test\n',
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      }
    ));

    expect(report.blockers.length).toBeGreaterThan(0);
    expect(evaluateReadiness(98, report.blockers).isReady).toBe(false);
    expect(report.aiNarrative.confidenceNote).toContain('should not override critical blockers');
  });

  it('Repo Context Pack contains metadata but not raw file contents', () => {
    const report = buildReport(scanInput(
      ['package.json', 'README.md', '.gitignore', 'src/index.ts'],
      {
        'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
        'README.md': '# Context Repo\n\nPRIVATE_RAW_CONTEXT_SHOULD_NOT_LEAK\n\n## Setup\nnpm install\n',
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      }
    ));

    expect(report.repoContextPack.repositoryName).toBe('test-repo');
    expect(report.repoContextPack.scripts).toMatchObject({ test: 'vitest', build: 'vite build' });
    expect(report.repoContextPack.contentPolicy.rawFileContentsIncluded).toBe(false);
    expect(report.contextPack).not.toContain('PRIVATE_RAW_CONTEXT_SHOULD_NOT_LEAK');
    expect(JSON.stringify(report.repoContextPack)).not.toContain('PRIVATE_RAW_CONTEXT_SHOULD_NOT_LEAK');
  });

  it('generates REPO_CONTEXT_PACK.md and repo-context-pack.json export payloads', () => {
    const report = buildSampleReport();
    const json = buildRepoContextPackJson(report);

    expect(report.contextPack).toContain('# REPO_CONTEXT_PACK.md');
    expect(report.contextPack).toContain('Raw full file contents included: no');
    expect(json.repositoryName).toBe(report.repoName);
    expect(json.contentPolicy.secretsIncluded).toBe(false);
  });

  it('full ZIP export includes ShipSeal context folder and existing packs', async () => {
    const report = buildSampleReport();
    const blob = await buildAgentPackZipBlob(
      report.agentPack,
      report.mcpReadiness.generatedFiles,
      { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
      { repositoryName: report.repoName, scoreJson: buildScoreJson(report) }
    );
    const zip = await JSZip.loadAsync(blob);

    for (const filename of ['AGENTS.md', 'CLAUDE.md', 'CODEX_PROMPTS.md', 'REVIEWER_PROMPT.md']) {
      expect(zip.file(`01-agent-instructions/${filename}`)).toBeTruthy();
    }
    for (const filename of REQUIRED_MCP_POLICY_FILES) {
      expect(zip.file(`${MCP_GOVERNANCE_FOLDER}/${filename}`)).toBeTruthy();
    }
    expect(zip.file(`${REPO_CONTEXT_FOLDER}/REPO_CONTEXT_PACK.md`)).toBeTruthy();
    expect(zip.file(`${REPO_CONTEXT_FOLDER}/repo-context-pack.json`)).toBeTruthy();
  });

  it('score.json includes aiNarrative and repoContextPack metadata', () => {
    const report = buildSampleReport();
    const scoreJson = buildScoreJson(report);

    expect(scoreJson.aiNarrative.executiveSummary).toContain(report.repoName);
    expect(scoreJson.repoContextPack).toMatchObject({
      repositoryName: report.repoName,
      rawFileContentsIncluded: false,
      mcpStatus: report.mcpReadiness.status,
    });
    expect(scoreJson.mcpReadiness.aiNarrative?.mcpSummary).toContain(report.repoName);
  });

  it('scan history still stores metadata only after Sprint 6 additions', () => {
    window.localStorage.clear();
    const report = buildSampleReport();

    saveScanHistory(report);
    const stored = window.localStorage.getItem(scanHistoryStorageKey()) || '';

    expect(stored).not.toContain('aiNarrative');
    expect(stored).not.toContain('repoContextPack');
    expect(stored).not.toContain('REPO_CONTEXT_PACK.md');
    expect(stored).not.toContain('AGENTS.md');
    window.localStorage.clear();
  });
});

describe('scanner hardening', () => {
  it('fails oversized ZIP metadata validation', () => {
    const result = validateZipUpload({ name: 'huge-repo.zip', size: SCANNER_LIMITS.maxZipSizeBytes + 1 });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('ZIP file is too large');
  });

  it('rejects unsafe ZIP paths before scanning content', () => {
    expect(getUnsafeZipPathReason('../evil.txt')).toContain('parent-directory traversal');
    expect(getUnsafeZipPathReason('..\\evil.txt')).toContain('parent-directory traversal');
    expect(getUnsafeZipPathReason('/tmp/evil.txt')).toContain('absolute paths');
    expect(getUnsafeZipPathReason('C:\\tmp\\evil.txt')).toContain('drive-letter paths');
    expect(getUnsafeZipPathReason(`src/${'a'.repeat(SCANNER_LIMITS.maxPathLength)}.ts`)).toContain('paths longer');
    expect(getUnsafeZipPathReason('src/bad\0name.ts')).toContain('null bytes');
  });

  it('ignores generated/vendor and binary files from readable text analysis while counting them', async () => {
    const file = await zipFile('safe-repo.zip', {
      'safe-repo/package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
      'safe-repo/README.md': '# Safe Repo\n\n## Overview\nA repo.\n\n## Setup\nnpm install\n',
      'safe-repo/node_modules/pkg/package.json': '{"private":true}',
      'safe-repo/dist/bundle.js': 'console.log("generated")',
      'safe-repo/src/logo.png': new Uint8Array([137, 80, 78, 71]),
    });

    const input = await scanZipFile(file);

    expect(input.textContents['package.json']).toContain('vitest');
    expect(input.textContents['node_modules/pkg/package.json']).toBeUndefined();
    expect(input.scanSummary?.totalFilesFound).toBe(5);
    expect(input.scanSummary?.filesAnalyzed).toBe(2);
    expect(input.scanSummary?.filesIgnored).toBe(3);
    expect(input.scanSummary?.generatedVendorFilesIgnored).toBe(2);
    expect(input.scanSummary?.binaryFilesIgnored).toBe(1);
    expect(input.scanSummary?.ignoredGeneratedFolders).toEqual(expect.arrayContaining(['node_modules', 'dist']));
  });
});

describe('local scan history', () => {
  it('stores only lightweight metadata, not raw file contents', () => {
    window.localStorage.clear();
    const report = buildReport(scanInput(
      ['package.json', 'README.md', 'src/index.ts', '.gitignore'],
      {
        'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }),
        'README.md': '# Test Repo\n\n## Overview\nPRIVATE_RAW_CONTENT_SHOULD_NOT_BE_STORED\n\n## Setup\nnpm install\n',
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      }
    ));

    const history = saveScanHistory(report);
    const stored = window.localStorage.getItem(scanHistoryStorageKey()) || '';

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      repositoryName: report.repoName,
      timestamp: report.scannedAt,
      sourceType: 'zip-upload',
      githubOwner: undefined,
      githubRepo: undefined,
      githubBranch: undefined,
      score: report.score,
      status: report.level,
      criticalBlockerCount: report.blockers.length,
      mcpScore: report.mcpReadiness.score,
      mcpStatus: report.mcpReadiness.status,
    });
    expect(stored).not.toContain('PRIVATE_RAW_CONTENT_SHOULD_NOT_BE_STORED');
    expect(stored).not.toContain('MCP_SECURITY_POLICY.md');
    expect(stored).not.toContain('AGENTS.md');
    expect(stored).not.toContain('files');
    expect(stored).not.toContain('textContents');
    window.localStorage.clear();
  });

  it('keeps only the last five scans', () => {
    window.localStorage.clear();

    for (let index = 0; index < 6; index += 1) {
      const report = buildSampleReport();
      saveScanHistory({ ...report, repoName: `repo-${index}`, scannedAt: `2026-05-22T10:0${index}:00.000Z` });
    }

    const stored = JSON.parse(window.localStorage.getItem(scanHistoryStorageKey()) || '[]');
    expect(stored).toHaveLength(5);
    expect(stored[0].repositoryName).toBe('repo-5');
    expect(stored[4].repositoryName).toBe('repo-1');
    window.localStorage.clear();
  });
});

describe('upload validation', () => {
  it('fails for non-ZIP uploads', () => {
    expect(validateZipUpload({ name: 'repo.tar.gz', size: 100 }).valid).toBe(false);
    expect(validateZipUpload({ name: 'repo.tar.gz', size: 100 }).error).toBe('Only .zip files are accepted.');
  });
});

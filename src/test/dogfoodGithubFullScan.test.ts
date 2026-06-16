import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { importPublicGitHubRepo } from '@/lib/github/githubImport';
import { LocalScanEngine } from '@/lib/scanEngine';
import { buildAgentPackZipBlob, buildRepoContextPackJson, buildScoreJson } from '@/lib/exports';
import { generateClientReportHtml } from '@/lib/report';
import { normalizeProjectIntake } from '@/lib/intake';
import type { ReadinessReport } from '@/lib/types';

async function zipFile(name: string, entries: Record<string, string | Uint8Array>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type: 'application/zip' });
}

function realisticShipSealEntries() {
  const packageJson = JSON.stringify({
    name: 'shipseal-fixture',
    scripts: { dev: 'vite', build: 'vite build', test: 'vitest run', lint: 'eslint .' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', vite: '^5.4.0' },
    devDependencies: { typescript: '^5.8.0', vitest: '^3.2.0', '@vitejs/plugin-react-swc': '^3.11.0' },
  }, null, 2);

  return {
    'shipseal-v2-main/package.json': packageJson,
    'shipseal-v2-main/package-lock.json': '{"lockfileVersion":3}',
    'shipseal-v2-main/README.md': '# ShipSeal\n\n## Overview\nA React Vite TypeScript app for deterministic delivery packs.\n\n## Setup\nnpm install\nnpm run test\nnpm run build\n\n## Architecture\nThe app scans ZIP archives locally and creates client handoff reports with manifest-based exports.\n',
    'shipseal-v2-main/AGENTS.md': '# Agent instructions\n\nKeep changes small and deterministic.\n',
    'shipseal-v2-main/CLAUDE.md': '# Claude instructions\n',
    'shipseal-v2-main/.cursorrules': 'Use local-first scanning.\n',
    'shipseal-v2-main/.env.example': 'VITE_PUBLIC_PLACEHOLDER=\n',
    'shipseal-v2-main/.gitignore': 'node_modules\ndist\ncoverage\n.env\n',
    'shipseal-v2-main/vite.config.ts': 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react-swc";\nexport default defineConfig({ plugins: [react()] });\n',
    'shipseal-v2-main/tsconfig.json': '{"compilerOptions":{"jsx":"react-jsx","strict":true}}',
    'shipseal-v2-main/tsconfig.app.json': '{"compilerOptions":{"types":["vite/client"]}}',
    'shipseal-v2-main/eslint.config.js': 'export default [];\n',
    'shipseal-v2-main/tailwind.config.ts': 'export default { content: ["./src/**/*.{ts,tsx}"] };\n',
    'shipseal-v2-main/.github/workflows/ci.yml': 'name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
    'shipseal-v2-main/src/main.tsx': 'import React from "react";\nimport { createRoot } from "react-dom/client";\n',
    'shipseal-v2-main/src/App.tsx': 'export function App() { return <main>ShipSeal</main>; }\n',
    'shipseal-v2-main/src/lib/scanner.ts': 'export const scan = () => "scan";\n',
    'shipseal-v2-main/src/lib/readiness.ts': 'export const readiness = () => "ready";\n',
    'shipseal-v2-main/src/lib/deliveryPack/manifest.ts': 'export const paths = ["score.json"];\n',
    'shipseal-v2-main/src/lib/report/clientReportHtml.ts': 'export const html = "<html></html>";\n',
    'shipseal-v2-main/src/test/readiness.test.ts': 'import { describe, it } from "vitest";\ndescribe("ready", () => { it("works", () => {}); });\n',
    'shipseal-v2-main/src/test/githubImport.test.ts': 'import { expect, it } from "vitest";\nit("imports", () => expect(true).toBe(true));\n',
    'shipseal-v2-main/docs/ARCHITECTURE.md': '# Architecture\n\nLocal scanning only.\n',
    'shipseal-v2-main/docs/DELIVERY_PACK.md': '# Delivery Pack\n\nManifest-based export.\n',
    'shipseal-v2-main/public/favicon.svg': new Uint8Array([60, 115, 118, 103, 62]),
    'shipseal-v2-main/dist/assets/index.js': 'console.log("generated");\n',
    'shipseal-v2-main/node_modules/pkg/package.json': '{"name":"pkg"}',
  };
}

function expectFullScanReport(report: ReadinessReport) {
  const scoreJson = buildScoreJson(report);
  const html = generateClientReportHtml({
    intake: normalizeProjectIntake({ projectName: report.repoName }, report.repoName),
    scoreJson,
  });
  const serializedScore = JSON.stringify(scoreJson);

  expect(scoreJson.scanSummary.scanMode).toBe('full');
  expect(scoreJson.scanSummary.limited).toBe(false);
  expect(scoreJson.criticalBlockers.map(blocker => blocker.id)).not.toContain('limited-scan');
  expect(scoreJson.scanSummary.warnings.join('\n')).not.toContain('ZIP parsing failed');
  expect(serializedScore).not.toContain('limited-scan');
  expect(html).not.toContain('Limited scan');
  expect(html).not.toContain('ZIP parsing failed');
  expect(report.mcpReadiness.status).not.toBe('Provisional MCP Readiness');
}

describe('GitHub full-scan dogfood regressions', () => {
  it('fixture dogfood strips GitHub archive root and produces a full report/export', async () => {
    const file = await zipFile('shipseal-v2-main.zip', realisticShipSealEntries());
    const report = await new LocalScanEngine().scan({
      file,
      mode: 'github-public',
      source: { sourceType: 'github-url', githubOwner: 'Csisz', githubRepo: 'shipseal-v2', githubBranch: 'main' },
    });

    expectFullScanReport(report);
    expect(report.scanSummary.totalFilesFound).toBeGreaterThan(20);
    expect(report.scanSummary.filesAnalyzed).toBeGreaterThan(10);
    expect(report.scanSummary.readableTextBytesAnalyzed).toBeGreaterThan(1000);
    expect(report.stack.primary).toBe('React + Vite');
    expect(report.stack.languages).toContain('TypeScript');
    expect(report.summary.keyFolders).toContain('src');
    expect(report.summary.instructionFiles).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md']));
    expect(report.sampleFiles.map(file => file.path)).toEqual(expect.arrayContaining(['package.json', 'src/main.tsx', 'vite.config.ts']));

    const deliveryPack = await buildAgentPackZipBlob(
      report.agentPack,
      report.mcpReadiness.generatedFiles,
      { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
      { repositoryName: report.repoName, scoreJson: buildScoreJson(report) }
    );
    const zip = await JSZip.loadAsync(deliveryPack);
    const exportedScore = JSON.parse(await zip.file('score.json')!.async('string')).content;
    expect(exportedScore.scanSummary.limited).toBe(false);
    expect(JSON.stringify(exportedScore)).not.toContain('limited-scan');
    expect(await zip.file('06-client-handoff/CLIENT_HANDOFF_REPORT.md')!.async('string')).not.toContain('Limited scan');
    expect(await zip.file('06-client-handoff/CLIENT_HANDOFF_REPORT.html')!.async('string')).not.toContain('Limited scan');
  });

  it('HTML saved as ZIP is a limited scan with safe diagnostics', async () => {
    const report = await new LocalScanEngine().scan({
      file: new File(['<!doctype html><html><body>Not a ZIP</body></html>'], 'github-error.zip', { type: 'application/zip' }),
      mode: 'github-public',
      source: { sourceType: 'github-url', githubOwner: 'Csisz', githubRepo: 'shipseal-v2' },
    });

    expect(report.scanSummary.limited).toBe(true);
    expect(report.scanSummary.archiveDiagnostics).toMatchObject({
      inputKind: 'html-error-response',
      startsWithZipMagic: false,
      contentKind: 'html',
    });
    expect(report.blockers.map(blocker => blocker.id)).toContain('limited-scan');
    expect(report.mcpReadiness.status).toBe('Provisional MCP Readiness');
  });
});

const liveDogfood = process.env.SHIPSEAL_LIVE_DOGFOOD === '1' ? it : it.skip;

describe('live GitHub full-scan dogfood', () => {
  liveDogfood('scans https://github.com/Csisz/shipseal-v2 through the public GitHub import path', async () => {
    const imported = await importPublicGitHubRepo({ url: 'https://github.com/Csisz/shipseal-v2' });
    const report = await new LocalScanEngine().scan({
      file: imported.file,
      mode: 'github-public',
      source: imported.source,
    });
    const scoreJson = buildScoreJson(report);

    expectFullScanReport(report);
    console.log('ShipSeal live dogfood scan', {
      totalFilesFound: scoreJson.scanSummary.totalFilesFound,
      filesAnalyzed: scoreJson.scanSummary.filesAnalyzed,
      readableTextBytesAnalyzed: scoreJson.scanSummary.readableTextBytesAnalyzed,
      limitedScanBlockerPresent: scoreJson.criticalBlockers.some(blocker => blocker.id === 'limited-scan'),
    });
    expect(scoreJson.scanSummary.totalFilesFound).toBeGreaterThan(20);
    expect(scoreJson.scanSummary.filesAnalyzed).toBeGreaterThan(10);
    expect(scoreJson.scanSummary.readableTextBytesAnalyzed).toBeGreaterThan(1000);
    expect(scoreJson.scanSummary.archiveDiagnostics?.startsWithZipMagic).toBe(true);
    expect(scoreJson.scanSummary.archiveDiagnostics?.contentKind).toBe('zip');
    expect(scoreJson.detectedStack.frameworks).toEqual(expect.arrayContaining(['React', 'Vite']));
    expect(scoreJson.detectedStack.languages).toContain('TypeScript');
  }, 30000);
});

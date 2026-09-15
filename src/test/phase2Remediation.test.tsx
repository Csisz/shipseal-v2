import { fireEvent, render, screen } from '@testing-library/react';
import JSZip from 'jszip';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter, type ZipWriterAddDataOptions } from '@zip.js/zip.js';
import { describe, expect, it, vi } from 'vitest';
import { PostScanOverview } from '@/components/agentready/result-dashboard/PostScanOverview';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { finalizeRepositoryEvidence, selectRepositoryEvidence } from '@/lib/repositoryEvidence';
import { extractRepositoryHealthSignals } from '@/lib/repositoryHealth';
import { LocalScanEngine } from '@/lib/scanEngine';
import { scanZipFile } from '@/lib/scanner';
import { createEmptyScanSummary } from '@/lib/scannerLimits';
import type { RepoScanInput } from '@/lib/types';

async function validZip() {
  const zip = new JSZip();
  zip.file('valid/README.md', '# Valid repository\n\nA small useful repository.\n\n## Setup\n`pip install -r requirements.txt`\n');
  zip.file('valid/requirements.txt', 'Flask==3.1.0\n');
  zip.file('valid/app.py', 'from flask import Flask\n');
  return new File([await zip.generateAsync({ type: 'blob' })], 'valid.zip', { type: 'application/zip' });
}

async function metadataZip(fileName: string, entryName: string, options: ZipWriterAddDataOptions) {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add(entryName, new Uint8ArrayReader(new TextEncoder().encode('fixture')), options);
  return new File([await writer.close()], fileName, { type: 'application/zip' });
}

function portfolioInput(scanMode: 'full' | 'bounded' = 'full'): RepoScanInput {
  const readme = `# Portfolio Tracker

A web application for tracking investments, users, and portfolio performance.

## Quick start

\`\`\`powershell
pip install -r requirements.txt
python app.py
\`\`\`

## Storage

Local development uses SQLite. Production uses PostgreSQL through DATABASE_URL.

## Tests

\`\`\`powershell
python -m pytest tests/ -v
\`\`\`
`;
  const requirements = [
    'Flask==3.1.0',
    'SQLAlchemy==2.0.36',
    'psycopg2-binary==2.9.10',
    'pytest==8.3.5',
  ].join('\n');
  const files = ['README.md', 'requirements.txt', 'app.py', 'services/db.py', 'tests/test_db.py'];
  return {
    repoName: 'python-fixture',
    files: files.map(path => ({ path, size: 100 })),
    textContents: {
      'README.md': readme,
      'requirements.txt': requirements,
      'app.py': 'from flask import Flask',
      'services/db.py': 'from sqlalchemy import create_engine\nimport sqlite3',
      'tests/test_db.py': 'def test_database(): pass',
    },
    scanSummary: {
      ...createEmptyScanSummary(),
      scanMode,
      totalFilesFound: files.length,
      discoveredFiles: files.length,
      selectedTextFiles: files.length,
      analyzedTextFiles: files.length,
      filesAnalyzed: files.length,
    },
  };
}

describe('Phase 2 remediation contracts', () => {
  it('rejects plain text named .zip without producing scan callbacks', async () => {
    const onScanInput = vi.fn();
    const onScanSummary = vi.fn();
    await expect(new LocalScanEngine().scan({
      mode: 'local',
      file: new File(['plain text'], 'phase2-corrupt.zip', { type: 'application/zip' }),
      source: { sourceType: 'zip-upload' },
    }, { onScanInput, onScanSummary })).rejects.toThrow("We couldn't read this ZIP archive.");
    expect(onScanInput).not.toHaveBeenCalled();
    expect(onScanSummary).not.toHaveBeenCalled();
  });

  it('keeps valid ZIP scanning and the explicit sample path working', async () => {
    const input = await scanZipFile(await validZip());
    expect(input.repoName).toBe('valid');
    expect(input.scanSummary?.scanMode).toBe('full');
    expect(input.textContents['README.md']).toContain('Valid repository');
    expect(buildSampleReport().repoName).toBe('sample-nextjs-app');
  });

  it('rejects encrypted, symlink, and special filesystem ZIP entries', async () => {
    const encrypted = await metadataZip('encrypted.zip', 'secret.txt', { password: 'controlled-fixture', zipCrypto: true });
    const symlink = await metadataZip('symlink.zip', 'link', { unixMode: 0o120777 });
    const special = await metadataZip('special.zip', 'pipe', { unixMode: 0o010644 });

    await expect(scanZipFile(encrypted)).rejects.toThrow(/Encrypted ZIP entries/i);
    await expect(scanZipFile(symlink)).rejects.toThrow(/symbolic links/i);
    await expect(scanZipFile(special)).rejects.toThrow(/special filesystem entry/i);
  });

  it('assigns every discovered portfolio-like file one final coverage class', () => {
    const entries = [
      ...Array.from({ length: 41 }, (_, index) => ({ path: `src/file-${index}.py`, size: 40 })),
      { path: 'assets/chart.png', size: 100 },
      { path: 'data/cache.db', size: 100 },
      { path: 'fx_cache.json.tmp', size: 10 },
      { path: 'portfolio.json.imported', size: 10 },
      { path: 'symbols_cache.json.imported', size: 10 },
    ];
    const selection = selectRepositoryEvidence(entries);
    const contents = Object.fromEntries(selection.selected.map(entry => [entry.path, 'pass']));
    const result = finalizeRepositoryEvidence('coverage-fixture', { sourceType: 'github-app' }, selection, contents);
    expect(result.scanSummary).toMatchObject({
      discoveredFiles: 46,
      filesAnalyzed: 41,
      filesIgnored: 5,
      binaryFilesIgnored: 2,
      unsupportedFilesIgnored: 3,
    });
    expect(result.scanSummary!.filesAnalyzed + result.scanSummary!.filesIgnored).toBe(result.scanSummary!.discoveredFiles);
  });

  it('reconciles a dense bounded repository without overlapping exclusions', () => {
    const entries = [
      ...Array.from({ length: 335 }, (_, index) => ({ path: `src/file-${index}.ts`, size: 40 })),
      ...Array.from({ length: 22 }, (_, index) => ({ path: `assets/image-${index}.png`, size: 40 })),
    ];
    const selection = selectRepositoryEvidence(entries, { maximumFiles: 160, maximumBytes: 100_000 });
    const contents = Object.fromEntries(selection.selected.map(entry => [entry.path, 'export {};']));
    const result = finalizeRepositoryEvidence('bounded-fixture', { sourceType: 'github-app' }, selection, contents);
    expect(result.scanSummary).toMatchObject({
      scanMode: 'bounded',
      discoveredFiles: 357,
      filesAnalyzed: 160,
      filesIgnored: 197,
      binaryFilesIgnored: 22,
      budgetExcludedFiles: 175,
    });
    expect(result.scanSummary!.filesAnalyzed + result.scanSummary!.filesIgnored).toBe(357);
  });

  it('extracts repository-supported Python stack, package, database, and test evidence', () => {
    const report = buildReport(portfolioInput());
    expect(report.stack.languages).toContain('Python');
    expect(report.stack.frameworks).toContain('Flask');
    expect(report.stack.packageManagers).toContain('pip');
    expect(report.stack.dataLayers || []).toContain('SQLAlchemy');
    expect(report.stack.databases || []).toEqual(expect.arrayContaining(['PostgreSQL', 'SQLite']));
    expect(report.stack.testFrameworks).toContain('pytest');
    expect(report.stack.runCommands).toContainEqual({ label: 'Test', cmd: 'python -m pytest tests/ -v' });
  });

  it('uses canonical README and command evidence to prevent contradictory findings', () => {
    const report = buildReport(portfolioInput());
    const allClaims = JSON.stringify({
      improvements: report.improvements,
      signals: Object.values(report.repositoryHealth.dimensions).flatMap(dimension => dimension.signals),
      actions: report.repositoryHealth.topActions,
    });
    expect(allClaims).not.toMatch(/README lacks (?:project )?purpose|No test command detected|Add a compact context anchor/i);
    expect(report.categories.flatMap(category => category.items).find(item => item.id === 'readme_purpose')?.passed).toBe(true);
    expect(report.repositoryHealth.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.compact-anchor-missing')?.status).toBe('pass');
  });

  it('scopes bounded negative evidence to analyzed content instead of repository-wide absence', () => {
    const signals = extractRepositoryHealthSignals(portfolioInput('bounded')).signals;
    const ci = signals.find(signal => signal.id === 'ai.ci-workflow');
    expect(ci?.status).toBe('unknown');
    expect(ci?.evidence.join(' ')).toContain('Not observed in analyzed evidence');
  });

  it('discloses bounded analyzed-versus-discovered coverage in the stage result', () => {
    const report = buildReport(portfolioInput('bounded'));
    report.scanSummary.discoveredFiles = 357;
    report.scanSummary.totalFilesFound = 357;
    report.scanSummary.analyzedTextFiles = 160;
    report.scanSummary.filesAnalyzed = 160;
    report.scanSummary.filesIgnored = 197;
    report.scanSummary.budgetExcludedFiles = 197;
    report.scanSummary.boundedReasons = ['selected-file-budget'];
    render(
      <PostScanOverview
        report={report}
        variant="stage"
        frictions={[]}
        onReviewRepositoryIntelligence={vi.fn()}
        onPlanAgentTask={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText('Bounded analysis')).toBeInTheDocument();
    expect(screen.getByText('160 of 357 files analyzed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText(/deterministic high-value evidence selection reached the safe file budget/i)).toBeInTheDocument();
    expect(screen.getByText(/unobserved, not absent/i)).toBeInTheDocument();
  });
});

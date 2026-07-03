import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildReport } from '@/lib/readiness';
import { buildAgentPackZipBlob, buildRepoContextPackJson, buildScoreJson } from '@/lib/exports';
import { createEmptyScanSummary } from '@/lib/scannerLimits';
import { detectStack } from '@/lib/stack';
import { scoreRepo } from '@/lib/scoring';
import type { RepoFileSummary, RepoScanInput, ScanSummary } from '@/lib/types';

function scanInput(
  paths: string[],
  textContents: Record<string, string> = {},
  options: { sizes?: Record<string, number>; scanSummary?: ScanSummary } = {},
): RepoScanInput {
  return {
    repoName: 'repository-health-integration',
    files: paths.map(path => ({
      path,
      size: options.sizes?.[path] ?? textContents[path]?.length ?? 100,
      ignored: /(^|\/)(node_modules|dist|build|coverage|vendor)(\/|$)/.test(path),
      ignoredReason: /(^|\/)(node_modules|dist|build|coverage|vendor)(\/|$)/.test(path) ? 'generated-vendor' : undefined,
    } satisfies RepoFileSummary)),
    textContents,
    scanSummary: options.scanSummary,
  };
}

function normalInput(extraPaths: string[] = [], extraText: Record<string, string> = {}, sizes: Record<string, number> = {}): RepoScanInput {
  const packageJson = JSON.stringify({
    scripts: { build: 'vite build', test: 'vitest', lint: 'eslint .' },
    dependencies: { react: '^18.3.1', vite: '^5.4.0' },
    devDependencies: { vitest: '^3.2.4' },
  });

  return scanInput([
    'README.md',
    'AGENTS.md',
    'src/main.tsx',
    'src/main.test.tsx',
    'package.json',
    'package-lock.json',
    '.gitignore',
    '.env.example',
    'SECURITY.md',
    'docs/README.md',
    'docs/TASK_ROUTER.md',
    'docs/COMMANDS.md',
    'docs/CRITICAL_FILES_POLICY.md',
    'docs/KNOWN_RISKS.md',
    'docs/DEPLOYMENT.md',
    'docs/RELEASE_CHECKLIST.md',
    '.github/workflows/ci.yml',
    ...extraPaths,
  ], {
    'README.md': '# Fixture\n\nOverview and setup.\nPRIVATE_README_BODY_SHOULD_NOT_EXPORT\n',
    'AGENTS.md': '# Agent rules\n',
    'package.json': packageJson,
    '.gitignore': 'node_modules\ndist\nbuild\ncoverage\n.env\n',
    '.env.example': 'SECRET_TOKEN=do-not-export-this-value\n',
    'SECURITY.md': '# Security\n',
    'docs/README.md': '# Docs index\n',
    'docs/TASK_ROUTER.md': '# Task router\n',
    'docs/COMMANDS.md': '# Commands\nnpm run build\nnpm run test\n',
    'docs/CRITICAL_FILES_POLICY.md': '# Critical files\n',
    'docs/KNOWN_RISKS.md': '# Known risks\n',
    'docs/DEPLOYMENT.md': '# Deploy\n',
    'docs/RELEASE_CHECKLIST.md': '# Release\n',
    '.github/workflows/ci.yml': 'steps:\n  - run: npm ci\n  - run: npm run build\n  - run: npm run test\n',
    ...extraText,
  }, { sizes });
}

describe('Repository Health report and score.json integration', () => {
  it('attaches Repository Health to the central report without changing legacy readiness scoring', () => {
    const input = normalInput();
    const report = buildReport(input);
    const legacyScoring = scoreRepo(input, detectStack(input));

    expect(report.repositoryHealth.modelVersion).toBe('repository-health-v1');
    expect(report.repositoryHealth.measurementMethod).toBe('deterministic-static-scan');
    expect(report.repositoryHealth.overall.score).toEqual(expect.any(Number));
    expect(report.score).toBe(legacyScoring.score);
    expect(report.level).toBe('Almost Ready');
    expect(buildReport(input).repositoryHealth).toEqual(report.repositoryHealth);
  });

  it('calculates Repository Health from the full scan inventory, not sampleFiles', () => {
    const filler = Array.from({ length: 35 }, (_, index) => `src/filler-${index}.ts`);
    const giantPath = 'src/not-in-sample-files.ts';
    const report = buildReport(normalInput([...filler, giantPath], {}, { [giantPath]: 600 * 1024 }));
    const largeFileSignal = report.repositoryHealth.dimensions.contextWaste.signals
      .find(signal => signal.id === 'waste.large-relevant-files');

    expect(report.sampleFiles.map(file => file.path)).not.toContain(giantPath);
    expect(largeFileSignal?.status).toBe('fail');
    expect(largeFileSignal?.evidence.join('\n')).toContain(giantPath);
  });

  it('keeps Repository Health unavailable for limited synthetic fallback scans', () => {
    const summary: ScanSummary = {
      ...createEmptyScanSummary(),
      scanMode: 'limited-fallback',
      limited: true,
      limitationReason: 'ZIP parsing failed before repository contents could be fully analyzed.',
      warnings: ['fallback scan'],
    };
    const report = buildReport(scanInput(['README.md', 'AGENTS.md', 'package.json', 'src/main.ts'], {
      'README.md': '# Synthetic fallback\n',
      'AGENTS.md': '# Synthetic agent file\n',
      'package.json': JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' } }),
    }, { scanSummary: summary }));
    const allSignals = [
      ...report.repositoryHealth.dimensions.repositoryIntelligence.signals,
      ...report.repositoryHealth.dimensions.contextWaste.signals,
      ...report.repositoryHealth.dimensions.aiDevelopmentReadiness.signals,
      ...report.repositoryHealth.dimensions.agentRouting.signals,
      ...report.repositoryHealth.dimensions.deliveryConfidence.signals,
    ];

    expect(report.repositoryHealth.overall).toEqual({
      score: null,
      status: 'Insufficient evidence',
      confidence: 'Low',
    });
    expect(allSignals.every(signal => signal.status === 'unknown' && signal.earned === 0)).toBe(true);
    expect(report.score).toBeLessThanOrEqual(20);
    expect(report.blockers.map(blocker => blocker.id)).toContain('limited-scan');
  });

  it('adds score.json schema v2, legacy compatibility, and Repository Health additively', () => {
    const report = buildReport(normalInput());
    const scoreJson = buildScoreJson(report);

    expect(scoreJson.scoreSchemaVersion).toBe(2);
    expect(scoreJson.score).toBe(report.score);
    expect(scoreJson.status).toBe(report.level);
    expect(scoreJson.isReady).toBe(report.isReady);
    expect(scoreJson.categories).toEqual(report.categories);
    expect(scoreJson.legacyReadiness).toEqual({
      score: scoreJson.score,
      status: scoreJson.status,
      isReady: scoreJson.isReady,
      categories: scoreJson.categories,
    });
    expect(scoreJson.repositoryHealth).toEqual(report.repositoryHealth);
    expect(scoreJson.generatedFiles).toContain('score.json');
  });

  it('places schema v2, legacy readiness, and Repository Health inside nested Delivery Pack score.json content', async () => {
    const report = buildReport(normalInput());
    const expectedScoreJson = buildScoreJson(report);
    const blob = await buildAgentPackZipBlob(
      report.agentPack,
      report.mcpReadiness.generatedFiles,
      { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
      { repositoryName: report.repoName, scoreJson: expectedScoreJson },
    );
    const zip = await JSZip.loadAsync(blob);
    const wrappedScoreJson = JSON.parse(await zip.file('score.json')!.async('string'));

    expect(wrappedScoreJson.content.scoreSchemaVersion).toBe(2);
    expect(wrappedScoreJson.content.score).toBe(expectedScoreJson.score);
    expect(wrappedScoreJson.content.legacyReadiness).toEqual(expectedScoreJson.legacyReadiness);
    expect(wrappedScoreJson.content.repositoryHealth).toEqual(expectedScoreJson.repositoryHealth);
  });

  it('serializes score.json safely without raw readable content, env values, undefined, or unsupported claims', () => {
    const scoreJson = buildScoreJson(buildReport(normalInput()));
    const serialized = JSON.stringify(scoreJson);
    const parsed = JSON.parse(serialized);

    expect(parsed).toEqual(scoreJson);
    expect(serialized).not.toContain('PRIVATE_README_BODY_SHOULD_NOT_EXPORT');
    expect(serialized).not.toContain('do-not-export-this-value');
    expect(serialized).not.toContain('undefined');
    expect(serialized.toLowerCase()).not.toMatch(/token-saving|token saving|financial savings|guaranteed speed|tests passed|build passed/);
    expect(serialized).toContain('deterministic static repository estimate');
    expect(hasNoUndefined(scoreJson)).toBe(true);
  });

  it('generates Python AGENTS.md without invented npm commands when no verification command is detected', () => {
    const report = buildReport(scanInput([
      'README.md',
      'pyproject.toml',
      'requirements.txt',
      'contentflow_ai/__init__.py',
      'contentflow_ai/routes.py',
      'tests/test_routes.py',
    ], {
      'README.md': '# ContentFlow\n\nOverview and setup.\n',
      'pyproject.toml': '[project]\ndependencies = ["flask"]\n',
      'requirements.txt': 'flask\n',
    }));
    const agents = report.agentPack.find(file => file.name === 'AGENTS.md')?.content || '';

    expect(report.stack.primary).toBe('Flask');
    expect(report.summary.keyFolders).toContain('contentflow_ai');
    expect(agents).not.toMatch(/npm run|pnpm|yarn|bun/);
    expect(agents).toContain('No verified test, build, lint, or typecheck command was detected');
    expect(agents).toContain('Manually verify the test command');
  });

  it('uses detected Python Makefile commands when generating AGENTS.md', () => {
    const report = buildReport(scanInput([
      'README.md',
      'pyproject.toml',
      'Makefile',
      'contentflow_ai/__init__.py',
      'contentflow_ai/app.py',
      'tests/test_app.py',
    ], {
      'README.md': '# ContentFlow\n\nOverview and setup.\n',
      'pyproject.toml': '[project]\ndependencies = ["flask"]\n',
      'Makefile': 'test:\n\tpython -m unittest\nlint:\n\tpython -m compileall contentflow_ai\n',
    }));
    const agents = report.agentPack.find(file => file.name === 'AGENTS.md')?.content || '';

    expect(agents).toContain('make test');
    expect(agents).toContain('make lint');
    expect(agents).not.toContain('npm run');
  });

  it('normalizes GitHub App source metadata across report, scan evidence, score.json, and Markdown', () => {
    const report = buildReport({
      ...normalInput(),
      source: {
        sourceType: 'github-url',
        githubOwner: 'Csisz',
        githubRepo: 'contentflow-ai',
        githubBranch: 'main',
        githubInstallationId: '12345',
      },
    });
    const scoreJson = buildScoreJson(report);
    const markdown = report.agentPack.find(file => file.name === 'AGENT_READINESS_REPORT.md')?.content || '';

    expect(report.source.sourceType).toBe('github-app');
    expect(report.source.originalSourceType).toBe('github-url');
    expect(report.scanEvidence.sourceType).toBe('github-app');
    expect(scoreJson.source.sourceType).toBe('github-app');
    expect(scoreJson.scanEvidence.sourceType).toBe('github-app');
    expect(markdown).toContain('- Source type: github-app');
    expect(markdown).not.toContain('- Source type: github-url');
  });

  it('does not use blocker-remediation copy when blockers are empty but score is below ready threshold', () => {
    const report = buildReport(scanInput([
      'README.md',
      'package.json',
      'src/main.ts',
      'src/main.test.ts',
    ], {
      'README.md': '# App\n\nOverview and setup.\n',
      'package.json': JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' }, dependencies: { vite: '^5.4.0' } }),
    }));
    const agents = report.agentPack.find(file => file.name === 'AGENTS.md')?.content || '';
    const markdown = report.agentPack.find(file => file.name === 'AGENT_READINESS_REPORT.md')?.content || '';

    expect(report.blockers).toHaveLength(0);
    expect(report.isReady).toBe(false);
    expect(report.aiNarrative.blockerExplanation).toContain('There are no critical blockers');
    expect(agents).toContain('No critical blocker was detected');
    expect(markdown).toContain('No critical blocker was detected, but the repository has not reached the readiness threshold');
    expect(markdown).not.toContain('Resolve every critical blocker listed above');
  });
});

function hasNoUndefined(value: unknown): boolean {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.every(hasNoUndefined);
  if (value && typeof value === 'object') {
    return Object.values(value).every(hasNoUndefined);
  }
  return true;
}

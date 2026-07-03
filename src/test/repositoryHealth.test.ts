import { describe, expect, it } from 'vitest';
import { createEmptyScanSummary } from '@/lib/scannerLimits';
import { extractRepositoryHealthSignals, scoreRepositoryHealth } from '@/lib/repositoryHealth';
import { hasRecommendationForFailedSignal } from '@/lib/repositoryHealth/recommendations';
import type { RepoFileSummary, RepoScanInput, ScanSummary } from '@/lib/types';

function repo(
  paths: string[],
  textContents: Record<string, string> = {},
  options: { sizes?: Record<string, number>; scanSummary?: ScanSummary } = {},
): RepoScanInput {
  return {
    repoName: 'health-fixture',
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

function healthyRepo(extraPaths: string[] = [], extraText: Record<string, string> = {}, sizes: Record<string, number> = {}): RepoScanInput {
  const packageJson = JSON.stringify({
    scripts: { build: 'vite build', test: 'vitest', lint: 'eslint .' },
    dependencies: { react: '^18.3.1', vite: '^5.4.0' },
    devDependencies: { vitest: '^3.2.4' },
  });
  const workflow = 'steps:\n  - run: npm ci\n  - run: npm run build\n  - run: npm run test\n';
  return repo([
    'README.md',
    'AGENTS.md',
    'src/AGENTS.md',
    'docs/AGENTS.md',
    'tests/AGENTS.md',
    'src/main.tsx',
    'src/App.test.tsx',
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
    'README.md': '# Fixture\n\nOverview and setup.\n',
    'AGENTS.md': '# Agent instructions\n\nRun tests and review critical files.\n',
    'src/AGENTS.md': '# Source instructions\n',
    'docs/AGENTS.md': '# Docs instructions\n',
    'tests/AGENTS.md': '# Test instructions\n',
    'package.json': packageJson,
    '.gitignore': 'node_modules\ndist\nbuild\ncoverage\n.env\n',
    '.env.example': 'VITE_API_URL=\n',
    'SECURITY.md': '# Security\nKnown review boundaries.\n',
    'docs/README.md': '# Docs index\n',
    'docs/TASK_ROUTER.md': '# Task router\nUI -> src, tests -> src/*.test.tsx.\n',
    'docs/COMMANDS.md': '# Commands\nnpm run build\nnpm run test\n',
    'docs/CRITICAL_FILES_POLICY.md': '# Critical files\n',
    'docs/KNOWN_RISKS.md': '# Known risks\n',
    'docs/DEPLOYMENT.md': '# Deployment\n',
    'docs/RELEASE_CHECKLIST.md': '# Release\nRollback owner notes.\n',
    '.github/workflows/ci.yml': workflow,
    ...extraText,
  }, { sizes });
}

describe('Repository Health pure core', () => {
  it('calculates deterministic scores and is independent of file order', () => {
    const input = healthyRepo();
    const reversed = { ...input, files: [...input.files].reverse() };

    expect(scoreRepositoryHealth(input)).toEqual(scoreRepositoryHealth(input));
    expect(scoreRepositoryHealth(reversed)).toEqual(scoreRepositoryHealth(input));
  });

  it('scores generated/vendor file and byte ratios as context waste risk', () => {
    const noisy = healthyRepo([
      'node_modules/a/index.js',
      'node_modules/b/index.js',
      'dist/bundle.js',
      'coverage/lcov.info',
    ], {}, {
      'node_modules/a/index.js': 500_000,
      'node_modules/b/index.js': 500_000,
      'dist/bundle.js': 500_000,
      'coverage/lcov.info': 500_000,
    });

    const result = scoreRepositoryHealth(noisy);

    expect(result.dimensions.contextWaste.riskScore).toBeGreaterThan(0);
    expect(result.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.generated-file-ratio')?.status).toBe('partial');
    expect(result.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.generated-byte-ratio')?.status).toBe('fail');
  });

  it('detects large and giant relevant files', () => {
    const input = healthyRepo(['src/large.ts', 'src/giant.ts'], {}, {
      'src/large.ts': 130 * 1024,
      'src/giant.ts': 600 * 1024,
    });
    const signal = scoreRepositoryHealth(input).dimensions.contextWaste.signals.find(item => item.id === 'waste.large-relevant-files');

    expect(signal?.status).toBe('fail');
    expect(signal?.evidence.join('\n')).toContain('src/giant.ts');
  });

  it('excludes dependency lockfiles from oversized relevant-context detection', () => {
    const input = healthyRepo(['pnpm-lock.yaml', 'Pipfile.lock', 'uv.lock'], {}, {
      'package-lock.json': 700 * 1024,
      'pnpm-lock.yaml': 700 * 1024,
      'Pipfile.lock': 700 * 1024,
      'uv.lock': 700 * 1024,
    });
    const signal = scoreRepositoryHealth(input).dimensions.contextWaste.signals.find(item => item.id === 'waste.large-relevant-files');

    expect(signal?.status).toBe('pass');
    expect(signal?.evidence.join('\n')).not.toMatch(/lock/i);
  });

  it('groups exact duplicate readable documentation after normalization', () => {
    const input = healthyRepo(
      ['docs/duplicate-a.md', 'docs/duplicate-b.md'],
      {
        'docs/duplicate-a.md': '# Same\r\n\r\nGenerated by ShipSeal.\r\nBody text.\r\n',
        'docs/duplicate-b.md': '# Same\n\nBody text.\n',
      },
    );
    const extracted = extractRepositoryHealthSignals(input);

    expect(extracted.duplicateDocumentationGroups).toHaveLength(1);
    expect(extracted.signals.find(signal => signal.id === 'waste.duplicate-docs')?.status).toBe('fail');
  });

  it('distinguishes active documentation conflicts from legacy/archive documents', () => {
    const conflicting = healthyRepo(['docs/architecture.md', 'docs/system-design-architecture.md'], {
      'docs/architecture.md': '# Architecture\n',
      'docs/system-design-architecture.md': '# Architecture alternative\n',
    });
    const archived = healthyRepo(['docs/architecture.md', 'docs/archive/system-design-architecture.md'], {
      'docs/architecture.md': '# Architecture\n',
      'docs/archive/system-design-architecture.md': '# Architecture alternative\n',
    });

    expect(scoreRepositoryHealth(conflicting).dimensions.contextWaste.signals.find(signal => signal.id === 'waste.canonical-conflicts')?.status).toBe('fail');
    expect(scoreRepositoryHealth(archived).dimensions.contextWaste.signals.find(signal => signal.id === 'waste.canonical-conflicts')?.status).toBe('pass');
    expect(scoreRepositoryHealth(archived).dimensions.contextWaste.riskScore)
      .toBeLessThan(scoreRepositoryHealth(conflicting).dimensions.contextWaste.riskScore || 0);
  });

  it('does not group unrelated planning documents as canonical conflicts', () => {
    const result = scoreRepositoryHealth(healthyRepo([
      'docs/GITHUB_APP_CONNECT_PLAN.md',
      'docs/GITHUB_IMPORT_PROXY_PLAN.md',
      'docs/CREATE_READINESS_PR_PLAN.md',
      'docs/SHIPSEAL_2026_PRODUCT_ROADMAP.md',
      'docs/PRODUCT_BACKLOG.md',
      'docs/Sprint-Omega-Repository-Health-Implementation-Blueprint.md',
    ]));
    const canonicalConflict = result.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.canonical-conflicts');

    expect(canonicalConflict?.status).toBe('pass');
    expect(canonicalConflict?.evidence.join('\n')).not.toContain('PLAN');
  });

  it('still reports active same-topic roadmap variants as canonical conflicts', () => {
    const result = scoreRepositoryHealth(healthyRepo(['ROADMAP.md', 'ROADMAP_2026.md', 'ROADMAP_V2.md']));
    const conflictSignal = result.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.canonical-conflicts');
    const topActionIds = result.topActions.map(action => action.id);

    expect(conflictSignal?.status).toBe('fail');
    expect(conflictSignal?.evidence.join('\n')).toContain('roadmap:roadmap');
    expect(topActionIds.filter(id => id === 'canonical-document-conflict')).toHaveLength(1);
    expect(result.topActions.map(action => action.title).join('\n')).not.toContain('Resolve duplicate canonical documentation families');
  });

  it('separates active documentation sprawl from canonical conflicts', () => {
    const manyDocs = Array.from({ length: 12 }, (_, index) => `docs/topic-${index}.md`);
    const result = scoreRepositoryHealth(healthyRepo(manyDocs));
    const sprawl = result.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.active-doc-sprawl');
    const conflicts = result.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.canonical-conflicts');
    const sprawlAction = result.topActions.find(action => action.id === 'documentation-sprawl');

    expect(sprawl?.status).toBe('fail');
    expect(sprawl?.evidence.join('\n')).toContain('Active documentation files:');
    expect(sprawl?.evidence.join('\n')).toContain('Review the active documentation set');
    expect(conflicts?.status).toBe('pass');
    expect(sprawlAction?.title).toBe('Review the active documentation set');
    expect(sprawlAction?.action).not.toMatch(/duplicate|competing/i);
  });

  it('detects nested instruction coverage and task routers', () => {
    const result = scoreRepositoryHealth(healthyRepo());

    expect(result.dimensions.agentRouting.signals.find(signal => signal.id === 'route.folder-instructions')?.status).toBe('pass');
    expect(result.dimensions.agentRouting.signals.find(signal => signal.id === 'route.task-router')?.status).toBe('pass');
  });

  it('recognizes a top-level Python package as a source folder and importable package', () => {
    const extracted = extractRepositoryHealthSignals(repo([
      'README.md',
      'pyproject.toml',
      'contentflow_ai/__init__.py',
      'contentflow_ai/routes.py',
      'contentflow_ai/services.py',
      'tests/test_routes.py',
    ], {
      'README.md': '# ContentFlow\n',
      'pyproject.toml': '[project]\ndependencies = ["flask"]\n',
    }));

    expect(extracted.sourceFolders).toContain('contentflow_ai');
    expect(extracted.files.find(file => file.path === 'tests/test_routes.py')?.kind).toBe('test');
    expect(extracted.signals.find(signal => signal.id === 'repo.source-map')?.evidence.join('\n')).toContain('contentflow_ai');
  });

  it('recognizes a src/package Python layout as a source folder', () => {
    const extracted = extractRepositoryHealthSignals(repo([
      'README.md',
      'pyproject.toml',
      'src/contentflow_ai/__init__.py',
      'src/contentflow_ai/app.py',
      'tests/test_app.py',
    ], {
      'README.md': '# ContentFlow\n',
      'pyproject.toml': '[project]\ndependencies = ["flask"]\n',
      'src/contentflow_ai/app.py': 'from flask import Flask\napp = Flask(__name__)\n',
    }));

    expect(extracted.sourceFolders).toContain('src/contentflow_ai');
    expect(extracted.entryPointCandidates).toContain('src/contentflow_ai/app.py');
  });

  it('detects deterministic Python entry-point candidates without claiming execution validity', () => {
    const extracted = extractRepositoryHealthSignals(repo([
      'pyproject.toml',
      'contentflow_ai/__init__.py',
      'contentflow_ai/app_factory.py',
      'contentflow_ai/cli.py',
    ], {
      'pyproject.toml': '[project.scripts]\ncontentflow = "contentflow_ai.cli:main"\n',
      'contentflow_ai/app_factory.py': 'from flask import Flask\n\ndef create_app():\n    return Flask(__name__)\n',
    }));

    expect(extracted.entryPointCandidates).toEqual(expect.arrayContaining([
      'contentflow_ai/app_factory.py',
      'contentflow_ai/cli.py',
      'pyproject.toml: contentflow -> contentflow_ai.cli:main',
    ]));
  });

  it('distinguishes an importable Python package from a missing executable entry point', () => {
    const result = scoreRepositoryHealth(repo([
      'README.md',
      'pyproject.toml',
      'contentflow_ai/__init__.py',
      'contentflow_ai/domain.py',
    ], {
      'README.md': '# ContentFlow\n',
      'pyproject.toml': '[project]\ndependencies = ["flask"]\n',
    }));
    const signal = result.dimensions.agentRouting.signals.find(item => item.id === 'route.entry-point-clarity');

    expect(signal?.status).toBe('fail');
    expect(signal?.evidence.join('\n')).toContain('Importable source package or source folder detected: contentflow_ai');
    expect(signal?.evidence.join('\n')).toContain('Executable entry point not detected');
  });

  it('flags entry-point ambiguity when too many entry candidates exist', () => {
    const ambiguous = healthyRepo([
      'src/index.ts',
      'src/main.ts',
      'app/page.tsx',
      'cmd/api/main.go',
      'cmd/worker/main.go',
      'main.py',
    ]);

    expect(scoreRepositoryHealth(ambiguous).dimensions.contextWaste.signals.find(signal => signal.id === 'waste.entrypoint-ambiguity')?.status).toBe('partial');
  });

  it('detects CI and package-script cross-reference from readable workflow content', () => {
    const result = scoreRepositoryHealth(healthyRepo());

    expect(result.dimensions.aiDevelopmentReadiness.signals.find(signal => signal.id === 'ai.ci-script-cross-reference')?.status).toBe('pass');
  });

  it('returns insufficient evidence for limited fallback scans', () => {
    const summary = {
      ...createEmptyScanSummary(),
      scanMode: 'limited-fallback' as const,
      limited: true,
      limitationReason: 'ZIP parsing failed before repository contents could be fully analyzed.',
      warnings: ['fallback scan'],
    };

    const result = scoreRepositoryHealth(repo(['README.md', 'package.json'], {
      'README.md': '# Fallback\n',
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
    }, { scanSummary: summary }));

    expect(result.overall).toMatchObject({ score: null, status: 'Insufficient evidence', confidence: 'Low' });
    expect(result.blockers.map(blocker => blocker.id)).toContain('limited-scan');
  });

  it('scores only current repository state and does not count ungenerated ShipSeal outputs', () => {
    const current = repo(['README.md', 'package.json', 'src/main.tsx'], {
      'README.md': '# Current\n',
      'package.json': JSON.stringify({ scripts: { build: 'vite build' } }),
    });
    const result = scoreRepositoryHealth(current);

    expect(result.dimensions.repositoryIntelligence.signals.find(signal => signal.id === 'repo.instructions-root')?.status).toBe('fail');
    expect(result.topActions.map(action => action.suggestedTargetPath)).toContain('AGENTS.md');
  });

  it('maps every failed signal to a deterministic recommendation', () => {
    const result = scoreRepositoryHealth(repo(['src/main.ts']));
    const allSignals = [
      ...result.dimensions.repositoryIntelligence.signals,
      ...result.dimensions.contextWaste.signals,
      ...result.dimensions.aiDevelopmentReadiness.signals,
      ...result.dimensions.agentRouting.signals,
      ...result.dimensions.deliveryConfidence.signals,
    ];

    expect(allSignals.filter(signal => signal.status === 'fail').every(hasRecommendationForFailedSignal)).toBe(true);
  });

  it('does not recommend package.json for a Python-only project without package.json', () => {
    const result = scoreRepositoryHealth(repo([
      'README.md',
      'pyproject.toml',
      'requirements.txt',
      'contentflow_ai/__init__.py',
      'contentflow_ai/app.py',
      'tests/test_app.py',
    ], {
      'README.md': '# ContentFlow\n',
      'pyproject.toml': '[project]\ndependencies = ["flask"]\n',
      'requirements.txt': 'flask\n',
    }));
    const serializedActions = JSON.stringify(result.topActions);

    expect(serializedActions).not.toContain('package.json');
    expect(result.topActions.some(action => ['pyproject.toml', 'requirements.txt', 'README.md'].includes(action.suggestedTargetPath || ''))).toBe(true);
  });

  it('keeps package.json guidance for JavaScript projects when appropriate', () => {
    const result = scoreRepositoryHealth(repo(['README.md', 'package.json', 'src/main.ts'], {
      'README.md': '# App\n',
      'package.json': JSON.stringify({ scripts: { build: 'vite build' }, dependencies: { vite: '^5.4.0' } }),
    }));

    expect(result.topActions.map(action => action.suggestedTargetPath)).toContain('package.json');
  });

  it('merges duplicate root AGENTS.md recommendations into one top action', () => {
    const result = scoreRepositoryHealth(repo(['README.md', 'package.json', 'src/main.ts'], {
      'README.md': '# App\n',
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
    }));
    const agentsActions = result.topActions.filter(action => action.suggestedTargetPath === 'AGENTS.md');

    expect(agentsActions).toHaveLength(1);
    expect(agentsActions[0].id).toBe('root-agent-instructions');
    expect(agentsActions[0].dimensions).toEqual(expect.arrayContaining(['repositoryIntelligence', 'agentRouting']));
  });

  it('scores folder-instruction coverage as pass, fail, partial, and not-applicable', () => {
    const pass = scoreRepositoryHealth(repo([
      'README.md', 'AGENTS.md', 'src/AGENTS.md', 'docs/AGENTS.md', 'src/main.ts', 'docs/README.md',
    ], { 'README.md': '# App\n', 'AGENTS.md': '# Root\n', 'src/AGENTS.md': '# Src\n', 'docs/AGENTS.md': '# Docs\n', 'docs/README.md': '# Docs\n' }));
    const fail = scoreRepositoryHealth(repo([
      'README.md', 'AGENTS.md', 'src/main.ts', 'docs/README.md', 'tests/app.test.ts',
    ], { 'README.md': '# App\n', 'AGENTS.md': '# Root\n', 'docs/README.md': '# Docs\n' }));
    const partial = scoreRepositoryHealth(repo([
      'README.md', 'AGENTS.md', 'src/AGENTS.md', 'src/main.ts', 'docs/README.md', 'tests/app.test.ts',
    ], { 'README.md': '# App\n', 'AGENTS.md': '# Root\n', 'src/AGENTS.md': '# Src\n', 'docs/README.md': '# Docs\n' }));
    const notApplicable = scoreRepositoryHealth(repo([
      'README.md', 'AGENTS.md', 'src/main.ts',
    ], { 'README.md': '# Small\n', 'AGENTS.md': '# Root\n' }));

    expect(pass.dimensions.agentRouting.signals.find(signal => signal.id === 'route.folder-instructions')?.status).toBe('pass');
    expect(fail.dimensions.agentRouting.signals.find(signal => signal.id === 'route.folder-instructions')?.status).toBe('fail');
    expect(partial.dimensions.agentRouting.signals.find(signal => signal.id === 'route.folder-instructions')?.status).toBe('partial');
    expect(notApplicable.dimensions.agentRouting.signals.find(signal => signal.id === 'route.folder-instructions')?.status).toBe('not-applicable');
  });

  it('scores compact context anchors from actual detected anchors', () => {
    const oneAnchor = scoreRepositoryHealth(repo(['README.md', 'src/main.ts'], { 'README.md': '# App\n' }));
    const twoAnchors = scoreRepositoryHealth(repo(['README.md', 'AGENTS.md', 'src/main.ts'], {
      'README.md': '# App\n',
      'AGENTS.md': '# Root agent guidance\n',
    }));
    const oneAnchorSignal = oneAnchor.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.compact-anchor-missing');
    const twoAnchorSignal = twoAnchors.dimensions.contextWaste.signals.find(signal => signal.id === 'waste.compact-anchor-missing');

    expect(oneAnchorSignal?.status).toBe('partial');
    expect(oneAnchorSignal?.evidence.join('\n')).toContain('README/project overview');
    expect(oneAnchorSignal?.evidence.join('\n')).not.toContain('task router');
    expect(twoAnchorSignal?.status).toBe('pass');
    expect(twoAnchorSignal?.evidence.join('\n')).toContain('root agent instructions');
  });

  it('orders top actions by priority, potential gain, and stable id', () => {
    const result = scoreRepositoryHealth(repo(['src/main.ts']));

    expect(result.topActions.length).toBeLessThanOrEqual(5);
    expect(result.topActions[0].priority).toBe('High');
    expect(result.topActions.map(action => action.id)).toEqual([...result.topActions.map(action => action.id)].sort((a, b) => {
      const actionA = result.topActions.find(action => action.id === a)!;
      const actionB = result.topActions.find(action => action.id === b)!;
      const priority = rank(actionB.priority) - rank(actionA.priority);
      if (priority) return priority;
      const gain = actionB.potentialDimensionGain - actionA.potentialDimensionGain;
      if (gain) return gain;
      return actionA.id.localeCompare(actionB.id);
    }));
  });

  it('does not emit unsupported token-saving, savings, speed, or pass claims', () => {
    const serialized = JSON.stringify(scoreRepositoryHealth(healthyRepo())).toLowerCase();

    expect(serialized).not.toMatch(/token-saving|token saving|financial savings|guaranteed speed|tests passed|build passed/);
    expect(serialized).toContain('does not measure actual provider token usage');
    expect(serialized).toContain('detected commands, tests, and ci files are not proof that they pass');
  });

  it('keeps monotonic behavior for root and folder instructions', () => {
    const withoutAgents = healthyRepo().files.filter(file => !file.path.toLowerCase().endsWith('agents.md')).map(file => file.path);
    const withoutAgentsText = Object.fromEntries(Object.entries(healthyRepo().textContents).filter(([path]) => !path.toLowerCase().endsWith('agents.md')));
    const base = scoreRepositoryHealth(repo(withoutAgents, withoutAgentsText));
    const withRoot = scoreRepositoryHealth(repo(['AGENTS.md', ...withoutAgents], { 'AGENTS.md': '# Agents\n', ...withoutAgentsText }));
    const withNested = scoreRepositoryHealth(healthyRepo());

    expect(withRoot.dimensions.repositoryIntelligence.score || 0).toBeGreaterThanOrEqual(base.dimensions.repositoryIntelligence.score || 0);
    expect(withNested.dimensions.agentRouting.score || 0).toBeGreaterThanOrEqual(withRoot.dimensions.agentRouting.score || 0);
  });

  it('does not improve Context Waste Risk when node_modules is added', () => {
    const clean = scoreRepositoryHealth(healthyRepo());
    const noisy = scoreRepositoryHealth(healthyRepo(['node_modules/pkg/index.js'], {}, { 'node_modules/pkg/index.js': 400_000 }));

    expect(noisy.dimensions.contextWaste.riskScore || 0).toBeGreaterThanOrEqual(clean.dimensions.contextWaste.riskScore || 0);
  });

  it('adding a test script improves only AI readiness signals in a minimal fixture', () => {
    const base = repo(['README.md', 'AGENTS.md', 'docs/TASK_ROUTER.md', 'src/main.tsx', 'package.json'], {
      'README.md': '# App\n',
      'AGENTS.md': '# Agents\n',
      'docs/TASK_ROUTER.md': '# Router\n',
      'package.json': JSON.stringify({ scripts: { build: 'vite build', lint: 'eslint .' }, dependencies: { vite: '^5.4.0' } }),
    });
    const withTest = { ...base, textContents: { ...base.textContents, 'package.json': JSON.stringify({ scripts: { build: 'vite build', lint: 'eslint .', test: 'vitest' }, dependencies: { vite: '^5.4.0' }, devDependencies: { vitest: '^3.2.4' } }) } };

    const before = scoreRepositoryHealth(base);
    const after = scoreRepositoryHealth(withTest);

    expect(after.dimensions.aiDevelopmentReadiness.score || 0).toBeGreaterThan(before.dimensions.aiDevelopmentReadiness.score || 0);
    expect(after.dimensions.repositoryIntelligence.score).toBe(before.dimensions.repositoryIntelligence.score);
    expect(after.dimensions.contextWaste.riskScore).toBe(before.dimensions.contextWaste.riskScore);
    expect(after.dimensions.deliveryConfidence.score).toBe(before.dimensions.deliveryConfidence.score);
  });
});

function rank(priority: 'High' | 'Medium' | 'Low') {
  return priority === 'High' ? 3 : priority === 'Medium' ? 2 : 1;
}

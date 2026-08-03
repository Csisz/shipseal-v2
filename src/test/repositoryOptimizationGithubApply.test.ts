import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import {
  OPTIMIZATION_GITHUB_APPLY_VERSION,
  buildOptimizationFileDiff,
  buildOptimizationGithubApplyPlan,
  buildOptimizationGithubPreparedSnapshot,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryUniverseModel,
  optimizationContentFingerprint,
  prepareRepositoryOptimizationPlan,
  validateOptimizationGithubApplyRequest,
  type OptimizationGithubApplyRequest,
  type OptimizationGithubCurrentFile,
} from '@/lib/workspace';

function preparedFixture() {
  const report = buildReport({
    repoName: 'acme/demo',
    source: { sourceType: 'github-app', sourceUrl: 'https://github.com/acme/demo', githubOwner: 'acme', githubRepo: 'demo', githubBranch: 'main' },
    files: [
      { path: 'README.md', size: 200 },
      { path: 'AGENTS.md', size: 120 },
      { path: 'package.json', size: 180 },
      { path: 'src/App.tsx', size: 260 },
      { path: 'src/App.test.tsx', size: 200 },
    ],
    textContents: {
      'README.md': '# Demo\n',
      'AGENTS.md': '# Existing agent guidance\n',
      'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  const transformation = buildRepositoryTransformationProposalModel(report, universe, atlas);
  const plan = buildRepositoryOptimizationPlan({ report, universe, atlas, transformation });
  const result = prepareRepositoryOptimizationPlan(plan, { githubAvailable: true });
  if (result.status !== 'prepared') throw new Error('Expected prepared optimization fixture.');
  return result.prepared;
}

function requestFixture(mode: 'preview' | 'apply' = 'preview'): OptimizationGithubApplyRequest {
  const prepared = buildOptimizationGithubPreparedSnapshot(preparedFixture());
  return {
    version: OPTIMIZATION_GITHUB_APPLY_VERSION,
    mode,
    installationId: '123',
    owner: 'acme',
    repo: 'demo',
    baseBranch: 'main',
    prepared,
    confirmed: mode === 'apply',
    ...(mode === 'apply' ? { expectedPreviewFingerprint: 'preview', expectedBaseCommit: 'abcdef123456' } : {}),
  };
}

function currentFiles(request: OptimizationGithubApplyRequest): OptimizationGithubCurrentFile[] {
  return request.prepared.files.map(file => file.action === 'create'
    ? { path: file.path, kind: 'missing' }
    : { path: file.path, kind: 'file', content: `# Current ${file.path}\n`, sha: `sha-${file.artifactId}` });
}

describe('Optimization GitHub canonical apply plan', () => {
  it('freezes one deterministic snapshot whose file ordering and contents match the prepared PR set', () => {
    const prepared = preparedFixture();
    const first = buildOptimizationGithubPreparedSnapshot(prepared);
    const second = buildOptimizationGithubPreparedSnapshot(prepared);

    expect(second).toEqual(first);
    expect(first.files.map(file => file.path)).toEqual([...first.files.map(file => file.path)].sort());
    expect(first.files.map(file => file.path)).toEqual(prepared.applyPlan.prPreview.files.map(file => file.path).sort());
    expect(first.files.map(file => file.artifactId).sort()).toEqual(
      prepared.applyPlan.files.filter(file => file.includeInZip && file.includeInPr).map(file => file.sourceItemId).sort(),
    );
    expect(first.files.every(file => file.contentHash === optimizationContentFingerprint(file.nextContent))).toBe(true);
    expect(first.suggestedBranchName).toMatch(/^shipseal\/optimization-pack-[a-z0-9]{12}$/);
  });

  it('rejects a stale prepared artifact instead of silently regenerating it', () => {
    const request = requestFixture();
    request.prepared.files[0].nextContent += '\nchanged after review';
    expect(validateOptimizationGithubApplyRequest(request)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'stale-prepared-plan', path: request.prepared.files[0].path }),
    ]));
  });

  it('blocks forbidden target paths and branches before repository access', () => {
    const unsafePath = requestFixture();
    unsafePath.prepared.files[0].path = '.env.production';
    expect(validateOptimizationGithubApplyRequest(unsafePath)).toContainEqual(expect.objectContaining({ code: 'unsafe-path', path: '.env.production' }));

    const unsafeBranch = requestFixture();
    unsafeBranch.prepared.suggestedBranchName = 'main';
    expect(validateOptimizationGithubApplyRequest(unsafeBranch)).toContainEqual(expect.objectContaining({ code: 'invalid-payload' }));
  });

  it('preflights create, update and strengthen actions against current repository state', () => {
    const request = requestFixture();
    const plan = buildOptimizationGithubApplyPlan({
      request,
      currentRepositoryState: { owner: 'acme', repo: 'demo', baseBranch: 'main', baseCommit: 'abcdef123456', archived: false, disabled: false, canPush: true, files: currentFiles(request) },
    });

    expect(plan.applyReady).toBe(true);
    expect(plan.files.map(file => file.action)).toEqual(request.prepared.files.map(file => file.action));
    expect(plan.summary.totalBytes).toBe(request.prepared.files.reduce((sum, file) => sum + file.sizeBytes, 0));
    expect(plan.files.every(file => file.diff.includes(`+++ prepared/${file.path}`))).toBe(true);
  });

  it('blocks an existing create target and a missing update target', () => {
    const request = requestFixture();
    const files = currentFiles(request);
    const create = request.prepared.files.find(file => file.action === 'create');
    const update = request.prepared.files.find(file => file.action !== 'create');
    if (create) files.splice(files.findIndex(file => file.path === create.path), 1, { path: create.path, kind: 'file', content: '# drift\n', sha: 'drift' });
    if (update) files.splice(files.findIndex(file => file.path === update.path), 1, { path: update.path, kind: 'missing' });
    const plan = buildOptimizationGithubApplyPlan({ request, currentRepositoryState: { owner: 'acme', repo: 'demo', baseBranch: 'main', baseCommit: 'abcdef123456', archived: false, disabled: false, canPush: true, files } });

    expect(plan.applyReady).toBe(false);
    if (create) expect(plan.validation.blockingIssues).toContainEqual(expect.objectContaining({ code: 'target-now-exists', path: create.path }));
    if (update) expect(plan.validation.blockingIssues).toContainEqual(expect.objectContaining({ code: 'target-disappeared', path: update.path }));
  });

  it('recognizes matching and safely resumable existing branch files while blocking divergent content', () => {
    const request = requestFixture();
    const baseFiles = currentFiles(request);
    const matchingBranch = request.prepared.files.map(file => ({ path: file.path, kind: 'file' as const, content: file.nextContent, sha: `branch-${file.artifactId}` }));
    const matching = buildOptimizationGithubApplyPlan({ request, currentRepositoryState: { owner: 'acme', repo: 'demo', baseBranch: 'main', baseCommit: 'abcdef123456', archived: false, disabled: false, canPush: true, files: baseFiles, branch: { name: request.prepared.suggestedBranchName, files: matchingBranch } } });
    expect(matching.branch.existingState).toBe('matching');
    expect(matching.summary.alreadyAppliedCount).toBe(request.prepared.files.length);

    const partialBranch = matchingBranch.map((file, index) => index === 0 ? file : baseFiles[index]);
    const partial = buildOptimizationGithubApplyPlan({ request, currentRepositoryState: { owner: 'acme', repo: 'demo', baseBranch: 'main', baseCommit: 'abcdef123456', archived: false, disabled: false, canPush: true, files: baseFiles, branch: { name: request.prepared.suggestedBranchName, files: partialBranch } } });
    expect(partial.branch.existingState).toBe('partial');
    expect(partial.applyReady).toBe(true);

    const conflictBranch = matchingBranch.map((file, index) => index === 1 ? { ...file, content: '# unrelated branch edit\n' } : file);
    const conflict = buildOptimizationGithubApplyPlan({ request, currentRepositoryState: { owner: 'acme', repo: 'demo', baseBranch: 'main', baseCommit: 'abcdef123456', archived: false, disabled: false, canPush: true, files: baseFiles, branch: { name: request.prepared.suggestedBranchName, files: conflictBranch } } });
    expect(conflict.branch.existingState).toBe('conflict');
    expect(conflict.validation.blockingIssues).toContainEqual(expect.objectContaining({ code: 'branch-conflict' }));
  });

  it('produces bounded deterministic create and update diffs', () => {
    const create = buildOptimizationFileDiff('AGENTS.md', '', '# Added\nLine two\n');
    const update = buildOptimizationFileDiff('README.md', '# Before\nkeep\n', '# After\nkeep\n');
    const large = buildOptimizationFileDiff('large.md', '', Array.from({ length: 500 }, (_, index) => `line ${index}`).join('\n'), 20);

    expect(create).toMatchObject({ addedLines: 2, removedLines: 0, truncated: false });
    expect(create.text).toContain('+# Added');
    expect(update).toMatchObject({ addedLines: 1, removedLines: 1 });
    expect(update.text).toContain('-# Before');
    expect(update.text).toContain('+# After');
    expect(large.truncated).toBe(true);
    expect(large.text).toContain('changed lines omitted');
  });
});

import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_REVIEW_VERSION,
  REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
  buildRepositoryIntelligenceGithubApplyPlan,
  strengthenHandwrittenContent,
  validateRepositoryIntelligenceGithubApplyRequest,
  type RepositoryIntelligenceGithubApplyRequest,
  type RepositoryIntelligenceSelectedArtifactPayload,
} from '@/lib/repositoryIntelligence';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';

function payload(operation: 'create' | 'update' | 'strengthen' = 'create'): RepositoryIntelligenceSelectedArtifactPayload {
  const existing = '# Existing instructions\n\nKeep this handwritten rule.\n';
  const artifact = {
    artifactId: `artifact-${operation}`,
    category: 'architecture-memory' as const,
    targetPath: operation === 'create' ? 'AGENT_MEMORY/ARCHITECTURE.md' : 'AGENTS.md',
    operation,
    content: '# Reviewed repository-specific guidance\n\n- Use `src/main.tsx`.\n',
    contentFingerprint: stableContextFingerprint('# Reviewed repository-specific guidance\n\n- Use `src/main.tsx`.\n'),
    applyRepresentation: operation === 'create' ? 'create-file' as const : operation === 'update' ? 'replace-shipseal-managed' as const : 'proposed-addition' as const,
    artifactFingerprint: `fingerprint-${operation}`,
    expectedFileState: operation === 'create' ? {
      presence: 'missing' as const, ownership: 'missing' as const, preservationMode: 'create-new' as const,
    } : {
      presence: 'existing' as const,
      ownership: operation === 'update' ? 'shipseal-managed' as const : 'handwritten' as const,
      preservationMode: operation === 'update' ? 'replace-managed' as const : 'preserve-handwritten' as const,
      contentFingerprint: stableContextFingerprint(existing),
    },
    statementProvenance: [{ statementId: 'statement-1', statementType: 'repository-fact' as const, statementText: 'src/main.tsx is an application entry point.', validationState: 'verified' as const, evidenceIds: ['evidence-1'], findingIds: [], referencedPaths: ['src/main.tsx'], humanReviewRequired: operation === 'strengthen' }],
    humanReviewAcknowledgement: operation === 'strengthen' ? { artifactId: `artifact-${operation}`, artifactFingerprint: `fingerprint-${operation}` } : undefined,
  };
  const base = {
    version: REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION,
    artifactSchemaVersion: REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
    reviewVersion: REPOSITORY_INTELLIGENCE_REVIEW_VERSION,
    repository: { name: 'demo', sourceType: 'github-app' as const, fullName: 'acme/demo', ref: 'main' },
    repositoryIdentityFingerprint: 'repo-fingerprint', scanIdentity: 'scan-fingerprint', artifactSetFingerprint: 'set-fingerprint',
    selectedPlanFingerprint: '0123456789abcdef0123456789abcdef', artifacts: [artifact],
  };
  return { ...base, fingerprint: stableContextFingerprint(base) };
}

function request(selectedPayload = payload()): RepositoryIntelligenceGithubApplyRequest {
  return { version: REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION, mode: 'preview', confirmed: false, installationId: '123', owner: 'acme', repo: 'demo', baseBranch: 'main', analysisMode: 'deterministic-repository-evidence', selectedPayload };
}

function current(selectedPayload: RepositoryIntelligenceSelectedArtifactPayload, content?: string) {
  const artifact = selectedPayload.artifacts[0];
  return { owner: 'acme', repo: 'demo', baseBranch: 'main', baseCommit: 'abcdef1234567890', files: [{ path: artifact.targetPath, kind: content === undefined ? 'missing' as const : 'file' as const, content, blobSha: content === undefined ? undefined : 'blob-1' }] };
}

describe('Repository Intelligence GitHub apply model', () => {
  it('accepts a strict reviewed payload and rejects credentials, traversal and missing confirmation', () => {
    expect(validateRepositoryIntelligenceGithubApplyRequest(request()).valid).toBe(true);
    expect(validateRepositoryIntelligenceGithubApplyRequest({ ...request(), githubToken: 'secret' }).issues[0].code).toBe('invalid-payload');
    const unsafe = payload(); unsafe.artifacts[0].targetPath = '../secret'; unsafe.fingerprint = stableContextFingerprint({ ...unsafe, fingerprint: undefined });
    expect(validateRepositoryIntelligenceGithubApplyRequest(request(unsafe)).valid).toBe(false);
    expect(validateRepositoryIntelligenceGithubApplyRequest({ ...request(), mode: 'apply' }).valid).toBe(false);
  });

  it('keeps stable plans across reordered artifacts and records fingerprints', () => {
    const first = payload();
    const second = { ...first.artifacts[0], artifactId: 'artifact-second', targetPath: 'AGENT_MEMORY/COMMAND_MAP.md', artifactFingerprint: 'fingerprint-second' };
    const make = (artifacts: typeof first.artifacts) => { const base = { ...first, artifacts }; const { fingerprint: _f, ...rest } = base; return { ...rest, fingerprint: stableContextFingerprint(rest) }; };
    const a = make([first.artifacts[0], second]);
    const b = make([second, first.artifacts[0]]);
    const planA = buildRepositoryIntelligenceGithubApplyPlan({ request: request(a), currentRepositoryState: { ...current(a), files: a.artifacts.map(item => ({ path: item.targetPath, kind: 'missing' as const })) } });
    const planB = buildRepositoryIntelligenceGithubApplyPlan({ request: request(b), currentRepositoryState: { ...current(b), files: b.artifacts.map(item => ({ path: item.targetPath, kind: 'missing' as const })).reverse() } });
    expect(planA.files.map(file => file.path)).toEqual(planB.files.map(file => file.path));
    expect(planA.fingerprint).toBe(planB.fingerprint);
    expect(planA.proposedBranchName).toBe('shipseal/repository-intelligence-0123456789ab');
    expect(planA.files.every(file => Boolean(file.finalContentFingerprint))).toBe(true);
  });

  it('blocks a create when the target now exists and blocks the complete plan', () => {
    const selected = payload();
    const plan = buildRepositoryIntelligenceGithubApplyPlan({ request: request(selected), currentRepositoryState: current(selected, '# User file\n') });
    expect(plan.applyReady).toBe(false);
    expect(plan.blockingErrors[0]).toMatchObject({ code: 'target-now-exists', path: 'AGENT_MEMORY/ARCHITECTURE.md' });
    expect(plan.files).toHaveLength(0);
  });

  it('updates only recognized unchanged ShipSeal-managed files', () => {
    const selected = payload('update');
    const managed = '# Existing instructions\n\nGenerated by ShipSeal\n';
    selected.artifacts[0].expectedFileState.contentFingerprint = stableContextFingerprint(managed);
    const { fingerprint: _fingerprint, ...rest } = selected; selected.fingerprint = stableContextFingerprint(rest);
    const plan = buildRepositoryIntelligenceGithubApplyPlan({ request: request(selected), currentRepositoryState: current(selected, managed) });
    expect(plan.applyReady).toBe(true);
    expect(plan.files[0].operation).toBe('update');
    const stale = buildRepositoryIntelligenceGithubApplyPlan({ request: request(selected), currentRepositoryState: current(selected, `${managed}changed`) });
    expect(stale.blockingErrors[0].code).toBe('stale-target-file');
  });

  it('preserves handwritten bytes outside one managed section and rejects malformed markers', () => {
    const existing = '# Existing instructions\n\nKeep this handwritten rule.\n';
    const appended = strengthenHandwrittenContent(existing, '# Addition\n\n- Reviewed rule.\n');
    expect(appended.ok).toBe(true);
    if (appended.ok) {
      expect(appended.content.startsWith(existing.trimEnd())).toBe(true);
      expect(appended.content).toContain('<!-- shipseal:repository-intelligence:start -->');
    }
    const replaced = strengthenHandwrittenContent(`${existing}\n<!-- shipseal:repository-intelligence:start -->\nold\n<!-- shipseal:repository-intelligence:end -->\nTail\n`, 'new');
    expect(replaced.ok && replaced.content).toContain('Keep this handwritten rule.');
    expect(replaced.ok && replaced.content).toContain('\nnew\n');
    expect(replaced.ok && replaced.content).toContain('Tail');
    expect(strengthenHandwrittenContent(`${existing}<!-- shipseal:repository-intelligence:start -->nested`, 'new').ok).toBe(false);
  });

  it('requires strengthen acknowledgement and rejects stale handwritten content', () => {
    const selected = payload('strengthen');
    const withoutAck = { ...selected, artifacts: [{ ...selected.artifacts[0], humanReviewAcknowledgement: undefined }] };
    const { fingerprint: _fingerprint, ...rest } = withoutAck; withoutAck.fingerprint = stableContextFingerprint(rest);
    expect(validateRepositoryIntelligenceGithubApplyRequest(request(withoutAck)).issues.some(issue => issue.code === 'invalid-acknowledgement')).toBe(true);
    const stale = buildRepositoryIntelligenceGithubApplyPlan({ request: request(selected), currentRepositoryState: current(selected, '# Changed handwritten content\n') });
    expect(stale.blockingErrors[0].code).toBe('stale-target-file');
  });
});

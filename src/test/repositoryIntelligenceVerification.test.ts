import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END,
  REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START,
  REPOSITORY_INTELLIGENCE_PATH_POLICY_VERSION,
  REPOSITORY_INTELLIGENCE_VERIFICATION_BASELINE_VERSION,
  buildRepositoryIntelligenceEvidence,
  validateRepositoryIntelligenceVerificationBaseline,
  getRepositoryIntelligenceVerificationBaselineLifecycle,
  verifyRepositoryIntelligenceArtifacts,
  type RepositoryIntelligenceReviewStatementProvenance,
  type RepositoryIntelligenceVerificationBaseline,
  type RepositoryIntelligenceVerificationBaselineArtifact,
} from '@/lib/repositoryIntelligence';
import { stableContextFingerprint } from '@/lib/repositoryIntelligence/contextSelection';
import type { RepoScanInput } from '@/lib/types';

const MANAGED = '<!-- shipseal:repository-intelligence:managed -->';
const CREATE_PATH = 'AGENT_MEMORY/ARCHITECTURE.md';

function scan(contents: Record<string, string>, options: { branch?: string; sourceType?: 'github-app' | 'zip-upload' | 'github-public'; limited?: boolean; ignored?: Array<{ path: string; reason: 'generated-vendor' | 'binary' | 'unsafe-path' | 'too-large-text' }>; directories?: string[] } = {}): RepoScanInput {
  const ignored = options.ignored || [];
  return {
    repoName: 'acme/demo',
    source: options.sourceType === 'zip-upload' ? { sourceType: 'zip-upload' } : {
      sourceType: options.sourceType || 'github-app', githubOwner: 'acme', githubRepo: 'demo',
      githubBranch: options.branch || 'main', githubDefaultBranch: 'main', githubInstallationId: '123',
    },
    files: [
      ...Object.entries(contents).map(([path, content]) => ({ path, size: content.length })),
      ...ignored.map(item => ({ path: item.path, size: 999_999, ignored: true, ignoredReason: item.reason })),
      ...(options.directories || []).map(path => ({ path, size: 0, isDir: true })),
    ],
    textContents: { ...contents },
    scanSummary: {
      scanMode: options.limited ? 'limited-fallback' : 'full', limited: Boolean(options.limited), totalFilesFound: Object.keys(contents).length,
      filesAnalyzed: Object.keys(contents).length, filesIgnored: ignored.length, generatedVendorFilesIgnored: 0, binaryFilesIgnored: 0,
      readableTextBytesAnalyzed: Object.values(contents).reduce((sum, value) => sum + value.length, 0), ignoredGeneratedFolders: [], warnings: [],
      limits: { maxZipSizeBytes: 1, maxFileCount: 100, maxReadableTextFileSizeBytes: 300 * 1024, maxTotalReadableTextBytes: 5 * 1024 * 1024, maxPathLength: 240, maxGeneratedFolderDepth: 8 },
    },
  };
}

function statement(overrides: Partial<RepositoryIntelligenceReviewStatementProvenance> = {}): RepositoryIntelligenceReviewStatementProvenance {
  return {
    statementId: 'statement-1', statementType: 'repository-fact', statementText: 'src/main.tsx is a repository path.', validationState: 'verified',
    evidenceIds: [], findingIds: [], referencedPaths: ['src/main.tsx'], humanReviewRequired: false, ...overrides,
  };
}

function artifact(content: string, overrides: Partial<RepositoryIntelligenceVerificationBaselineArtifact> = {}): RepositoryIntelligenceVerificationBaselineArtifact {
  return {
    artifactId: 'artifact-1', category: 'architecture-memory', artifactFingerprint: 'artifactfingerprint1', targetPath: CREATE_PATH,
    operation: 'create', finalContentFingerprint: stableContextFingerprint(content), preservedLineFingerprints: [], humanReviewRequired: false,
    statements: [statement()], ...overrides,
  };
}

function baseline(items: RepositoryIntelligenceVerificationBaselineArtifact[]): RepositoryIntelligenceVerificationBaseline {
  return {
    schemaVersion: REPOSITORY_INTELLIGENCE_VERIFICATION_BASELINE_VERSION,
    applySchemaVersion: REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
    pathPolicyVersion: REPOSITORY_INTELLIGENCE_PATH_POLICY_VERSION,
    repository: { owner: 'acme', repo: 'demo' }, baseBranch: 'main', prBranch: 'shipseal/repository-intelligence-plan',
    selectedPlanFingerprint: 'selectedplanfingerprint1', artifacts: items, prUrl: 'https://github.com/acme/demo/pull/1', prNumber: 1,
  };
}

function managedSection(value: string) { return `${REPOSITORY_INTELLIGENCE_MANAGED_SECTION_START}\n${value}\n${REPOSITORY_INTELLIGENCE_MANAGED_SECTION_END}`; }
function lineHashes(value: string) { return value.split('\n').map(line => line.trim()).filter(Boolean).map(line => stableContextFingerprint(line)); }

describe('Repository Intelligence verification baseline validation', () => {
  it('accepts the Ω.16.5b baseline and rejects unsupported, unsafe and malformed baselines', () => {
    const content = `# Architecture\n\n${MANAGED}\n`;
    expect(validateRepositoryIntelligenceVerificationBaseline(baseline([artifact(content)])).valid).toBe(true);
    expect(getRepositoryIntelligenceVerificationBaselineLifecycle(baseline([artifact(content)]))).toBe('baseline-created-after-pr');
    expect(validateRepositoryIntelligenceVerificationBaseline({ ...baseline([artifact(content)]), schemaVersion: 'future' }).issues[0].code).toBe('unsupported-version');
    expect(validateRepositoryIntelligenceVerificationBaseline(baseline([artifact(content, { targetPath: '../AGENTS.md' })])).valid).toBe(false);
    expect(validateRepositoryIntelligenceVerificationBaseline(baseline([artifact(content, { finalContentFingerprint: 'bad' })])).valid).toBe(false);
  });

  it('rejects conflicting duplicate identities, oversized baselines and incomplete strengthen state', () => {
    const content = `# Architecture\n${MANAGED}\n`;
    const duplicated = baseline([artifact(content), artifact(content, { targetPath: 'AGENT_MEMORY/OTHER.md', finalContentFingerprint: 'differentfingerprint1' })]);
    expect(validateRepositoryIntelligenceVerificationBaseline(duplicated).issues.some(issue => issue.code === 'duplicate-artifact')).toBe(true);
    expect(() => validateRepositoryIntelligenceVerificationBaseline(baseline([artifact(content)]), { maximumArtifacts: 0 })).toThrow();
    expect(validateRepositoryIntelligenceVerificationBaseline(baseline([artifact(content, { operation: 'strengthen' })])).valid).toBe(false);
  });
});

describe('repository and branch identity verification', () => {
  const content = `# Architecture\n\n${MANAGED}\n`;
  it('accepts base, PR and explicitly compatible branches deterministically', () => {
    for (const branch of ['main', 'shipseal/repository-intelligence-plan']) {
      expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(content)]), currentScan: scan({ [CREATE_PATH]: content }, { branch }) }).identity.state).toBe('verified-compatible');
    }
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(content)]), currentScan: scan({ [CREATE_PATH]: content }, { branch: 'release' }), explicitlyCompatibleBranches: ['release'] }).identity.state).toBe('compatible-lineage-limited');
  });

  it('blocks different repositories, unrelated branches and ZIP scans', () => {
    const wrongRepo = scan({ [CREATE_PATH]: content }); wrongRepo.source!.githubRepo = 'other';
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(content)]), currentScan: wrongRepo }).overallState).toBe('verification-blocked');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(content)]), currentScan: scan({ [CREATE_PATH]: content }, { branch: 'unrelated' }) }).identity.state).toBe('branch-mismatch');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(content)]), currentScan: scan({ [CREATE_PATH]: content }, { sourceType: 'zip-upload' }) }).identity.state).toBe('source-incompatible');
  });
});

describe('create and update artifact verification', () => {
  const exact = `# Architecture\n\n${MANAGED}\n\n- Evidence-backed structure.\n`;
  it('separates exact, modified, missing, unavailable and directory conflict states', () => {
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(exact)]), currentScan: scan({ [CREATE_PATH]: exact }) }).artifacts[0].state).toBe('verified-exact');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(exact)]), currentScan: scan({ [CREATE_PATH]: `${exact}- Later edit.\n` }) }).artifacts[0].state).toBe('verified-present-with-modifications');
    const notApplied = verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(exact)]), currentScan: scan({}) });
    expect(notApplied.artifacts[0].state).toBe('missing');
    expect(notApplied.lifecycle).toBe('current-branch-does-not-contain-changes');
    expect(notApplied.overallState).not.toBe('fully-verified');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(exact)]), currentScan: scan({}, { ignored: [{ path: CREATE_PATH, reason: 'too-large-text' }] }) }).artifacts[0].state).toBe('unavailable');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([artifact(exact)]), currentScan: scan({}, { directories: [CREATE_PATH] }) }).artifacts[0].state).toBe('conflicting');
  });

  it('verifies exact and compatible managed updates but rejects ownership loss', () => {
    const managed = `# Architecture\n\n${MANAGED}\n\n- Current structure.\n`;
    const update = artifact(managed, { operation: 'update' });
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([update]), currentScan: scan({ [CREATE_PATH]: managed }) }).artifacts[0].state).toBe('verified-exact');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([update]), currentScan: scan({ [CREATE_PATH]: `${managed}- Later managed edit.\n` }) }).artifacts[0].state).toBe('verified-present-with-modifications');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([update]), currentScan: scan({ [CREATE_PATH]: '# Handwritten replacement\n' }) }).artifacts[0].state).toBe('conflicting');
  });
});

describe('handwritten strengthen preservation', () => {
  const handwritten = '# Team rules\n\nKeep this rule.\n';
  const section = managedSection('# Reviewed addition');
  const final = `${handwritten.trimEnd()}\n\n${section}\n`;
  const outside = `${handwritten.trimEnd()}\n\n\n`;
  const strengthen = artifact(final, {
    targetPath: 'AGENTS.md', operation: 'strengthen', category: 'root-agent-instructions', humanReviewRequired: true,
    expectedManagedSectionFingerprint: stableContextFingerprint(section), expectedPreservationFingerprint: stableContextFingerprint(outside),
    preservedLineFingerprints: lineHashes(outside), statements: [statement({ humanReviewRequired: true })],
  });

  it('verifies the managed section and permits additive handwritten edits while retaining review', () => {
    const exact = verifyRepositoryIntelligenceArtifacts({ baseline: baseline([strengthen]), currentScan: scan({ 'AGENTS.md': final, 'src/main.tsx': 'export const main = true;' }) }).artifacts[0];
    expect(exact.state).toBe('verified-strengthened');
    expect(exact.preservationState).toBe('preserved-exact');
    expect(exact.humanReviewRequired).toBe(true);
    const additive = `${handwritten.trimEnd()}\nNew user-owned rule.\n\n${section}\n`;
    const modified = verifyRepositoryIntelligenceArtifacts({ baseline: baseline([strengthen]), currentScan: scan({ 'AGENTS.md': additive, 'src/main.tsx': 'export const main = true;' }) }).artifacts[0];
    expect(modified.state).toBe('verified-strengthened');
    expect(modified.preservationState).toBe('preserved-with-additions');
  });

  it('detects section edits, removal, duplicate markers and handwritten loss', () => {
    const sectionEdit = `${handwritten.trimEnd()}\n\n${managedSection('# Changed addition')}\n`;
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([strengthen]), currentScan: scan({ 'AGENTS.md': sectionEdit }) }).artifacts[0].state).toBe('verified-present-with-modifications');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([strengthen]), currentScan: scan({ 'AGENTS.md': handwritten }) }).artifacts[0].state).toBe('conflicting');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([strengthen]), currentScan: scan({ 'AGENTS.md': `${final}${section}` }) }).artifacts[0].state).toBe('conflicting');
    expect(verifyRepositoryIntelligenceArtifacts({ baseline: baseline([strengthen]), currentScan: scan({ 'AGENTS.md': `# Team rules\n\n${section}\n` }) }).artifacts[0].preservationState).toBe('content-loss-detected');
  });
});

describe('statement truth, quality evaluation and open work', () => {
  const artifactContent = `# Architecture\n\n${MANAGED}\n`;
  const sourceScan = scan({ [CREATE_PATH]: artifactContent, 'src/main.tsx': 'export function main() {}', 'package.json': JSON.stringify({ scripts: { test: 'vitest' } }) });
  const evidence = buildRepositoryIntelligenceEvidence(sourceScan);
  const pathEvidence = evidence.evidence.find(item => item.repositoryRelativePath === 'src/main.tsx')!;
  const commandEvidence = evidence.evidence.find(item => item.category === 'command')!;

  it('revalidates deterministic path and command evidence instead of trusting Markdown presence', () => {
    const withStatements = artifact(artifactContent, { statements: [
      statement({ statementId: 'path', evidenceIds: [pathEvidence.id] }),
      statement({ statementId: 'command', statementType: 'command', statementText: 'package.json declares test.', evidenceIds: [commandEvidence.id], referencedPaths: ['package.json'] }),
      statement({ statementId: 'model', evidenceIds: [], findingIds: ['finding-1'], referencedPaths: [] }),
    ] });
    const result = verifyRepositoryIntelligenceArtifacts({ baseline: baseline([withStatements]), currentScan: sourceScan, currentEvidence: evidence });
    expect(result.statementCounts['verified-by-current-deterministic-evidence']).toBe(2);
    expect(result.statementCounts['still-inferred']).toBe(1);
    expect(result.quality.dimensions.some(item => item.dimension === 'provenance-integrity')).toBe(true);
    expect('score' in result.quality).toBe(false);
  });

  it('contradicts removed paths or commands even when artifact Markdown matches exactly', () => {
    const withStatements = artifact(artifactContent, { statements: [
      statement({ statementId: 'path', evidenceIds: [pathEvidence.id] }),
      statement({ statementId: 'command', statementType: 'command', evidenceIds: [commandEvidence.id], referencedPaths: ['package.json'] }),
    ] });
    const changed = scan({ [CREATE_PATH]: artifactContent, 'package.json': JSON.stringify({ scripts: {} }) });
    const result = verifyRepositoryIntelligenceArtifacts({ baseline: baseline([withStatements]), currentScan: changed });
    expect(result.artifacts[0].state).toBe('verified-exact');
    expect(result.statementCounts.contradicted).toBeGreaterThan(0);
    expect(result.openWork.some(item => item.actionType === 'regenerate')).toBe(true);
  });

  it('keeps absent evidence unavailable on limited scans and preserves deterministic result ordering', () => {
    const items = [artifact(artifactContent), artifact(artifactContent, { artifactId: 'artifact-2', targetPath: 'AGENT_MEMORY/COMMAND_MAP.md' })];
    const limited = scan({ [CREATE_PATH]: artifactContent }, { limited: true });
    const first = verifyRepositoryIntelligenceArtifacts({ baseline: baseline(items), currentScan: limited });
    const second = verifyRepositoryIntelligenceArtifacts({ baseline: baseline([...items].reverse()), currentScan: { ...limited, files: [...limited.files].reverse() } });
    expect(first.artifacts.find(item => item.targetPath === 'AGENT_MEMORY/COMMAND_MAP.md')?.state).toBe('unavailable');
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.openWork.every(item => item.reason.length > 0 && item.nextAction.length > 0)).toBe(true);
  });
});

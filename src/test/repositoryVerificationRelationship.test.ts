import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
  buildRepositoryGraphDifference,
  buildRepositoryVerificationRelationship,
  compareRepositoryScores,
  deriveVerifiedOpportunitySignals,
  evaluateRepositoryVerificationCompatibility,
  mapRepositoryIntelligenceArtifactResults,
  mapRepositoryIntelligenceStatementResults,
  repositoryVerificationOverlayStates,
  synthesizeRepositoryVerificationResult,
  validateDeepIntelligenceBindings,
  type AppliedOperationBinding,
  type ExpectedArtifactContract,
  type ExpectedArtifactVerification,
  type ExpectedStatementContract,
  type ExpectedStatementVerification,
  type RepositoryGraphSnapshot,
  type RepositoryMeasurementBoundary,
  type RepositoryScoreSnapshot,
  type RepositoryVerificationScanBinding,
} from '@/lib/workspace';
import type {
  RepositoryIntelligenceArtifactVerification,
  RepositoryIntelligenceStatementVerification,
} from '@/lib/repositoryIntelligence';

const boundary: RepositoryMeasurementBoundary = {
  scannerVersion: 'scanner.v1',
  measurementVersion: 'measurement.v1',
  scoringVersion: 'score.v1',
  scanBoundaryFingerprint: 'complete-js-ts-v1',
  limited: false,
  discoveredFiles: 20,
  analyzedFiles: 18,
};

const baseline: RepositoryVerificationScanBinding = {
  ownerId: 'user-a', projectId: 'project-a', scanId: 'scan-baseline', completedAt: '2026-08-01T10:00:00.000Z',
  repositoryIdentity: 'github:openai/shipseal', branch: 'main', deterministicScanFingerprint: 'baseline-fingerprint', boundary,
};

const later: RepositoryVerificationScanBinding = {
  ...baseline, scanId: 'scan-later', completedAt: '2026-08-02T10:00:00.000Z', branch: 'shipseal/omega', deterministicScanFingerprint: 'later-fingerprint',
};

const operation: AppliedOperationBinding = {
  id: 'operation-1', kind: 'github-pull-request', state: 'applied', preparedPlanId: 'prepared-1', preparedPlanFingerprint: 'prepared-fingerprint',
  branch: 'shipseal/omega', pullRequestUrl: 'https://github.com/openai/shipseal/pull/1', pullRequestNumber: 1,
};

const artifactContract: ExpectedArtifactContract = {
  id: 'artifact-agents', path: 'AGENTS.md', action: 'create', method: 'structural-statements', blocking: true,
  expectedStatementIds: ['statement-test'], relatedNodeIds: ['node-agents'],
};

const statementContract: ExpectedStatementContract = {
  id: 'statement-test', text: 'The test command is documented.', method: 'deterministic-evidence', blocking: true,
  acceptedPaths: ['AGENTS.md', 'package.json'], expectedEvidenceIds: ['evidence-test'], confidence: 'high',
};

const verifiedArtifact: ExpectedArtifactVerification = {
  artifactId: artifactContract.id, path: artifactContract.path, action: artifactContract.action, method: artifactContract.method,
  blocking: true, result: 'verified', evidenceIds: ['evidence-artifact'], expected: 'create AGENTS.md', observed: 'Found with required statements', confidence: 'high', relatedNodeIds: ['node-agents'],
};

const confirmedStatement: ExpectedStatementVerification = {
  statementId: statementContract.id, blocking: true, result: 'confirmed', method: statementContract.method,
  evidenceIds: ['evidence-test'], expected: statementContract.text, observed: 'package.json contains test script', confidence: 'high',
};

const baselineGraph: RepositoryGraphSnapshot = {
  nodes: [{ id: 'node-root', responsibility: 'application' }, { id: 'node-old', path: 'old.ts', responsibility: 'legacy' }],
  edges: [{ source: 'node-root', target: 'node-old', relationship: 'contains' }],
  frictions: [{ id: 'friction-missing-guidance' }],
};

const laterGraph: RepositoryGraphSnapshot = {
  nodes: [{ id: 'node-root', responsibility: 'application shell' }, { id: 'node-agents', path: 'AGENTS.md', responsibility: 'agent guidance' }],
  edges: [{ source: 'node-root', target: 'node-agents', relationship: 'contains' }],
  frictions: [{ id: 'friction-new-risk' }],
};

const baselineScore: RepositoryScoreSnapshot = { overall: 70, categories: { guidance: 60, tests: 80 }, findingIds: ['finding-old'], boundary };
const laterScore: RepositoryScoreSnapshot = { overall: 78, categories: { guidance: 76, tests: 80 }, findingIds: ['finding-new'], boundary };

function relationshipInput(overrides: Partial<Parameters<typeof buildRepositoryVerificationRelationship>[0]> = {}) {
  return {
    baseline,
    later,
    preparedPlan: { id: 'prepared-1', fingerprint: 'prepared-fingerprint', baseRef: 'main', artifacts: [artifactContract], statements: [statementContract] },
    appliedOperation: operation,
    artifactResults: [verifiedArtifact],
    statementResults: [confirmedStatement],
    baselineGraph,
    laterGraph,
    baselineScore,
    laterScore,
    now: '2026-08-02T11:00:00.000Z',
    ...overrides,
  };
}

describe('Omega 18.4 canonical repository verification relationship', () => {
  it('binds the owned project, scans, plan, applied PR, measurement versions and evidence deterministically', () => {
    const first = buildRepositoryVerificationRelationship(relationshipInput());
    const second = buildRepositoryVerificationRelationship(relationshipInput());
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      baselineScanId: 'scan-baseline', laterScanId: 'scan-later', preparedPlanId: 'prepared-1', result: 'verified',
      pullRequestUrl: operation.pullRequestUrl, verificationAlgorithmVersion: REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
      expectedArtifactIds: ['artifact-agents'], expectedStatementIds: ['statement-test'],
    });
  });

  it.each([
    ['wrong user', { ...later, ownerId: 'user-b' }, 'different users'],
    ['wrong project', { ...later, projectId: 'project-b' }, 'different projects'],
    ['wrong repository', { ...later, repositoryIdentity: 'github:other/repo' }, 'repository identity'],
    ['old scan', { ...later, completedAt: baseline.completedAt }, 'complete after'],
    ['scanner boundary', { ...later, boundary: { ...boundary, scannerVersion: 'scanner.v2' } }, 'Scanner versions'],
    ['limited scan', { ...later, boundary: { ...boundary, limited: true } }, 'limited'],
  ])('rejects %s comparisons', (_label, incompatibleLater, reason) => {
    const result = evaluateRepositoryVerificationCompatibility({ baseline, later: incompatibleLater, preparedPlanId: 'prepared-1', appliedOperation: operation });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toContain(reason);
  });

  it('accepts the applied branch and rejects unrelated branches', () => {
    expect(evaluateRepositoryVerificationCompatibility({ baseline, later, preparedPlanId: 'prepared-1', appliedOperation: operation }).branchCompatible).toBe(true);
    const mismatch = evaluateRepositoryVerificationCompatibility({ baseline, later: { ...later, branch: 'unrelated' }, preparedPlanId: 'prepared-1', appliedOperation: operation });
    expect(mismatch).toMatchObject({ eligible: false, branchCompatible: false });
  });

  it('does not treat ZIP export as repository application', () => {
    const exported = { ...operation, kind: 'zip-export' as const, state: 'exported' as const };
    const result = buildRepositoryVerificationRelationship(relationshipInput({ appliedOperation: exported }));
    expect(result.result).toBe('pending');
  });

  it.each([
    ['verified-exact', 'verified'],
    ['verified-strengthened', 'verified'],
    ['verified-present-with-modifications', 'partially-verified'],
    ['partially-verified', 'partially-verified'],
    ['missing', 'missing'],
    ['conflicting', 'changed-differently'],
    ['stale', 'regressed'],
    ['unavailable', 'unreadable'],
    ['not-applicable', 'incompatible'],
    ['requires-human-review', 'partially-verified'],
  ] as const)('maps artifact state %s to %s', (state, expected) => {
    expect(mapRepositoryIntelligenceArtifactResults([artifactContract], [intelligenceArtifact(state)])[0].result).toBe(expected);
  });

  it('treats a missing update or strengthen target as a regression', () => {
    const update = { ...artifactContract, action: 'update' as const };
    expect(mapRepositoryIntelligenceArtifactResults([update], [intelligenceArtifact('missing')])[0].result).toBe('regressed');
  });

  it.each([
    ['verified-by-current-deterministic-evidence', 'confirmed'],
    ['present-in-artifact-only', 'partially-confirmed'],
    ['still-inferred', 'partially-confirmed'],
    ['contradicted', 'contradicted'],
    ['evidence-missing', 'not-confirmed'],
    ['unavailable', 'unable-to-evaluate'],
    ['requires-human-review', 'unable-to-evaluate'],
  ] as const)('maps statement state %s to %s', (state, expected) => {
    expect(mapRepositoryIntelligenceStatementResults([statementContract], [intelligenceStatement(state)])[0].result).toBe(expected);
  });

  it('computes stable node, relationship, responsibility and friction differences without mutating either graph', () => {
    const before = structuredClone(baselineGraph);
    const after = structuredClone(laterGraph);
    const diff = buildRepositoryGraphDifference(baselineGraph, laterGraph, [verifiedArtifact]);
    expect(diff).toMatchObject({
      addedNodeIds: ['node-agents'], removedNodeIds: ['node-old'], changedNodeIds: ['node-root'],
      changedResponsibilityNodeIds: ['node-root'], newArtifactPaths: ['AGENTS.md'],
      resolvedFrictionIds: ['friction-missing-guidance'], newFrictionIds: ['friction-new-risk'],
    });
    expect(diff.addedRelationshipIds).toHaveLength(1);
    expect(diff.removedRelationshipIds).toHaveLength(1);
    expect(baselineGraph).toEqual(before);
    expect(laterGraph).toEqual(after);
  });

  it('shows score deltas only across compatible measurement boundaries', () => {
    expect(compareRepositoryScores(baselineScore, laterScore)).toMatchObject({ compatible: true, overallDelta: 8, categoryDeltas: { guidance: 16, tests: 0 }, resolvedFindingIds: ['finding-old'], newFindingIds: ['finding-new'] });
    const incompatible = compareRepositoryScores(baselineScore, { ...laterScore, boundary: { ...boundary, scanBoundaryFingerprint: 'limited-other' } });
    expect(incompatible).toMatchObject({ compatible: false, overallDelta: null, categoryDeltas: {} });
  });

  it.each([
    ['verified', [verifiedArtifact], [confirmedStatement]],
    ['partially-verified', [{ ...verifiedArtifact, result: 'partially-verified' as const }], [confirmedStatement]],
    ['unresolved', [{ ...verifiedArtifact, result: 'missing' as const }], [confirmedStatement]],
    ['regressed', [{ ...verifiedArtifact, result: 'regressed' as const }], [confirmedStatement]],
  ] as const)('synthesizes %s without promoting Applied automatically', (expected, artifacts, statements) => {
    const compatibility = evaluateRepositoryVerificationCompatibility({ baseline, later, preparedPlanId: 'prepared-1', appliedOperation: operation });
    expect(synthesizeRepositoryVerificationResult({ compatibility, artifacts: [...artifacts], statements: [...statements], appliedOperation: operation })).toBe(expected);
    expect(synthesizeRepositoryVerificationResult({ compatibility, artifacts: [...artifacts], statements: [...statements] })).toBe('pending');
  });

  it('returns incompatible before considering positive evidence', () => {
    const compatibility = evaluateRepositoryVerificationCompatibility({ baseline, later: { ...later, projectId: 'other' }, preparedPlanId: 'prepared-1', appliedOperation: operation });
    expect(synthesizeRepositoryVerificationResult({ compatibility, artifacts: [verifiedArtifact], statements: [confirmedStatement], appliedOperation: operation })).toBe('incompatible');
  });

  it('accepts only versioned Deep Intelligence findings bound to the baseline identity', () => {
    const valid = { findingId: 'finding-ai', state: 'accepted' as const, requestFingerprint: 'request-1', sourceScanFingerprint: baseline.deterministicScanFingerprint, promptVersion: 'prompt.v1', schemaVersion: 'schema.v1', contextVersion: 'context.v1', confidence: 'medium' as const, evidenceIds: ['evidence-ai'] };
    const result = validateDeepIntelligenceBindings([
      valid,
      { ...valid, findingId: 'finding-stale', sourceScanFingerprint: 'another-scan' },
      { ...valid, findingId: 'finding-rejected', state: 'rejected' },
    ], baseline.deterministicScanFingerprint);
    expect(result.accepted.map(item => item.findingId)).toEqual(['finding-ai']);
    expect(result.limitations).toHaveLength(2);
  });

  it('derives bounded evidence-backed opportunity signals and rejects unsupported signals', () => {
    const relationship = buildRepositoryVerificationRelationship(relationshipInput());
    expect(relationship.opportunitySignals.map(item => item.kind)).toEqual(expect.arrayContaining(['capability-added', 'friction-resolved', 'future-unlocked', 'risk-detected']));
    expect(relationship.opportunitySignals.every(item => item.evidenceIds.length > 0)).toBe(true);
    expect(deriveVerifiedOpportunitySignals({ relationshipId: 'rel', projectId: 'project', result: 'unresolved', artifacts: [], graphDifference: relationship.graphDifference, scoreComparison: relationship.scoreComparison })).toEqual([]);
  });

  it('creates an existing-Universe verification overlay without creating another graph', () => {
    const relationship = buildRepositoryVerificationRelationship(relationshipInput());
    expect(repositoryVerificationOverlayStates(relationship)).toMatchObject({ 'node-agents': 'verified-change' });
    expect(Object.keys(repositoryVerificationOverlayStates(relationship))).toContain('node-agents');
  });
});

function intelligenceStatement(state: RepositoryIntelligenceStatementVerification['state']): RepositoryIntelligenceStatementVerification {
  return {
    id: `result-${state}`, statementId: statementContract.id, artifactId: artifactContract.id, statementType: 'instruction', state,
    referencedPaths: ['AGENTS.md'], resolvedEvidenceIds: state === 'verified-by-current-deterministic-evidence' ? ['evidence-test'] : [],
    missingEvidenceIds: [], limitations: [], nextAction: 'Review evidence.',
  };
}

function intelligenceArtifact(state: RepositoryIntelligenceArtifactVerification['state']): RepositoryIntelligenceArtifactVerification {
  return {
    id: `artifact-${state}`, artifactId: artifactContract.id, targetPath: artifactContract.path, operation: artifactContract.action,
    category: 'root-agent-instructions', baselineArtifactFingerprint: 'baseline123', expectedAppliedContentFingerprint: 'expected123',
    currentContentFingerprint: 'current123', preservationState: 'not-applicable', state, confidence: 'high', identityState: 'verified-compatible',
    statementResults: [intelligenceStatement('verified-by-current-deterministic-evidence')], verifiedStatementCount: 1, unresolvedStatementCount: 0,
    evidenceCoverage: { referenced: 1, resolved: 1, missing: 0 }, humanReviewRequired: false, limitations: [], nextAction: 'Reverify later.',
  };
}

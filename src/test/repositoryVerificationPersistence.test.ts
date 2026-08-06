import { describe, expect, it } from 'vitest';
import { InMemoryAccountPersistenceStore } from '../../api/_lib/inMemoryAccountPersistence';
import { buildSaveProjectRequest, buildVerificationRelationshipInput } from '@/lib/persistence/buildSnapshot';
import {
  REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
  REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
} from '@/lib/workspace';
import { buildSampleReport } from '@/lib/readiness';
import type { ReadinessReport } from '@/lib/types';
import type { RepositoryIntelligenceVerificationBaseline } from '@/lib/repositoryIntelligence';

describe('Omega 18.4 verification persistence and ownership', () => {
  it('builds a pending relationship for an applied plan without claiming verification before a later result', () => {
    const baseline: RepositoryIntelligenceVerificationBaseline = {
      schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1',
      applySchemaVersion: 'shipseal.repository-intelligence-github-apply.v1',
      pathPolicyVersion: 'shipseal.repository-path-policy.v1',
      repository: { owner: 'Csisz', repo: 'shipseal-v2' },
      baseBranch: 'main', prBranch: 'shipseal/plan', selectedPlanFingerprint: 'selectedplanfingerprint1',
      preparedPlanId: 'prepared:selectedplanfingerprint1', appliedOperationId: 'github-pr:selectedplanfingerprint1',
      artifacts: [{
        artifactId: 'artifact-agents', category: 'root-agent-instructions', artifactFingerprint: 'artifactfingerprint1',
        targetPath: 'AGENTS.md', operation: 'create', finalContentFingerprint: 'contentfingerprint1',
        preservedLineFingerprints: [], humanReviewRequired: false,
        statements: [{ statementId: 'statement-test', statementType: 'instruction', statementText: 'Run tests.', validationState: 'verified', evidenceIds: [], findingIds: [], referencedPaths: [], humanReviewRequired: false }],
      }],
      prUrl: 'https://github.com/Csisz/shipseal-v2/pull/1', prNumber: 1,
    };
    const relationship = buildVerificationRelationshipInput({ baselineScanId: `scn_${'a'.repeat(24)}`, report: reportAt('2026-08-02T10:00:00.000Z'), baseline });
    expect(relationship).toMatchObject({
      state: 'pending', verifiedAt: null, repositoryIdentity: 'github:csisz/shipseal-v2',
      expectedArtifactIds: ['artifact-agents'], expectedStatementIds: ['statement-test'],
    });
    expect('evidence' in relationship ? relationship.evidence : null).toMatchObject({ result: null });
  });

  it('persists and reopens an owned versioned relationship with immutable evidence', async () => {
    const fixture = await createFixture();
    const saved = await fixture.store.saveProjectAndScan(fixture.user.id, fixture.laterRequest);
    const reopened = await fixture.store.getScan(fixture.user.id, saved.scan.id);
    expect(reopened?.verificationRelationship).toMatchObject({
      version: REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
      projectId: fixture.baseline.project.id,
      baselineScanId: fixture.baseline.scan.id,
      laterScanId: saved.scan.id,
      preparedPlanId: 'prepared-plan-omega18-4',
      appliedOperationId: 'applied-operation-omega18-4',
      state: 'partially-verified',
      expectedArtifactIds: ['artifact-agents'],
      expectedStatementIds: ['statement-test'],
      evidence: { result: 'partially-verified', artifactCounts: { verified: 1, unresolved: 1 } },
    });
  });

  it('is idempotent by relationship fingerprint even when a retry changes the save idempotency key', async () => {
    const fixture = await createFixture();
    const first = await fixture.store.saveProjectAndScan(fixture.user.id, fixture.laterRequest);
    const retried = structuredClone(fixture.laterRequest);
    retried.idempotencyKey = 'retry_relationship_omega18_4_0001';
    const second = await fixture.store.saveProjectAndScan(fixture.user.id, retried);
    expect(second.scan.id).toBe(first.scan.id);
    expect(fixture.store.verifications).toHaveLength(1);
  });

  it('rejects a baseline owned by another user', async () => {
    const fixture = await createFixture();
    const other = await fixture.store.upsertOAuthUser({ providerSubject: 'other', email: null, displayName: null, avatarUrl: null });
    await expect(fixture.store.saveProjectAndScan(other.id, fixture.laterRequest)).rejects.toThrow('does not belong');
    expect(fixture.store.verifications).toHaveLength(0);
  });

  it('rejects a baseline from another project even for the same user', async () => {
    const fixture = await createFixture();
    const request = structuredClone(fixture.laterRequest);
    request.project.repositoryOwner = 'different-owner';
    request.project.repositoryName = 'different-repository';
    request.scan.repositoryOwner = 'different-owner';
    request.scan.repositoryName = 'different-repository';
    request.scan.snapshot.report.source.githubOwner = 'different-owner';
    request.scan.snapshot.report.source.githubRepo = 'different-repository';
    const relationship = request.scan.verificationRelationship;
    if (!relationship || !('repositoryIdentity' in relationship)) throw new Error('Expected v2 verification relationship fixture.');
    relationship.repositoryIdentity = 'github:different-owner/different-repository';
    await expect(fixture.store.saveProjectAndScan(fixture.user.id, request)).rejects.toThrow('does not belong');
    expect(fixture.store.verifications).toHaveLength(0);
  });

  it('rejects a later scan that does not complete after its baseline', async () => {
    const fixture = await createFixture();
    fixture.laterRequest.scan.startedAt = fixture.baseline.scan.startedAt;
    fixture.laterRequest.scan.completedAt = fixture.baseline.scan.completedAt;
    await expect(fixture.store.saveProjectAndScan(fixture.user.id, fixture.laterRequest)).rejects.toThrow('complete after');
  });

  it('removes relationships through project and account deletion contracts', async () => {
    const fixture = await createFixture();
    await fixture.store.saveProjectAndScan(fixture.user.id, fixture.laterRequest);
    expect(fixture.store.verifications).toHaveLength(1);
    expect(await fixture.store.deleteProject(fixture.user.id, fixture.baseline.project.id)).toBe(true);
    expect(fixture.store.verifications).toHaveLength(0);

    const second = await createFixture();
    await second.store.saveProjectAndScan(second.user.id, second.laterRequest);
    expect(await second.store.deleteAccount(second.user.id)).toBe(true);
    expect(second.store.verifications).toHaveLength(0);
  });
});

async function createFixture() {
  const store = new InMemoryAccountPersistenceStore();
  const user = await store.upsertOAuthUser({ providerSubject: 'owner', email: 'owner@example.test', displayName: 'Owner', avatarUrl: null });
  const baselineReport = reportAt('2026-08-01T10:00:00.000Z');
  const baseline = await store.saveProjectAndScan(user.id, buildSaveProjectRequest({ report: baselineReport, idempotencyKey: 'baseline_relationship_omega18_4' }));
  const laterRequest = buildSaveProjectRequest({ report: reportAt('2026-08-02T10:00:00.000Z'), idempotencyKey: 'later_relationship_omega18_4' });
  const identity = laterRequest.project.repositoryOwner && laterRequest.project.repositoryName
    ? `github:${laterRequest.project.repositoryOwner.toLowerCase()}/${laterRequest.project.repositoryName.toLowerCase()}`
    : `upload:${(laterRequest.project.uploadLabel || laterRequest.project.displayName).toLowerCase()}`;
  laterRequest.scan.verificationRelationship = {
    version: REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
    baselineScanId: baseline.scan.id,
    state: 'partially-verified',
    verifiedAt: '2026-08-02T11:00:00.000Z',
    algorithmVersion: REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
    preparedPlanId: 'prepared-plan-omega18-4',
    preparedPlanFingerprint: 'preparedfingerprint1234',
    appliedOperationId: 'applied-operation-omega18-4',
    pullRequestUrl: 'https://github.com/example/shipseal/pull/1',
    branch: laterRequest.scan.branch || 'main',
    repositoryIdentity: identity,
    measurementVersion: 'shipseal.repository-measurement.v1',
    expectedArtifactIds: ['artifact-agents'],
    expectedStatementIds: ['statement-test'],
    evidence: { result: 'partially-verified', artifactCounts: { verified: 1, unresolved: 1 } },
    relationshipFingerprint: 'relationshipfingerprint1234',
  };
  return { store, user, baseline, laterRequest };
}

function reportAt(scannedAt: string): ReadinessReport {
  const report = structuredClone(buildSampleReport());
  report.scannedAt = scannedAt;
  return report;
}

import type { RepositoryIntelligenceProviderStatus } from '../repositoryIntelligence';
import { stableContextFingerprint } from '../repositoryIntelligence/contextSelection';
import type { ReadinessReport } from '../types';
import {
  PERSISTENCE_SCHEMA_VERSION,
  SCAN_SNAPSHOT_SCHEMA_VERSION,
  saveProjectRequestSchema,
  type SaveProjectRequest,
  type VerificationRelationshipInput,
} from './schema';
import type { RepositoryIntelligenceVerificationBaseline } from '../repositoryIntelligence';
import type { RepositoryIntelligenceVerificationResult } from '../repositoryIntelligence';
import {
  REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
  REPOSITORY_VERIFICATION_MEASUREMENT_VERSION,
  REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
  repositoryVerificationOutcomeForIntelligenceResult,
} from '../workspace/repositoryVerificationRelationship';

export function buildVerificationRelationshipInput(input: {
  baselineScanId: string;
  report: ReadinessReport;
  baseline: RepositoryIntelligenceVerificationBaseline;
  result?: RepositoryIntelligenceVerificationResult | null;
}): VerificationRelationshipInput {
  const state = repositoryVerificationOutcomeForIntelligenceResult(input.result) || 'pending';
  const repositoryIdentity = `github:${input.baseline.repository.owner.toLowerCase()}/${input.baseline.repository.repo.toLowerCase()}`;
  const preparedPlanId = input.baseline.preparedPlanId || `prepared:${input.baseline.selectedPlanFingerprint}`;
  const appliedOperationId = input.baseline.appliedOperationId
    || (input.baseline.prUrl ? `github-pr:${input.baseline.selectedPlanFingerprint}` : null);
  const expectedArtifactIds = [...new Set(input.baseline.artifacts.map(artifact => artifact.artifactId))].sort();
  const expectedStatementIds = [...new Set(input.baseline.artifacts.flatMap(artifact => artifact.statements.map(statement => statement.statementId)))].sort();
  const evidence = JSON.parse(JSON.stringify({
    source: 'repository-intelligence-verification',
    baselineFingerprint: stableContextFingerprint(input.baseline),
    result: input.result || null,
    limitations: input.result?.limitations || ['A later compatible repository scan has not produced verification evidence yet.'],
  })) as Record<string, unknown>;
  const relationshipFingerprint = stableContextFingerprint({
    baselineScanId: input.baselineScanId,
    preparedPlanId,
    selectedPlanFingerprint: input.baseline.selectedPlanFingerprint,
    laterScanFingerprint: input.result?.currentScanFingerprint || input.report.scannedAt,
    resultFingerprint: input.result?.fingerprint || 'pending',
  });
  return {
    version: REPOSITORY_VERIFICATION_RELATIONSHIP_VERSION,
    baselineScanId: input.baselineScanId,
    state,
    verifiedAt: ['pending', 'incompatible'].includes(state) ? null : input.report.scannedAt,
    algorithmVersion: REPOSITORY_VERIFICATION_ALGORITHM_VERSION,
    preparedPlanId,
    preparedPlanFingerprint: input.baseline.selectedPlanFingerprint,
    appliedOperationId,
    pullRequestUrl: input.baseline.prUrl || null,
    branch: input.report.source.githubBranch || input.report.source.githubDefaultBranch || null,
    repositoryIdentity,
    measurementVersion: REPOSITORY_VERIFICATION_MEASUREMENT_VERSION,
    expectedArtifactIds,
    expectedStatementIds,
    evidence,
    relationshipFingerprint,
  };
}

export function buildSaveProjectRequest(input: {
  report: ReadinessReport;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  idempotencyKey?: string;
  verificationBaseline?: RepositoryIntelligenceVerificationBaseline;
  verificationRelationship?: VerificationRelationshipInput;
}): SaveProjectRequest {
  const report = JSON.parse(JSON.stringify(input.report)) as unknown;
  const source = input.report.source;
  const owner = source.githubOwner || null;
  const repositoryName = source.githubRepo || (owner ? input.report.repoName : null);
  const fingerprint = stableContextFingerprint({
    repoName: input.report.repoName,
    scannedAt: input.report.scannedAt,
    source: { sourceType: source.sourceType, owner, repositoryName, branch: source.githubBranch || source.githubDefaultBranch || null },
    scanSummary: input.report.scanSummary,
  });
  const providerState = input.providerStatus?.state;
  const intelligenceMode = providerState === 'enhanced' ? 'enhanced' : providerState === 'fallback' || providerState === 'cancelled' ? 'fallback' : 'deterministic';
  const providerModel = input.providerStatus?.state === 'enhanced' ? input.providerStatus.modelId : undefined;
  const providerFailureCategory = input.providerStatus?.state === 'fallback' || input.providerStatus?.state === 'cancelled' ? input.providerStatus.category : undefined;
  const idempotencyKey = input.idempotencyKey || `save_${stableContextFingerprint({ fingerprint, version: PERSISTENCE_SCHEMA_VERSION })}`;
  return saveProjectRequestSchema.parse({
    version: PERSISTENCE_SCHEMA_VERSION,
    idempotencyKey,
    project: {
      sourceType: source.sourceType,
      repositoryOwner: owner,
      repositoryName,
      uploadLabel: owner ? null : input.report.repoName,
      defaultBranch: source.githubDefaultBranch || null,
      githubRepositoryId: null,
      githubInstallationId: source.githubInstallationId || null,
      displayName: input.report.repoName,
    },
    scan: {
      sourceType: source.sourceType,
      repositoryOwner: owner,
      repositoryName,
      branch: source.githubBranch || source.githubDefaultBranch || null,
      status: 'completed',
      startedAt: input.report.scannedAt,
      completedAt: input.report.scannedAt,
      scannerVersion: 'shipseal-browser-scanner.v1',
      deterministicRequestFingerprint: fingerprint,
      discoveredFiles: input.report.scanSummary.totalFilesFound,
      analyzedFiles: input.report.scanSummary.filesAnalyzed,
      ignoredFiles: input.report.scanSummary.filesIgnored,
      intelligenceMode,
      safeFailureCategory: providerFailureCategory || null,
      snapshot: {
        version: SCAN_SNAPSHOT_SCHEMA_VERSION,
        report,
        intelligenceMode,
        providerContractVersion: input.providerStatus ? 'shipseal.repository-intelligence-provider-api.v1' : undefined,
        providerModel,
        providerSafeErrorCategory: providerFailureCategory,
        deterministicRequestFingerprint: fingerprint,
        policyVersions: {
          scanner: 'shipseal-browser-scanner.v1',
          persistence: PERSISTENCE_SCHEMA_VERSION,
          repositoryHealth: input.report.repositoryHealth.modelVersion,
        },
        verificationBaseline: input.verificationBaseline,
      },
      verificationRelationship: input.verificationRelationship,
    },
  });
}

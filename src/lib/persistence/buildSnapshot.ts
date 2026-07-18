import type { RepositoryIntelligenceProviderStatus } from '../repositoryIntelligence';
import { stableContextFingerprint } from '../repositoryIntelligence/contextSelection';
import type { ReadinessReport } from '../types';
import {
  PERSISTENCE_SCHEMA_VERSION,
  SCAN_SNAPSHOT_SCHEMA_VERSION,
  saveProjectRequestSchema,
  type SaveProjectRequest,
} from './schema';

export function buildSaveProjectRequest(input: {
  report: ReadinessReport;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  idempotencyKey?: string;
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
      },
    },
  });
}

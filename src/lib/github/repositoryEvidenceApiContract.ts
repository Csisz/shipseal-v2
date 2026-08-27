import type { RepoScanInput } from '../types.js';

export const REPOSITORY_EVIDENCE_API_CONTRACT_VERSION = 'shipseal.repository-evidence-api.v1' as const;

export type RepositoryEvidenceApiFailureCategory =
  | 'repository_not_found'
  | 'permission_denied'
  | 'rate_limited'
  | 'service_unavailable'
  | 'contract_error'
  | 'safety_budget_reached'
  | 'invalid_request';

export interface RepositoryEvidenceApiSuccess {
  scanInput: RepoScanInput;
  commitSha: string;
  requestCount: number;
}

export interface RepositoryEvidenceApiFailure {
  error: string;
  category?: RepositoryEvidenceApiFailureCategory;
}

export type RepositoryEvidenceApiValidation =
  | { valid: true; value: RepositoryEvidenceApiSuccess }
  | { valid: false; reason: string };

export function validateRepositoryEvidenceApiSuccess(payload: unknown): RepositoryEvidenceApiValidation {
  if (!isRecord(payload)) return invalid('response must be an object');
  if (!isGitSha(payload.commitSha)) return invalid('commitSha must be a 40-character Git SHA');
  if (!isNonNegativeInteger(payload.requestCount)) return invalid('requestCount must be a non-negative integer');
  if (!isRecord(payload.scanInput)) return invalid('scanInput must be an object');

  const scanInput = payload.scanInput;
  if (typeof scanInput.repoName !== 'string' || !scanInput.repoName.trim()) return invalid('scanInput.repoName must be non-empty');
  if (!Array.isArray(scanInput.files) || !scanInput.files.every(isRepoFileSummary)) return invalid('scanInput.files must be a valid file array');
  if (!isRecord(scanInput.textContents) || !Object.values(scanInput.textContents).every(value => typeof value === 'string')) {
    return invalid('scanInput.textContents must be a string-valued object');
  }
  if (!isRecord(scanInput.source)
    || !['github-public', 'github-app'].includes(String(scanInput.source.sourceType))
    || typeof scanInput.source.githubOwner !== 'string'
    || typeof scanInput.source.githubRepo !== 'string') {
    return invalid('scanInput.source must describe a GitHub evidence source');
  }
  if (!isRecord(scanInput.scanSummary)
    || !['full', 'bounded', 'limited-fallback'].includes(String(scanInput.scanSummary.scanMode))
    || scanInput.scanSummary.sourceCommitSha !== payload.commitSha
    || scanInput.scanSummary.sourceRequestCount !== payload.requestCount) {
    return invalid('scanInput.scanSummary must match the acquisition identity');
  }

  return { valid: true, value: payload as unknown as RepositoryEvidenceApiSuccess };
}

export function isRepositoryEvidenceApiFailure(payload: unknown): payload is RepositoryEvidenceApiFailure {
  return isRecord(payload)
    && typeof payload.error === 'string'
    && payload.error.trim().length > 0
    && (payload.category === undefined || isFailureCategory(payload.category));
}

function isFailureCategory(value: unknown): value is RepositoryEvidenceApiFailureCategory {
  return typeof value === 'string' && [
    'repository_not_found', 'permission_denied', 'rate_limited', 'service_unavailable',
    'contract_error', 'safety_budget_reached', 'invalid_request',
  ].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isGitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isRepoFileSummary(value: unknown) {
  return isRecord(value)
    && typeof value.path === 'string'
    && value.path.length > 0
    && typeof value.size === 'number'
    && Number.isFinite(value.size)
    && value.size >= 0;
}

function invalid(reason: string): RepositoryEvidenceApiValidation {
  return { valid: false, reason };
}

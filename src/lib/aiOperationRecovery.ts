import type { RepositoryProductIntelligenceResult } from './repositoryIntelligence/productIntelligenceSchema.js';
import type { AiOperationLookup, AiOperationStatusSnapshot, PersistedRepositoryFutureResult } from './aiOperationRecoveryContract.js';
export type { AiOperationLookup, AiOperationRecoveryAction, AiOperationStatusSnapshot, PersistedRepositoryFutureResult } from './aiOperationRecoveryContract.js';

export function repositoryOperationIdentity(repository: { name: string; fullName?: string }) {
  return repository.fullName && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.fullName)
    ? `github:${repository.fullName.toLowerCase()}`
    : `upload:${repository.name.trim().toLowerCase()}`;
}

export async function getRepositoryFutureOperationStatus(
  lookup: AiOperationLookup,
  fetcher: typeof fetch = fetch,
): Promise<AiOperationStatusSnapshot | null> {
  const response = await fetcher(`/api/account/ai-operation-status?${lookupParams(lookup)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null) as { operation?: AiOperationStatusSnapshot } | null;
  if (!response.ok || !payload?.operation) throw new Error('Future analysis status is temporarily unavailable.');
  return payload.operation;
}

export async function getPersistedRepositoryFutureResult(
  lookup: AiOperationLookup,
  fetcher: typeof fetch = fetch,
): Promise<PersistedRepositoryFutureResult | null> {
  const response = await fetcher(`/api/account/ai-operation-result?${lookupParams(lookup)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404 || response.status === 409) return null;
  const payload = await response.json().catch(() => null) as { result?: PersistedRepositoryFutureResult } | null;
  if (!response.ok || !payload?.result) throw new Error('Saved Future analysis is temporarily unavailable.');
  return payload.result;
}

export function mergePersistedRepositoryFutureResult(
  persisted: PersistedRepositoryFutureResult,
): RepositoryProductIntelligenceResult | null {
  return persisted.complete.result.productIntelligence || null;
}

function lookupParams(lookup: AiOperationLookup) {
  const params = new URLSearchParams();
  if (lookup.publicOperationId) params.set('publicOperationId', lookup.publicOperationId);
  if (lookup.requestFingerprint) params.set('requestFingerprint', lookup.requestFingerprint);
  if (lookup.repositoryIdentity) params.set('repositoryIdentity', lookup.repositoryIdentity);
  return params.toString();
}

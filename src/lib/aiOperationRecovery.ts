import {
  classifyRepositoryProductContentIntegrity,
  type RepositoryProductIntelligenceResult,
} from './repositoryIntelligence/productIntelligenceSchema.js';
import type { AiOperationLookup, AiOperationStatusSnapshot, PersistedRepositoryFutureResult } from './aiOperationRecoveryContract.js';
import type { PersistedRepositoryFutureProgress } from './aiOperationRecoveryContract.js';
import { mergeAvailableRepositoryProductExpansionResults } from './repositoryIntelligence/stagedProductIntelligence.js';
export type { AiOperationLookup, AiOperationRecoveryAction, AiOperationStatusSnapshot, PersistedRepositoryFutureProgress, PersistedRepositoryFutureResult } from './aiOperationRecoveryContract.js';

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

export async function getPersistedRepositoryFutureProgress(
  lookup: AiOperationLookup,
  fetcher: typeof fetch = fetch,
): Promise<PersistedRepositoryFutureProgress | null> {
  const response = await fetcher(`/api/account/ai-operation-status?includeProgress=1&${lookupParams(lookup)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null) as {
    progress?: PersistedRepositoryFutureProgress;
    operation?: AiOperationStatusSnapshot;
  } | null;
  if (!response.ok) throw new Error('Future analysis progress is temporarily unavailable.');
  if (payload?.progress) return payload.progress;
  if (payload?.operation) return {
    operation: payload.operation,
    root: null,
    expansionBatches: [],
    lastServerConfirmedAt: payload.operation.lastServerConfirmedAt || new Date().toISOString(),
  };
  throw new Error('Future analysis progress is temporarily unavailable.');
}

export function mergePersistedRepositoryFutureProgress(
  progress: PersistedRepositoryFutureProgress,
): RepositoryProductIntelligenceResult | null {
  const root = progress.root?.result;
  if (!root?.productIntelligence) return null;
  return mergeAvailableRepositoryProductExpansionResults(root, progress.expansionBatches).productIntelligence || null;
}

interface WatchRepositoryFutureOperationOptions {
  publicOperationId: string;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  fetcher?: typeof fetch;
  onProgress?: (progress: PersistedRepositoryFutureProgress) => void;
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Observes durable operation state only. It never calls the provider endpoint,
 * reserves an entitlement, or starts a new analysis.
 */
export async function watchRepositoryFutureOperation({
  publicOperationId,
  signal,
  pollIntervalMs = 2_500,
  fetcher = fetch,
  onProgress,
  wait = abortableWait,
}: WatchRepositoryFutureOperationOptions): Promise<PersistedRepositoryFutureProgress | null> {
  let consecutiveFailures = 0;
  let lastProgress: PersistedRepositoryFutureProgress | null = null;
  let lastSignature = '';
  while (!signal?.aborted) {
    try {
      const progress = await getPersistedRepositoryFutureProgress({ publicOperationId }, fetcher);
      consecutiveFailures = 0;
      if (!progress) return null;
      lastProgress = progress;
      const signature = [
        progress.operation.completionState,
        progress.operation.recoveryAction,
        progress.operation.completedExpansionCount,
        progress.lastServerConfirmedAt,
      ].join(':');
      if (signature !== lastSignature) {
        lastSignature = signature;
        onProgress?.(progress);
      }
      if (progress.operation.recoveryAction !== 'wait_for_active_lease') return progress;
    } catch (error) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) throw error;
    }
    await wait(pollIntervalMs, signal);
  }
  return lastProgress;
}

function abortableWait(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>(resolve => {
    if (signal?.aborted) return resolve();
    const timeout = window.setTimeout(finish, delayMs);
    signal?.addEventListener('abort', finish, { once: true });
    function finish() {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', finish);
      resolve();
    }
  });
}

export function mergePersistedRepositoryFutureResult(
  persisted: PersistedRepositoryFutureResult,
): RepositoryProductIntelligenceResult | null {
  const result = persisted.complete.result.productIntelligence || null;
  return result && classifyRepositoryProductContentIntegrity(result) !== 'legacy-truncated' ? result : null;
}

export function persistedRepositoryFutureContentIntegrity(
  persisted: PersistedRepositoryFutureResult,
) {
  const result = persisted.complete.result.productIntelligence;
  return result ? classifyRepositoryProductContentIntegrity(result) : null;
}

export function selectRepositoryFutureRecoveryOperationId(
  operation: Pick<AiOperationStatusSnapshot, 'publicOperationId' | 'recoveryAction'> | null | undefined,
): string | undefined {
  return operation && ['resume_stale_lease', 'retry_stage', 'integrity_recovery'].includes(operation.recoveryAction)
    ? operation.publicOperationId
    : undefined;
}

function lookupParams(lookup: AiOperationLookup) {
  const params = new URLSearchParams();
  if (lookup.publicOperationId) params.set('publicOperationId', lookup.publicOperationId);
  if (lookup.requestFingerprint) params.set('requestFingerprint', lookup.requestFingerprint);
  if (lookup.repositoryIdentity) params.set('repositoryIdentity', lookup.repositoryIdentity);
  return params.toString();
}

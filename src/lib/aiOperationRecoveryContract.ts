import type { RepositoryIntelligenceProviderApiResponse } from './repositoryIntelligence/productionProviderContract.js';

export type AiOperationRecoveryAction =
  | 'open_result'
  | 'wait_for_active_lease'
  | 'resume_stale_lease'
  | 'retry_stage'
  | 'integrity_recovery'
  | 'start_new_analysis'
  | 'terminal_failure';

export type AiOperationCompletionState =
  | 'ready'
  | 'running'
  | 'retryable'
  | 'incomplete'
  | 'refunded'
  | 'terminal';

export interface AiOperationStatusSnapshot {
  publicOperationId: string;
  operationState: 'reserved' | 'running' | 'succeeded' | 'retryable_failure' | 'terminal_failure';
  rootStageState: 'missing' | 'authorized' | 'running' | 'succeeded' | 'retryable_failure' | 'terminal_failure';
  retryable: boolean;
  completionState: AiOperationCompletionState;
  cacheAvailable: boolean;
  rootCacheAvailable: boolean;
  completedExpansionCount: number;
  expectedExpansionCount: number | null;
  leaseExpiresAt: string | null;
  userUnitState: 'none' | 'reserved' | 'consumed' | 'released' | 'refunded';
  recoveryAction: AiOperationRecoveryAction;
  integrityRecoveryAttemptsUsed: number;
  reconciliationOutcome: 'not-required' | 'reconstructed' | 'refunded' | 'review-required';
}

export interface PersistedRepositoryFutureResult {
  publicOperationId: string;
  complete: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>;
  completionVersion: string;
  completedAt: string;
}

export interface AiUsageReconciliationReport {
  inspected: number;
  reconstructed: number;
  refunded: number;
  reviewRequired: number;
  unchanged: number;
}

export interface AiOperationLookup {
  requestFingerprint?: string;
  repositoryIdentity?: string;
  publicOperationId?: string;
}

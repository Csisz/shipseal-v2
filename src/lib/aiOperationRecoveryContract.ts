import type {
  RepositoryIntelligenceProviderApiResponse,
  RepositoryProductExpansionStageResult,
} from './repositoryIntelligence/productionProviderContract.js';

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
  /** Latest durable operation or stage update observed by the server. */
  lastServerConfirmedAt?: string;
  activeStageKinds?: Array<'analysis' | 'roots' | 'expansion'>;
  retryableStageKinds?: Array<'analysis' | 'roots' | 'expansion'>;
}

export interface PersistedRepositoryFutureProgress {
  operation: AiOperationStatusSnapshot;
  /** Validated durable root response. It is intentionally not described as a complete Future. */
  root: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }> | null;
  /** Only expansion batches whose identity matches the validated root contract. */
  expansionBatches: RepositoryProductExpansionStageResult[];
  lastServerConfirmedAt: string;
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

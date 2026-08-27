import type { RepositoryIntelligenceProviderApiResponse } from './repositoryIntelligence/productionProviderContract.js';

export type AiOperationRecoveryAction =
  | 'open_result'
  | 'wait_for_active_lease'
  | 'resume_stale_lease'
  | 'retry_stage'
  | 'integrity_recovery'
  | 'start_new_analysis'
  | 'terminal_failure';

export interface AiOperationStatusSnapshot {
  publicOperationId: string;
  operationState: 'reserved' | 'running' | 'succeeded' | 'retryable_failure' | 'terminal_failure';
  rootStageState: 'missing' | 'authorized' | 'running' | 'succeeded' | 'retryable_failure' | 'terminal_failure';
  retryable: boolean;
  cacheAvailable: boolean;
  leaseExpiresAt: string | null;
  userUnitState: 'none' | 'reserved' | 'consumed' | 'released';
  recoveryAction: AiOperationRecoveryAction;
  integrityRecoveryAttemptsUsed: number;
}

export interface PersistedRepositoryFutureResult {
  publicOperationId: string;
  root: Extract<RepositoryIntelligenceProviderApiResponse, { state: 'enhanced' }>;
  expansions: Array<Extract<RepositoryIntelligenceProviderApiResponse, { state: 'stage-enhanced' }>>;
}

export interface AiOperationLookup {
  requestFingerprint?: string;
  repositoryIdentity?: string;
  publicOperationId?: string;
}

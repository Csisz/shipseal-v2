import type { DeliveryPackFileKind } from '../deliveryPack/types.js';

export type OptimizationPackAction = 'create' | 'update' | 'strengthen' | 'unavailable';
export type OptimizationPackReadiness = 'ready' | 'review-required' | 'blocked';
export type OptimizationPackConflictKind =
  | 'exact-existing-path'
  | 'case-insensitive-path-collision'
  | 'duplicate-target'
  | 'unresolved-folder-agents-destination'
  | 'unavailable-generator-output'
  | 'inconsistent-action';

export interface OptimizationPackFile {
  id: string;
  zipPath: string;
  prPath: string;
  generatedPath: string;
  destinationPath: string;
  kind: DeliveryPackFileKind | 'unknown';
  action: OptimizationPackAction;
  readiness: OptimizationPackReadiness;
  content: string;
  sourceItemId: string;
  contributingProposalIds: string[];
  conflicts: Array<{
    kind: OptimizationPackConflictKind;
    state: Exclude<OptimizationPackReadiness, 'ready'>;
    explanation: string;
    paths: string[];
    proposalIds: string[];
  }>;
  includeInZip: boolean;
  includeInPr: boolean;
}

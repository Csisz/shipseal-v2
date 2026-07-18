import type {
  RepositoryIntelligenceArtifactCategory,
  RepositoryIntelligenceArtifactOperation,
  RepositoryIntelligenceArtifactStatement,
} from './artifactSchema.js';
import type { RepositoryIntelligenceContextBundle } from './contextPreparation.js';

export const REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION = 'shipseal.repository-intelligence-selected-artifacts.v1' as const;

export type RepositoryIntelligenceAnalysisMode = 'deterministic-repository-evidence' | 'deep-intelligence-enhanced';

export interface RepositoryIntelligenceReviewStatementProvenance {
  statementId: string;
  statementType: RepositoryIntelligenceArtifactStatement['type'];
  statementText: string;
  validationState: RepositoryIntelligenceArtifactStatement['validationState'];
  evidenceIds: string[];
  findingIds: string[];
  referencedPaths: string[];
  humanReviewRequired: boolean;
  rescanVerificationTarget?: RepositoryIntelligenceArtifactStatement['rescanVerificationTarget'];
}

export interface RepositoryIntelligenceExpectedFileState {
  presence: 'missing' | 'existing';
  ownership: 'missing' | 'shipseal-managed' | 'handwritten';
  contentFingerprint?: string;
  managedSectionFingerprint?: string;
  preservationMode: 'create-new' | 'replace-managed' | 'preserve-handwritten';
}

export interface RepositoryIntelligenceSelectedArtifactPayload {
  version: typeof REPOSITORY_INTELLIGENCE_SELECTED_PAYLOAD_VERSION;
  artifactSchemaVersion: 'shipseal.repository-intelligence-artifacts.v1';
  reviewVersion: 'shipseal.repository-intelligence-review.v1';
  repository: RepositoryIntelligenceContextBundle['repository'];
  repositoryIdentityFingerprint: string;
  scanIdentity: string;
  artifactSetFingerprint: string;
  selectedPlanFingerprint: string;
  artifacts: Array<{
    artifactId: string;
    category: RepositoryIntelligenceArtifactCategory;
    targetPath: string;
    operation: Extract<RepositoryIntelligenceArtifactOperation, 'create' | 'update' | 'strengthen'>;
    content: string;
    contentFingerprint: string;
    applyRepresentation: 'create-file' | 'replace-shipseal-managed' | 'proposed-addition';
    expectedFileState: RepositoryIntelligenceExpectedFileState;
    artifactFingerprint: string;
    statementProvenance: RepositoryIntelligenceReviewStatementProvenance[];
    humanReviewAcknowledgement?: { artifactId: string; artifactFingerprint: string };
  }>;
  fingerprint: string;
}

import type { CriticalBlocker } from '../types.js';
import type { EntryPointClassification } from '../sourceDetection.js';

export type { EntryPointClassification } from '../sourceDetection.js';

export type RepositoryHealthModelVersion = 'repository-health-v1';
export type RepositoryHealthMeasurementMethod = 'deterministic-static-scan';

export type RepositoryHealthStatus =
  | 'AI-ready workspace'
  | 'Workable with optimization'
  | 'Fragmented workspace'
  | 'High agent friction'
  | 'Blocked'
  | 'Insufficient evidence';

export type HealthConfidence = 'High' | 'Medium' | 'Low';
export type HealthSignalStatus = 'pass' | 'partial' | 'fail' | 'unknown' | 'not-applicable';

export type HealthDimensionId =
  | 'repositoryIntelligence'
  | 'contextWaste'
  | 'aiDevelopmentReadiness'
  | 'agentRouting'
  | 'deliveryConfidence';

export interface HealthSignal {
  id: string;
  dimension: HealthDimensionId;
  label: string;
  status: HealthSignalStatus;
  weight: number;
  earned: number;
  evidence: string[];
  recommendationId?: string;
}

export interface HealthDimension {
  score: number | null;
  confidence: HealthConfidence;
  signals: HealthSignal[];
}

export interface ContextWasteDimension {
  riskScore: number | null;
  contextEfficiencyScore: number | null;
  confidence: HealthConfidence;
  signals: HealthSignal[];
}

export interface HealthRecommendation {
  id: string;
  title: string;
  whyItMatters: string;
  action: string;
  evidence: string[];
  dimensions: HealthDimensionId[];
  suggestedTargetPath?: string;
  potentialDimensionGain: number;
  priority: 'High' | 'Medium' | 'Low';
}

export interface HealthBlocker extends CriticalBlocker {
  evidence: string[];
}

export interface RepositoryHealthModel {
  modelVersion: RepositoryHealthModelVersion;
  measurementMethod: RepositoryHealthMeasurementMethod;
  overall: {
    score: number | null;
    status: RepositoryHealthStatus;
    confidence: HealthConfidence;
  };
  dimensions: {
    repositoryIntelligence: HealthDimension;
    contextWaste: ContextWasteDimension;
    aiDevelopmentReadiness: HealthDimension;
    agentRouting: HealthDimension;
    deliveryConfidence: HealthDimension;
  };
  blockers: HealthBlocker[];
  topActions: HealthRecommendation[];
  measurementBoundary: string[];
}

export type RepositoryFileKind =
  | 'source'
  | 'test'
  | 'documentation'
  | 'config'
  | 'instruction'
  | 'generated'
  | 'binary'
  | 'other';

export interface ClassifiedRepositoryFile {
  path: string;
  size: number;
  isDir: boolean;
  ignored: boolean;
  kind: RepositoryFileKind;
  activeDocumentation: boolean;
  legacyDocumentation: boolean;
  generatedOrVendor: boolean;
  binaryLike: boolean;
  readableText: boolean;
}

export interface DocumentationDuplicateGroup {
  hash: string;
  paths: string[];
}

export interface DocumentationFamilyGroup {
  family: string;
  activePaths: string[];
  legacyPaths: string[];
}

export interface RepositoryHealthSignals {
  files: ClassifiedRepositoryFile[];
  signals: HealthSignal[];
  duplicateDocumentationGroups: DocumentationDuplicateGroup[];
  documentationFamilies: DocumentationFamilyGroup[];
  entryPointCandidates: string[];
  entryPointClassification: EntryPointClassification;
  sourceFolders: string[];
  blockers: HealthBlocker[];
}

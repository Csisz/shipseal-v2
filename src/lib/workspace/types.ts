import type { AgentPackFile, DetectedStack, ScanEvidence, ScanSourceMetadata } from '../types';
import type { HealthConfidence, RepositoryHealthModel } from '../repositoryHealth';

export type AiWorkspaceModelVersion = 'ai-workspace-foundation-v0';
export type WorkspaceMetricStatus = 'excellent' | 'workable' | 'needs-focus' | 'high-friction' | 'unavailable';

export interface WorkspaceMetric {
  label: string;
  score: number | null;
  status: WorkspaceMetricStatus;
  confidence: HealthConfidence;
  evidence: string[];
  measurementBoundary: string[];
}

export interface WorkspaceMetrics {
  aiWorkspaceQuality: WorkspaceMetric;
  repositoryFriction: WorkspaceMetric;
  projectMemoryCoverage: WorkspaceMetric;
  contextEfficiency: WorkspaceMetric;
  agentProductivity: WorkspaceMetric;
  deliveryOutputCompleteness: WorkspaceMetric;
}

export interface RepositoryIntelligence {
  repositoryName: string;
  source: ScanSourceMetadata;
  stack: DetectedStack;
  scanEvidence: ScanEvidence;
  repositoryHealth?: RepositoryHealthModel;
  knownBoundaries: string[];
}

export interface ProjectMemory {
  durableFacts: string[];
  memoryFiles: string[];
  instructionFiles: string[];
  missingMemorySignals: string[];
}

export interface ContextCompression {
  highSignalPaths: string[];
  lowSignalPaths: string[];
  ignoredGeneratedFolders: string[];
  compressionOpportunities: string[];
  boundary: string[];
}

export interface AgentRouting {
  entryPoints: string[];
  folderRoutes: Array<{
    path: string;
    purpose: string;
    recommendedInstructionFile?: string;
  }>;
  routingGaps: string[];
}

export interface DeliveryOutputs {
  generatedFiles: string[];
  outputCount: number;
  deliveryPackAvailable: boolean;
  scoreJsonAvailable: boolean;
  manifestAvailable: boolean;
  reportFiles: string[];
}

export interface AiWorkspaceModel {
  modelVersion: AiWorkspaceModelVersion;
  generatedFrom: 'existing-static-scan-signals';
  repositoryIntelligence: RepositoryIntelligence;
  projectMemory: ProjectMemory;
  contextCompression: ContextCompression;
  agentRouting: AgentRouting;
  workspaceMetrics: WorkspaceMetrics;
  deliveryOutputs: DeliveryOutputs;
  legacyCompatibility: {
    deliveryReadinessScore: number;
    repositoryHealthScore: number | null;
    repositoryHealthModelVersion?: RepositoryHealthModel['modelVersion'];
    scoringLogicChanged: false;
  };
  generatedAgentFiles?: AgentPackFile[];
}

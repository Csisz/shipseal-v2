import type {
  GeneratedAgentInstructions,
  GeneratedMcpNarrative,
  GeneratedReadinessNarrative,
  ReadinessReport,
  RepoContextPackSummary,
  ScoreJsonExport,
} from '../types';

/**
 * Future production API contracts.
 * These types document the intended backend/worker boundary only; Sprint 5 does
 * not add a real backend, persistence, authentication, or external AI calls.
 */

export interface CreateScanRequest {
  mode: 'zip-upload';
  repositoryName?: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface CreateScanResponse {
  scanId: string;
  status: ScanJobStatus;
}

export type ScanJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScanJobProgress {
  scanId: string;
  status: ScanJobStatus;
  currentStep?: string;
  progress: number;
  warnings: string[];
}

export interface ScanJobResult {
  scanId: string;
  status: 'completed';
  report: ReadinessReport;
  scoreJson: ScoreJsonExport;
  generatedFiles: {
    coreAgentPack: string[];
    mcpGovernancePack: string[];
    repoContextPack: string[];
  };
}

export interface ScanErrorResponse {
  scanId?: string;
  status: 'failed';
  code: 'VALIDATION_ERROR' | 'SCAN_FAILED' | 'NOT_FOUND' | 'CANCELLED';
  message: string;
}

/**
 * Future server-side AI endpoints:
 *
 * - POST /api/ai/readiness-narrative
 * - POST /api/ai/agent-pack-enhance
 * - POST /api/ai/mcp-governance-narrative
 *
 * These endpoints must run server-side in production. API keys must never be
 * exposed in the browser. Raw uploaded files should not be sent to AI providers
 * directly; AI should receive a sanitized Repo Context Pack only.
 */

export interface GenerateReadinessNarrativeRequest {
  repoContextPack: RepoContextPackSummary;
  score: ReadinessReport['score'];
  status: ReadinessReport['level'];
  isReady: boolean;
}

export interface GenerateReadinessNarrativeResponse {
  aiNarrative: GeneratedReadinessNarrative;
  provider: 'local' | 'server';
}

export interface GenerateAgentPackEnhancementRequest {
  repoContextPack: RepoContextPackSummary;
  aiNarrative: GeneratedReadinessNarrative;
}

export interface GenerateAgentPackEnhancementResponse {
  enhancements: GeneratedAgentInstructions;
  provider: 'local' | 'server';
}

export interface GenerateMcpNarrativeRequest {
  repoContextPack: RepoContextPackSummary;
  mcpReadiness: ReadinessReport['mcpReadiness'];
}

export interface GenerateMcpNarrativeResponse {
  aiNarrative: GeneratedMcpNarrative;
  provider: 'local' | 'server';
}

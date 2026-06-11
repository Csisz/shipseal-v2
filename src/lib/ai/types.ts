import type {
  CriticalBlocker,
  DetectedStack,
  GeneratedAgentInstructions,
  GeneratedMcpNarrative,
  GeneratedReadinessNarrative,
  Improvement,
  MCPReadinessReport,
  ReadinessLevel,
  RepoContextPackSummary,
  RepositorySummary,
  ScanSummary,
  ScoreCategory,
} from '../types';

export type {
  GeneratedAgentInstructions,
  GeneratedMcpNarrative,
  GeneratedReadinessNarrative,
} from '../types';

export interface ReadinessNarrativeInput {
  repositoryName: string;
  score: number;
  level: ReadinessLevel;
  isReady: boolean;
  stack: DetectedStack;
  summary: RepositorySummary;
  categories: ScoreCategory[];
  blockers: CriticalBlocker[];
  improvements: Improvement[];
  scanSummary: ScanSummary;
  mcpReadiness: Pick<MCPReadinessReport, 'score' | 'status' | 'summary' | 'riskFindings' | 'recommendedServerCategories'>;
}

export interface AgentInstructionsInput extends ReadinessNarrativeInput {
  readinessNarrative: GeneratedReadinessNarrative;
  mcpNarrative: GeneratedMcpNarrative;
  repoContextPack: RepoContextPackSummary;
}

export interface McpGovernanceNarrativeInput {
  repositoryName: string;
  stack: DetectedStack;
  summary: RepositorySummary;
  agentScore: number;
  agentLevel: ReadinessLevel;
  isAgentReady: boolean;
  criticalBlockers: CriticalBlocker[];
  mcpReadiness: Pick<MCPReadinessReport, 'score' | 'status' | 'summary' | 'riskFindings' | 'recommendedServerCategories'>;
}

export interface AIProvider {
  generateReadinessNarrative(input: ReadinessNarrativeInput): Promise<GeneratedReadinessNarrative>;
  generateAgentInstructions(input: AgentInstructionsInput): Promise<GeneratedAgentInstructions>;
  generateMcpGovernanceNarrative(input: McpGovernanceNarrativeInput): Promise<GeneratedMcpNarrative>;
}

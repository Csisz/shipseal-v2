// Core types for AgentReady

export interface RepoFileSummary {
  path: string;
  size: number;
  isDir?: boolean;
  ignored?: boolean;
  ignoredReason?: 'generated-vendor' | 'binary' | 'unsafe-path' | 'too-large-text';
}

export interface ScanSummary {
  scanMode: 'full' | 'limited-fallback';
  limited: boolean;
  limitationReason?: string;
  archiveDiagnostics?: {
    inputKind: 'user-uploaded-zip' | 'github-zipball' | 'invalid-zip' | 'html-error-response' | 'unsupported-archive' | 'unknown';
    fileName: string;
    fileSizeBytes: number;
    mimeType?: string;
    requestedUrl?: string;
    finalUrl?: string;
    responseStatus?: number;
    contentType?: string;
    startsWithZipMagic?: boolean;
    contentKind?: 'zip' | 'html' | 'json' | 'text' | 'gzip' | 'unknown';
    signature: string;
    parseError?: string;
    zipEntryCount?: number;
    topLevelFolders?: string[];
  };
  totalFilesFound: number;
  filesAnalyzed: number;
  filesIgnored: number;
  generatedVendorFilesIgnored: number;
  binaryFilesIgnored: number;
  readableTextBytesAnalyzed: number;
  ignoredGeneratedFolders: string[];
  warnings: string[];
  limits: {
    maxZipSizeBytes: number;
    maxFileCount: number;
    maxReadableTextFileSizeBytes: number;
    maxTotalReadableTextBytes: number;
    maxPathLength: number;
    maxGeneratedFolderDepth: number;
  };
}

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  scripts: Record<string, string>;
  testFrameworks: string[];
  runCommands: { label: string; cmd: string }[];
  primary: string; // primary stack label
}

export interface RepositorySummary {
  repositoryName: string;
  detectedStack: string;
  packageManager: string;
  scripts: Record<string, string>;
  keyFolders: string[];
  instructionFiles: string[];
}

export interface GeneratedReadinessNarrative {
  executiveSummary: string;
  readinessExplanation: string;
  blockerExplanation: string;
  improvementPriorities: string[];
  nextBestActions: string[];
  confidenceNote: string;
}

export interface GeneratedAgentInstructions {
  agentsMdEnhancement: string;
  claudeMdEnhancement: string;
  codexPromptEnhancement: string;
  reviewerPromptEnhancement: string;
  testingStrategyEnhancement: string;
}

export interface GeneratedMcpNarrative {
  mcpSummary: string;
  riskNarrative: string;
  recommendedGovernanceActions: string[];
}

export interface RepoContextPackSummary {
  repositoryName: string;
  detectedStack: string;
  languages: string[];
  frameworks: string[];
  packageManager: string;
  scripts: Record<string, string>;
  runCommands: { label: string; cmd: string }[];
  keyFolders: string[];
  sampleFiles: string[];
  existingInstructionFiles: string[];
  scanSummary: {
    totalFilesFound: number;
    filesAnalyzed: number;
    filesIgnored: number;
    readableTextBytesAnalyzed: number;
    warnings: string[];
  };
  blockers: Pick<CriticalBlocker, 'id' | 'title' | 'detail'>[];
  improvements: Pick<Improvement, 'id' | 'title' | 'category'>[];
  ignoredFolders: string[];
  securityFindings: string[];
  mcpSummary: {
    score: number;
    status: MCPReadinessStatus;
    summary: string;
    riskFindingCount: number;
    recommendedServerCategories: string[];
  };
  contentPolicy: {
    rawFileContentsIncluded: false;
    secretsIncluded: false;
    uploadedCodeExecuted: false;
  };
}

export type ScanSourceType = 'zip-upload' | 'github-url' | 'github-public';

export interface ScanSourceMetadata {
  sourceType: ScanSourceType;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  githubDefaultBranch?: string;
  githubInstallationId?: string;
  sourceUrl?: string;
  archiveDiagnostics?: Partial<ScanSummary['archiveDiagnostics']>;
}

export type ScanEvidenceSourceType = 'github-app' | 'public-github' | 'zip';

export interface ScanEvidence {
  sourceType: ScanEvidenceSourceType;
  repositoryFullName: string;
  branchOrRef?: string;
  discoveredFileCount: number;
  analyzedFileCount: number;
  ignoredFileCount: number;
  generatedOrVendorFileCount: number;
  totalReadableBytes: number;
  approximateArchiveSizeBytes?: number;
  topLanguages: string[];
  topFrameworks: string[];
  keyFilesFound: {
    readme: boolean;
    packageJson: boolean;
    tests: boolean;
    ciConfig: boolean;
    envExample: boolean;
    gitignore: boolean;
    agentInstructions: boolean;
    claudeInstructions: boolean;
  };
  warningCount: number;
  limitedScan: boolean;
  limitationReason?: string;
}

export interface ScoreItem {
  id: string;
  label: string;
  points: number;
  earned: number;
  passed: boolean;
}

export interface ScoreCategory {
  id: string;
  name: string;
  description: string;
  max: number;
  earned: number;
  items: ScoreItem[];
}

export interface CriticalBlocker {
  id: string;
  title: string;
  detail: string;
}

export interface Improvement {
  id: string;
  title: string;
  detail: string;
  category: string;
}

export interface AgentPackFile {
  name: string;
  language: 'markdown' | 'yaml';
  description: string;
  content: string;
}

export type MCPRiskLevel = 'Low' | 'Medium' | 'High';
export type MCPRiskSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type MCPReadinessStatus = 'Not MCP Ready' | 'Basic MCP Ready' | 'MCP Ready' | 'Enterprise MCP Ready' | 'Provisional MCP Readiness';

export type MCPToolCategory =
  | 'GitHub / repository operations'
  | 'Documentation / framework docs'
  | 'Browser automation / Playwright'
  | 'Error monitoring / logs'
  | 'Database / schema inspection'
  | 'Design handoff / Figma'
  | 'Internal knowledge base / docs'
  | 'CI/CD and deployment visibility';

export interface MCPRecommendation {
  category: MCPToolCategory;
  label: string;
  description: string;
  riskLevel: MCPRiskLevel;
  whyUseful: string;
  safetyNotes: string;
}

export interface MCPRiskFinding {
  title: string;
  severity: MCPRiskSeverity;
  description: string;
  recommendation: string;
}

export interface MCPPolicyFile {
  filename: string;
  content: string;
}

export interface MCPReadinessReport {
  score: number;
  status: MCPReadinessStatus;
  summary: string;
  recommendedServerCategories: MCPRecommendation[];
  riskFindings: MCPRiskFinding[];
  generatedFiles: MCPPolicyFile[];
  aiNarrative?: GeneratedMcpNarrative;
}

export type ReadinessLevel =
  | 'Not Ready'
  | 'Partially Ready'
  | 'Almost Ready'
  | 'AI Coding Ready'
  | 'AgentReady Certified';

export type AgentOperatingModeId =
  | 'maximum-reliability'
  | 'balanced-productivity'
  | 'token-saver';

export interface ReadinessReport {
  repoName: string;
  fileCount: number;
  totalSizeBytes: number;
  scannedAt: string;
  source: ScanSourceMetadata;
  stack: DetectedStack;
  summary: RepositorySummary;
  categories: ScoreCategory[];
  score: number;
  level: ReadinessLevel;
  isReady: boolean; // score >= 85 && blockers.length === 0
  blockers: CriticalBlocker[];
  improvements: Improvement[];
  contextPack: string;
  repoContextPack: RepoContextPackSummary;
  agentPack: AgentPackFile[];
  aiNarrative: GeneratedReadinessNarrative;
  aiAgentInstructions: GeneratedAgentInstructions;
  mcpReadiness: MCPReadinessReport;
  scanSummary: ScanSummary;
  scanEvidence: ScanEvidence;
  sampleFiles: RepoFileSummary[];
  recommendedAgentOperatingMode?: AgentOperatingModeId;
}

export interface RepoScanInput {
  files: RepoFileSummary[];
  textContents: Record<string, string>; // path -> content for parsed config files
  repoName: string;
  scanSummary?: ScanSummary;
  source?: ScanSourceMetadata;
}

export interface ScoreJsonExport {
  product: 'ShipSeal';
  generatedBy: 'Generated by ShipSeal';
  repositoryName: string;
  scanTimestamp: string;
  source: ScanSourceMetadata;
  score: number;
  status: ReadinessLevel;
  isReady: boolean;
  criticalBlockers: CriticalBlocker[];
  improvements: Improvement[];
  categories: ScoreCategory[];
  detectedStack: DetectedStack;
  scanSummary: ScanSummary;
  scanEvidence: ScanEvidence;
  aiNarrative: GeneratedReadinessNarrative;
  repoContextPack: {
    repositoryName: string;
    detectedStack: string;
    packageManager: string;
    scriptCount: number;
    keyFolders: string[];
    existingInstructionFiles: string[];
    blockerCount: number;
    ignoredFolders: string[];
    securityFindingCount: number;
    mcpStatus: MCPReadinessStatus;
    rawFileContentsIncluded: false;
  };
  generatedFiles: string[];
  outputCount: number;
  agentOperatingMode?: {
    id: AgentOperatingModeId;
    label: string;
    summary: string;
    expectedTokenUsage: string;
    confidence: string;
  };
  toolingRecommendations?: {
    version: 1;
    source: 'shipseal-static-scan';
    generatedFrom: 'existing-scan-signals';
    futureCatalogReady: {
      skillMarketplace: false;
      communitySkills: false;
      customSkills: false;
      mcpCatalogs: false;
    };
    skills: Array<{
      name: string;
      whyRecommended: string;
      expectedBenefit: string;
      confidence: 'High' | 'Medium' | 'Low';
      signals: string[];
    }>;
    mcpTools: Array<{
      toolName: string;
      whyRecommended: string;
      expectedBenefit: string;
      confidence: 'High' | 'Medium' | 'Low';
      signals: string[];
    }>;
  };
  specializedContextPacks?: {
    generated: boolean;
    files: string[];
    outputCount: number;
  };
  deliveryPackFocus?: {
    selectedGoals: Array<{ id: string; title: string }>;
    emphasizedFiles: string[];
    generatedFiles: string[];
    outputCount: number;
    manifestFiles: string[];
    manifestOutputCount: number;
    readinessPrFiles: string[];
    readinessPrOutputCount: number;
    fullPackage: boolean;
    packageLabel: string;
    packageSummary: string;
  };
  mcpReadiness: {
    score: number;
    status: MCPReadinessStatus;
    summary: string;
    aiNarrative?: GeneratedMcpNarrative;
    recommendedServerCategories: MCPRecommendation[];
    riskFindings: MCPRiskFinding[];
    generatedFiles: string[];
  };
}

export interface ScanHistoryItem {
  repositoryName: string;
  timestamp: string;
  sourceType?: ScanSourceType;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  score: number;
  status: ReadinessLevel;
  criticalBlockerCount: number;
  mcpScore: number;
  mcpStatus: MCPReadinessStatus;
}

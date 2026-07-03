import type { ProjectIntake } from '../intake';
import type { ReadinessReport } from '../types';

export interface ClientReportHtmlInput {
  intake: ProjectIntake;
  report?: ReadinessReport;
  scoreJson?: unknown;
  generatedAt?: Date | string;
}

export interface ClientReportSummary {
  projectName: string;
  clientName: string;
  agencyName: string;
  generatedDate: string;
  generatedTimestamp: string;
  score: string;
  status: string;
  goNoGo: string;
  repositoryHealthScore: string;
  repositoryHealthStatus: string;
  repositoryHealthConfidence: string;
  repositoryHealthSummary: string;
  contextWasteRisk: string;
  contextWasteExplanation: string;
  repositoryHealthDimensions: Array<{
    label: string;
    score: string;
    confidence: string;
    signalSummary: string;
  }>;
  repositoryHealthEvidence: string[];
  repositoryHealthTopActions: string[];
  repositoryHealthMeasurementBoundary: string[];
  repositoryName: string;
  branchOrRef: string;
  selectedGoalId: string;
  selectedGoal: string;
  selectedGoalSummary: string;
  generatedOutputCount: number;
  generatedFiles: string[];
  packageFocusTitle: string;
  packageFocusItems: string[];
  packageChecklistTitle: string;
  packageChecklistItems: string[];
  intakeNote: string;
  scanSummary: string;
  scanEvidenceSummary: string;
  scanLimited: boolean;
  scanWarning: string;
  strengths: string[];
  risks: string[];
  nextActions: string[];
  aiActSummary: string;
  testingSummary: string;
  mcpSummary: string;
}

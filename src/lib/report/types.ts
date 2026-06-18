import type { ProjectIntake } from '../intake';

export interface ClientReportHtmlInput {
  intake: ProjectIntake;
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

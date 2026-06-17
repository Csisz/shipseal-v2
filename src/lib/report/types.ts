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
  score: string;
  status: string;
  goNoGo: string;
  repositoryName: string;
  selectedGoal: string;
  selectedGoalSummary: string;
  generatedOutputCount: number;
  intakeNote: string;
  scanSummary: string;
  scanEvidenceSummary: string;
  scanLimited: boolean;
  scanWarning: string;
  strengths: string[];
  risks: string[];
  aiActSummary: string;
  testingSummary: string;
  mcpSummary: string;
}

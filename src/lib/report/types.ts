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
  scanSummary: string;
  strengths: string[];
  risks: string[];
  aiActSummary: string;
  testingSummary: string;
  mcpSummary: string;
}

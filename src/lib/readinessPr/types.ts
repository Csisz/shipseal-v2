export interface ReadinessPrFile {
  path: string;
  readinessCategory: string;
}

export interface ReadinessPrPlan {
  branchName: string;
  title: string;
  summary: string;
  files: ReadinessPrFile[];
  categories: string[];
  manualGitSteps: string;
  safetyNote: string;
  expectedImpactNote: string;
}

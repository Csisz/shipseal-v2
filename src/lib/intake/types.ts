export interface ProjectIntake {
  projectName: string;
  appDescription: string;
  targetUsers: string;
  aiUseCase: string;
  usedInEU: boolean;
  handlesPersonalData: boolean;
  generatesUserFacingContent: boolean;
  hasHumanApproval: boolean;
  aiProvider: string;
  modelName: string;
  clientName?: string;
  agencyName?: string;
}

export type PartialProjectIntake = Partial<ProjectIntake>;

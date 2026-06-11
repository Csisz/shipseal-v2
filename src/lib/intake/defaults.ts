import type { PartialProjectIntake, ProjectIntake } from './types';

const DEFAULT_PROJECT_NAME = 'repository';

export function createDefaultProjectIntake(projectName?: string): ProjectIntake {
  return {
    projectName: clean(projectName) || DEFAULT_PROJECT_NAME,
    appDescription: '',
    targetUsers: '',
    aiUseCase: '',
    usedInEU: false,
    handlesPersonalData: false,
    generatesUserFacingContent: false,
    hasHumanApproval: false,
    aiProvider: '',
    modelName: '',
    clientName: '',
    agencyName: '',
  };
}

export function normalizeProjectIntake(intake?: PartialProjectIntake, fallbackProjectName?: string): ProjectIntake {
  const defaults = createDefaultProjectIntake(fallbackProjectName);

  return {
    ...defaults,
    ...intake,
    projectName: clean(intake?.projectName) || defaults.projectName,
    appDescription: clean(intake?.appDescription) || defaults.appDescription,
    targetUsers: clean(intake?.targetUsers) || defaults.targetUsers,
    aiUseCase: clean(intake?.aiUseCase) || defaults.aiUseCase,
    usedInEU: Boolean(intake?.usedInEU ?? defaults.usedInEU),
    handlesPersonalData: Boolean(intake?.handlesPersonalData ?? defaults.handlesPersonalData),
    generatesUserFacingContent: Boolean(intake?.generatesUserFacingContent ?? defaults.generatesUserFacingContent),
    hasHumanApproval: Boolean(intake?.hasHumanApproval ?? defaults.hasHumanApproval),
    aiProvider: clean(intake?.aiProvider) || defaults.aiProvider,
    modelName: clean(intake?.modelName) || defaults.modelName,
    clientName: clean(intake?.clientName) || defaults.clientName,
    agencyName: clean(intake?.agencyName) || defaults.agencyName,
  };
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

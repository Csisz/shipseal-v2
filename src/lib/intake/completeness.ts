import type { ProjectIntake } from './types';

export function hasMeaningfulProjectContext(intake: ProjectIntake, defaultProjectName: string) {
  const textFields = [
    intake.appDescription,
    intake.targetUsers,
    intake.aiUseCase,
    intake.aiProvider,
    intake.modelName,
    intake.clientName,
    intake.agencyName,
  ];

  return (
    intake.projectName.trim() !== defaultProjectName.trim() ||
    textFields.some(value => Boolean(value?.trim())) ||
    intake.usedInEU ||
    intake.handlesPersonalData ||
    intake.generatesUserFacingContent ||
    intake.hasHumanApproval
  );
}

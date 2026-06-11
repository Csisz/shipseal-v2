import { describe, expect, it } from 'vitest';
import { createDefaultProjectIntake, hasMeaningfulProjectContext } from '@/lib/intake';

describe('Project Intake completeness', () => {
  it('treats untouched default intake as empty project context', () => {
    const intake = createDefaultProjectIntake('repo-name');

    expect(hasMeaningfulProjectContext(intake, 'repo-name')).toBe(false);
  });

  it('treats filled intake fields as meaningful project context', () => {
    expect(hasMeaningfulProjectContext({
      ...createDefaultProjectIntake('repo-name'),
      clientName: 'Acme Client',
    }, 'repo-name')).toBe(true);

    expect(hasMeaningfulProjectContext({
      ...createDefaultProjectIntake('repo-name'),
      aiUseCase: 'Support answer generation',
    }, 'repo-name')).toBe(true);

    expect(hasMeaningfulProjectContext({
      ...createDefaultProjectIntake('repo-name'),
      usedInEU: true,
    }, 'repo-name')).toBe(true);
  });

  it('treats project name edits as meaningful project context', () => {
    const intake = createDefaultProjectIntake('repo-name');
    intake.projectName = 'Client Support Assistant';

    expect(hasMeaningfulProjectContext(intake, 'repo-name')).toBe(true);
  });
});

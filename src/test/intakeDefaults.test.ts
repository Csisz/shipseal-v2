import { describe, expect, it } from 'vitest';
import { buildDeliveryPackFiles } from '@/lib/deliveryPack';
import { createDefaultProjectIntake, normalizeProjectIntake } from '@/lib/intake';

describe('Project intake defaults', () => {
  it('creates a default intake', () => {
    const intake = createDefaultProjectIntake('sample-nextjs-app');

    expect(intake.projectName).toBe('sample-nextjs-app');
    expect(intake.appDescription).toBe('');
    expect(intake.aiProvider).toBe('');
  });

  it('uses projectName fallback when intake projectName is missing', () => {
    const intake = normalizeProjectIntake({ projectName: '   ' }, 'fallback-project');

    expect(intake.projectName).toBe('fallback-project');
  });

  it('keeps boolean defaults stable', () => {
    const intake = createDefaultProjectIntake();

    expect(intake.usedInEU).toBe(false);
    expect(intake.handlesPersonalData).toBe(false);
    expect(intake.hasHumanApproval).toBe(false);

    const normalized = normalizeProjectIntake({
      usedInEU: true,
      handlesPersonalData: true,
      hasHumanApproval: true,
    }, 'boolean-project');

    expect(normalized.usedInEU).toBe(true);
    expect(normalized.handlesPersonalData).toBe(true);
    expect(normalized.hasHumanApproval).toBe(true);
  });

  it('does not throw when generating with incomplete intake', () => {
    expect(() => buildDeliveryPackFiles({
      agentFiles: [],
      repositoryName: 'fallback-repo',
      intake: {
        handlesPersonalData: true,
      },
    })).not.toThrow();
  });

  it('uses intake fields in handoff and AI readiness outputs', () => {
    const files = buildDeliveryPackFiles({
      agentFiles: [],
      repositoryName: 'fallback-repo',
      intake: {
        projectName: 'Intake Project',
        appDescription: 'AI support desk for delivery teams.',
        targetUsers: 'Operations managers',
        aiUseCase: 'Drafts project status responses.',
        usedInEU: true,
        handlesPersonalData: true,
        generatesUserFacingContent: true,
        hasHumanApproval: false,
        aiProvider: 'OpenAI',
        modelName: 'gpt-4.1',
        clientName: 'ClientCo',
        agencyName: 'ShipSeal Studio',
      },
    });

    const handoff = files.find(file => file.path === '06-client-handoff/CLIENT_HANDOFF_REPORT.md')?.content || '';
    const checklist = files.find(file => file.path === '05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md')?.content || '';
    const transparency = files.find(file => file.path === '05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md')?.content || '';

    expect(handoff).toContain('Intake Project');
    expect(handoff).toContain('ClientCo');
    expect(checklist).toContain('Operations managers');
    expect(checklist).toContain('Used in the EU: yes');
    expect(transparency).toContain('Drafts project status responses.');
    expect(transparency).toContain('OpenAI / gpt-4.1');
  });
});

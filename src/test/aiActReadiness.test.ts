import { describe, expect, it } from 'vitest';
import { generateAiActReadinessFiles } from '@/lib/deliveryPack';
import { normalizeProjectIntake } from '@/lib/intake';

function highSignalIntake() {
  return normalizeProjectIntake({
    projectName: 'Regulated Assistant',
    appDescription: 'AI assistant for client-facing status updates.',
    targetUsers: 'EU customers',
    aiUseCase: 'Generates customer-facing project status summaries.',
    usedInEU: true,
    handlesPersonalData: true,
    generatesUserFacingContent: true,
    hasHumanApproval: false,
    aiProvider: 'OpenAI',
    modelName: 'gpt-4.1',
    clientName: 'ClientCo',
  }, 'fallback-project');
}

describe('AI Act readiness output v1', () => {
  it('adds a transparency warning for EU user-facing AI output', () => {
    const files = generateAiActReadinessFiles(highSignalIntake());

    expect(files.checklist).toContain('Transparency warning');
    expect(files.checklist).toContain('A transparency notice is recommended');
  });

  it('adds a data protection warning when personal data is handled', () => {
    const files = generateAiActReadinessFiles(highSignalIntake());

    expect(files.checklist).toContain('Data protection warning');
    expect(files.checklist).toContain('GDPR/data protection review may be required');
  });

  it('adds a human oversight warning when human approval is missing', () => {
    const files = generateAiActReadinessFiles(highSignalIntake());

    expect(files.checklist).toContain('Human oversight warning');
    expect(files.checklist).toContain('Human approval status was not provided in the intake');
  });

  it('includes legal advice disclaimers in every output', () => {
    const files = generateAiActReadinessFiles(highSignalIntake());

    for (const content of Object.values(files)) {
      expect(content).toContain('This is not legal advice');
      expect(content).toContain('Ez nem jogi tanácsadás');
    }
  });

  it('generates non-empty checklist, transparency draft, and legal questions', () => {
    const files = generateAiActReadinessFiles(highSignalIntake());

    expect(files.checklist.trim().length).toBeGreaterThan(200);
    expect(files.transparencyNotice.trim().length).toBeGreaterThan(200);
    expect(files.legalReviewQuestions.trim().length).toBeGreaterThan(200);
    expect(files.transparencyNotice).toContain('English disclosure draft');
    expect(files.transparencyNotice).toContain('Magyar');
    expect(files.legalReviewQuestions).toContain('Questions for legal or compliance reviewer');
  });
});

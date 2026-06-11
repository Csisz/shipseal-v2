import { describe, expect, it } from 'vitest';
import { SAMPLE_PROJECT_INTAKE, SAMPLE_PROJECT_PROFILE } from '@/lib/demo/sampleProject';
import { buildSampleDeliveryPack, findSampleDeliveryPackFile } from '@/lib/demo/sampleDeliveryPack';

function textAt(path: string) {
  const file = findSampleDeliveryPackFile(path);
  expect(file, path).toBeTruthy();
  return file?.content || '';
}

function numberedItemCount(content: string) {
  return (content.match(/^\d+\.\s/gm) || []).length;
}

describe('ShipSeal sample Delivery Pack', () => {
  it('loads the sample project profile and intake signals', () => {
    expect(SAMPLE_PROJECT_PROFILE.slug).toBe('customer-support-rag-assistant');
    expect(SAMPLE_PROJECT_INTAKE.projectName).toBeTruthy();
    expect(SAMPLE_PROJECT_INTAKE.projectName).toBe('Customer Support RAG Assistant');
    expect(SAMPLE_PROJECT_INTAKE.usedInEU).toBe(true);
    expect(SAMPLE_PROJECT_INTAKE.generatesUserFacingContent).toBe(true);
    expect(SAMPLE_PROJECT_INTAKE.handlesPersonalData).toBe(true);
    expect(SAMPLE_PROJECT_INTAKE.hasHumanApproval).toBe(true);
  });

  it('generates the required AI Act and client handoff files through the production Delivery Pack generator', () => {
    const pack = buildSampleDeliveryPack();
    const paths = pack.files.map(file => file.path);

    expect(pack.projectName).toBe(SAMPLE_PROJECT_INTAKE.projectName);
    expect(paths).toContain('05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md');
    expect(paths).toContain('05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md');
    expect(paths).toContain('06-client-handoff/CLIENT_HANDOFF_REPORT.md');
    expect(paths).toContain('06-client-handoff/CLIENT_HANDOFF_REPORT.html');
  });

  it('includes at least 30 eval cases and 10 red-team prompts', () => {
    const evalCases = textAt('04-testing/EVAL_TEST_CASES.md');
    const redTeamPrompts = textAt('04-testing/RED_TEAM_PROMPTS.md');

    expect(numberedItemCount(evalCases)).toBeGreaterThanOrEqual(30);
    expect(numberedItemCount(redTeamPrompts)).toBeGreaterThanOrEqual(10);
  });

  it('surfaces privacy, transparency, and legal review warnings in sample outputs', () => {
    const checklist = textAt('05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md');
    const transparencyNotice = textAt('05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md');
    const handoff = textAt('06-client-handoff/CLIENT_HANDOFF_REPORT.md');

    expect(checklist).toContain('Transparency warning');
    expect(checklist).toContain('Data protection warning');
    expect(checklist).toContain('This is not legal advice');
    expect(transparencyNotice).toContain('This is not legal advice');
    expect(handoff).toMatch(/Legal review recommended|This is not legal advice|privacy\/GDPR review/i);
  });
});

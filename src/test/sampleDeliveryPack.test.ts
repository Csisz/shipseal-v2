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

  it('uses intake context across handoff, AI Act, testing, and MCP outputs', () => {
    const handoff = textAt('06-client-handoff/CLIENT_HANDOFF_REPORT.md');
    const executiveSummary = textAt('06-client-handoff/EXECUTIVE_SUMMARY.md');
    const roadmap = textAt('06-client-handoff/NEXT_STEPS_ROADMAP.md');
    const checklist = textAt('05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md');
    const evalCases = textAt('04-testing/EVAL_TEST_CASES.md');
    const redTeamPrompts = textAt('04-testing/RED_TEAM_PROMPTS.md');
    const mcpReadiness = textAt('03-mcp-governance/MCP_READINESS.md');

    for (const content of [handoff, executiveSummary, roadmap, checklist, evalCases, redTeamPrompts, mcpReadiness]) {
      expect(content).toContain(SAMPLE_PROJECT_INTAKE.aiUseCase);
    }
    expect(handoff).toContain(SAMPLE_PROJECT_INTAKE.clientName);
    expect(roadmap).toContain(SAMPLE_PROJECT_INTAKE.appDescription);
    expect(mcpReadiness).toContain(SAMPLE_PROJECT_INTAKE.aiProvider);
  });

  it('generates Context Compression files from scan signals', () => {
    const architecture = textAt('07-context/ARCHITECTURE.md');
    const criticalFiles = textAt('07-context/CRITICAL_FILES.md');
    const commandMap = textAt('07-context/COMMAND_MAP.md');
    const knownRisks = textAt('07-context/KNOWN_RISKS.md');
    const taskRouter = textAt('07-context/TASK_ROUTER.md');

    expect(architecture).toContain('Detected Stack');
    expect(architecture).toContain(SAMPLE_PROJECT_INTAKE.projectName);
    expect(criticalFiles).toContain('Do not start by reading the whole repository.');
    expect(criticalFiles).toContain('package.json');
    expect(commandMap).toContain('npm run test');
    expect(commandMap).toContain('npm run build');
    expect(knownRisks).toContain('Risks below are based only on existing ShipSeal scan and readiness signals.');
    expect(taskRouter).toContain('Use this to open fewer files before making changes.');
  });

  it('does not generate duplicated fallback phrases in markdown outputs', () => {
    const pack = buildSampleDeliveryPack();
    const markdown = pack.files
      .filter(file => file.kind === 'markdown')
      .map(file => file.content)
      .join('\n');

    expect(markdown).not.toMatch(/\bthe the\b/i);
    expect(markdown).not.toMatch(/\bworkflow workflow\b/i);
  });
});

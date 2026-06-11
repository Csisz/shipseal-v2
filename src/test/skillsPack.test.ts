import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateSkillsPackFiles } from '@/lib/deliveryPack';
import { normalizeProjectIntake } from '@/lib/intake';
import { buildSampleReport } from '@/lib/readiness';
import {
  buildAgentPackZipBlob,
  buildRepoContextPackJson,
  buildScoreJson,
} from '@/lib/exports';

const SKILL_PATHS = [
  '02-skills/code-review/SKILL.md',
  '02-skills/test-generation/SKILL.md',
  '02-skills/ai-act-readiness/SKILL.md',
  '02-skills/release-check/SKILL.md',
  '02-skills/client-handoff/SKILL.md',
];

function intake() {
  return normalizeProjectIntake({
    projectName: 'Skills Pack Project',
    appDescription: 'AI project delivery workspace.',
    aiUseCase: 'Generates delivery-ready project packs.',
    usedInEU: true,
    handlesPersonalData: true,
    hasHumanApproval: false,
    clientName: 'ClientCo',
  }, 'fallback-project');
}

describe('ShipSeal Skills Pack generator', () => {
  it('generates at least five SKILL.md files', () => {
    const files = generateSkillsPackFiles(intake());

    expect(Object.keys(files)).toHaveLength(5);
    expect(Object.keys(files).filter(path => path.endsWith('/SKILL.md')).length).toBeGreaterThanOrEqual(5);
  });

  it('includes When to use and Output sections in every skill', () => {
    const files = generateSkillsPackFiles(intake());

    for (const content of Object.values(files)) {
      expect(content).toContain('## When to use');
      expect(content).toContain('## Output');
      expect(content).toContain('## Guardrails');
      expect(content).toContain('## ShipSeal context');
    }
  });

  it('includes a legal advice disclaimer in the AI Act skill', () => {
    const files = generateSkillsPackFiles(intake());
    const aiActSkill = files['02-skills/ai-act-readiness/SKILL.md'];

    expect(aiActSkill).toContain('This is not legal advice');
    expect(aiActSkill).toContain('Ez nem jogi');
  });

  it('exports skills into the expected Delivery Pack subfolders', async () => {
    const report = buildSampleReport();
    const blob = await buildAgentPackZipBlob(
      report.agentPack,
      report.mcpReadiness.generatedFiles,
      { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
      {
        repositoryName: report.repoName,
        scoreJson: buildScoreJson(report),
        intake: intake(),
      }
    );
    const zip = await JSZip.loadAsync(blob);

    for (const path of SKILL_PATHS) {
      const file = zip.file(path);
      expect(file, path).toBeTruthy();
      const content = await file!.async('string');
      expect(content).toContain('## When to use');
      expect(content).toContain('## Output');
    }
  });
});

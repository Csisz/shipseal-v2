import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateClientHandoffFiles } from '@/lib/deliveryPack';
import { normalizeProjectIntake } from '@/lib/intake';
import { buildSampleReport } from '@/lib/readiness';
import {
  buildAgentPackZipBlob,
  buildRepoContextPackJson,
  buildScoreJson,
} from '@/lib/exports';

const HANDOFF_PATHS = [
  '06-client-handoff/CLIENT_HANDOFF_REPORT.md',
  '06-client-handoff/EXECUTIVE_SUMMARY.md',
  '06-client-handoff/NEXT_STEPS_ROADMAP.md',
];

function intake() {
  return normalizeProjectIntake({
    projectName: 'Client Handoff Project',
    appDescription: 'AI delivery dashboard for client projects.',
    aiUseCase: 'Creates client-facing delivery summaries.',
    clientName: 'ClientCo',
    agencyName: 'AgencyCo',
    usedInEU: true,
    handlesPersonalData: true,
    generatesUserFacingContent: true,
    hasHumanApproval: false,
  }, 'fallback-project');
}

describe('ShipSeal client handoff report generator', () => {
  it('generates all three client handoff files', () => {
    const files = generateClientHandoffFiles(intake(), buildScoreJson(buildSampleReport()));

    expect(files.clientHandoffReport).toBeTruthy();
    expect(files.executiveSummary).toBeTruthy();
    expect(files.nextStepsRoadmap).toBeTruthy();
  });

  it('includes go/no-go, disclaimer, and roadmap sections in the main report', () => {
    const files = generateClientHandoffFiles(intake(), buildScoreJson(buildSampleReport()));

    expect(files.clientHandoffReport).toContain('## Go / No-Go recommendation');
    expect(files.clientHandoffReport).toContain('This is not legal advice');
    expect(files.clientHandoffReport).toContain('not a production security audit');
    expect(files.clientHandoffReport).toContain('30/60/90 day next steps roadmap');
  });

  it('uses intake values and manifest output count in client-facing reports', () => {
    const scoreJson = buildScoreJson(buildSampleReport());
    const files = generateClientHandoffFiles(intake(), scoreJson);
    const expectedCount = scoreJson.outputCount;

    expect(files.clientHandoffReport).toContain('Client: ClientCo');
    expect(files.clientHandoffReport).toContain('Agency: AgencyCo');
    expect(files.clientHandoffReport).toContain('App description: AI delivery dashboard for client projects.');
    expect(files.clientHandoffReport).toContain('AI use case: Creates client-facing delivery summaries.');
    expect(files.executiveSummary).toContain('Client: ClientCo');
    expect(files.nextStepsRoadmap).toContain('App description: AI delivery dashboard for client projects.');
    expect(files.clientHandoffReport).toContain(`The ShipSeal Delivery Pack includes ${expectedCount} manifest outputs`);
    expect(files.clientHandoffReport).not.toContain('The Delivery Pack includes 8 generated files');
  });

  it('surfaces limited scan warning in client handoff markdown', () => {
    const report = buildSampleReport();
    report.scanSummary = {
      ...report.scanSummary,
      scanMode: 'limited-fallback',
      limited: true,
      limitationReason: 'ZIP parsing failed before repository contents could be fully analyzed.',
      warnings: ['ZIP parsing failed, so ShipSeal used a deterministic fallback scan. This is a limited scan and must not be treated as a complete client handoff audit.'],
    };
    const files = generateClientHandoffFiles(intake(), buildScoreJson(report));

    expect(files.clientHandoffReport).toContain('## Limited scan warning');
    expect(files.clientHandoffReport).toContain('not a complete client handoff audit');
  });

  it('reports bounded coverage and separates Repository Health from Delivery Pack readiness', () => {
    const report = buildSampleReport();
    report.score = 100;
    report.scanSummary = {
      ...report.scanSummary,
      scanMode: 'bounded', limited: false, totalFilesFound: 357, discoveredFiles: 357,
      filesAnalyzed: 160, analyzedTextFiles: 160, filesIgnored: 197,
      boundedReasons: ['selected-file-budget'],
    };
    report.scanEvidence = {
      ...report.scanEvidence,
      scanMode: 'bounded', discoveredFileCount: 357, analyzedFileCount: 160,
      ignoredFileCount: 197, selectedTextFileCount: 160, budgetExcludedFileCount: 175,
    };
    report.repositoryHealth = {
      ...report.repositoryHealth,
      overall: { score: 84, status: 'Workable with optimization', confidence: 'High' },
    };
    const files = generateClientHandoffFiles(intake(), buildScoreJson(report));

    expect(files.clientHandoffReport).toContain('Scan coverage: Bounded analysis');
    expect(files.clientHandoffReport).toContain('160 of 357 files analyzed; 197 excluded');
    expect(files.clientHandoffReport).toContain('Repository Health: 84/100');
    expect(files.clientHandoffReport).toContain('Delivery Pack readiness: 100/100');
    expect(files.clientHandoffReport).toContain('## Top Repository Health improvements');
    expect(files.clientHandoffReport).not.toContain('Scan coverage: Full scan');
  });

  it('keeps all outputs non-empty and client-readable', () => {
    const files = generateClientHandoffFiles(intake(), buildScoreJson(buildSampleReport()));

    for (const content of Object.values(files)) {
      expect(content.trim().length).toBeGreaterThan(300);
      expect(content).toContain('Client Handoff Project');
      expect(content).toContain('Generated by ShipSeal');
    }
  });

  it('handles missing scan data without inventing facts', () => {
    const files = generateClientHandoffFiles(intake());

    expect(files.clientHandoffReport).toContain('Delivery Pack readiness: Not available');
    expect(files.clientHandoffReport).toContain('Not detected');
  });

  it('exports client handoff files into the 06-client-handoff folder', async () => {
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

    for (const path of HANDOFF_PATHS) {
      const file = zip.file(path);
      expect(file, path).toBeTruthy();
      const content = await file!.async('string');
      expect(content).toContain('Generated by ShipSeal');
      expect(content.trim().length).toBeGreaterThan(300);
    }
  });
});

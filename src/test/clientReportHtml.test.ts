import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateClientReportHtml } from '@/lib/report';
import { SAMPLE_PROJECT_INTAKE } from '@/lib/demo/sampleProject';
import { buildSampleProjectReadinessReport } from '@/lib/demo/sampleReadiness';
import {
  buildAgentPackZipBlob,
  buildRepoContextPackJson,
  buildScoreJson,
} from '@/lib/exports';
import { getDeliveryPackRequiredPaths } from '@/lib/deliveryPack/manifest';

describe('ShipSeal print-ready client report HTML', () => {
  it('generates a standalone print-ready HTML report with required sections', () => {
    const report = buildSampleProjectReadinessReport();
    const html = generateClientReportHtml({
      intake: SAMPLE_PROJECT_INTAKE,
      scoreJson: buildScoreJson(report),
      generatedAt: '2026-06-02T10:00:00.000Z',
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('ShipSeal');
    expect(html).toContain(SAMPLE_PROJECT_INTAKE.projectName);
    expect(html).toContain('Readiness score');
    expect(html).toContain('AI Act readiness pre-screen');
    expect(html).toContain('Testing and eval summary');
    expect(html).toContain('30/60/90 day next steps roadmap');
    expect(html).toContain('ShipSeal does not provide legal advice');
    expect(html).toContain('MCP readiness is a separate governance dimension');
    expect(html).toContain(`ShipSeal Delivery Pack manifest outputs detected: ${getDeliveryPackRequiredPaths().length}.`);
    expect(html).not.toContain('8 generated files');
    expect(html).not.toContain('Human approval was not indicated');
    expect(html).not.toContain('Enterprise MCP Ready');
    expect(html).toContain('@page');
  });

  it('uses cautious wording when human approval is unknown or not provided', () => {
    const report = buildSampleProjectReadinessReport();
    const html = generateClientReportHtml({
      intake: {
        ...SAMPLE_PROJECT_INTAKE,
        usedInEU: false,
        handlesPersonalData: false,
        generatesUserFacingContent: false,
        hasHumanApproval: false,
      },
      scoreJson: buildScoreJson(report),
    });

    expect(html).toContain('Human approval status was not provided in the intake');
    expect(html).toContain('EU use needs confirmation');
    expect(html).toContain('personal data handling needs confirmation');
    expect(html).not.toContain('no human approval');
    expect(html).not.toContain('No human approval');
  });

  it('exports CLIENT_HANDOFF_REPORT.html into the Delivery Pack ZIP', async () => {
    const report = buildSampleProjectReadinessReport();
    const blob = await buildAgentPackZipBlob(
      report.agentPack,
      report.mcpReadiness.generatedFiles,
      { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
      {
        repositoryName: report.repoName,
        scoreJson: buildScoreJson(report),
        intake: SAMPLE_PROJECT_INTAKE,
      }
    );
    const zip = await JSZip.loadAsync(blob);
    const file = zip.file('06-client-handoff/CLIENT_HANDOFF_REPORT.html');
    expect(file).toBeTruthy();

    const html = await file!.async('string');
    expect(html).toContain('ShipSeal');
    expect(html).toContain(SAMPLE_PROJECT_INTAKE.projectName);
    expect(html).toContain('AI Act readiness pre-screen');
    expect(html).toContain('Testing and eval summary');
    expect(html).toContain('ShipSeal does not provide legal advice');
    expect(html).toContain('MCP readiness is a separate governance dimension');
  });
});

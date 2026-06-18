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
    expect(html).toContain('class="score-number"');
    expect(html).toContain('class="score-denominator"');
    expect(html).toContain('Readiness decision');
    expect(html).toContain('AI Act readiness pre-screen');
    expect(html).toContain('Testing and eval summary');
    expect(html).toContain('Generated file list');
    expect(html).toContain('Full ShipSeal overview');
    expect(html).toContain('06-client-handoff/CLIENT_HANDOFF_REPORT.html');
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

  it('uses selected goal and scan evidence in the client report', () => {
    const report = buildSampleProjectReadinessReport();
    const html = generateClientReportHtml({
      intake: {
        ...SAMPLE_PROJECT_INTAKE,
        clientName: '',
        agencyName: '',
      },
      scoreJson: buildScoreJson(report, { selectedPackages: ['mcp-readiness'] }),
    });

    expect(html).toContain('Selected package: MCP readiness pack');
    expect(html).toContain('MCP readiness, MCP security policy, tool allowlist, and server recommendations.');
    expect(html).toContain('Selected package focus');
    expect(html).toContain('Scan evidence:');
    expect(html).toContain(report.repoName);
    expect(html).toContain('Client and agency fields can be completed before final delivery.');
    expect(html).toContain('Generated outputs: 7');
    expect(html).toContain('03-mcp-governance/MCP_READINESS.md');
    expect(html).toContain('score.json');
  });

  it('handles missing client and agency fields gracefully', () => {
    const report = buildSampleProjectReadinessReport();
    const html = generateClientReportHtml({
      intake: {
        ...SAMPLE_PROJECT_INTAKE,
        clientName: '',
        agencyName: '',
      },
      scoreJson: buildScoreJson(report, { selectedPackages: ['client-handoff'] }),
    });

    expect(html).toContain('Client and agency fields can be completed before final delivery.');
    expect(html).toContain('To be completed before final delivery');
    expect(html).not.toContain('<div class="card"><div class="label">Client</div>Not provided</div>');
    expect(html).not.toContain('<div class="card"><div class="label">Agency</div>Not provided</div>');
  });

  it('prioritizes client handoff sections for the client handoff package', () => {
    const report = buildSampleProjectReadinessReport();
    const html = generateClientReportHtml({
      intake: SAMPLE_PROJECT_INTAKE,
      scoreJson: buildScoreJson(report, { selectedPackages: ['client-handoff'] }),
    });

    expect(html).toContain('Client handoff priorities');
    expect(html).toContain('Delivery manifest review');
    expect(html).toContain('executive summary, readiness decision, roadmap, and delivery manifest');
    expect(html).toContain('Generated outputs: 5');
    expect(html).toContain('06-client-handoff/NEXT_STEPS_ROADMAP.md');
  });

  it('prioritizes security and data pre-screen sections for safety-risk package', () => {
    const report = buildSampleProjectReadinessReport();
    const html = generateClientReportHtml({
      intake: {
        ...SAMPLE_PROJECT_INTAKE,
        handlesPersonalData: true,
        hasHumanApproval: false,
      },
      scoreJson: buildScoreJson(report, { selectedPackages: ['safety-risk'] }),
    });

    expect(html).toContain('Security/data risk summary');
    expect(html).toContain('Privacy and reviewer checklist');
    expect(html).toContain('Env/secrets');
    expect(html).toContain('Human approval and reviewer ownership need confirmation');
    expect(html).toContain('03-mcp-governance/MCP_SECURITY_POLICY.md');
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

import type { ClientReportHtmlInput, ClientReportSummary } from './types';

const LEGAL_DISCLAIMER = 'ShipSeal does not provide legal advice. This report is a technical, product-side and preliminary readiness assessment. It is not a formal legal opinion, production security audit or compliance certification.';
const HU_DISCLAIMER = 'A ShipSeal nem nyújt jogi tanácsadást. Ez a riport technikai, termékoldali és előzetes readiness értékelés.';

export function generateClientReportHtml(input: ClientReportHtmlInput): string {
  const summary = buildSummary(input);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ShipSeal Client Report - ${escapeHtml(summary.projectName)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #667085;
      --line: #d9e0ea;
      --soft: #f5f7fb;
      --brand: #155eef;
      --brand-dark: #0b3b94;
      --success: #067647;
      --warning: #b54708;
      --danger: #b42318;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #eef2f7;
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
    }

    .page {
      width: min(100%, 980px);
      margin: 32px auto;
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
    }

    header {
      padding: 38px 44px 30px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(135deg, #ffffff 0%, #eef5ff 100%);
    }

    .brand {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 28px;
    }

    .brand-name {
      font-weight: 800;
      letter-spacing: 0.02em;
      color: var(--brand-dark);
      font-size: 14px;
      text-transform: uppercase;
    }

    .eyebrow {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    h1 {
      font-size: 34px;
      line-height: 1.12;
      margin: 8px 0 10px;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 19px;
      margin: 0 0 14px;
      letter-spacing: -0.01em;
    }

    h3 {
      font-size: 15px;
      margin: 0 0 8px;
    }

    p { margin: 0 0 10px; }

    main { padding: 34px 44px 44px; }

    section {
      margin: 0 0 26px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .meta-grid,
    .score-grid,
    .three-grid {
      display: grid;
      gap: 12px;
    }

    .meta-grid { grid-template-columns: repeat(3, 1fr); }
    .score-grid { grid-template-columns: 1.1fr 1fr 1fr; margin-top: 22px; }
    .three-grid { grid-template-columns: repeat(3, 1fr); }

    .card {
      border: 1px solid var(--line);
      background: var(--soft);
      border-radius: 14px;
      padding: 16px;
      break-inside: avoid;
    }

    .score-card {
      background: #0b3b94;
      color: #fff;
      border-color: #0b3b94;
    }

    .score-value {
      font-size: 42px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin-top: 8px;
    }

    .label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .score-card .label { color: rgba(255,255,255,0.72); }

    ul {
      padding-left: 18px;
      margin: 0;
    }

    li { margin: 0 0 7px; }

    .badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      background: #fff;
    }

    .badge.go { color: var(--success); border-color: #abefc6; }
    .badge.conditional { color: var(--warning); border-color: #fedf89; }
    .badge.no-go { color: var(--danger); border-color: #fecdca; }

    .roadmap {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .disclaimer {
      border-top: 1px solid var(--line);
      padding-top: 18px;
      color: var(--muted);
      font-size: 12px;
    }

    .muted { color: var(--muted); }
    .small { font-size: 12px; }
    .warning {
      border: 1px solid #fedf89;
      background: #fffaeb;
      color: var(--warning);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 700;
    }

    @page {
      size: A4;
      margin: 14mm;
    }

    @media print {
      body { background: #fff; }
      .page {
        width: 100%;
        margin: 0;
        border: 0;
        box-shadow: none;
      }
      header { padding: 0 0 20px; }
      main { padding: 24px 0 0; }
      section { margin-bottom: 22px; }
      .card { border-color: #cfd7e3; }
    }

    @media (max-width: 760px) {
      .page { margin: 0; border-left: 0; border-right: 0; }
      header, main { padding-left: 22px; padding-right: 22px; }
      .brand, .meta-grid, .score-grid, .three-grid, .roadmap { grid-template-columns: 1fr; display: grid; }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="brand">
        <div>
          <div class="brand-name">ShipSeal</div>
          <div class="eyebrow">Print-ready client report</div>
        </div>
        <div class="small muted">Generated ${escapeHtml(summary.generatedDate)}</div>
      </div>
      <h1>${escapeHtml(summary.projectName)}</h1>
      <p class="muted">AI Project Delivery Pack readiness report for client handover and further expert review.</p>
      <div class="meta-grid">
        <div class="card"><div class="label">Client</div>${escapeHtml(summary.clientName)}</div>
        <div class="card"><div class="label">Agency</div>${escapeHtml(summary.agencyName)}</div>
        <div class="card"><div class="label">Repository</div>${escapeHtml(summary.repositoryName)}</div>
      </div>
      <div class="score-grid">
        <div class="card score-card">
          <div class="label">Readiness score</div>
          <div class="score-value">${escapeHtml(summary.score)}</div>
        </div>
        <div class="card">
          <div class="label">Readiness category</div>
          <strong>${escapeHtml(summary.status)}</strong>
        </div>
        <div class="card">
          <div class="label">Go / No-Go</div>
          <span class="badge ${badgeClass(summary.goNoGo)}">${escapeHtml(summary.goNoGo)}</span>
        </div>
      </div>
    </header>

    <main>
      <section>
        <h2>Executive summary</h2>
        <p>${escapeHtml(summary.projectName)} was reviewed with ShipSeal to prepare an AI project handoff package. The report summarizes readiness score, client-facing risks, AI Act readiness signals, testing coverage, MCP governance, and next steps.</p>
        <p class="muted">${escapeHtml(summary.scanSummary)}</p>
        ${summary.scanLimited ? `<p class="warning">${escapeHtml(summary.scanWarning)}</p>` : ''}
      </section>

      <section class="three-grid">
        <div class="card">
          <h3>Main strengths</h3>
          ${renderList(summary.strengths)}
        </div>
        <div class="card">
          <h3>Main risks</h3>
          ${renderList(summary.risks)}
        </div>
        <div class="card">
          <h3>Client handoff summary</h3>
          <p>${escapeHtml(summary.goNoGo)}. Review the Markdown handoff report, testing pack, and AI Act readiness notes before client delivery.</p>
        </div>
      </section>

      <section class="three-grid">
        <div class="card">
          <h3>AI Act readiness pre-screen</h3>
          <p>${escapeHtml(summary.aiActSummary)}</p>
        </div>
        <div class="card">
          <h3>Testing and eval summary</h3>
          <p>${escapeHtml(summary.testingSummary)}</p>
        </div>
        <div class="card">
          <h3>MCP governance summary</h3>
          <p>${escapeHtml(summary.mcpSummary)}</p>
        </div>
      </section>

      <section>
        <h2>30/60/90 day next steps roadmap</h2>
        <div class="roadmap">
          <div class="card">
            <h3>30 days</h3>
            <ul>
              <li>Review this report with the client owner.</li>
              <li>Run eval and red-team tests with synthetic data.</li>
              <li>Confirm privacy, AI Act, and transparency review owners.</li>
            </ul>
          </div>
          <div class="card">
            <h3>60 days</h3>
            <ul>
              <li>Close documentation gaps and accepted-risk notes.</li>
              <li>Turn repeated checks into release quality gates.</li>
              <li>Confirm MCP allowlist and approval boundaries.</li>
            </ul>
          </div>
          <div class="card">
            <h3>90 days</h3>
            <ul>
              <li>Re-run ShipSeal after remediation.</li>
              <li>Prepare production hardening with expert owners.</li>
              <li>Set a Delivery Pack refresh cadence.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="disclaimer">
        <strong>Disclaimer.</strong> ${escapeHtml(LEGAL_DISCLAIMER)}
        <br />
        ${escapeHtml(HU_DISCLAIMER)}
      </section>
    </main>
  </div>
</body>
</html>`;
}

export function buildClientReportSummary(input: ClientReportHtmlInput): ClientReportSummary {
  return buildSummary(input);
}

function buildSummary(input: ClientReportHtmlInput): ClientReportSummary {
  const score = scoreSource(input.scoreJson);
  const intake = input.intake;
  const generatedAt = input.generatedAt ? new Date(input.generatedAt) : new Date();
  const blockerCount = arrayValue(score.criticalBlockers).length;
  const isReady = typeof score.isReady === 'boolean' ? score.isReady : false;
  const goNoGo = blockerCount > 0
    ? 'No-Go'
    : isReady && input.intake.hasHumanApproval
      ? 'Go'
      : isReady
        ? 'Conditional Go'
        : 'Remediation';

  return {
    projectName: intake.projectName || stringValue(score.repositoryName) || 'Not provided',
    clientName: intake.clientName?.trim() || 'Not provided',
    agencyName: intake.agencyName?.trim() || 'Not provided',
    generatedDate: generatedAt.toLocaleDateString('en-GB'),
    score: typeof score.score === 'number' ? `${score.score}/100` : 'Not detected',
    status: stringValue(score.status) || 'Not detected',
    goNoGo,
    repositoryName: stringValue(score.repositoryName) || intake.projectName || 'Not detected',
    scanSummary: scanSummaryText(score.scanSummary),
    scanLimited: isLimitedScan(score.scanSummary),
    scanWarning: limitedScanWarning(score.scanSummary),
    strengths: strengthsFromScore(score),
    risks: risksFromScore(score, input.intake),
    aiActSummary: aiActSummary(input.intake),
    testingSummary: testingSummary(score),
    mcpSummary: mcpSummary(score),
  };
}

function scoreSource(scoreJson: unknown): Record<string, unknown> {
  const source = asRecord(scoreJson);
  const wrapped = asRecord(source.content);
  return Object.keys(wrapped).length ? wrapped : source;
}

function strengthsFromScore(score: Record<string, unknown>) {
  const categories = arrayValue(score.categories).map(asRecord);
  const strengths = categories
    .filter(category => numeric(category.earned) >= numeric(category.max) * 0.7 && numeric(category.max) > 0)
    .slice(0, 4)
    .map(category => `${stringValue(category.name) || 'Readiness area'} has a strong scan signal (${numeric(category.earned)}/${numeric(category.max)}).`);

  if (arrayValue(score.generatedFiles).length) {
    strengths.push(`ShipSeal Delivery Pack manifest outputs detected: ${arrayValue(score.generatedFiles).length}.`);
  }

  return strengths.length ? strengths : ['No major strengths detected from available data.'];
}

function risksFromScore(score: Record<string, unknown>, intake: ClientReportHtmlInput['intake']) {
  const blockers = arrayValue(score.criticalBlockers).map(asRecord);
  const risks = blockers.slice(0, 5).map(blocker => `${stringValue(blocker.title) || 'Critical blocker'}: ${stringValue(blocker.detail) || 'Details not provided'}.`);
  if (isLimitedScan(score.scanSummary)) {
    risks.push('Limited scan warning: ShipSeal could not fully parse the repository ZIP, so this is not a complete client handoff audit.');
  }

  if (intake.usedInEU && intake.generatesUserFacingContent) {
    risks.push('EU use with user-facing AI output: transparency notice review is recommended.');
  }
  if (intake.handlesPersonalData) {
    risks.push('Personal data signal: privacy/GDPR review may be required.');
  }
  if (!intake.hasHumanApproval) {
    risks.push('Human approval status was not provided in the intake. Confirm reviewer ownership before client delivery.');
  }
  if (arrayValue(score.improvements).some(item => /legal|transparency|red-team|mcp/i.test(JSON.stringify(item)))) {
    risks.push('Open improvement items include governance, legal, transparency, MCP, or red-team follow-up.');
  }

  return risks.length ? risks : ['No major handoff risks detected from available scan and intake data.'];
}

function aiActSummary(intake: ClientReportHtmlInput['intake']) {
  const notes = [
    intake.usedInEU ? 'EU use indicated' : 'EU use needs confirmation',
    intake.generatesUserFacingContent ? 'user-facing AI output indicated' : 'user-facing AI output needs confirmation',
    intake.handlesPersonalData ? 'personal data handling indicated' : 'personal data handling needs confirmation',
  ];

  return `${notes.join('; ')}. This is a preliminary product-side pre-screen, not legal advice.`;
}

function testingSummary(score: Record<string, unknown>) {
  const quality = arrayValue(score.categories).map(asRecord).find(category => /build|test|quality/i.test(stringValue(category.name) || ''));
  const qualityText = quality ? ` Current quality signal: ${numeric(quality.earned)}/${numeric(quality.max)}.` : '';
  return `ShipSeal generates 30 eval tests, 10 red-team prompts, and a client-readable testing strategy.${qualityText}`;
}

function mcpSummary(score: Record<string, unknown>) {
  const mcp = asRecord(score.mcpReadiness);
  const status = stringValue(mcp.status) || stringValue(asRecord(score.repoContextPack).mcpStatus) || 'Not detected';
  const summary = stringValue(mcp.summary);
  const displayStatus = displayMcpReadiness(status);

  if (summary) {
    return `${summary} MCP readiness is a separate governance dimension and does not mean production-ready status. High-risk MCP categories require human approval.`;
  }

  return `MCP readiness status: ${displayStatus}. MCP readiness is a separate governance dimension and does not mean production-ready status. Review MCP allowlist, server recommendations, security policy, and human approval before enabling high-risk tools.`;
}

function scanSummaryText(scanSummaryValue: unknown) {
  const scan = asRecord(scanSummaryValue);
  const filesAnalyzed = typeof scan.filesAnalyzed === 'number' ? scan.filesAnalyzed : undefined;
  const totalFiles = typeof scan.totalFilesFound === 'number' ? scan.totalFilesFound : undefined;
  const warnings = arrayValue(scan.warnings).length;
  const scanMode = isLimitedScan(scanSummaryValue) ? 'Limited scan' : 'Full scan';

  if (totalFiles || filesAnalyzed) {
    return `${scanMode}: ${filesAnalyzed ?? 'unknown'} files analyzed out of ${totalFiles ?? 'unknown'} discovered files. Warnings: ${warnings}.`;
  }

  return 'Scan summary was not provided.';
}

function isLimitedScan(scanSummaryValue: unknown) {
  const scan = asRecord(scanSummaryValue);
  return scan.limited === true || stringValue(scan.scanMode) === 'limited-fallback';
}

function limitedScanWarning(scanSummaryValue: unknown) {
  const scan = asRecord(scanSummaryValue);
  const warning = arrayValue(scan.warnings).map(value => String(value)).find(value => /limited scan|fallback scan|ZIP parsing failed/i.test(value));
  return warning || 'Limited scan: ShipSeal could not fully parse the repository. Do not treat this as a complete client handoff audit.';
}

function renderList(values: string[]) {
  return `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
}

function badgeClass(value: string) {
  if (/^go$/i.test(value)) return 'go';
  if (/no-go/i.test(value)) return 'no-go';
  return 'conditional';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function displayMcpReadiness(status: string) {
  if (/Enterprise MCP Ready/i.test(status)) return 'MCP Governance Ready';
  if (/MCP Ready/i.test(status)) return 'Strong MCP readiness signal';
  return status;
}

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
      --ink: #142033;
      --muted: #667085;
      --line: #d7deea;
      --soft: #f6f8fc;
      --brand: #1d5cff;
      --brand-dark: #08245f;
      --brand-mid: #0b3b94;
      --warm: #f8efe1;
      --success: #067647;
      --warning: #b54708;
      --danger: #b42318;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #e8edf5;
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.42;
    }

    .page {
      width: min(100%, 980px);
      margin: 32px auto;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.15);
    }

    header {
      padding: 28px 36px 22px;
      border-bottom: 1px solid #cbd7ec;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(29,92,255,0.16) 54%, rgba(8,36,95,0.18) 100%),
        linear-gradient(145deg, #071b49 0%, #0b3b94 58%, #155eef 100%);
      color: #fff;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .brand {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .brand-lockup {
      display: block;
    }

    .brand-name {
      font-weight: 900;
      letter-spacing: 0;
      color: #fff;
      font-size: 16px;
      text-transform: uppercase;
    }

    .eyebrow {
      color: rgba(255,255,255,0.76);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0;
      font-weight: 700;
    }

    h1 {
      font-size: 33px;
      line-height: 1.12;
      margin: 6px 0 8px;
      letter-spacing: 0;
      max-width: 780px;
    }

    h2 {
      font-size: 19px;
      margin: 0 0 10px;
      letter-spacing: 0;
    }

    h3 {
      font-size: 15px;
      margin: 0 0 8px;
    }

    p { margin: 0 0 8px; }

    main { padding: 22px 36px 24px; }

    section {
      margin: 0 0 15px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .meta-grid,
    .score-grid,
    .two-grid,
    .three-grid {
      display: grid;
      gap: 10px;
    }

    .meta-grid { grid-template-columns: repeat(4, 1fr); margin-top: 16px; }
    .score-grid { grid-template-columns: 1.45fr 1fr 1.2fr 0.65fr; margin-top: 10px; }
    .two-grid { grid-template-columns: repeat(2, 1fr); }
    .three-grid { grid-template-columns: repeat(3, 1fr); }

    .card {
      border: 1px solid var(--line);
      background: var(--soft);
      border-radius: 8px;
      padding: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
      overflow-wrap: anywhere;
    }

    header .card {
      border-color: rgba(255,255,255,0.22);
      background: rgba(255,255,255,0.12);
      color: #fff;
    }

    header .label,
    header .muted {
      color: rgba(255,255,255,0.74);
    }

    .score-card {
      background: #ffffff;
      color: var(--brand-dark);
      border-color: rgba(255,255,255,0.72);
      box-shadow: inset 0 0 0 1px rgba(8,36,95,0.08);
      min-width: 0;
      overflow: hidden;
    }

    .score-value {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 5px;
      width: 100%;
      max-width: 100%;
      white-space: nowrap;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0;
      margin-top: 2px;
      overflow-wrap: normal;
      word-break: keep-all;
      overflow: hidden;
    }

    .score-number {
      display: inline-block;
      flex: 0 0 auto;
      font-size: 42px;
      line-height: 0.95;
      color: var(--brand-dark);
      white-space: nowrap;
    }

    .score-denominator {
      display: inline-block;
      flex: 0 0 auto;
      font-size: 16px;
      font-weight: 800;
      color: #5270a4;
      white-space: nowrap;
    }

    .score-text {
      font-size: 26px;
      line-height: 1;
      color: var(--brand-dark);
      white-space: nowrap;
    }

    .label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .score-card .label { color: #62749a; }

    .decision-card {
      background: #f9fbff;
      color: var(--ink);
      border-color: rgba(255,255,255,0.72);
    }

    .package-card {
      background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
      color: var(--ink);
      border-color: rgba(255,255,255,0.72);
    }

    .output-card {
      color: var(--ink);
      background: var(--warm);
      border-color: rgba(255,255,255,0.72);
    }

    .decision-card .muted,
    .package-card .muted,
    .output-card .muted {
      color: var(--muted);
    }

    .output-card strong {
      font-size: 22px;
    }

    ul {
      padding-left: 18px;
      margin: 0;
    }

    li {
      margin: 0 0 5px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

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
      gap: 10px;
    }

    .disclaimer {
      border-top: 1px solid var(--line);
      padding: 10px 12px 0;
      color: var(--muted);
      font-size: 11.5px;
      background: linear-gradient(180deg, #fbfcff 0%, #f6f8fc 100%);
      border-radius: 8px 8px 0 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .muted { color: var(--muted); }
    .small { font-size: 12px; }
    .compact { font-size: 13px; }
    .section-kicker {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .file-list {
      columns: 2;
      column-gap: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }

    .manifest-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      margin-top: 8px;
    }

    .manifest-group {
      border: 1px solid #dce4f2;
      background: #fbfcff;
      border-radius: 8px;
      padding: 8px 9px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .manifest-title {
      color: var(--brand-mid);
      font-size: 11px;
      font-weight: 800;
      margin-bottom: 5px;
    }

    .manifest-list {
      list-style: none;
      padding-left: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12.2px;
      line-height: 1.3;
      color: #24324a;
      overflow-wrap: anywhere;
    }
    .warning {
      border: 1px solid #fedf89;
      background: #fffaeb;
      color: var(--warning);
      border-radius: 8px;
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
        border-radius: 0;
        box-shadow: none;
      }
      header { padding: 18px 22px 16px; }
      main { padding: 16px 0 0; }
      section { margin-bottom: 12px; }
      .card { border-color: #cfd7e3; padding: 10px; }
      .avoid-break, .card, section {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .manifest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    }

    @media (max-width: 760px) {
      .page { margin: 0; border-left: 0; border-right: 0; }
      header, main { padding-left: 22px; padding-right: 22px; }
      .brand, .meta-grid, .score-grid, .two-grid, .three-grid, .roadmap, .manifest-grid { grid-template-columns: 1fr; display: grid; }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="brand">
        <div class="brand-lockup">
          <div class="brand-name">SHIPSEAL</div>
          <div class="eyebrow">Sealed Delivery Pack Report</div>
        </div>
        <div class="small muted">Generated ${escapeHtml(summary.generatedTimestamp)}</div>
      </div>
      <h1>${escapeHtml(summary.projectName)}</h1>
      <p class="muted">AI Project Delivery Pack readiness report for client handover and further expert review.</p>
      <div class="meta-grid">
        <div class="card"><div class="label">Client</div>${escapeHtml(summary.clientName)}</div>
        <div class="card"><div class="label">Agency</div>${escapeHtml(summary.agencyName)}</div>
        <div class="card"><div class="label">Repository</div>${escapeHtml(summary.repositoryName)}</div>
        <div class="card"><div class="label">Branch / ref</div>${escapeHtml(summary.branchOrRef)}</div>
      </div>
      <div class="score-grid">
        <div class="card score-card">
          <div class="label">Readiness score</div>
          ${renderScore(summary.score)}
        </div>
        <div class="card decision-card">
          <div class="label">Readiness decision</div>
          <strong>${escapeHtml(summary.status)}</strong>
          <div class="small muted">${escapeHtml(summary.goNoGo)}</div>
        </div>
        <div class="card package-card">
          <div class="label">Selected package</div>
          <strong>${escapeHtml(summary.selectedGoal)}</strong>
        </div>
        <div class="card output-card"><div class="label">Outputs</div><strong>${escapeHtml(summary.generatedOutputCount)}</strong></div>
      </div>
    </header>

    <main>
      <section>
        <h2>Executive summary</h2>
        <p>${escapeHtml(summary.projectName)} was reviewed with ShipSeal to prepare an AI project delivery package. ${escapeHtml(executiveSummaryLead(summary))}</p>
        <p class="muted">Selected package: ${escapeHtml(summary.selectedGoal)}. ${escapeHtml(summary.selectedGoalSummary)} Generated outputs: ${escapeHtml(summary.generatedOutputCount)}.</p>
        <p class="muted">${escapeHtml(summary.scanSummary)}</p>
        <p class="muted">${escapeHtml(summary.scanEvidenceSummary)}</p>
        ${summary.intakeNote ? `<p class="muted">${escapeHtml(summary.intakeNote)}</p>` : ''}
        ${summary.scanLimited ? `<p class="warning">${escapeHtml(summary.scanWarning)}</p>` : ''}
      </section>

      <section class="two-grid avoid-break">
        <div class="card">
          <h3>Main strengths</h3>
          ${renderList(summary.strengths)}
        </div>
        <div class="card">
          <h3>Main risks</h3>
          ${renderList(summary.risks)}
        </div>
      </section>

      <section class="two-grid avoid-break">
        <div class="card">
          <div class="section-kicker">Selected package focus</div>
          <h3>${escapeHtml(summary.packageFocusTitle)}</h3>
          ${renderList(summary.packageFocusItems)}
        </div>
        <div class="card">
          <div class="section-kicker">Package checklist</div>
          <h3>${escapeHtml(summary.packageChecklistTitle)}</h3>
          ${renderList(summary.packageChecklistItems)}
        </div>
      </section>

      <section class="three-grid avoid-break">
        <div class="card">
          <h3>AI Act readiness pre-screen</h3>
          <p class="compact">${escapeHtml(summary.aiActSummary)}</p>
        </div>
        <div class="card">
          <h3>Testing and eval summary</h3>
          <p class="compact">${escapeHtml(summary.testingSummary)}</p>
        </div>
        <div class="card">
          <h3>MCP governance summary</h3>
          <p class="compact">${escapeHtml(summary.mcpSummary)}</p>
        </div>
      </section>

      <section>
        <h2>Recommended next actions</h2>
        ${renderList(summary.nextActions)}
      </section>

      <section>
        <h2>Generated file list</h2>
        <p class="muted small">This list matches the selected package outputs recorded in score.json and used for the Delivery Pack ZIP.</p>
        ${renderGeneratedFiles(summary.generatedFiles)}
      </section>

      <section class="avoid-break">
        <h2>30/60/90 day next steps roadmap</h2>
        <div class="roadmap">
          <div class="card">
            <h3>30 days</h3>
            <ul>
              <li>Review the readiness decision with the client owner.</li>
              <li>Confirm reviewer ownership and accepted risks.</li>
            </ul>
          </div>
          <div class="card">
            <h3>60 days</h3>
            <ul>
              <li>Close priority documentation or safety gaps.</li>
              <li>Turn repeated checks into quality gates.</li>
            </ul>
          </div>
          <div class="card">
            <h3>90 days</h3>
            <ul>
              <li>Re-run ShipSeal after remediation.</li>
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
  const generatedAt = input.generatedAt ? new Date(input.generatedAt) : dateFromScore(score.scanTimestamp) || new Date();
  const blockerCount = arrayValue(score.criticalBlockers).length;
  const isReady = typeof score.isReady === 'boolean' ? score.isReady : false;
  const focusContent = packageFocus(score, input.intake);
  const checklistContent = packageChecklist(score, input.intake);
  const goNoGo = blockerCount > 0
    ? 'No-Go'
    : isReady && input.intake.hasHumanApproval
      ? 'Go'
      : isReady
        ? 'Conditional Go'
        : 'Remediation';

  return {
    projectName: intake.projectName || stringValue(score.repositoryName) || 'Not provided',
    clientName: intake.clientName?.trim() || 'To be completed before final delivery',
    agencyName: intake.agencyName?.trim() || 'To be completed before final delivery',
    generatedDate: generatedAt.toLocaleDateString('en-GB'),
    generatedTimestamp: formatTimestamp(generatedAt),
    score: typeof score.score === 'number' ? `${score.score}/100` : 'Not detected',
    status: stringValue(score.status) || 'Not detected',
    goNoGo,
    repositoryName: stringValue(score.repositoryName) || intake.projectName || 'Not detected',
    branchOrRef: branchOrRef(score),
    selectedGoalId: selectedGoalId(score),
    selectedGoal: selectedGoalLabel(score),
    selectedGoalSummary: selectedGoalSummary(score),
    generatedOutputCount: outputCount(score),
    generatedFiles: generatedFiles(score),
    packageFocusTitle: focusContent.title,
    packageFocusItems: focusContent.items,
    packageChecklistTitle: checklistContent.title,
    packageChecklistItems: checklistContent.items,
    intakeNote: intakeCompletenessNote(input.intake),
    scanSummary: scanSummaryText(score.scanSummary),
    scanEvidenceSummary: scanEvidenceText(score.scanEvidence),
    scanLimited: isLimitedScan(score.scanSummary),
    scanWarning: limitedScanWarning(score.scanSummary),
    strengths: strengthsFromScore(score),
    risks: risksFromScore(score, input.intake),
    nextActions: nextActionsFromScore(score, input.intake),
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

function selectedGoalLabel(score: Record<string, unknown>) {
  const focus = asRecord(score.deliveryPackFocus);
  return stringValue(focus.packageLabel) || 'Full ShipSeal package';
}

function selectedGoalId(score: Record<string, unknown>) {
  const focus = asRecord(score.deliveryPackFocus);
  const selectedGoals = arrayValue(focus.selectedGoals).map(asRecord);
  return stringValue(selectedGoals[0]?.id) || 'full-package';
}

function selectedGoalSummary(score: Record<string, unknown>) {
  const focus = asRecord(score.deliveryPackFocus);
  return stringValue(focus.packageSummary) || 'Full ShipSeal outputs prepared.';
}

function generatedFiles(score: Record<string, unknown>) {
  const focus = asRecord(score.deliveryPackFocus);
  const focusFiles = arrayValue(focus.generatedFiles).map(value => String(value));
  const rootFiles = arrayValue(score.generatedFiles).map(value => String(value));
  const files = focusFiles.length ? focusFiles : rootFiles;
  return files.length ? files : ['score.json'];
}

function outputCount(score: Record<string, unknown>) {
  const focus = asRecord(score.deliveryPackFocus);
  if (typeof focus.outputCount === 'number') return focus.outputCount;
  if (typeof score.outputCount === 'number') return score.outputCount;
  return generatedFiles(score).length;
}

function branchOrRef(score: Record<string, unknown>) {
  const evidence = asRecord(score.scanEvidence);
  const source = asRecord(score.source);
  return stringValue(evidence.branchOrRef) || stringValue(source.githubBranch) || stringValue(source.githubDefaultBranch) || 'default ref';
}

function intakeCompletenessNote(intake: ClientReportHtmlInput['intake']) {
  const missing = [
    ['client', intake.clientName],
    ['agency', intake.agencyName],
    ['app description', intake.appDescription],
    ['AI use case', intake.aiUseCase],
  ].filter(([, value]) => typeof value !== 'string' || !value.trim()).map(([label]) => label);
  const missingClientOrAgency = missing.includes('client') || missing.includes('agency');

  if (!missing.length) return '';
  if (missingClientOrAgency) {
    return `Client and agency fields can be completed before final delivery. Missing project context: ${missing.join(', ')}.`;
  }
  return `Some project context can be completed before final delivery: ${missing.join(', ')}.`;
}

function executiveSummaryLead(summary: ClientReportSummary) {
  if (summary.selectedGoalId === 'safety-risk') {
    return 'This security/data pre-screen emphasizes risk summary, env/secrets signals, privacy/data handling, human approval, and reviewer ownership.';
  }
  if (summary.selectedGoalId === 'client-handoff') {
    return 'This client handoff report emphasizes the executive summary, readiness decision, roadmap, and delivery manifest.';
  }
  return 'This Full ShipSeal overview summarizes readiness score, scan evidence, risks, strengths, next actions, and the generated Delivery Pack outputs.';
}

function packageFocus(score: Record<string, unknown>, intake: ClientReportHtmlInput['intake']) {
  const goalId = selectedGoalId(score);
  const evidence = asRecord(score.scanEvidence);
  const keyFiles = asRecord(evidence.keyFilesFound);

  if (goalId === 'safety-risk') {
    return {
      title: 'Security/data risk summary',
      items: [
        keyFiles.envExample === true ? 'Env/secrets: .env example found for safer configuration handoff.' : 'Env/secrets: sample file was not confirmed in scan evidence.',
        intake.handlesPersonalData ? 'Personal data handling is indicated; privacy/GDPR review ownership should be confirmed.' : 'Personal data handling needs confirmation before final delivery.',
        intake.hasHumanApproval ? 'Human approval is indicated in intake.' : 'Human approval and reviewer ownership need confirmation.',
        'Review generated MCP security policy, tool allowlist, AI Act checklist, and legal review questions before production use.',
      ],
    };
  }

  if (goalId === 'client-handoff') {
    return {
      title: 'Client handoff priorities',
      items: [
        `Readiness decision: ${stringValue(score.status) || 'Not detected'} (${goNoGoText(score, intake)}).`,
        'Use the executive summary and 30/60/90 roadmap to align client owner, agency, and reviewer next steps.',
        `Delivery manifest: ${outputCount(score)} generated outputs are listed in this report and score.json.`,
        'Complete client and agency fields before final delivery if they are still blank.',
      ],
    };
  }

  return {
    title: 'Full ShipSeal overview',
    items: [
      'Broad review across client handoff, AI-agent readiness, testing, safety, MCP, and AI Act/transparency readiness.',
      `Delivery manifest: ${outputCount(score)} generated outputs for the selected package.`,
      'Use strengths, risks, next actions, scan evidence, and generated files together before sharing externally.',
    ],
  };
}

function packageChecklist(score: Record<string, unknown>, intake: ClientReportHtmlInput['intake']) {
  const goalId = selectedGoalId(score);

  if (goalId === 'safety-risk') {
    return {
      title: 'Privacy and reviewer checklist',
      items: [
        intake.handlesPersonalData ? 'Data/privacy checklist required before production use.' : 'Confirm whether personal, sensitive, or client data is handled.',
        intake.usedInEU || intake.generatesUserFacingContent ? 'Review transparency, AI Act, and disclosure notes.' : 'Confirm EU use and user-facing AI output before final delivery.',
        intake.hasHumanApproval ? 'Record the human reviewer owner in delivery notes.' : 'Assign a human reviewer owner before client handoff.',
        'Document accepted risks and any required legal/security review follow-up.',
      ],
    };
  }

  if (goalId === 'client-handoff') {
    return {
      title: 'Delivery manifest review',
      items: [
        'Confirm the generated output list matches the Delivery Pack ZIP.',
        'Review the client handoff report and executive summary for client-safe wording.',
        'Confirm readiness decision and roadmap ownership with the client owner.',
      ],
    };
  }

  return {
    title: 'Broad package review',
    items: [
      'Review the generated output list before sharing the ZIP.',
      'Confirm high-risk security, privacy, MCP, and legal-adjacent notes with qualified owners.',
      'Re-run ShipSeal after material remediation or scope changes.',
    ],
  };
}

function goNoGoText(score: Record<string, unknown>, intake: ClientReportHtmlInput['intake']) {
  const blockerCount = arrayValue(score.criticalBlockers).length;
  const isReady = typeof score.isReady === 'boolean' ? score.isReady : false;
  if (blockerCount > 0) return 'No-Go';
  if (isReady && intake.hasHumanApproval) return 'Go';
  if (isReady) return 'Conditional Go';
  return 'Remediation';
}

function strengthsFromScore(score: Record<string, unknown>) {
  const categories = arrayValue(score.categories).map(asRecord);
  const evidence = asRecord(score.scanEvidence);
  const keyFiles = asRecord(evidence.keyFilesFound);
  const strengths = categories
    .filter(category => numeric(category.earned) >= numeric(category.max) * 0.7 && numeric(category.max) > 0)
    .slice(0, 4)
    .map(category => `${stringValue(category.name) || 'Readiness area'} has a strong scan signal (${numeric(category.earned)}/${numeric(category.max)}).`);

  if (outputCount(score)) {
    strengths.push(`ShipSeal Delivery Pack manifest outputs detected: ${outputCount(score)}.`);
  }
  if (keyFiles.readme === true) strengths.push('README found in the scanned repository.');
  if (keyFiles.packageJson === true) strengths.push('package.json found with project metadata and scripts.');
  if (keyFiles.ciConfig === true) strengths.push('CI workflow configuration found.');
  if (keyFiles.tests === true) strengths.push('Test files found.');
  if (keyFiles.gitignore === true) strengths.push('.gitignore found for generated or local files.');

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

function nextActionsFromScore(score: Record<string, unknown>, intake: ClientReportHtmlInput['intake']) {
  const actions = arrayValue(score.improvements)
    .map(asRecord)
    .map(improvement => stringValue(improvement.title) || stringValue(improvement.detail))
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);

  if (isLimitedScan(score.scanSummary)) {
    actions.unshift('Re-run ShipSeal with a valid repository ZIP or GitHub import before final handoff.');
  }
  if (!intake.clientName?.trim() || !intake.agencyName?.trim()) {
    actions.push('Complete client and agency fields before final delivery.');
  }
  actions.push('Review the generated Delivery Pack files with the client owner before sharing externally.');

  return uniqueStrings(actions).slice(0, 6);
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

function scanEvidenceText(scanEvidenceValue: unknown) {
  const evidence = asRecord(scanEvidenceValue);
  const source = stringValue(evidence.sourceType) || 'unknown source';
  const repository = stringValue(evidence.repositoryFullName) || 'unknown repository';
  const branch = stringValue(evidence.branchOrRef) || 'default ref';
  const discovered = typeof evidence.discoveredFileCount === 'number' ? evidence.discoveredFileCount : 'unknown';
  const analyzed = typeof evidence.analyzedFileCount === 'number' ? evidence.analyzedFileCount : 'unknown';
  const warnings = typeof evidence.warningCount === 'number' ? evidence.warningCount : 0;
  return `Scan evidence: ${source} archive for ${repository} @ ${branch}; ${analyzed} analyzed files out of ${discovered} discovered files; warnings: ${warnings}. ShipSeal did not execute repository code.`;
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

function renderScore(score: string) {
  const match = score.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) {
    return `<div class="score-value"><span class="score-text">${escapeHtml(score)}</span></div>`;
  }

  return [
    '<div class="score-value" aria-label="Readiness score">',
    `<span class="score-number">${escapeHtml(match[1])}</span>`,
    `<span class="score-denominator">/${escapeHtml(match[2])}</span>`,
    '</div>',
  ].join('');
}

function renderGeneratedFiles(files: string[]) {
  const groups = groupGeneratedFiles(files);
  return [
    '<div class="manifest-grid">',
    ...groups.map(group => [
      '<div class="manifest-group">',
      `<div class="manifest-title">${escapeHtml(group.title)}</div>`,
      renderList(group.files, 'manifest-list'),
      '</div>',
    ].join('')),
    '</div>',
  ].join('');
}

function groupGeneratedFiles(files: string[]) {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const key = file.includes('/') ? file.split('/')[0] : 'root';
    groups.set(key, [...(groups.get(key) || []), file]);
  }

  return Array.from(groups.entries()).map(([key, groupFiles]) => ({
    title: manifestGroupTitle(key),
    files: groupFiles,
  }));
}

function manifestGroupTitle(folder: string) {
  const labels: Record<string, string> = {
    root: 'Root metadata',
    '01-agent-instructions': 'Agent instructions',
    '02-skills': 'Skills',
    '03-mcp-governance': 'MCP governance',
    '04-testing': 'Testing',
    '05-ai-act-readiness': 'AI Act readiness',
    '06-client-handoff': 'Client handoff',
    '07-context': 'Repository context',
  };

  return labels[folder] || folder;
}

function renderList(values: string[], className?: string) {
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : '';
  return `<ul${classAttribute}>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
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

function dateFromScore(value: unknown) {
  const text = stringValue(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatTimestamp(value: Date) {
  if (Number.isNaN(value.getTime())) return 'Not detected';
  return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

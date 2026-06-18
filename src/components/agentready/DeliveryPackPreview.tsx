import { Download, FileArchive, FileText, ShieldCheck, TestTube2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReadinessReport } from '@/lib/types';
import type { PartialProjectIntake } from '@/lib/intake';
import { normalizeProjectIntake } from '@/lib/intake';
import { buildRepoContextPackJson, buildScoreJson, downloadAgentPackZip } from '@/lib/exports';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { downloadClientReportPdf, generateClientReportHtml } from '@/lib/report';
import { toast } from '@/hooks/use-toast';

interface Props {
  report: ReadinessReport;
  intake?: PartialProjectIntake;
  intakeSkipped?: boolean;
  selectedPackages?: string[];
}

export function DeliveryPackPreview({ report, intake, intakeSkipped = false, selectedPackages = [] }: Props) {
  const normalizedIntake = normalizeProjectIntake(intake, report.repoName);
  const focus = resolveDeliveryPackFocus(selectedPackages);
  const generatedPaths = focus.generatedPaths;
  const scoreJson = buildScoreJson(report, { selectedPackages });
  const limitedScan = report.scanSummary.limited || report.scanSummary.scanMode === 'limited-fallback';
  const risks = previewRisks(report, normalizedIntake);
  const goNoGo = goNoGoCategory(report, normalizedIntake);
  const aiActStatus = aiActStatusText(normalizedIntake);
  const testingStatus = testingStatusText(report);
  const clientHandoffStatus = clientHandoffStatusText(normalizedIntake);

  return (
    <div className="glass rounded-2xl p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <FileArchive className="h-4 w-4 text-primary-glow" />
            <h3 className="font-display font-semibold">ShipSeal Delivery Pack preview</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Review the score, go/no-go signal, risks, and required outputs before downloading the client-ready ZIP.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row lg:flex-col gap-2">
          <Button
            onClick={() => downloadPdfReport(report.repoName, normalizedIntake, scoreJson)}
            className="bg-gradient-primary border-0 shadow-glow hover:opacity-90"
          >
            <Download className="h-4 w-4 mr-2" /> Download PDF report
          </Button>
          <Button
            onClick={() => openPrintReadyReport(report.repoName, normalizedIntake, scoreJson)}
            variant="outline"
            className="border-border/80"
          >
            <FileText className="h-4 w-4 mr-2" /> Open HTML report
          </Button>
          <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">
            PDF uses the standalone client report. If PDF generation fails, open the HTML report and use Print / Save as PDF.
          </p>
          <Button
            onClick={() => downloadAgentPackZip(
              report.repoName,
              report.agentPack,
              report.mcpReadiness.generatedFiles,
              { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
              scoreJson,
              normalizedIntake,
              selectedPackages
            )}
            className="bg-gradient-primary border-0 shadow-glow hover:opacity-90"
          >
            <Download className="h-4 w-4 mr-2" /> Download ShipSeal Delivery Pack
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <PreviewMetric label="ShipSeal score" value={`${report.score}/100`} />
        <PreviewMetric label="Go/no-go category" value={goNoGo} />
        <PreviewMetric label="Selected package" value={focus.packageLabel} />
        <PreviewMetric label="Repository / ref" value={`${report.repoName} @ ${branchOrRef(report)}`} />
        <PreviewMetric label="Output files" value={`${generatedPaths.length} generated`} />
      </div>

      <div className="mb-5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Delivery focus</span>
          {focus.selectedGoals.map(goal => (
            <Badge key={goal.id} variant="outline" className="border-primary/45 bg-background/25 text-[10px]">
              {goal.title}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {focus.fullPackage
            ? 'Full ShipSeal includes every manifest output.'
            : `${generatedPaths.length} focused outputs will be generated for this goal. The score.json export and Delivery Pack ZIP use the same generated file list.`}
        </p>
      </div>

      <div className="mb-5 rounded-lg border border-border/60 bg-secondary/25 px-4 py-3">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Scan evidence</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {scanEvidenceText(report)} ShipSeal did not execute repository code.
        </p>
      </div>

      {intakeSkipped && (
        <div className="mb-5 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          Client and agency fields can be completed before final delivery.
        </div>
      )}

      {limitedScan && (
        <div className="mb-5 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          Limited scan: ZIP parsing failed, so this Delivery Pack should not be presented as a complete client handoff audit.
        </div>
      )}

      {!intakeSkipped && intakeCompletenessWarning(normalizedIntake) && (
        <div className="mb-5 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          Client and agency fields can be completed before final delivery.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <StatusPanel
          icon={<ShieldCheck className="h-4 w-4 text-primary-glow" />}
          title="AI Act readiness"
          badge={normalizedIntake.usedInEU ? 'EU signal' : 'Pre-screen'}
          text={aiActStatus}
        />
        <StatusPanel
          icon={<TestTube2 className="h-4 w-4 text-accent" />}
          title="Testing pack"
          badge="Ready"
          text={testingStatus}
        />
        <StatusPanel
          icon={<UserCheck className="h-4 w-4 text-success" />}
          title="Client handoff"
          badge="Ready"
          text={clientHandoffStatus}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Main risks</div>
          <ul className="space-y-2 text-sm text-foreground/90">
            {risks.map(risk => (
              <li key={risk} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Files included in the Delivery Pack</div>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-auto pr-1">
            {generatedPaths.map(path => (
              <div key={path} className="flex items-center gap-2 rounded border border-border/50 bg-background/35 px-2 py-1">
                {!focus.fullPackage && (
                  <span className="shrink-0 rounded border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary-glow">
                    Included
                  </span>
                )}
                <span className="truncate font-mono text-[11px] text-foreground/85">{path}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function openPrintReadyReport(repositoryName: string, intake: ReturnType<typeof normalizeProjectIntake>, scoreJson: unknown) {
  const html = generateClientReportHtml({ intake, scoreJson });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `shipseal-client-report-${repositoryName}.html`;
    link.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function downloadPdfReport(repositoryName: string, intake: ReturnType<typeof normalizeProjectIntake>, scoreJson: unknown) {
  try {
    await downloadClientReportPdf({ intake, scoreJson }, repositoryName);
  } catch {
    toast({
      title: 'PDF generation failed',
      description: 'PDF generation failed. Open the HTML report and use Print / Save as PDF.',
      variant: 'destructive',
    });
  }
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-3 min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold truncate">{value || 'Not detected'}</div>
    </div>
  );
}

function StatusPanel({ icon, title, badge, text }: { icon: React.ReactNode; title: string; badge: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="font-display font-semibold text-sm">{title}</div>
        <Badge variant="outline" className="ml-auto text-[10px] border-border/70">{badge}</Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function goNoGoCategory(report: ReadinessReport, intake: ReturnType<typeof normalizeProjectIntake>) {
  if (report.blockers.length > 0) return 'No-Go';
  if (report.isReady && intake.hasHumanApproval) return 'Go';
  if (report.isReady) return 'Conditional Go';
  return 'Remediation';
}

function previewRisks(report: ReadinessReport, intake: ReturnType<typeof normalizeProjectIntake>) {
  const risks = report.blockers.slice(0, 4).map(blocker => blocker.title || 'Critical blocker');
  if (intake.handlesPersonalData) risks.push('Personal data review may be needed');
  if (intake.usedInEU && intake.generatesUserFacingContent) risks.push('Transparency notice recommended');
  if (!intake.hasHumanApproval) risks.push('Human approval status unknown');
  return risks.length ? risks : ['No major risks detected from available scan and intake data'];
}

function aiActStatusText(intake: ReturnType<typeof normalizeProjectIntake>) {
  if (intake.usedInEU && intake.generatesUserFacingContent) return 'EU use and user-facing AI output detected; transparency notice review is recommended.';
  if (intake.handlesPersonalData) return 'Personal data signal detected; privacy/GDPR review may be needed.';
  return 'Pre-screen generated with available intake data.';
}

function testingStatusText(report: ReadinessReport) {
  const quality = report.categories.find(category => /build|test|quality/i.test(category.name));
  if (quality) return `Testing strategy, eval cases, and red-team prompts are generated. Quality signal: ${quality.earned}/${quality.max}.`;
  return 'Testing strategy, eval cases, and red-team prompts are generated.';
}

function clientHandoffStatusText(intake: ReturnType<typeof normalizeProjectIntake>) {
  const client = intake.clientName?.trim() || 'final delivery';
  return `Client handoff report, executive summary, and 30/60/90 roadmap are ready for ${client}.`;
}

function intakeCompletenessWarning(intake: ReturnType<typeof normalizeProjectIntake>) {
  const requiredText = [
    intake.clientName,
    intake.agencyName,
    intake.appDescription,
    intake.targetUsers,
    intake.aiUseCase,
  ];
  const missingText = requiredText.some(value => !value?.trim());
  const missingRiskSignals = !intake.usedInEU && !intake.handlesPersonalData && !intake.generatesUserFacingContent && !intake.hasHumanApproval;

  return missingText || missingRiskSignals;
}

function branchOrRef(report: ReadinessReport) {
  return report.scanEvidence.branchOrRef || report.source.githubBranch || report.source.githubDefaultBranch || 'default ref';
}

function scanEvidenceText(report: ReadinessReport) {
  const evidence = report.scanEvidence;
  return `${evidence.sourceType} archive for ${evidence.repositoryFullName || report.repoName} @ ${branchOrRef(report)}; ${evidence.analyzedFileCount} analyzed files out of ${evidence.discoveredFileCount} discovered files; ${evidence.ignoredFileCount} ignored files.`;
}

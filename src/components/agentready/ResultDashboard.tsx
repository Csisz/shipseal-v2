import { useEffect, useState } from 'react';
import type React from 'react';
import { AlertOctagon, Check, CheckCircle2, Copy, Download, FileArchive, Layers, Lightbulb, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { AgentOperatingModeId, AgentPackFile, MCPRiskSeverity, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { evaluateReadiness } from '@/lib/scoring';
import { ScoreGauge } from './ScoreGauge';
import { ReadinessBadge } from './ReadinessBadge';
import { CategoryBreakdown } from './CategoryBreakdown';
import { AgentPackTabs } from './AgentPackTabs';
import { ProjectIntakeForm } from './ProjectIntakeForm';
import { DeliveryPackPreview } from './DeliveryPackPreview';
import { SuggestedReadinessFixPack } from './SuggestedReadinessFixPack';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildRepoContextPackJson, buildScoreJson, downloadJsonFile, downloadTextFile } from '@/lib/exports';
import { formatFileSize } from '@/lib/uploadValidation';
import { criticalBlockersEmptyStateText, displayReadinessLevel, readinessStatusMessageForPackage } from '@/lib/uiCopy';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake, normalizeProjectIntake } from '@/lib/intake';
import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages } from '@/lib/packages';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import type { GitHubConnectionState } from '@/lib/githubConnection/types';
import { DEFAULT_AGENT_OPERATING_MODE, applyAgentOperatingModeToFiles, getAgentOperatingMode, resolveAgentOperatingMode, selectionUsesAgentDevelopment } from '@/lib/agentOperatingMode';
import { buildToolingRecommendationBundle, recommendationCounts } from '@/lib/toolingRecommendations';

interface Props {
  report: ReadinessReport;
  history: ScanHistoryItem[];
  onReset: () => void;
  onClearHistory: () => void;
  initialIntake?: ProjectIntake;
  intakeSkipped?: boolean;
  /** Package options the user picked before the scan; defaults to the full package. */
  selectedPackages?: string[];
  agentOperatingMode?: AgentOperatingModeId;
  githubConnection?: GitHubConnectionState;
}

type RepositoryHealth = ReadinessReport['repositoryHealth'];
type RepositoryHealthSignal = RepositoryHealth['dimensions']['repositoryIntelligence']['signals'][number];

export function ResultDashboard({ report, history, onReset, onClearHistory, initialIntake, intakeSkipped = false, selectedPackages, agentOperatingMode, githubConnection }: Props) {
  const repositoryHealth = report.repositoryHealth;
  const resolvedPackages = resolveSelectedPackages(selectedPackages ?? []);
  const fullPackageSelected = resolvedPackages.includes(FULL_PACKAGE_ID);
  const folderAgentPaths = getFolderAgentSuggestionPaths(report.repoContextPack);
  const deliveryFocus = resolveDeliveryPackFocus(resolvedPackages, { folderAgentPaths });
  const resolvedAgentMode = resolveAgentOperatingMode(agentOperatingMode || report.recommendedAgentOperatingMode || DEFAULT_AGENT_OPERATING_MODE);
  const agentMode = getAgentOperatingMode(resolvedAgentMode);
  const modeAgentPack = applyAgentOperatingModeToFiles(report, resolvedAgentMode);
  const [contextCopied, setContextCopied] = useState(false);
  const [appliedIntake, setAppliedIntake] = useState(() => normalizeProjectIntake(initialIntake, report.repoName));
  const [draftIntake, setDraftIntake] = useState(() => normalizeProjectIntake(initialIntake, report.repoName));
  const [wasIntakeSkipped, setWasIntakeSkipped] = useState(intakeSkipped);
  const readiness = evaluateReadiness(report.score, report.blockers);
  const ready = readiness.isReady;
  const limitedScan = report.scanSummary.limited || report.scanSummary.scanMode === 'limited-fallback';
  const statusMessage = readinessStatusMessageForPackage(readiness.statusMessage, resolvedPackages);
  const limitedScanReason = report.scanEvidence.limitationReason || report.scanSummary.warnings.find(warning => /limited scan|fallback|file limit|archive|GitHub access|ZIP/i.test(warning));
  const readinessReport = report.agentPack.find(file => file.name === 'AGENT_READINESS_REPORT.md');
  const repoContextJson = buildRepoContextPackJson(report);
  const scoreJson = buildScoreJson(report, { selectedPackages: resolvedPackages, agentOperatingMode: resolvedAgentMode });
  const toolingRecommendationCounts = recommendationCounts(buildToolingRecommendationBundle(report));
  const mcpPackFiles: AgentPackFile[] = report.mcpReadiness.generatedFiles.map(file => ({
    name: file.filename,
    language: 'markdown',
    description: 'MCP governance policy generated from this repository scan.',
    content: file.content,
  }));
  const copyContextPack = async () => {
    await navigator.clipboard.writeText(report.contextPack);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 1500);
  };

  useEffect(() => {
    const nextIntake = normalizeProjectIntake(initialIntake, report.repoName);
    setAppliedIntake(nextIntake);
    setDraftIntake(nextIntake);
    setWasIntakeSkipped(intakeSkipped);
  }, [initialIntake, intakeSkipped, report.repoName, report.scannedAt]);

  const intakeDirty = !sameIntake(appliedIntake, draftIntake);
  const regenerateReport = () => {
    setAppliedIntake(normalizeProjectIntake(draftIntake, report.repoName));
    setWasIntakeSkipped(false);
  };
  const clearIntake = () => {
    setDraftIntake(createDefaultProjectIntake(report.repoName));
  };

  return (
    <section className="container py-12 md:py-16 animate-fade-in-up">
      <div className="dashboard-print-warning">
        For a client-ready PDF, use the print-ready report export instead of printing this dashboard.
      </div>

      <RepositoryHealthHero
        report={report}
        limitationReason={limitedScanReason}
        onExportReport={() => readinessReport && downloadTextFile('AGENT_READINESS_REPORT.md', readinessReport.content)}
        onExportScoreJson={() => downloadJsonFile('score.json', buildScoreJson(report, { selectedPackages: resolvedPackages, agentOperatingMode: resolvedAgentMode }))}
        onReset={onReset}
      />

      {repositoryHealth.overall.score !== null && (
        <>
          <RepositoryHealthActions repositoryHealth={repositoryHealth} />
          <RepositoryHealthDimensions repositoryHealth={repositoryHealth} />
        </>
      )}

      <div className="grid gap-6 mb-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <ScanEvidencePanel report={report} />
        <MeasurementBoundary repositoryHealth={repositoryHealth} />
      </div>

      <div className="glass rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Project</span>
              <ReadinessBadge level={readiness.level} size="md" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 truncate">{report.repoName}</h1>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <span><span className="text-foreground/80 font-medium">{report.stack.primary}</span> - {report.stack.languages.join(', ') || 'unknown'}</span>
              <span>{isGitHubSource(report.source.sourceType) ? `GitHub: ${report.source.githubOwner}/${report.source.githubRepo}${report.source.githubBranch ? ` @ ${report.source.githubBranch}` : ''}` : 'ZIP upload'}</span>
              <span>{report.fileCount.toLocaleString()} files</span>
              <span>{(report.totalSizeBytes / 1024).toFixed(0)} KB</span>
              <span>scanned {new Date(report.scannedAt).toLocaleTimeString()}</span>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryTile label="Delivery readiness" value={`${report.score}/100`} />
              <SummaryTile label="Readiness status" value={displayReadinessLevel(readiness.level)} />
              <SummaryTile label="Critical blockers" value={String(report.blockers.length)} />
            </div>
            {readiness.level === 'Partially Ready' && !limitedScan && (
              <div className="mt-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
                Status: Partially Ready. This is a readiness status based on the score, not a limited scan.
              </div>
            )}
            <ProjectPackageSummary
              packageLabel={deliveryFocus.packageLabel}
              outputCount={deliveryFocus.generatedPaths.length}
              packageSummary={deliveryFocus.packageSummary}
              hasContextCompressionPack={deliveryFocus.generatedPaths.includes('07-context/ARCHITECTURE.md')}
              hasFolderAgentSuggestions={deliveryFocus.generatedPaths.some(path => path.startsWith('07-context/folder-agents/'))}
              hasSpecializedContextPacks={deliveryFocus.generatedPaths.includes('07-context/GLOBAL_CONTEXT.md')}
              hasToolingRecommendations={deliveryFocus.generatedPaths.includes('07-context/SKILL_RECOMMENDATIONS.md') || deliveryFocus.generatedPaths.includes('07-context/MCP_RECOMMENDATIONS.md')}
              skillRecommendationCount={toolingRecommendationCounts.skills}
              mcpRecommendationCount={toolingRecommendationCounts.mcpTools}
            />
            {selectionUsesAgentDevelopment(resolvedPackages) && (
              <AgentOperatingModeSummary
                modeLabel={agentMode.label}
                expectedTokenUsage={agentMode.expectedTokenUsage}
                confidence={agentMode.confidence}
                summary={agentMode.summary}
              />
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Selected packages</span>
              {fullPackageSelected ? (
                <Badge variant="outline" className="border-primary/50 bg-primary/10 text-foreground">Full ShipSeal package</Badge>
              ) : (
                resolvedPackages.map(id => {
                  const pack = getShipSealPackage(id);
                  if (!pack) return null;
                  return (
                    <Badge key={id} variant="outline" className="border-primary/40 bg-primary/10 text-foreground">
                      {pack.title}
                    </Badge>
                  );
                })
              )}
              {!fullPackageSelected && (
                <span className="text-[11px] text-muted-foreground">
                  This export is focused on the selected goal. Choose Full ShipSeal package for every output.
                </span>
              )}
            </div>

            <div className={`mt-6 rounded-2xl p-5 border ${ready ? 'bg-success/10 border-success/30' : report.blockers.length ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30'}`}>
              <div className="flex items-start gap-3">
                {ready ? <Sparkles className="h-5 w-5 text-success mt-0.5" /> : <AlertOctagon className="h-5 w-5 text-destructive mt-0.5" />}
                <div>
                  <div className="font-display font-semibold text-lg">{statusMessage}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {ready
                      ? 'This project is ready for a controlled AI handoff. Download the ShipSeal Delivery Pack and review it with the client before production use.'
                      : 'Resolve the risks below before treating this project as ready for client handoff.'}
                  </div>
                </div>
              </div>
            </div>
            {limitedScan && (
              <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
                <div className="font-semibold">Limited scan</div>
                <div className="mt-1 text-warning/90">
                  {limitedScanReason || 'ShipSeal could not fully analyze this repository, so the report is based on limited scan data.'}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-3 lg:w-64">
            <div className="rounded-2xl border border-border/60 bg-secondary/25 p-4 text-sm leading-relaxed text-muted-foreground">
              Repository Health reflects the scanned repository before ShipSeal-generated improvements are applied.
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => readinessReport && downloadTextFile('AGENT_READINESS_REPORT.md', readinessReport.content)}
                className="border-border/60"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadJsonFile('score.json', buildScoreJson(report, { selectedPackages: resolvedPackages, agentOperatingMode: resolvedAgentMode }))}
                className="border-border/60"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export score.json
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={onReset} className="border-border/60">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Scan another project
            </Button>
          </div>
        </div>
      </div>

      <Disclosure title="Technical readiness details">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
            <ScoreGauge score={report.score} size={200} label="delivery / 100" />
            <div className="mt-3 text-center text-sm text-muted-foreground">
              Supporting delivery and verification score. Repository Health is the primary dashboard summary above.
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold mb-4">Delivery readiness categories</h2>
            <CategoryBreakdown categories={report.categories} />
          </div>
        </div>
      </Disclosure>

      <div className="mb-8">
        <DecisionSummary report={report} ready={ready} nextActions={report.aiNarrative.nextBestActions.slice(0, 3)} />
      </div>

      <DeliveryPackPreview report={report} agentFiles={modeAgentPack} intake={appliedIntake} intakeSkipped={wasIntakeSkipped} selectedPackages={resolvedPackages} agentOperatingMode={resolvedAgentMode} />

      <Disclosure title="Project context used for this report" defaultOpen={wasIntakeSkipped || intakeDirty}>
        <ProjectContextPanel
          appliedIntake={appliedIntake}
          draftIntake={draftIntake}
          skipped={wasIntakeSkipped}
          dirty={intakeDirty}
          onDraftChange={setDraftIntake}
          onRegenerate={regenerateReport}
          onClear={clearIntake}
        />
      </Disclosure>

      <Disclosure title="Available ShipSeal improvements — optional fixes you can add back">
        <SuggestedReadinessFixPack report={report} githubConnection={githubConnection} selectedPackages={resolvedPackages} />
      </Disclosure>

      <Disclosure title="Advanced details — full scan results and generated files">
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <Sparkles className={ready ? 'h-4 w-4 text-success mt-1' : 'h-4 w-4 text-accent mt-1'} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold">AI Readiness Narrative</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{report.aiNarrative.executiveSummary}</p>
          </div>
          <Badge variant="outline" className={ready ? 'border-success/40 text-success' : 'border-warning/60 text-warning'}>
            Local deterministic provider
          </Badge>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <NarrativePanel title={ready ? 'Why this repo is AI Coding Ready' : 'Why this repo is not AI Coding Ready'} text={report.aiNarrative.readinessExplanation} />
          <NarrativePanel title="Blocker explanation" text={report.aiNarrative.blockerExplanation} />
          <NarrativeList title={ready ? 'Minimum next actions' : 'Minimum path to readiness'} items={report.aiNarrative.nextBestActions} />
          <NarrativeList title={ready ? 'Optional improvements' : 'Improvement priorities'} items={report.aiNarrative.improvementPriorities} />
        </div>
        <div className="mt-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
          {report.aiNarrative.confidenceNote}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <AlertOctagon className="h-4 w-4 text-destructive" />
            <h3 className="font-display font-semibold">Critical blockers</h3>
            <span className="ml-auto text-xs font-mono text-muted-foreground">{report.blockers.length}</span>
          </div>
          {report.blockers.length === 0 ? (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <span>{criticalBlockersEmptyStateText(ready)}</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {report.blockers.map(b => (
                <li key={b.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-sm font-medium text-foreground">{b.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{b.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-accent" />
            <h3 className="font-display font-semibold">Optional improvements</h3>
            <Badge variant="outline" className="border-accent/50 text-accent text-[10px]">Optional</Badge>
            <span className="ml-auto text-xs font-mono text-muted-foreground">{report.improvements.length}</span>
          </div>
          {report.improvements.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-secondary/25 p-3 text-sm text-muted-foreground">No optional improvements are open right now.</div>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-auto pr-1">
              {report.improvements.slice(0, 12).map(i => (
                <li key={i.id} className="text-xs">
                  <div className="text-foreground/90">{i.title}</div>
                  <div className="text-muted-foreground/70">{i.category}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-primary-glow" />
            <h3 className="font-display font-semibold">Detected stack & commands</h3>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Primary" value={report.stack.primary} />
            <Row label="Languages" value={report.stack.languages.join(', ') || '-'} />
            <Row label="Frameworks" value={report.stack.frameworks.join(', ') || '-'} />
            <Row label="Tests" value={report.stack.testFrameworks.join(', ') || '-'} />
            <Row label="Pkg mgr" value={report.summary.packageManager} />
            <Row label="Folders" value={report.summary.keyFolders.join(', ') || '-'} />
            <Row label="Instructions" value={report.summary.instructionFiles.join(', ') || '-'} />
          </div>
          {report.stack.runCommands.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {report.stack.runCommands.map(c => (
                <div key={c.label} className="font-mono text-xs bg-secondary/60 rounded-md px-2.5 py-1.5 flex items-center gap-2">
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span>{c.cmd}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <ShieldCheck className="h-4 w-4 text-success" />
          <h3 className="font-display font-semibold">Scanner safety</h3>
          <Badge variant="outline" className="border-success/40 text-success">No code execution</Badge>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <SafetyMetric label="Total files found" value={report.scanSummary.totalFilesFound.toLocaleString()} />
          <SafetyMetric label="Files analyzed" value={report.scanSummary.filesAnalyzed.toLocaleString()} />
          <SafetyMetric label="Files ignored" value={report.scanSummary.filesIgnored.toLocaleString()} />
          <SafetyMetric label="Readable text analyzed" value={formatFileSize(report.scanSummary.readableTextBytesAnalyzed)} />
          <SafetyMetric label="Generated/vendor ignored" value={report.scanSummary.generatedVendorFilesIgnored.toLocaleString()} />
          <SafetyMetric label="Binary files ignored" value={report.scanSummary.binaryFilesIgnored.toLocaleString()} />
          <SafetyMetric label="Max file count" value={report.scanSummary.limits.maxFileCount.toLocaleString()} />
          <SafetyMetric label="Max ZIP size" value={formatFileSize(report.scanSummary.limits.maxZipSizeBytes)} />
        </div>
        {report.scanSummary.ignoredGeneratedFolders.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            Ignored generated/vendor folders: {report.scanSummary.ignoredGeneratedFolders.join(', ')}
          </div>
        )}
        {report.scanSummary.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-warning">
            {report.scanSummary.warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          Static scan complete: ShipSeal read repository structure and key project files without executing code. It reads metadata, key config/docs/test files, and a safe limited text subset while ignoring generated/vendor folders such as node_modules, dist, build, .next, and coverage.
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
        Delivery readiness categories are available in Technical readiness details above. This advanced section keeps scanner, MCP and generated-file details available without changing the Repository Health score.
      </div>

      <div className="mt-8 glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary-glow" />
          <h3 className="font-display font-semibold">MCP Readiness</h3>
          <Badge variant="outline" className="border-primary/40 text-primary-glow">{displayMcpReadiness(report.mcpReadiness.status)}</Badge>
          <span className="ml-auto font-mono text-sm text-foreground/90">{report.mcpReadiness.score}/100</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          {mcpGovernanceSummary(report)}
        </p>
        {report.mcpReadiness.aiNarrative && (
          <div className="mt-3 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs text-muted-foreground">
            {report.mcpReadiness.aiNarrative.riskNarrative}
          </div>
        )}
        <div className="mt-5 grid lg:grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Recommended server categories</div>
            {report.mcpReadiness.recommendedServerCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground">No MCP server categories recommended until stronger repository signals exist.</div>
            ) : (
              <div className="space-y-2">
                {report.mcpReadiness.recommendedServerCategories.slice(0, 6).map(rec => (
                  <div key={`${rec.category}-${rec.label}`} className="rounded-lg border border-border/60 bg-secondary/25 p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{rec.label}</div>
                      <Badge variant="outline" className="ml-auto border-border/70 text-[10px]">{rec.riskLevel}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{rec.whyUseful}</div>
                    <div className="text-[11px] text-muted-foreground/80 mt-2">{rec.safetyNotes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Risk findings</div>
            {report.mcpReadiness.riskFindings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No MCP-specific risk findings detected.</div>
            ) : (
              <div className="space-y-2">
                {report.mcpReadiness.riskFindings.slice(0, 6).map(finding => (
                  <div key={`${finding.severity}-${finding.title}`} className="rounded-lg border border-border/60 bg-secondary/25 p-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{finding.title}</div>
                      <Badge variant="outline" className={severityClass(finding.severity)}>{finding.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{finding.description}</div>
                    <div className="text-[11px] text-muted-foreground/80 mt-2">{finding.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 text-sm font-medium text-foreground/90">
          ShipSeal readiness remains the primary handoff signal. MCP readiness is a separate governance dimension for tool access and requires human approval for high-risk categories.
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {report.mcpReadiness.generatedFiles.map(file => (
            <div key={file.filename} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground/85">
              {file.filename}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <FileArchive className="h-4 w-4 text-accent shrink-0" />
            <h3 className="font-display font-semibold">Repo Context Pack</h3>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={copyContextPack}>
                {contextCopied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {contextCopied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadTextFile('REPO_CONTEXT_PACK.md', report.contextPack)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> MD
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadJsonFile('repo-context-pack.json', repoContextJson)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> JSON
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Sanitized metadata for future server-side AI or coding-agent context. It excludes raw full file contents and secrets.
          </p>
          <pre className="text-[11px] font-mono leading-relaxed bg-[hsl(240_20%_4%)] rounded-lg p-3 max-h-80 overflow-auto text-foreground/85">
            {report.contextPack}
          </pre>
        </div>
        <div className="lg:col-span-2">
          <h3 className="font-display text-xl font-semibold mb-3">Delivery Pack file preview</h3>
          <AgentPackTabs
            files={modeAgentPack}
            repositoryName={report.repoName}
            mcpFiles={report.mcpReadiness.generatedFiles}
            contextFiles={{ markdown: report.contextPack, json: repoContextJson }}
            scoreJson={scoreJson}
            intake={appliedIntake}
            selectedPackages={resolvedPackages}
          />
          <h3 className="font-display text-xl font-semibold mt-8 mb-3">MCP Governance Pack</h3>
          <AgentPackTabs files={mcpPackFiles} />
        </div>
      </div>

      <RecentScans history={history} onClear={onClearHistory} />
      </Disclosure>
    </section>
  );
}

function RepositoryHealthHero({
  report,
  limitationReason,
  onExportReport,
  onExportScoreJson,
  onReset,
}: {
  report: ReadinessReport;
  limitationReason?: string;
  onExportReport: () => void;
  onExportScoreJson: () => void;
  onReset: () => void;
}) {
  const health = report.repositoryHealth;
  const contextWaste = health.dimensions.contextWaste;
  const topAction = health.topActions[0];
  const unavailable = health.overall.score === null;

  return (
    <section className="glass rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden" aria-labelledby="repository-health-heading">
      <div className="absolute inset-0 bg-gradient-glow opacity-25 pointer-events-none" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository Health</span>
            <Badge variant="outline" className={unavailable ? 'border-warning/60 text-warning' : 'border-primary/45 text-primary-glow'}>
              {health.measurementMethod}
            </Badge>
          </div>
          <h1 id="repository-health-heading" className="font-display text-3xl md:text-5xl font-bold leading-tight">
            {unavailable ? 'Repository Health unavailable' : `${health.overall.score} / 100`}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={repositoryHealthStatusClass(health.overall.status)}>
              {health.overall.status}
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/25">
              {health.overall.confidence} confidence
            </Badge>
          </div>

          {unavailable ? (
            <div className="mt-5 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm leading-relaxed text-warning">
              <p className="font-medium">ShipSeal does not have enough repository evidence to calculate a trustworthy health score.</p>
              <p className="mt-2 text-warning/90">{limitationReason || health.blockers[0]?.detail || 'The scan was limited or synthetic fallback data was used.'}</p>
              <p className="mt-2 text-warning/90">Next action: reconnect GitHub, upload the complete ZIP, or retry the full scan.</p>
            </div>
          ) : (
            <>
              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
                {repositoryHealthSummarySentence(health.overall.status)} Repository Health reflects the scanned repository before ShipSeal-generated improvements are applied.
              </p>
              <div className="mt-5 rounded-2xl border border-border/60 bg-secondary/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Context Waste Risk</span>
                  <Badge variant="outline" className={contextWasteRiskClass(contextWaste.riskScore)}>
                    {contextWaste.riskScore} / 100 - {contextWasteRiskLabel(contextWaste.riskScore)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Higher Context Waste means higher risk. This static estimate is based on generated noise, oversized files, documentation duplication, context anchors and routing clarity.
                </p>
              </div>
            </>
          )}
        </div>

        <aside className="rounded-2xl border border-border/60 bg-secondary/20 p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">How prepared is this repository for efficient and reliable AI-agent work?</div>
          {topAction && !unavailable ? (
            <div className="mt-4">
              <div className="text-sm font-semibold text-foreground">Top improvement</div>
              <div className="mt-1 text-base font-medium leading-snug text-foreground">{topAction.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{topAction.action}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Complete repository evidence is required before ShipSeal can rank improvement actions.
            </p>
          )}
          <div className="mt-5 grid gap-2">
            <Button variant="outline" size="sm" onClick={onExportReport} className="justify-start border-border/60">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export report
            </Button>
            <Button variant="outline" size="sm" onClick={onExportScoreJson} className="justify-start border-border/60">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export score.json
            </Button>
            <Button variant="outline" size="sm" onClick={onReset} className="justify-start border-border/60">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Scan another project
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function RepositoryHealthActions({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
  const actions = repositoryHealth.topActions.slice(0, 5);

  return (
    <section className="mb-8" aria-labelledby="repository-health-actions-heading">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h2 id="repository-health-actions-heading" className="font-display text-2xl font-semibold">Top repository improvements</h2>
      </div>
      {actions.length === 0 ? (
        <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">No high-priority Repository Health actions were generated from the current scan.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {actions.map(action => (
            <article key={action.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={action.priority === 'High' ? 'border-warning/70 text-warning' : 'border-border/70 text-muted-foreground'}>
                  {action.priority} priority
                </Badge>
                {action.suggestedTargetPath && (
                  <code className="rounded bg-secondary/70 px-2 py-1 text-[11px] text-foreground/90 break-all">{action.suggestedTargetPath}</code>
                )}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{action.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{action.whyItMatters}</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{action.action}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {action.dimensions.map(dimension => (
                  <Badge key={dimension} variant="outline" className="border-primary/35 text-primary-glow">
                    {dimensionLabel(dimension)}
                  </Badge>
                ))}
              </div>
              {action.potentialDimensionGain > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Potential {dimensionLabel(action.dimensions[0])} improvement: up to {action.potentialDimensionGain} dimension points.
                </div>
              )}
              <EvidenceList evidence={action.evidence.slice(0, 3)} className="mt-3" />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RepositoryHealthDimensions({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
  const dimensions = [
    {
      id: 'repositoryIntelligence' as const,
      name: 'Repository Intelligence',
      description: 'How much reusable project knowledge is available to an AI agent before work begins.',
      score: repositoryHealth.dimensions.repositoryIntelligence.score,
      confidence: repositoryHealth.dimensions.repositoryIntelligence.confidence,
      signals: repositoryHealth.dimensions.repositoryIntelligence.signals,
    },
    {
      id: 'contextWaste' as const,
      name: 'Context Waste Risk',
      description: 'How likely an agent is to process unnecessary, duplicated or poorly routed repository context.',
      score: repositoryHealth.dimensions.contextWaste.riskScore,
      confidence: repositoryHealth.dimensions.contextWaste.confidence,
      signals: repositoryHealth.dimensions.contextWaste.signals,
      risk: true,
    },
    {
      id: 'aiDevelopmentReadiness' as const,
      name: 'AI Development Readiness',
      description: "How clearly an agent can build, test and verify changes using the repository's declared workflow.",
      score: repositoryHealth.dimensions.aiDevelopmentReadiness.score,
      confidence: repositoryHealth.dimensions.aiDevelopmentReadiness.confidence,
      signals: repositoryHealth.dimensions.aiDevelopmentReadiness.signals,
    },
    {
      id: 'agentRouting' as const,
      name: 'Agent Routing',
      description: 'How clearly tasks map to folders, critical files and focused verification steps.',
      score: repositoryHealth.dimensions.agentRouting.score,
      confidence: repositoryHealth.dimensions.agentRouting.confidence,
      signals: repositoryHealth.dimensions.agentRouting.signals,
    },
    {
      id: 'deliveryConfidence' as const,
      name: 'Delivery Confidence',
      description: 'How clearly the project can be understood, operated and handed over.',
      score: repositoryHealth.dimensions.deliveryConfidence.score,
      confidence: repositoryHealth.dimensions.deliveryConfidence.confidence,
      signals: repositoryHealth.dimensions.deliveryConfidence.signals,
    },
  ];

  return (
    <section className="mb-8" aria-labelledby="repository-health-dimensions-heading">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Layers className="h-5 w-5 text-primary-glow" />
        <h2 id="repository-health-dimensions-heading" className="font-display text-2xl font-semibold">Repository Health dimensions</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {dimensions.map(dimension => (
          <DimensionCard key={dimension.id} {...dimension} />
        ))}
      </div>
    </section>
  );
}

function DimensionCard({
  name,
  description,
  score,
  confidence,
  signals,
  risk = false,
}: {
  name: string;
  description: string;
  score: number | null;
  confidence: string;
  signals: RepositoryHealthSignal[];
  risk?: boolean;
}) {
  const positive = signals.filter(signal => signal.status === 'pass').slice(0, 2);
  const gaps = signals.filter(signal => signal.status === 'fail' || signal.status === 'partial').slice(0, 2);
  const displayScore = score === null ? 'Unavailable' : risk ? `${score} / 100 risk` : `${score} / 100`;
  const label = score === null ? 'Insufficient evidence' : risk ? contextWasteRiskLabel(score) : dimensionQualityLabel(score);

  return (
    <article className="glass rounded-2xl p-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className={risk ? contextWasteRiskClass(score) : dimensionQualityClass(score)}>
          {label}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-foreground">{displayScore}</span>
          <span className="text-muted-foreground">{confidence} confidence</span>
        </div>
        {score !== null && (
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
            role="img"
            aria-label={`${name} ${displayScore}${risk ? ', higher means higher risk' : ''}`}
          >
            <div
              className={risk ? 'h-full rounded-full bg-gradient-to-r from-warning to-destructive' : 'h-full rounded-full bg-gradient-to-r from-primary to-accent'}
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SignalSummary title="Evidence" signals={positive} emptyText="No strong positive signal surfaced." />
        <SignalSummary title="Main gaps" signals={gaps} emptyText="No main gap surfaced." />
      </div>

      <details className="mt-4 rounded-lg border border-border/60 bg-secondary/20 p-3">
        <summary className="cursor-pointer select-none text-sm font-medium">Why this score?</summary>
        <ul className="mt-3 space-y-3">
          {signals.slice(0, 6).map(signal => (
            <li key={signal.id} className="text-xs leading-relaxed">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border/70 text-[10px]">{signal.status}</Badge>
                <span className="font-medium text-foreground/90">{signal.label}</span>
              </div>
              <EvidenceList evidence={signal.evidence.slice(0, 2)} className="mt-2" />
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function MeasurementBoundary({ repositoryHealth }: { repositoryHealth: RepositoryHealth }) {
  return (
    <details className="glass rounded-2xl p-6">
      <summary className="cursor-pointer select-none font-display font-semibold text-foreground">
        How this score is measured
      </summary>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Repository Health is the current repository state from this scan, before generated ShipSeal improvements are applied.</p>
        <ul className="space-y-2">
          {repositoryHealth.measurementBoundary.map(boundary => (
            <li key={boundary} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-glow" />
              <span>{boundary}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function SignalSummary({ title, signals, emptyText }: { title: string; signals: RepositoryHealthSignal[]; emptyText: string }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {signals.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyText}</div>
      ) : (
        <ul className="space-y-2">
          {signals.map(signal => (
            <li key={signal.id} className="text-xs leading-relaxed text-foreground/90">
              {signal.evidence[0] || signal.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceList({ evidence, className = '' }: { evidence: string[]; className?: string }) {
  if (evidence.length === 0) return null;
  return (
    <ul className={`space-y-1 text-xs leading-relaxed text-muted-foreground ${className}`}>
      {evidence.map(item => (
        <li key={item} className="break-words">
          <span className="sr-only">Evidence: </span>{item}
        </li>
      ))}
    </ul>
  );
}

function repositoryHealthSummarySentence(status: RepositoryHealth['overall']['status']) {
  if (status === 'AI-ready workspace') return 'The repository has strong project knowledge, routing and verification signals for AI-agent work.';
  if (status === 'Workable with optimization') return 'The repository has usable project knowledge and verification signals, but agents may still need broad context discovery.';
  if (status === 'Fragmented workspace') return 'The repository has useful signals, but project knowledge and routing are fragmented.';
  if (status === 'High agent friction') return 'The repository is likely to require substantial context discovery before agent work is reliable.';
  if (status === 'Blocked') return 'A critical repository issue blocks trustworthy AI-agent handoff until it is resolved.';
  return 'ShipSeal does not have enough repository evidence to calculate Repository Health.';
}

function contextWasteRiskLabel(score: number | null) {
  if (score === null) return 'Unavailable';
  if (score >= 75) return 'Very high';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

function contextWasteRiskClass(score: number | null) {
  if (score === null) return 'border-warning/60 text-warning';
  if (score >= 75) return 'border-destructive/70 text-destructive';
  if (score >= 50) return 'border-warning/80 text-warning';
  if (score >= 25) return 'border-accent/70 text-accent';
  return 'border-success/50 text-success';
}

function dimensionQualityLabel(score: number | null) {
  if (score === null) return 'Unavailable';
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Workable';
  if (score >= 50) return 'Needs focus';
  return 'Weak';
}

function dimensionQualityClass(score: number | null) {
  if (score === null) return 'border-warning/60 text-warning';
  if (score >= 85) return 'border-success/50 text-success';
  if (score >= 70) return 'border-primary/45 text-primary-glow';
  if (score >= 50) return 'border-warning/70 text-warning';
  return 'border-destructive/60 text-destructive';
}

function repositoryHealthStatusClass(status: RepositoryHealth['overall']['status']) {
  if (status === 'AI-ready workspace') return 'border-success/50 text-success';
  if (status === 'Workable with optimization') return 'border-primary/45 text-primary-glow';
  if (status === 'Fragmented workspace') return 'border-warning/70 text-warning';
  if (status === 'High agent friction' || status === 'Blocked') return 'border-destructive/70 text-destructive';
  return 'border-warning/60 text-warning';
}

function dimensionLabel(dimension: string) {
  if (dimension === 'repositoryIntelligence') return 'Repository Intelligence';
  if (dimension === 'contextWaste') return 'Context Waste Risk';
  if (dimension === 'aiDevelopmentReadiness') return 'AI Development Readiness';
  if (dimension === 'agentRouting') return 'Agent Routing';
  if (dimension === 'deliveryConfidence') return 'Delivery Confidence';
  return dimension;
}

function severityClass(severity: MCPRiskSeverity) {
  if (severity === 'Critical') return 'ml-auto border-destructive/60 text-destructive text-[10px]';
  if (severity === 'High') return 'ml-auto border-warning/70 text-warning text-[10px]';
  if (severity === 'Medium') return 'ml-auto border-accent/60 text-accent text-[10px]';
  return 'ml-auto border-success/60 text-success text-[10px]';
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-3 min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

function ProjectPackageSummary({
  packageLabel,
  outputCount,
  packageSummary,
  hasContextCompressionPack,
  hasFolderAgentSuggestions,
  hasSpecializedContextPacks,
  hasToolingRecommendations,
  skillRecommendationCount,
  mcpRecommendationCount,
}: {
  packageLabel: string;
  outputCount: number;
  packageSummary: string;
  hasContextCompressionPack: boolean;
  hasFolderAgentSuggestions: boolean;
  hasSpecializedContextPacks: boolean;
  hasToolingRecommendations: boolean;
  skillRecommendationCount: number;
  mcpRecommendationCount: number;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 shadow-sm shadow-primary/5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Project package</div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {packageLabel}
        </div>
        <Badge variant="outline" className="w-fit shrink-0 border-primary/50 bg-primary/15 text-primary-glow">
          {outputCount} outputs
        </Badge>
      </div>
      {packageSummary && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {packageSummary}
        </p>
      )}
      {hasContextCompressionPack && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Context Compression Pack generated.</span> ShipSeal generated compact project memory files to help AI coding agents avoid unnecessary full-repo scans.
        </p>
      )}
      {hasFolderAgentSuggestions && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Folder-level AGENTS suggestions generated.</span> These local instructions help AI coding agents use the right context for each part of the project.
        </p>
      )}
      {hasSpecializedContextPacks && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Specialized context packs generated.</span> ShipSeal generated role-specific context files for QA, security, docs, and MCP/tooling agents.
        </p>
      )}
      {hasToolingRecommendations && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground">Tooling recommendations generated.</span> Recommended skills: {skillRecommendationCount}. Recommended MCP tools: {mcpRecommendationCount}.
        </p>
      )}
    </div>
  );
}

function AgentOperatingModeSummary({
  modeLabel,
  expectedTokenUsage,
  confidence,
  summary,
}: {
  modeLabel: string;
  expectedTokenUsage: string;
  confidence: string;
  summary: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recommended operating mode</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold text-foreground">{modeLabel}</div>
        <Badge variant="outline" className="border-accent/45 bg-background/25 text-[10px] text-accent">
          {expectedTokenUsage}
        </Badge>
        <Badge variant="outline" className="border-border/70 bg-background/25 text-[10px]">
          {confidence}
        </Badge>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">{summary}</p>
    </div>
  );
}

function ScanEvidencePanel({ report }: { report: ReadinessReport }) {
  const evidence = report.scanEvidence;
  const keySignals = keyFileSignals(evidence.keyFilesFound);
  const stack = [
    ...evidence.topFrameworks,
    ...evidence.topLanguages.filter(language => !evidence.topFrameworks.includes(language)),
  ].slice(0, 5);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-start gap-3">
        <ShieldCheck className={evidence.limitedScan ? 'mt-1 h-5 w-5 text-warning' : 'mt-1 h-5 w-5 text-success'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold">Scan evidence</h3>
            <Badge variant="outline" className={evidence.limitedScan ? 'border-warning/60 text-warning' : 'border-success/40 text-success'}>
              {evidence.limitedScan ? 'Limited scan' : 'Full archive scan'}
            </Badge>
            <Badge variant="outline" className="border-primary/40 text-primary-glow">
              {displayEvidenceSource(evidence.sourceType)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Static scan complete: ShipSeal read repository structure and key project files without executing code.
          </p>
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SafetyMetric label="Repository" value={evidence.repositoryFullName} />
        <SafetyMetric label="Branch / ref" value={evidence.branchOrRef || 'default'} />
        <SafetyMetric label="Scanned at" value={new Date(report.scannedAt).toLocaleString()} />
        <SafetyMetric label="Archive size" value={evidence.approximateArchiveSizeBytes ? formatFileSize(evidence.approximateArchiveSizeBytes) : 'Not reported'} />
        <SafetyMetric label="Files discovered" value={evidence.discoveredFileCount.toLocaleString()} />
        <SafetyMetric label="Files analyzed" value={evidence.analyzedFileCount.toLocaleString()} />
        <SafetyMetric label="Files ignored" value={evidence.ignoredFileCount.toLocaleString()} />
        <SafetyMetric label="Generated/vendor ignored" value={evidence.generatedOrVendorFileCount.toLocaleString()} />
      </div>

      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Detected stack</div>
          <div className="flex flex-wrap gap-2">
            {(stack.length ? stack : ['Not detected']).map(item => (
              <Badge key={item} variant="outline" className="border-border/70 bg-background/25 text-foreground">
                {item}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Key files found</div>
          <div className="flex flex-wrap gap-2">
            {keySignals.map(signal => (
              <Badge key={signal.label} variant="outline" className={signal.found ? 'border-success/40 text-success' : 'border-border/60 text-muted-foreground'}>
                {signal.found ? 'Found' : 'Missing'}: {signal.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {evidence.limitedScan && evidence.limitationReason && (
        <div className="mt-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          {evidence.limitationReason}
        </div>
      )}
    </div>
  );
}

function keyFileSignals(keyFiles: ReadinessReport['scanEvidence']['keyFilesFound']) {
  return [
    { label: 'README', found: keyFiles.readme },
    { label: 'package.json', found: keyFiles.packageJson },
    { label: 'tests', found: keyFiles.tests },
    { label: 'CI workflow', found: keyFiles.ciConfig },
    { label: '.env example', found: keyFiles.envExample },
    { label: '.gitignore', found: keyFiles.gitignore },
    { label: 'AGENTS', found: keyFiles.agentInstructions },
    { label: 'CLAUDE', found: keyFiles.claudeInstructions },
  ];
}

function displayEvidenceSource(sourceType: ReadinessReport['scanEvidence']['sourceType']) {
  if (sourceType === 'github-app') return 'GitHub App';
  if (sourceType === 'public-github') return 'Public GitHub';
  return 'ZIP upload';
}

function Disclosure({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen || undefined} className="mb-8 rounded-2xl border border-border/60 bg-secondary/15 p-4">
      <summary className="cursor-pointer select-none font-display font-semibold text-foreground">
        {title}
      </summary>
      <div className="mt-5">
        {children}
      </div>
    </details>
  );
}

function ProjectContextPanel({
  appliedIntake,
  draftIntake,
  skipped,
  dirty,
  onDraftChange,
  onRegenerate,
  onClear,
}: {
  appliedIntake: ProjectIntake;
  draftIntake: ProjectIntake;
  skipped: boolean;
  dirty: boolean;
  onDraftChange: (value: ProjectIntake) => void;
  onRegenerate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl p-2">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <FileArchive className="h-4 w-4 text-primary-glow" />
        <Badge variant="outline" className={skipped ? 'border-warning/60 text-warning' : 'border-success/40 text-success'}>
          {skipped ? 'Intake skipped' : 'Context applied'}
        </Badge>
      </div>
      {skipped && (
        <div className="mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          Client report quality is limited because project intake was skipped.
        </div>
      )}
      {dirty && (
        <div className="mb-4 rounded-lg border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent">
          Project context was edited. Regenerate the report to update Delivery Pack outputs.
        </div>
      )}
      <div className="space-y-2 text-sm">
        <Row label="Project" value={appliedIntake.projectName || 'Not provided'} />
        <Row label="Client" value={appliedIntake.clientName || 'Not provided'} />
        <Row label="Agency" value={appliedIntake.agencyName || 'Not provided'} />
        <Row label="AI use case" value={appliedIntake.aiUseCase || 'Not provided'} />
        <Row label="EU / personal data" value={`${appliedIntake.usedInEU ? 'EU use' : 'EU unknown'} / ${appliedIntake.handlesPersonalData ? 'personal data' : 'personal data unknown'}`} />
      </div>
      <details className="mt-5 rounded-lg border border-border/60 bg-secondary/20 p-3">
        <summary className="cursor-pointer select-none text-sm font-medium">Edit project context</summary>
        <div className="mt-4">
          <ProjectIntakeForm value={draftIntake} onChange={onDraftChange} />
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClear}>Clear intake</Button>
            <Button type="button" disabled={!dirty} onClick={onRegenerate} className="bg-gradient-primary border-0 shadow-glow hover:opacity-90">
              Regenerate report with updated intake
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function DecisionSummary({ report, ready, nextActions }: { report: ReadinessReport; ready: boolean; nextActions: string[] }) {
  const risks = report.blockers.slice(0, 3).map(blocker => blocker.title || 'Critical blocker');
  const fallbackRisks = report.improvements.slice(0, 3).map(improvement => improvement.title || improvement.category);
  const visibleRisks = risks.length ? risks : fallbackRisks.length ? fallbackRisks : ['No major delivery risks detected from available scan data'];
  const visibleActions = nextActions.length ? nextActions : ['Review the Delivery Pack with the client', 'Complete project intake fields', 'Run test and build commands before handoff'];

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className={ready ? 'h-4 w-4 text-success' : 'h-4 w-4 text-warning'} />
        <h3 className="font-display font-semibold">Handoff decision summary</h3>
        <Badge variant="outline" className={ready ? 'ml-auto border-success/40 text-success' : 'ml-auto border-warning/60 text-warning'}>
          {ready ? 'Go / review' : 'Needs remediation'}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Top risks</div>
          <ul className="space-y-2 text-sm text-foreground/90">
            {visibleRisks.map(risk => (
              <li key={risk} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Next 3 actions</div>
          <ol className="space-y-2 text-sm text-foreground/90 list-decimal list-inside">
            {visibleActions.slice(0, 3).map(action => <li key={action}>{action}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

function sameIntake(a: ProjectIntake, b: ProjectIntake) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function SafetyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-foreground/90 truncate">{value}</div>
    </div>
  );
}

function NarrativePanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
    </div>
  );
}

function NarrativeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <ul className="space-y-2 text-sm text-foreground/90">
        {items.map(item => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary-glow shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentScans({ history, onClear }: { history: ScanHistoryItem[]; onClear: () => void }) {
  return (
    <div className="glass rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="h-4 w-4 text-primary-glow" />
        <h3 className="font-display font-semibold">Recent scans</h3>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear history
          </Button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="text-sm text-muted-foreground">No previous scans on this device.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {history.map(item => (
            <div key={`${item.repositoryName}-${item.timestamp}`} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <div className="text-xs font-medium truncate">{item.repositoryName}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-mono">{item.score}/100</span>
                <span className="text-muted-foreground truncate">{displayReadinessLevel(item.status)}</span>
                <span className={item.criticalBlockerCount ? 'text-destructive' : 'text-success'}>{item.criticalBlockerCount}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground truncate">
                {isGitHubSource(item.sourceType) ? `GitHub ${item.githubOwner}/${item.githubRepo}${item.githubBranch ? ` @ ${item.githubBranch}` : ''}` : 'ZIP upload'}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>MCP</span>
                <span className="font-mono">{item.mcpScore}/100</span>
                <span className="truncate">{displayMcpReadiness(item.mcpStatus)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function displayMcpReadiness(status?: string) {
  if (!status) return 'Not detected';
  if (/Enterprise MCP Ready/i.test(status)) return 'MCP Governance Ready';
  if (/MCP Ready/i.test(status)) return 'Strong MCP readiness signal';
  return status;
}

function mcpGovernanceSummary(report: ReadinessReport) {
  const base = report.mcpReadiness.aiNarrative?.mcpSummary || report.mcpReadiness.summary;
  return `${base} MCP readiness is separate from the main ShipSeal score; it does not mean production-ready status, and high-risk MCP tool categories require human approval.`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 text-right truncate">{value}</span>
    </div>
  );
}

function isGitHubSource(sourceType?: string) {
  return sourceType === 'github-app' || sourceType === 'github-url' || sourceType === 'github-public';
}

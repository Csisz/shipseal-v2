import { lazy, Suspense, useEffect, useState } from 'react';
import { AlertOctagon, Check, CheckCircle2, Copy, Download, FileArchive, Layers, Lightbulb, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { AgentOperatingModeId, AgentPackFile, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { evaluateReadiness } from '@/lib/scoring';
import { ScoreGauge } from '@/components/agentready/ScoreGauge';
import { ReadinessBadge } from '@/components/agentready/ReadinessBadge';
import { CategoryBreakdown } from '@/components/agentready/CategoryBreakdown';
import { AgentPackTabs } from '@/components/agentready/AgentPackTabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildRepoContextPackJson, buildScoreJson, downloadJsonFile, downloadTextFile } from '@/lib/exports';
import { formatFileSize } from '@/lib/uploadValidation';
import { criticalBlockersEmptyStateText, displayReadinessLevel, readinessStatusMessageForPackage } from '@/lib/uiCopy';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake, normalizeProjectIntake } from '@/lib/intake';
import { FULL_PACKAGE_ID, getShipSealPackage, type ShipSealGoalId } from '@/lib/packages';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { DEFAULT_AGENT_OPERATING_MODE, applyAgentOperatingModeToFiles, getAgentOperatingMode, resolveAgentOperatingMode, selectionUsesAgentDevelopment } from '@/lib/agentOperatingMode';
import { buildToolingRecommendationBundle, recommendationCounts } from '@/lib/toolingRecommendations';
import { ResultChapterLoadBoundary, ResultChapterLoading } from '@/components/agentready/result-dashboard/ResultChapterLoadBoundary';
import {
  AgentOperatingModeSummary,
  NarrativeList,
  NarrativePanel,
  ProjectContextPanel,
  ProjectPackageSummary,
  RecentScans,
  Row,
  SafetyMetric,
  SummaryTile,
} from './DeliveryWorkspaceSupport';
import { ResultWorkspaceDisclosure as Disclosure } from '../ResultWorkspaceDisclosure';
import { sameProjectIntake } from '../model/resultWorkspaceSelectors';
import {
  displayMcpReadiness,
  isGitHubSource,
  mcpGovernanceSummary,
  severityClass,
} from '../model/deliveryWorkspaceSelectors';

const DeliveryPackPreview = lazy(() => import('@/components/agentready/DeliveryPackPreview').then(module => ({ default: module.DeliveryPackPreview })));

interface DeliverWorkspaceProps {
  active: boolean;
  report: ReadinessReport;
  history: ScanHistoryItem[];
  onReset: () => void;
  onClearHistory: () => void;
  initialIntake?: ProjectIntake;
  intakeSkipped: boolean;
  resolvedPackages: ShipSealGoalId[];
  agentOperatingMode?: AgentOperatingModeId;
}

type DeliveryOutcomeGroup = 'client-handoff' | 'ai-workspace' | 'repository-intelligence' | 'technical-exports';

export default function DeliverWorkspace({
  active,
  report,
  history,
  onReset,
  onClearHistory,
  initialIntake,
  intakeSkipped,
  resolvedPackages,
  agentOperatingMode,
}: DeliverWorkspaceProps) {
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
  const [activeDeliveryGroup, setActiveDeliveryGroup] = useState<DeliveryOutcomeGroup | null>(null);
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

  useEffect(() => {
    const nextIntake = normalizeProjectIntake(initialIntake, report.repoName);
    setAppliedIntake(nextIntake);
    setDraftIntake(nextIntake);
    setWasIntakeSkipped(intakeSkipped);
    setActiveDeliveryGroup(null);
  }, [initialIntake, intakeSkipped, report.repoName, report.scannedAt]);

  const intakeDirty = !sameProjectIntake(appliedIntake, draftIntake);
  const regenerateReport = () => {
    setAppliedIntake(normalizeProjectIntake(draftIntake, report.repoName));
    setWasIntakeSkipped(false);
  };
  const clearIntake = () => setDraftIntake(createDefaultProjectIntake(report.repoName));
  const copyContextPack = async () => {
    await navigator.clipboard.writeText(report.contextPack);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 1500);
  };

  return (
    <>
      {active && (
        <section className="mb-8" aria-labelledby="delivery-outcome-groups-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Delivery</div>
              <h2 id="delivery-outcome-groups-heading" className="mt-1 font-display text-2xl font-semibold">Prepare delivery</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the outcome you need; technical detail stays closed until requested.</p>
            </div>
            <Button type="button" onClick={() => setActiveDeliveryGroup('client-handoff')} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Prepare delivery
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([
              ['client-handoff', 'Client handoff', 'Package the reviewed client-facing report and Delivery Pack.'],
              ['ai-workspace', 'AI workspace', 'Review agent instructions, context, and workspace outputs.'],
              ['repository-intelligence', 'Repository Intelligence', 'Inspect evidence, readiness, and governance outcomes.'],
              ['technical-exports', 'Technical exports', 'Access score, manifest, generated files, and scan metadata.'],
            ] as const).map(([id, title, description]) => (
              <article key={id} className={`rounded-2xl border p-4 ${activeDeliveryGroup === id ? 'border-primary/45 bg-primary/10' : 'border-border/55 bg-background/20'}`}>
                <h3 className="font-display font-semibold">{title}</h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{description}</p>
                <Button type="button" variant="ghost" size="sm" aria-label={`Open ${title}`} aria-pressed={activeDeliveryGroup === id} onClick={() => setActiveDeliveryGroup(id)} className="mt-3 px-0 text-primary-glow hover:bg-transparent hover:text-primary-glow">
                  {activeDeliveryGroup === id ? 'Showing details' : 'Open group'}
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {active && activeDeliveryGroup === 'client-handoff' && (
      <div>
      <section className="mb-8" aria-labelledby="delivery-outputs-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Exports and reports</div>
            <h2 id="delivery-outputs-heading" className="mt-1 font-display text-2xl font-semibold">Reports and Delivery Outputs</h2>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary-glow">
            Export scope
          </Badge>
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
              Delivery Outputs package the workspace findings for review, handoff, and export.
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

      <Disclosure title="Delivery readiness details" lazyMount>
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
            <ScoreGauge score={report.score} size={200} label="delivery / 100" />
            <div className="mt-3 text-center text-sm text-muted-foreground">
              Supporting delivery and verification score.
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold mb-4">Delivery readiness categories</h2>
            <CategoryBreakdown categories={report.categories} />
          </div>
        </div>
      </Disclosure>

      <ResultChapterLoadBoundary chapterLabel="Delivery outputs">
        <Suspense fallback={<ResultChapterLoading chapterLabel="delivery outputs" />}>
          <DeliveryPackPreview report={report} agentFiles={modeAgentPack} intake={appliedIntake} intakeSkipped={wasIntakeSkipped} selectedPackages={resolvedPackages} agentOperatingMode={resolvedAgentMode} />
        </Suspense>
      </ResultChapterLoadBoundary>

      <Disclosure title="Project context used for Delivery Outputs" defaultOpen={wasIntakeSkipped || intakeDirty} lazyMount>
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
      </section>
      </div>
      )}

      {active && activeDeliveryGroup && activeDeliveryGroup !== 'client-handoff' && (
      <div>
      {activeDeliveryGroup === 'ai-workspace' && (
      <>
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
      </>
      )}

      {activeDeliveryGroup === 'repository-intelligence' && (
      <>
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
        Delivery readiness categories are available in Delivery readiness details above. Scanner, MCP and generated-file details stay available without changing Workspace Quality or Repository Health.
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
          MCP readiness is a separate governance dimension for tool access and requires human approval for high-risk categories.
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {report.mcpReadiness.generatedFiles.map(file => (
            <div key={file.filename} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground/85">
              {file.filename}
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {activeDeliveryGroup === 'technical-exports' && (
      <>
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
          <pre className="max-h-80 overflow-auto rounded-lg bg-inset p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
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
      </>
      )}
      </div>
      )}

    </>
  );
}

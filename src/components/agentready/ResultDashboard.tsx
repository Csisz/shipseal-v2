import { useEffect, useMemo, useState } from 'react';
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
import {
  buildWorkspaceStory,
  chapterForDnaDimension,
  chapterForMentalModelNode,
  type WorkspaceStory,
  type WorkspaceStoryAgentStepId,
  type WorkspaceStoryChapter,
  type WorkspaceStoryChapterId,
  type WorkspaceStoryDnaDimensionId,
  type WorkspaceStoryMentalNodeId,
} from '@/lib/workspace';

interface Props {
  report: ReadinessReport;
  history: ScanHistoryItem[];
  onReset: () => void;
  onClearHistory: () => void;
  onReplayReveal?: () => void;
  activeStoryChapterId?: WorkspaceStoryChapterId | null;
  onActiveStoryChapterChange?: (chapterId: WorkspaceStoryChapterId | null) => void;
  initialIntake?: ProjectIntake;
  intakeSkipped?: boolean;
  /** Package options the user picked before the scan; defaults to the full package. */
  selectedPackages?: string[];
  agentOperatingMode?: AgentOperatingModeId;
  githubConnection?: GitHubConnectionState;
}

type RepositoryHealth = ReadinessReport['repositoryHealth'];
type RepositoryHealthSignal = RepositoryHealth['dimensions']['repositoryIntelligence']['signals'][number];

export function ResultDashboard({
  report,
  history,
  onReset,
  onClearHistory,
  onReplayReveal,
  activeStoryChapterId,
  onActiveStoryChapterChange,
  initialIntake,
  intakeSkipped = false,
  selectedPackages,
  agentOperatingMode,
  githubConnection,
}: Props) {
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
  const [localStoryChapterId, setLocalStoryChapterId] = useState<WorkspaceStoryChapterId | null>(null);
  const readiness = evaluateReadiness(report.score, report.blockers);
  const ready = readiness.isReady;
  const workspaceStory = useMemo(() => buildWorkspaceStory(report), [report]);
  const effectiveStoryChapterId = activeStoryChapterId ?? localStoryChapterId;
  const activeStoryChapter = workspaceStory.chapters.find(chapter => chapter.id === effectiveStoryChapterId)
    || workspaceStory.chapters.find(chapter => chapter.id === workspaceStory.initialChapterId)
    || null;
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

  useEffect(() => {
    if (!activeStoryChapter || effectiveStoryChapterId === activeStoryChapter.id) return;
    setLocalStoryChapterId(activeStoryChapter.id);
    onActiveStoryChapterChange?.(activeStoryChapter.id);
  }, [activeStoryChapter, effectiveStoryChapterId, onActiveStoryChapterChange]);

  const handleActiveStoryChapterChange = (chapterId: WorkspaceStoryChapterId | null) => {
    setLocalStoryChapterId(chapterId);
    onActiveStoryChapterChange?.(chapterId);
  };

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

      <AiWorkspaceHero
        report={report}
        limitationReason={limitedScanReason}
        onReset={onReset}
        onReplayReveal={onReplayReveal}
        story={workspaceStory}
        activeStoryChapter={activeStoryChapter}
        onActiveStoryChapterChange={handleActiveStoryChapterChange}
      />

      <WorkspaceOverview report={report} />
      <LiveAgentSimulator report={report} activeChapter={activeStoryChapter} />
      <WorkspaceModulePlaceholders />

      <Disclosure title="Workspace evidence">
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

        <DecisionSummary report={report} ready={ready} nextActions={report.aiNarrative.nextBestActions.slice(0, 3)} />
      </Disclosure>

      <section className="mb-8" aria-labelledby="delivery-outputs-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Delivery Outputs</div>
            <h2 id="delivery-outputs-heading" className="mt-1 font-display text-2xl font-semibold">Export what the workspace produced</h2>
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

      <Disclosure title="Delivery readiness details">
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

      <DeliveryPackPreview report={report} agentFiles={modeAgentPack} intake={appliedIntake} intakeSkipped={wasIntakeSkipped} selectedPackages={resolvedPackages} agentOperatingMode={resolvedAgentMode} />

      <Disclosure title="Project context used for Delivery Outputs" defaultOpen={wasIntakeSkipped || intakeDirty}>
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

      <Disclosure title="Available ShipSeal improvements - optional fixes you can add back">
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

function AiWorkspaceHero({
  report,
  limitationReason,
  onReset,
  onReplayReveal,
  story,
  activeStoryChapter,
  onActiveStoryChapterChange,
}: {
  report: ReadinessReport;
  limitationReason?: string;
  onReset: () => void;
  onReplayReveal?: () => void;
  story: WorkspaceStory;
  activeStoryChapter: WorkspaceStoryChapter | null;
  onActiveStoryChapterChange?: (chapterId: WorkspaceStoryChapterId | null) => void;
}) {
  const health = report.repositoryHealth;
  const unavailable = health.overall.score === null;
  const repositoryDna = buildRepositoryDna(report);
  const mentalModel = buildMentalModel(report);
  const primarySentence = workspaceUnderstandingSentence(report);
  const topAction = health.topActions[0];
  const [exploredChapterIds, setExploredChapterIds] = useState<WorkspaceStoryChapterId[]>([]);
  const [manualMentalNodeId, setManualMentalNodeId] = useState<MentalModelNodeId | null>(null);
  const selectedMentalNodeId = activeStoryChapter?.mentalModelNodeId as MentalModelNodeId | undefined;
  const activeMentalNodeId = manualMentalNodeId || selectedMentalNodeId || 'architecture';
  const activeDnaDimensionId = activeStoryChapter?.dnaDimensionId as RepositoryDnaDimensionId | undefined;

  const selectStoryChapter = (chapterId: WorkspaceStoryChapterId) => {
    const chapter = story.chapters.find(item => item.id === chapterId);
    if (!chapter) return;
    setExploredChapterIds(current => current.includes(chapterId) ? current : [...current, chapterId]);
    setManualMentalNodeId((chapter.mentalModelNodeId as MentalModelNodeId | undefined) || null);
    onActiveStoryChapterChange?.(chapterId);
  };

  const selectMentalModelNode = (nodeId: MentalModelNodeId) => {
    setManualMentalNodeId(nodeId);
    const chapter = chapterForMentalModelNode(story, nodeId as WorkspaceStoryMentalNodeId);
    if (chapter) {
      setExploredChapterIds(current => current.includes(chapter.id) ? current : [...current, chapter.id]);
      onActiveStoryChapterChange?.(chapter.id);
    }
  };

  const selectDnaDimension = (dimensionId: RepositoryDnaDimensionId) => {
    const chapter = chapterForDnaDimension(story, dimensionId as WorkspaceStoryDnaDimensionId);
    if (chapter) selectStoryChapter(chapter.id);
  };

  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-primary/25 bg-[hsl(225_28%_7%)] p-5 shadow-glow md:p-8 lg:p-10 animate-fade-in-up" aria-labelledby="repository-intelligence-heading">
      <div className="relative">
        <div className="absolute inset-0 -m-10 bg-[radial-gradient(circle_at_24%_18%,hsl(var(--primary)/0.22),transparent_34%),radial-gradient(circle_at_78%_26%,hsl(var(--accent)/0.13),transparent_32%),linear-gradient(180deg,hsl(var(--background)/0),hsl(var(--background)/0.2))] pointer-events-none" />
        <div className="relative mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository Intelligence</span>
              <Badge variant="outline" className="border-primary/45 text-primary-glow">
                Visual understanding
              </Badge>
            </div>
            <h1 id="repository-intelligence-heading" className="font-display text-3xl font-semibold leading-tight md:text-5xl">
              {unavailable ? 'I need more evidence to understand this repository.' : 'What ShipSeal understood'}
            </h1>
            {unavailable ? (
              <div className="mt-5 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm leading-relaxed text-warning">
                <p className="font-medium">The repository model is incomplete.</p>
                <p className="mt-2 text-warning/90">{limitationReason || health.blockers[0]?.detail || 'The scan was limited or synthetic fallback data was used.'}</p>
                <p className="mt-2 text-warning/90">Reconnect GitHub, upload the complete ZIP, or retry the full scan.</p>
              </div>
            ) : (
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                {primarySentence} ShipSeal connected documentation, architecture, memory, verification and context into a visual model of how this workspace can be understood.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {onReplayReveal && (
              <Button variant="outline" size="sm" onClick={onReplayReveal} className="border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Replay reveal
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onReset} className="border-border/60 bg-background/20">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Scan another project
            </Button>
          </div>
        </div>

        {!unavailable && (
          <>
            <WorkspaceStoryNavigator
              story={story}
              activeChapter={activeStoryChapter}
              exploredChapterIds={exploredChapterIds}
              onSelectChapter={selectStoryChapter}
            />
            {activeStoryChapter && <WorkspaceEvidenceTrail chapter={activeStoryChapter} />}
            <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
              <div className="min-h-[560px] overflow-hidden rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6">
                <MentalModelVisualization
                  model={mentalModel}
                  activeId={activeMentalNodeId}
                  storyNodeId={selectedMentalNodeId}
                  activeChapter={activeStoryChapter}
                  onSelectNode={selectMentalModelNode}
                />
              </div>

              <aside className="min-h-[560px] overflow-hidden rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6">
                <RepositoryDnaVisualization
                  dimensions={repositoryDna}
                  unavailable={unavailable}
                  activeDimensionId={activeDnaDimensionId}
                  activeChapter={activeStoryChapter}
                  onSelectDimension={selectDnaDimension}
                />
              </aside>
            </div>
          </>
        )}

        <details className="relative mt-6 rounded-2xl border border-border/60 bg-secondary/15 px-4 py-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground">Workspace metrics and next action</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={repositoryHealthStatusClass(health.overall.status)}>
                {health.overall.status}
              </Badge>
              <span>{health.overall.confidence} confidence</span>
              {health.overall.score !== null && <span>Workspace Quality {health.overall.score} / 100</span>}
            </div>
            {topAction && (
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">First improvement</div>
                <div className="mt-1 font-semibold text-foreground">{topAction.title}</div>
                <p className="mt-1 leading-relaxed">{topAction.action}</p>
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

function WorkspaceStoryNavigator({
  story,
  activeChapter,
  exploredChapterIds,
  onSelectChapter,
}: {
  story: WorkspaceStory;
  activeChapter: WorkspaceStoryChapter | null;
  exploredChapterIds: WorkspaceStoryChapterId[];
  onSelectChapter: (chapterId: WorkspaceStoryChapterId) => void;
}) {
  if (!story.chapters.length) return null;

  return (
    <nav className="relative mb-5" aria-label="Workspace Story">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace Story</div>
          <p className="mt-1 text-sm text-muted-foreground">Follow the evidence ShipSeal used to understand this repository.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {story.chapters.map((chapter, index) => {
          const active = chapter.id === activeChapter?.id;
          const explored = exploredChapterIds.includes(chapter.id);
          return (
            <button
              key={chapter.id}
              type="button"
              aria-current={active ? 'step' : undefined}
              onClick={() => onSelectChapter(chapter.id)}
              className={`min-w-0 rounded-full border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-primary/55 bg-primary/15 text-primary-glow'
                  : explored
                    ? 'border-success/35 bg-success/5 text-foreground'
                    : 'border-border/60 bg-background/20 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
              <span className="font-medium">{chapter.label}</span>
              <span className="sr-only">{active ? ', selected chapter' : explored ? ', explored chapter' : ''}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function WorkspaceEvidenceTrail({ chapter }: { chapter: WorkspaceStoryChapter }) {
  const primaryEvidence = chapter.evidenceItems.slice(0, 3);
  const secondaryEvidence = chapter.evidenceItems.slice(3);

  return (
    <section className="relative mb-5 rounded-3xl border border-primary/20 bg-background/20 p-5 md:p-6" aria-labelledby="workspace-evidence-trail-heading">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={chapter.evidenceType === 'evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
              {chapter.evidenceType === 'evidence' ? 'Evidence-backed' : 'Heuristic'}
            </Badge>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Evidence trail</span>
          </div>
          <h2 id="workspace-evidence-trail-heading" className="mt-3 font-display text-2xl font-semibold">{chapter.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{chapter.summary}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EvidenceTrailBlock title="What ShipSeal found" items={primaryEvidence} />
          <div className="space-y-4">
            <EvidenceTrailText title="Why it is connected" text={chapter.relationship} />
            <EvidenceTrailText title="What it means" text={chapter.repositoryMeaning} />
            <EvidenceTrailText title="How an AI agent uses it" text={chapter.agentUse} />
          </div>
        </div>
      </div>

      {secondaryEvidence.length > 0 && (
        <details className="mt-4 rounded-2xl border border-border/60 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-medium">More evidence</summary>
          <EvidenceTrailBlock title="Additional signals" items={secondaryEvidence} compact />
        </details>
      )}
    </section>
  );
}

function EvidenceTrailBlock({ title, items, compact = false }: { title: string; items: WorkspaceStoryChapter['evidenceItems']; compact?: boolean }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className={`mt-3 ${compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}`}>
        {items.map(item => (
          <li key={`${item.state}-${item.label}`} className="rounded-xl border border-border/50 bg-secondary/15 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm font-medium text-foreground">{item.label}</span>
              <Badge variant="outline" className={evidenceStateClass(item.state)}>
                {evidenceStateLabel(item.state)}
              </Badge>
            </div>
            {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceTrailText({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

function evidenceStateLabel(state: WorkspaceStoryChapter['evidenceItems'][number]['state']) {
  if (state === 'evidence') return 'Evidence';
  if (state === 'missing') return 'Missing';
  return 'Heuristic';
}

function evidenceStateClass(state: WorkspaceStoryChapter['evidenceItems'][number]['state']) {
  if (state === 'evidence') return 'border-primary/40 text-primary-glow';
  if (state === 'missing') return 'border-warning/50 text-warning';
  return 'border-border/70 text-muted-foreground';
}

type MentalModelNodeId =
  | 'documentation'
  | 'architecture'
  | 'source'
  | 'aiInstructions'
  | 'tests'
  | 'buildCi'
  | 'context'
  | 'recommendations';

interface MentalModelNode {
  id: MentalModelNodeId;
  label: string;
  description: string;
  evidence: string[];
  status: 'strong' | 'partial' | 'missing';
  x: number;
  y: number;
}

interface MentalModelConnection {
  from: MentalModelNodeId;
  to: MentalModelNodeId;
  label: string;
  evidence: string[];
}

interface MentalModel {
  nodes: MentalModelNode[];
  connections: MentalModelConnection[];
}

function MentalModelVisualization({
  model,
  activeId,
  storyNodeId,
  activeChapter,
  onSelectNode,
}: {
  model: MentalModel;
  activeId: MentalModelNodeId;
  storyNodeId?: MentalModelNodeId;
  activeChapter: WorkspaceStoryChapter | null;
  onSelectNode: (nodeId: MentalModelNodeId) => void;
}) {
  const active = model.nodes.find(node => node.id === activeId) || model.nodes[0];
  const related = model.connections.filter(connection => connection.from === active.id || connection.to === active.id);

  return (
    <div className="flex h-full min-h-[512px] flex-col">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Mental Model</div>
              <h2 className="mt-1 font-display text-2xl font-semibold">How ShipSeal understands this repository</h2>
              {activeChapter && <p className="mt-1 text-sm text-muted-foreground">Selected story: {activeChapter.label}</p>}
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary-glow">
          Semantic map
        </Badge>
      </div>

      <div className="grid flex-1 gap-5 lg:grid-rows-[minmax(300px,1fr)_auto]">
        <div className="relative min-h-[320px] overflow-hidden rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_50%_48%,hsl(var(--primary)/0.13),transparent_34%)]">
          <svg viewBox="0 0 720 420" role="img" aria-label="Mental Model semantic repository graph" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="mental-model-link" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="hsl(var(--primary))" stopOpacity="0.45" />
                <stop offset="1" stopColor="hsl(var(--accent))" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            {model.connections.map((connection, index) => {
              const from = model.nodes.find(node => node.id === connection.from);
              const to = model.nodes.find(node => node.id === connection.to);
              if (!from || !to) return null;
              const activeConnection = connection.from === active.id || connection.to === active.id;
              return (
                <g key={`${connection.from}-${connection.to}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="url(#mental-model-link)"
                    strokeWidth={activeConnection ? 2.6 : 1.3}
                    strokeOpacity={activeConnection ? 0.85 : 0.32}
                    strokeDasharray={connection.evidence.length ? '0' : '5 7'}
                    className="transition-all duration-700"
                    style={{ transitionDelay: `${index * 70}ms` }}
                  />
                </g>
              );
            })}
          </svg>

          {model.nodes.map((node, index) => {
            const activeNode = active.id === node.id;
            const storyNode = storyNodeId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                aria-pressed={activeNode}
                className={`absolute w-[126px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-500 animate-scale-in ${
                  activeNode
                    ? 'border-primary/60 bg-primary/15 shadow-primary/20'
                    : node.status === 'strong'
                      ? 'border-success/35 bg-background/45'
                      : node.status === 'partial'
                        ? 'border-primary/25 bg-background/35'
                        : 'border-warning/35 bg-background/30'
                } ${!activeNode && storyNodeId ? 'opacity-55' : ''} ${storyNode ? 'ring-1 ring-primary/45' : ''}`}
                style={{ left: `${(node.x / 720) * 100}%`, top: `${(node.y / 420) * 100}%`, animationDelay: `${index * 85}ms` }}
                aria-label={`${node.label}: ${node.status} signal`}
              >
                <span className={`mb-2 block h-2 w-2 rounded-full ${node.status === 'strong' ? 'bg-success' : node.status === 'partial' ? 'bg-primary-glow' : 'bg-warning'}`} />
                <span className="block text-sm font-semibold leading-tight text-foreground">{node.label}</span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">{node.evidence[0] || 'Needs evidence'}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{active.label}</h3>
                <Badge variant="outline" className={mentalModelStatusClass(active.status)}>
                  {mentalModelStatusLabel(active.status)}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active.description}</p>
              {activeChapter?.mentalModelNodeId === active.id && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{activeChapter.relationship}</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <RepositoryDnaList title="Evidence" items={active.evidence} emptyText="No strong evidence surfaced." compact />
            <RepositoryDnaList title="Connections" items={related.map(connection => connection.label)} emptyText="No strong relationship surfaced." compact />
          </div>
        </div>
      </div>
    </div>
  );
}

type RepositoryDnaDimensionId =
  | 'documentation'
  | 'architecture'
  | 'projectMemory'
  | 'contextEfficiency'
  | 'aiRouting'
  | 'verification';

interface RepositoryDnaDimension {
  id: RepositoryDnaDimensionId;
  label: string;
  shortLabel: string;
  description: string;
  score: number | null;
  potentialScore: number | null;
  source: 'Evidence' | 'Heuristic';
  evidence: string[];
  recommendations: string[];
  signals: string[];
  missing: string[];
}

function RepositoryDnaVisualization({
  dimensions,
  unavailable,
  activeDimensionId,
  activeChapter,
  onSelectDimension,
}: {
  dimensions: RepositoryDnaDimension[];
  unavailable: boolean;
  activeDimensionId?: RepositoryDnaDimensionId;
  activeChapter: WorkspaceStoryChapter | null;
  onSelectDimension: (dimensionId: RepositoryDnaDimensionId) => void;
}) {
  const [localActiveId, setLocalActiveId] = useState<RepositoryDnaDimensionId>(dimensions[0]?.id || 'documentation');
  const activeId = activeDimensionId || localActiveId;
  const active = dimensions.find(dimension => dimension.id === activeId) || dimensions[0];
  const center = 160;
  const outerRadius = 112;
  const total = dimensions.length;
  const currentPoints = dimensions.map((dimension, index) => {
    const point = radarPoint(index, total, radiusForScore(dimension.score, outerRadius), center);
    return `${point.x},${point.y}`;
  }).join(' ');
  const potentialPoints = dimensions.map((dimension, index) => {
    const point = radarPoint(index, total, radiusForScore(dimension.potentialScore, outerRadius), center);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className="flex h-full min-h-[472px] flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository DNA</div>
          <h2 className="mt-1 font-display text-2xl font-semibold">AI workspace profile</h2>
          {activeChapter?.dnaDimensionId && <p className="mt-1 text-sm text-muted-foreground">Linked to {activeChapter.label}</p>}
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary-glow">
          Evidence-backed
        </Badge>
      </div>

      <div className="grid flex-1 gap-5 lg:grid-rows-[auto_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-[360px]">
          <svg viewBox="0 0 320 320" role="img" aria-label="Repository DNA radar profile" className="h-full w-full overflow-visible">
            <defs>
              <radialGradient id="repository-dna-fill" cx="50%" cy="48%" r="62%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.36" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.08" />
              </radialGradient>
              <linearGradient id="repository-dna-stroke" x1="32" y1="32" x2="288" y2="288">
                <stop stopColor="hsl(var(--primary))" />
                <stop offset="1" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map(ring => (
              <polygon
                key={ring}
                points={dimensions.map((_, index) => {
                  const point = radarPoint(index, total, outerRadius * ring, center);
                  return `${point.x},${point.y}`;
                }).join(' ')}
                fill="none"
                stroke="hsl(var(--border))"
                strokeOpacity={ring === 1 ? 0.38 : 0.18}
                strokeWidth={ring === 1 ? 1.2 : 1}
              />
            ))}

            {dimensions.map((dimension, index) => {
              const outer = radarPoint(index, total, outerRadius, center);
              const current = radarPoint(index, total, radiusForScore(dimension.score, outerRadius), center);
              const potential = radarPoint(index, total, radiusForScore(dimension.potentialScore, outerRadius), center);
              const selected = activeId === dimension.id;
              const unavailableDimension = unavailable || dimension.score === null;

              return (
                <g key={dimension.id}>
                  <line
                    x1={center}
                    y1={center}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="hsl(var(--primary))"
                    strokeOpacity={selected ? 0.42 : 0.18}
                    strokeWidth={selected ? 1.6 : 1}
                    className="transition-all duration-500"
                    style={{ transitionDelay: `${index * 90}ms` }}
                  />
                  <circle
                    cx={potential.x}
                    cy={potential.y}
                    r={selected ? 4.5 : 3}
                    fill="hsl(var(--success))"
                    fillOpacity={unavailableDimension ? 0.16 : 0.54}
                    className="transition-all duration-500"
                  />
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`${dimension.label}: ${dimension.score === null ? 'unavailable' : `${dimension.score} current score`}`}
                    onFocus={() => setLocalActiveId(dimension.id)}
                    onClick={() => {
                      setLocalActiveId(dimension.id);
                      onSelectDimension(dimension.id);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setLocalActiveId(dimension.id);
                        onSelectDimension(dimension.id);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <circle
                      cx={current.x}
                      cy={current.y}
                      r={selected ? 8 : 6}
                      fill={unavailableDimension ? 'hsl(var(--warning))' : 'hsl(var(--primary))'}
                      fillOpacity={unavailableDimension ? 0.65 : 0.95}
                      stroke="hsl(var(--background))"
                      strokeWidth="3"
                      className="transition-all duration-500 animate-scale-in"
                      style={{ animationDelay: `${index * 120}ms` }}
                    />
                    <circle
                      cx={current.x}
                      cy={current.y}
                      r={selected ? 15 : 11}
                      fill="transparent"
                      stroke={selected ? 'hsl(var(--primary))' : 'transparent'}
                      strokeOpacity="0.38"
                    />
                  </g>
                  <text
                    x={outer.x}
                    y={outer.y}
                    dy={outer.y < center ? -12 : outer.y > center ? 18 : 4}
                    textAnchor={outer.x < center - 10 ? 'end' : outer.x > center + 10 ? 'start' : 'middle'}
                    className="fill-muted-foreground text-[10px] font-semibold"
                  >
                    {dimension.shortLabel}
                  </text>
                </g>
              );
            })}

            <polygon points={potentialPoints} fill="none" stroke="hsl(var(--success))" strokeOpacity="0.56" strokeWidth="1.4" strokeDasharray="5 6" />
            <polygon points={currentPoints} fill="url(#repository-dna-fill)" stroke="url(#repository-dna-stroke)" strokeWidth="2.5" className="animate-fade-in" />
            <circle cx={center} cy={center} r="25" fill="hsl(var(--background))" fillOpacity="0.68" stroke="hsl(var(--primary))" strokeOpacity="0.24" />
            <text x={center} y={center - 3} textAnchor="middle" className="fill-foreground font-display text-[13px] font-semibold">DNA</text>
            <text x={center} y={center + 13} textAnchor="middle" className="fill-muted-foreground text-[8px]">Workspace</text>
          </svg>
        </div>

        <div className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{active.label}</h3>
                <Badge variant="outline" className={active.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
                  {active.source}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active.description}</p>
              {activeChapter?.dnaDimensionId === active.id && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{activeChapter.repositoryMeaning}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">{active.score === null ? 'Unavailable' : `${active.score}`}</div>
              <div className="text-xs text-muted-foreground">Potential {active.potentialScore === null ? 'n/a' : active.potentialScore}</div>
            </div>
          </div>

          <RepositoryDnaList title="Evidence" items={active.evidence} emptyText="No strong evidence surfaced." />
          <RepositoryDnaList title="Recommendations" items={active.recommendations} emptyText="No recommendation generated." />
          <details className="mt-4 rounded-xl border border-border/60 bg-background/20 p-3">
            <summary className="cursor-pointer select-none text-sm font-medium">Signals and missing pieces</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <RepositoryDnaList title="Signals" items={active.signals} emptyText="No signal surfaced." compact />
              <RepositoryDnaList title="Missing pieces" items={active.missing} emptyText="No major missing piece surfaced." compact />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function RepositoryDnaList({
  title,
  items,
  emptyText,
  compact = false,
}: {
  title: string;
  items: string[];
  emptyText: string;
  compact?: boolean;
}) {
  const visible = compact ? items.slice(0, 4) : items.slice(0, 3);
  return (
    <div className={compact ? '' : 'mt-4'}>
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      {visible.length ? (
        <ul className="mt-2 space-y-2">
          {visible.map(item => (
            <li key={item} className="text-sm leading-relaxed text-foreground/90">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function radarPoint(index: number, total: number, radius: number, center: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Number((center + Math.cos(angle) * radius).toFixed(2)),
    y: Number((center + Math.sin(angle) * radius).toFixed(2)),
  };
}

function radiusForScore(score: number | null, radius: number) {
  if (score === null) return radius * 0.12;
  return radius * Math.max(0.08, Math.min(100, score) / 100);
}

function buildRepositoryDna(report: ReadinessReport): RepositoryDnaDimension[] {
  const health = report.repositoryHealth;
  const files = normalizedReportFiles(report);
  const documentationFiles = firstMatchingFiles(files, [/readme/i, /(^|\/)docs\//i, /architecture/i, /changelog/i], 4);
  const architectureFiles = firstMatchingFiles(files, [/architecture/i, /adr/i, /(^|\/)src\//i, /(^|\/)app\//i], 4);
  const instructionFiles = uniqueStrings([...report.summary.instructionFiles, ...report.repoContextPack.existingInstructionFiles]).slice(0, 4);
  const verificationFiles = firstMatchingFiles(files, [/test/i, /spec/i, /vitest/i, /jest/i, /\.github\/workflows/i], 4);
  const ignoredFolders = (report.scanEvidence.ignoredFolders || []).slice(0, 4);
  const sourceFolders = uniqueStrings([...(report.summary.keyFolders || []), ...(report.repoContextPack.keyFolders || [])]).slice(0, 4);
  const runCommands = (report.stack.runCommands || []).map(command => command.label).slice(0, 4);

  return [
    dnaDimension({
      report,
      id: 'documentation',
      label: 'Documentation',
      shortLabel: 'Docs',
      description: 'The visible onboarding path for humans and AI coding agents.',
      score: averageScores(health.dimensions.repositoryIntelligence.score, health.dimensions.deliveryConfidence.score),
      source: documentationFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...documentationFiles,
        ...signalEvidence(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs', 'architecture']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['repositoryIntelligence', 'deliveryConfidence']),
        documentationFiles.length ? 'Keep the strongest docs current and linked from the main README.' : 'Add a concise README path for setup, architecture and safe change workflow.',
      ]),
      signals: signalLabels(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs', 'architecture']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs', 'architecture']),
        documentationFiles.length ? '' : 'README or active docs entry point',
      ]),
    }),
    dnaDimension({
      report,
      id: 'architecture',
      label: 'Architecture',
      shortLabel: 'Shape',
      description: 'How clearly repository structure reveals where product behavior lives.',
      score: averageScores(health.dimensions.repositoryIntelligence.score, health.dimensions.agentRouting.score),
      source: sourceFolders.length || architectureFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...sourceFolders.map(folder => `Key folder: ${folder}`),
        ...architectureFiles,
        report.stack.primary !== 'Unknown' ? `Detected stack: ${report.stack.primary}` : '',
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['repositoryIntelligence', 'agentRouting']),
        sourceFolders.length ? 'Document which folders are product-critical and which are support surfaces.' : 'Add a short architecture map that names critical folders and entry points.',
      ]),
      signals: compactText([
        ...signalLabels(health.dimensions.repositoryIntelligence.signals, ['entry', 'source', 'architecture', 'folder']),
        ...signalLabels(health.dimensions.agentRouting.signals, ['folder', 'route', 'source']),
      ]),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.repositoryIntelligence.signals, ['entry', 'source', 'architecture', 'folder']),
        sourceFolders.length ? '' : 'Critical source folder map',
      ]),
    }),
    dnaDimension({
      report,
      id: 'projectMemory',
      label: 'Project Memory',
      shortLabel: 'Memory',
      description: 'Persistent instructions and context anchors agents can reuse between tasks.',
      score: health.dimensions.repositoryIntelligence.score,
      source: instructionFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...instructionFiles,
        ...signalEvidence(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction', 'memory', 'context']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['repositoryIntelligence']),
        instructionFiles.length ? 'Keep agent instructions short, current and linked to repository-specific workflows.' : 'Add AGENTS.md or equivalent project memory for agent onboarding.',
      ]),
      signals: signalLabels(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction', 'memory', 'context']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction', 'memory', 'context']),
        instructionFiles.length ? '' : 'Agent instruction file',
      ]),
    }),
    dnaDimension({
      report,
      id: 'contextEfficiency',
      label: 'Context Efficiency',
      shortLabel: 'Context',
      description: 'How much avoidable context can stay out of the first agent pass.',
      score: health.dimensions.contextWaste.contextEfficiencyScore,
      source: ignoredFolders.length || health.dimensions.contextWaste.contextEfficiencyScore !== null ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...ignoredFolders.map(folder => `Ignored folder: ${folder}`),
        `${report.scanSummary.generatedVendorFilesIgnored + report.scanSummary.binaryFilesIgnored} generated, vendor or binary files ignored`,
        ...signalEvidence(health.dimensions.contextWaste.signals, ['generated', 'vendor', 'binary', 'ignore', 'context']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['contextWaste']),
        ignoredFolders.length ? 'Keep generated and vendor folders excluded from first-pass agent context.' : 'Mark generated, vendor and build-output folders so agents avoid noisy context.',
      ]),
      signals: signalLabels(health.dimensions.contextWaste.signals, ['generated', 'vendor', 'binary', 'ignore', 'context']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.contextWaste.signals, ['generated', 'vendor', 'binary', 'ignore', 'context']),
        ignoredFolders.length ? '' : 'Explicit generated/vendor ignore map',
      ]),
    }),
    dnaDimension({
      report,
      id: 'aiRouting',
      label: 'AI Routing',
      shortLabel: 'Routing',
      description: 'How quickly an agent can map a task to the right files and verification path.',
      score: health.dimensions.agentRouting.score,
      source: sourceFolders.length || instructionFiles.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...sourceFolders.map(folder => `Routable folder: ${folder}`),
        ...instructionFiles.map(file => `Instruction anchor: ${file}`),
        ...signalEvidence(health.dimensions.agentRouting.signals, ['route', 'folder', 'agent', 'entry', 'test']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['agentRouting']),
        'Add or maintain folder-level guidance for where agents should start common changes.',
      ]),
      signals: signalLabels(health.dimensions.agentRouting.signals, ['route', 'folder', 'agent', 'entry', 'test']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.agentRouting.signals, ['route', 'folder', 'agent', 'entry', 'test']),
        sourceFolders.length && instructionFiles.length ? '' : 'Folder-to-task routing guidance',
      ]),
    }),
    dnaDimension({
      report,
      id: 'verification',
      label: 'Verification',
      shortLabel: 'Verify',
      description: 'The available test, build and review path after an AI-assisted change.',
      score: health.dimensions.aiDevelopmentReadiness.score,
      source: verificationFiles.length || runCommands.length ? 'Evidence' : 'Heuristic',
      evidence: compactText([
        ...verificationFiles,
        ...runCommands.map(command => `Command: ${command}`),
        ...signalEvidence(health.dimensions.aiDevelopmentReadiness.signals, ['test', 'build', 'lint', 'ci', 'verify']),
      ]),
      recommendations: compactText([
        ...recommendationsForDimensions(report, ['aiDevelopmentReadiness']),
        runCommands.length ? 'Keep build, lint and test commands obvious for every agent handoff.' : 'Declare build, lint and test commands where agents can find them.',
      ]),
      signals: signalLabels(health.dimensions.aiDevelopmentReadiness.signals, ['test', 'build', 'lint', 'ci', 'verify']),
      missing: compactText([
        ...missingSignalLabels(health.dimensions.aiDevelopmentReadiness.signals, ['test', 'build', 'lint', 'ci', 'verify']),
        runCommands.length ? '' : 'Declared verification commands',
      ]),
    }),
  ];
}

function dnaDimension(input: Omit<RepositoryDnaDimension, 'potentialScore'> & { report: ReadinessReport }) {
  const relevantActions = input.report.repositoryHealth.topActions.filter(action =>
    action.dimensions.some(dimension => recommendationDimensions(input.id).includes(dimension))
  );
  const potentialGain = Math.max(0, ...relevantActions.map(action => action.potentialDimensionGain));
  const potentialScore = input.score === null ? null : Math.min(100, input.score + potentialGain);
  const { report: _report, ...dimension } = input;
  return {
    ...dimension,
    potentialScore,
    evidence: compactText(dimension.evidence),
    recommendations: compactText(dimension.recommendations),
    signals: compactText(dimension.signals),
    missing: compactText(dimension.missing),
  };
}

function recommendationDimensions(id: RepositoryDnaDimensionId) {
  if (id === 'contextEfficiency') return ['contextWaste'];
  if (id === 'aiRouting') return ['agentRouting'];
  if (id === 'verification') return ['aiDevelopmentReadiness'];
  if (id === 'documentation') return ['repositoryIntelligence', 'deliveryConfidence'];
  return ['repositoryIntelligence', 'agentRouting'];
}

function recommendationsForDimensions(report: ReadinessReport, dimensions: ReturnType<typeof recommendationDimensions>) {
  return report.repositoryHealth.topActions
    .filter(action => action.dimensions.some(dimension => dimensions.includes(dimension)))
    .map(action => action.action);
}

function averageScores(...scores: Array<number | null>) {
  const available = scores.filter((score): score is number => score !== null);
  if (!available.length) return null;
  return Math.round(available.reduce((sum, score) => sum + score, 0) / available.length);
}

function signalEvidence(signals: RepositoryHealthSignal[], terms: string[]) {
  return signals
    .filter(signal => signal.evidence.length && textMatchesTerms(`${signal.id} ${signal.label} ${signal.evidence.join(' ')}`, terms))
    .flatMap(signal => signal.evidence)
    .slice(0, 4);
}

function signalLabels(signals: RepositoryHealthSignal[], terms: string[]) {
  return signals
    .filter(signal => textMatchesTerms(`${signal.id} ${signal.label}`, terms))
    .map(signal => `${signal.label}: ${signal.status}`);
}

function missingSignalLabels(signals: RepositoryHealthSignal[], terms: string[]) {
  return signals
    .filter(signal => (signal.status === 'fail' || signal.status === 'partial' || signal.status === 'unknown') && textMatchesTerms(`${signal.id} ${signal.label}`, terms))
    .map(signal => signal.label);
}

function textMatchesTerms(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some(term => normalized.includes(term.toLowerCase()));
}

function compactText(items: string[]) {
  return uniqueStrings(items.map(item => item.trim()).filter(Boolean));
}

function buildMentalModel(report: ReadinessReport): MentalModel {
  const files = normalizedReportFiles(report);
  const health = report.repositoryHealth;
  const documentationFiles = firstMatchingFiles(files, [/readme/i, /(^|\/)docs\//i, /architecture/i], 3);
  const sourceFolders = uniqueStrings([...(report.summary.keyFolders || []), ...(report.repoContextPack.keyFolders || [])]).slice(0, 4);
  const sourceFiles = firstMatchingFiles(files, [/^src\//i, /^app\//i, /^components\//i, /^lib\//i], 3);
  const instructionFiles = uniqueStrings([...report.summary.instructionFiles, ...report.repoContextPack.existingInstructionFiles]).slice(0, 3);
  const testFiles = firstMatchingFiles(files, [/test/i, /spec/i, /__tests__/i], 3);
  const ciFiles = firstMatchingFiles(files, [/\.github\/workflows/i, /gitlab-ci/i, /circleci/i], 2);
  const runCommands = (report.stack.runCommands || []).map(command => command.label).slice(0, 3);
  const ignoredCount = report.scanSummary.generatedVendorFilesIgnored + report.scanSummary.binaryFilesIgnored;
  const ignoredFolders = (report.scanEvidence.ignoredFolders || []).slice(0, 3);
  const topAction = health.topActions[0];

  const nodes: MentalModelNode[] = [
    {
      id: 'documentation',
      label: 'Documentation',
      description: 'The onboarding surface ShipSeal found for humans and agents.',
      evidence: compactText(documentationFiles.length ? documentationFiles : signalEvidence(health.dimensions.repositoryIntelligence.signals, ['readme', 'documentation', 'docs'])),
      status: documentationFiles.length ? 'strong' : health.dimensions.repositoryIntelligence.score !== null ? 'partial' : 'missing',
      x: 160,
      y: 105,
    },
    {
      id: 'architecture',
      label: 'Architecture',
      description: 'The project shape inferred from stack, folders and architecture signals.',
      evidence: compactText([
        report.stack.primary !== 'Unknown' ? `Stack: ${report.stack.primary}` : '',
        ...sourceFolders.map(folder => `Folder: ${folder}`),
        ...signalEvidence(health.dimensions.repositoryIntelligence.signals, ['architecture', 'entry', 'source']),
      ]),
      status: scoreToMentalModelStatus(averageScores(health.dimensions.repositoryIntelligence.score, health.dimensions.agentRouting.score)),
      x: 360,
      y: 72,
    },
    {
      id: 'source',
      label: 'Source',
      description: 'Where ShipSeal believes product behavior is likely to live.',
      evidence: compactText([...sourceFolders.map(folder => `Key folder: ${folder}`), ...sourceFiles]),
      status: sourceFolders.length || sourceFiles.length ? 'strong' : 'missing',
      x: 548,
      y: 156,
    },
    {
      id: 'aiInstructions',
      label: 'AI Instructions',
      description: 'Reusable project memory for coding agents.',
      evidence: compactText(instructionFiles.length ? instructionFiles : signalEvidence(health.dimensions.repositoryIntelligence.signals, ['agent', 'instruction'])),
      status: instructionFiles.length ? 'strong' : 'missing',
      x: 166,
      y: 305,
    },
    {
      id: 'tests',
      label: 'Tests',
      description: 'Verification evidence an agent can use after changing code.',
      evidence: compactText([...testFiles, ...report.stack.testFrameworks.map(framework => `Framework: ${framework}`)]),
      status: testFiles.length || report.stack.testFrameworks.length ? 'strong' : health.dimensions.aiDevelopmentReadiness.score !== null ? 'partial' : 'missing',
      x: 360,
      y: 348,
    },
    {
      id: 'buildCi',
      label: 'Build / CI',
      description: 'Declared commands and automation for repeatable verification.',
      evidence: compactText([...ciFiles, ...runCommands.map(command => `Command: ${command}`)]),
      status: ciFiles.length || runCommands.length ? 'strong' : 'missing',
      x: 560,
      y: 300,
    },
    {
      id: 'context',
      label: 'Context',
      description: 'Signals that help agents avoid generated, vendor or noisy files.',
      evidence: compactText([
        ignoredCount ? `${ignoredCount} generated, vendor or binary files ignored` : '',
        ...ignoredFolders.map(folder => `Ignored: ${folder}`),
      ]),
      status: ignoredCount || ignoredFolders.length || health.dimensions.contextWaste.contextEfficiencyScore !== null ? 'strong' : 'partial',
      x: 360,
      y: 210,
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'The most useful improvement ShipSeal can see from the current evidence.',
      evidence: compactText(topAction ? [topAction.title, ...topAction.evidence.slice(0, 2)] : []),
      status: topAction ? 'strong' : 'partial',
      x: 76,
      y: 205,
    },
  ];

  const evidenceFor = (id: MentalModelNodeId) => nodes.find(node => node.id === id)?.evidence || [];
  const connections: MentalModelConnection[] = [
    {
      from: 'documentation',
      to: 'architecture',
      label: documentationFiles.length ? 'Docs explain the project shape.' : 'Docs should become the entry point to architecture.',
      evidence: evidenceFor('documentation'),
    },
    {
      from: 'architecture',
      to: 'source',
      label: sourceFolders.length ? 'Architecture resolves into source folders.' : 'Source routing needs clearer folder evidence.',
      evidence: evidenceFor('source'),
    },
    {
      from: 'aiInstructions',
      to: 'source',
      label: instructionFiles.length ? 'Agent memory points toward implementation work.' : 'Agent memory is missing from source discovery.',
      evidence: evidenceFor('aiInstructions'),
    },
    {
      from: 'source',
      to: 'tests',
      label: testFiles.length || report.stack.testFrameworks.length ? 'Source changes have a verification path.' : 'Source-to-test relationship is unclear.',
      evidence: evidenceFor('tests'),
    },
    {
      from: 'tests',
      to: 'buildCi',
      label: runCommands.length || ciFiles.length ? 'Verification can be run through declared commands.' : 'Build and CI evidence is thin.',
      evidence: evidenceFor('buildCi'),
    },
    {
      from: 'context',
      to: 'source',
      label: ignoredCount || ignoredFolders.length ? 'Context filters protect source exploration from noise.' : 'Context filtering is mostly inferred.',
      evidence: evidenceFor('context'),
    },
    {
      from: 'recommendations',
      to: topAction?.dimensions.includes('agentRouting') ? 'source' : topAction?.dimensions.includes('aiDevelopmentReadiness') ? 'tests' : 'documentation',
      label: topAction ? `Next improvement: ${topAction.title}` : 'No primary recommendation generated.',
      evidence: evidenceFor('recommendations'),
    },
  ];

  return { nodes, connections };
}

function scoreToMentalModelStatus(score: number | null): MentalModelNode['status'] {
  if (score === null) return 'missing';
  if (score >= 70) return 'strong';
  if (score >= 45) return 'partial';
  return 'missing';
}

function mentalModelStatusLabel(status: MentalModelNode['status']) {
  if (status === 'strong') return 'Understood';
  if (status === 'partial') return 'Partly understood';
  return 'Needs evidence';
}

function mentalModelStatusClass(status: MentalModelNode['status']) {
  if (status === 'strong') return 'border-success/40 text-success';
  if (status === 'partial') return 'border-primary/40 text-primary-glow';
  return 'border-warning/50 text-warning';
}

function workspaceUnderstandingSentence(report: ReadinessReport) {
  const status = report.repositoryHealth.overall.status;
  if (status === 'AI-ready workspace') return 'This repository is well prepared for AI-assisted development.';
  if (status === 'Workable with optimization') return 'This repository has a usable AI workspace forming.';
  if (status === 'Fragmented workspace') return 'This repository has useful signals, but the workspace is fragmented.';
  if (status === 'High agent friction') return 'This repository can be understood, but agents will hit friction.';
  if (status === 'Blocked') return 'ShipSeal found a blocker before this can become a reliable AI workspace.';
  return 'ShipSeal built the first map of this repository.';
}

function WorkspaceOverview({ report }: { report: ReadinessReport }) {
  const health = report.repositoryHealth;
  const friction = health.dimensions.contextWaste.riskScore;
  const projectMemoryAnchors = report.summary.instructionFiles.length + report.repoContextPack.keyFolders.length;

  const cards = [
    {
      label: 'Workspace Quality',
      value: health.overall.score === null ? 'Unavailable' : `${health.overall.score} / 100`,
      detail: 'Primary workspace metric',
      badge: 'Current',
      badgeClass: 'border-primary/45 text-primary-glow',
    },
    {
      label: 'Repository Friction',
      value: friction === null ? 'Unavailable' : `${friction} / 100`,
      detail: 'Higher friction means more context discovery',
      badge: contextWasteRiskLabel(friction),
      badgeClass: contextWasteRiskClass(friction),
    },
    {
      label: 'Project Memory',
      value: projectMemoryAnchors ? `${projectMemoryAnchors} anchors` : 'Planned',
      detail: 'Instructions, folders, context',
      badge: projectMemoryAnchors ? 'Detected' : 'Upcoming',
      badgeClass: projectMemoryAnchors ? 'border-primary/45 text-primary-glow' : 'border-border/70 text-muted-foreground',
    },
    {
      label: 'Agent Productivity',
      value: 'Planned',
      detail: 'Future workspace analytics',
      badge: 'Upcoming',
      badgeClass: 'border-border/70 text-muted-foreground',
    },
  ];

  return (
    <section className="mb-8" aria-labelledby="workspace-overview-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace Overview</div>
          <h2 id="workspace-overview-heading" className="mt-1 font-display text-2xl font-semibold">Repository as an AI workspace</h2>
        </div>
        <Badge variant="outline" className="border-border/70 bg-background/25">
          Static scan
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <article key={card.label} className="glass rounded-2xl p-5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold">{card.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
              </div>
              <Badge variant="outline" className={card.badgeClass}>{card.badge}</Badge>
            </div>
            <div className="mt-5 text-2xl font-semibold tracking-tight">{card.value}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

type SimulatorSignalSource = 'Evidence' | 'Heuristic';

interface SimulatorStep {
  id: WorkspaceStoryAgentStepId;
  title: string;
  detail: string;
  source: SimulatorSignalSource;
}

interface SimulatorRecommendation {
  label: string;
  reason: string;
  source: SimulatorSignalSource;
}

interface SimulatorPlan {
  steps: SimulatorStep[];
  likelyFirstFiles: SimulatorRecommendation[];
  likelyIgnoredFolders: SimulatorRecommendation[];
  contextReduction: string;
  routingQuality: string;
  heuristics: string[];
}

function LiveAgentSimulator({ report, activeChapter }: { report: ReadinessReport; activeChapter?: WorkspaceStoryChapter | null }) {
  const plan = buildAgentSimulatorPlan(report);
  const [activeStep, setActiveStep] = useState(0);
  const [runId, setRunId] = useState(0);
  const complete = activeStep >= plan.steps.length - 1;
  const highlightedStepIds = new Set(activeChapter?.agentStepIds || []);

  useEffect(() => {
    setActiveStep(0);
    const interval = window.setInterval(() => {
      setActiveStep(current => {
        if (current >= plan.steps.length - 1) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, 650);

    return () => window.clearInterval(interval);
  }, [report.scannedAt, report.repoName, plan.steps.length, runId]);

  return (
    <section className="mb-8" aria-labelledby="live-agent-simulator-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Live Agent Simulator</div>
          <h2 id="live-agent-simulator-heading" className="mt-1 font-display text-2xl font-semibold">Estimated repository exploration</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActiveStep(0);
            setRunId(current => current + 1);
          }}
          className="border-border/60"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Replay
        </Button>
      </div>

      <div className="glass rounded-3xl p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <div className="mb-5 rounded-2xl border border-border/60 bg-secondary/15 p-4 text-sm text-muted-foreground">
              Estimated repository exploration based on ShipSeal Repository Intelligence.
            </div>
            <div className="space-y-3">
              {plan.steps.map((step, index) => {
                const state = index < activeStep ? 'done' : index === activeStep ? 'active' : 'upcoming';
                const storyRelated = highlightedStepIds.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border p-4 transition-all duration-500 ${
                      state === 'active'
                        ? 'border-primary/45 bg-primary/10 shadow-sm shadow-primary/10'
                        : state === 'done'
                          ? 'border-success/30 bg-success/5'
                          : 'border-border/50 bg-secondary/10 opacity-70'
                    } ${storyRelated ? 'ring-1 ring-primary/35' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        state === 'done'
                          ? 'border-success/50 text-success'
                          : state === 'active'
                            ? 'border-primary/60 text-primary-glow'
                            : 'border-border/70 text-muted-foreground'
                      }`}>
                        {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                          <Badge variant="outline" className={step.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
                            {step.source}
                          </Badge>
                          {storyRelated && (
                            <Badge variant="outline" className="border-primary/35 text-primary-glow">
                              Story signal
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className={`rounded-2xl border border-border/60 bg-secondary/15 p-5 transition-opacity duration-500 ${complete ? 'opacity-100' : 'opacity-55'}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-glow" />
                <h3 className="font-display font-semibold">Workspace understanding {complete ? 'complete' : 'in progress'}</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <SummaryTile label="Context reduction" value={plan.contextReduction} />
                <SummaryTile label="Routing quality" value={plan.routingQuality} />
              </div>
            </div>

            {complete && (
              <>
                <SimulatorRecommendationList title="Likely first files" items={plan.likelyFirstFiles} />
                <SimulatorRecommendationList title="Likely ignored folders" items={plan.likelyIgnoredFolders} />
                <details className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
                  <summary className="cursor-pointer select-none text-sm font-semibold">Temporary heuristics</summary>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {plan.heuristics.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SimulatorRecommendationList({ title, items }: { title: string; items: SimulatorRecommendation[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/15 p-5">
      <h3 className="font-display font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map(item => (
          <div key={`${title}-${item.label}`} className="rounded-xl border border-border/50 bg-background/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
              <Badge variant="outline" className={item.source === 'Evidence' ? 'border-primary/40 text-primary-glow' : 'border-border/70 text-muted-foreground'}>
                {item.source}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildAgentSimulatorPlan(report: ReadinessReport): SimulatorPlan {
  const files = normalizedReportFiles(report);
  const docs = firstMatchingFiles(files, [
    /(^|\/)readme\.md$/i,
    /(^|\/)docs\/readme\.md$/i,
    /(^|\/)documentation\.md$/i,
  ], 2);
  const architecture = firstMatchingFiles(files, [
    /(^|\/)architecture(\.md)?$/i,
    /(^|\/)docs\/architecture(\.md)?$/i,
    /(^|\/)system[-_ ]?design(\.md)?$/i,
    /(^|\/)docs\/.*architecture.*\.md$/i,
  ], 2);
  const instructionFiles = uniqueStrings([
    ...report.summary.instructionFiles,
    ...firstMatchingFiles(files, [
      /(^|\/)agents\.md$/i,
      /(^|\/)claude\.md$/i,
      /(^|\/)\.cursorrules$/i,
      /(^|\/)\.cursor\/rules/i,
    ], 3),
  ]).slice(0, 3);
  const manifestFiles = firstMatchingFiles(files, [
    /(^|\/)package\.json$/i,
    /(^|\/)pyproject\.toml$/i,
    /(^|\/)go\.mod$/i,
    /(^|\/)cargo\.toml$/i,
    /(^|\/)pom\.xml$/i,
  ], 2);
  const sourceFolders = report.summary.keyFolders.slice(0, 4);
  const ignoredFolders = likelyIgnoredFolders(report);
  const likelyFirstFiles = likelyFirstFilesForSimulator(report, docs, architecture, instructionFiles, manifestFiles, files);

  const steps: SimulatorStep[] = [
    {
      id: 'repositoryDetected',
      title: 'Repository detected',
      detail: `${report.scanEvidence.repositoryFullName} from ${displayEvidenceSource(report.scanEvidence.sourceType)}.`,
      source: 'Evidence',
    },
    {
      id: 'frameworkIdentified',
      title: 'Framework identified',
      detail: report.stack.primary !== 'Unknown'
        ? `${report.stack.primary}; ${report.stack.languages.join(', ') || 'language signals unavailable'}.`
        : 'No strong framework signal was detected; the simulator falls back to file and manifest heuristics.',
      source: report.stack.primary !== 'Unknown' ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'findDocumentation',
      title: 'Looking for project documentation',
      detail: docs.length ? `Starts with ${docs.join(', ')}.` : 'No README-like file was found in scanned evidence.',
      source: docs.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'searchArchitecture',
      title: 'Searching architecture',
      detail: architecture.length ? `Architecture signal: ${architecture.join(', ')}.` : 'No architecture file was detected; folder map and stack signals become more important.',
      source: architecture.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'locateAiInstructions',
      title: 'Locating AI instruction files',
      detail: instructionFiles.length ? `Instruction signal: ${instructionFiles.join(', ')}.` : 'No AGENTS, CLAUDE or tool instruction file was detected.',
      source: instructionFiles.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'findBuildAndTest',
      title: 'Finding build and test commands',
      detail: report.stack.runCommands.length ? report.stack.runCommands.slice(0, 3).map(command => `${command.label}: ${command.cmd}`).join('; ') : 'No declared build or test commands were detected.',
      source: report.stack.runCommands.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'ignoreGeneratedFolders',
      title: 'Ignoring generated folders',
      detail: ignoredFolders.length ? `Likely skipped: ${ignoredFolders.slice(0, 5).map(folder => folder.label).join(', ')}.` : 'No generated/vendor folders were reported by the scan.',
      source: ignoredFolders.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'identifySourceFolders',
      title: 'Identifying critical source folders',
      detail: sourceFolders.length ? `Likely starting folders: ${sourceFolders.join(', ')}.` : 'Source folders are inferred from common project layouts.',
      source: sourceFolders.length ? 'Evidence' : 'Heuristic',
    },
    {
      id: 'workspaceComplete',
      title: 'Workspace understanding complete',
      detail: 'The plan is ready for a first-pass coding-agent handoff.',
      source: 'Heuristic',
    },
  ];

  return {
    steps,
    likelyFirstFiles,
    likelyIgnoredFolders: ignoredFolders.length ? ignoredFolders : fallbackIgnoredFolders(),
    contextReduction: estimatedContextReduction(report),
    routingQuality: estimatedRoutingQuality(report),
    heuristics: [
      'Context reduction is estimated from ignored/generated file counts, not measured token usage.',
      'Routing quality is estimated from Repository Health agent-routing signals and instruction coverage.',
      'The simulator does not expose Claude, Codex, GPT, or other model internals.',
    ],
  };
}

function likelyFirstFilesForSimulator(
  report: ReadinessReport,
  docs: string[],
  architecture: string[],
  instructionFiles: string[],
  manifestFiles: string[],
  files: string[]
): SimulatorRecommendation[] {
  const candidates: SimulatorRecommendation[] = [];
  for (const file of docs) {
    candidates.push({ label: file, reason: 'Project documentation is the highest-signal place to understand purpose and setup.', source: 'Evidence' });
  }
  for (const file of instructionFiles) {
    candidates.push({ label: file, reason: 'Agent instruction files define repository-specific working rules and boundaries.', source: 'Evidence' });
  }
  for (const file of architecture) {
    candidates.push({ label: file, reason: 'Architecture documentation helps route work before opening source files.', source: 'Evidence' });
  }
  for (const file of manifestFiles) {
    candidates.push({ label: file, reason: 'Stack manifests reveal scripts, dependencies and project shape.', source: 'Evidence' });
  }

  if (candidates.length < 5) {
    for (const folder of report.summary.keyFolders.slice(0, 3)) {
      candidates.push({
        label: `${folder}/`,
        reason: 'A key folder was detected in the repository summary and may contain the first source files to inspect.',
        source: 'Evidence',
      });
    }
  }

  if (candidates.length < 5) {
    for (const file of firstMatchingFiles(files, [/src\/main\./i, /src\/index\./i, /app\/page\./i, /pages\/index\./i], 3)) {
      candidates.push({
        label: file,
        reason: 'Common entry-point heuristic used when stronger documentation or routing evidence is limited.',
        source: 'Heuristic',
      });
    }
  }

  return dedupeRecommendations(candidates).slice(0, 6);
}

function likelyIgnoredFolders(report: ReadinessReport): SimulatorRecommendation[] {
  const fromScan = report.scanSummary.ignoredGeneratedFolders.map(folder => ({
    label: folder,
    reason: 'Reported by the scanner as generated or vendor context that should not anchor first-pass exploration.',
    source: 'Evidence' as const,
  }));
  const common = fallbackIgnoredFolders().filter(folder => !fromScan.some(item => normalizePath(item.label) === normalizePath(folder.label)));
  return [...fromScan, ...common].slice(0, 6);
}

function fallbackIgnoredFolders(): SimulatorRecommendation[] {
  return ['node_modules', 'dist', 'coverage', 'build', '.tmp'].map(folder => ({
    label: folder,
    reason: 'Common generated or temporary folder heuristic; skip unless the task specifically targets build artifacts.',
    source: 'Heuristic' as const,
  }));
}

function estimatedContextReduction(report: ReadinessReport) {
  const total = Math.max(report.scanSummary.totalFilesFound || report.fileCount, 1);
  const ignored = Math.max(report.scanSummary.filesIgnored, report.scanSummary.generatedVendorFilesIgnored + report.scanSummary.binaryFilesIgnored);
  const percent = Math.max(0, Math.min(95, Math.round((ignored / total) * 100)));
  if (percent > 0) return `${percent}% estimated`;
  if (report.repositoryHealth.dimensions.contextWaste.riskScore !== null && report.repositoryHealth.dimensions.contextWaste.riskScore <= 25) {
    return 'Low waste';
  }
  return 'Not enough evidence';
}

function estimatedRoutingQuality(report: ReadinessReport) {
  const score = report.repositoryHealth.dimensions.agentRouting.score;
  if (score === null) return 'Unavailable';
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Workable';
  if (score >= 50) return 'Needs routing';
  return 'High friction';
}

function normalizedReportFiles(report: ReadinessReport) {
  return uniqueStrings([
    ...report.sampleFiles.map(file => file.path),
    ...report.repoContextPack.sampleFiles,
    ...report.repoContextPack.existingInstructionFiles,
    ...report.summary.instructionFiles,
  ]).map(path => path.replace(/\\/g, '/'));
}

function firstMatchingFiles(files: string[], patterns: RegExp[], max: number) {
  const matches: string[] = [];
  for (const pattern of patterns) {
    for (const file of files) {
      if (pattern.test(file) && !matches.includes(file)) {
        matches.push(file);
        if (matches.length >= max) return matches;
      }
    }
  }
  return matches;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeRecommendations(items: SimulatorRecommendation[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = normalizePath(item.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function WorkspaceModulePlaceholders() {
  const modules = ['Project Memory', 'Agent Heatmap', 'Context Timeline'];

  return (
    <section className="mb-8" aria-labelledby="workspace-modules-heading">
      <div className="mb-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace modules</div>
        <h2 id="workspace-modules-heading" className="mt-1 font-display text-2xl font-semibold">Next workspace surfaces</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map(module => (
          <article key={module} className="rounded-2xl border border-border/60 bg-secondary/15 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold">{module}</h3>
              <Badge variant="outline" className="border-border/70 text-muted-foreground">Planned</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Coming in upcoming Workspace Optimization updates.
            </p>
          </article>
        ))}
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

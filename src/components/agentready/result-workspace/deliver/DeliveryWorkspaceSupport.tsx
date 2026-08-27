import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { AlertOctagon, Check, CheckCircle2, Copy, Crosshair, Download, FileArchive, Layers, Lightbulb, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { AgentOperatingModeId, AgentPackFile, MCPRiskSeverity, ReadinessReport, ScanHistoryItem } from '@/lib/types';
import { evaluateReadiness } from '@/lib/scoring';
import { ScoreGauge } from '@/components/agentready/ScoreGauge';
import { ReadinessBadge } from '@/components/agentready/ReadinessBadge';
import { CategoryBreakdown } from '@/components/agentready/CategoryBreakdown';
import { AgentPackTabs } from '@/components/agentready/AgentPackTabs';
import { ProjectIntakeForm } from '@/components/agentready/ProjectIntakeForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { buildRepoContextPackJson, buildScoreJson, downloadJsonFile, downloadTextFile } from '@/lib/exports';
import { formatFileSize } from '@/lib/uploadValidation';
import { criticalBlockersEmptyStateText, displayReadinessLevel, readinessStatusMessageForPackage } from '@/lib/uiCopy';
import type { ProjectIntake } from '@/lib/intake';
import { createDefaultProjectIntake, normalizeProjectIntake } from '@/lib/intake';
import { FULL_PACKAGE_ID, getShipSealPackage, resolveSelectedPackages } from '@/lib/packages';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import { getFolderAgentSuggestionPaths } from '@/lib/deliveryPack/folderAgents';
import { buildGitHubConnectionFromReport, type GitHubConnectionState } from '@/lib/githubConnection/types';
import { CreateReadinessPrClientError, createGitHubAppReadinessPr } from '@/lib/github/write';
import { DEFAULT_AGENT_OPERATING_MODE, applyAgentOperatingModeToFiles, getAgentOperatingMode, resolveAgentOperatingMode, selectionUsesAgentDevelopment } from '@/lib/agentOperatingMode';
import { buildToolingRecommendationBundle, recommendationCounts } from '@/lib/toolingRecommendations';
import {
  buildOptimizationApplyPlan,
  buildRepositoryAgentFlightPath,
  buildOptimizationPackZipBlob,
  buildOptimizationPackZipFilename,
  buildRepositoryAtlasModel,
  buildRepositoryOptimizationPlan,
  buildRepositoryTransformationProposalModel,
  buildRepositoryVerificationBaseline,
  buildRepositoryVerificationResult,
  buildRepositoryUniverseModel,
  buildWorkspaceStory,
  chapterForDnaDimension,
  chapterForMentalModelNode,
  repositoryUniverseEdgeVisible,
  repositoryUniverseFilterCounts,
  repositoryUniverseVisibleNodeIds,
  repositoryTransformationDomainCounts,
  serializeRepositoryOptimizationManifest,
  transformationDomainLabel,
  type RepositoryAtlasModel,
  type RepositoryAtlasNode,
  type RepositoryAgentFlightPath,
  type OptimizationApplyPlan,
  type OptimizationPrPreviewFile,
  type RepositoryVerificationBaseline,
  type RepositoryVerificationResult,
  type VerificationBaselineMethod,
  type VerifiedArtifactMatch,
  type RepositoryOptimizationPlan,
  type RepositoryOptimizationPlanItem,
  type RepositoryOptimizationReadiness,
  type RepositoryTransformationDomain,
  type RepositoryTransformationDomainFilter,
  type RepositoryTransformationMode,
  type RepositoryTransformationProposal,
  type RepositoryUniverseFilterKey,
  type RepositoryUniverseModel,
  type RepositoryUniverseNode,
  type RepositoryKnowledgeCluster,
  type RepositoryKnowledgeEdge,
  type WorkspaceStory,
  type WorkspaceStoryAgentStepId,
  type WorkspaceStoryChapter,
  type WorkspaceStoryChapterId,
  type WorkspaceStoryDnaDimensionId,
  type WorkspaceStoryMentalNodeId,
} from '@/lib/workspace';
import { repositoryUniverseClusterLegend, repositoryUniverseFocusCameraState } from '@/lib/workspace/repositoryUniverseVisual';
import type { UniverseCameraState } from '@/components/agentready/RepositoryUniverse3D';
import type { RepositoryIntelligenceReviewUiSession } from '@/components/agentready/RepositoryIntelligenceReviewPanel';
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { PostScanOverview } from '@/components/agentready/result-dashboard/PostScanOverview';
import { ResultChapterNav } from '@/components/agentready/result-dashboard/ResultChapterNav';
import { ResultChapterShell } from '@/components/agentready/result-dashboard/ResultChapterShell';
import { ResultChapterLoadBoundary, ResultChapterLoading } from '@/components/agentready/result-dashboard/ResultChapterLoadBoundary';
import { getResultChapterStatuses, workspaceInsights } from '@/components/agentready/result-dashboard/chapterState';
import { selectRepositoryFrictions } from '@/components/agentready/result-dashboard/repositoryFrictions';
import type { ResultChapterId } from '@/components/agentready/result-dashboard/types';
import {
  displayEvidenceSource,
  displayMcpReadiness,
  isGitHubSource,
} from '../model/deliveryWorkspaceSelectors';

export function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-3 min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

export function ProjectPackageSummary({
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

export function AgentOperatingModeSummary({
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

export function ScanEvidencePanel({ report }: { report: ReadinessReport }) {
  const evidence = report.scanEvidence;
  const keySignals = keyFileSignals(evidence.keyFilesFound);
  const stack = [
    ...evidence.topFrameworks,
    ...evidence.topLanguages.filter(language => !evidence.topFrameworks.includes(language)),
  ].slice(0, 5);
  const bounded = evidence.scanMode === 'bounded';

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-start gap-3">
        <ShieldCheck className={evidence.limitedScan ? 'mt-1 h-5 w-5 text-warning' : 'mt-1 h-5 w-5 text-success'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold">Scan evidence</h3>
            <Badge variant="outline" className={evidence.limitedScan ? 'border-warning/60 text-warning' : 'border-success/40 text-success'}>
              {evidence.limitedScan ? 'Limited fallback' : bounded ? 'Bounded evidence scan' : 'Full evidence scan'}
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
        <SafetyMetric label="Archive size" value={evidence.sourceType === 'zip' ? evidence.approximateArchiveSizeBytes ? formatFileSize(evidence.approximateArchiveSizeBytes) : 'Not reported' : 'Not used'} />
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
                {signal.found ? 'Found' : evidence.discoveryComplete === false ? 'Not observed' : 'Missing'}: {signal.label}
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
      {bounded && (
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm text-foreground/85">
          ShipSeal analyzed {evidence.selectedTextFileCount?.toLocaleString() || evidence.analyzedFileCount.toLocaleString()} selected evidence files and omitted {(evidence.budgetExcludedFileCount || 0).toLocaleString()} lower-priority eligible files within the safe budget.
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

export function ProjectContextPanel({
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

export function DecisionSummary({ report, ready, nextActions }: { report: ReadinessReport; ready: boolean; nextActions: string[] }) {
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

export function SafetyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-foreground/90 truncate">{value}</div>
    </div>
  );
}

export function NarrativePanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/25 p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
    </div>
  );
}

export function NarrativeList({ title, items }: { title: string; items: string[] }) {
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

export function RecentScans({ history, onClear }: { history: ScanHistoryItem[]; onClear: () => void }) {
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

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 text-right truncate">{value}</span>
    </div>
  );
}


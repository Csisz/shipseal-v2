import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, FileCheck2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  RepositoryIntelligenceArtifactVerification,
  RepositoryIntelligenceArtifactVerificationState,
  RepositoryIntelligenceOverallVerificationState,
  RepositoryIntelligencePreservationState,
  RepositoryIntelligenceStatementVerification,
  RepositoryIntelligenceStatementVerificationState,
  RepositoryIntelligenceVerificationBaseline,
  RepositoryIntelligenceVerificationLifecycleState,
  RepositoryIntelligenceVerificationOpenWorkItem,
  RepositoryIntelligenceVerificationQualityEvaluation,
  RepositoryIntelligenceVerificationResult,
} from '@/lib/repositoryIntelligence';

type VerificationFilter = 'all' | 'verified' | 'modified' | 'missing' | 'conflicting' | 'unavailable' | 'review-required';

export interface RepositoryIntelligenceVerificationPanelProps {
  baseline?: RepositoryIntelligenceVerificationBaseline | null;
  result?: RepositoryIntelligenceVerificationResult | null;
  status?: 'idle' | 'scanning' | 'completed' | 'failed';
  error?: string | null;
  currentRepository?: string;
  currentBranch?: string;
  scanLimited?: boolean;
  onRescan?: () => void;
  onDiscardBaseline?: () => void;
}

export function RepositoryIntelligenceVerificationPanel({
  baseline,
  result,
  status = 'idle',
  error,
  currentRepository,
  currentBranch,
  scanLimited = false,
  onRescan,
  onDiscardBaseline,
}: RepositoryIntelligenceVerificationPanelProps) {
  const [filter, setFilter] = useState<VerificationFilter>('all');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const filtered = useMemo(() => (result?.artifacts || []).filter(artifact => artifactMatchesFilter(artifact, filter)), [filter, result?.artifacts]);
  const selected = result?.artifacts.find(artifact => artifact.artifactId === selectedArtifactId) || filtered[0] || null;

  if (!baseline) {
    return <VerificationEmptyState title="No Repository Intelligence verification baseline" text="Create a reviewed Repository Intelligence Pull Request first. ShipSeal can verify it only after a later compatible scan." action="Review and create a Pull Request before rescanning." />;
  }

  return (
    <section className="rounded-3xl border border-primary/25 bg-background/25 p-4 md:p-5" aria-labelledby="repository-intelligence-verification-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository Intelligence verification</div>
          <h3 id="repository-intelligence-verification-heading" className="mt-1 font-display text-xl font-semibold">Verify reviewed files against this repository scan</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">File presence confirms that a reviewed artifact was applied. It does not automatically prove every statement inside it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRescan && <Button type="button" variant="outline" size="sm" onClick={onRescan} disabled={status === 'scanning'}><RefreshCw className={`mr-2 h-4 w-4 ${status === 'scanning' ? 'animate-spin motion-reduce:animate-none' : ''}`} />{status === 'scanning' ? 'Rescanning…' : 'Rescan current branch'}</Button>}
          {safePullRequestUrl(baseline.prUrl) && <a href={baseline.prUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-md border border-border/60 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Pull Request <ExternalLink className="ml-2 h-4 w-4" /></a>}
        </div>
      </div>

      {status === 'scanning' && <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm" aria-live="polite" aria-busy="true">A compatible rescan is in progress. The previous valid verification remains visible until the new scan completes.</div>}
      {status === 'failed' && <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning" role="alert">{error || 'The rescan failed. The previous safe verification result was preserved.'} {onRescan ? 'Retry when the repository is available.' : 'Reconnect GitHub or scan the same repository again.'}</div>}

      {result ? (
        <div className="mt-5 space-y-5">
          <RepositoryIntelligenceVerificationSummary baseline={baseline} result={result} currentRepository={currentRepository} currentBranch={currentBranch} scanLimited={scanLimited} />
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
            <RepositoryIntelligenceVerificationList artifacts={filtered} filter={filter} onFilterChange={setFilter} selectedArtifactId={selected?.artifactId || null} onSelect={setSelectedArtifactId} />
            <RepositoryIntelligenceVerificationDetail artifact={selected} />
          </div>
          <RepositoryIntelligenceVerificationOpenWork items={result.openWork} onSelectArtifact={setSelectedArtifactId} />
          <QualityDimensions quality={result.quality} />
        </div>
      ) : (
        <AwaitingVerification baseline={baseline} status={status} currentBranch={currentBranch} onRescan={onRescan} />
      )}

      {onDiscardBaseline && <div className="mt-5 border-t border-border/45 pt-4"><Button type="button" variant="ghost" size="sm" onClick={onDiscardBaseline}>Discard Repository Intelligence baseline</Button></div>}
    </section>
  );
}

export function RepositoryIntelligenceVerificationSummary({ baseline, result, currentRepository, currentBranch, scanLimited = false }: {
  baseline: RepositoryIntelligenceVerificationBaseline;
  result: RepositoryIntelligenceVerificationResult;
  currentRepository?: string;
  currentBranch?: string;
  scanLimited?: boolean;
}) {
  const counts = summaryCounts(result);
  const nextAction = result.openWork[0]?.nextAction || (result.overallState === 'fully-verified' ? 'Keep this baseline and rescan after future repository changes.' : 'Review the artifact results below.');
  return (
    <section className="rounded-2xl border border-border/55 bg-secondary/15 p-4" aria-label="Repository Intelligence verification summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="outline" className={overallClass(result.overallState)}>{overallLabel(result.overallState)}</Badge>
          <p className="mt-2 max-w-3xl text-sm text-foreground">{overallDescription(result.overallState)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{lifecycleDescription(result.lifecycle)}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="break-all">{currentRepository || `${baseline.repository.owner}/${baseline.repository.repo}`}</div>
          <div className="break-all">Scanned branch: {currentBranch || 'not available'} · PR branch: {baseline.prBranch}</div>
          <div>Plan: {shortFingerprint(baseline.selectedPlanFingerprint)}</div>
          <div>{scanLimited ? 'Limited scan scope' : 'Complete scanner scope reported'}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Metric label="Applied" value={baseline.artifacts.length} />
        <Metric label="Exact" value={counts.exact} />
        <Metric label="Modified" value={counts.modified} />
        <Metric label="Missing" value={counts.missing} />
        <Metric label="Conflicting" value={counts.conflicting} />
        <Metric label="Unavailable" value={counts.unavailable} />
        <Metric label="Review open" value={result.comparison.humanReviewItemsOpen} />
        <Metric label="Open actions" value={result.openWork.length} />
      </div>
      <div className="mt-4 rounded-xl border border-primary/20 bg-background/25 p-3 text-sm"><span className="font-medium">Next action:</span> <span className="text-muted-foreground">{nextAction}</span></div>
    </section>
  );
}

export function RepositoryIntelligenceVerificationList({ artifacts, filter, onFilterChange, selectedArtifactId, onSelect }: {
  artifacts: RepositoryIntelligenceArtifactVerification[];
  filter: VerificationFilter;
  onFilterChange: (filter: VerificationFilter) => void;
  selectedArtifactId: string | null;
  onSelect: (artifactId: string) => void;
}) {
  const filters: Array<{ id: VerificationFilter; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'verified', label: 'Verified' }, { id: 'modified', label: 'Modified' }, { id: 'missing', label: 'Missing' },
    { id: 'conflicting', label: 'Conflicting' }, { id: 'unavailable', label: 'Unavailable' }, { id: 'review-required', label: 'Review required' },
  ];
  return (
    <section className="min-w-0 rounded-2xl border border-border/55 bg-secondary/10 p-3" aria-label="Verified Repository Intelligence artifacts">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter verification artifacts">
        {filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => onFilterChange(item.id)} className={`rounded-full border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter === item.id ? 'border-primary/45 bg-primary/15 text-primary-glow' : 'border-border/55 text-muted-foreground'}`}>{item.label}</button>)}
      </div>
      <div className="mt-3 max-h-[42rem] space-y-2 overflow-y-auto pr-1">
        {artifacts.map(artifact => (
          <button key={artifact.id} type="button" aria-pressed={selectedArtifactId === artifact.artifactId} onClick={() => onSelect(artifact.artifactId)} className={`w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedArtifactId === artifact.artifactId ? 'border-primary/45 bg-primary/10' : 'border-border/45 bg-background/20'}`}>
            <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-all text-sm font-medium">{artifact.targetPath}</span><Badge variant="outline" className={artifactStateClass(artifact.state)}>{artifactStateLabel(artifact.state)}</Badge></div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{operationLabel(artifact.operation)}</span><span>{categoryLabel(artifact.category)}</span><span>{artifact.verifiedStatementCount} supported · {artifact.unresolvedStatementCount} unresolved</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{artifactReason(artifact)}</p>
            <div className="mt-2 flex flex-wrap gap-2">{artifact.humanReviewRequired && <Badge variant="outline" className="border-warning/45 text-warning">Human review</Badge>}{artifact.limitations.length > 0 && <Badge variant="outline" className="border-border/60 text-muted-foreground">{artifact.limitations.length} limitation{artifact.limitations.length === 1 ? '' : 's'}</Badge>}</div>
          </button>
        ))}
        {artifacts.length === 0 && <p className="rounded-xl border border-border/45 p-4 text-sm text-muted-foreground">No artifacts match this filter. Choose another filter to continue.</p>}
      </div>
    </section>
  );
}

export function RepositoryIntelligenceVerificationDetail({ artifact }: { artifact: RepositoryIntelligenceArtifactVerification | null }) {
  if (!artifact) return <section className="rounded-2xl border border-border/55 bg-secondary/10 p-5 text-sm text-muted-foreground">Select an artifact to inspect its verification evidence.</section>;
  const contradictions = artifact.statementResults.filter(statement => statement.state === 'contradicted');
  const referencedPaths = [...new Set(artifact.statementResults.flatMap(statement => statement.referencedPaths))].sort();
  return (
    <section className="min-w-0 rounded-2xl border border-border/55 bg-secondary/10 p-4" aria-label={`Verification detail for ${artifact.targetPath}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Artifact detail</div><h4 className="mt-1 break-all font-display text-lg font-semibold">{artifact.targetPath}</h4></div><Badge variant="outline" className={artifactStateClass(artifact.state)}>{artifactStateLabel(artifact.state)}</Badge></div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><Value label="Expected operation" value={operationLabel(artifact.operation)} /><Value label="Artifact category" value={categoryLabel(artifact.category)} /><Value label="Current result" value={artifactStateLabel(artifact.state)} /><Value label="Confidence" value={artifact.confidence} /></div>
      {artifact.operation === 'strengthen' && <HandwrittenPreservation artifact={artifact} />}
      <div className="mt-4"><h5 className="text-sm font-semibold">Statement truth</h5><p className="mt-1 text-xs text-muted-foreground">Artifact application and statement truth are verified separately.</p><div className="mt-3 space-y-2">{artifact.statementResults.map(statement => <RepositoryIntelligenceStatementStatus key={statement.id} statement={statement} />)}{artifact.statementResults.length === 0 && <p className="text-xs text-muted-foreground">No substantive statements were included in this artifact baseline.</p>}</div></div>
      {referencedPaths.length > 0 && <details className="mt-4 rounded-xl border border-border/45 p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Referenced repository paths ({referencedPaths.length})</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{referencedPaths.map(path => <li key={path} className="break-all"><code>{path}</code></li>)}</ul></details>}
      {contradictions.length > 0 && <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3"><h5 className="text-sm font-semibold text-warning">Contradictions</h5><p className="mt-1 text-xs text-warning/90">{contradictions.length} statement{contradictions.length === 1 ? '' : 's'} conflict with current deterministic repository evidence.</p></div>}
      {artifact.limitations.length > 0 && <details className="mt-4 rounded-xl border border-border/45 p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Limitations ({artifact.limitations.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{artifact.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>}
      <div className="mt-4 rounded-xl border border-primary/20 bg-background/25 p-3 text-sm"><span className="font-medium">Recommended next action:</span> <span className="text-muted-foreground">{artifact.nextAction}</span></div>
      <details className="mt-4 rounded-xl border border-border/45 p-3"><summary className="cursor-pointer text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Verification diagnostics</summary><div className="mt-2 space-y-1 break-all font-mono text-[11px] text-muted-foreground"><div>Result ID: {artifact.id}</div><div>Baseline artifact: {shortFingerprint(artifact.baselineArtifactFingerprint)}</div><div>Expected content: {shortFingerprint(artifact.expectedAppliedContentFingerprint)}</div><div>Current content: {shortFingerprint(artifact.currentContentFingerprint)}</div>{artifact.expectedManagedSectionFingerprint && <div>Expected managed section: {shortFingerprint(artifact.expectedManagedSectionFingerprint)}</div>}{artifact.currentManagedSectionFingerprint && <div>Current managed section: {shortFingerprint(artifact.currentManagedSectionFingerprint)}</div>}</div></details>
    </section>
  );
}

export function RepositoryIntelligenceStatementStatus({ statement }: { statement: RepositoryIntelligenceStatementVerification }) {
  return <article className="rounded-xl border border-border/45 bg-background/20 p-3"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 text-sm font-medium">{statementTypeLabel(statement.statementType)}</span><Badge variant="outline" className={statementStateClass(statement.state)}>{statementStateLabel(statement.state)}</Badge></div><div className="mt-2 text-xs text-muted-foreground">Evidence: {statement.resolvedEvidenceIds.length} resolved · {statement.missingEvidenceIds.length} missing</div>{statement.referencedPaths.length > 0 && <div className="mt-1 break-all text-xs text-muted-foreground">Paths: {statement.referencedPaths.join(', ')}</div>}{statement.limitations.map(item => <p key={item} className="mt-1 text-xs text-muted-foreground">{item}</p>)}<p className="mt-2 text-xs"><span className="font-medium">Action:</span> <span className="text-muted-foreground">{statement.nextAction}</span></p></article>;
}

export function RepositoryIntelligenceVerificationOpenWork({ items, onSelectArtifact }: { items: RepositoryIntelligenceVerificationOpenWorkItem[]; onSelectArtifact?: (artifactId: string) => void }) {
  return <details className="rounded-2xl border border-border/55 bg-secondary/10 p-4" open={items.length > 0}><summary className="cursor-pointer font-display text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Evidence-backed open work ({items.length})</summary><div className="mt-3 space-y-2">{items.map(item => <article key={item.id} className="rounded-xl border border-border/45 bg-background/20 p-3"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-all text-sm font-medium">{item.path || 'Repository baseline'}</span><Badge variant="outline" className={priorityClass(item.priority)}>{item.priority} priority</Badge><Badge variant="outline" className="border-border/60 text-muted-foreground">{actionTypeLabel(item.actionType)}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>{item.evidence.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Evidence: {item.evidence.join(' ')}</p>}<div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xs"><span className="font-medium">Next:</span> <span className="text-muted-foreground">{item.nextAction}</span></span>{item.artifactId && onSelectArtifact && <Button type="button" variant="ghost" size="sm" onClick={() => onSelectArtifact(item.artifactId!)}>Review artifact</Button>}</div></article>)}{items.length === 0 && <p className="text-sm text-muted-foreground">No additional evidence-backed verification work is open.</p>}</div></details>;
}

function HandwrittenPreservation({ artifact }: { artifact: RepositoryIntelligenceArtifactVerification }) {
  return <section className="mt-4 rounded-xl border border-border/45 bg-background/20 p-3" aria-label="Handwritten content preservation"><h5 className="text-sm font-semibold">Strengthened-file preservation</h5><div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><Value label="Handwritten content" value={preservationLabel(artifact.preservationState)} /><Value label="ShipSeal-managed section" value={managedSectionLabel(artifact)} /></div>{artifact.preservationState === 'preserved-with-additions' && <p className="mt-2 text-xs text-muted-foreground">Later handwritten additions were detected; original preserved lines remain ordered and are not treated as a failure.</p>}{artifact.humanReviewRequired && <p className="mt-2 flex items-center gap-2 text-xs text-warning"><AlertTriangle className="h-4 w-4" />Human review remains required.</p>}</section>;
}

function QualityDimensions({ quality }: { quality: RepositoryIntelligenceVerificationQualityEvaluation }) {
  return <details className="rounded-2xl border border-border/55 bg-secondary/10 p-4"><summary className="cursor-pointer font-display text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Non-numeric verification quality</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{quality.dimensions.map(item => <div key={item.dimension} className="rounded-xl border border-border/45 bg-background/20 p-3"><div className="text-sm font-medium">{qualityDimensionLabel(item.dimension)}</div><div className="mt-1 text-xs text-muted-foreground">{qualityStateLabel(item.state)} · {item.verified} verified · {item.unresolved} unresolved</div></div>)}</div></details>;
}

function AwaitingVerification({ baseline, status, currentBranch, onRescan }: { baseline: RepositoryIntelligenceVerificationBaseline; status: string; currentBranch?: string; onRescan?: () => void }) {
  return <div className="mt-5 rounded-2xl border border-border/55 bg-secondary/15 p-4"><Badge variant="outline" className="border-border/60 text-muted-foreground">{status === 'scanning' ? 'Verification in progress' : 'Awaiting repository change'}</Badge><h4 className="mt-3 font-display text-lg font-semibold">The Pull Request baseline is saved, but no compatible completed rescan is available.</h4><p className="mt-2 text-sm text-muted-foreground">The Repository Intelligence PR was created, but this scanned branch does not yet contain verified reviewed files. ShipSeal does not infer merge state from the PR URL or elapsed time.</p><div className="mt-3 text-xs text-muted-foreground">Repository: {baseline.repository.owner}/{baseline.repository.repo} · current branch: {currentBranch || 'not available'} · expected base: {baseline.baseBranch}</div>{onRescan && <Button type="button" size="sm" className="mt-4" onClick={onRescan} disabled={status === 'scanning'}>Rescan current branch</Button>}</div>;
}

function VerificationEmptyState({ title, text, action }: { title: string; text: string; action: string }) { return <section className="rounded-3xl border border-border/55 bg-background/20 p-5" aria-label="Repository Intelligence verification"><div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 text-muted-foreground" /><div><h3 className="font-display text-lg font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p><p className="mt-2 text-sm"><span className="font-medium">Next action:</span> <span className="text-muted-foreground">{action}</span></p></div></div></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border/45 bg-background/20 p-3"><div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>; }
function Value({ label, value }: { label: string; value: string }) { return <div><span className="text-muted-foreground">{label}: </span><span className="break-all font-medium">{value}</span></div>; }

function summaryCounts(result: RepositoryIntelligenceVerificationResult) { return { exact: result.counts['verified-exact'] + result.counts['verified-strengthened'], modified: result.counts['verified-present-with-modifications'] + result.counts['partially-verified'] + result.counts.stale, missing: result.counts.missing, conflicting: result.counts.conflicting, unavailable: result.counts.unavailable }; }
function artifactMatchesFilter(artifact: RepositoryIntelligenceArtifactVerification, filter: VerificationFilter) { if (filter === 'all') return true; if (filter === 'verified') return ['verified-exact', 'verified-strengthened'].includes(artifact.state); if (filter === 'modified') return ['verified-present-with-modifications', 'partially-verified', 'stale'].includes(artifact.state); if (filter === 'review-required') return artifact.humanReviewRequired || artifact.state === 'requires-human-review'; return artifact.state === filter; }
function overallLabel(state: RepositoryIntelligenceOverallVerificationState) { return ({ 'fully-verified': 'Fully verified', 'partially-verified': 'Partially verified', 'changes-detected': 'Changes detected', 'verification-blocked': 'Verification blocked', unavailable: 'Verification unavailable' })[state]; }
function overallDescription(state: RepositoryIntelligenceOverallVerificationState) { return ({ 'fully-verified': 'The reviewed Repository Intelligence files are present, and their deterministic claims still match the repository.', 'partially-verified': 'Most reviewed files are present, but some content changed or still requires review.', 'changes-detected': 'Repository Intelligence files were found, but some instructions or evidence no longer match the repository.', 'verification-blocked': 'ShipSeal could not safely compare this scan with the saved Repository Intelligence baseline.', unavailable: 'The current scan does not contain enough evidence to verify these changes.' })[state]; }
function overallClass(state: RepositoryIntelligenceOverallVerificationState) { return state === 'fully-verified' ? 'border-success/45 text-success' : state === 'partially-verified' ? 'border-primary/45 text-primary-glow' : 'border-warning/45 text-warning'; }
function lifecycleDescription(state: RepositoryIntelligenceVerificationLifecycleState) { return ({ 'baseline-created-after-pr': 'Pull Request created; awaiting a later repository scan.', 'awaiting-repository-change': 'Awaiting repository changes before verification.', 'current-branch-does-not-contain-changes': 'The current branch does not contain the reviewed changes.', 'eligible-for-verification': 'The repository and branch are eligible for verification.', verified: 'The current repository content was verified against the saved baseline.', 'repository-changed-after-verification': 'The repository changed after the saved verification state.', 'stale-baseline': 'The saved baseline is stale and should be regenerated.', 'incompatible-baseline': 'The saved baseline is incompatible with this verification model.', 'verification-unavailable': 'Current scan coverage cannot verify the baseline.' })[state]; }
function artifactStateLabel(state: RepositoryIntelligenceArtifactVerificationState) { return ({ 'verified-exact': 'Exact content verified', 'verified-present-with-modifications': 'Present with modifications', 'verified-strengthened': 'Strengthening verified', 'partially-verified': 'Partially verified', missing: 'Missing', conflicting: 'Conflicting', stale: 'Stale', unavailable: 'Unavailable', 'not-applicable': 'Not applicable', 'requires-human-review': 'Human review required' })[state]; }
function artifactStateClass(state: RepositoryIntelligenceArtifactVerificationState) { return ['verified-exact', 'verified-strengthened'].includes(state) ? 'border-success/45 text-success' : ['missing', 'conflicting'].includes(state) ? 'border-warning/50 text-warning' : state === 'unavailable' ? 'border-border/60 text-muted-foreground' : 'border-primary/40 text-primary-glow'; }
function artifactReason(artifact: RepositoryIntelligenceArtifactVerification) { if (artifact.limitations[0]) return artifact.limitations[0]; if (artifact.state === 'verified-exact') return 'Current readable content exactly matches the applied fingerprint.'; if (artifact.state === 'verified-strengthened') return 'The managed section is intact and handwritten content remains preserved.'; return artifact.nextAction; }
function statementStateLabel(state: RepositoryIntelligenceStatementVerificationState) { return ({ 'verified-by-current-deterministic-evidence': 'Supported by current repository evidence', 'present-in-artifact-only': 'Present in the artifact only', 'still-inferred': 'Still inferred', contradicted: 'Contradicted by current repository evidence', 'evidence-missing': 'Referenced evidence missing', unavailable: 'Evidence unavailable', 'requires-human-review': 'Human review required' })[state]; }
function statementStateClass(state: RepositoryIntelligenceStatementVerificationState) { return state === 'verified-by-current-deterministic-evidence' ? 'border-success/45 text-success' : ['contradicted', 'evidence-missing'].includes(state) ? 'border-warning/50 text-warning' : state === 'unavailable' ? 'border-border/60 text-muted-foreground' : 'border-primary/40 text-primary-glow'; }
function preservationLabel(state: RepositoryIntelligencePreservationState) { return ({ 'not-applicable': 'Not applicable', 'preserved-exact': 'Handwritten content preserved', 'preserved-with-additions': 'Preserved with later handwritten edits', 'changed-unproven': 'Preservation could not be verified', 'content-loss-detected': 'Potential handwritten content loss detected', unavailable: 'Preservation unavailable' })[state]; }
function managedSectionLabel(artifact: RepositoryIntelligenceArtifactVerification) { if (artifact.state === 'conflicting') return artifact.currentManagedSectionFingerprint ? 'Marker conflict or preservation conflict detected' : 'Managed section missing or invalid'; if (!artifact.currentManagedSectionFingerprint) return 'Managed section unavailable'; return artifact.currentManagedSectionFingerprint === artifact.expectedManagedSectionFingerprint ? 'ShipSeal-managed section intact' : 'ShipSeal section changed after application'; }
function operationLabel(operation: RepositoryIntelligenceArtifactVerification['operation']) { return ({ create: 'Create', update: 'Update', strengthen: 'Strengthen' })[operation]; }
function categoryLabel(category: string) { return category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); }
function statementTypeLabel(type: string) { return categoryLabel(type); }
function shortFingerprint(value?: string) { return value ? `${value.slice(0, 18)}…` : 'unavailable'; }
function priorityClass(priority: RepositoryIntelligenceVerificationOpenWorkItem['priority']) { return priority === 'critical' || priority === 'high' ? 'border-warning/50 text-warning' : 'border-border/60 text-muted-foreground'; }
function actionTypeLabel(action: RepositoryIntelligenceVerificationOpenWorkItem['actionType']) { return ({ regenerate: 'Regenerate', rescan: 'Rescan', 'human-review': 'Review' })[action]; }
function qualityDimensionLabel(dimension: RepositoryIntelligenceVerificationQualityEvaluation['dimensions'][number]['dimension']) { return categoryLabel(dimension); }
function qualityStateLabel(state: RepositoryIntelligenceVerificationQualityEvaluation['dimensions'][number]['state']) { return ({ verified: 'Verified', partial: 'Mixed', conflicting: 'Conflicting', unavailable: 'Unavailable', 'not-applicable': 'Not applicable' })[state]; }
function safePullRequestUrl(value: string) { try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com'; } catch { return false; } }

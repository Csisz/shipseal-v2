import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createZipUploadConnection, type GitHubConnectionState } from '@/lib/githubConnection/types';
import {
  updateRepositoryIntelligenceReviewSelection,
  validateRepositoryIntelligenceReviewSelection,
  type BuildRepositoryIntelligenceArtifactReviewResult,
  type RepositoryIntelligenceArtifactReview,
  type RepositoryIntelligenceArtifactReviewItem,
  type RepositoryIntelligenceProviderStatus,
  type RepositoryIntelligenceReviewSelectionAction,
  type RepositoryIntelligenceVerificationBaseline,
} from '@/lib/repositoryIntelligence';
import { RepositoryIntelligencePrApply } from './RepositoryIntelligencePrApply';

type ReviewFilter = 'all' | 'selected' | 'create' | 'update' | 'strengthen' | 'requires-review' | 'blocked';

export type RepositoryIntelligenceReviewUiSession = Pick<BuildRepositoryIntelligenceArtifactReviewResult, 'artifactSet' | 'review'>;

export function RepositoryIntelligenceReviewPanel({
  session,
  preparing = false,
  error,
  enabled = true,
  prepareSession,
  providerStatus,
  prepareEnhancement,
  githubConnection,
  onVerificationBaseline,
}: {
  session?: RepositoryIntelligenceReviewUiSession | null;
  preparing?: boolean;
  error?: string | null;
  enabled?: boolean;
  prepareSession?: () => Promise<RepositoryIntelligenceReviewUiSession>;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  prepareEnhancement?: () => Promise<void>;
  githubConnection?: GitHubConnectionState;
  onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void;
}) {
  const [preparedSession, setPreparedSession] = useState<RepositoryIntelligenceReviewUiSession | null>(null);
  const [localPreparing, setLocalPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!enabled || session || preparedSession || !prepareSession) return;
    setLocalPreparing(true);
    setLocalError(null);
    void prepareSession().then(result => {
      if (cancelled) return;
      setPreparedSession(result);
      setLocalPreparing(false);
    }).catch(cause => {
      if (cancelled) return;
      setLocalPreparing(false);
      setLocalError(cause instanceof Error ? cause.message : 'Repository Intelligence review could not be prepared.');
    });
    return () => { cancelled = true; };
  }, [enabled, prepareSession, preparedSession, session]);
  const effectiveSession = session || preparedSession;
  if (preparing || localPreparing) {
    return (
      <section className="rounded-3xl border border-primary/20 bg-background/20 p-5" aria-live="polite" aria-busy="true">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository Intelligence PR</div>
        <h3 className="mt-1 font-display text-xl font-semibold">Preparing repository-specific artifact review...</h3>
        <p className="mt-2 text-sm text-muted-foreground">ShipSeal is reusing the bounded evidence already loaded by the scanner. No provider or GitHub request is being made.</p>
      </section>
    );
  }
  if (!effectiveSession) {
    return <RepositoryIntelligenceUnavailable text={`${error || localError || 'Repository Intelligence artifact review is unavailable because validated in-memory review data is not present in this session.'} Run a complete scan and review scanner limitations before retrying.`} />;
  }
  return <RepositoryIntelligenceReviewStatefulSurface key={effectiveSession.review.fingerprint} session={effectiveSession} githubConnection={githubConnection || createZipUploadConnection()} providerStatus={providerStatus} prepareEnhancement={prepareEnhancement} onVerificationBaseline={onVerificationBaseline} />;
}

function RepositoryIntelligenceReviewStatefulSurface({ session, githubConnection, providerStatus, prepareEnhancement, onVerificationBaseline }: { session: RepositoryIntelligenceReviewUiSession; githubConnection: GitHubConnectionState; providerStatus?: RepositoryIntelligenceProviderStatus; prepareEnhancement?: () => Promise<void>; onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void }) {
  const [review, setReview] = useState(session.review);
  return (
    <RepositoryIntelligenceReviewSurface
      artifactSet={session.artifactSet}
      review={review}
      providerStatus={providerStatus}
      prepareEnhancement={prepareEnhancement}
      onReviewChange={setReview}
      githubConnection={githubConnection}
      onVerificationBaseline={onVerificationBaseline}
    />
  );
}

export function RepositoryIntelligenceReviewSurface({
  artifactSet,
  review,
  providerStatus,
  prepareEnhancement,
  onReviewChange,
  githubConnection,
  onVerificationBaseline,
}: {
  artifactSet: BuildRepositoryIntelligenceArtifactReviewResult['artifactSet'];
  review: RepositoryIntelligenceArtifactReview;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  prepareEnhancement?: () => Promise<void>;
  onReviewChange: (review: RepositoryIntelligenceArtifactReview) => void;
  githubConnection?: GitHubConnectionState;
  onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const actionable = useMemo(() => review.items.filter(item => item.operation !== 'skip'), [review.items]);
  const filtered = useMemo(() => actionable.filter(item => filterMatches(item, filter)), [actionable, filter]);
  const selectedItem = review.items.find(item => item.artifactId === selectedArtifactId)
    || filtered[0]
    || actionable[0]
    || null;
  const applyValidation = useMemo(() => validateRepositoryIntelligenceReviewSelection({
    review,
    artifactSet,
    expectedRepositoryIdentityFingerprint: review.repositoryIdentityFingerprint,
    expectedScanIdentity: review.scanIdentity,
  }), [artifactSet, review]);

  const dispatch = (action: RepositoryIntelligenceReviewSelectionAction) => {
    const transition = updateRepositoryIntelligenceReviewSelection(review, action);
    if (transition.accepted) onReviewChange(transition.review);
  };

  return (
    <section className="rounded-3xl border border-primary/25 bg-background/25 p-4 md:p-5" aria-labelledby="repository-intelligence-review-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Repository Intelligence PR</div>
          <h3 id="repository-intelligence-review-heading" className="mt-1 font-display text-xl font-semibold">Review repository-specific files before any change</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Inspect the exact generated drafts, their repository evidence, preservation behavior and limitations. This review does not create a branch, write files or contact an AI provider.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-primary/35 text-primary-glow">{analysisModeLabel(review.analysisMode)}</Badge>
            <span>{review.summary.proposedArtifacts.toLocaleString()} proposed artifacts</span>
            <span>{review.summary.selectedArtifacts.toLocaleString()} safely selected</span>
            <span>{review.summary.humanReviewRequired.toLocaleString()} require review</span>
            <span>{review.summary.blockedOrUnavailable.toLocaleString()} blocked or unavailable</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{review.eligibility.explanation}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(value => !value)} aria-expanded={open} className="shrink-0 border-primary/35 bg-primary/10 text-primary-glow hover:text-primary-glow">
          {open ? 'Close artifact review' : 'Review proposed files'}
        </Button>
      </div>

      {!open ? null : (
        <div className="mt-5 space-y-4">
          {providerStatus && <RepositoryIntelligenceProviderDisclosure status={providerStatus} onPrepare={prepareEnhancement} />}
          <RepositoryIntelligenceSelectionSummary review={review} valid={applyValidation.valid} issues={applyValidation.issues.map(issue => issue.message)} />
          <RepositoryIntelligencePrApply artifactSet={artifactSet} review={review} connection={githubConnection || createZipUploadConnection()} onVerificationBaseline={onVerificationBaseline} />

          <div className="flex flex-col gap-3 rounded-2xl border border-border/55 bg-secondary/15 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Filter files</span>
              <select value={filter} onChange={event => setFilter(event.target.value as ReviewFilter)} className="min-w-0 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="all">All proposed</option>
                <option value="selected">Selected</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="strengthen">Strengthen</option>
                <option value="requires-review">Requires review</option>
                <option value="blocked">Blocked or unavailable</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => dispatch({ type: 'include-all-safe' })}>Include all safe</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => dispatch({ type: 'exclude-all' })}>Exclude all</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => dispatch({ type: 'reset-safe-defaults' })}>Reset safe defaults</Button>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
            <div className="space-y-2" aria-label="Repository Intelligence artifacts">
              {filtered.map(item => (
                <button
                  key={item.artifactId}
                  type="button"
                  onClick={() => setSelectedArtifactId(item.artifactId)}
                  aria-pressed={selectedItem?.artifactId === item.artifactId}
                  className={`w-full rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedItem?.artifactId === item.artifactId ? 'border-primary/45 bg-primary/10' : 'border-border/55 bg-background/20 hover:border-primary/25'}`}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 break-all text-sm font-medium text-foreground">{item.targetPath}</span>
                    <Badge variant="outline" className={operationClass(item.operation)}>{operationLabel(item.operation)}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.purpose}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{categoryLabel(item.category)}</span>
                    <span>{item.evidence.length} evidence records</span>
                    <span>{item.selected ? 'Selected' : 'Excluded'}</span>
                    {item.humanReviewRequired && <span className="text-warning">Human review</span>}
                    {!item.selectable && <span className="text-warning">Not selectable</span>}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <p className="rounded-2xl border border-border/55 bg-secondary/15 p-4 text-sm text-muted-foreground">No artifacts match this filter.</p>}
              {review.summary.operationCounts.skip > 0 && <p className="px-2 text-xs text-muted-foreground">{review.summary.operationCounts.skip} already-sufficient artifact(s) are summarized as skipped and are not actionable.</p>}
            </div>
            <RepositoryIntelligenceArtifactDetail item={selectedItem} dispatch={dispatch} />
          </div>
        </div>
      )}
    </section>
  );
}

function RepositoryIntelligenceProviderDisclosure({ status, onPrepare }: { status: RepositoryIntelligenceProviderStatus; onPrepare?: () => Promise<void> }) {
  const enhanced = status.state === 'enhanced';
  const preparing = status.state === 'preparing';
  const fallback = status.state === 'fallback' || status.state === 'cancelled';
  return (
    <section className={`rounded-2xl border p-4 ${enhanced ? 'border-success/35 bg-success/5' : fallback ? 'border-warning/35 bg-warning/5' : 'border-primary/25 bg-primary/5'}`} aria-live="polite" aria-busy={preparing}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Intelligence source</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{enhanced ? 'Enhanced intelligence validated' : fallback ? 'Deterministic fallback ready' : preparing ? 'Preparing optional enhanced intelligence' : 'Deterministic intelligence ready'}</div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{status.message} Deterministic repository evidence remains authoritative.</p>
        </div>
        {onPrepare && !enhanced && !preparing && (!fallback || status.retryable) && (
          <Button type="button" size="sm" variant="outline" onClick={() => void onPrepare()}>
            {fallback ? 'Retry enhanced intelligence' : 'Prepare enhanced intelligence'}
          </Button>
        )}
      </div>
    </section>
  );
}

function RepositoryIntelligenceSelectionSummary({ review, valid, issues }: { review: RepositoryIntelligenceArtifactReview; valid: boolean; issues: string[] }) {
  return (
    <section className="rounded-2xl border border-border/55 bg-secondary/15 p-4" aria-label="Selected Repository Intelligence plan summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Selected plan</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
            <span>{review.summary.selectedArtifacts} artifacts</span>
            <span>{review.summary.selectedOperationCounts.create} creates</span>
            <span>{review.summary.selectedOperationCounts.update} updates</span>
            <span>{review.summary.selectedOperationCounts.strengthen} strengthens</span>
            <span>{review.summary.selectedStatements} statements</span>
          </div>
          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">Plan {review.selectedPlanFingerprint.slice(0, 16)}</p>
        </div>
        <Badge variant="outline" className={valid ? 'border-success/40 text-success' : 'border-warning/45 text-warning'}>
          {valid ? 'Ready for future PR preparation' : 'Review required before future apply'}
        </Badge>
      </div>
      {!valid && issues.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {[...new Set(issues)].slice(0, 4).map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      )}
    </section>
  );
}

function RepositoryIntelligenceArtifactDetail({
  item,
  dispatch,
}: {
  item: RepositoryIntelligenceArtifactReviewItem | null;
  dispatch: (action: RepositoryIntelligenceReviewSelectionAction) => void;
}) {
  if (!item) return <aside className="rounded-2xl border border-border/55 bg-secondary/15 p-5 text-sm text-muted-foreground">Select an artifact to inspect its evidence and preview.</aside>;
  return (
    <aside className="min-w-0 rounded-2xl border border-primary/20 bg-background/20 p-4 md:p-5" aria-labelledby="repository-intelligence-artifact-detail-heading">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="outline" className={operationClass(item.operation)}>{operationLabel(item.operation)}</Badge>
        <Badge variant="outline" className={item.validationState === 'validated' ? 'border-success/40 text-success' : 'border-warning/45 text-warning'}>{item.validationState === 'validated' ? 'Validated' : 'Validation failed'}</Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">{item.confidence} confidence</Badge>
      </div>
      <h4 id="repository-intelligence-artifact-detail-heading" className="mt-3 break-all font-display text-lg font-semibold">{item.targetPath}</h4>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.purpose}</p>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <DetailValue label="Operation reason" value={item.operationReason} />
        <DetailValue label="Current selection" value={item.selectionReason} />
        <DetailValue label="Existing file" value={existingStateLabel(item.existingContentState)} />
        <DetailValue label="Preservation" value={preservationLabel(item)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.selectable && (
          <Button type="button" size="sm" variant="outline" disabled={!item.selected && !item.canSelectNow} aria-pressed={item.selected} onClick={() => dispatch({ type: item.selected ? 'exclude' : 'include', artifactId: item.artifactId })}>
            {item.selected ? 'Exclude from future PR' : 'Include in future PR'}
          </Button>
        )}
        {!item.selectable && <span className="text-xs text-warning">This artifact cannot be included.</span>}
      </div>

      {item.humanReviewRequired && (
        <div className="mt-4 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm text-warning/90">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Explicit human review is required.</p>
              <p className="mt-1 text-xs">Selection does not approve this artifact. Acknowledgement is tied to its current fingerprint and becomes stale if content changes.</p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                <input type="checkbox" checked={item.humanReviewAcknowledged} onChange={event => dispatch({ type: 'acknowledge-human-review', artifactId: item.artifactId, acknowledged: event.target.checked })} className="mt-0.5" />
                <span>I reviewed this artifact's current content, evidence and preservation behavior.</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {item.blockedReasons.length > 0 && (
        <div className="mt-4 rounded-2xl border border-warning/35 bg-warning/10 p-4">
          <div className="text-sm font-medium text-warning">Blocked or unavailable</div>
          <ul className="mt-2 space-y-1 text-xs text-warning/90">{item.blockedReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}

      {item.dependencies.length > 0 && (
        <details className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Dependencies</summary>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{item.dependencies.map(dependency => <li key={dependency.category}>{categoryLabel(dependency.category)}: {dependency.satisfied ? 'satisfied' : 'not selected'}</li>)}</ul>
        </details>
      )}

      <details open className="mt-4 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Repository evidence</summary>
        <div className="mt-3 space-y-2">
          {item.evidence.slice(0, 8).map(evidence => (
            <div key={evidence.id} className="rounded-xl border border-border/45 bg-background/20 p-3">
              <div className="break-all text-sm font-medium text-foreground">{evidence.path}</div>
              <div className="mt-1 text-xs text-muted-foreground">{evidence.category} · {evidence.assertionState}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{evidence.fact}</p>
              {evidence.limitations.length > 0 && <p className="mt-1 text-xs text-warning">{evidence.limitations.join(' ')}</p>}
            </div>
          ))}
          {item.evidence.length === 0 && <p className="text-xs text-muted-foreground">This metadata artifact derives from the validated artifact set rather than a standalone repository fact.</p>}
        </div>
      </details>

      {item.referencedPaths.length > 0 && (
        <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Referenced repository paths</summary>
          <div className="mt-3 flex flex-wrap gap-2">{item.referencedPaths.map(path => <code key={path} className="max-w-full break-all rounded-lg border border-border/45 bg-background/25 px-2 py-1 text-[11px] text-muted-foreground">{path}</code>)}</div>
        </details>
      )}

      <details className="mt-3 rounded-2xl border border-border/55 bg-secondary/15 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Generated content preview</summary>
        {item.previewKind === 'manifest-metadata' ? (
          <p className="mt-3 text-xs text-muted-foreground">The raw evidence manifest is intentionally hidden from the normal preview. Statement provenance remains attached to every review item.</p>
        ) : (
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/25 p-3 text-[11px] leading-relaxed text-muted-foreground">{item.renderedContent || 'No generated content is available.'}</pre>
        )}
      </details>

      {item.limitations.length > 0 && (
        <details className="mt-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <summary className="cursor-pointer select-none text-sm font-semibold text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Limitations</summary>
          <ul className="mt-3 space-y-1 text-xs text-warning/90">{item.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
        </details>
      )}
    </aside>
  );
}

function RepositoryIntelligenceUnavailable({ text }: { text: string }) {
  return (
    <section className="rounded-3xl border border-warning/30 bg-warning/10 p-5" aria-label="Repository Intelligence PR unavailable">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-warning/80">Repository Intelligence PR</div>
          <h3 className="mt-1 font-display text-xl font-semibold">Artifact review unavailable</h3>
          <p className="mt-2 text-sm leading-relaxed text-warning/90">{text}</p>
        </div>
      </div>
    </section>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/45 bg-secondary/15 p-3"><div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div><p className="mt-1 break-words text-xs leading-relaxed text-foreground">{value}</p></div>;
}

function filterMatches(item: RepositoryIntelligenceArtifactReviewItem, filter: ReviewFilter) {
  if (filter === 'all') return true;
  if (filter === 'selected') return item.selected;
  if (filter === 'requires-review') return item.humanReviewRequired;
  if (filter === 'blocked') return !item.selectable;
  return item.operation === filter;
}

function analysisModeLabel(mode: RepositoryIntelligenceArtifactReview['analysisMode']) {
  return mode === 'deep-intelligence-enhanced' ? 'Validated deep-intelligence findings' : 'Deterministic repository evidence';
}

function operationLabel(operation: RepositoryIntelligenceArtifactReviewItem['operation']) {
  return operation === 'create' ? 'Create' : operation === 'update' ? 'Update' : operation === 'strengthen' ? 'Strengthen' : operation === 'skip' ? 'Skip' : 'Unavailable';
}

function operationClass(operation: RepositoryIntelligenceArtifactReviewItem['operation']) {
  if (operation === 'create' || operation === 'update') return 'border-success/40 text-success';
  if (operation === 'strengthen') return 'border-warning/45 text-warning';
  return 'border-border/60 text-muted-foreground';
}

function categoryLabel(category: RepositoryIntelligenceArtifactReviewItem['category']) {
  return category.split('-').map(value => value.charAt(0).toUpperCase() + value.slice(1)).join(' ');
}

function existingStateLabel(state: RepositoryIntelligenceArtifactReviewItem['existingContentState']) {
  return state.split('-').join(' ');
}

function preservationLabel(item: RepositoryIntelligenceArtifactReviewItem) {
  if (item.operation === 'strengthen') return 'Existing handwritten content is preserved; the preview contains proposed additions only.';
  if (item.operation === 'update') return 'Only explicitly ShipSeal-managed content may be replaced.';
  if (item.operation === 'create') return 'A new repository file is proposed; no existing content is replaced.';
  return 'No repository content change is proposed.';
}

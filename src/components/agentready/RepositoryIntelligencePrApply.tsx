import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, GitPullRequest } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitHubConnectionState } from '@/lib/githubConnection/types';
import {
  REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
  buildRepositoryIntelligenceSelectedArtifactPayload,
  type RepositoryIntelligenceArtifactReview,
  type RepositoryIntelligenceArtifactSet,
  type RepositoryIntelligenceGithubApplyRequest,
  type RepositoryIntelligenceVerificationBaseline,
  validateRepositoryIntelligenceVerificationBaseline,
} from '@/lib/repositoryIntelligence';
import {
  RepositoryIntelligencePrClientError,
  submitRepositoryIntelligencePrRequest,
  type RepositoryIntelligencePrApplyResponse,
  type RepositoryIntelligencePrPreviewResponse,
} from '@/lib/github/write';

export function RepositoryIntelligencePrApply({ artifactSet, review, connection, onVerificationBaseline }: {
  artifactSet: RepositoryIntelligenceArtifactSet;
  review: RepositoryIntelligenceArtifactReview;
  connection: GitHubConnectionState;
  onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void;
}) {
  const [state, setState] = useState<'idle' | 'previewing' | 'preview' | 'creating' | 'success' | 'error'>('idle');
  const [preview, setPreview] = useState<RepositoryIntelligencePrPreviewResponse['plan'] | null>(null);
  const [success, setSuccess] = useState<RepositoryIntelligencePrApplyResponse | null>(null);
  const [error, setError] = useState<RepositoryIntelligencePrClientError | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const built = useMemo(() => buildRepositoryIntelligenceSelectedArtifactPayload({
    review,
    artifactSet,
    expectedRepositoryIdentityFingerprint: review.repositoryIdentityFingerprint,
    expectedScanIdentity: review.scanIdentity,
  }), [artifactSet, review]);
  const eligible = connection.sourceMode === 'github-app' && connection.canCreatePullRequest
    && Boolean(connection.installationId && connection.owner && connection.repo && connection.defaultBranch)
    && Boolean(built.payload && built.validation.valid);

  const request = (mode: 'preview' | 'apply'): RepositoryIntelligenceGithubApplyRequest | null => built.payload && connection.installationId && connection.owner && connection.repo && connection.defaultBranch ? {
    version: REPOSITORY_INTELLIGENCE_APPLY_SCHEMA_VERSION,
    mode,
    installationId: connection.installationId,
    owner: connection.owner,
    repo: connection.repo,
    baseBranch: connection.defaultBranch,
    analysisMode: review.analysisMode,
    selectedPayload: built.payload,
    confirmed: mode === 'apply',
  } : null;

  const loadPreview = async () => {
    const payload = request('preview'); if (!payload || !eligible) return;
    setState('previewing'); setError(null); setConfirmed(false); setSuccess(null);
    try {
      const response = await submitRepositoryIntelligencePrRequest(payload);
      if (response.mode !== 'preview') throw new Error('Unexpected apply response.');
      setPreview(response.plan); setState('preview');
    } catch (cause) {
      setError(cause instanceof RepositoryIntelligencePrClientError ? cause : new RepositoryIntelligencePrClientError({ code: 'github-unavailable', message: 'GitHub could not prepare the preview.', nextAction: 'Retry or reconnect GitHub.' }, 502));
      setState('error');
    }
  };

  const createPullRequest = async () => {
    const payload = request('apply'); if (!payload || !confirmed || state === 'creating') return;
    setState('creating'); setError(null);
    try {
      const response = await submitRepositoryIntelligencePrRequest(payload);
      if (response.mode !== 'apply') throw new Error('Unexpected preview response.');
      const validatedBaseline = validateRepositoryIntelligenceVerificationBaseline(response.baseline);
      if (!validatedBaseline.valid || !validatedBaseline.baseline) throw new Error('GitHub returned an incompatible Repository Intelligence verification baseline.');
      setSuccess(response); setState('success');
      onVerificationBaseline?.(validatedBaseline.baseline);
    } catch (cause) {
      setError(cause instanceof RepositoryIntelligencePrClientError ? cause : new RepositoryIntelligencePrClientError({ code: 'github-unavailable', message: 'GitHub could not create the Pull Request.', nextAction: 'Retry or reconnect GitHub.' }, 502));
      setState('error');
    }
  };

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4" aria-label="Repository Intelligence GitHub Pull Request">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">GitHub PR apply</div>
          <h4 className="mt-1 font-display text-lg font-semibold">Preview the exact reviewed change plan</h4>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Preview rechecks only selected targets on the GitHub base branch and performs no mutation. Branch creation and file writes require the separate final confirmation below.</p>
        </div>
        <Badge variant="outline" className={eligible ? 'border-success/40 text-success' : 'border-warning/45 text-warning'}>{eligible ? 'GitHub apply eligible' : 'GitHub connection required'}</Badge>
      </div>

      {!eligible && <p className="mt-3 text-sm text-warning">{connection.sourceMode === 'github-app' ? 'Reconnect the GitHub App, select a repository and known base branch, then rebuild the review.' : 'This scan can be reviewed locally, but PR creation requires a scan from a connected GitHub App repository. No manual token is requested.'}</p>}
      {!built.validation.valid && <ul className="mt-3 space-y-1 text-xs text-warning">{built.validation.issues.slice(0, 4).map(issue => <li key={`${issue.code}:${issue.artifactId || ''}`}>{issue.message}</li>)}</ul>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!eligible || state === 'previewing' || state === 'creating'} onClick={() => void loadPreview()}>
          <GitPullRequest className="mr-2 h-4 w-4" />{state === 'previewing' ? 'Checking current GitHub files...' : 'Preview Repository Intelligence PR'}
        </Button>
      </div>

      {preview && state !== 'success' && (
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/35 p-4" aria-live="polite">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <Value label="Repository" value={`${preview.repository.owner}/${preview.repository.repo}`} />
            <Value label="Base branch" value={preview.baseBranch} />
            <Value label="Proposed branch" value={preview.proposedBranchName} />
            <Value label="Pull Request" value={preview.pullRequestTitle} />
          </div>
          <div className="mt-3 text-sm">{preview.files.length} files: {preview.operationCounts.create} create, {preview.operationCounts.update} update, {preview.operationCounts.strengthen} strengthen</div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{preview.files.map(file => <li key={file.artifactId}><code>{file.path}</code> — {file.operation}</li>)}</ul>
          {preview.operationCounts.strengthen > 0 && <p className="mt-3 flex items-start gap-2 text-xs text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Handwritten content will be preserved outside the delimited ShipSeal-managed section.</p>}
          {preview.warnings.map(warning => <p key={warning} className="mt-2 text-xs text-warning">{warning}</p>)}
          <p className="mt-3 text-xs text-muted-foreground">GitHub state was checked for staleness during this preview and will be checked again immediately before mutation.</p>
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={state === 'creating'} className="mt-0.5" />
            <span>I reviewed this exact plan and explicitly confirm creation of a ShipSeal branch, the selected file writes, and a Pull Request. Nothing will be merged automatically.</span>
          </label>
          <Button type="button" className="mt-3" disabled={!confirmed || state === 'creating'} onClick={() => void createPullRequest()}>{state === 'creating' ? 'Creating Pull Request...' : 'Create Pull Request'}</Button>
        </div>
      )}

      {error && <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4" role="alert"><p className="text-sm font-medium text-warning">{error.message}</p><p className="mt-1 text-xs text-warning/90">{error.issue.nextAction}</p>{['stale-selected-plan', 'stale-target-file', 'target-now-exists', 'target-disappeared'].includes(error.issue.code) && <p className="mt-2 text-xs text-warning">Rescan is required; ShipSeal did not partially apply the plan.</p>}</div>}

      {success && <div className="mt-4 rounded-2xl border border-success/40 bg-success/10 p-4" aria-live="polite"><p className="font-medium text-success">{success.existing ? 'Equivalent Pull Request already open' : 'Repository Intelligence Pull Request created'}</p><p className="mt-1 text-sm">{success.title} · {success.repository} · {success.branchName}</p><p className="mt-1 text-xs text-muted-foreground">{success.selectedArtifactCount} artifacts; {success.operationCounts.create} create, {success.operationCounts.update} update, {success.operationCounts.strengthen} strengthen. Human-review-required items still require review.</p><a href={success.prUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-sm font-medium text-primary-glow underline">Open Pull Request <ExternalLink className="ml-1 h-4 w-4" /></a><p className="mt-2 text-xs text-muted-foreground">Review and merge through GitHub, then rescan. Opening a PR does not mark the repository improved or verified.</p></div>}
    </section>
  );
}

function Value({ label, value }: { label: string; value: string }) { return <div><span className="text-muted-foreground">{label}: </span><span className="break-all font-medium text-foreground">{value}</span></div>; }

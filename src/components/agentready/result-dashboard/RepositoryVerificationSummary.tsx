import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';
import { repositoryVerificationOutcomeForIntelligenceResult, type RepositoryVerificationOutcome } from '@/lib/workspace';

interface RepositoryVerificationSummaryProps {
  baseline?: RepositoryIntelligenceVerificationBaseline | null;
  result?: RepositoryIntelligenceVerificationResult | null;
  status?: 'idle' | 'scanning' | 'completed' | 'failed';
  onRescan?: () => void;
  onViewTechnicalEvidence: () => void;
}

export function RepositoryVerificationSummary({ baseline, result, status = 'idle', onRescan, onViewTechnicalEvidence }: RepositoryVerificationSummaryProps) {
  const outcome = repositoryVerificationOutcomeForIntelligenceResult(result) || (baseline ? 'pending' : null);
  const content = outcome ? contentFor(outcome) : contentFor('pending');
  const artifactTotal = result?.artifacts.length || baseline?.artifacts.length || 0;
  const verifiedArtifacts = result ? result.counts['verified-exact'] + result.counts['verified-strengthened'] : 0;
  const unresolvedArtifacts = result ? result.counts.missing + result.counts.unavailable + result.counts.conflicting + result.counts['partially-verified'] + result.counts['requires-human-review'] : artifactTotal;
  const confirmedStatements = result?.statementCounts['verified-by-current-deterministic-evidence'] || 0;
  const unresolvedStatements = result ? Object.entries(result.statementCounts).filter(([state]) => state !== 'verified-by-current-deterministic-evidence').reduce((sum, [, count]) => sum + count, 0) : 0;
  const regressions = result ? result.counts.conflicting + result.counts.stale + result.statementCounts.contradicted : 0;
  const primaryLabel = outcome === 'verified' ? 'Review verified changes'
    : outcome === 'partially-verified' || outcome === 'unresolved' ? 'Resolve unresolved items'
      : outcome === 'regressed' ? 'Review regressions'
        : outcome === 'incompatible' ? 'Run a compatible rescan' : 'Scan changed repository';

  return (
    <section className="rounded-2xl border border-border/60 bg-secondary/15 p-4 md:p-5" aria-labelledby="authoritative-verification-heading" data-verification-outcome={outcome || 'pending'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Current verification result</div>
          <h2 id="authoritative-verification-heading" className="mt-1 flex items-center gap-2 font-display text-xl font-semibold">
            <OutcomeIcon outcome={outcome || 'pending'} />
            {content.heading}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{content.explanation}</p>
        </div>
        {baseline && <span className="max-w-full break-all rounded-full border border-border/60 bg-background/30 px-2.5 py-1 text-[10px] font-mono text-muted-foreground">Algorithm {result?.version || 'awaiting later scan'}</span>}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6" aria-label="Verification summary counts">
        <Metric label="Expected artifacts" value={artifactTotal} />
        <Metric label="Verified artifacts" value={verifiedArtifacts} />
        <Metric label="Unresolved artifacts" value={unresolvedArtifacts} warning={unresolvedArtifacts > 0} />
        <Metric label="Confirmed statements" value={confirmedStatements} />
        <Metric label="Unresolved statements" value={unresolvedStatements} warning={unresolvedStatements > 0} />
        <Metric label="Regressions" value={regressions} warning={regressions > 0} />
      </dl>

      {baseline && <div className="mt-4 grid gap-2 rounded-xl border border-border/50 bg-background/20 p-3 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="min-w-0"><span className="font-medium text-foreground">Baseline</span><span className="ml-2 break-all">{baseline.repository.owner}/{baseline.repository.repo} · {baseline.baseBranch}</span></div>
        <div className="min-w-0"><span className="font-medium text-foreground">Later scan</span><span className="ml-2 break-all">{result ? `${result.identity.state} · ${result.currentScanFingerprint.slice(0, 16)}` : 'Not attached yet'}</span></div>
      </div>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={outcome === 'pending' || outcome === 'incompatible' ? onRescan : onViewTechnicalEvidence} disabled={(outcome === 'pending' || outcome === 'incompatible') && !onRescan} className="min-h-10">
          {status === 'scanning' ? 'Scanning later state…' : primaryLabel}
        </Button>
        {baseline?.prUrl && <Button asChild type="button" variant="ghost" className="min-h-10"><a href={baseline.prUrl} target="_blank" rel="noreferrer">Open applied PR<ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
      </div>
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className={`min-w-0 rounded-lg border px-3 py-2 ${warning ? 'border-warning/35 bg-warning/5' : 'border-border/45 bg-background/25'}`}><dt className="break-words text-muted-foreground">{label}</dt><dd className="mt-1 font-display text-lg font-semibold text-foreground">{value.toLocaleString()}</dd></div>;
}

function OutcomeIcon({ outcome }: { outcome: RepositoryVerificationOutcome }) {
  if (outcome === 'verified') return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />;
  if (outcome === 'regressed') return <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />;
  if (outcome === 'incompatible' || outcome === 'unresolved') return <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />;
  return <CircleDashed className="h-5 w-5 text-primary-glow" aria-hidden="true" />;
}

function contentFor(outcome: RepositoryVerificationOutcome) {
  return ({
    pending: { heading: 'Awaiting a later scan', explanation: 'Applied state is not treated as verified. Scan the changed repository and attach it to this baseline.' },
    verified: { heading: 'Verified', explanation: 'All blocking expected artifacts and statements are confirmed by compatible later-scan evidence, with no blocking regression.' },
    'partially-verified': { heading: 'Partially verified', explanation: 'Some expected changes are confirmed, while bounded evidence or human review remains open.' },
    unresolved: { heading: 'Unresolved', explanation: 'Required expectations are missing or cannot be confirmed from the available evidence.' },
    regressed: { heading: 'Regressed', explanation: 'The later scan contains a blocking contradiction, changed-differently artifact, or lost required capability.' },
    incompatible: { heading: 'Incompatible comparison', explanation: 'Repository, branch, scanner, measurement, or evidence boundaries prevent a trustworthy comparison.' },
  })[outcome];
}

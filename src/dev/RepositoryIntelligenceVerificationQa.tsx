import { useMemo, useState } from 'react';
import { RepositoryIntelligenceVerificationPanel } from '@/components/agentready/RepositoryIntelligenceVerificationPanel';
import { RepositoryIntelligencePrApply } from '@/components/agentready/RepositoryIntelligencePrApply';
import { RepositoryIntelligenceReviewSurface } from '@/components/agentready/RepositoryIntelligenceReviewPanel';
import { buildRepositoryIntelligenceArtifactReview, updateRepositoryIntelligenceReviewSelection } from '@/lib/repositoryIntelligence';
import type { RepoScanInput } from '@/lib/types';
import type { RepositoryIntelligencePrPreviewResponse } from '@/lib/github/write';
import type {
  RepositoryIntelligenceArtifactVerification,
  RepositoryIntelligenceArtifactOperation,
  RepositoryIntelligenceArtifactVerificationState,
  RepositoryIntelligenceOverallVerificationState,
  RepositoryIntelligenceProviderStatus,
  RepositoryIntelligenceStatementVerificationState,
  RepositoryIntelligenceVerificationBaseline,
  RepositoryIntelligenceVerificationResult,
} from '@/lib/repositoryIntelligence';

const states: RepositoryIntelligenceOverallVerificationState[] = [
  'fully-verified', 'partially-verified', 'changes-detected', 'verification-blocked', 'unavailable',
];

function isApplicableOperation(operation: RepositoryIntelligenceArtifactOperation): operation is 'create' | 'update' | 'strengthen' {
  return operation === 'create' || operation === 'update' || operation === 'strengthen';
}

function prPreviewFixture() {
  const textContents: Record<string, string> = {
    'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18', vite: '^5' } }),
    'README.md': '# Repository Intelligence PR acceptance fixture',
    'vite.config.ts': "import { defineConfig } from 'vite'; export default defineConfig({});",
    'src/main.tsx': "import App from './App'; export const bootstrap = () => <App />;",
    'src/App.tsx': 'export default function App() { return <main>ShipSeal QA</main>; }',
    'src/App.test.tsx': "import App from './App'; export const subject = App;",
    'docs/ARCHITECTURE.md': '# Handwritten architecture\n\nThis maintainer-authored content must remain intact.',
  };
  const scanInput: RepoScanInput = {
    repoName: 'shipseal-qa/repository-intelligence-fixture',
    source: { sourceType: 'github-app', githubOwner: 'shipseal-qa', githubRepo: 'repository-intelligence-fixture', githubBranch: 'main', githubDefaultBranch: 'main', githubInstallationId: 'qa-installation' },
    files: Object.entries(textContents).map(([path, content]) => ({ path, size: content.length })),
    textContents,
  };
  const built = buildRepositoryIntelligenceArtifactReview({ scanInput });
  const strengthen = built.review.items.find(item => item.operation === 'strengthen');
  let review = built.review;
  if (strengthen) {
    review = updateRepositoryIntelligenceReviewSelection(review, { type: 'include', artifactId: strengthen.artifactId }).review;
    review = updateRepositoryIntelligenceReviewSelection(review, { type: 'acknowledge-human-review', artifactId: strengthen.artifactId, acknowledged: true }).review;
  }
  return { artifactSet: built.artifactSet, review, initialReview: built.review };
}

function artifact(state: RepositoryIntelligenceArtifactVerificationState, index: number, statementState: RepositoryIntelligenceStatementVerificationState = 'verified-by-current-deterministic-evidence'): RepositoryIntelligenceArtifactVerification {
  return {
    id: `qa-verification:${index}`,
    artifactId: `qa-artifact:${index}`,
    targetPath: index === 0 ? 'src/features/customer-support/knowledge-base/AGENTS.md' : `AGENT_MEMORY/qa-artifact-${index}.md`,
    operation: index === 1 ? 'strengthen' : index === 2 ? 'update' : 'create',
    category: index === 0 ? 'folder-agent-instructions' : index === 2 ? 'command-map' : 'architecture-memory',
    baselineArtifactFingerprint: `ctx:qa-baseline-${index}:100`,
    expectedAppliedContentFingerprint: `ctx:qa-expected-${index}:100`,
    currentContentFingerprint: ['missing', 'unavailable'].includes(state) ? undefined : `ctx:qa-current-${index}:100`,
    expectedManagedSectionFingerprint: index === 1 ? 'ctx:qa-section:100' : undefined,
    currentManagedSectionFingerprint: index === 1 ? 'ctx:qa-section:100' : undefined,
    preservationState: index === 1 ? 'preserved-with-additions' : 'not-applicable',
    state,
    confidence: state === 'verified-exact' ? 'high' : 'medium',
    identityState: 'verified-compatible',
    statementResults: [{
      id: `qa-statement-result:${index}`,
      statementId: `qa-statement:${index}`,
      artifactId: `qa-artifact:${index}`,
      statementType: index === 2 ? 'command' : index === 6 ? 'risk' : 'repository-fact',
      state: statementState,
      referencedPaths: [index === 2 ? 'package.json' : `src/module-${index}.ts`],
      resolvedEvidenceIds: statementState === 'verified-by-current-deterministic-evidence' ? [`qa-evidence:${index}`] : [],
      missingEvidenceIds: statementState === 'contradicted' ? [`qa-evidence:${index}`] : [],
      limitations: statementState === 'contradicted' ? ['The referenced command is no longer present.'] : statementState === 'requires-human-review' ? ['Security conclusions require human review.'] : [],
      nextAction: statementState === 'contradicted' ? 'Update the command map from current repository evidence.' : statementState === 'requires-human-review' ? 'Review this claim with a qualified maintainer.' : 'No statement action is required.',
    }],
    verifiedStatementCount: statementState === 'verified-by-current-deterministic-evidence' ? 1 : 0,
    unresolvedStatementCount: statementState === 'verified-by-current-deterministic-evidence' ? 0 : 1,
    evidenceCoverage: { referenced: 1, resolved: statementState === 'verified-by-current-deterministic-evidence' ? 1 : 0, missing: statementState === 'contradicted' ? 1 : 0 },
    humanReviewRequired: state === 'requires-human-review' || statementState === 'requires-human-review',
    limitations: state === 'unavailable' ? ['Current limited scan did not include readable content.'] : state === 'conflicting' ? ['ShipSeal-managed marker conflict detected.'] : [],
    nextAction: state === 'missing' ? 'Restore the reviewed artifact, then rescan.' : state === 'unavailable' ? 'Run a broader compatible rescan.' : 'Review the current artifact state.',
  };
}

function fixture(overallState: RepositoryIntelligenceOverallVerificationState): { baseline: RepositoryIntelligenceVerificationBaseline; result: RepositoryIntelligenceVerificationResult } {
  const artifacts = [
    artifact('verified-exact', 0),
    artifact('verified-strengthened', 1),
    artifact('verified-present-with-modifications', 2, 'contradicted'),
    artifact('missing', 3),
    artifact('conflicting', 4),
    artifact('unavailable', 5, 'unavailable'),
    artifact('requires-human-review', 6, 'requires-human-review'),
    artifact('partially-verified', 7, 'still-inferred'),
  ];
  const counts = { 'verified-exact': 0, 'verified-present-with-modifications': 0, 'verified-strengthened': 0, 'partially-verified': 0, missing: 0, conflicting: 0, stale: 0, unavailable: 0, 'not-applicable': 0, 'requires-human-review': 0 } as RepositoryIntelligenceVerificationResult['counts'];
  artifacts.forEach(item => { counts[item.state] += 1; });
  const statementCounts = { 'verified-by-current-deterministic-evidence': 0, 'present-in-artifact-only': 0, 'still-inferred': 0, contradicted: 0, 'evidence-missing': 0, unavailable: 0, 'requires-human-review': 0 } as RepositoryIntelligenceVerificationResult['statementCounts'];
  artifacts.flatMap(item => item.statementResults).forEach(item => { statementCounts[item.state] += 1; });
  const baseline: RepositoryIntelligenceVerificationBaseline = {
    schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1', applySchemaVersion: 'shipseal.repository-intelligence-github-apply.v1', pathPolicyVersion: 'shipseal.repository-path-policy.v1',
    repository: { owner: 'shipseal-qa', repo: 'repository-intelligence-fixture' }, baseBranch: 'main', prBranch: 'shipseal/repository-intelligence-qa', selectedPlanFingerprint: 'ctx:qa-plan:100',
    prUrl: 'https://github.com/shipseal-qa/repository-intelligence-fixture/pull/1',
    artifacts: artifacts.map(item => ({ artifactId: item.artifactId, category: item.category, artifactFingerprint: item.baselineArtifactFingerprint, targetPath: item.targetPath, operation: item.operation, finalContentFingerprint: item.expectedAppliedContentFingerprint, expectedManagedSectionFingerprint: item.expectedManagedSectionFingerprint, expectedPreservationFingerprint: item.operation === 'strengthen' ? 'ctx:qa-preservation:100' : undefined, preservedLineFingerprints: [], humanReviewRequired: item.humanReviewRequired, statements: [] })),
  };
  return { baseline, result: {
    version: 'shipseal.repository-intelligence-verification-result.v1', baselineFingerprint: 'ctx:qa-baseline:100', currentScanFingerprint: 'ctx:qa-scan:100',
    identity: { state: overallState === 'verification-blocked' ? 'branch-mismatch' : 'verified-compatible', repositoryMatches: true, branchCompatible: overallState !== 'verification-blocked', reasons: overallState === 'verification-blocked' ? ['Repository or branch lineage is incompatible with this baseline.'] : [] },
    lifecycle: overallState === 'fully-verified' ? 'verified' : overallState === 'verification-blocked' ? 'incompatible-baseline' : overallState === 'unavailable' ? 'verification-unavailable' : 'eligible-for-verification',
    overallState, artifacts, counts, statementCounts,
    quality: { dimensions: [
      { dimension: 'artifact-presence', state: 'partial', verified: 3, unresolved: 5 }, { dimension: 'provenance-integrity', state: 'verified', verified: 6, unresolved: 2 },
      { dimension: 'evidence-freshness', state: 'partial', verified: 5, unresolved: 3 }, { dimension: 'handwritten-preservation', state: 'verified', verified: 1, unresolved: 0 },
      { dimension: 'command-accuracy', state: 'conflicting', verified: 0, unresolved: 1 }, { dimension: 'limitation-visibility', state: 'verified', verified: 4, unresolved: 0 },
    ] },
    comparison: { exactArtifacts: 2, modifiedArtifacts: 2, missingArtifacts: 1, conflictingArtifacts: 1, unavailableArtifacts: 1, newlyCorroboratedStatements: 2, inferredStatements: 1, contradictedStatements: 1, humanReviewItemsOpen: 1 },
    openWork: [
      { id: 'qa-work:missing', artifactId: 'qa-artifact:3', path: 'AGENT_MEMORY/qa-artifact-3.md', reason: 'Applied artifact is missing from the complete rescan.', evidence: ['Target path was not found in complete scanner coverage.'], priority: 'high', nextAction: 'Restore the reviewed artifact, then rescan.', actionType: 'regenerate' },
      { id: 'qa-work:command', artifactId: 'qa-artifact:2', path: 'package.json', reason: 'The reviewed command mapping no longer matches current deterministic evidence.', evidence: ['Referenced command is absent.'], priority: 'medium', nextAction: 'Regenerate the command map and review the change.', actionType: 'human-review' },
    ],
    limitations: ['One target was unavailable in the current limited scan.'], fingerprint: `ctx:qa-result-${overallState}:100`,
  } };
}

export default function RepositoryIntelligenceVerificationQa() {
  const [view, setView] = useState<'verification' | 'artifact-review' | 'pr-preview'>('verification');
  const [state, setState] = useState<RepositoryIntelligenceOverallVerificationState>('partially-verified');
  const [awaiting, setAwaiting] = useState(false);
  const data = useMemo(() => fixture(state), [state]);
  const prData = useMemo(() => prPreviewFixture(), []);
  const [qaReview, setQaReview] = useState(prData.initialReview);
  const [providerStatus, setProviderStatus] = useState<RepositoryIntelligenceProviderStatus>({ state: 'deterministic', message: 'Deterministic Repository Intelligence is ready for review.', retryable: false });
  const previewRequest = async (): Promise<RepositoryIntelligencePrPreviewResponse> => ({
    mode: 'preview',
    plan: {
      repository: { owner: 'shipseal-qa', repo: 'repository-intelligence-fixture' },
      baseBranch: 'main', baseCommit: 'abcdef123456', proposedBranchName: 'shipseal/repository-intelligence-qa',
      pullRequestTitle: 'ShipSeal: improve AI repository intelligence', selectedPlanFingerprint: prData.review.selectedPlanFingerprint,
      files: prData.review.items.filter(item => item.selected && isApplicableOperation(item.operation)).map(item => ({ path: item.targetPath, operation: item.operation as 'create' | 'update' | 'strengthen', artifactId: item.artifactId, finalContentFingerprint: item.artifactFingerprint, humanReviewAcknowledged: item.humanReviewAcknowledged })),
      operationCounts: prData.review.summary.selectedOperationCounts,
      warnings: ['Preview fixture only: the apply action is intentionally unavailable during acceptance QA.'], applyReady: true, fingerprint: 'ctx:qa-preview:100',
    },
  });
  return <main className="min-h-screen bg-background px-3 py-6 text-foreground md:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-warning">Development-only acceptance fixture</div>
        <p className="mt-1 text-sm text-muted-foreground">Typed verification results rendered by the production component. No scan, provider, GitHub request or repository mutation occurs.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" aria-pressed={view === 'verification'} onClick={() => setView('verification')} className="rounded-full border border-primary/50 px-3 py-2 text-xs">Verification states</button><button type="button" aria-pressed={view === 'artifact-review'} onClick={() => setView('artifact-review')} className="rounded-full border border-primary/50 px-3 py-2 text-xs">Artifact review</button><button type="button" aria-pressed={view === 'pr-preview'} onClick={() => setView('pr-preview')} className="rounded-full border border-primary/50 px-3 py-2 text-xs">PR preview</button></div>
        {view === 'verification' && <div className="mt-3 flex flex-wrap gap-2">{states.map(item => <button type="button" key={item} aria-pressed={!awaiting && state === item} onClick={() => { setState(item); setAwaiting(false); }} className="rounded-full border border-border px-3 py-2 text-xs">{item}</button>)}<button type="button" aria-pressed={awaiting} onClick={() => setAwaiting(true)} className="rounded-full border border-border px-3 py-2 text-xs">awaiting-rescan</button></div>}
      </div>
      {view === 'verification' && <RepositoryIntelligenceVerificationPanel baseline={data.baseline} result={awaiting ? null : data.result} currentRepository="shipseal-qa/repository-intelligence-fixture" currentBranch={state === 'verification-blocked' ? 'unrelated-branch' : 'main'} scanLimited={state === 'unavailable'} onRescan={() => undefined} />}
      {view === 'artifact-review' && <>
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Provider acceptance states">
          <button type="button" onClick={() => setProviderStatus({ state: 'deterministic', message: 'Deterministic Repository Intelligence is ready for review.', retryable: false })} className="rounded-full border border-border px-3 py-2 text-xs">Provider deterministic</button>
          <button type="button" onClick={() => setProviderStatus({ state: 'preparing', message: 'Preparing bounded optional enhancement.', retryable: false })} className="rounded-full border border-border px-3 py-2 text-xs">Provider preparing</button>
          <button type="button" onClick={() => setProviderStatus({ state: 'enhanced', message: 'Validated provider findings enhanced this review.', retryable: false, providerId: 'qa-fixture' })} className="rounded-full border border-border px-3 py-2 text-xs">Provider enhanced</button>
          <button type="button" onClick={() => setProviderStatus({ state: 'fallback', category: 'provider_unavailable', message: 'Enhanced intelligence was unavailable; deterministic artifacts remain ready.', retryable: true })} className="rounded-full border border-border px-3 py-2 text-xs">Provider fallback</button>
        </div>
        <RepositoryIntelligenceReviewSurface artifactSet={prData.artifactSet} review={qaReview} providerStatus={providerStatus} prepareEnhancement={async () => setProviderStatus({ state: 'enhanced', message: 'Validated provider findings enhanced this review.', retryable: false, providerId: 'qa-fixture' })} onReviewChange={setQaReview} />
      </>}
      {view === 'pr-preview' && <RepositoryIntelligencePrApply artifactSet={prData.artifactSet} review={prData.review} connection={{ connectionStatus: 'connected', sourceMode: 'github-app', owner: 'shipseal-qa', repo: 'repository-intelligence-fixture', defaultBranch: 'main', installationId: 'qa-installation', canCreatePullRequest: true, canListRepositories: true }} submitRequest={previewRequest} />}
    </div>
  </main>;
}

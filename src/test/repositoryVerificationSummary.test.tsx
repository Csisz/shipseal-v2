import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryVerificationSummary } from '@/components/agentready/result-dashboard/RepositoryVerificationSummary';
import type { RepositoryIntelligenceVerificationBaseline, RepositoryIntelligenceVerificationResult } from '@/lib/repositoryIntelligence';

const baseline: RepositoryIntelligenceVerificationBaseline = {
  schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1',
  applySchemaVersion: 'shipseal.repository-intelligence-github-apply.v1',
  pathPolicyVersion: 'shipseal.repository-path-policy.v1',
  repository: { owner: 'long-owner-name', repo: 'long-repository-name' },
  baseBranch: 'main', prBranch: 'shipseal/verification', selectedPlanFingerprint: 'selectedplanfingerprint1',
  preparedPlanId: 'prepared:selectedplanfingerprint1', appliedOperationId: 'github-pr:selectedplanfingerprint1:1',
  artifacts: [{ artifactId: 'artifact-1', category: 'root-agent-instructions', artifactFingerprint: 'artifactfingerprint1', targetPath: 'very/long/path/to/AGENTS.md', operation: 'create', finalContentFingerprint: 'contentfingerprint1', preservedLineFingerprints: [], humanReviewRequired: false, statements: [] }],
  prUrl: 'https://github.com/example/repository/pull/1', prNumber: 1,
};

describe('Omega 18.4 compact verification experience', () => {
  it('keeps Applied pending until a later scan produces evidence', () => {
    const onRescan = vi.fn();
    render(<RepositoryVerificationSummary baseline={baseline} onRescan={onRescan} onViewTechnicalEvidence={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Awaiting a later scan' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Scan changed repository' }));
    expect(onRescan).toHaveBeenCalledOnce();
  });

  it.each([
    ['fully-verified', 'verified-compatible', 'verified-exact', 'Verified'],
    ['partially-verified', 'verified-compatible', 'partially-verified', 'Partially verified'],
    ['changes-detected', 'verified-compatible', 'conflicting', 'Regressed'],
    ['verification-blocked', 'repository-mismatch', 'unavailable', 'Incompatible comparison'],
    ['partially-verified', 'verified-compatible', 'missing', 'Unresolved'],
  ] as const)('shows authoritative %s evidence as %s', (overallState, identity, artifactState, heading) => {
    render(<RepositoryVerificationSummary baseline={baseline} result={resultFixture(overallState, identity, artifactState)} onViewTechnicalEvidence={vi.fn()} />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByLabelText('Verification summary counts')).toBeInTheDocument();
    expect(screen.getByText(/very\/long\/path\/to\/AGENTS\.md|long-owner-name\/long-repository-name/)).toBeInTheDocument();
  });

  it('opens technical evidence only on request and keeps the applied PR available as a secondary action', () => {
    const onEvidence = vi.fn();
    render(<RepositoryVerificationSummary baseline={baseline} result={resultFixture('fully-verified', 'verified-compatible', 'verified-exact')} onViewTechnicalEvidence={onEvidence} />);
    fireEvent.click(screen.getByRole('button', { name: /Review verified changes/i }));
    expect(onEvidence).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: /Open applied PR/i })).toHaveAttribute('href', baseline.prUrl);
  });
});

function resultFixture(
  overallState: RepositoryIntelligenceVerificationResult['overallState'],
  identityState: RepositoryIntelligenceVerificationResult['identity']['state'],
  artifactState: RepositoryIntelligenceVerificationResult['artifacts'][number]['state'],
): RepositoryIntelligenceVerificationResult {
  const artifact = {
    id: 'verification-artifact-1', artifactId: 'artifact-1', targetPath: baseline.artifacts[0].targetPath, operation: 'create' as const,
    category: 'root-agent-instructions' as const, baselineArtifactFingerprint: 'baselinefingerprint1', expectedAppliedContentFingerprint: 'contentfingerprint1',
    preservationState: 'not-applicable' as const, state: artifactState, confidence: 'high' as const, identityState,
    statementResults: [], verifiedStatementCount: 0, unresolvedStatementCount: 0, evidenceCoverage: { referenced: 0, resolved: 0, missing: 0 },
    humanReviewRequired: false, limitations: [], nextAction: 'Review evidence.',
  };
  const counts = { 'verified-exact': 0, 'verified-present-with-modifications': 0, 'verified-strengthened': 0, 'partially-verified': 0, missing: 0, conflicting: 0, stale: 0, unavailable: 0, 'not-applicable': 0, 'requires-human-review': 0 };
  counts[artifactState] = 1;
  return {
    version: 'shipseal.repository-intelligence-verification-result.v1', baselineFingerprint: 'baselinefingerprint1', currentScanFingerprint: 'currentscanfingerprint1',
    identity: { state: identityState, repositoryMatches: identityState !== 'repository-mismatch', branchCompatible: identityState !== 'branch-mismatch', reasons: [] },
    lifecycle: overallState === 'fully-verified' ? 'verified' : overallState === 'verification-blocked' ? 'incompatible-baseline' : 'eligible-for-verification',
    overallState, artifacts: [artifact], counts,
    statementCounts: { 'verified-by-current-deterministic-evidence': 0, 'present-in-artifact-only': 0, 'still-inferred': 0, contradicted: 0, 'evidence-missing': 0, unavailable: 0, 'requires-human-review': 0 },
    quality: { dimensions: [] }, comparison: { exactArtifacts: 0, modifiedArtifacts: 0, missingArtifacts: artifactState === 'missing' ? 1 : 0, conflictingArtifacts: artifactState === 'conflicting' ? 1 : 0, unavailableArtifacts: artifactState === 'unavailable' ? 1 : 0, newlyCorroboratedStatements: 0, inferredStatements: 0, contradictedStatements: 0, humanReviewItemsOpen: 0 },
    openWork: [], limitations: [], fingerprint: 'resultfingerprint1',
  };
}

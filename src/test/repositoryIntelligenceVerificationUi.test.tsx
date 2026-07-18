import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  RepositoryIntelligenceVerificationPanel,
  RepositoryIntelligenceVerificationSummary,
} from '@/components/agentready/RepositoryIntelligenceVerificationPanel';
import type {
  RepositoryIntelligenceArtifactVerification,
  RepositoryIntelligenceArtifactVerificationState,
  RepositoryIntelligenceOverallVerificationState,
  RepositoryIntelligenceStatementVerificationState,
  RepositoryIntelligenceVerificationBaseline,
  RepositoryIntelligenceVerificationResult,
} from '@/lib/repositoryIntelligence';

const LONG_PATH = 'src/features/customer-support/knowledge-base/repository-intelligence/AGENTS.md';

function baseline(): RepositoryIntelligenceVerificationBaseline {
  return {
    schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1',
    applySchemaVersion: 'shipseal.repository-intelligence-github-apply.v1',
    pathPolicyVersion: 'shipseal.repository-path-policy.v1',
    repository: { owner: 'acme', repo: 'demo' },
    baseBranch: 'main',
    prBranch: 'shipseal/repository-intelligence-abcd1234',
    selectedPlanFingerprint: 'ctx:12345678:100',
    artifacts: [],
    prUrl: 'https://github.com/acme/demo/pull/42',
    prNumber: 42,
  };
}

function artifact(state: RepositoryIntelligenceArtifactVerificationState, index: number, options: Partial<RepositoryIntelligenceArtifactVerification> = {}): RepositoryIntelligenceArtifactVerification {
  const statementState: RepositoryIntelligenceStatementVerificationState = options.statementResults?.[0]?.state || 'verified-by-current-deterministic-evidence';
  return {
    id: `verification:${index}`,
    artifactId: `artifact:${index}`,
    targetPath: index === 0 ? LONG_PATH : `docs/artifact-${index}.md`,
    operation: index === 1 ? 'strengthen' : 'create',
    category: index === 0 ? 'folder-agent-instructions' : 'architecture-memory',
    baselineArtifactFingerprint: `ctx:baseline${index}:100`,
    expectedAppliedContentFingerprint: `ctx:expected${index}:100`,
    currentContentFingerprint: state === 'missing' || state === 'unavailable' ? undefined : `ctx:current${index}:100`,
    expectedManagedSectionFingerprint: index === 1 ? 'ctx:section1:100' : undefined,
    currentManagedSectionFingerprint: index === 1 ? 'ctx:section1:100' : undefined,
    preservationState: index === 1 ? 'preserved-with-additions' : 'not-applicable',
    state,
    confidence: state === 'verified-exact' ? 'high' : 'medium',
    identityState: 'verified-compatible',
    statementResults: [{
      id: `statement-result:${index}`,
      statementId: `statement:${index}`,
      artifactId: `artifact:${index}`,
      statementType: index === 2 ? 'command' : 'repository-fact',
      state: statementState,
      referencedPaths: [`src/module-${index}.ts`],
      resolvedEvidenceIds: statementState === 'verified-by-current-deterministic-evidence' ? [`evidence:${index}`] : [],
      missingEvidenceIds: statementState === 'contradicted' ? [`evidence:${index}`] : [],
      limitations: statementState === 'contradicted' ? ['The referenced command is no longer present.'] : [],
      nextAction: statementState === 'contradicted' ? 'Update the command map.' : 'No statement action is required.',
    }],
    verifiedStatementCount: statementState === 'verified-by-current-deterministic-evidence' ? 1 : 0,
    unresolvedStatementCount: statementState === 'verified-by-current-deterministic-evidence' ? 0 : 1,
    evidenceCoverage: { referenced: 1, resolved: statementState === 'verified-by-current-deterministic-evidence' ? 1 : 0, missing: statementState === 'contradicted' ? 1 : 0 },
    humanReviewRequired: state === 'requires-human-review' || statementState === 'requires-human-review',
    limitations: state === 'unavailable' ? ['Current scan did not include readable content.'] : state === 'conflicting' ? ['Managed marker conflict detected.'] : [],
    nextAction: state === 'missing' ? 'Restore the reviewed artifact, then rescan.' : 'Review the current artifact state.',
    ...options,
  };
}

function result(overallState: RepositoryIntelligenceOverallVerificationState = 'partially-verified'): RepositoryIntelligenceVerificationResult {
  const artifacts = [
    artifact('verified-exact', 0),
    artifact('verified-strengthened', 1),
    artifact('verified-present-with-modifications', 2, { statementResults: [{ id: 'statement-result:2', statementId: 'statement:2', artifactId: 'artifact:2', statementType: 'command', state: 'contradicted', referencedPaths: ['package.json'], resolvedEvidenceIds: [], missingEvidenceIds: ['evidence:command'], limitations: ['The referenced command is no longer present.'], nextAction: 'Update the command map.' }] }),
    artifact('missing', 3),
    artifact('conflicting', 4),
    artifact('unavailable', 5),
    artifact('requires-human-review', 6, { statementResults: [{ id: 'statement-result:6', statementId: 'statement:6', artifactId: 'artifact:6', statementType: 'risk', state: 'requires-human-review', referencedPaths: ['src/security.ts'], resolvedEvidenceIds: [], missingEvidenceIds: [], limitations: ['Security conclusions require human review.'], nextAction: 'Review this claim with a qualified maintainer.' }] }),
    artifact('partially-verified', 7, { statementResults: [{ id: 'statement-result:7', statementId: 'statement:7', artifactId: 'artifact:7', statementType: 'responsibility-description', state: 'still-inferred', referencedPaths: ['src'], resolvedEvidenceIds: [], missingEvidenceIds: [], limitations: ['Provider inference is not deterministic evidence.'], nextAction: 'Keep this statement marked inferred.' }] }),
  ];
  const counts = { 'verified-exact': 0, 'verified-present-with-modifications': 0, 'verified-strengthened': 0, 'partially-verified': 0, missing: 0, conflicting: 0, stale: 0, unavailable: 0, 'not-applicable': 0, 'requires-human-review': 0 } as RepositoryIntelligenceVerificationResult['counts'];
  artifacts.forEach(item => { counts[item.state] += 1; });
  const statementCounts = { 'verified-by-current-deterministic-evidence': 0, 'present-in-artifact-only': 0, 'still-inferred': 0, contradicted: 0, 'evidence-missing': 0, unavailable: 0, 'requires-human-review': 0 } as RepositoryIntelligenceVerificationResult['statementCounts'];
  artifacts.flatMap(item => item.statementResults).forEach(item => { statementCounts[item.state] += 1; });
  return {
    version: 'shipseal.repository-intelligence-verification-result.v1',
    baselineFingerprint: 'ctx:baseline:100',
    currentScanFingerprint: 'ctx:scan:100',
    identity: { state: 'verified-compatible', repositoryMatches: true, branchCompatible: true, reasons: [] },
    lifecycle: overallState === 'fully-verified' ? 'verified' : overallState === 'verification-blocked' ? 'incompatible-baseline' : overallState === 'unavailable' ? 'verification-unavailable' : 'eligible-for-verification',
    overallState,
    artifacts,
    counts,
    statementCounts,
    quality: { dimensions: [
      { dimension: 'artifact-presence', state: 'partial', verified: 3, unresolved: 5 },
      { dimension: 'provenance-integrity', state: 'verified', verified: 6, unresolved: 2 },
      { dimension: 'evidence-freshness', state: 'partial', verified: 5, unresolved: 3 },
      { dimension: 'handwritten-preservation', state: 'verified', verified: 1, unresolved: 0 },
      { dimension: 'command-accuracy', state: 'conflicting', verified: 0, unresolved: 1 },
      { dimension: 'path-accuracy', state: 'partial', verified: 5, unresolved: 2 },
      { dimension: 'responsibility-coverage', state: 'partial', verified: 4, unresolved: 1 },
      { dimension: 'limitation-visibility', state: 'verified', verified: 4, unresolved: 0 },
      { dimension: 'review-completeness', state: 'partial', verified: 5, unresolved: 2 },
    ] },
    comparison: { exactArtifacts: 2, modifiedArtifacts: 2, missingArtifacts: 1, conflictingArtifacts: 1, unavailableArtifacts: 1, newlyCorroboratedStatements: 5, inferredStatements: 1, contradictedStatements: 1, humanReviewItemsOpen: 1 },
    openWork: [{ id: 'work:1', artifactId: 'artifact:3', path: 'docs/artifact-3.md', reason: 'Applied artifact is missing from the complete rescan.', evidence: ['Target path was not found.'], priority: 'high', nextAction: 'Restore the reviewed artifact, then rescan.', actionType: 'regenerate' }],
    limitations: ['One target was unavailable in the current scan.'],
    fingerprint: 'ctx:result:100',
  };
}

function renderPanel(overallState: RepositoryIntelligenceOverallVerificationState = 'partially-verified', props: Record<string, unknown> = {}) {
  const verification = result(overallState);
  const saved = baseline();
  saved.artifacts = verification.artifacts.map(item => ({ artifactId: item.artifactId, category: item.category, artifactFingerprint: item.baselineArtifactFingerprint, targetPath: item.targetPath, operation: item.operation, finalContentFingerprint: item.expectedAppliedContentFingerprint, expectedManagedSectionFingerprint: item.expectedManagedSectionFingerprint, expectedPreservationFingerprint: item.operation === 'strengthen' ? 'ctx:preserve:100' : undefined, preservedLineFingerprints: [], humanReviewRequired: item.humanReviewRequired, statements: [] }));
  render(<RepositoryIntelligenceVerificationPanel baseline={saved} result={verification} currentRepository="acme/demo" currentBranch="main" {...props} />);
  return { verification, saved };
}

describe('Repository Intelligence verification experience', () => {
  it.each([
    ['fully-verified', 'Fully verified'], ['partially-verified', 'Partially verified'], ['changes-detected', 'Changes detected'], ['verification-blocked', 'Verification blocked'], ['unavailable', 'Verification unavailable'],
  ] as const)('renders the %s summary with plain language and no numeric score', (state, label) => {
    const verification = result(state);
    const saved = baseline(); saved.artifacts = verification.artifacts.map(item => ({ artifactId: item.artifactId, category: item.category, artifactFingerprint: item.baselineArtifactFingerprint, targetPath: item.targetPath, operation: item.operation, finalContentFingerprint: item.expectedAppliedContentFingerprint, preservedLineFingerprints: [], humanReviewRequired: item.humanReviewRequired, statements: [] }));
    const { unmount } = render(<RepositoryIntelligenceVerificationSummary baseline={saved} result={verification} currentBranch="main" />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/\/ 100|percent|score/i)).not.toBeInTheDocument();
    unmount();
  });

  it('filters exact, modified, missing, conflicting, unavailable and review-required artifacts without merging missing and unavailable', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Missing' }));
    const list = screen.getByLabelText('Verified Repository Intelligence artifacts');
    expect(within(list).getByText('docs/artifact-3.md')).toBeInTheDocument();
    expect(within(list).queryByText('docs/artifact-5.md')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unavailable' }));
    expect(within(list).getByText('docs/artifact-5.md')).toBeInTheDocument();
    expect(within(list).queryByText('docs/artifact-3.md')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review required' }));
    expect(within(list).getByText('docs/artifact-6.md')).toBeInTheDocument();
  });

  it('shows exact versus modified state, statement truth, contradictions, limitations and next action without source content', () => {
    renderPanel();
    fireEvent.click(screen.getByText('docs/artifact-2.md'));
    const detail = screen.getByLabelText('Verification detail for docs/artifact-2.md');
    expect(within(detail).getAllByText('Present with modifications').length).toBeGreaterThan(0);
    expect(within(detail).getByText('Contradicted by current repository evidence')).toBeInTheDocument();
    expect(within(detail).getByText(/command is no longer present/i)).toBeInTheDocument();
    expect(within(detail).getByText(/Update the command map/i)).toBeInTheDocument();
    expect(detail.textContent).not.toContain('PRIVATE KEY');
    expect(detail.textContent).not.toContain('full source content');
  });

  it('keeps provider-only statements inferred and human-review statements open even when artifacts are present', () => {
    renderPanel();
    fireEvent.click(screen.getByText('docs/artifact-7.md'));
    expect(screen.getByText('Still inferred')).toBeInTheDocument();
    fireEvent.click(screen.getByText('docs/artifact-6.md'));
    expect(screen.getAllByText('Human review required').length).toBeGreaterThan(0);
    expect(screen.getByText(/File presence confirms/i)).toBeInTheDocument();
  });

  it('presents safe handwritten additions separately from the managed section', () => {
    renderPanel();
    fireEvent.click(screen.getByText('docs/artifact-1.md'));
    expect(screen.getByText('Preserved with later handwritten edits')).toBeInTheDocument();
    expect(screen.getByText('ShipSeal-managed section intact')).toBeInTheDocument();
    expect(screen.getByText(/not treated as a failure/i)).toBeInTheDocument();
  });

  it('renders evidence-backed open work and navigates to its artifact without generic filler', () => {
    renderPanel();
    const work = screen.getByText('Applied artifact is missing from the complete rescan.').closest('article')!;
    expect(within(work).getByText('Regenerate')).toBeInTheDocument();
    fireEvent.click(within(work).getByRole('button', { name: 'Review artifact' }));
    expect(screen.getByLabelText('Verification detail for docs/artifact-3.md')).toBeInTheDocument();
    expect(screen.queryByText(/best practice|consider improving/i)).not.toBeInTheDocument();
  });

  it('preserves the previous result during rescan, exposes GitHub context and uses semantic controls', () => {
    const onRescan = vi.fn();
    renderPanel('partially-verified', { status: 'scanning', onRescan });
    expect(screen.getByText(/previous valid verification remains visible/i)).toBeInTheDocument();
    expect(screen.getAllByText(LONG_PATH).every(element => element.className.includes('break-all'))).toBe(true);
    expect(screen.getByRole('link', { name: /Open Pull Request/i })).toHaveAttribute('href', 'https://github.com/acme/demo/pull/42');
    const rescan = screen.getByRole('button', { name: /Rescanning/i });
    expect(rescan).toBeDisabled();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps repository and branch identity readable below the status on narrow screens', () => {
    const verification = result();
    const saved = baseline();
    saved.repository = { owner: 'acme-with-a-long-organization-name', repo: 'repository-with-a-long-name' };
    const longBranch = 'shipseal/repository-intelligence/a-very-long-compatible-branch-name';
    render(<RepositoryIntelligenceVerificationSummary baseline={saved} result={verification} currentBranch={longBranch} />);
    const identity = screen.getByLabelText('Repository and branch identity');

    expect(identity.className).toContain('w-full');
    expect(identity.className).toContain('min-w-0');
    expect(identity.className).toContain('text-left');
    expect(identity.className).toContain('sm:w-auto');
    expect(identity.className).toContain('sm:text-right');
    expect(identity).toHaveTextContent(longBranch);
    expect(identity.querySelectorAll('div')[1].className).toContain('break-words');
  });

  it('shows safe empty, awaiting and failed states without raw errors or repository mutation actions', () => {
    const { rerender } = render(<RepositoryIntelligenceVerificationPanel />);
    expect(screen.getByText('No Repository Intelligence verification baseline')).toBeInTheDocument();
    rerender(<RepositoryIntelligenceVerificationPanel baseline={baseline()} currentBranch="main" onRescan={vi.fn()} />);
    expect(screen.getByText(/no compatible completed rescan/i)).toBeInTheDocument();
    rerender(<RepositoryIntelligenceVerificationPanel baseline={baseline()} status="failed" error="Verification could not be completed safely." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Verification could not be completed safely.');
    expect(screen.queryByRole('button', { name: /merge|checkout|write branch/i })).not.toBeInTheDocument();
  });
});

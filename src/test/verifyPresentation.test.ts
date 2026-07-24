import { describe, expect, it } from 'vitest';
import { buildVerifyPresentation } from '@/components/agentready/result-dashboard/verifyPresentation';

describe('Verify lifecycle presentation', () => {
  it('keeps prepared, applied, verified, and unresolved states semantically distinct', () => {
    const prepared = buildVerifyPresentation({
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
      appliedArtifactCount: 0,
      verifiedItemCount: 0,
      unresolvedItemCount: 0,
      hasVerificationEvidence: false,
    });
    const applied = buildVerifyPresentation({
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
      appliedArtifactCount: 2,
      verifiedItemCount: 0,
      unresolvedItemCount: 0,
      hasVerificationEvidence: false,
    });
    const verified = buildVerifyPresentation({
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
      appliedArtifactCount: 2,
      verifiedItemCount: 2,
      unresolvedItemCount: 0,
      hasVerificationEvidence: true,
    });
    const unresolved = buildVerifyPresentation({
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
      appliedArtifactCount: 2,
      verifiedItemCount: 1,
      unresolvedItemCount: 1,
      hasVerificationEvidence: true,
    });

    expect(prepared).toMatchObject({ state: 'prepared', primaryAction: 'apply', primaryLabel: 'Apply or export plan' });
    expect(applied).toMatchObject({ state: 'applied', primaryAction: 'rescan', primaryLabel: 'Run a later scan' });
    expect(verified).toMatchObject({ state: 'verified', primaryAction: 'review-verification' });
    expect(unresolved).toMatchObject({ state: 'unresolved', heading: 'Partial verification' });
    expect(prepared.metrics).toHaveLength(2);
    expect(verified.metrics.map(metric => metric.label)).toContain('Items verified');
  });
});

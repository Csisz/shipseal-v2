export type VerifyLifecycleState = 'proposed' | 'prepared' | 'applied' | 'verified' | 'unresolved';
export type VerifyPrimaryAction = 'improve' | 'apply' | 'rescan' | 'review-verification';

export interface VerifyPresentation {
  state: VerifyLifecycleState;
  heading: string;
  explanation: string;
  primaryAction: VerifyPrimaryAction;
  primaryLabel: string;
  metrics: Array<{ label: string; value: number }>;
}

export function buildVerifyPresentation(input: {
  selectedProposalCount: number;
  preparedArtifactCount: number;
  appliedArtifactCount: number;
  verifiedItemCount: number;
  unresolvedItemCount: number;
  hasVerificationEvidence: boolean;
}) : VerifyPresentation {
  const metrics = [
    input.selectedProposalCount > 0 ? { label: 'Proposals selected', value: input.selectedProposalCount } : null,
    input.preparedArtifactCount > 0 ? { label: 'Artifacts prepared', value: input.preparedArtifactCount } : null,
    input.appliedArtifactCount > 0 ? { label: 'Artifacts applied', value: input.appliedArtifactCount } : null,
    input.hasVerificationEvidence ? { label: 'Items verified', value: input.verifiedItemCount } : null,
  ].filter((metric): metric is { label: string; value: number } => Boolean(metric)).slice(0, 4);

  if (input.hasVerificationEvidence && input.unresolvedItemCount > 0) {
    return {
      state: 'unresolved',
      heading: input.verifiedItemCount > 0 ? 'Partial verification' : 'Unresolved changes remain',
      explanation: `${input.unresolvedItemCount.toLocaleString()} item${input.unresolvedItemCount === 1 ? '' : 's'} still need evidence or resolution from a compatible later scan.`,
      primaryAction: 'review-verification',
      primaryLabel: 'Resolve remaining issues',
      metrics,
    };
  }

  if (input.hasVerificationEvidence) {
    return {
      state: 'verified',
      heading: 'Verified changes detected',
      explanation: 'The compatible later scan contains verification evidence for the prepared changes.',
      primaryAction: 'review-verification',
      primaryLabel: 'Review verification',
      metrics,
    };
  }

  if (input.appliedArtifactCount > 0) {
    return {
      state: 'applied',
      heading: 'Changes applied — rescan required',
      explanation: 'The plan was exported or included in a repository mutation, but a compatible later scan has not confirmed it yet.',
      primaryAction: 'rescan',
      primaryLabel: 'Run a later scan',
      metrics,
    };
  }

  if (input.preparedArtifactCount > 0) {
    return {
      state: 'prepared',
      heading: 'Plan prepared — not yet applied',
      explanation: 'Generated artifacts are ready for review or packaging; no repository change is implied.',
      primaryAction: 'apply',
      primaryLabel: 'Apply or export plan',
      metrics,
    };
  }

  return {
    state: 'proposed',
    heading: 'Waiting for a prepared plan',
    explanation: 'Review proposed improvements in Improve before creating artifacts for verification.',
    primaryAction: 'improve',
    primaryLabel: 'Review ShipSeal improvements',
    metrics,
  };
}

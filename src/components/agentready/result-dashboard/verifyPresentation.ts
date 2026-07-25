export const VERIFY_NORMAL_LIFECYCLE = ['proposed', 'prepared', 'applied', 'verified'] as const;

export type VerifyNormalLifecycleState = typeof VERIFY_NORMAL_LIFECYCLE[number];
export type VerifyLifecycleState = VerifyNormalLifecycleState | 'unresolved';
export type VerifyPrimaryAction = 'improve' | 'apply' | 'rescan' | 'review-verification';
export type VerifyJourneyStepState = 'completed' | 'current' | 'future';

export interface VerifyPresentation {
  state: VerifyLifecycleState;
  journeyStage: VerifyNormalLifecycleState;
  heading: string;
  explanation: string;
  completedSummary: string;
  pendingSummary: string;
  nextStep: string;
  primaryAction: VerifyPrimaryAction;
  primaryLabel: string;
  metrics: Array<{ label: string; value: number; tone?: 'default' | 'warning' }>;
  unresolvedCount: number;
}

export function buildVerifyPresentation(input: {
  selectedProposalCount: number;
  preparedArtifactCount: number;
  appliedArtifactCount: number;
  verifiedItemCount: number;
  unresolvedItemCount: number;
  hasVerificationEvidence: boolean;
}) : VerifyPresentation {
  if (input.hasVerificationEvidence && input.unresolvedItemCount > 0) {
    const hasVerifiedItems = input.verifiedItemCount > 0;
    return {
      state: 'unresolved',
      journeyStage: hasVerifiedItems ? 'verified' : 'applied',
      heading: hasVerifiedItems ? 'Partial verification' : 'Unresolved changes remain',
      explanation: hasVerifiedItems
        ? 'The later scan confirmed part of the expected change, but some findings still need attention.'
        : 'The later scan did not confirm the expected changes yet.',
      completedSummary: hasVerifiedItems
        ? 'A compatible later scan produced verification evidence.'
        : 'A compatible later scan compared the changed repository with its baseline.',
      pendingSummary: 'Outstanding findings are not treated as verified.',
      nextStep: 'Review the unresolved findings, resolve or acknowledge them, then scan again if repository changes are made.',
      primaryAction: 'review-verification',
      primaryLabel: 'Resolve remaining issues',
      metrics: [
        input.appliedArtifactCount > 0 ? { label: 'Artifacts applied', value: input.appliedArtifactCount } : null,
        hasVerifiedItems ? { label: 'Items verified', value: input.verifiedItemCount } : null,
        { label: 'Unresolved items', value: input.unresolvedItemCount, tone: 'warning' as const },
      ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric)),
      unresolvedCount: input.unresolvedItemCount,
    };
  }

  if (input.hasVerificationEvidence) {
    return {
      state: 'verified',
      journeyStage: 'verified',
      heading: 'Changes verified',
      explanation: 'The compatible later scan contains evidence for the expected repository changes.',
      completedSummary: 'ShipSeal compared the saved baseline with the later scan.',
      pendingSummary: 'No unresolved verification findings remain in the available evidence.',
      nextStep: 'Review the confirmed changes and their evidence before completing the delivery workflow.',
      primaryAction: 'review-verification',
      primaryLabel: 'Review verified changes',
      metrics: [
        input.appliedArtifactCount > 0 ? { label: 'Artifacts applied', value: input.appliedArtifactCount } : null,
        { label: 'Items verified', value: input.verifiedItemCount },
      ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric)),
      unresolvedCount: 0,
    };
  }

  if (input.appliedArtifactCount > 0) {
    return {
      state: 'applied',
      journeyStage: 'applied',
      heading: 'Changes applied',
      explanation: 'The plan was exported or included in a repository mutation and is ready for comparison.',
      completedSummary: 'Prepared artifacts were included in an export or repository change.',
      pendingSummary: 'A later scan has not confirmed the expected repository state.',
      nextStep: 'Scan the changed repository to compare it with the saved baseline and verify the expected artifacts.',
      primaryAction: 'rescan',
      primaryLabel: 'Run a later scan',
      metrics: [
        input.preparedArtifactCount > 0 ? { label: 'Artifacts prepared', value: input.preparedArtifactCount } : null,
        { label: 'Artifacts applied', value: input.appliedArtifactCount },
      ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric)),
      unresolvedCount: 0,
    };
  }

  if (input.preparedArtifactCount > 0) {
    return {
      state: 'prepared',
      journeyStage: 'prepared',
      heading: 'Plan prepared',
      explanation: 'Generated artifacts are ready for review or export.',
      completedSummary: 'ShipSeal prepared a deterministic plan from the selected proposals.',
      pendingSummary: 'No repository change has been applied or verified.',
      nextStep: 'Apply or export the plan. After the repository changes, run a later scan.',
      primaryAction: 'apply',
      primaryLabel: 'Apply or export plan',
      metrics: [
        input.selectedProposalCount > 0 ? { label: 'Proposals selected', value: input.selectedProposalCount } : null,
        { label: 'Artifacts prepared', value: input.preparedArtifactCount },
      ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric)),
      unresolvedCount: 0,
    };
  }

  return {
    state: 'proposed',
    journeyStage: 'proposed',
    heading: 'Improvements proposed',
    explanation: 'ShipSeal has identified improvements, but no optimization plan has been prepared.',
    completedSummary: input.selectedProposalCount > 0
      ? 'Repository evidence has been mapped to selected proposals.'
      : 'Repository evidence is available for improvement planning.',
    pendingSummary: 'No artifacts have been prepared, applied, or verified.',
    nextStep: 'Review the proposals in Improve and prepare the optimization plan before applying repository changes.',
    primaryAction: 'improve',
    primaryLabel: 'Prepare optimization plan',
    metrics: input.selectedProposalCount > 0
      ? [{ label: 'Proposals selected', value: input.selectedProposalCount }]
      : [],
    unresolvedCount: 0,
  };
}

export function verifyJourneyStepState(
  step: VerifyNormalLifecycleState,
  currentStage: VerifyNormalLifecycleState,
): VerifyJourneyStepState {
  const stepIndex = VERIFY_NORMAL_LIFECYCLE.indexOf(step);
  const currentIndex = VERIFY_NORMAL_LIFECYCLE.indexOf(currentStage);
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'future';
}

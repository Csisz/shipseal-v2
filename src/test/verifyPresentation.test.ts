import { describe, expect, it } from 'vitest';
import {
  buildVerifyPresentation,
  verifyJourneyStepState,
  VERIFY_NORMAL_LIFECYCLE,
} from '@/components/agentready/result-dashboard/verifyPresentation';

const baseInput = {
  selectedProposalCount: 0,
  preparedArtifactCount: 0,
  appliedArtifactCount: 0,
  verifiedItemCount: 0,
  unresolvedItemCount: 0,
  hasVerificationEvidence: false,
};

describe('Verify lifecycle presentation', () => {
  it('uses only the four normal sequential stages', () => {
    expect(VERIFY_NORMAL_LIFECYCLE).toEqual(['proposed', 'prepared', 'applied', 'verified']);
    expect(VERIFY_NORMAL_LIFECYCLE).not.toContain('unresolved');
  });

  it('derives completed, current, and future steps without changing lifecycle semantics', () => {
    expect(verifyJourneyStepState('proposed', 'prepared')).toBe('completed');
    expect(verifyJourneyStepState('prepared', 'prepared')).toBe('current');
    expect(verifyJourneyStepState('applied', 'prepared')).toBe('future');
    expect(verifyJourneyStepState('verified', 'prepared')).toBe('future');
  });

  it('builds the Proposed journey without applied or verified implications', () => {
    const proposed = buildVerifyPresentation({ ...baseInput, selectedProposalCount: 3 });

    expect(proposed).toMatchObject({
      state: 'proposed',
      journeyStage: 'proposed',
      heading: 'Improvements proposed',
      primaryAction: 'improve',
      primaryLabel: 'Prepare optimization plan',
    });
    expect(proposed.pendingSummary).toMatch(/No artifacts have been prepared, applied, or verified/i);
    expect(proposed.nextStep).toMatch(/Review the proposals/i);
    expect(proposed.metrics).toEqual([{ label: 'Proposals selected', value: 3 }]);
  });

  it('keeps Prepared, Applied, and Verified copy and actions distinct', () => {
    const prepared = buildVerifyPresentation({
      ...baseInput,
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
    });
    const applied = buildVerifyPresentation({
      ...baseInput,
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
      appliedArtifactCount: 2,
    });
    const verified = buildVerifyPresentation({
      ...baseInput,
      selectedProposalCount: 3,
      preparedArtifactCount: 2,
      appliedArtifactCount: 2,
      verifiedItemCount: 2,
      hasVerificationEvidence: true,
    });

    expect(prepared).toMatchObject({ state: 'prepared', heading: 'Plan prepared', primaryLabel: 'Apply or export plan' });
    expect(prepared.pendingSummary).toMatch(/No repository change has been applied or verified/i);
    expect(prepared.nextStep).toMatch(/run a later scan/i);
    expect(applied).toMatchObject({ state: 'applied', heading: 'Changes applied', primaryLabel: 'Run a later scan' });
    expect(applied.pendingSummary).toMatch(/has not confirmed/i);
    expect(verified).toMatchObject({ state: 'verified', heading: 'Changes verified', primaryLabel: 'Review verified changes' });
    expect(verified.metrics.map(metric => metric.label)).toEqual(['Artifacts applied', 'Items verified']);
  });

  it('treats Unresolved as a conditional exception with only supported metrics', () => {
    const unresolved = buildVerifyPresentation({
      ...baseInput,
      preparedArtifactCount: 4,
      appliedArtifactCount: 4,
      verifiedItemCount: 2,
      unresolvedItemCount: 1,
      hasVerificationEvidence: true,
    });

    expect(unresolved).toMatchObject({
      state: 'unresolved',
      journeyStage: 'verified',
      heading: 'Partial verification',
      primaryLabel: 'Resolve remaining issues',
      unresolvedCount: 1,
    });
    expect(unresolved.metrics.map(metric => metric.label)).toEqual(['Artifacts applied', 'Items verified', 'Unresolved items']);
    expect(unresolved.metrics.find(metric => metric.label === 'Unresolved items')?.tone).toBe('warning');
    expect(unresolved.metrics.map(metric => metric.label)).not.toContain('Proposals selected');
    expect(unresolved.metrics.map(metric => metric.label)).not.toContain('Artifacts prepared');
  });
});

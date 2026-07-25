import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VerificationJourney } from '@/components/agentready/result-dashboard/VerificationJourney';
import { buildVerifyPresentation } from '@/components/agentready/result-dashboard/verifyPresentation';

describe('Verification journey UI', () => {
  it('renders four accessible steps with completed, current, and future semantics', () => {
    render(
      <VerificationJourney
        presentation={buildVerifyPresentation({
          selectedProposalCount: 3,
          preparedArtifactCount: 2,
          appliedArtifactCount: 0,
          verifiedItemCount: 0,
          unresolvedItemCount: 0,
          hasVerificationEvidence: false,
        })}
        showArtifactReview
        onPrimaryAction={vi.fn()}
        onReviewArtifacts={vi.fn()}
        onViewTechnicalEvidence={vi.fn()}
      />
    );

    const journey = screen.getByRole('list', { name: /Verification lifecycle/i });
    const steps = within(journey).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveAttribute('data-step-state', 'completed');
    expect(steps[1]).toHaveAttribute('data-step-state', 'current');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[2]).toHaveAttribute('data-step-state', 'future');
    expect(within(journey).queryByText('Unresolved')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plan prepared' })).toBeInTheDocument();
    expect(screen.getByText(/No repository change has been applied or verified/i)).toBeInTheDocument();
    expect(screen.getByText(/After the repository changes, run a later scan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply or export plan' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Verification supporting metrics/i)).toHaveTextContent('2Artifacts prepared');
  });

  it('shows Unresolved as an exception and keeps one primary action near the state content', () => {
    const onPrimaryAction = vi.fn();
    render(
      <VerificationJourney
        presentation={buildVerifyPresentation({
          selectedProposalCount: 3,
          preparedArtifactCount: 2,
          appliedArtifactCount: 2,
          verifiedItemCount: 1,
          unresolvedItemCount: 2,
          hasVerificationEvidence: true,
        })}
        showArtifactReview
        onPrimaryAction={onPrimaryAction}
        onReviewArtifacts={vi.fn()}
        onViewTechnicalEvidence={vi.fn()}
      />
    );

    expect(screen.getByRole('status', { name: /Unresolved verification findings/i })).toHaveTextContent('2 items');
    expect(screen.getByRole('list', { name: /Verification lifecycle/i }).children).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Resolve remaining issues/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resolve remaining issues/i }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('keeps secondary actions optional and uses theme-semantic surfaces', () => {
    const { container } = render(
      <VerificationJourney
        presentation={buildVerifyPresentation({
          selectedProposalCount: 0,
          preparedArtifactCount: 0,
          appliedArtifactCount: 0,
          verifiedItemCount: 0,
          unresolvedItemCount: 0,
          hasVerificationEvidence: false,
        })}
        showArtifactReview={false}
        onPrimaryAction={vi.fn()}
        onReviewArtifacts={vi.fn()}
        onViewTechnicalEvidence={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Review prepared artifacts/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View technical evidence/i })).toBeInTheDocument();
    expect(container.querySelector('section')).toHaveClass('bg-background/25');
    expect(container.querySelector('[style]')).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PostScanOverview } from '@/components/agentready/result-dashboard/PostScanOverview';
import { selectRepositoryFrictions } from '@/components/agentready/result-dashboard/repositoryFrictions';
import { buildSampleReport } from '@/lib/readiness';

describe('PostScanOverview', () => {
  it('leads with repository identity and actions without exposing score walls or exports', () => {
    const report = buildSampleReport();
    const onReview = vi.fn();
    const onExplore = vi.fn();
    render(
      <PostScanOverview
        report={report}
        frictions={selectRepositoryFrictions(report.repositoryHealth)}
        onReviewRepositoryIntelligence={onReview}
        onExploreRepositoryUniverse={onExplore}
        onReset={vi.fn()}
      />,
    );

    const overview = screen.getByRole('heading', { name: 'Repository understood.' }).closest('section');
    expect(overview).not.toBeNull();
    expect(within(overview!).getByText(report.repoName)).toBeInTheDocument();
    expect(within(overview!).getByText(report.stack.primary)).toBeInTheDocument();
    expect(within(overview!).queryByText(/\/ 100|score\.json|Delivery Pack/i)).not.toBeInTheDocument();

    fireEvent.click(within(overview!).getByRole('button', { name: 'Review Repository Intelligence PR' }));
    fireEvent.click(within(overview!).getByRole('button', { name: 'Explore in Repository Universe' }));
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('uses a conservative headline and limitation for limited scans', () => {
    const report = buildSampleReport();
    report.scanSummary = { ...report.scanSummary, limited: true };
    render(
      <PostScanOverview
        report={report}
        limitedScanReason="Archive exceeded the bounded scan window."
        frictions={selectRepositoryFrictions(report.repositoryHealth)}
        onReviewRepositoryIntelligence={vi.fn()}
        onExploreRepositoryUniverse={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Repository evidence is limited.' })).toBeInTheDocument();
    expect(screen.getByText(/Archive exceeded the bounded scan window/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Repository understood.' })).not.toBeInTheDocument();
  });
});

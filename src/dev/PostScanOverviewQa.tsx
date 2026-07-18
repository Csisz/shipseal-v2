import { useMemo } from 'react';
import { PostScanOverview } from '@/components/agentready/result-dashboard/PostScanOverview';
import { selectRepositoryFrictions } from '@/components/agentready/result-dashboard/repositoryFrictions';
import { buildSampleReport } from '@/lib/readiness';

export default function PostScanOverviewQa() {
  const report = useMemo(() => {
    const fixture = structuredClone(buildSampleReport());
    fixture.repoName = 'shipseal-enterprise-repository-with-an-intentionally-long-mobile-name';
    fixture.source = {
      ...fixture.source,
      sourceType: 'github-app',
      githubOwner: 'shipseal-quality-assurance-organization',
      githubRepo: 'repository-with-an-intentionally-long-mobile-name',
      githubBranch: 'feature/repository-intelligence/long-mobile-branch-name-for-wrapping',
      githubDefaultBranch: 'main',
    };
    fixture.scanSummary = { ...fixture.scanSummary, limited: true };
    fixture.scanEvidence = {
      ...fixture.scanEvidence,
      repositoryFullName: 'shipseal-quality-assurance-organization/repository-with-an-intentionally-long-mobile-name',
      branchOrRef: fixture.source.githubBranch,
      limitationReason: 'The development fixture intentionally represents a bounded scan so unavailable areas are not treated as failures.',
    };
    return fixture;
  }, []);

  return (
    <main className="min-h-screen bg-background pt-20 text-foreground">
      <div className="container py-12">
        <PostScanOverview
          report={report}
          limitedScanReason={report.scanEvidence.limitationReason}
          frictions={selectRepositoryFrictions(report.repositoryHealth)}
          onReviewRepositoryIntelligence={() => undefined}
          onExploreRepositoryUniverse={() => undefined}
          onReset={() => undefined}
        />
      </div>
    </main>
  );
}

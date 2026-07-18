import { useMemo } from 'react';
import { ResultDashboard } from '@/components/agentready/ResultDashboard';
import { buildSampleReport } from '@/lib/readiness';

export default function PostScanChaptersQa() {
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
    fixture.scanEvidence = {
      ...fixture.scanEvidence,
      repositoryFullName: 'shipseal-quality-assurance-organization/repository-with-an-intentionally-long-mobile-name',
      branchOrRef: fixture.source.githubBranch,
    };
    return fixture;
  }, []);

  return (
    <main className="min-h-screen bg-background pt-20 text-foreground">
      <ResultDashboard
        report={report}
        history={[]}
        onReset={() => undefined}
        onClearHistory={() => undefined}
        prepareRepositoryIntelligenceReview={() => new Promise<never>(() => undefined)}
      />
    </main>
  );
}

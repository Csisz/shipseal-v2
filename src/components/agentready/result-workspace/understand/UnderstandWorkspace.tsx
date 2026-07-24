import type { ReadinessReport } from '@/lib/types';
import type { WorkspaceStoryChapter } from '@/lib/workspace';
import { evaluateReadiness } from '@/lib/scoring';
import {
  LiveAgentSimulator,
  MeasurementBoundary,
  RepositoryHealthActions,
  RepositoryHealthDimensions,
  WorkspaceOverview,
} from '../universe/UniverseWorkspace';
import {
  DecisionSummary,
  ScanEvidencePanel,
} from '../deliver/DeliveryWorkspaceSupport';
import { ResultWorkspaceDisclosure as Disclosure } from '../ResultWorkspaceDisclosure';

interface UnderstandWorkspaceProps {
  active: boolean;
  report: ReadinessReport;
  activeStoryChapter: WorkspaceStoryChapter | null;
}

export default function UnderstandWorkspace({
  active,
  report,
  activeStoryChapter,
}: UnderstandWorkspaceProps) {
  const repositoryHealth = report.repositoryHealth;
  const ready = evaluateReadiness(report.score, report.blockers).isReady;

  return (
    <>
      {active && (
        <Disclosure title="Supporting workspace views">
          <div className="grid gap-6">
            <WorkspaceOverview report={report} />
            <LiveAgentSimulator report={report} activeChapter={activeStoryChapter} />
          </div>
        </Disclosure>
      )}

      <div className={active ? '' : 'hidden'} aria-hidden={!active}>
        <Disclosure title="Repository evidence" defaultOpen={false}>
          {repositoryHealth.overall.score !== null && (
            <>
              <RepositoryHealthActions repositoryHealth={repositoryHealth} />
              <RepositoryHealthDimensions repositoryHealth={repositoryHealth} />
            </>
          )}

          <div className="grid gap-6 mb-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <ScanEvidencePanel report={report} />
            <MeasurementBoundary repositoryHealth={repositoryHealth} />
          </div>

          <DecisionSummary
            report={report}
            ready={ready}
            nextActions={report.aiNarrative.nextBestActions.slice(0, 3)}
          />
        </Disclosure>
      </div>
    </>
  );
}

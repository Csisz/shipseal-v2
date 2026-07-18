import { useEffect, type RefObject } from 'react';
import type { ReadinessReport } from '@/lib/types';
import type { GitHubConnectionState } from '@/lib/githubConnection/types';
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline } from '@/lib/repositoryIntelligence';
import { RepositoryIntelligenceReviewPanel, type RepositoryIntelligenceReviewUiSession } from '../../RepositoryIntelligenceReviewPanel';
import { RepositoryFrictionProgression } from '../chapterContent';
import type { RepositoryFriction } from '../types';

export interface ImproveChapterProps {
  frictions: RepositoryFriction[];
  targetRef: RefObject<HTMLDivElement>;
  focusTarget: boolean;
  onTargetFocused: () => void;
  session?: RepositoryIntelligenceReviewUiSession | null;
  preparing?: boolean;
  error?: string | null;
  prepareSession?: () => Promise<RepositoryIntelligenceReviewUiSession>;
  providerStatus?: RepositoryIntelligenceProviderStatus;
  prepareEnhancement?: () => Promise<void>;
  githubConnection?: GitHubConnectionState;
  report: ReadinessReport;
  onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void;
}

export default function ImproveChapter({
  frictions,
  targetRef,
  focusTarget,
  onTargetFocused,
  session,
  preparing,
  error,
  prepareSession,
  providerStatus,
  prepareEnhancement,
  githubConnection,
  report,
  onVerificationBaseline,
}: ImproveChapterProps) {
  useEffect(() => {
    if (!focusTarget || !targetRef.current) return;
    targetRef.current.focus({ preventScroll: true });
    targetRef.current.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    onTargetFocused();
  }, [focusTarget, onTargetFocused, targetRef]);

  return (
    <div className="space-y-6">
      <RepositoryFrictionProgression frictions={frictions} />
      <div ref={targetRef} id="repository-intelligence-review" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <RepositoryIntelligenceReviewPanel
          session={session}
          preparing={preparing}
          error={error}
          enabled
          prepareSession={prepareSession}
          providerStatus={providerStatus}
          prepareEnhancement={prepareEnhancement}
          githubConnection={githubConnection}
          onVerificationBaseline={onVerificationBaseline}
        />
      </div>
    </div>
  );
}

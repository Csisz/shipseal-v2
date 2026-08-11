import { useEffect, type RefObject } from 'react';
import type { ReadinessReport } from '@/lib/types';
import type { GitHubConnectionState } from '@/lib/githubConnection/types';
import type { RepositoryIntelligenceProviderStatus, RepositoryIntelligenceVerificationBaseline, RepositoryProductIntelligenceResult } from '@/lib/repositoryIntelligence';
import { RepositoryIntelligenceReviewPanel, type RepositoryIntelligenceReviewUiSession } from '../../RepositoryIntelligenceReviewPanel';
import { RepositoryFrictionProgression } from '../chapterContent';
import type { RepositoryFriction } from '../types';
import { ResultWorkspaceDisclosure } from '../../result-workspace/ResultWorkspaceDisclosure';
import RepositoryFuturePathways from '../../result-workspace/futures/RepositoryFuturePathways';
import type { RepositoryFutureStageOverlay } from '../../result-workspace/futures/futurePathwaysPresentation';
import type { RepositoryUniverseModel } from '@/lib/workspace';

export interface ImproveChapterProps {
  variant: 'pathways' | 'other';
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
  universe: RepositoryUniverseModel;
  productIntelligence?: RepositoryProductIntelligenceResult | null;
  onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void;
  onFutureStageOverlayChange: (overlay: RepositoryFutureStageOverlay | null) => void;
}

export default function ImproveChapter({
  variant,
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
  universe,
  productIntelligence,
  onVerificationBaseline,
  onFutureStageOverlayChange,
}: ImproveChapterProps) {
  useEffect(() => {
    if (variant !== 'other') return;
    if (!focusTarget || !targetRef.current) return;
    targetRef.current.focus({ preventScroll: true });
    targetRef.current.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    onTargetFocused();
  }, [focusTarget, onTargetFocused, targetRef, variant]);

  if (variant === 'pathways') {
    return <RepositoryFuturePathways report={report} universe={universe} productIntelligence={productIntelligence} providerStatus={providerStatus} onStageOverlayChange={onFutureStageOverlayChange} />;
  }

  return (
    <section aria-label="Other improvement evidence" className="space-y-5 rounded-[2rem] border border-border/55 bg-card/40 p-5 shadow-[var(--shadow-md-semantic)] md:p-7">
      <ResultWorkspaceDisclosure title="Optimization and Repository Intelligence" defaultOpen={focusTarget} lazyMount>
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
      </ResultWorkspaceDisclosure>
    </section>
  );
}

import type { ProjectIntake } from '@/lib/intake';
import type { ReadinessReport } from '@/lib/types';
import type {
  WorkspaceStory,
  WorkspaceStoryChapter,
  WorkspaceStoryChapterId,
} from '@/lib/workspace';

export function selectActiveWorkspaceStoryChapter(
  story: WorkspaceStory,
  requestedChapterId: WorkspaceStoryChapterId | null | undefined,
): WorkspaceStoryChapter | null {
  return story.chapters.find(chapter => chapter.id === requestedChapterId)
    || story.chapters.find(chapter => chapter.id === story.initialChapterId)
    || null;
}

export function selectLimitedScanReason(report: ReadinessReport): string | undefined {
  return report.scanEvidence.limitationReason
    || report.scanSummary.warnings.find(warning => (
      /limited scan|fallback|file limit|archive|GitHub access|ZIP/i.test(warning)
    ));
}

export function sameProjectIntake(a: ProjectIntake, b: ProjectIntake): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

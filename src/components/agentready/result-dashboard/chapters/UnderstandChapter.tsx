import type { ReadinessReport } from '@/lib/types';
import type { WorkspaceStory } from '@/lib/workspace';
import { WorkspaceStoryLead } from '../chapterContent';

export default function UnderstandChapter({ report, story }: { report: ReadinessReport; story: WorkspaceStory }) {
  return <WorkspaceStoryLead report={report} story={story} />;
}

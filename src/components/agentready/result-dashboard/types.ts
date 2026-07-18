export type ResultChapterId = 'understand' | 'improve' | 'verify' | 'deliver';

export type ResultChapterStatuses = Record<ResultChapterId, string>;

export type RepositoryFrictionSource = 'blocker' | 'top-action' | 'insufficient-evidence';

export interface RepositoryFriction {
  id: string;
  title: string;
  detail: string;
  source: RepositoryFrictionSource;
  evidence?: string;
  recommendation?: string;
}

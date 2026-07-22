import type { RepositoryUniverseNode } from './repositoryUniverse';

export type RepositoryUniverseLabelPriority = 'selected' | 'hovered' | 'search' | 'route' | 'cluster' | 'important' | 'background';

export interface RepositoryUniverseLabelCandidate {
  node: RepositoryUniverseNode;
  selected?: boolean;
  hovered?: boolean;
  matched?: boolean;
  route?: boolean;
  focused?: boolean;
  eligible: boolean;
}

export interface RepositoryUniverseLabelPlan {
  activeNodeIds: string[];
  suppressedBackgroundCount: number;
}

const PRIORITY: Record<RepositoryUniverseLabelPriority, number> = {
  selected: 0,
  hovered: 1,
  search: 2,
  route: 3,
  cluster: 4,
  important: 5,
  background: 6,
};

export function repositoryUniverseLabelPriority(candidate: RepositoryUniverseLabelCandidate): RepositoryUniverseLabelPriority {
  if (candidate.selected) return 'selected';
  if (candidate.hovered) return 'hovered';
  if (candidate.matched) return 'search';
  if (candidate.route) return 'route';
  if (candidate.focused) return 'cluster';
  if (candidate.node.kind === 'repository' || candidate.node.importance !== 'background') return 'important';
  return 'background';
}

export function repositoryUniverseBackgroundLabelCap(nodeCount: number, viewportWidth: number) {
  const mobile = viewportWidth < 640;
  const baseline = mobile ? 5 : 12;
  const growth = Math.floor(Math.sqrt(Math.max(0, nodeCount - 1)));
  return Math.min(mobile ? 9 : 20, baseline + growth);
}

/** Selects bounded labels without ever suppressing direct-interaction labels. */
export function buildRepositoryUniverseLabelPlan(candidates: readonly RepositoryUniverseLabelCandidate[], viewportWidth: number): RepositoryUniverseLabelPlan {
  const backgroundCap = repositoryUniverseBackgroundLabelCap(candidates.length, viewportWidth);
  let retainedBackground = 0;
  let suppressedBackgroundCount = 0;
  const activeNodeIds = candidates
    .filter(candidate => candidate.eligible)
    .sort((left, right) => {
      const priority = PRIORITY[repositoryUniverseLabelPriority(left)] - PRIORITY[repositoryUniverseLabelPriority(right)];
      return priority || left.node.id.localeCompare(right.node.id);
    })
    .flatMap(candidate => {
      if (repositoryUniverseLabelPriority(candidate) !== 'background') return [candidate.node.id];
      if (retainedBackground++ < backgroundCap) return [candidate.node.id];
      suppressedBackgroundCount += 1;
      return [];
    });
  return { activeNodeIds, suppressedBackgroundCount };
}

export interface RepositoryUniverseLabelAsset<T> {
  value: T;
  references: number;
  lastUsed: number;
}

/** Bounded per-Universe LRU cache. Callers own asset construction and disposal. */
export class RepositoryUniverseLabelAssetCache<T> {
  private readonly assets = new Map<string, RepositoryUniverseLabelAsset<T>>();
  hits = 0;
  misses = 0;
  disposals = 0;

  constructor(private readonly capacity: number, private readonly dispose: (value: T) => void) {}

  acquire(key: string, create: () => T) {
    const existing = this.assets.get(key);
    if (existing) {
      existing.references += 1;
      existing.lastUsed = Date.now();
      this.hits += 1;
      return existing.value;
    }
    this.misses += 1;
    const value = create();
    this.assets.set(key, { value, references: 1, lastUsed: Date.now() });
    this.evict();
    return value;
  }

  release(key: string) {
    const asset = this.assets.get(key);
    if (!asset) return;
    asset.references = Math.max(0, asset.references - 1);
    asset.lastUsed = Date.now();
    this.evict();
  }

  clear() {
    for (const asset of this.assets.values()) {
      this.dispose(asset.value);
      this.disposals += 1;
    }
    this.assets.clear();
  }

  get size() { return this.assets.size; }

  private evict() {
    while (this.assets.size > this.capacity) {
      const candidate = [...this.assets.entries()]
        .filter(([, asset]) => asset.references === 0)
        .sort((left, right) => left[1].lastUsed - right[1].lastUsed || left[0].localeCompare(right[0]))[0];
      if (!candidate) return;
      this.assets.delete(candidate[0]);
      this.dispose(candidate[1].value);
      this.disposals += 1;
    }
  }
}

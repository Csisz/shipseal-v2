import { describe, expect, it } from 'vitest';
import { buildRepositoryUniverseLabelPlan, RepositoryUniverseLabelAssetCache, repositoryUniverseBackgroundLabelCap, type RepositoryUniverseLabelCandidate } from '@/lib/workspace/repositoryUniverseLabels';
import type { RepositoryUniverseNode } from '@/lib/workspace/repositoryUniverse';

function node(id: string, importance: RepositoryUniverseNode['importance'] = 'background'): RepositoryUniverseNode {
  return { id, kind: 'file', label: id, clusterId: 'cluster', evidenceType: 'evidence', importance, radius: 1, position: { x: 0, y: 0, z: 0 }, evidenceItems: [], metadata: {} };
}

describe('Repository Universe label lifecycle planning', () => {
  it('keeps selected and hovered labels while bounding deterministic background labels', () => {
    const candidates: RepositoryUniverseLabelCandidate[] = Array.from({ length: 25 }, (_, index) => ({ node: node(`node-${index}`), eligible: true }));
    candidates[20].selected = true;
    candidates[21].hovered = true;
    const first = buildRepositoryUniverseLabelPlan(candidates, 390);
    const second = buildRepositoryUniverseLabelPlan(candidates, 390);
    expect(first).toEqual(second);
    expect(first.activeNodeIds).toEqual(expect.arrayContaining(['node-20', 'node-21']));
    expect(first.suppressedBackgroundCount).toBeGreaterThan(0);
    expect(repositoryUniverseBackgroundLabelCap(25, 390)).toBeLessThan(repositoryUniverseBackgroundLabelCap(25, 1440));
  });

  it('reuses compatible assets and disposes an evicted asset once', () => {
    const disposed: string[] = [];
    const cache = new RepositoryUniverseLabelAssetCache<string>(1, asset => disposed.push(asset));
    expect(cache.acquire('same', () => 'first')).toBe('first');
    cache.release('same');
    expect(cache.acquire('same', () => 'other')).toBe('first');
    cache.release('same');
    cache.acquire('different', () => 'second');
    expect(cache.hits).toBe(1);
    expect(disposed).toEqual(['first']);
    cache.clear();
    expect(disposed).toEqual(['first', 'second']);
  });
});

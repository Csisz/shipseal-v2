import { describe, expect, it } from 'vitest';
import type { RepositoryUniverseNode } from '@/lib/workspace';
import { repositoryUniverseSemanticStyle } from '@/lib/workspace/repositoryUniverseSemantics';
import {
  repositoryUniverseRendererTokens,
  repositoryUniverseSemanticVisibility,
  repositoryUniverseSemanticZoomLevel,
} from '@/lib/workspace/repositoryUniverseVisual';

function node(overrides: Partial<RepositoryUniverseNode> = {}): RepositoryUniverseNode {
  return {
    id: 'file:fixture',
    label: 'fixture',
    kind: 'file',
    clusterId: 'cluster:src',
    evidenceType: 'evidence',
    importance: 'background',
    radius: 3,
    position: { x: 0, y: 0, z: 0 },
    evidenceItems: [],
    metadata: {},
    ...overrides,
  };
}

describe('Repository Universe semantic navigation', () => {
  it.each([
    ['repository', node({ kind: 'repository' }), 'repository'],
    ['folder', node({ kind: 'folder' }), 'folder'],
    ['source', node({ metadata: { category: 'source' } }), 'source'],
    ['documentation', node({ metadata: { category: 'documentation' } }), 'documentation'],
    ['test', node({ metadata: { category: 'test' } }), 'test'],
    ['configuration', node({ metadata: { category: 'configuration' } }), 'configuration'],
    ['workflow', node({ metadata: { category: 'workflow' } }), 'workflow'],
    ['agent instruction', node({ metadata: { category: 'agent-instruction' } }), 'agent-instruction'],
    ['generated output', node({ metadata: { category: 'generated' } }), 'generated'],
    ['asset', node({ metadata: { category: 'asset' } }), 'asset'],
    ['concept', node({ kind: 'concept' }), 'concept'],
    ['recommendation', node({ kind: 'recommendation', evidenceType: 'missing' }), 'recommendation'],
    ['missing risk', node({ evidenceType: 'missing' }), 'missing'],
  ])('deterministically classifies %s nodes', (_label, fixture, expected) => {
    expect(repositoryUniverseSemanticStyle(fixture).semanticType).toBe(expected);
    expect(repositoryUniverseSemanticStyle(fixture)).toEqual(repositoryUniverseSemanticStyle(fixture));
  });

  it('falls back without inventing a role for unsupported metadata', () => {
    const unknown = repositoryUniverseSemanticStyle(node({ metadata: { language: 'Unknown DSL', repositoryRole: 'Unstructured note' } }));
    expect(unknown.semanticType).toBe('unknown');
    expect(unknown.shortLabel).toBe('Repository entity');
  });

  it('maps camera radius to four stable semantic zoom levels', () => {
    expect(repositoryUniverseSemanticZoomLevel(1500)).toBe('overview');
    expect(repositoryUniverseSemanticZoomLevel(720)).toBe('overview');
    expect(repositoryUniverseSemanticZoomLevel(719)).toBe('map');
    expect(repositoryUniverseSemanticZoomLevel(430)).toBe('map');
    expect(repositoryUniverseSemanticZoomLevel(429)).toBe('detail');
    expect(repositoryUniverseSemanticZoomLevel(240)).toBe('detail');
    expect(repositoryUniverseSemanticZoomLevel(239)).toBe('evidence');
  });

  it('keeps overview sparse and progressively reveals concrete file identity', () => {
    const backgroundSource = node({ metadata: { category: 'source' } });
    const overview = repositoryUniverseSemanticVisibility(backgroundSource, { zoomLevel: 'overview' });
    const detail = repositoryUniverseSemanticVisibility(backgroundSource, { zoomLevel: 'detail', connected: true });
    const evidence = repositoryUniverseSemanticVisibility(backgroundSource, { zoomLevel: 'evidence' });

    expect(overview.showIcon).toBe(false);
    expect(overview.showLabel).toBe(false);
    expect(overview.nodeOpacityMultiplier).toBeLessThan(1);
    expect(detail.showIcon).toBe(true);
    expect(detail.showLabel).toBe(true);
    expect(evidence.showIcon).toBe(true);
    expect(evidence.showLabel).toBe(true);
  });

  it.each(['selected', 'searched', 'route'] as const)('protects %s identity at every zoom level', stateName => {
    const state = {
      zoomLevel: 'overview' as const,
      selected: stateName === 'selected',
      searched: stateName === 'searched',
      route: stateName === 'route',
    };
    const visibility = repositoryUniverseSemanticVisibility(node(), state);
    expect(visibility.showIcon).toBe(true);
    expect(visibility.showLabel).toBe(true);
    expect(visibility.nodeOpacityMultiplier).toBe(1);
  });

  it('keeps semantic information identical when reduced motion removes interpolation', () => {
    const fixture = node({ kind: 'folder', importance: 'supporting', metadata: { depth: 1 } });
    const animated = repositoryUniverseSemanticVisibility(fixture, { zoomLevel: 'map', reducedMotion: false });
    const reduced = repositoryUniverseSemanticVisibility(fixture, { zoomLevel: 'map', reducedMotion: true });
    expect(reduced).toEqual(animated);
    expect(reduced.showIcon).toBe(true);
  });

  it('provides semantic emblem and landmark tokens for both themes', () => {
    const light = repositoryUniverseRendererTokens('light');
    const dark = repositoryUniverseRendererTokens('dark');
    expect(light.iconSurface).not.toBe(dark.iconSurface);
    expect(light.iconInk).not.toBe(dark.iconInk);
    expect(light.landmarkInk).not.toBe(dark.landmarkInk);
    expect(light.landmarkOpacityOverview).toBeGreaterThan(light.landmarkOpacityDetail);
    expect(dark.landmarkOpacityOverview).toBeGreaterThan(dark.landmarkOpacityDetail);
  });
});

import { describe, expect, it } from 'vitest';
import { repositoryUniverseNodeBaseColor, repositoryUniverseNodeDisplayLabel, repositoryUniverseRevealStartCamera } from '@/components/agentready/RepositoryUniverse3D';
import { REPOSITORY_UNIVERSE_CLUSTER_PALETTE, brightenClusterColor, repositoryUniverseClusterToken } from '@/lib/workspace/repositoryUniverseVisual';
import type { RepositoryUniverseNode } from '@/lib/workspace';

function node(overrides: Partial<RepositoryUniverseNode>) {
  return {
    id: 'node:unknown',
    label: 'Unknown',
    kind: 'file',
    clusterId: 'cluster:test',
    evidenceType: 'evidence',
    importance: 'supporting',
    radius: 3,
    position: { x: 0, y: 0, z: 0 },
    evidenceItems: [],
    metadata: {},
    ...overrides,
  } as RepositoryUniverseNode;
}

describe('Repository Universe 3D labels', () => {
  it('derives safe labels for repository, folder, file and concept nodes', () => {
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'repo:test', kind: 'repository', label: 'shipseal' }))).toBe('shipseal');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'folder:src', kind: 'folder', label: 'src', path: 'src' }))).toBe('src');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'file:readme', kind: 'file', label: 'README.md', path: 'README.md' }))).toBe('README.md');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'concept:context', kind: 'concept', label: 'Ignored generated context' }))).toBe('Ignored generated context');
  });

  it('falls back to path, id and a final unknown label without requiring a global label variable', () => {
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'file:path', label: '', path: 'src/App.tsx' }))).toBe('App.tsx');
    expect(repositoryUniverseNodeDisplayLabel(node({ id: 'concept:no-label', label: '', path: '' }))).toBe('concept:no-label');
    expect(repositoryUniverseNodeDisplayLabel({ id: '', label: '', path: '' })).toBe('Unknown repository entity');
  });

  it('keeps Repository Universe colors tied to stable cluster membership', () => {
    const documentation = node({ clusterId: 'cluster:documentation', metadata: { category: 'documentation' } });
    const documentationFolder = node({ kind: 'folder', clusterId: 'cluster:documentation', metadata: { category: 'documentation' } });
    const memory = node({ clusterId: 'cluster:project-memory', metadata: { category: 'agent-instruction' } });

    expect(repositoryUniverseClusterToken('cluster:documentation')).toEqual(repositoryUniverseClusterToken('cluster:documentation'));
    expect(repositoryUniverseNodeBaseColor(documentation)).toBe(repositoryUniverseNodeBaseColor(documentationFolder));
    expect(repositoryUniverseNodeBaseColor(documentation)).not.toBe(repositoryUniverseNodeBaseColor(memory));
    expect(brightenClusterColor(repositoryUniverseNodeBaseColor(documentation), 0.44)).not.toBe(0xf8fafc);
    expect(repositoryUniverseNodeBaseColor(node({ clusterId: 'cluster:documentation', evidenceType: 'heuristic', metadata: { category: 'documentation' } }))).not.toBe(repositoryUniverseNodeBaseColor(documentation));
  });

  it('keeps the deterministic cluster palette vivid and distinguishable', () => {
    const keyClusters = [
      'cluster:repository',
      'cluster:documentation',
      'cluster:project-memory',
      'cluster:verification',
      'cluster:ci-workflow',
      'cluster:configuration',
      'cluster:assets',
    ];
    const colors = keyClusters.map(clusterId => repositoryUniverseClusterToken(clusterId).hex);

    expect(new Set(colors).size).toBe(colors.length);
    for (let index = 0; index < colors.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < colors.length; otherIndex += 1) {
        expect(colorDistance(colors[index], colors[otherIndex])).toBeGreaterThan(54);
      }
    }
    expect(new Set(REPOSITORY_UNIVERSE_CLUSTER_PALETTE.map(token => token.hex)).size).toBe(REPOSITORY_UNIVERSE_CLUSTER_PALETTE.length);
  });

  it('starts the cinematic reveal wider without changing the working target and skips it for reduced motion', () => {
    const camera = {
      theta: 0.8,
      phi: 1.12,
      radius: 620,
      target: { x: 24, y: -12, z: 36 },
    };

    const revealStart = repositoryUniverseRevealStartCamera(camera);
    expect(revealStart.radius).toBeGreaterThanOrEqual(camera.radius + 200);
    expect(revealStart.radius).toBeGreaterThan(camera.radius * 1.3);
    expect(revealStart.radius).toBeLessThanOrEqual(1500);
    expect(revealStart.target).toEqual(camera.target);
    expect(revealStart.theta).not.toBe(camera.theta);
    expect(repositoryUniverseRevealStartCamera(camera, false)).toEqual(camera);
  });
});

function colorDistance(first: number, second: number) {
  const firstRed = (first >> 16) & 255;
  const firstGreen = (first >> 8) & 255;
  const firstBlue = first & 255;
  const secondRed = (second >> 16) & 255;
  const secondGreen = (second >> 8) & 255;
  const secondBlue = second & 255;
  return Math.hypot(firstRed - secondRed, firstGreen - secondGreen, firstBlue - secondBlue);
}

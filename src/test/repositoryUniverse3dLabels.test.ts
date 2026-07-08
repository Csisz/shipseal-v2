import { describe, expect, it } from 'vitest';
import { repositoryUniverseNodeBaseColor, repositoryUniverseNodeDisplayLabel } from '@/components/agentready/RepositoryUniverse3D';
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

  it('keeps Repository Universe colors tied to evidence and repository role', () => {
    expect(repositoryUniverseNodeBaseColor(node({ kind: 'repository', metadata: {} }))).toBe(0x67e8f9);
    expect(repositoryUniverseNodeBaseColor(node({ metadata: { category: 'documentation' } }))).toBe(0xa78bfa);
    expect(repositoryUniverseNodeBaseColor(node({ metadata: { category: 'agent-instruction' } }))).toBe(0x2dd4bf);
    expect(repositoryUniverseNodeBaseColor(node({ metadata: { category: 'test' } }))).toBe(0x86efac);
    expect(repositoryUniverseNodeBaseColor(node({ evidenceType: 'heuristic', metadata: { category: 'source' } }))).toBe(0x94a3b8);
    expect(repositoryUniverseNodeBaseColor(node({ evidenceType: 'missing', metadata: { category: 'source' } }))).toBe(0xf97316);
  });
});

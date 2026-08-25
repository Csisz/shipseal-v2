import { describe, expect, it } from 'vitest';
import {
  repositoryFutureSemanticDomain,
  repositoryFutureSemanticStyle,
  repositoryFuturesSemanticLabelDetail,
} from '@/components/agentready/result-workspace/futures/repositoryFuturesSemantics';
import { repositoryFuturesSemanticZoomLevel } from '@/components/agentready/result-workspace/futures/repositoryFuturesCamera';

const future = {
  kind: 'goal' as const,
  title: 'Adaptive analytics dashboard',
  candidate: {
    title: 'Adaptive analytics dashboard',
    capabilityId: 'capability:analytics',
    capabilityTitle: 'Progress analytics',
    candidateClass: 'product-opportunity' as const,
    opportunityOrigin: 'strategic' as const,
    origin: 'Validated bounded inference',
  },
};

describe('Omega 20.2 Repository Futures semantics', () => {
  it.each([
    ['Guided user experience and navigation', 'experience'],
    ['Repository agent assistant', 'ai-agent'],
    ['Automated release workflow', 'automation'],
    ['Privacy and trust controls', 'security'],
    ['Progress analytics dashboard', 'data'],
    ['Engagement and retention loop', 'growth'],
    ['Documentation knowledge index', 'knowledge'],
    ['Deployment operations handoff', 'delivery'],
    ['Shared team collaboration', 'collaboration'],
    ['Test verification quality gate', 'quality'],
    ['Modular platform architecture', 'architecture'],
  ] as const)('classifies %s as %s', (title, expected) => {
    expect(repositoryFutureSemanticDomain(title)).toBe(expected);
  });

  it('falls back to a safe general opportunity identity', () => {
    expect(repositoryFutureSemanticDomain('A possible next direction')).toBe('general');
    expect(repositoryFutureSemanticStyle({ kind: 'goal', title: 'A possible next direction' })).toMatchObject({
      domain: 'general',
      icon: 'general',
      shortLabel: 'General opportunity',
    });
  });

  it('keeps semantic identity independent from plan role and generation', () => {
    const baseline = repositoryFutureSemanticStyle(future);
    const primaryRole = { ...future, role: 'primary', depth: 1 };
    const supportingRole = { ...future, role: 'supporting', depth: 3 };
    expect(repositoryFutureSemanticStyle(primaryRole)).toEqual(baseline);
    expect(repositoryFutureSemanticStyle(supportingRole)).toEqual(baseline);
  });

  it('gives capabilities a domain identity and dependencies and artifacts distinct entity grammar', () => {
    expect(repositoryFutureSemanticStyle({ kind: 'capability', title: 'Shared analytics model' })).toMatchObject({ domain: 'data', entity: 'capability', icon: 'data' });
    expect(repositoryFutureSemanticStyle({ kind: 'dependency', title: 'Security review' })).toMatchObject({ domain: 'security', entity: 'dependency', icon: 'dependency' });
    expect(repositoryFutureSemanticStyle({ kind: 'artifact', title: 'Deployment package' })).toMatchObject({ domain: 'delivery', entity: 'artifact', icon: 'artifact' });
  });

  it('maps camera zoom to four deterministic semantic levels', () => {
    expect(repositoryFuturesSemanticZoomLevel(0.44)).toBe('strategy');
    expect(repositoryFuturesSemanticZoomLevel(0.8)).toBe('path');
    expect(repositoryFuturesSemanticZoomLevel(1)).toBe('detail');
    expect(repositoryFuturesSemanticZoomLevel(1.3)).toBe('implementation');
  });

  it('keeps strategy focused on G1 and progressively reveals G2 and G3', () => {
    const detail = (depth: 1 | 2 | 3, zoom: 'strategy' | 'path' | 'detail' | 'implementation', mode: 'quick' | 'deep' = 'quick') => (
      repositoryFuturesSemanticLabelDetail({ kind: 'evolution', depth, zoom, mode })
    );
    expect(repositoryFuturesSemanticLabelDetail({ kind: 'goal', depth: 1, zoom: 'strategy', mode: 'quick' })).toBe('title');
    expect(detail(2, 'strategy')).toBe('compact');
    expect(detail(3, 'strategy')).toBe('anchor');
    expect(detail(2, 'detail')).toBe('title');
    expect(detail(3, 'implementation')).toBe('title');
  });

  it('keeps Quick calmer than Deep while Deep still respects strategy LOD', () => {
    const input = { kind: 'evolution' as const, depth: 3 as const, zoom: 'strategy' as const };
    expect(repositoryFuturesSemanticLabelDetail({ ...input, mode: 'quick' })).toBe('anchor');
    expect(repositoryFuturesSemanticLabelDetail({ ...input, mode: 'deep' })).toBe('compact');
    expect(repositoryFuturesSemanticLabelDetail({ ...input, mode: 'deep' })).not.toBe('near');
  });

  it.each(['selected', 'hovered', 'searched', 'traced'] as const)('lets %s context override an ordinary G3 anchor', state => {
    expect(repositoryFuturesSemanticLabelDetail({
      kind: 'evolution',
      depth: 3,
      zoom: 'strategy',
      mode: 'quick',
      [state]: true,
    })).not.toBe('anchor');
  });
});

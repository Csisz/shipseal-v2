import { describe, expect, it } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import { selectRepositoryFrictions } from '@/components/agentready/result-dashboard/repositoryFrictions';

describe('post-scan repository frictions', () => {
  it('keeps deterministic source order, deduplicates exact facts and returns at most three items', () => {
    const health = structuredClone(buildSampleReport().repositoryHealth);
    health.blockers = [
      { id: 'b-1', title: 'Missing instructions', detail: 'No root agent instructions were found.', evidence: [] },
      { id: 'b-2', title: 'Unclear verification', detail: 'No test command was found.', evidence: [] },
    ];
    health.topActions = [
      { ...health.topActions[0], id: 'a-duplicate', title: 'Missing instructions', whyItMatters: 'No root agent instructions were found.' },
      { ...health.topActions[0], id: 'a-1', title: 'Add routing guidance', action: 'Document the repository entry points.' },
      { ...health.topActions[0], id: 'a-2', title: 'Add another action', action: 'This fourth unique item must be omitted.' },
    ];

    expect(selectRepositoryFrictions(health)).toEqual([
      expect.objectContaining({ id: 'blocker:b-1', source: 'blocker' }),
      expect.objectContaining({ id: 'blocker:b-2', source: 'blocker' }),
      expect.objectContaining({ id: 'top-action:a-1', source: 'top-action' }),
    ]);
  });

  it('uses an explicit insufficient-evidence state instead of inventing a friction', () => {
    const health = structuredClone(buildSampleReport().repositoryHealth);
    health.blockers = [];
    health.topActions = [];

    expect(selectRepositoryFrictions(health)).toEqual([
      expect.objectContaining({ id: 'insufficient-evidence', source: 'insufficient-evidence' }),
    ]);
  });
});

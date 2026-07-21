import { describe, expect, it } from 'vitest';
import { displayReadinessLevel } from '@/lib/uiCopy';
import { WORKSPACE_STATE_TERMS, workspaceStateLabel } from '@/lib/workspace';

describe('R0 terminology contract', () => {
  it('maps lifecycle states to distinct user-facing terms', () => {
    expect(workspaceStateLabel('current')).toBe('Current');
    expect(workspaceStateLabel('proposed')).toBe('Proposed');
    expect(workspaceStateLabel('applied')).toBe('Applied');
    expect(workspaceStateLabel('verified')).toBe('Verified');
    expect(WORKSPACE_STATE_TERMS['evidence-backed'].definition).toMatch(/concrete repository evidence/i);
    expect(WORKSPACE_STATE_TERMS.heuristic.definition).toMatch(/inference/i);
  });

  it('never represents Applied as Verified', () => {
    expect(WORKSPACE_STATE_TERMS.applied.label).not.toBe(WORKSPACE_STATE_TERMS.verified.label);
    expect(WORKSPACE_STATE_TERMS.applied.definition).toMatch(/not yet confirmed/i);
  });

  it('preserves the legacy score value while removing certification language from display copy', () => {
    expect(displayReadinessLevel('AgentReady Certified')).toBe('AI Coding Ready');
    expect(displayReadinessLevel('AgentReady Certified')).not.toMatch(/certif/i);
  });
});

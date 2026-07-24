import { describe, expect, it } from 'vitest';
import { createDefaultProjectIntake } from '@/lib/intake';
import {
  sameProjectIntake,
  selectActiveWorkspaceStoryChapter,
  selectLimitedScanReason,
} from '@/components/agentready/result-workspace/model/resultWorkspaceSelectors';
import {
  displayMcpReadiness,
  isGitHubSource,
  severityClass,
} from '@/components/agentready/result-workspace/model/deliveryWorkspaceSelectors';

describe('Result Workspace selectors', () => {
  it('selects a requested story chapter and falls back to the initial chapter', () => {
    const story = {
      initialChapterId: 'architecture',
      chapters: [
        { id: 'architecture', label: 'Architecture' },
        { id: 'tests', label: 'Tests' },
      ],
    } as never;

    expect(selectActiveWorkspaceStoryChapter(story, 'tests' as never)?.id).toBe('tests');
    expect(selectActiveWorkspaceStoryChapter(story, 'missing' as never)?.id).toBe('architecture');
  });

  it('keeps scan limitation selection deterministic', () => {
    const report = {
      scanEvidence: { limitationReason: '' },
      scanSummary: { warnings: ['General note', 'GitHub access used a limited fallback'] },
    } as never;

    expect(selectLimitedScanReason(report)).toBe('GitHub access used a limited fallback');
  });

  it('compares normalized intake values without React state', () => {
    const intake = createDefaultProjectIntake('shipseal');
    expect(sameProjectIntake(intake, { ...intake })).toBe(true);
    expect(sameProjectIntake(intake, { ...intake, projectName: 'another-project' })).toBe(false);
  });

  it('derives delivery labels without importing React', () => {
    expect(displayMcpReadiness('Enterprise MCP Ready')).toBe('MCP Governance Ready');
    expect(isGitHubSource('github-app')).toBe(true);
    expect(severityClass('High')).toContain('warning');
  });
});

import { describe, expect, it } from 'vitest';
import { buildReadinessPrPlan } from '@/lib/readinessPr';

describe('Readiness PR plan', () => {
  it('defines the preview PR metadata, files, and manual Git workflow without GitHub API calls', () => {
    const plan = buildReadinessPrPlan();
    const paths = plan.files.map(file => file.path);
    const serialized = JSON.stringify(plan);

    expect(plan.branchName).toBe('shipseal/readiness-pack');
    expect(plan.title).toBe('Add ShipSeal readiness pack');
    expect(plan.summary).toContain('ShipSeal-generated readiness files');
    expect(plan.safetyNote).toContain('Uploaded or imported repository code was not executed');
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('CLAUDE.md');
    expect(paths).not.toContain('.github/workflows/ci.yml');
    expect(paths).toContain('docs/shipseal/CI_QUALITY_GATE.example.yml');
    expect(plan.manualGitSteps).toContain('git checkout -b shipseal/readiness-pack');
    expect(plan.manualGitSteps).toContain('shipseal-readiness-fix-pack-[repo].zip');
    expect(plan.manualGitSteps).toContain('git commit -m "Add ShipSeal readiness fix pack"');
    expect(plan.categories).toContain('AI agent instruction readiness');
    expect(plan.categories).toContain('Client handoff quality');
    expect(serialized).not.toContain('api.github.com');
    expect(serialized).not.toContain('fetch(');
  });

  it('focuses planned PR files on the selected package', () => {
    const security = buildReadinessPrPlan(['safety-risk']);
    const testing = buildReadinessPrPlan(['testing-red-team']);

    expect(security.summary).toContain('Security and data pre-screen');
    expect(security.files.map(file => file.path)).toEqual([
      'SECURITY.md',
      'docs/CRITICAL_FILES_POLICY.md',
      'docs/OWNERSHIP.md',
    ]);
    expect(testing.files.map(file => file.path)).toEqual([
      'CONTRIBUTING.md',
      'docs/RELEASE_CHECKLIST.md',
      'docs/shipseal/CI_QUALITY_GATE.example.yml',
    ]);
  });
});

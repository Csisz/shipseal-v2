import { describe, expect, it } from 'vitest';
import { buildReadinessPrPlan } from '@/lib/readinessPr';

describe('Readiness PR plan', () => {
  it('defines the preview PR metadata, files, and manual Git workflow without GitHub API calls', () => {
    const plan = buildReadinessPrPlan();
    const paths = plan.files.map(file => file.path);
    const serialized = JSON.stringify(plan);

    expect(plan.branchName).toBe('shipseal/readiness-pack');
    expect(plan.title).toBeTruthy();
    expect(plan.summary).toContain('ShipSeal-generated agent instructions');
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('.github/workflows/ci.yml');
    expect(plan.manualGitSteps).toContain('git checkout -b shipseal/readiness-pack');
    expect(plan.manualGitSteps).toContain('shipseal-readiness-fix-pack-[repo].zip');
    expect(plan.manualGitSteps).toContain('git commit -m "Add ShipSeal readiness fix pack"');
    expect(plan.categories).toContain('AI agent instruction readiness');
    expect(plan.categories).toContain('Client handoff quality');
    expect(serialized).not.toContain('api.github.com');
    expect(serialized).not.toContain('fetch(');
  });
});

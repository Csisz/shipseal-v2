import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildReport } from '@/lib/readiness';
import { buildAgentPackZipBlob, buildRepoContextPackJson, buildScoreJson } from '@/lib/exports';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack';
import type { RepoScanInput } from '@/lib/types';

async function zipPathsFor(input: RepoScanInput, selectedPackages: string[]) {
  const report = buildReport(input);
  const scoreJson = buildScoreJson(report, { selectedPackages });
  const blob = await buildAgentPackZipBlob(
    report.agentPack,
    report.mcpReadiness.generatedFiles,
    { markdown: report.contextPack, json: buildRepoContextPackJson(report) },
    { repositoryName: report.repoName, scoreJson, selectedPackages }
  );
  const zip = await JSZip.loadAsync(blob);
  return {
    report,
    scoreJson,
    paths: Object.values(zip.files).filter(file => !file.dir).map(file => file.name),
    zip,
  };
}

describe('Skill and MCP recommendations', () => {
  it('generates skill and MCP recommendations from existing scan signals', async () => {
    const input: RepoScanInput = {
      repoName: 'recommendation-signals',
      source: {
        sourceType: 'github-public',
        githubOwner: 'example',
        githubRepo: 'recommendation-signals',
        githubBranch: 'main',
      },
      files: [
        { path: 'README.md', size: 900 },
        { path: 'package.json', size: 1100 },
        { path: 'tsconfig.json', size: 300 },
        { path: 'vite.config.ts', size: 200 },
        { path: 'vercel.json', size: 120 },
        { path: '.env.example', size: 120 },
        { path: '.gitignore', size: 80 },
        { path: '.github/workflows/ci.yml', size: 300 },
        { path: 'docs/architecture.md', size: 700 },
        { path: 'src/App.tsx', size: 800 },
        { path: 'src/components/ReportCard.tsx', size: 600 },
        { path: 'src/lib/exportReport.ts', size: 700 },
        { path: 'src/lib/report/pdfExport.ts', size: 700 },
        { path: 'src/App.test.tsx', size: 400 },
        { path: 'tests/home.spec.ts', size: 400 },
        { path: 'playwright.config.ts', size: 240 },
        { path: 'prisma/schema.prisma', size: 500 },
        { path: 'supabase/migrations/001_create_reports.sql', size: 500 },
      ],
      textContents: {
        'README.md': '# Recommendation Signals\n\nOverview. Install, setup, test and deploy on Vercel. Uses reports, exports, Prisma, Postgres, and Playwright.',
        'package.json': JSON.stringify({
          scripts: {
            build: 'vite build',
            test: 'vitest',
            e2e: 'playwright test',
            lint: 'eslint .',
          },
          dependencies: {
            '@prisma/client': 'latest',
            react: 'latest',
            vite: 'latest',
          },
          devDependencies: {
            '@playwright/test': 'latest',
            typescript: 'latest',
            vitest: 'latest',
          },
        }),
        '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\ncoverage\n',
      },
    };

    const { scoreJson, zip } = await zipPathsFor(input, ['agent-readiness']);
    const skillNames = scoreJson.toolingRecommendations?.skills.map(rec => rec.name) || [];
    const mcpToolNames = scoreJson.toolingRecommendations?.mcpTools.map(rec => rec.toolName) || [];
    const skillRecommendations = await zip.file('07-context/SKILL_RECOMMENDATIONS.md')?.async('string');
    const mcpRecommendations = await zip.file('07-context/MCP_RECOMMENDATIONS.md')?.async('string');

    expect(skillNames).toEqual(expect.arrayContaining([
      'react-ui',
      'component-review',
      'accessibility-review',
      'test-generation',
      'test-maintenance',
      'report-review',
      'export-validation',
      'github-review',
      'documentation-maintenance',
    ]));
    expect(mcpToolNames).toEqual(expect.arrayContaining([
      'github MCP',
      'postgres MCP',
      'playwright MCP',
      'vercel MCP',
      'documentation MCP',
    ]));
    expect(skillRecommendations).toContain('Skill name: react-ui');
    expect(skillRecommendations).toContain('Confidence: High');
    expect(mcpRecommendations).toContain('Tool name: playwright MCP');
    expect(mcpRecommendations).toContain('ShipSeal does not install MCP servers');
  });

  it('omits recommendations when supporting signals are not present', () => {
    const report = buildReport({
      repoName: 'tiny-node-tool',
      files: [
        { path: 'package.json', size: 300 },
        { path: 'src/index.js', size: 200 },
      ],
      textContents: {
        'package.json': JSON.stringify({
          scripts: {
            build: 'node src/index.js',
          },
        }),
      },
    });
    const scoreJson = buildScoreJson(report, { selectedPackages: ['agent-readiness'] });
    const skillNames = scoreJson.toolingRecommendations?.skills.map(rec => rec.name) || [];
    const mcpToolNames = scoreJson.toolingRecommendations?.mcpTools.map(rec => rec.toolName) || [];

    expect(skillNames).not.toContain('react-ui');
    expect(skillNames).not.toContain('test-generation');
    expect(skillNames).not.toContain('github-review');
    expect(mcpToolNames).not.toContain('github MCP');
    expect(mcpToolNames).not.toContain('playwright MCP');
    expect(mcpToolNames).not.toContain('postgres MCP');
    expect(mcpToolNames).not.toContain('filesystem MCP');
  });

  it('includes recommendation files for AI Agent Development and Full ShipSeal only', async () => {
    const input: RepoScanInput = {
      repoName: 'focused-packages',
      files: [
        { path: 'README.md', size: 500 },
        { path: 'package.json', size: 500 },
        { path: 'tsconfig.json', size: 100 },
        { path: 'vite.config.ts', size: 100 },
        { path: 'src/App.tsx', size: 300 },
        { path: 'src/App.test.tsx', size: 300 },
      ],
      textContents: {
        'README.md': '# Focused Packages\n\nOverview, install, setup, and run.',
        'package.json': JSON.stringify({
          scripts: { build: 'vite build', test: 'vitest' },
          dependencies: { react: 'latest', vite: 'latest' },
          devDependencies: { vitest: 'latest', typescript: 'latest' },
        }),
      },
    };
    const agent = await zipPathsFor(input, ['agent-readiness']);
    const full = await zipPathsFor(input, ['full-package']);
    const client = await zipPathsFor(input, ['client-handoff']);
    const testing = await zipPathsFor(input, ['testing-red-team']);

    expect(resolveDeliveryPackFocus(['agent-readiness']).generatedPaths).toContain('07-context/SKILL_RECOMMENDATIONS.md');
    expect(agent.paths).toContain('07-context/SKILL_RECOMMENDATIONS.md');
    expect(agent.paths).toContain('07-context/MCP_RECOMMENDATIONS.md');
    expect(full.paths).toContain('07-context/SKILL_RECOMMENDATIONS.md');
    expect(full.paths).toContain('07-context/MCP_RECOMMENDATIONS.md');
    expect(client.paths).not.toContain('07-context/SKILL_RECOMMENDATIONS.md');
    expect(client.paths).not.toContain('07-context/MCP_RECOMMENDATIONS.md');
    expect(testing.paths).not.toContain('07-context/SKILL_RECOMMENDATIONS.md');
    expect(testing.paths).not.toContain('07-context/MCP_RECOMMENDATIONS.md');
    expect(agent.scoreJson.outputCount).toBe(agent.scoreJson.generatedFiles.length);
    expect(full.scoreJson.outputCount).toBe(full.scoreJson.generatedFiles.length);
  });
});

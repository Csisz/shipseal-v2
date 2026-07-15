import { describe, expect, it } from 'vitest';
import { buildReport } from '@/lib/readiness';
import {
  buildRepositoryAgentFlightPath,
  buildRepositoryAtlasModel,
  buildRepositoryUniverseModel,
} from '@/lib/workspace';
import type { ReadinessReport } from '@/lib/types';

function flightPathReport() {
  const report = buildReport({
    repoName: 'flight-path-fixture',
    files: [
      { path: 'README.md', size: 300 },
      { path: 'AGENTS.md', size: 220 },
      { path: 'docs/ARCHITECTURE.md', size: 420 },
      { path: 'src/components/PricingPanel.tsx', size: 560 },
      { path: 'src/styles/theme.css', size: 260 },
      { path: 'src/lib/reportExport.ts', size: 440 },
      { path: 'src/lib/pdfExport.ts', size: 440 },
      { path: 'src/hooks/useScanFlow.ts', size: 390 },
      { path: 'src/api/auth.ts', size: 340 },
      { path: 'src/api/billing.ts', size: 340 },
      { path: 'src/__tests__/scanFlow.test.ts', size: 290 },
      { path: '.github/workflows/ci.yml', size: 180 },
      { path: 'package.json', size: 240 },
      { path: 'node_modules/vendor/index.js', size: 900, ignored: true, ignoredReason: 'generated-vendor' },
      { path: 'dist/app.js', size: 900, ignored: true, ignoredReason: 'generated-vendor' },
    ],
    textContents: {
      'README.md': '# Flight Path Fixture\n\nUse ShipSeal to understand the repository before editing.',
      'AGENTS.md': '# Agent instructions\n\nRun detected checks and avoid generated folders.',
      'docs/ARCHITECTURE.md': '# Architecture\n\nUI components call library export helpers.',
      'package.json': JSON.stringify({
        scripts: {
          test: 'vitest run',
          build: 'vite build',
          lint: 'eslint .',
        },
        dependencies: { react: '^18.3.1' },
        devDependencies: { vitest: '^2.0.0', vite: '^5.0.0' },
      }),
    },
  });
  report.scanSummary.ignoredGeneratedFolders = ['node_modules', 'dist'];
  report.repoContextPack.ignoredFolders = ['node_modules', 'dist'];
  return report;
}

function route(task: string, report: ReadinessReport = flightPathReport()) {
  const universe = buildRepositoryUniverseModel(report);
  const atlas = buildRepositoryAtlasModel(report);
  return {
    report,
    universe,
    atlas,
    path: buildRepositoryAgentFlightPath({ task, report, universe, atlas }),
  };
}

describe('buildRepositoryAgentFlightPath', () => {
  it('requires a scanned repository', () => {
    const path = buildRepositoryAgentFlightPath({ task: 'Fix mobile layout', report: null });
    expect(path.status).toBe('unavailable');
    expect(path.summary).toMatch(/Scan a repository first/i);
    expect(path.routeSteps).toEqual([]);
  });

  it('keeps deterministic route IDs and ordering', () => {
    const first = route('Fix mobile pricing layout').path;
    const second = route('Fix mobile pricing layout').path;
    expect(second.id).toBe(first.id);
    expect(second.routeSteps.map(step => step.id)).toEqual(first.routeSteps.map(step => step.id));
    expect(first.routeSteps.map(step => step.order)).toEqual(first.routeSteps.map((_, index) => index + 1));
    expect(first.routeSteps.length).toBeGreaterThan(3);
  });

  it('routes UI tasks toward detected source, component and style paths', () => {
    const path = route('Fix mobile pricing layout').path;
    expect(path.confidence).toMatch(/medium|high/);
    expect(path.contextFiles.map(file => file.path)).toContain('src/components/PricingPanel.tsx');
    expect(path.contextFiles.map(file => file.path)).toContain('src/styles/theme.css');
  });

  it('routes docs and report tasks toward detected docs, report and export paths', () => {
    const path = route('Improve PDF report export').path;
    const paths = path.contextFiles.map(file => file.path);
    expect(paths).toContain('src/lib/pdfExport.ts');
    expect(paths).toContain('src/lib/reportExport.ts');
    expect(paths).toContain('docs/ARCHITECTURE.md');
  });

  it('routes testing tasks toward tests and detected test commands', () => {
    const path = route('Add tests for the scan flow').path;
    expect(path.contextFiles.map(file => file.path)).toContain('src/__tests__/scanFlow.test.ts');
    expect(path.commands.map(command => command.cmd)).toContain('npm run test');
  });

  it('adds human review gates for auth, payment and security tasks', () => {
    const path = route('Add Stripe billing with auth token handling').path;
    expect(path.reviewGates.map(gate => gate.id)).toEqual(expect.arrayContaining(['payment', 'auth', 'security']));
  });

  it('avoids generated and vendor folders when detected', () => {
    const path = route('Fix mobile pricing layout').path;
    expect(path.avoidances.map(item => item.path)).toEqual(expect.arrayContaining(['node_modules', 'dist']));
  });

  it('recommends only commands detected by the scan', () => {
    const path = route('Improve PDF export').path;
    expect(path.commands.map(command => command.cmd)).toEqual(expect.arrayContaining(['npm run test', 'npm run build', 'npm run lint']));
    expect(path.commands.map(command => command.cmd)).not.toContain('bun test');
  });

  it('returns low confidence and clarification guidance for vague tasks', () => {
    const path = route('make it better').path;
    expect(path.status).toBe('needs-clarification');
    expect(path.confidence).toBe('low');
    expect(path.clarificationSuggestions).toHaveLength(3);
  });

  it('maps route nodes only to existing graph entities', () => {
    const { universe, atlas, path } = route('Improve PDF export');
    const universeIds = new Set(universe.nodes.map(node => node.id));
    const atlasIds = new Set(atlas.nodes.map(node => node.id));
    expect(path.routeNodeIds.universeNodeIds.every(id => universeIds.has(id))).toBe(true);
    expect(path.routeNodeIds.atlasNodeIds.every(id => atlasIds.has(id))).toBe(true);
  });

  it('creates a concise prompt with task, route, commands and gates', () => {
    const path = route('Add Stripe billing').path;
    expect(path.prompt).toContain('Task: Add Stripe billing');
    expect(path.prompt).toContain('Start with:');
    expect(path.prompt).toContain('Detected commands:');
    expect(path.prompt).toContain('Payment and billing review');
    expect(path.prompt.length).toBeLessThan(4000);
  });

  it('does not fabricate paths into the route', () => {
    const { report, universe, atlas, path } = route('Add Stripe billing');
    const knownPaths = new Set([
      ...(report.analyzedFiles || []).filter(file => !file.ignored).map(file => file.path),
      ...(report.sampleFiles || []).filter(file => !file.ignored).map(file => file.path),
      ...(report.summary.keyFolders || []),
      ...(report.summary.instructionFiles || []),
      ...universe.nodes.map(node => node.path).filter(Boolean),
      ...atlas.nodes.map(node => node.path).filter(Boolean),
    ]);
    expect(path.contextFiles.every(file => knownPaths.has(file.path))).toBe(true);
    expect(path.contextFiles.map(file => file.path)).not.toContain('src/stripe.ts');
  });

  it('does not mutate Universe or Atlas graph data', () => {
    const report = flightPathReport();
    const universe = buildRepositoryUniverseModel(report);
    const atlas = buildRepositoryAtlasModel(report);
    const beforeUniverse = JSON.stringify(universe);
    const beforeAtlas = JSON.stringify(atlas);
    buildRepositoryAgentFlightPath({ task: 'Improve PDF export', report, universe, atlas });
    expect(JSON.stringify(universe)).toBe(beforeUniverse);
    expect(JSON.stringify(atlas)).toBe(beforeAtlas);
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  buildRepositoryIntelligenceEvidence,
  prepareRepositoryIntelligenceContext,
  resolveRepositoryContextSelectionPolicy,
  selectRepositoryIntelligenceContext,
  type RepositoryIntelligenceEvidenceModel,
} from '@/lib/repositoryIntelligence';
import type { RepoFileSummary, RepoScanInput } from '@/lib/types';

function contextFixture(extra: Record<string, string> = {}): RepoScanInput {
  const textContents: Record<string, string> = {
    'package.json': JSON.stringify({
      scripts: { build: 'vite build', test: 'vitest', lint: 'eslint .' },
      dependencies: { react: '^18', vite: '^5', next: '^15', express: '^5', zod: '^3' },
    }, null, 2),
    'package-lock.json': '{"lockfileVersion":3,"packages":{"node_modules/example":{"integrity":"sha512-not-context"}}}',
    'README.md': '# Context fixture\n\nRepository overview.',
    'AGENTS.md': '# Agent rules\n\nKeep changes deterministic.',
    'docs/ARCHITECTURE.md': '# Architecture\n\nEvidence-backed boundaries.',
    'vite.config.ts': "import { defineConfig } from 'vite'; export default defineConfig({});",
    'vitest.config.ts': "import { defineConfig } from 'vitest/config'; export default defineConfig({});",
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
    '.github/workflows/ci.yml': 'name: CI\njobs:\n  test:\n    steps:\n      - run: npm test',
    'src/main.tsx': "import App from './App'; export const bootstrap = () => <App />;",
    'src/App.tsx': "import { helper } from './utils/helper'; export function App() { return <main>{helper()}</main>; } export default App;",
    'src/utils/helper.ts': "export const helper = () => 'ok';",
    'src/services/userService.ts': 'export function loadUser() { return true; }',
    'src/repositories/userRepository.ts': 'export function findUser() { return null; }',
    'src/validation/userSchema.ts': "import { z } from 'zod'; export const UserSchema = z.object({ id: z.string() });",
    'src/index.ts': "export { App } from './App';",
    'src/App.test.tsx': "import App from './App'; export const subject = App;",
    'app/layout.tsx': 'export default function Layout({ children }) { return <html><body>{children}</body></html>; }',
    'app/dashboard/page.tsx': 'export default function Page() { return <div>Dashboard</div>; }',
    'app/api/health/route.ts': 'export function GET() { return Response.json({ ok: true }); }',
    'src/unknown.ts': 'const lowValue = true;',
    'src/broken.ts': 'export function broken( {',
    '.env': 'API_KEY=never-include-this-secret',
    '.env.example': 'PUBLIC_URL=https://example.invalid\nAPI_TOKEN=placeholder-secret',
    'keys/server.pem': '-----BEGIN PRIVATE KEY-----\nprivate-key-value\n-----END PRIVATE KEY-----',
    ...extra,
  };
  const generated = ['dist/assets/app.js', 'node_modules/pkg/index.js'];
  const binary = ['public/logo.png'];
  const files: RepoFileSummary[] = [...Object.keys(textContents), ...generated, ...binary].map(path => ({
    path,
    size: textContents[path]?.length || 20,
    ignored: generated.includes(path) || binary.includes(path),
    ignoredReason: generated.includes(path) ? 'generated-vendor' : binary.includes(path) ? 'binary' : undefined,
  }));
  return {
    repoName: 'context-fixture',
    source: { sourceType: 'github-url', githubOwner: 'example', githubRepo: 'context-fixture', githubBranch: 'main' },
    files,
    textContents,
  };
}

function evidenceFor(input: RepoScanInput) {
  return buildRepositoryIntelligenceEvidence(input);
}

function reversedEvidence(evidence: RepositoryIntelligenceEvidenceModel): RepositoryIntelligenceEvidenceModel {
  return {
    ...evidence,
    evidence: [...evidence.evidence].reverse(),
    files: [...evidence.files].reverse(),
    folders: [...evidence.folders].reverse(),
    relationships: [...evidence.relationships].reverse(),
  };
}

describe('Repository Intelligence context determinism', () => {
  it('keeps order, selection IDs and bundle fingerprint stable across reordered scan and evidence input', () => {
    const input = contextFixture();
    const evidence = evidenceFor(input);
    const reversedInput = {
      ...input,
      files: [...input.files].reverse(),
      textContents: Object.fromEntries(Object.entries(input.textContents).reverse()),
    };
    const policy = { maximumSelectedFiles: 14, maximumSupportingFiles: 2 };
    const first = prepareRepositoryIntelligenceContext({ scanInput: input, evidenceResult: evidence, policy });
    const second = prepareRepositoryIntelligenceContext({ scanInput: reversedInput, evidenceResult: reversedEvidence(evidence), policy });

    expect(first.items.map(item => item.path)).toEqual(second.items.map(item => item.path));
    expect(first.items.map(item => item.selectionId)).toEqual(second.items.map(item => item.selectionId));
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.items.map(item => item.path)).toEqual([...first.items].sort((a, b) => a.selectionOrder - b.selectionOrder).map(item => item.path));
  });

  it('uses normalized path tie-breaking for equal candidates', () => {
    const input = contextFixture({
      'src/components/Alpha.tsx': 'export function Alpha() { return <div />; }',
      'src/components/Beta.tsx': 'export function Beta() { return <div />; }',
    });
    const selection = selectRepositoryIntelligenceContext({ scanInput: input, evidenceResult: evidenceFor(input) });
    const alpha = selection.candidates.find(item => item.path === 'src/components/Alpha.tsx')!;
    const beta = selection.candidates.find(item => item.path === 'src/components/Beta.tsx')!;
    expect(alpha.priorityScore).toBe(beta.priorityScore);
    expect(alpha.selectionOrder).toBeLessThan(beta.selectionOrder!);
  });
});

describe('candidate ranking and coverage', () => {
  it('selects entry, routes, manifests, instructions, verification, services/data access and representative UI evidence', () => {
    const input = contextFixture();
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: { maximumSelectedFiles: 18, maximumSupportingFiles: 3 },
    });
    const paths = new Set(bundle.items.map(item => item.path));
    expect(paths.has('package.json')).toBe(true);
    expect(paths.has('AGENTS.md')).toBe(true);
    expect(paths.has('src/main.tsx')).toBe(true);
    expect(paths.has('app/layout.tsx')).toBe(true);
    expect(paths.has('app/dashboard/page.tsx')).toBe(true);
    expect(paths.has('app/api/health/route.ts')).toBe(true);
    expect(paths.has('vite.config.ts') || paths.has('vitest.config.ts') || paths.has('.github/workflows/ci.yml')).toBe(true);
    expect(paths.has('vitest.config.ts') || paths.has('src/App.test.tsx')).toBe(true);
    expect(paths.has('src/services/userService.ts')).toBe(true);
    expect(paths.has('src/repositories/userRepository.ts')).toBe(true);
    expect(paths.has('src/App.tsx')).toBe(true);
    expect(bundle.items.find(item => item.path === 'src/main.tsx')?.selectionReasons).toContain('application-entry-point');
    expect(bundle.items.find(item => item.path === 'src/App.tsx')?.selectionReasons).toContain('representative-ui-component');
    expect(bundle.dispositions.find(item => item.path === 'src/unknown.ts')?.state).toBe('deprioritized');
  });

  it('prevents one component folder from consuming every slot and represents multiple responsibilities', () => {
    const components = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
      `src/components/Component${String(index).padStart(2, '0')}.tsx`,
      `export function Component${index}() { return <div>${index}</div>; }`,
    ]));
    const input = contextFixture(components);
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: { maximumSelectedFiles: 10, maximumSupportingFiles: 1, maximumRepresentativesPerFolder: 2 },
    });
    const componentCount = bundle.items.filter(item => item.path.startsWith('src/components/')).length;
    expect(componentCount).toBeLessThan(bundle.items.length);
    expect(new Set(bundle.items.map(item => item.primaryResponsibility)).size).toBeGreaterThan(3);
    expect(bundle.items.some(item => ['manifest', 'configuration', 'ci'].includes(item.sourceCategory))).toBe(true);
    expect(bundle.items.some(item => ['documentation', 'agent-instruction'].includes(item.sourceCategory))).toBe(true);
  });

  it('reports budget-limited uncovered areas without fabricating unavailable categories', () => {
    const input = contextFixture();
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: {
        maximumSelectedFiles: 3,
        maximumSupportingFiles: 0,
        maximumTotalCharacters: 400,
        maximumCharactersPerFile: 200,
        reservedCriticalConfigurationCharacters: 100,
        reservedDocumentationInstructionCharacters: 100,
      },
    });
    expect(bundle.totalSelectedFiles).toBeLessThanOrEqual(3);
    expect(bundle.uncoveredAreas.some(area => area.reason === 'budget')).toBe(true);
    expect(bundle.responsibilityCoverage.every(item => item.eligibleFileCount > 0 || item.state === 'unavailable')).toBe(true);
    expect(bundle.categoryCounts.some(item => item.category === 'manifest' && item.selectedCount > 0)).toBe(true);
    expect(bundle.categoryCounts.some(item => ['documentation', 'agent-instruction'].includes(item.category) && item.selectedCount > 0)).toBe(true);
  });
});

describe('relationship-aware supporting selection', () => {
  it('selects bounded imported support and handles barrels without recursive expansion', () => {
    const input = contextFixture({
      'src/main.tsx': "import { App } from './index'; export const bootstrap = () => <App />;",
      'src/index.ts': "export { App } from './App';",
      'src/App.tsx': "import { helper } from './utils/helper'; export function App() { return <main>{helper()}</main>; }",
    });
    const evidence = evidenceFor(input);
    expect(evidence.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePath: 'src/main.tsx', targetPath: 'src/index.ts', type: 'imports' }),
    ]));
    const selection = selectRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidence,
      policy: { maximumSelectedFiles: 8, maximumSupportingFiles: 2, maximumRelationshipExpansionDepth: 1 },
    });
    const support = selection.selectedCandidates.filter(item => item.selectionReasons.includes('supporting-dependency'));
    const barrel = selection.selectedCandidates.find(item => item.path === 'src/index.ts');
    expect(support.length).toBeGreaterThan(0);
    expect(support.length).toBeLessThanOrEqual(2);
    expect(support.every(item => (item.relationshipDepth || 0) <= 1)).toBe(true);
    expect(barrel?.selectionReasons).toContain('supporting-dependency');
    expect(barrel?.relationshipDepth).toBe(1);
  });

  it('terminates cycles, ignores missing targets and enforces zero expansion depth', () => {
    const input = contextFixture({
      'src/utils/a.ts': "import { b } from './b'; export const a = b;",
      'src/utils/b.ts': "import { a } from './a'; export const b = a;",
      'src/main.tsx': "import { a } from './utils/a'; import missing from './missing'; export const bootstrap = a;",
    });
    const evidence = evidenceFor(input);
    const selection = selectRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidence,
      policy: { maximumSelectedFiles: 7, maximumSupportingFiles: 3, maximumRelationshipExpansionDepth: 0 },
    });
    expect(selection.selectedCandidates.every(item => !item.selectionReasons.includes('supporting-dependency'))).toBe(true);
    expect(selection.candidates.some(item => item.path.includes('missing'))).toBe(false);
    expect(new Set(selection.selectedCandidates.map(item => item.path)).size).toBe(selection.selectedCandidates.length);
  });
});

describe('context budgeting and content preparation', () => {
  it('enforces file, total and per-file limits while retaining deterministic outlines on truncation', () => {
    const largeComponent = `import { helper } from './utils/helper';\nexport function LargePanel() {\n${Array.from({ length: 100 }, (_, index) => `  const value${index} = ${index};`).join('\n')}\n  return <div>{helper()}</div>;\n}\nexport default LargePanel;`;
    const input = contextFixture({ 'src/LargePanel.tsx': largeComponent });
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: {
        maximumSelectedFiles: 6,
        maximumSupportingFiles: 0,
        maximumTotalCharacters: 900,
        maximumCharactersPerFile: 220,
        reservedCriticalConfigurationCharacters: 150,
        reservedDocumentationInstructionCharacters: 150,
        explicitPriorityPaths: ['src/LargePanel.tsx'],
      },
    });
    const large = bundle.items.find(item => item.path === 'src/LargePanel.tsx')!;
    expect(bundle.items.length).toBeLessThanOrEqual(6);
    expect(bundle.totalCharactersIncluded).toBeLessThanOrEqual(900);
    expect(bundle.items.every(item => item.includedCharacters <= 220)).toBe(true);
    expect(large.truncation.truncated).toBe(true);
    expect(large.structuralOutline?.declaredSymbols).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'LargePanel' })]));
    expect(large.content).toContain('ShipSeal omitted bounded content');
  });

  it('rejects unsafe policy values and handles zero budget without crashing', () => {
    expect(() => resolveRepositoryContextSelectionPolicy({ maximumSelectedFiles: -1 })).toThrow(/Invalid context selection policy/);
    expect(() => resolveRepositoryContextSelectionPolicy({ maximumRelationshipExpansionDepth: 4 })).toThrow(/cannot exceed 3/);
    const input = contextFixture();
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: {
        maximumSelectedFiles: 0,
        maximumSupportingFiles: 0,
        maximumTotalCharacters: 0,
        reservedCriticalConfigurationCharacters: 0,
        reservedDocumentationInstructionCharacters: 0,
      },
    });
    expect(bundle.items).toEqual([]);
    expect(bundle.totalCharactersIncluded).toBe(0);
    expect(bundle.fingerprint).toMatch(/^[a-z0-9]+$/);
  });
});

describe('content safety and structural outlines', () => {
  it('excludes env/private-key/binary/generated content and sanitizes environment templates', () => {
    const input = contextFixture();
    input.textContents['package.json'] = JSON.stringify({
      scripts: { build: 'vite build', deploy: 'API_KEY=package-secret deploy' },
      dependencies: { react: '^18', vite: '^5', next: '^15', express: '^5' },
    }, null, 2);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: { explicitPriorityPaths: ['.env.example'], maximumSelectedFiles: 20, maximumSupportingFiles: 2 },
    });
    const serialized = JSON.stringify(bundle);
    const envExample = bundle.items.find(item => item.path === '.env.example')!;
    const envEvidence = evidenceFor(input).files.find(item => item.path === '.env.example');
    expect(bundle.items.some(item => item.path === '.env')).toBe(false);
    expect(bundle.items.some(item => item.path === 'keys/server.pem')).toBe(false);
    expect(bundle.items.some(item => item.path.startsWith('dist/') || item.path.startsWith('node_modules/'))).toBe(false);
    expect(bundle.items.some(item => item.path.endsWith('.png'))).toBe(false);
    expect(bundle.items.some(item => item.path === 'package-lock.json')).toBe(false);
    expect(bundle.dispositions.find(item => item.path === 'package-lock.json')?.contentAvailability).toBe('metadata-only');
    expect(serialized).not.toContain('never-include-this-secret');
    expect(serialized).not.toContain('private-key-value');
    expect(serialized).not.toContain('placeholder-secret');
    expect(serialized).not.toContain('package-secret');
    expect(envExample.content).toContain('API_TOKEN=<placeholder>');
    expect(envExample.primaryResponsibility).toBe('configuration');
    expect(envEvidence?.primaryResponsibility).toBe('configuration');
    expect(envExample.sensitiveContent.redactionKinds).toContain('environment-value');
    expect(serialized).not.toContain('D:\\');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('represents symbols and relationships without inventing malformed outlines', () => {
    const input = contextFixture();
    const bundle = prepareRepositoryIntelligenceContext({
      scanInput: input,
      evidenceResult: evidenceFor(input),
      policy: { maximumSelectedFiles: 20, maximumSupportingFiles: 2, explicitPriorityPaths: ['src/broken.ts'] },
    });
    const app = bundle.items.find(item => item.path === 'src/App.tsx')!;
    const broken = bundle.items.find(item => item.path === 'src/broken.ts')!;
    expect(app.structuralOutline?.namedExports).toContain('App');
    expect(app.structuralOutline?.defaultExportPresent).toBe(true);
    expect(app.structuralOutline?.localImports).toContain('src/utils/helper.ts');
    expect(broken.state).toBe('parse-limited');
    expect(broken.structuralOutline?.declaredSymbols).toEqual([]);
    expect(broken.structuralOutline?.limitations.join(' ')).toMatch(/parser/i);
  });
});

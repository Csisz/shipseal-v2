import { describe, expect, it } from 'vitest';
import { scanZipFile } from '@/lib/scanner';
import { normalizeZipPath } from '@/lib/scannerLimits';
import {
  buildRepositoryIntelligenceEvidence,
  createRepositoryEvidence,
  normalizeEvidencePath,
  type RepositoryEvidenceDraft,
} from '@/lib/repositoryIntelligence';
import type { RepoFileSummary, RepoScanInput } from '@/lib/types';

function fixtureInput(overrides: Partial<RepoScanInput> = {}): RepoScanInput {
  const textContents: Record<string, string> = {
    'package.json': JSON.stringify({
      scripts: { build: 'vite build', test: 'vitest' },
      dependencies: { react: '^18', vite: '^5', next: '^15', express: '^5', zod: '^3' },
    }),
    'src/main.tsx': "import { createRoot } from 'react-dom/client'; import App from './App'; createRoot(document.body).render(<App />);",
    'src/App.tsx': "import { helper } from './utils/helper'; export function App() { return <main>{helper()}</main>; } export default App;",
    'src/hooks/useWorkspace.ts': 'export function useWorkspace() { return { ready: true }; }',
    'src/services/auditService.ts': 'export function runAudit() { return true; }',
    'src/routes/users.ts': "import { Router } from 'express'; const router = Router(); router.get('/users', (_req, res) => res.json([])); export default router;",
    'src/utils/helper.ts': "export const helper = () => 'ok';",
    'src/index.ts': "export { App } from './App'; export * from './hooks/useWorkspace';",
    'src/App.test.tsx': "import App from './App'; export const subject = App;",
    'app/dashboard/page.tsx': 'export default function DashboardPage() { return <div>Dashboard</div>; }',
    'app/layout.tsx': 'export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }',
    'app/api/health/route.ts': "export function GET() { return Response.json({ ok: true }); }",
    'src/validation/userSchema.ts': "import { z } from 'zod'; export const UserSchema = z.object({ name: z.string() });",
    'src/mystery.ts': 'const value = 1;',
    'src/broken.ts': 'export function broken( {',
    'src/missingImport.ts': "import value from './not-present'; export default value;",
    'vite.config.ts': "import { defineConfig } from 'vite'; export default defineConfig({});",
    'vitest.config.ts': "import { defineConfig } from 'vitest/config'; export default defineConfig({});",
    'README.md': '# Fixture repository',
    'AGENTS.md': '# Agent instructions',
    '.env': 'API_KEY=do-not-leak-this-value',
    '.env.example': 'API_URL=https://example.invalid\nAPI_TOKEN=placeholder-only',
  };
  const paths = [
    ...Object.keys(textContents),
    'node_modules/pkg/index.js',
    'dist/assets/app.js',
    'public/logo.png',
  ];
  const files: RepoFileSummary[] = paths.map(path => ({
    path,
    size: textContents[path]?.length || 20,
    ignored: path.startsWith('node_modules/') || path.startsWith('dist/') || path.endsWith('.png'),
    ignoredReason: path.startsWith('node_modules/') || path.startsWith('dist/')
      ? 'generated-vendor'
      : path.endsWith('.png') ? 'binary' : undefined,
  }));
  return { files, textContents, repoName: 'intelligence-fixture', ...overrides };
}

function evidenceDraft(fact: string): RepositoryEvidenceDraft {
  return {
    repositoryRelativePath: 'src/App.tsx',
    folderPath: 'src',
    category: 'responsibility',
    sourceType: 'source',
    extractedFact: fact,
    confidence: 1,
    origin: 'deterministic',
    assertionState: 'verified',
    extractor: { id: 'test', version: '1' },
    relatedEvidenceIds: [],
    relationships: [],
    validation: { state: 'validated', validatorIds: ['test'], reasons: [] },
    limitations: [],
  };
}

describe('repository intelligence evidence identity and paths', () => {
  it('keeps evidence and relationship identity stable when scan input order changes', () => {
    const input = fixtureInput();
    const reversed = {
      ...input,
      files: [...input.files].reverse(),
      textContents: Object.fromEntries(Object.entries(input.textContents).reverse()),
    };
    const first = buildRepositoryIntelligenceEvidence(input);
    const second = buildRepositoryIntelligenceEvidence(reversed);

    expect(first.evidence.map(item => item.id)).toEqual(second.evidence.map(item => item.id));
    expect(first.relationships.map(item => item.id)).toEqual(second.relationships.map(item => item.id));
    expect(first.files.map(item => item.path)).toEqual(second.files.map(item => item.path));
    expect(first.folders).toEqual(second.folders);
  });

  it('distinguishes materially different facts without including absolute machine paths', () => {
    const first = createRepositoryEvidence(evidenceDraft('App is a component.'));
    const second = createRepositoryEvidence(evidenceDraft('App is an entry point.'));
    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toContain('D:');
    expect(first.id).not.toContain('Munka');
    expect(() => createRepositoryEvidence({ ...evidenceDraft('invalid'), repositoryRelativePath: 'D:\\repo\\src\\App.tsx' })).toThrow(/Invalid repository-relative path/);
  });

  it('normalizes Windows and POSIX separators while preserving case and rejecting traversal', () => {
    expect(normalizeZipPath('.\\src\\Feature\\Page.tsx')).toBe('src/Feature/Page.tsx');
    expect(normalizeZipPath('./src/Feature/Page.tsx')).toBe('src/Feature/Page.tsx');
    expect(normalizeZipPath('src//Feature/Page.tsx')).toBe('src/Feature/Page.tsx');
    expect(normalizeZipPath('../outside.ts')).toBe('');
    expect(normalizeZipPath('src/../../outside.ts')).toBe('');
    expect(normalizeZipPath('/absolute/file.ts')).toBe('');
    expect(normalizeZipPath('C:\\repo\\file.ts')).toBe('');
    expect(normalizeEvidencePath('src/Foo.ts')).toBe('src/Foo.ts');
    expect(normalizeEvidencePath('src/foo.ts')).toBe('src/foo.ts');
  });
});

describe('deterministic JS/TS responsibility extraction', () => {
  const model = buildRepositoryIntelligenceEvidence(fixtureInput());
  const file = (path: string) => model.files.find(item => item.path === path);

  it('classifies React, hook, Vite, Next.js, Node service, Express, config, tests, barrels, instructions and unknown files', () => {
    expect(file('src/App.tsx')?.primaryResponsibility).toBe('ui-component');
    expect(file('src/hooks/useWorkspace.ts')?.primaryResponsibility).toBe('hook');
    expect(file('src/main.tsx')?.primaryResponsibility).toBe('application-entry-point');
    expect(file('src/main.tsx')?.secondaryResponsibilities).toContain('framework-bootstrap');
    expect(file('app/dashboard/page.tsx')?.primaryResponsibility).toBe('route-or-page');
    expect(file('app/layout.tsx')?.primaryResponsibility).toBe('layout');
    expect(file('app/api/health/route.ts')?.primaryResponsibility).toBe('api-route-or-request-handler');
    expect(file('src/services/auditService.ts')?.primaryResponsibility).toBe('service');
    expect(file('src/routes/users.ts')?.primaryResponsibility).toBe('api-route-or-request-handler');
    expect(file('vite.config.ts')?.primaryResponsibility).toBe('build-configuration');
    expect(file('vitest.config.ts')?.primaryResponsibility).toBe('test-configuration');
    expect(file('src/App.test.tsx')?.primaryResponsibility).toBe('test-or-fixture');
    expect(file('src/index.ts')?.primaryResponsibility).toBe('export-barrel');
    expect(file('AGENTS.md')?.primaryResponsibility).toBe('ai-agent-instruction');
    expect(file('.env.example')?.primaryResponsibility).toBe('configuration');
    expect(file('.env.example')?.confidence).toBe(1);
    expect(file('src/mystery.ts')?.primaryResponsibility).toBe('unknown-or-insufficient-evidence');
    expect(file('src/mystery.ts')?.safeToPrioritizeForDeepAnalysis).toBe(false);
  });

  it('extracts named/default exports and bounded symbols without inventing malformed-file symbols', () => {
    expect(file('src/App.tsx')?.declaredSymbols).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'App', kind: 'component', exported: true }),
      expect.objectContaining({ name: 'App', kind: 'default-export', defaultExport: true }),
    ]));
    expect(file('app/api/health/route.ts')?.declaredSymbols).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'GET', exported: true }),
    ]));
    expect(file('src/broken.ts')?.extractionState).toBe('parse-failed');
    expect(file('src/broken.ts')?.declaredSymbols).toEqual([]);
    expect(file('src/broken.ts')?.limitations.join(' ')).toMatch(/parser/i);
  });

  it('creates only resolved local import, barrel, test and entry-point relationships', () => {
    expect(model.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'imports', sourcePath: 'src/App.tsx', targetPath: 'src/utils/helper.ts' }),
      expect.objectContaining({ type: 'exports-through', sourcePath: 'src/index.ts', targetPath: 'src/App.tsx' }),
      expect.objectContaining({ type: 'tests', sourcePath: 'src/App.test.tsx', targetPath: 'src/App.tsx' }),
      expect.objectContaining({ type: 'entry-point-loads', sourcePath: 'src/main.tsx', targetPath: 'src/App.tsx' }),
    ]));
    expect(model.relationships.some(item => item.targetPath.includes('not-present'))).toBe(false);
    expect(file('src/missingImport.ts')?.limitations).toContain('Local module target could not be resolved: ./not-present');
    expect(model.relationships.every(item => !['calls', 'owns', 'depends-on'].includes(item.type))).toBe(true);
    const knownPaths = new Set([...model.files.map(item => item.path), ...model.folders.map(item => item.path)]);
    expect(model.relationships.every(item => knownPaths.has(item.sourcePath) && knownPaths.has(item.targetPath))).toBe(true);
  });

  it('keeps generated, binary and secret-looking content outside analyzed source evidence', () => {
    expect(file('node_modules/pkg/index.js')?.primaryResponsibility).toBe('generated-or-vendor-content');
    expect(file('node_modules/pkg/index.js')?.extractionState).toBe('excluded');
    expect(file('node_modules/pkg/index.js')?.safeToPrioritizeForDeepAnalysis).toBe(false);
    expect(file('public/logo.png')?.extractionState).toBe('excluded');
    expect(JSON.stringify(model)).not.toContain('do-not-leak-this-value');
    expect(model.summary.excludedGeneratedFiles).toBe(2);
    expect(model.summary.excludedBinaryFiles).toBe(1);
  });

  it('does not claim Next.js from an ambiguous app folder without a manifest or config signal', () => {
    const input: RepoScanInput = {
      repoName: 'ambiguous-app-folder',
      files: [{ path: 'app/page.tsx', size: 50 }],
      textContents: { 'app/page.tsx': 'export default function Page() { return <div />; }' },
    };
    const result = buildRepositoryIntelligenceEvidence(input);
    expect(result.files[0].primaryResponsibility).toBe('unknown-or-insufficient-evidence');
    expect(result.evidence.some(item => item.extractedFact.includes('Next.js'))).toBe(false);
  });
});

describe('folder responsibility aggregation', () => {
  it('derives deterministic dominant responsibilities and evidence-presence flags', () => {
    const input = fixtureInput();
    input.files.push(
      { path: 'src/components/Panel.tsx', size: 40 },
      { path: 'src/components/Button.tsx', size: 40 },
      { path: 'src/components/README.md', size: 20 },
      { path: 'src/mixed/Widget.tsx', size: 40 },
      { path: 'src/mixed/Widget.test.tsx', size: 40 },
      { path: 'src/mixed/main.tsx', size: 40 },
      { path: 'src/mixed/main.test.tsx', size: 40 },
      { path: 'src/mixed/main.integration.test.tsx', size: 40 },
      { path: 'src/mixed/main.browser.test.tsx', size: 40 },
      { path: 'src/mixed/AGENTS.md', size: 20 },
    );
    Object.assign(input.textContents, {
      'src/components/Panel.tsx': 'export function Panel() { return <section />; }',
      'src/components/Button.tsx': 'export function Button() { return <button />; }',
      'src/components/README.md': '# Components',
      'src/mixed/Widget.tsx': 'export function Widget() { return <div />; }',
      'src/mixed/Widget.test.tsx': "import { Widget } from './Widget'; export { Widget };",
      'src/mixed/main.tsx': 'export function bootstrap() { return true; }',
      'src/mixed/main.test.tsx': "import { bootstrap } from './main'; export const subject = bootstrap;",
      'src/mixed/main.integration.test.tsx': "import { bootstrap } from './main'; export const integrationSubject = bootstrap;",
      'src/mixed/main.browser.test.tsx': "import { bootstrap } from './main'; export const browserSubject = bootstrap;",
      'src/mixed/AGENTS.md': '# Mixed folder rules',
    });
    const model = buildRepositoryIntelligenceEvidence(input);
    const components = model.folders.find(folder => folder.path === 'src/components');
    const mixed = model.folders.find(folder => folder.path === 'src/mixed');
    const generated = model.folders.find(folder => folder.path === 'dist');

    expect(components?.dominantResponsibilities[0]).toEqual(expect.objectContaining({ responsibility: 'ui-component', fileCount: 2 }));
    expect(components?.aggregationState).toBe('dominant');
    expect(components?.hasDocumentation).toBe(true);
    expect(mixed?.hasTests).toBe(true);
    expect(mixed?.hasAgentInstructions).toBe(true);
    expect(mixed?.aggregationState).toBe('mixed');
    expect(mixed?.limitations).toContain('The folder has mixed materially important responsibilities under the deterministic folder-dominance policy.');
    expect(generated?.generatedOrVendor).toBe(true);
    expect(generated?.aggregationState).toBe('insufficient-evidence');
    expect(generated?.importantChildFiles).toEqual([]);
    expect(model.folders.map(folder => folder.path)).toEqual([...model.folders.map(folder => folder.path)].sort());
  });

  it('does not let several low-value fixtures outweigh a clear entry point and keeps weak evidence insufficient', () => {
    const input = fixtureInput({
      files: [
        { path: 'src/weighted/main.tsx', size: 40 },
        { path: 'src/weighted/a.test.ts', size: 20 },
        { path: 'src/weighted/b.test.ts', size: 20 },
        { path: 'src/weak/mystery.ts', size: 20 },
      ],
      textContents: {
        'package.json': JSON.stringify({ dependencies: { react: '^18', vite: '^5' } }),
        'src/weighted/main.tsx': 'export function bootstrap() { return true; }',
        'src/weighted/a.test.ts': 'export const a = true;',
        'src/weighted/b.test.ts': 'export const b = true;',
        'src/weak/mystery.ts': 'const value = 1;',
      },
    });
    input.files.unshift({ path: 'package.json', size: input.textContents['package.json'].length });
    const model = buildRepositoryIntelligenceEvidence(input);
    const weighted = model.folders.find(folder => folder.path === 'src/weighted');
    const weak = model.folders.find(folder => folder.path === 'src/weak');

    expect(weighted?.aggregationState).toBe('dominant');
    expect(weighted?.dominantResponsibilities[0].responsibility).toBe('application-entry-point');
    expect(weak?.aggregationState).toBe('insufficient-evidence');
  });
});

describe('scanner source-text boundary', () => {
  it('reads bounded JS/TS source while keeping environment and binary content unread', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('repo/package.json', JSON.stringify({ dependencies: { vite: '^5' } }));
    zip.file('repo/src/main.tsx', "export const marker = 'source-loaded';");
    zip.file('repo/.env', 'API_KEY=secret-value');
    zip.file('repo/public/image.png', new Uint8Array([0, 1, 2, 3]));
    const blob = await zip.generateAsync({ type: 'blob' });
    const scanned = await scanZipFile(new File([blob], 'repo.zip', { type: 'application/zip' }));

    expect(scanned.textContents['src/main.tsx']).toContain('source-loaded');
    expect(scanned.textContents['.env']).toBeUndefined();
    expect(scanned.textContents['public/image.png']).toBeUndefined();
  });
});

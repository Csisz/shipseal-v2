import type { RepoScanInput, DetectedStack } from './types';

type PackageJson = {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function safeJson(text: string | undefined): PackageJson | null {
  if (!text) return null;
  try { return JSON.parse(text) as PackageJson; } catch { return null; }
}

export function detectStack(input: RepoScanInput): DetectedStack {
  const files = input.files;
  const paths = new Set(files.map((f) => f.path));
  const has = (p: string) => paths.has(p);
  const hasAny = (...ps: string[]) => ps.some((p) => paths.has(p));
  const hasDir = (dir: string) => files.some((f) => f.path.startsWith(dir + '/'));

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const testFrameworks = new Set<string>();
  const runCommands: { label: string; cmd: string }[] = [];
  let scripts: Record<string, string> = {};

  // Node / JS / TS
  const pkg = safeJson(input.textContents['package.json']);
  if (has('package.json')) {
    languages.add('JavaScript');
    if (has('tsconfig.json')) languages.add('TypeScript');
    // package managers
    if (has('pnpm-lock.yaml')) packageManagers.add('pnpm');
    else if (has('yarn.lock')) packageManagers.add('yarn');
    else if (has('bun.lockb') || has('bun.lock')) packageManagers.add('bun');
    else packageManagers.add('npm');

    scripts = pkg?.scripts || {};
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    if (deps['react']) frameworks.add('React');
    if (deps['next']) frameworks.add('Next.js');
    if (deps['vite']) frameworks.add('Vite');
    if (deps['vue']) frameworks.add('Vue');
    if (deps['svelte']) frameworks.add('Svelte');
    if (deps['express']) frameworks.add('Express');
    if (deps['@nestjs/core']) frameworks.add('NestJS');
    if (deps['vitest']) testFrameworks.add('Vitest');
    if (deps['jest']) testFrameworks.add('Jest');
    if (deps['playwright'] || deps['@playwright/test']) testFrameworks.add('Playwright');

    const pm = [...packageManagers][0] || 'npm';
    const runScript = pm === 'npm' ? 'npm run' : pm;
    if (scripts.dev) runCommands.push({ label: 'Dev', cmd: `${runScript} dev` });
    if (scripts.build) runCommands.push({ label: 'Build', cmd: `${runScript} build` });
    if (scripts.test) runCommands.push({ label: 'Test', cmd: `${runScript} test` });
    if (scripts.lint) runCommands.push({ label: 'Lint', cmd: `${runScript} lint` });
    if (scripts.typecheck) runCommands.push({ label: 'Typecheck', cmd: `${runScript} typecheck` });
  }

  if (hasAny('vite.config.ts', 'vite.config.js', 'vite.config.mjs')) frameworks.add('Vite');
  if (hasAny('next.config.js', 'next.config.mjs', 'next.config.ts') || hasDir('app') || hasDir('pages')) frameworks.add('Next.js');

  // Python
  if (hasAny('requirements.txt', 'pyproject.toml', 'setup.py')) {
    languages.add('Python');
    const req = input.textContents['requirements.txt'] || input.textContents['pyproject.toml'] || '';
    if (/fastapi/i.test(req)) frameworks.add('FastAPI');
    if (/django/i.test(req)) frameworks.add('Django');
    if (/flask/i.test(req)) frameworks.add('Flask');
    runCommands.push({ label: 'Install', cmd: 'pip install -r requirements.txt' });
  }

  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    languages.add('Java');
    runCommands.push({ label: 'Build', cmd: has('pom.xml') ? 'mvn package' : './gradlew build' });
  }
  if (has('go.mod')) { languages.add('Go'); runCommands.push({ label: 'Build', cmd: 'go build ./...' }); runCommands.push({ label: 'Test', cmd: 'go test ./...' }); }
  if (has('Cargo.toml')) { languages.add('Rust'); runCommands.push({ label: 'Build', cmd: 'cargo build' }); runCommands.push({ label: 'Test', cmd: 'cargo test' }); }
  if (has('composer.json')) { languages.add('PHP'); }
  if (has('Gemfile')) { languages.add('Ruby'); }

  const primary =
    frameworks.has('Next.js') ? 'Next.js' :
    frameworks.has('Vite') && frameworks.has('React') ? 'React + Vite' :
    frameworks.has('React') ? 'React' :
    frameworks.has('Vue') ? 'Vue' :
    frameworks.has('FastAPI') ? 'FastAPI' :
    frameworks.has('Django') ? 'Django' :
    [...languages][0] || 'Unknown';

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    packageManagers: [...packageManagers],
    scripts,
    testFrameworks: [...testFrameworks],
    runCommands,
    primary,
  };
}

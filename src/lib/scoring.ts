import type {
  CriticalBlocker,
  DetectedStack,
  Improvement,
  ReadinessLevel,
  RepoScanInput,
  ScoreCategory,
  ScoreItem,
} from './types';
import { detectEntryPointCandidates, detectSourceFolders } from './sourceDetection';

const STACK_CONFIG_FILES = [
  'package.json', 'tsconfig.json', 'pyproject.toml', 'requirements.txt',
  'pom.xml', 'build.gradle', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile',
];

const SOURCE_DIRS = ['src', 'app', 'pages', 'components', 'lib', 'backend', 'api', 'server'];

function item(id: string, label: string, points: number, passed: boolean, partial?: number): ScoreItem {
  const earned = passed ? points : (partial ?? 0);
  return { id, label, points, earned, passed };
}

function category(id: string, name: string, description: string, items: ScoreItem[], max: number): ScoreCategory {
  const earned = items.reduce((a, b) => a + b.earned, 0);
  return { id, name, description, items, max, earned: Math.min(earned, max) };
}

export interface ScoringResult {
  categories: ScoreCategory[];
  score: number;
  level: ReadinessLevel;
  blockers: CriticalBlocker[];
  improvements: Improvement[];
}

export interface ReadinessEvaluation {
  isReady: boolean;
  level: ReadinessLevel;
  statusMessage: string;
}

export function isSecretFilePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  const baseName = normalized.split('/').pop() || '';
  const lowerBaseName = baseName.toLowerCase();

  if (['.env', '.env.local', '.env.production'].includes(lowerBaseName)) return true;
  if (lowerBaseName === 'id_rsa' || lowerBaseName === 'id_dsa') return true;
  if (/^private_key(\..+)?$/i.test(baseName)) return true;
  if (lowerBaseName === 'serviceaccount.json') return true;
  if (lowerBaseName === 'credentials.json') return true;
  if (/\.(pem|key)$/i.test(baseName)) return true;

  return false;
}

export function evaluateReadiness(score: number, criticalBlockers: CriticalBlocker[] = []): ReadinessEvaluation {
  const hasBlockers = criticalBlockers.length > 0;

  if (hasBlockers) {
    return {
      isReady: false,
      level: score < 40 ? 'Not Ready' : score < 65 ? 'Partially Ready' : 'Almost Ready',
      statusMessage: 'Critical blockers must be resolved before this repo can be AI Coding Ready.',
    };
  }

  if (score >= 95) {
    return {
      isReady: true,
      level: 'AgentReady Certified',
      statusMessage: 'Your repository is AI Coding Ready.',
    };
  }

  if (score >= 85) {
    return {
      isReady: true,
      level: 'AI Coding Ready',
      statusMessage: 'Your repository is AI Coding Ready.',
    };
  }

  return {
    isReady: false,
    level: levelFromScore(score),
    statusMessage: 'Almost there - improve a few areas to reach AI Coding Ready.',
  };
}

export function levelFromScore(score: number): ReadinessLevel {
  if (score >= 65) return 'Almost Ready';
  if (score >= 40) return 'Partially Ready';
  return 'Not Ready';
}

export function scoreRepo(input: RepoScanInput, stack: DetectedStack): ScoringResult {
  const paths = new Set(input.files.filter(f => !f.isDir).map(f => f.path));
  const lower = new Set([...paths].map(p => p.toLowerCase()));
  const has = (p: string) => paths.has(p);
  const hasI = (p: string) => lower.has(p.toLowerCase());
  const hasDir = (dir: string) => input.files.some(f => f.path.startsWith(dir + '/'));
  const anyMatch = (re: RegExp) => [...paths].some(p => re.test(p));

  const readme = input.textContents['README.md'] || input.textContents['readme.md'] || input.textContents['README'] || '';
  const readmeLower = readme.toLowerCase();
  const hasReadme = readme.length > 0;

  const pkg = (() => { try { return JSON.parse(input.textContents['package.json'] || 'null'); } catch { return null; } })();
  const scripts = pkg?.scripts || {};
  const hasStackConfig = STACK_CONFIG_FILES.some(p => has(p));
  const sourceFolders = detectSourceFolders(input);
  const hasSourceDir = SOURCE_DIRS.some(hasDir) || sourceFolders.length > 0;
  const hasCi = anyMatch(/\.github\/workflows\/.+\.ya?ml$/);
  const hasTests = anyMatch(/(\.test\.|\.spec\.|__tests__\/|tests?\/)/i) || !!scripts.test;
  const hasLint = !!scripts.lint || has('.eslintrc') || has('.eslintrc.json') || has('eslint.config.js') || has('eslint.config.ts');
  const hasTypecheck = !!scripts.typecheck || has('tsconfig.json');
  const hasBuild = !!scripts.build || has('vite.config.ts') || has('vite.config.js') || has('next.config.js') || stack.languages.includes('Go') || stack.languages.includes('Rust');

  const hasAgents = has('AGENTS.md');
  const hasClaude = has('CLAUDE.md') || has('.cursorrules') || hasDir('.cursor') || has('codex.md');
  const hasContributing = has('CONTRIBUTING.md');
  const hasArchitectureDocs = hasDir('docs') || has('ARCHITECTURE.md');

  const hasEnvExample = has('.env.example');
  const hasGitignore = has('.gitignore');
  const gitignore = input.textContents['.gitignore'] || '';
  const ignoresAll = ['node_modules', 'dist', 'build', '.next', '.env', 'coverage'].every(t => gitignore.includes(t));

  const secretFiles = [...paths].filter(isSecretFilePath);

  const generatedFiles = [...paths].filter(p =>
    p.includes('node_modules/') || p.includes('dist/') || p.includes('build/') ||
    p.includes('.next/') || p.includes('vendor/') || p.includes('coverage/'));
  const totalFiles = input.files.filter(f => !f.isDir).length;
  const generatedRatio = totalFiles ? generatedFiles.length / totalFiles : 0;
  const heavyGenerated = generatedRatio > 0.5;

  const hasSecurityDocs = has('SECURITY.md') || /security|auth|privacy/i.test(readme);
  const hasCodeowners = has('CODEOWNERS') || has('.github/CODEOWNERS');

  // ---------- Category 1: Project structure & documentation (20) ----------
  const c1 = category('structure', 'Project structure & documentation',
    'Clear README, source folders, and architectural signals so agents understand the repo.',
    [
      item('readme', 'README exists', 5, hasReadme),
      item('readme_purpose', 'README mentions purpose / overview / features', 4,
        hasReadme && /(overview|purpose|features|about)/.test(readmeLower)),
      item('readme_setup', 'README includes install / setup / run usage', 4,
        hasReadme && /(install|setup|getting started|run|usage|quickstart)/.test(readmeLower)),
      item('stack_config', 'Recognizable stack / config file exists', 3, hasStackConfig),
      item('src_folder', 'Clear source folder (src/app/pages/components/lib/backend/api)', 2, hasSourceDir),
      item('arch_docs', 'Architecture docs or CONTRIBUTING exists', 2, hasArchitectureDocs || hasContributing),
    ], 20);

  // ---------- Category 2: Build / test / quality gates (20) ----------
  const c2 = category('quality', 'Build, test & quality gates',
    'Reliable signals an agent can run to confirm changes are safe.',
    [
      item('pkg_recognized', 'Package / config file recognized', 4, hasStackConfig),
      item('build', 'Build script or build config present', 4, hasBuild),
      item('tests', 'Test script or test files present', 4, hasTests),
      item('lint', 'Lint or typecheck script available', 3, hasLint || hasTypecheck),
      item('ci', 'CI workflow exists', 3, hasCi),
      item('test_strategy', 'Testing strategy documented (or generatable)', 2,
        hasI('testing.md') || hasTests),
    ], 20);

  // ---------- Category 3: AI agent instruction readiness (20) ----------
  const generatableContext = hasReadme && hasStackConfig; // we can synthesize AGENTS.md
  const c3 = category('agents', 'AI agent instruction readiness',
    'Files that tell agents how to behave, what to avoid, and how to verify changes.',
    [
      item('agents_md', 'AGENTS.md exists', 6, hasAgents, generatableContext ? 3 : 0),
      item('claude_or_cursor', 'CLAUDE.md / Cursor rules / Codex instructions exist', 4, hasClaude),
      item('dev_rules', 'Documented dev rules / CONTRIBUTING', 3, hasContributing),
      item('forbidden_rules', 'Forbidden / sensitive change rules exist', 3,
        hasAgents || /do not|forbidden|never edit/i.test(readme)),
      item('post_change_cmds', 'Commands after changes are documented', 2,
        !!scripts.test || /after.*change|verify|run tests/i.test(readme)),
      item('reviewer_guide', 'Reviewer / self-check guidance exists', 2,
        has('REVIEWER_PROMPT.md') || /review/i.test(readme)),
    ], 20);

  // ---------- Category 4: Security & secret handling (15) ----------
  const c4 = category('security', 'Security & secret handling',
    'Prevent agents from leaking secrets or touching dangerous files.',
    [
      item('env_example', '.env.example exists', 3, hasEnvExample),
      item('gitignore', '.gitignore exists', 3, hasGitignore),
      item('gitignore_strong', '.gitignore covers node_modules/dist/build/.next/.env/coverage', 3, ignoresAll),
      item('no_secret_files', 'No obvious secret / credential files', 4, secretFiles.length === 0),
      item('sec_docs', 'Security / auth / privacy docs or dependency scan config', 2,
        hasSecurityDocs || has('.github/dependabot.yml')),
    ], 15);

  // ---------- Category 5: Token efficiency & context engineering (15) ----------
  const ignorable = !generatedFiles.length || gitignore.includes('node_modules');
  const entryPoints = detectEntryPointCandidates(input).length > 0;
  const c5 = category('tokens', 'Token efficiency & context engineering',
    'Keep agent context tight: small surface area, clear entry points.',
    [
      item('ignorable_generated', 'Generated folders are ignorable', 3, ignorable),
      item('entry_points', 'Key entry points identifiable', 3, entryPoints || hasSourceDir),
      item('compact_summary', 'Compact project summary possible', 3, hasReadme || !!pkg?.description),
      item('not_vendor_heavy', 'Repository not dominated by generated/vendor folders', 3, !heavyGenerated),
      item('module_map', 'Module map can be created from source folders', 3, hasSourceDir),
    ], 15);

  // ---------- Category 6: Team workflow & governance (10) ----------
  const c6 = category('governance', 'Team workflow & governance',
    'Make multi-developer + agent collaboration safe.',
    [
      item('contributing', 'CONTRIBUTING or PR workflow docs', 2, hasContributing),
      item('codeowners', 'CODEOWNERS or ownership signals', 2, hasCodeowners),
      item('branch_ci', 'Branch / PR / CI workflow', 2, hasCi),
      item('deploy_docs', 'Deployment / rollback docs', 2, /(deploy|rollback)/i.test(readmeLower) || has('Dockerfile')),
      item('critical_policy', 'Critical files / policy guidance', 2, hasAgents || hasCodeowners),
    ], 10);

  const categories = [c1, c2, c3, c4, c5, c6];
  const score = Math.min(100, Math.round(categories.reduce((a, c) => a + c.earned, 0)));

  // -------- Blockers --------
  const blockers: CriticalBlocker[] = [];
  if (!hasStackConfig) blockers.push({ id: 'no_stack', title: 'No recognizable stack or config file', detail: 'ShipSeal could not detect a package.json, pyproject.toml, go.mod, or similar manifest.' });
  if (!hasBuild && !hasTests && !hasLint) blockers.push({ id: 'no_build_test_lint', title: 'No build / test / lint signals', detail: 'Agents have nothing to run to verify their changes.' });
  if (secretFiles.length > 0) blockers.push({ id: 'secrets', title: 'Suspicious secret files found', detail: `Detected: ${secretFiles.slice(0,5).join(', ')}. Remove these before exposing the repo to any agent.` });
  if (heavyGenerated) blockers.push({ id: 'generated_heavy', title: 'Repository dominated by generated/vendor files', detail: 'Strip node_modules/dist/build before scanning to keep agent context small.' });
  if (!generatableContext && !hasAgents) blockers.push({ id: 'no_agent_context', title: 'Not enough context to generate AGENTS.md', detail: 'Add a README and a stack manifest so ShipSeal can synthesize agent instructions.' });

  // -------- Improvements --------
  const improvements: Improvement[] = [];
  categories.forEach(c => c.items.filter(i => !i.passed).forEach(i =>
    improvements.push({
      id: `${c.id}.${i.id}`,
      title: i.label,
      detail: `Worth +${i.points} points in "${c.name}".`,
      category: c.name,
    })
  ));

  const readiness = evaluateReadiness(score, blockers);
  return { categories, score, level: readiness.level, blockers, improvements };
}

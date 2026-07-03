import { isBinaryLikePath, isGeneratedOrVendorPath, normalizeZipPath } from './scannerLimits';
import type { RepoScanInput } from './types';

const SOURCE_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|cs|php|rb|swift|scala|vue|svelte)$/i;
const PY_SOURCE_RE = /\.py$/i;
const TEST_PATH_RE = /(^|\/)(__tests__|tests?|specs?|e2e)(\/|$)|(\.|-)(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_.*\.py$|(^|\/).*_test\.py$/i;
const EXCLUDED_AREA_RE = /(^|\/)(docs?|tests?|__tests__|specs?|e2e|migrations?|\.venv|venv|env|node_modules|vendor|dist|build|coverage|__pycache__)(\/|$)/i;
const PYTHON_ENTRY_FILE_RE = /(^|\/)(main|app|run|wsgi|manage|__main__|cli)\.py$/i;
const JS_ENTRY_FILE_RE = /(^|\/)(src\/)?(main|index)\.[cm]?[jt]sx?$|(^|\/)app\/page\.[jt]sx?$/i;
const GO_ENTRY_FILE_RE = /(^|\/)cmd\/[^/]+\/main\.go$/i;
const FLASK_FACTORY_RE = /\b(create_app\s*\(|Flask\s*\(\s*__name__\s*\))/;

function normalizedFiles(input: RepoScanInput) {
  return input.files.map(file => ({
    ...file,
    path: normalizeZipPath(file.path),
  }));
}

function isRelevantSourcePath(path: string, ignored?: boolean, ignoredReason?: string) {
  if (!path || ignored || ignoredReason === 'generated-vendor' || ignoredReason === 'binary') return false;
  if (isGeneratedOrVendorPath(path) || isBinaryLikePath(path)) return false;
  if (EXCLUDED_AREA_RE.test(path) || TEST_PATH_RE.test(path)) return false;
  return SOURCE_EXT_RE.test(path.split('/').pop() || path);
}

function topFolder(path: string) {
  return path.split('/').filter(Boolean)[0] || '';
}

function parentFolder(path: string) {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

export function detectSourceFolders(input: RepoScanInput): string[] {
  const files = normalizedFiles(input).filter(file => !file.isDir);
  const sourceFiles = files.filter(file => isRelevantSourcePath(file.path, file.ignored, file.ignoredReason));
  const folders = new Set<string>();

  for (const file of sourceFiles) {
    const path = file.path;
    const top = topFolder(path);
    if (['src', 'app', 'application', 'pages', 'components', 'lib', 'api', 'server', 'backend', 'cmd'].includes(top)) {
      if (top === 'src' && PY_SOURCE_RE.test(path)) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 3 && files.some(candidate => candidate.path.toLowerCase() === `src/${parts[1].toLowerCase()}/__init__.py`)) {
          folders.add(`src/${parts[1]}`);
          continue;
        }
      }
      folders.add(top);
      continue;
    }

    if (PY_SOURCE_RE.test(path)) {
      const folder = parentFolder(path);
      if (!folder || EXCLUDED_AREA_RE.test(folder)) continue;
      const initPath = `${folder}/__init__.py`.toLowerCase();
      if (files.some(candidate => candidate.path.toLowerCase() === initPath)) {
        folders.add(folder);
      }
    }
  }

  const pythonTopCounts = new Map<string, number>();
  for (const file of sourceFiles.filter(file => PY_SOURCE_RE.test(file.path))) {
    const top = topFolder(file.path);
    if (!top || EXCLUDED_AREA_RE.test(top)) continue;
    pythonTopCounts.set(top, (pythonTopCounts.get(top) || 0) + 1);
  }
  for (const [folder, count] of pythonTopCounts) {
    if (count >= 2) folders.add(folder);
  }

  return [...folders].sort();
}

export function detectEntryPointCandidates(input: RepoScanInput): string[] {
  const files = normalizedFiles(input).filter(file => !file.isDir);
  const candidates = new Set<string>();

  for (const file of files) {
    const path = file.path;
    if (!isRelevantSourcePath(path, file.ignored, file.ignoredReason)) continue;
    if (JS_ENTRY_FILE_RE.test(path) || GO_ENTRY_FILE_RE.test(path) || PYTHON_ENTRY_FILE_RE.test(path)) {
      candidates.add(path);
      continue;
    }
    if (PY_SOURCE_RE.test(path) && FLASK_FACTORY_RE.test(input.textContents[path] || '')) {
      candidates.add(path);
    }
  }

  for (const script of parsePythonScriptDeclarations(input.textContents['pyproject.toml'])) {
    candidates.add(`pyproject.toml: ${script}`);
  }

  return [...candidates].sort();
}

function parsePythonScriptDeclarations(pyproject: string | undefined): string[] {
  if (!pyproject) return [];
  const scripts: string[] = [];
  let inScripts = false;
  for (const rawLine of pyproject.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) {
      inScripts = heading[1] === 'project.scripts' || heading[1] === 'tool.poetry.scripts';
      continue;
    }
    if (!inScripts) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*["']([^"']+)["']/);
    if (match) scripts.push(`${match[1]} -> ${match[2]}`);
  }
  return scripts;
}

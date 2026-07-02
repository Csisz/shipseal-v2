import { isBinaryLikePath, isGeneratedOrVendorPath, normalizeZipPath } from '../scannerLimits';
import type { RepoFileSummary, RepoScanInput } from '../types';
import type { ClassifiedRepositoryFile, RepositoryFileKind } from './types';

const SOURCE_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|cs|php|rb|swift|scala|vue|svelte)$/i;
const TEST_PATH_RE = /(^|\/)(__tests__|tests?|specs?|e2e)(\/|$)|(\.|-)(test|spec)\.[cm]?[jt]sx?$/i;
const DOC_EXT_RE = /\.(md|mdx|rst|adoc|txt)$/i;
const CONFIG_EXT_RE = /\.(json|ya?ml|toml|ini|conf|config\.[cm]?[jt]s)$/i;
const LEGACY_DOC_RE = /(^|\/)(archive|archives|archived|legacy|obsolete|deprecated|old|_archive)(\/|$)/i;
const INSTRUCTION_PATH_RE = /(^|\/)(agents\.md|claude\.md|codex\.md|\.cursorrules|\.cursor\/rules(?:\/|$))/i;
const CONFIG_BASENAMES = new Set([
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'cargo.toml',
  'pom.xml',
  'build.gradle',
  'gemfile',
  'composer.json',
  'dockerfile',
  'makefile',
  '.gitignore',
  '.env.example',
  'codeowners',
]);

export function classifyRepositoryFiles(input: RepoScanInput): ClassifiedRepositoryFile[] {
  return input.files
    .map(file => classifyRepositoryFile(file, input))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function classifyRepositoryFile(file: RepoFileSummary, input: RepoScanInput): ClassifiedRepositoryFile {
  const path = normalizeZipPath(file.path);
  const lower = path.toLowerCase();
  const base = lower.split('/').pop() || lower;
  const isDir = !!file.isDir;
  const generatedOrVendor = !isDir && (file.ignoredReason === 'generated-vendor' || isGeneratedOrVendorPath(path));
  const binaryLike = !isDir && (file.ignoredReason === 'binary' || isBinaryLikePath(path));
  const readableText = Object.prototype.hasOwnProperty.call(input.textContents, path);
  const legacyDocumentation = LEGACY_DOC_RE.test(path);
  const activeDocumentation = isDocumentationPath(path) && !legacyDocumentation && !generatedOrVendor && !binaryLike;

  return {
    path,
    size: file.size || 0,
    isDir,
    ignored: !!file.ignored,
    kind: classifyKind(path, base, isDir, generatedOrVendor, binaryLike),
    activeDocumentation,
    legacyDocumentation,
    generatedOrVendor,
    binaryLike,
    readableText,
  };
}

export function isDocumentationPath(path: string): boolean {
  const lower = normalizeZipPath(path).toLowerCase();
  const base = lower.split('/').pop() || lower;
  if (INSTRUCTION_PATH_RE.test(lower)) return false;
  return DOC_EXT_RE.test(base) || base === 'readme' || base === 'license';
}

export function isInstructionPath(path: string): boolean {
  return INSTRUCTION_PATH_RE.test(normalizeZipPath(path).toLowerCase());
}

export function isLegacyDocumentationPath(path: string): boolean {
  return LEGACY_DOC_RE.test(normalizeZipPath(path));
}

function classifyKind(
  path: string,
  base: string,
  isDir: boolean,
  generatedOrVendor: boolean,
  binaryLike: boolean,
): RepositoryFileKind {
  if (isDir) return 'other';
  if (generatedOrVendor) return 'generated';
  if (binaryLike) return 'binary';
  if (isInstructionPath(path)) return 'instruction';
  if (TEST_PATH_RE.test(path)) return 'test';
  if (isDocumentationPath(path)) return 'documentation';
  if (CONFIG_BASENAMES.has(base) || CONFIG_EXT_RE.test(base) || path.toLowerCase().includes('.github/workflows/')) return 'config';
  if (SOURCE_EXT_RE.test(base)) return 'source';
  return 'other';
}

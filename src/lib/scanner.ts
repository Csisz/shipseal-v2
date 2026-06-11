import type { RepoFileSummary, RepoScanInput, ScanSummary } from './types';
import {
  SCANNER_LIMITS,
  ScannerValidationError,
  createEmptyScanSummary,
  generatedFolderName,
  getUnsafeZipPathReason,
  isBinaryLikePath,
  isGeneratedOrVendorPath,
  normalizeZipPath,
} from './scannerLimits';

type ZipEntryWithSize = {
  name: string;
  dir: boolean;
  async: (type: 'string') => Promise<string>;
  _data?: {
    uncompressedSize?: number;
  };
};

type ZipModule = typeof import('jszip');

const TEXT_CONFIG_FILES = [
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'requirements.txt', 'pyproject.toml', 'pom.xml', 'build.gradle',
  'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile',
  'README.md', 'readme.md', 'README', 'CONTRIBUTING.md',
  'AGENTS.md', 'CLAUDE.md', '.cursorrules', 'CODEOWNERS',
  '.cursor/rules',
  '.env.example', '.gitignore', '.eslintrc', '.eslintrc.json',
];

const TEXT_EXT_RE = /\.(md|json|ya?ml|toml|txt|gitignore|env\.example|cursorrules)$/i;

function isLikelyTextConfig(path: string): boolean {
  const base = path.split('/').pop() || '';
  if (path === '.cursor/rules' || path.startsWith('.cursor/rules/')) return true;
  if (TEXT_CONFIG_FILES.includes(base)) return true;
  if (TEXT_EXT_RE.test(base)) return true;
  if (path.includes('.github/workflows/')) return true;
  return false;
}

function summarizeLargeRepo(summary: ScanSummary) {
  if (summary.filesIgnored > 0) {
    summary.warnings.push('Large or generated repository content was safely ignored. ShipSeal analyzed repository structure plus a safe readable-text subset.');
  }
}

/**
 * Scan a ZIP file in-browser using JSZip.
 * We only read filenames + small text config files. We never execute code.
 */
export async function scanZipFile(file: File): Promise<RepoScanInput> {
  if (file.size > SCANNER_LIMITS.maxZipSizeBytes) {
    throw new ScannerValidationError('ZIP file is too large. ShipSeal accepts repository ZIP files up to 25 MB in this local prototype.');
  }

  const JSZip = (await import('jszip') as ZipModule).default;
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files) as ZipEntryWithSize[];
  const fileEntries = entries.filter(entry => !entry.dir);

  if (fileEntries.length > SCANNER_LIMITS.maxFileCount) {
    throw new ScannerValidationError(`Repository contains too many files for local prototype scanning. Limit: ${SCANNER_LIMITS.maxFileCount.toLocaleString()} files.`);
  }

  for (const entry of entries) {
    const unsafeReason = getUnsafeZipPathReason(entry.name);
    if (unsafeReason) {
      throw new ScannerValidationError(unsafeReason);
    }
  }

  const files: RepoFileSummary[] = [];
  const textContents: Record<string, string> = {};
  const summary = createEmptyScanSummary();
  summary.totalFilesFound = fileEntries.length;

  const topLevels = new Set<string>();
  for (const entry of entries) {
    const first = normalizeZipPath(entry.name).split('/')[0];
    if (first) topLevels.add(first);
  }
  let stripPrefix = '';
  if (topLevels.size === 1) {
    const only = [...topLevels][0];
    if (entries.every(entry => normalizeZipPath(entry.name) === only || normalizeZipPath(entry.name).startsWith(`${only}/`))) {
      stripPrefix = `${only}/`;
    }
  }

  for (const entry of entries) {
    let path = normalizeZipPath(entry.name);
    if (stripPrefix && path.startsWith(stripPrefix)) {
      path = path.slice(stripPrefix.length);
    }
    if (!path) continue;

    if (entry.dir) {
      files.push({ path, size: 0, isDir: true });
      continue;
    }

    const size = entry._data?.uncompressedSize ?? 0;
    const generatedFolder = generatedFolderName(path);
    const generated = isGeneratedOrVendorPath(path);
    const binary = isBinaryLikePath(path);
    let ignoredReason: RepoFileSummary['ignoredReason'] | undefined;

    if (generated) {
      ignoredReason = 'generated-vendor';
      summary.generatedVendorFilesIgnored += 1;
      if (generatedFolder && !summary.ignoredGeneratedFolders.includes(generatedFolder)) {
        summary.ignoredGeneratedFolders.push(generatedFolder);
      }
    } else if (binary) {
      ignoredReason = 'binary';
      summary.binaryFilesIgnored += 1;
    } else if (isLikelyTextConfig(path) && size > SCANNER_LIMITS.maxReadableTextFileSizeBytes) {
      ignoredReason = 'too-large-text';
    }

    const ignored = !!ignoredReason;
    if (ignored) {
      summary.filesIgnored += 1;
    } else {
      summary.filesAnalyzed += 1;
    }

    files.push({ path, size, isDir: false, ignored, ignoredReason });

    if (!ignored && isLikelyTextConfig(path)) {
      if (summary.readableTextBytesAnalyzed + size > SCANNER_LIMITS.maxTotalReadableTextBytes) {
        throw new ScannerValidationError('Repository contains too much readable text for local prototype scanning. Remove generated docs or large text artifacts and try again.');
      }

      try {
        const txt = await entry.async('string');
        textContents[path] = txt;
        summary.readableTextBytesAnalyzed += size;
      } catch {
        summary.warnings.push(`Could not read ${path} as text; it was skipped.`);
      }
    }
  }

  summarizeLargeRepo(summary);

  const repoName = file.name.replace(/\.zip$/i, '') || 'repository';

  return { files, textContents, repoName, scanSummary: summary };
}

/**
 * Build a fallback scan input when ZIP parsing fails (e.g. malformed zip).
 * Produces deterministic fallback data from the filename so the flow still works.
 */
export function fallbackScan(file: File): RepoScanInput {
  const repoName = file.name.replace(/\.zip$/i, '');
  const files: RepoFileSummary[] = [
    { path: 'README.md', size: 1200 },
    { path: 'package.json', size: 800 },
    { path: 'src/index.ts', size: 200 },
    { path: '.gitignore', size: 120 },
  ];
  const textContents: Record<string, string> = {
    'package.json': JSON.stringify({ name: repoName, scripts: { build: 'tsc', test: 'vitest' } }),
    'README.md': `# ${repoName}\n\nA sample repository.`,
    '.gitignore': 'node_modules\ndist\n.env\n',
  };
  return {
    files,
    textContents,
    repoName,
    scanSummary: {
      ...createEmptyScanSummary(),
      totalFilesFound: files.length,
      filesAnalyzed: files.length,
      readableTextBytesAnalyzed: Object.values(textContents).reduce((total, text) => total + text.length, 0),
      warnings: ['ZIP parsing failed, so ShipSeal used a deterministic fallback scan.'],
    },
  };
}

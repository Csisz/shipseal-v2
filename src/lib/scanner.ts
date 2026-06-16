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

export const LIMITED_SCAN_WARNING = 'ZIP parsing failed, so ShipSeal used a deterministic fallback scan. This is a limited scan and must not be treated as a complete client handoff audit.';

type ArchiveDiagnostics = NonNullable<ScanSummary['archiveDiagnostics']>;

export class ArchiveParseError extends Error {
  diagnostics: ArchiveDiagnostics;

  constructor(message: string, diagnostics: ArchiveDiagnostics) {
    super(message);
    this.name = 'ArchiveParseError';
    this.diagnostics = diagnostics;
  }
}

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

function sourceInputKind(file: File, source?: RepoScanInput['source']): ArchiveDiagnostics['inputKind'] {
  if (source?.sourceType === 'github-url' || source?.sourceType === 'github-public') return 'github-zipball';
  return file.name.toLowerCase().endsWith('.zip') ? 'user-uploaded-zip' : 'unknown';
}

function bytesToSignature(bytes: Uint8Array) {
  return Array.from(bytes.slice(0, 8)).map(byte => byte.toString(16).padStart(2, '0')).join(' ');
}

function asciiPrefix(bytes: Uint8Array) {
  return String.fromCharCode(...bytes.slice(0, 64)).trimStart().toLowerCase();
}

function startsWithZipMagic(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3]);
}

function classifyContent(bytes: Uint8Array): NonNullable<ArchiveDiagnostics['contentKind']> {
  const prefix = asciiPrefix(bytes);
  if (startsWithZipMagic(bytes)) return 'zip';
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (prefix.startsWith('<!doctype html') || prefix.startsWith('<html') || prefix.includes('<html')) return 'html';
  if (prefix.startsWith('{') || prefix.startsWith('[')) return 'json';
  if (/^[\s\S]{1,64}$/.test(prefix) && /[a-z0-9<>{}:[\]"'=\s]/i.test(prefix)) return 'text';
  return 'unknown';
}

async function readBlobBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error('Could not read archive bytes.'));
      reader.readAsArrayBuffer(blob);
    });
  }
  if (typeof Response !== 'undefined') {
    return new Response(blob).arrayBuffer();
  }
  throw new Error('Could not read archive bytes.');
}

function inspectArchiveBytes(file: File, raw: ArrayBuffer, source?: RepoScanInput['source']): ArchiveDiagnostics {
  const bytes = new Uint8Array(raw).slice(0, 64);
  const signature = bytesToSignature(bytes);
  let inputKind = sourceInputKind(file, source);
  const contentKind = classifyContent(bytes);
  const startsWithZip = startsWithZipMagic(bytes);

  if (contentKind === 'html' || contentKind === 'json') inputKind = 'html-error-response';
  else if (contentKind === 'gzip') inputKind = 'unsupported-archive';
  else if (!startsWithZip) inputKind = 'invalid-zip';

  return {
    inputKind,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type || undefined,
    requestedUrl: source?.archiveDiagnostics?.requestedUrl,
    finalUrl: source?.archiveDiagnostics?.finalUrl,
    responseStatus: source?.archiveDiagnostics?.responseStatus,
    contentType: source?.archiveDiagnostics?.contentType,
    startsWithZipMagic: startsWithZip,
    contentKind,
    signature,
  };
}

function assertZipDiagnostics(diagnostics: ArchiveDiagnostics) {
  if (diagnostics.inputKind === 'invalid-zip') {
    throw new ArchiveParseError('Input is not a ZIP archive.', diagnostics);
  }
  if (diagnostics.inputKind === 'html-error-response') {
    throw new ArchiveParseError('Input looks like an HTML or JSON error response saved as a ZIP.', diagnostics);
  }
  if (diagnostics.inputKind === 'unsupported-archive') {
    throw new ArchiveParseError('Input looks like an unsupported compressed archive instead of a ZIP.', diagnostics);
  }
}

function isMetadataArchivePath(path: string) {
  return path === '__MACOSX' || path.startsWith('__MACOSX/') || path.endsWith('/.DS_Store') || path === '.DS_Store';
}

function stripCommonRoot(path: string, prefix: string) {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function hasProjectRootSignal(paths: string[]) {
  return paths.some(path => /^(package\.json|README(?:\.md)?|vite\.config\.[tj]s|tsconfig\.json|src\/|tests?\/)/i.test(path));
}

function rootPrefixFor(paths: string[]) {
  const relevant = paths.map(normalizeZipPath).filter(path => path && !isMetadataArchivePath(path));
  if (relevant.length === 0) return '';
  const firstSegments = new Set(relevant.map(path => path.split('/')[0]).filter(Boolean));
  if (firstSegments.size !== 1) return '';
  const only = [...firstSegments][0];
  return relevant.every(path => path === only || path.startsWith(`${only}/`)) ? `${only}/` : '';
}

function stripArchiveRoots(rawPaths: string[]) {
  let paths = rawPaths.map(normalizeZipPath);
  for (let depth = 0; depth < 3; depth += 1) {
    const candidates = paths.filter(path => !isMetadataArchivePath(path));
    if (hasProjectRootSignal(candidates)) break;
    const prefix = rootPrefixFor(candidates);
    if (!prefix) break;
    paths = paths.map(path => stripCommonRoot(path, prefix));
  }
  return paths;
}

function topLevelFoldersFor(paths: string[]) {
  const folders = new Set<string>();
  for (const path of paths.map(normalizeZipPath).filter(Boolean)) {
    const first = path.split('/').filter(Boolean)[0];
    if (first && !isMetadataArchivePath(first)) folders.add(first);
  }
  return [...folders].slice(0, 12);
}

/**
 * Scan a ZIP file in-browser using JSZip.
 * We only read filenames + small text config files. We never execute code.
 */
export async function scanZipFile(file: File, source?: RepoScanInput['source']): Promise<RepoScanInput> {
  if (file.size > SCANNER_LIMITS.maxZipSizeBytes) {
    throw new ScannerValidationError('ZIP file is too large. ShipSeal accepts repository ZIP files up to 25 MB in this local prototype.');
  }

  const raw = typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : await readBlobBytes(file);
  const archiveDiagnostics = inspectArchiveBytes(file, raw, source);
  assertZipDiagnostics(archiveDiagnostics);

  const JSZip = (await import('jszip') as ZipModule).default;
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(raw);
  } catch (error) {
    throw new ArchiveParseError('ZIP parser could not read this archive.', {
      ...archiveDiagnostics,
      parseError: error instanceof Error ? error.name : 'UnknownError',
    });
  }
  const entries = Object.values(zip.files) as ZipEntryWithSize[];
  const fileEntries = entries.filter(entry => !entry.dir);
  archiveDiagnostics.zipEntryCount = entries.length;
  archiveDiagnostics.topLevelFolders = topLevelFoldersFor(entries.map(entry => entry.name));

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
  summary.archiveDiagnostics = archiveDiagnostics;
  summary.totalFilesFound = fileEntries.length;
  const normalizedNames = stripArchiveRoots(entries.map(entry => entry.name));
  const normalizedEntryPaths = new Map(entries.map((entry, index) => [entry.name, normalizedNames[index] || '']));

  for (const entry of entries) {
    const path = normalizedEntryPaths.get(entry.name) || '';
    if (!path) continue;
    if (isMetadataArchivePath(path)) continue;

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
      try {
        const txt = await entry.async('string');
        const readableBytes = txt.length;
        if (summary.readableTextBytesAnalyzed + readableBytes > SCANNER_LIMITS.maxTotalReadableTextBytes) {
          throw new ScannerValidationError('Repository contains too much readable text for local prototype scanning. Remove generated docs or large text artifacts and try again.');
        }
        textContents[path] = txt;
        summary.readableTextBytesAnalyzed += readableBytes;
      } catch (error) {
        if (error instanceof ScannerValidationError) throw error;
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
export function fallbackScan(file: File, diagnostics?: ArchiveDiagnostics): RepoScanInput {
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
      scanMode: 'limited-fallback',
      limited: true,
      limitationReason: 'ZIP parsing failed before repository contents could be fully analyzed.',
      archiveDiagnostics: diagnostics,
      totalFilesFound: files.length,
      filesAnalyzed: files.length,
      readableTextBytesAnalyzed: Object.values(textContents).reduce((total, text) => total + text.length, 0),
      warnings: [LIMITED_SCAN_WARNING],
    },
  };
}

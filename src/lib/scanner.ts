import type { RepoFileSummary, RepoScanInput, ScanSummary } from './types';
import { Reader, TextWriter, ZipReader, type FileEntry } from '@zip.js/zip.js';
import { finalizeRepositoryEvidence, selectRepositoryEvidence } from './repositoryEvidence';
import {
  SCANNER_LIMITS,
  ScannerValidationError,
  createEmptyScanSummary,
  getUnsafeZipPathReason,
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


function sourceInputKind(file: File, source?: RepoScanInput['source']): ArchiveDiagnostics['inputKind'] {
  if (source?.sourceType === 'github-url' || source?.sourceType === 'github-public' || source?.sourceType === 'github-app') return 'github-zipball';
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

class RandomAccessBlobReader extends Reader<Blob> {
  constructor(private readonly blob: Blob) {
    super(blob);
    this.size = blob.size;
  }

  async init() {
    this.size = this.blob.size;
  }

  async readUint8Array(index: number, length: number) {
    return new Uint8Array(await readBlobBytes(this.blob.slice(index, index + length)));
  }
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
 * Index a local ZIP through its central directory and decompress only selected
 * evidence. BlobReader uses random-access Blob slices, so archive size does not
 * become an equivalent browser ArrayBuffer. Imported code is never extracted or executed.
 */
export async function scanZipFile(file: File, source?: RepoScanInput['source'], signal?: AbortSignal): Promise<RepoScanInput> {
  if (file.size > SCANNER_LIMITS.maxZipSizeBytes) {
    throw new ScannerValidationError('ZIP file is too large. It exceeds ShipSeal’s 2 GB local archive safety ceiling.');
  }

  const raw = await readBlobBytes(file.slice(0, 64));
  const archiveDiagnostics = inspectArchiveBytes(file, raw, source);
  assertZipDiagnostics(archiveDiagnostics);
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');

  const zip = new ZipReader(new RandomAccessBlobReader(file), { checkSignature: true, strictness: 'strict' });
  let entries: Awaited<ReturnType<typeof zip.getEntries>>;
  try {
  try {
    entries = await zip.getEntries();
  } catch (error) {
    throw new ArchiveParseError('ZIP parser could not read this archive.', {
      ...archiveDiagnostics,
      parseError: error instanceof Error ? error.name : 'UnknownError',
    });
  }
  const fileEntries = entries.filter((entry): entry is FileEntry => 'getData' in entry);
  archiveDiagnostics.zipEntryCount = entries.length;
  archiveDiagnostics.topLevelFolders = topLevelFoldersFor(entries.map(entry => entry.filename));

  if (entries.length > SCANNER_LIMITS.maxArchiveEntryCount) {
    throw new ScannerValidationError(`ZIP contains more than ${SCANNER_LIMITS.maxArchiveEntryCount.toLocaleString()} entries, exceeding the archive safety ceiling.`);
  }

  for (const entry of entries) {
    const unsafeReason = getUnsafeZipPathReason(entry.filename);
    if (unsafeReason) throw new ScannerValidationError(unsafeReason);
    if (entry.symlink) throw new ScannerValidationError('ZIP contains symbolic links, which ShipSeal does not accept as repository evidence.');
    if (entry.encrypted) throw new ScannerValidationError('Encrypted ZIP entries cannot be safely inspected.');
    const unixType = (entry.externalFileAttributes >>> 16) & 0xf000;
    if (unixType && ![0x4000, 0x8000].includes(unixType)) throw new ScannerValidationError('ZIP contains a special filesystem entry that cannot be used as repository evidence.');
  }

  const totalDeclaredBytes = fileEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (totalDeclaredBytes > SCANNER_LIMITS.maxDeclaredUncompressedBytes) {
    throw new ScannerValidationError('ZIP declared uncompressed size exceeds ShipSeal’s 10 GB archive safety ceiling.');
  }
  if (totalDeclaredBytes > 1024 * 1024 && totalDeclaredBytes / Math.max(1, file.size) > SCANNER_LIMITS.maxCompressionRatio) {
    throw new ScannerValidationError('ZIP has a suspicious aggregate compression ratio and was rejected safely.');
  }
  for (const entry of fileEntries) {
    if (entry.uncompressedSize > SCANNER_LIMITS.maxArchiveEntryUncompressedBytes) {
      throw new ScannerValidationError('ZIP contains an entry larger than ShipSeal’s 512 MB per-entry safety ceiling.');
    }
    const compressed = Math.max(1, entry.compressedSize);
    if (entry.uncompressedSize > 1024 * 1024 && entry.uncompressedSize / compressed > SCANNER_LIMITS.maxCompressionRatio) {
      throw new ScannerValidationError('ZIP contains a suspicious compression ratio and was rejected safely.');
    }
  }

  const normalizedNames = stripArchiveRoots(entries.map(entry => entry.filename));
  const normalizedEntryPaths = new Map(entries.map((entry, index) => [entry, normalizedNames[index] || '']));
  const discovered = entries
    .map(entry => ({
      path: normalizedEntryPaths.get(entry) || '',
      size: entry.directory ? 0 : entry.uncompressedSize,
      isDir: entry.directory,
    }))
    .filter(entry => entry.path && !isMetadataArchivePath(entry.path));
  const selection = selectRepositoryEvidence(discovered);
  selection.summary.archiveDiagnostics = archiveDiagnostics;
  const selectedPaths = new Set(selection.selected.map(entry => entry.path));
  const textContents: Record<string, string> = {};
  for (const entry of fileEntries) {
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');
    const path = normalizedEntryPaths.get(entry) || '';
    if (!selectedPaths.has(path)) continue;
    try {
      textContents[path] = await entry.getData(new TextWriter(), { checkSignature: true });
    } catch {
      selection.summary.warnings.push(`Could not read ${path} as text; it was skipped.`);
    }
  }
  const repoName = file.name.replace(/\.zip$/i, '') || 'repository';
  return finalizeRepositoryEvidence(repoName, source || { sourceType: 'zip-upload' }, selection, textContents);
  } finally {
    await zip.close().catch(() => undefined);
  }
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

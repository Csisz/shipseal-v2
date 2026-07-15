import type { ScanSummary } from './types';

export const SCANNER_LIMITS = {
  maxZipSizeBytes: 25 * 1024 * 1024,
  maxFileCount: 5000,
  maxReadableTextFileSizeBytes: 300 * 1024,
  maxTotalReadableTextBytes: 5 * 1024 * 1024,
  maxPathLength: 240,
  maxGeneratedFolderDepth: 8,
} as const;

export const GENERATED_VENDOR_FOLDERS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'vendor',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  'tmp',
  'logs',
  '.turbo',
  '.cache',
  'out',
] as const;

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.tiff', '.svg',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.sqlite', '.sqlite3', '.db', '.lockdb',
]);

export class ScannerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScannerValidationError';
  }
}

/**
 * Canonical repository-path normalization used by the scanner and repository
 * evidence layers. Invalid absolute, null-byte, or parent-traversal paths are
 * rejected with an empty result instead of being turned into evidence.
 */
export function normalizeZipPath(path: string): string {
  if (!path || path.includes('\0')) return '';
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\')) return '';

  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') return '';
    parts.push(part);
  }
  return parts.join('/');
}

export function getUnsafeZipPathReason(rawPath: string): string | null {
  if (rawPath.includes('\0')) return 'File paths look unsafe: null bytes are not allowed in ZIP entries.';
  if (/^[a-zA-Z]:[\\/]/.test(rawPath)) return 'File paths look unsafe: drive-letter paths are not allowed.';
  if (rawPath.startsWith('/') || rawPath.startsWith('\\')) return 'File paths look unsafe: absolute paths are not allowed.';
  if (rawPath.length > SCANNER_LIMITS.maxPathLength) return `File paths look unsafe: paths longer than ${SCANNER_LIMITS.maxPathLength} characters are not allowed.`;

  const rawSegments = rawPath.replace(/\\/g, '/').split('/');
  if (rawSegments.some(part => part === '..')) return 'File paths look unsafe: parent-directory traversal is not allowed.';

  return null;
}

export function isGeneratedOrVendorPath(path: string): boolean {
  const parts = normalizeZipPath(path).split('/').filter(Boolean);
  return parts.some(part => GENERATED_VENDOR_FOLDERS.includes(part as typeof GENERATED_VENDOR_FOLDERS[number]));
}

export function generatedFolderName(path: string): string | null {
  const parts = normalizeZipPath(path).split('/').filter(Boolean);
  return parts.find(part => GENERATED_VENDOR_FOLDERS.includes(part as typeof GENERATED_VENDOR_FOLDERS[number])) || null;
}

export function isBinaryLikePath(path: string): boolean {
  const cleanPath = normalizeZipPath(path).toLowerCase();
  if (/\.(min)\.(js|css)$/.test(cleanPath)) return true;
  const dotIndex = cleanPath.lastIndexOf('.');
  const ext = dotIndex >= 0 ? cleanPath.slice(dotIndex) : '';
  return BINARY_EXTENSIONS.has(ext);
}

export function createEmptyScanSummary(): ScanSummary {
  return {
    scanMode: 'full',
    limited: false,
    totalFilesFound: 0,
    filesAnalyzed: 0,
    filesIgnored: 0,
    generatedVendorFilesIgnored: 0,
    binaryFilesIgnored: 0,
    readableTextBytesAnalyzed: 0,
    ignoredGeneratedFolders: [],
    warnings: [],
    limits: { ...SCANNER_LIMITS },
  };
}

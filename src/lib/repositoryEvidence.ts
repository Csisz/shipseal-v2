import {
  SCANNER_LIMITS,
  generatedFolderName,
  isBinaryLikePath,
  isGeneratedOrVendorPath,
  normalizeZipPath,
} from './scannerLimits.js';
import type { RepoFileSummary, RepoScanInput, ScanSourceMetadata, ScanSummary } from './types.js';

export const REPOSITORY_EVIDENCE_SELECTION_POLICY_VERSION = 'shipseal.evidence-selection.v1';

export interface DiscoveredRepositoryEntry {
  path: string;
  size: number;
  isDir?: boolean;
  objectId?: string;
}

export interface RepositoryEvidenceSelection {
  selected: DiscoveredRepositoryEntry[];
  represented: RepoFileSummary[];
  summary: ScanSummary;
}

const TEXT_EXTENSIONS = /\.(?:[cm]?[jt]sx?|py|rb|php|java|kt|kts|go|rs|swift|scala|cs|fs|fsx|c|cc|cpp|cxx|h|hpp|vue|svelte|astro|html?|css|scss|sass|less|mdx?|json|jsonc|ya?ml|toml|ini|cfg|conf|properties|xml|gradle|graphql|gql|sql|sh|bash|zsh|fish|ps1|bat|cmd|txt)$/i;
const IMPORTANT_BASENAMES = /^(?:readme(?:\.[^.]+)?|package\.json|pnpm-workspace\.yaml|yarn\.lock|pnpm-lock\.yaml|package-lock\.json|bun\.lockb?|deno\.jsonc?|tsconfig(?:\.[^.]+)?\.json|vite\.config\.[^.]+|next\.config\.[^.]+|requirements\.txt|pyproject\.toml|poetry\.lock|pom\.xml|build\.gradle(?:\.kts)?|go\.mod|cargo\.toml|composer\.json|gemfile|makefile|dockerfile|compose\.ya?ml|vercel\.json|netlify\.toml|codeowners|agents\.md|claude\.md|\.cursorrules|\.env\.example|\.gitignore)$/i;
const ARCHIVE_EXTENSIONS = /\.(?:zip|tar|tgz|gz|bz2|xz|rar|7z)$/i;

export function isReadableRepositoryText(path: string) {
  const normalized = normalizeZipPath(path);
  if (!normalized || isBinaryLikePath(normalized) || ARCHIVE_EXTENSIONS.test(normalized)) return false;
  const base = normalized.split('/').pop() || '';
  return IMPORTANT_BASENAMES.test(base)
    || TEXT_EXTENSIONS.test(base)
    || /^\.github\/workflows\//i.test(normalized)
    || /^\.cursor\/rules(?:\/|$)/i.test(normalized);
}

export function repositoryArea(path: string) {
  const parts = normalizeZipPath(path).split('/').filter(Boolean);
  if (parts.length <= 1) return '$root';
  const [first, second] = parts;
  if (/^(?:apps|packages|services|libs|libraries|crates|modules|projects)$/i.test(first) && second) return `${first}/${second}`;
  if (/^(?:src|test|tests|docs|documentation|infra|infrastructure|deploy|deployment|\.github)$/i.test(first)) return first;
  return first;
}

function evidencePriority(path: string) {
  const normalized = normalizeZipPath(path);
  const base = normalized.split('/').pop() || '';
  if (/^readme(?:\.[^.]+)?$/i.test(base)) return 0;
  if (/^(?:agents\.md|claude\.md|\.cursorrules)$/i.test(base) || /^\.cursor\/rules/i.test(normalized)) return 1;
  if (/^(?:package\.json|pnpm-workspace\.yaml|yarn\.lock|pnpm-lock\.yaml|package-lock\.json|bun\.lockb?|deno\.jsonc?|tsconfig(?:\.[^.]+)?\.json|vite\.config\.[^.]+|next\.config\.[^.]+|pyproject\.toml|requirements\.txt|pom\.xml|build\.gradle(?:\.kts)?|go\.mod|cargo\.toml|composer\.json|gemfile)$/i.test(base)) return 2;
  if (/^\.github\/workflows\//i.test(normalized) || /(?:^|\/)(?:dockerfile|compose\.ya?ml|vercel\.json|netlify\.toml)$/i.test(normalized)) return 3;
  if (/(?:^|\/)(?:test|tests|spec|specs)(?:\/|\.)/i.test(normalized) || /(?:\.test|\.spec)\.[^.]+$/i.test(base)) return 4;
  if (/^(?:docs|documentation)(?:\/|$)/i.test(normalized) || /(?:architecture|adr|design)/i.test(normalized)) return 5;
  if (/(?:^|\/)(?:index|main|app|server|client|cli)\.[^.]+$/i.test(normalized)) return 6;
  return 10;
}

function compareEvidence(left: DiscoveredRepositoryEntry, right: DiscoveredRepositoryEntry) {
  return evidencePriority(left.path) - evidencePriority(right.path)
    || left.path.localeCompare(right.path, 'en');
}

export function selectRepositoryEvidence(
  entries: DiscoveredRepositoryEntry[],
  options: { discoveryComplete?: boolean; maximumFiles?: number; maximumBytes?: number } = {},
): RepositoryEvidenceSelection {
  const summary = createEvidenceSummary();
  summary.discoveryComplete = options.discoveryComplete !== false;
  const normalized = entries
    .map(entry => ({ ...entry, path: normalizeZipPath(entry.path) }))
    .filter(entry => entry.path)
    .sort((left, right) => left.path.localeCompare(right.path, 'en'));
  const files = normalized.filter(entry => !entry.isDir);
  summary.totalFilesFound = files.length;
  summary.discoveredFiles = files.length;
  summary.discoveredDirectories = normalized.filter(entry => entry.isDir).length;

  const eligible: DiscoveredRepositoryEntry[] = [];
  const represented: RepoFileSummary[] = [];
  for (const entry of normalized) {
    if (entry.isDir) continue;
    const generated = isGeneratedOrVendorPath(entry.path);
    const binary = isBinaryLikePath(entry.path) || ARCHIVE_EXTENSIONS.test(entry.path);
    const oversized = !generated && !binary && isReadableRepositoryText(entry.path) && entry.size > SCANNER_LIMITS.maxReadableTextFileSizeBytes;
    if (generated) {
      summary.generatedVendorFilesIgnored += 1;
      const folder = generatedFolderName(entry.path);
      if (folder && !summary.ignoredGeneratedFolders.includes(folder)) summary.ignoredGeneratedFolders.push(folder);
    } else if (binary) summary.binaryFilesIgnored += 1;
    else if (oversized) summary.oversizedTextFilesIgnored += 1;
    else if (isReadableRepositoryText(entry.path)) eligible.push(entry);
  }
  summary.eligibleTextFiles = eligible.length;

  const maximumFiles = options.maximumFiles ?? SCANNER_LIMITS.maxSelectedTextFiles;
  const maximumBytes = options.maximumBytes ?? SCANNER_LIMITS.maxTotalReadableTextBytes;
  const selected: DiscoveredRepositoryEntry[] = [];
  const selectedPaths = new Set<string>();
  let declaredBytes = 0;
  const trySelect = (entry: DiscoveredRepositoryEntry) => {
    if (selectedPaths.has(entry.path) || selected.length >= maximumFiles) return false;
    if (declaredBytes + entry.size > maximumBytes && selected.length > 0) return false;
    selected.push(entry);
    selectedPaths.add(entry.path);
    declaredBytes += entry.size;
    return true;
  };
  // Establish the repository-level navigation and build contract before
  // package-level documentation can consume a bounded monorepo budget.
  for (const entry of eligible
    .filter(candidate => !candidate.path.includes('/') && evidencePriority(candidate.path) <= 3)
    .sort(compareEvidence)) trySelect(entry);
  for (const entry of eligible.filter(candidate => evidencePriority(candidate.path) <= 3).sort(compareEvidence)) trySelect(entry);

  const byArea = new Map<string, DiscoveredRepositoryEntry[]>();
  for (const entry of eligible.filter(candidate => !selectedPaths.has(candidate.path)).sort(compareEvidence)) {
    const area = repositoryArea(entry.path);
    const bucket = byArea.get(area) || [];
    bucket.push(entry);
    byArea.set(area, bucket);
  }
  const areas = [...byArea.keys()].sort((left, right) => left.localeCompare(right, 'en'));
  let round = 0;
  while (selected.length < maximumFiles) {
    let added = false;
    for (const area of areas) {
      const entry = byArea.get(area)?.[round];
      if (!entry) continue;
      if (trySelect(entry)) added = true;
      if (selected.length >= maximumFiles) break;
    }
    if (!added) break;
    round += 1;
  }

  const importantUnselected = eligible.filter(entry => evidencePriority(entry.path) <= 6 && !selectedPaths.has(entry.path));
  for (const entry of importantUnselected) {
    if (!trySelect(entry) && selected.length >= maximumFiles) break;
  }
  selected.sort(compareEvidence);

  summary.selectedTextFiles = selected.length;
  summary.budgetExcludedFiles = Math.max(0, eligible.length - selected.length);
  if (!summary.discoveryComplete) summary.boundedReasons.push('repository-discovery-incomplete');
  if (summary.budgetExcludedFiles > 0) summary.boundedReasons.push(selected.length >= maximumFiles ? 'selected-file-budget' : 'readable-byte-budget');
  summary.scanMode = summary.boundedReasons.length ? 'bounded' : 'full';
  summary.filesIgnored = summary.generatedVendorFilesIgnored + summary.binaryFilesIgnored + summary.oversizedTextFilesIgnored + summary.budgetExcludedFiles;
  summary.filesAnalyzed = selected.length;

  for (const entry of selected) represented.push({ path: entry.path, size: entry.size });
  const areaRepresentatives = files
    .filter(entry => !selectedPaths.has(entry.path) && !isGeneratedOrVendorPath(entry.path) && !isBinaryLikePath(entry.path))
    .sort(compareEvidence);
  const representedAreas = new Set(represented.map(entry => repositoryArea(entry.path)));
  for (const entry of areaRepresentatives) {
    const area = repositoryArea(entry.path);
    if (representedAreas.has(area)) continue;
    represented.push({ path: entry.path, size: entry.size });
    representedAreas.add(area);
    if (represented.length >= maximumFiles + 48) break;
  }
  summary.representedFiles = represented.length;
  return { selected, represented, summary };
}

export function finalizeRepositoryEvidence(
  repoName: string,
  source: ScanSourceMetadata,
  selection: RepositoryEvidenceSelection,
  textContents: Record<string, string>,
): RepoScanInput {
  const analyzedBytes = Object.values(textContents).reduce((sum, text) => sum + new TextEncoder().encode(text).byteLength, 0);
  selection.summary.analyzedTextFiles = Object.keys(textContents).length;
  selection.summary.analyzedTextBytes = analyzedBytes;
  selection.summary.readableTextBytesAnalyzed = analyzedBytes;
  selection.summary.filesAnalyzed = Object.keys(textContents).length;
  selection.summary.warnings = selection.summary.scanMode === 'bounded'
    ? ['Large repository evidence was selected deterministically within ShipSeal’s safe analysis budget.']
    : [];
  return { repoName, source, files: selection.represented, textContents, scanSummary: selection.summary };
}

function createEvidenceSummary(): ScanSummary {
  return {
    scanMode: 'full', limited: false, totalFilesFound: 0, discoveryComplete: true,
    discoveredFiles: 0, discoveredDirectories: 0, eligibleTextFiles: 0, selectedTextFiles: 0,
    analyzedTextFiles: 0, analyzedTextBytes: 0, generatedVendorFilesIgnored: 0,
    binaryFilesIgnored: 0, oversizedTextFilesIgnored: 0, budgetExcludedFiles: 0,
    boundedReasons: [], selectionPolicyVersion: REPOSITORY_EVIDENCE_SELECTION_POLICY_VERSION,
    representedFiles: 0, filesAnalyzed: 0, filesIgnored: 0, readableTextBytesAnalyzed: 0,
    ignoredGeneratedFolders: [], warnings: [], limits: { ...SCANNER_LIMITS },
  };
}

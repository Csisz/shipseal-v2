import { normalizeZipPath } from '../scannerLimits';
import type { RepoScanInput } from '../types';
import type {
  FileResponsibilityRecord,
  RepositoryIntelligenceEvidenceModel,
  RepositoryRelationship,
  RepositoryResponsibility,
  RepositorySymbol,
} from './evidence';
import {
  REPOSITORY_CONTEXT_BUNDLE_VERSION,
  REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION,
  selectRepositoryIntelligenceContext,
  stableContextFingerprint,
  type RepositoryContextCandidate,
  type RepositoryContextContentAvailability,
  type RepositoryContextSelectionPolicy,
  type RepositoryContextSelectionPolicyOverride,
  type RepositoryContextSelectionReason,
  type RepositoryContextSelectionResult,
  type RepositoryContextSelectionState,
  type RepositoryContextSourceCategory,
  type RepositoryContextUncoveredArea,
} from './contextSelection';

export interface RepositoryContextStructuralOutline {
  primaryResponsibility: RepositoryResponsibility;
  secondaryResponsibilities: RepositoryResponsibility[];
  declaredSymbols: Array<Pick<RepositorySymbol, 'name' | 'kind' | 'exported' | 'defaultExport' | 'startLine' | 'endLine'>>;
  namedExports: string[];
  defaultExportPresent: boolean;
  localImports: string[];
  localRelationships: Array<{ type: RepositoryRelationship['type']; targetPath: string }>;
  limitations: string[];
}

export interface PreparedRepositoryContextItem {
  path: string;
  selectionId: string;
  selectionOrder: number;
  state: RepositoryContextSelectionState;
  primaryResponsibility: RepositoryResponsibility;
  secondaryResponsibilities: RepositoryResponsibility[];
  supportingEvidenceIds: string[];
  selectionReasons: RepositoryContextSelectionReason[];
  priorityScore: number;
  sourceCategory: RepositoryContextSourceCategory;
  contentAvailability: RepositoryContextContentAvailability;
  originalReadableCharacters: number;
  normalizedReadableCharacters: number;
  includedCharacters: number;
  content?: string;
  contentFingerprint?: string;
  truncation: {
    truncated: boolean;
    strategy: RepositoryContextSelectionPolicy['truncationStrategy'] | 'none';
    omittedCharacters: number;
    includedLineRanges: Array<{ startLine: number; endLine: number }>;
  };
  structuralOutline?: RepositoryContextStructuralOutline;
  relatedSelectedFiles: string[];
  limitations: string[];
  sensitiveContent: {
    classification: RepositoryContextCandidate['sensitiveContent']['classification'];
    contentPermitted: boolean;
    redactionApplied: boolean;
    redactionKinds: Array<'environment-value' | 'credential-assignment' | 'private-key-material'>;
  };
}

export interface RepositoryContextCategoryCount {
  category: RepositoryContextSourceCategory;
  candidateCount: number;
  eligibleCount: number;
  selectedCount: number;
  includedCharacters: number;
}

export interface RepositoryContextResponsibilityCoverage {
  responsibility: RepositoryResponsibility;
  eligibleFileCount: number;
  selectedFileCount: number;
  selectedPaths: string[];
  state: 'covered' | 'uncovered-budget' | 'unavailable';
}

export interface RepositoryContextFolderCoverage {
  folderPath: string;
  eligibleFileCount: number;
  selectedFileCount: number;
  selectedPaths: string[];
  state: 'covered' | 'uncovered-budget' | 'unavailable' | 'insufficient-evidence';
}

export interface RepositoryContextFrameworkCoverage {
  framework: string;
  evidencePaths: string[];
  selectedPaths: string[];
  state: 'covered' | 'uncovered-budget' | 'unavailable';
}

export interface RepositoryContextDispositionSummary {
  path: string;
  state: Exclude<RepositoryContextSelectionState, 'selected' | 'selected-with-truncation' | 'supporting' | 'parse-limited'>;
  selectionReasons: RepositoryContextSelectionReason[];
  limitations: string[];
  contentAvailability: RepositoryContextContentAvailability;
}

export interface RepositoryIntelligenceContextBundle {
  version: typeof REPOSITORY_CONTEXT_BUNDLE_VERSION;
  repository: {
    name: string;
    sourceType?: NonNullable<RepoScanInput['source']>['sourceType'];
    fullName?: string;
    ref?: string;
  };
  selectionPolicyVersion: typeof REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION;
  policy: RepositoryContextSelectionPolicy;
  items: PreparedRepositoryContextItem[];
  dispositions: RepositoryContextDispositionSummary[];
  totalEligibleFiles: number;
  totalSelectedFiles: number;
  totalSourceCharactersAvailable: number;
  totalCharactersIncluded: number;
  categoryCounts: RepositoryContextCategoryCount[];
  responsibilityCoverage: RepositoryContextResponsibilityCoverage[];
  folderCoverage: RepositoryContextFolderCoverage[];
  frameworkCoverage: RepositoryContextFrameworkCoverage[];
  uncoveredAreas: RepositoryContextUncoveredArea[];
  limitations: string[];
  budget: {
    maximumSelectedFiles: number;
    maximumTotalCharacters: number;
    maximumCharactersPerFile: number;
    selectedFiles: number;
    includedCharacters: number;
    remainingFiles: number;
    remainingCharacters: number;
    selectedWithTruncation: number;
    supportingFiles: number;
    budgetRejectedFiles: number;
    criticalConfigurationCharacters: number;
    documentationInstructionCharacters: number;
  };
  fingerprint: string;
}

export interface PrepareRepositoryIntelligenceContextInput {
  scanInput: RepoScanInput;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  policy?: RepositoryContextSelectionPolicyOverride;
}

export interface PrepareSelectedRepositoryIntelligenceContextInput {
  scanInput: RepoScanInput;
  evidenceResult: RepositoryIntelligenceEvidenceModel;
  selection: RepositoryContextSelectionResult;
}

export function prepareRepositoryIntelligenceContext(
  input: PrepareRepositoryIntelligenceContextInput,
): RepositoryIntelligenceContextBundle {
  const selection = selectRepositoryIntelligenceContext(input);
  return prepareSelectedRepositoryIntelligenceContext({ ...input, selection });
}

export function prepareSelectedRepositoryIntelligenceContext({
  scanInput,
  evidenceResult,
  selection,
}: PrepareSelectedRepositoryIntelligenceContextInput): RepositoryIntelligenceContextBundle {
  const contents = new Map(Object.entries(scanInput.textContents)
    .map(([path, content]) => [normalizeZipPath(path), content] as const)
    .filter(([path]) => !!path));
  const files = new Map(evidenceResult.files.map(file => [file.path, file]));
  const selectedPaths = new Set(selection.selectedCandidates.map(candidate => candidate.path));
  const relatedSelected = selectedRelationshipIndex(evidenceResult.relationships, selectedPaths);
  const items: PreparedRepositoryContextItem[] = [];
  let remainingCharacters = selection.policy.maximumTotalCharacters;

  for (const candidate of selection.selectedCandidates) {
    const file = files.get(candidate.path);
    if (!file) continue;
    const rawContent = contents.get(candidate.path);
    const safety = sanitizeSelectedContent(rawContent || '', candidate);
    const normalizedContent = normalizeLineEndings(safety.content);
    const itemLimit = Math.max(0, Math.min(candidate.budgetedCharacterLimit, selection.policy.maximumCharactersPerFile, remainingCharacters));
    const prepared = truncateContent(normalizedContent, itemLimit, candidate.sourceCategory, selection.policy);
    remainingCharacters -= prepared.content.length;
    const limitations = sortedUnique([
      ...candidate.limitations,
      ...prepared.limitations,
      ...(safety.redactionKinds.length ? ['Sensitive-looking values were deterministically redacted before context preparation.'] : []),
    ]);
    const state = candidate.contentAvailability === 'parse-limited'
      ? 'parse-limited'
      : candidate.state === 'supporting' && !prepared.truncated
        ? 'supporting'
        : prepared.truncated ? 'selected-with-truncation' : 'selected';
    items.push({
      path: candidate.path,
      selectionId: candidate.selectionId,
      selectionOrder: candidate.selectionOrder || 0,
      state,
      primaryResponsibility: candidate.primaryResponsibility,
      secondaryResponsibilities: [...candidate.secondaryResponsibilities],
      supportingEvidenceIds: [...candidate.supportingEvidenceIds],
      selectionReasons: [...candidate.selectionReasons],
      priorityScore: candidate.priorityScore,
      sourceCategory: candidate.sourceCategory,
      contentAvailability: candidate.contentAvailability,
      originalReadableCharacters: candidate.originalReadableCharacters,
      normalizedReadableCharacters: normalizedContent.length,
      includedCharacters: prepared.content.length,
      content: prepared.content || undefined,
      contentFingerprint: prepared.content ? stableContextFingerprint(prepared.content) : undefined,
      truncation: {
        truncated: prepared.truncated,
        strategy: prepared.truncated ? selection.policy.truncationStrategy : 'none',
        omittedCharacters: prepared.omittedCharacters,
        includedLineRanges: prepared.includedLineRanges,
      },
      structuralOutline: isJsTsPath(candidate.path) ? structuralOutlineFor(file) : undefined,
      relatedSelectedFiles: relatedSelected.get(candidate.path) || [],
      limitations,
      sensitiveContent: {
        ...candidate.sensitiveContent,
        redactionApplied: safety.redactionKinds.length > 0,
        redactionKinds: safety.redactionKinds,
      },
    });
  }

  const orderedItems = items.sort((left, right) => left.selectionOrder - right.selectionOrder || left.path.localeCompare(right.path));
  const dispositions = selection.candidates
    .filter(candidate => candidate.selectionOrder === undefined)
    .map(candidate => ({
      path: candidate.path,
      state: candidate.state as RepositoryContextDispositionSummary['state'],
      selectionReasons: [...candidate.selectionReasons],
      limitations: [...candidate.limitations],
      contentAvailability: candidate.contentAvailability,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const categoryCounts = buildCategoryCounts(selection.candidates, orderedItems);
  const responsibilityCoverage = buildResponsibilityCoverage(selection.candidates, orderedItems);
  const folderCoverage = buildFolderCoverage(selection.candidates, orderedItems, evidenceResult);
  const frameworkCoverage = buildFrameworkCoverage(orderedItems, evidenceResult);
  const totalCharactersIncluded = orderedItems.reduce((total, item) => total + item.includedCharacters, 0);
  const limitations = sortedUnique([
    ...selection.limitations,
    ...orderedItems.flatMap(item => item.limitations),
  ]);
  const budget = {
    maximumSelectedFiles: selection.policy.maximumSelectedFiles,
    maximumTotalCharacters: selection.policy.maximumTotalCharacters,
    maximumCharactersPerFile: selection.policy.maximumCharactersPerFile,
    selectedFiles: orderedItems.length,
    includedCharacters: totalCharactersIncluded,
    remainingFiles: Math.max(0, selection.policy.maximumSelectedFiles - orderedItems.length),
    remainingCharacters: Math.max(0, selection.policy.maximumTotalCharacters - totalCharactersIncluded),
    selectedWithTruncation: orderedItems.filter(item => item.truncation.truncated).length,
    supportingFiles: orderedItems.filter(item => item.selectionReasons.includes('supporting-dependency')).length,
    budgetRejectedFiles: selection.candidates.filter(candidate => candidate.state === 'budget-rejected').length,
    criticalConfigurationCharacters: orderedItems.filter(item => ['manifest', 'configuration', 'ci'].includes(item.sourceCategory)
      || item.selectionReasons.includes('test-or-verification-configuration')).reduce((total, item) => total + item.includedCharacters, 0),
    documentationInstructionCharacters: orderedItems.filter(item => ['documentation', 'agent-instruction'].includes(item.sourceCategory))
      .reduce((total, item) => total + item.includedCharacters, 0),
  };
  const repository = repositoryIdentity(scanInput);
  const fingerprint = stableContextFingerprint({
    version: REPOSITORY_CONTEXT_BUNDLE_VERSION,
    repository,
    policy: selection.policy,
    items: orderedItems.map(item => ({
      path: item.path,
      selectionId: item.selectionId,
      state: item.state,
      contentFingerprint: item.contentFingerprint,
      truncation: item.truncation,
      outline: item.structuralOutline,
    })),
    dispositions,
    uncoveredAreas: selection.uncoveredAreas,
    limitations,
  });

  return {
    version: REPOSITORY_CONTEXT_BUNDLE_VERSION,
    repository,
    selectionPolicyVersion: REPOSITORY_CONTEXT_SELECTION_POLICY_VERSION,
    policy: { ...selection.policy, explicitPriorityPaths: [...selection.policy.explicitPriorityPaths] },
    items: orderedItems,
    dispositions,
    totalEligibleFiles: selection.candidates.filter(candidate => candidate.eligibleForSelection).length,
    totalSelectedFiles: orderedItems.length,
    totalSourceCharactersAvailable: selection.candidates
      .filter(candidate => candidate.eligibleForSelection && candidate.sensitiveContent.contentPermitted)
      .reduce((total, candidate) => total + candidate.originalReadableCharacters, 0),
    totalCharactersIncluded,
    categoryCounts,
    responsibilityCoverage,
    folderCoverage,
    frameworkCoverage,
    uncoveredAreas: selection.uncoveredAreas.map(area => ({ ...area, candidatePaths: [...area.candidatePaths] })),
    limitations,
    budget,
    fingerprint,
  };
}

function sanitizeSelectedContent(content: string, candidate: RepositoryContextCandidate) {
  const redactionKinds = new Set<PreparedRepositoryContextItem['sensitiveContent']['redactionKinds'][number]>();
  const lines = normalizeLineEndings(content).split('\n');
  let privateKeyBlock = false;
  const sanitized = lines.map(line => {
    if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(line)) {
      privateKeyBlock = true;
      redactionKinds.add('private-key-material');
      return '[REDACTED PRIVATE KEY MATERIAL]';
    }
    if (privateKeyBlock) {
      if (/-----END [A-Z0-9 ]*PRIVATE KEY-----/.test(line)) privateKeyBlock = false;
      redactionKinds.add('private-key-material');
      return '[REDACTED PRIVATE KEY MATERIAL]';
    }
    if (candidate.sensitiveContent.classification === 'environment-template') {
      const match = line.match(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=)(.*)$/);
      if (match && match[2].trim()) {
        redactionKinds.add('environment-value');
        return `${match[1]}<placeholder>`;
      }
      return line;
    }
    const assignment = line.match(/^(\s*(?:(?:export\s+)?(?:const|let|var)\s+)?[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Za-z0-9_]*\s*[:=]\s*)(.*)$/i);
    if (assignment && assignment[2].trim()) {
      redactionKinds.add('credential-assignment');
      return `${assignment[1]}[REDACTED]`;
    }
    const jsonAssignment = line.match(/^(\s*["'][^"']*(?:token|secret|password|api[_-]?key|private[_-]?key)[^"']*["']\s*:\s*)(.*?)(,?\s*)$/i);
    if (jsonAssignment && jsonAssignment[2].trim()) {
      redactionKinds.add('credential-assignment');
      return `${jsonAssignment[1]}"[REDACTED]"${jsonAssignment[3]}`;
    }
    const inlineAssignment = line.replace(/((?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)\s*=\s*)([^\s"'`,;]+)/gi, (_match, prefix) => {
      redactionKinds.add('credential-assignment');
      return `${prefix}[REDACTED]`;
    });
    return inlineAssignment;
  });
  return { content: sanitized.join('\n'), redactionKinds: [...redactionKinds].sort() };
}

function truncateContent(
  content: string,
  limit: number,
  category: RepositoryContextSourceCategory,
  policy: RepositoryContextSelectionPolicy,
) {
  if (!content || limit <= 0) return {
    content: '', truncated: content.length > 0, omittedCharacters: content.length,
    includedLineRanges: [] as Array<{ startLine: number; endLine: number }>,
    limitations: content.length ? ['No content characters fit within the remaining configured context budget.'] : [],
  };
  const lines = content.split('\n');
  if (content.length <= limit) return {
    content, truncated: false, omittedCharacters: 0,
    includedLineRanges: [{ startLine: 1, endLine: lines.length }], limitations: [] as string[],
  };
  const marker = omissionMarker(category, content.length - limit);
  if (limit <= marker.length + 2) return {
    content: content.slice(0, limit), truncated: true, omittedCharacters: content.length - limit,
    includedLineRanges: [{ startLine: 1, endLine: 1 }],
    limitations: ['The context cap was too small for line-aware truncation; a deterministic prefix was retained.'],
  };
  if (['manifest', 'configuration', 'documentation', 'agent-instruction', 'ci', 'environment-template'].includes(category)) {
    const head = takeHeadLines(lines, limit - marker.length - 1);
    const prepared = `${head.text}\n${marker}`.slice(0, limit);
    return {
      content: prepared,
      truncated: true,
      omittedCharacters: Math.max(0, content.length - head.sourceCharacters),
      includedLineRanges: head.lineCount ? [{ startLine: 1, endLine: head.lineCount }] : [],
      limitations: ['Content was truncated at a line boundary after the deterministic leading section.'],
    };
  }
  const available = limit - marker.length - 2;
  const head = takeHeadLines(lines, Math.floor(available / 2));
  const tail = takeTailLines(lines.slice(head.lineCount), available - head.text.length);
  const prepared = `${head.text}\n${marker}\n${tail.text}`.slice(0, limit);
  const tailStart = Math.max(head.lineCount + 1, lines.length - tail.lineCount + 1);
  return {
    content: prepared,
    truncated: true,
    omittedCharacters: Math.max(0, content.length - head.sourceCharacters - tail.sourceCharacters),
    includedLineRanges: [
      ...(head.lineCount ? [{ startLine: 1, endLine: head.lineCount }] : []),
      ...(tail.lineCount ? [{ startLine: tailStart, endLine: lines.length }] : []),
    ],
    limitations: [`Content was truncated with the ${policy.truncationStrategy} policy; omitted content is not evidence of absence.`],
  };
}

function takeHeadLines(lines: string[], budget: number) {
  const selected: string[] = [];
  let used = 0;
  for (const line of lines) {
    const cost = line.length + (selected.length ? 1 : 0);
    if (used + cost > budget) break;
    selected.push(line);
    used += cost;
  }
  return { text: selected.join('\n'), lineCount: selected.length, sourceCharacters: used };
}

function takeTailLines(lines: string[], budget: number) {
  const selected: string[] = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const cost = line.length + (selected.length ? 1 : 0);
    if (used + cost > budget) break;
    selected.unshift(line);
    used += cost;
  }
  return { text: selected.join('\n'), lineCount: selected.length, sourceCharacters: used };
}

function omissionMarker(category: RepositoryContextSourceCategory, omitted: number) {
  if (category === 'documentation' || category === 'agent-instruction') return `<!-- ShipSeal omitted bounded content (${omitted} characters estimated) -->`;
  return `// ShipSeal omitted bounded content (${omitted} characters estimated)`;
}

function structuralOutlineFor(file: FileResponsibilityRecord): RepositoryContextStructuralOutline {
  const relationships = file.relationships
    .filter(relationship => relationship.type !== 'contains')
    .map(relationship => ({ type: relationship.type, targetPath: relationship.targetPath }))
    .sort((left, right) => `${left.type}:${left.targetPath}`.localeCompare(`${right.type}:${right.targetPath}`));
  return {
    primaryResponsibility: file.primaryResponsibility,
    secondaryResponsibilities: [...file.secondaryResponsibilities].sort(),
    declaredSymbols: file.declaredSymbols.map(symbol => ({ ...symbol })).sort((left, right) => (left.startLine || 0) - (right.startLine || 0) || left.name.localeCompare(right.name)),
    namedExports: sortedUnique(file.declaredSymbols.filter(symbol => symbol.exported && !symbol.defaultExport).map(symbol => symbol.name)),
    defaultExportPresent: file.declaredSymbols.some(symbol => symbol.defaultExport),
    localImports: sortedUnique(file.relationships.filter(relationship => relationship.type === 'imports').map(relationship => relationship.targetPath)),
    localRelationships: relationships,
    limitations: [...file.limitations].sort(),
  };
}

function selectedRelationshipIndex(relationships: RepositoryRelationship[], selectedPaths: Set<string>) {
  const result = new Map<string, Set<string>>();
  for (const relationship of relationships) {
    if (!selectedPaths.has(relationship.sourcePath) || !selectedPaths.has(relationship.targetPath)) continue;
    if (!result.has(relationship.sourcePath)) result.set(relationship.sourcePath, new Set());
    if (!result.has(relationship.targetPath)) result.set(relationship.targetPath, new Set());
    result.get(relationship.sourcePath)!.add(relationship.targetPath);
    result.get(relationship.targetPath)!.add(relationship.sourcePath);
  }
  return new Map([...result.entries()].map(([path, related]) => [path, [...related].sort()]));
}

function buildCategoryCounts(candidates: RepositoryContextCandidate[], items: PreparedRepositoryContextItem[]) {
  const itemByPath = new Map(items.map(item => [item.path, item]));
  const categories = sortedUnique(candidates.map(candidate => candidate.sourceCategory));
  return categories.map(category => {
    const categoryCandidates = candidates.filter(candidate => candidate.sourceCategory === category);
    const selected = categoryCandidates.map(candidate => itemByPath.get(candidate.path)).filter(Boolean) as PreparedRepositoryContextItem[];
    return {
      category,
      candidateCount: categoryCandidates.length,
      eligibleCount: categoryCandidates.filter(candidate => candidate.eligibleForSelection).length,
      selectedCount: selected.length,
      includedCharacters: selected.reduce((total, item) => total + item.includedCharacters, 0),
    };
  });
}

function buildResponsibilityCoverage(candidates: RepositoryContextCandidate[], items: PreparedRepositoryContextItem[]) {
  const selectedPaths = new Set(items.map(item => item.path));
  const responsibilities = sortedUnique(candidates
    .filter(candidate => candidate.primaryResponsibility !== 'unknown-or-insufficient-evidence' && candidate.primaryResponsibility !== 'generated-or-vendor-content')
    .map(candidate => candidate.primaryResponsibility));
  return responsibilities.map(responsibility => {
    const eligible = candidates.filter(candidate => candidate.primaryResponsibility === responsibility && candidate.eligibleForSelection);
    const selected = eligible.filter(candidate => selectedPaths.has(candidate.path)).map(candidate => candidate.path).sort();
    return {
      responsibility,
      eligibleFileCount: eligible.length,
      selectedFileCount: selected.length,
      selectedPaths: selected,
      state: selected.length ? 'covered' as const : eligible.some(candidate => candidate.state === 'budget-rejected') ? 'uncovered-budget' as const : 'unavailable' as const,
    };
  });
}

function buildFolderCoverage(
  candidates: RepositoryContextCandidate[],
  items: PreparedRepositoryContextItem[],
  evidenceResult: RepositoryIntelligenceEvidenceModel,
) {
  const selectedPaths = new Set(items.map(item => item.path));
  const candidatesByFolder = new Map<string, RepositoryContextCandidate[]>();
  for (const candidate of candidates) {
    const parts = candidate.path.split('/');
    parts.pop();
    for (let index = 1; index <= parts.length; index += 1) {
      const folder = parts.slice(0, index).join('/');
      if (!candidatesByFolder.has(folder)) candidatesByFolder.set(folder, []);
      candidatesByFolder.get(folder)!.push(candidate);
    }
  }
  return evidenceResult.folders
    .filter(folder => folder.path !== '.' && !folder.generatedOrVendor)
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(folder => {
      const folderCandidates = candidatesByFolder.get(folder.path) || [];
      const eligible = folderCandidates.filter(candidate => candidate.eligibleForSelection);
      const selected = eligible.filter(candidate => selectedPaths.has(candidate.path)).map(candidate => candidate.path).sort();
      const state = selected.length ? 'covered' as const
        : !folder.dominantResponsibilities.length ? 'insufficient-evidence' as const
          : eligible.some(candidate => candidate.state === 'budget-rejected') ? 'uncovered-budget' as const
            : 'unavailable' as const;
      return { folderPath: folder.path, eligibleFileCount: eligible.length, selectedFileCount: selected.length, selectedPaths: selected, state };
    });
}

function buildFrameworkCoverage(items: PreparedRepositoryContextItem[], evidenceResult: RepositoryIntelligenceEvidenceModel) {
  const selectedPaths = new Set(items.map(item => item.path));
  const byFramework = new Map<string, Set<string>>();
  for (const evidence of evidenceResult.evidence) {
    const framework = evidence.category === 'stack' && typeof evidence.metadata?.framework === 'string' ? evidence.metadata.framework : undefined;
    if (!framework) continue;
    if (!byFramework.has(framework)) byFramework.set(framework, new Set());
    byFramework.get(framework)!.add(evidence.repositoryRelativePath);
  }
  return [...byFramework.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([framework, paths]) => {
    const evidencePaths = [...paths].sort();
    const selected = evidencePaths.filter(path => selectedPaths.has(path));
    return {
      framework,
      evidencePaths,
      selectedPaths: selected,
      state: selected.length ? 'covered' as const : evidencePaths.length ? 'uncovered-budget' as const : 'unavailable' as const,
    };
  });
}

function repositoryIdentity(scanInput: RepoScanInput): RepositoryIntelligenceContextBundle['repository'] {
  const owner = scanInput.source?.githubOwner;
  const repo = scanInput.source?.githubRepo;
  return {
    name: scanInput.repoName,
    sourceType: scanInput.source?.sourceType,
    fullName: owner && repo ? `${owner}/${repo}` : undefined,
    ref: scanInput.source?.githubBranch || scanInput.source?.githubDefaultBranch,
  };
}

function normalizeLineEndings(content: string) {
  return content.replace(/\r\n?/g, '\n');
}

function isJsTsPath(path: string) {
  return /\.[cm]?[jt]sx?$/i.test(path);
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

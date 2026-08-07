import { stableContextFingerprint } from '../../repositoryIntelligence/contextSelection.js';
import { normalizeZipPath } from '../../scannerLimits.js';
import type {
  RepositoryFutureConfidence,
  RepositoryFutureEvidenceReference,
  RepositoryFutureHumanReviewState,
  RepositoryFutureOrigin,
  RepositoryFutureUniverseMapping,
} from './schema.js';

export function repositoryFutureFingerprint(value: unknown) {
  return stableContextFingerprint(value);
}

export function repositoryFutureId(prefix: string, value: unknown) {
  return `${prefix}:${repositoryFutureFingerprint(value)}`;
}

export function normalizeRepositoryFuturePath(path: string | undefined) {
  return path ? normalizeZipPath(path) : '';
}

export function sortedUnique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function confidenceRank(confidence: RepositoryFutureConfidence) {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

export function lowerConfidence(left: RepositoryFutureConfidence, right: RepositoryFutureConfidence): RepositoryFutureConfidence {
  return confidenceRank(left) <= confidenceRank(right) ? left : right;
}

export function confidenceFromNumber(value: number): RepositoryFutureConfidence {
  if (Number.isFinite(value) && value >= 0.85) return 'high';
  if (Number.isFinite(value) && value >= 0.6) return 'medium';
  return 'low';
}

export function normalizeEvidenceReferences(values: readonly RepositoryFutureEvidenceReference[]) {
  const byId = new Map<string, RepositoryFutureEvidenceReference>();
  for (const value of values) {
    const id = value.id.trim();
    if (!id) continue;
    const path = normalizeRepositoryFuturePath(value.path);
    const normalized: RepositoryFutureEvidenceReference = {
      ...value,
      id,
      path: path || undefined,
      limitation: value.path && !path
        ? [value.limitation, 'Unsafe or non-repository-relative evidence path was omitted.'].filter(Boolean).join(' ')
        : value.limitation,
    };
    const existing = byId.get(id);
    if (!existing || confidenceRank(normalized.confidence) > confidenceRank(existing.confidence)) byId.set(id, normalized);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeUniverseMappings(values: readonly RepositoryFutureUniverseMapping[]) {
  const byId = new Map<string, RepositoryFutureUniverseMapping>();
  for (const value of values) {
    const universeNodeId = value.universeNodeId.trim();
    if (!universeNodeId) continue;
    const path = normalizeRepositoryFuturePath(value.repositoryRelativePath);
    byId.set(universeNodeId, { universeNodeId, repositoryRelativePath: path || undefined });
  }
  return [...byId.values()].sort((left, right) => left.universeNodeId.localeCompare(right.universeNodeId));
}

export function sensitiveFutureContent(values: readonly string[]) {
  return /(authentication|authorization|security|privacy|personal data|payment|billing|legal|compliance|deployment|production|ci\b|workflow|data handling|environment configuration|\.env)/i.test(values.join('\n'));
}

export function mergeHumanReviewState(
  left: RepositoryFutureHumanReviewState,
  right: RepositoryFutureHumanReviewState,
): RepositoryFutureHumanReviewState {
  return left === 'required' || right === 'required' ? 'required' : 'not-required';
}

export function originRank(origin: RepositoryFutureOrigin) {
  if (origin === 'deterministic') return 0;
  if (origin === 'verified-signal') return 1;
  return 2;
}

import type { ReadinessReport, ScanHistoryItem } from './types';

const STORAGE_KEY = 'agentready.scanHistory.v1';
const MAX_HISTORY = 5;

function safeParse(value: string | null): ScanHistoryItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item =>
        typeof item?.repositoryName === 'string' &&
        typeof item?.timestamp === 'string' &&
        typeof item?.score === 'number' &&
        typeof item?.status === 'string' &&
        typeof item?.criticalBlockerCount === 'number' &&
        typeof item?.mcpScore === 'number' &&
        typeof item?.mcpStatus === 'string'
      )
      .map(item => ({
        repositoryName: item.repositoryName,
        timestamp: item.timestamp,
        sourceType: item.sourceType === 'github-url' ? 'github-url' : item.sourceType === 'github-public' ? 'github-public' : item.sourceType === 'zip-upload' ? 'zip-upload' : undefined,
        githubOwner: typeof item.githubOwner === 'string' ? item.githubOwner : undefined,
        githubRepo: typeof item.githubRepo === 'string' ? item.githubRepo : undefined,
        githubBranch: typeof item.githubBranch === 'string' ? item.githubBranch : undefined,
        score: item.score,
        status: item.status,
        criticalBlockerCount: item.criticalBlockerCount,
        mcpScore: item.mcpScore,
        mcpStatus: item.mcpStatus,
      }))
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function getScanHistory(storage: Storage = window.localStorage): ScanHistoryItem[] {
  return safeParse(storage.getItem(STORAGE_KEY));
}

export function saveScanHistory(report: ReadinessReport, storage: Storage = window.localStorage): ScanHistoryItem[] {
  const item: ScanHistoryItem = {
    repositoryName: report.repoName,
    timestamp: report.scannedAt,
    sourceType: report.source.sourceType,
    githubOwner: report.source.githubOwner,
    githubRepo: report.source.githubRepo,
    githubBranch: report.source.githubBranch,
    score: report.score,
    status: report.level,
    criticalBlockerCount: report.blockers.length,
    mcpScore: report.mcpReadiness.score,
    mcpStatus: report.mcpReadiness.status,
  };

  const next = [
    item,
    ...getScanHistory(storage).filter(existing =>
      existing.repositoryName !== item.repositoryName || existing.timestamp !== item.timestamp
    ),
  ].slice(0, MAX_HISTORY);

  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearScanHistory(storage: Storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY);
}

export function scanHistoryStorageKey() {
  return STORAGE_KEY;
}

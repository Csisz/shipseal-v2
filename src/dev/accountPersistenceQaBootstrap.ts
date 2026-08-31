import type { PersistedProject, PersistedScanSummary } from '@/lib/persistence/schema';
import { buildSampleProjectReadinessReport, SAMPLE_PROJECT_REPO_INPUT } from '@/lib/demo/sampleReadiness';

const user = {
  id: `usr_${'a'.repeat(24)}`,
  email: 'owner@example.test',
  displayName: 'Repository Owner',
  avatarUrl: null,
};

const projectFixture: PersistedProject = {
  version: 'shipseal.persistence.v1',
  id: `prj_${'b'.repeat(24)}`,
  sourceType: 'github-public',
  repositoryOwner: 'Csisz',
  repositoryName: 'shipseal-v2-with-a-long-private-name',
  uploadLabel: null,
  defaultBranch: 'main',
  githubRepositoryId: null,
  githubInstallationId: null,
  displayName: 'shipseal-v2-with-a-long-private-name',
  createdAt: '2026-07-17T08:00:00.000Z',
  updatedAt: '2026-07-17T08:00:00.000Z',
  lastScanAt: '2026-07-17T08:00:00.000Z',
  archived: false,
  latestScanStatus: 'completed',
  latestIntelligenceMode: 'deterministic',
  latestVerificationState: 'not-started',
  scanCount: 1,
};

const scanFixture: PersistedScanSummary = {
  version: 'shipseal.persistence.v1',
  id: `scn_${'c'.repeat(24)}`,
  projectId: projectFixture.id,
  sourceType: 'github-public',
  repositoryOwner: 'Csisz',
  repositoryName: projectFixture.repositoryName,
  branch: 'feature/a-very-long-mobile-branch-name-for-responsive-acceptance',
  status: 'completed',
  startedAt: '2026-07-17T08:00:00.000Z',
  completedAt: '2026-07-17T08:00:00.000Z',
  scannerVersion: 'shipseal-browser-scanner.v1',
  deterministicRequestFingerprint: 'a'.repeat(32),
  discoveredFiles: 372,
  analyzedFiles: 359,
  ignoredFiles: 13,
  intelligenceMode: 'deterministic',
  verificationState: 'not-started',
  baselineScanId: null,
  safeFailureCategory: null,
};

let persistedProject = projectFixture;
let persistedScans: PersistedScanSummary[] = [scanFixture];
const persistedSnapshots = new Map<string, unknown>();
const scanByIdempotency = new Map<string, PersistedScanSummary>();
let failNextSave = new URLSearchParams(window.location.search).get('omega20Autosave') !== 'success';
const originalFetch = window.fetch.bind(window);
const usageState = new URLSearchParams(window.location.search).get('omega19Usage') || 'available';
const usage = usageState === 'free'
  ? {
    plan: 'free', entitlementStatus: 'active', capabilities: { repositoryFutures: false, executableFuturePlan: true },
    deepAnalysis: { limit: 0, used: 0, reserved: 0, remaining: 0, periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' },
  }
  : usageState === 'exhausted'
    ? {
      plan: 'pro', entitlementStatus: 'active', capabilities: { repositoryFutures: true, executableFuturePlan: true },
      deepAnalysis: { limit: 4, used: 4, reserved: 0, remaining: 0, periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' },
    }
    : {
      plan: 'pro', entitlementStatus: 'active', capabilities: { repositoryFutures: true, executableFuturePlan: true },
      deepAnalysis: { limit: 10, used: 3, reserved: 1, remaining: 6, periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' },
    };
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
}));

window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const path = url.startsWith(window.location.origin) ? new URL(url).pathname + new URL(url).search : url;
  const method = init.method || 'GET';
  if (path === '/api/account/session') return json({ user });
  if (path === '/api/account/usage') return json(usage);
  if (path.startsWith('/api/repository-intelligence?qaStage=') && method === 'POST') {
    return json({ status: 'ok', stage: new URL(path, window.location.origin).searchParams.get('qaStage') });
  }
  if (path === '/api/repository-evidence' && method === 'POST') {
    const request = JSON.parse(String(init.body || '{}')) as { owner?: string; repo?: string; ref?: string };
    const owner = request.owner || 'Csisz';
    const repo = request.repo || 'Cantu';
    const commitSha = 'a'.repeat(40);
    const scanSummary = buildSampleProjectReadinessReport().scanSummary;
    return json({
      scanInput: {
        ...structuredClone(SAMPLE_PROJECT_REPO_INPUT),
        repoName: repo,
        source: { sourceType: 'github-public', githubOwner: owner, githubRepo: repo, githubBranch: request.ref || 'main', githubDefaultBranch: 'main' },
        scanSummary: { ...structuredClone(scanSummary), sourceCommitSha: commitSha, sourceRequestCount: 7 },
      },
      commitSha,
      requestCount: 7,
    });
  }
  if (path === '/api/projects' && method === 'POST') {
    if (failNextSave) {
      failNextSave = false;
      return json({ error: { code: 'unavailable', message: 'Saving is temporarily unavailable.' } }, 503);
    }
    const request = JSON.parse(String(init.body)) as {
      idempotencyKey: string;
      project: Pick<PersistedProject, 'sourceType' | 'repositoryOwner' | 'repositoryName' | 'uploadLabel' | 'defaultBranch' | 'githubRepositoryId' | 'githubInstallationId' | 'displayName'>;
      scan: Pick<PersistedScanSummary, 'sourceType' | 'repositoryOwner' | 'repositoryName' | 'branch' | 'status' | 'startedAt' | 'completedAt' | 'scannerVersion' | 'deterministicRequestFingerprint' | 'discoveredFiles' | 'analyzedFiles' | 'ignoredFiles' | 'intelligenceMode' | 'safeFailureCategory'> & { snapshot?: unknown };
    };
    const existing = scanByIdempotency.get(request.idempotencyKey);
    if (existing) return json({ project: persistedProject, scan: existing }, 201);
    const id = `scn_${String(persistedScans.length + 1).padStart(24, 'd')}`;
    const { snapshot, ...scanSummaryInput } = request.scan;
    const savedScan: PersistedScanSummary = {
      version: 'shipseal.persistence.v1', id, projectId: persistedProject.id, ...scanSummaryInput,
      verificationState: 'not-started', baselineScanId: null,
    };
    persistedScans = [savedScan, ...persistedScans];
    scanByIdempotency.set(request.idempotencyKey, savedScan);
    persistedSnapshots.set(id, snapshot);
    persistedProject = {
      ...persistedProject,
      sourceType: request.project.sourceType,
      repositoryOwner: request.project.repositoryOwner,
      repositoryName: request.project.repositoryName,
      uploadLabel: request.project.uploadLabel,
      defaultBranch: request.project.defaultBranch,
      githubRepositoryId: request.project.githubRepositoryId,
      githubInstallationId: request.project.githubInstallationId,
      displayName: request.project.displayName,
      updatedAt: savedScan.completedAt || savedScan.startedAt,
      lastScanAt: savedScan.completedAt,
      latestScanStatus: savedScan.status,
      latestIntelligenceMode: savedScan.intelligenceMode,
      latestVerificationState: savedScan.verificationState,
      scanCount: persistedScans.length,
    };
    return json({ project: persistedProject, scan: savedScan }, 201);
  }
  if (path === '/api/projects?limit=50') return json({ projects: [persistedProject] });
  if (path === `/api/projects/${persistedProject.id}?scanLimit=50`) return json({ project: persistedProject, scans: persistedScans });
  const savedScanMatch = path.match(/^\/api\/scans\/([^?]+)$/);
  if (savedScanMatch && method === 'GET') {
    const savedScan = persistedScans.find(item => item.id === savedScanMatch[1]);
    if (savedScan) return json({ scan: savedScan, snapshot: persistedSnapshots.get(savedScan.id) });
  }
  if (method === 'DELETE' || (path === '/api/account/delete' && method === 'POST')) return json({ ok: true });
  return originalFetch(input, init);
};

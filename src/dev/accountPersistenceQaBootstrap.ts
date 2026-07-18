import type { PersistedProject, PersistedScanSummary } from '@/lib/persistence/schema';

const user = {
  id: `usr_${'a'.repeat(24)}`,
  email: 'owner@example.test',
  displayName: 'Repository Owner',
  avatarUrl: null,
};

const project: PersistedProject = {
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
};

const scan: PersistedScanSummary = {
  version: 'shipseal.persistence.v1',
  id: `scn_${'c'.repeat(24)}`,
  projectId: project.id,
  sourceType: 'github-public',
  repositoryOwner: 'Csisz',
  repositoryName: project.repositoryName,
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

let savedSnapshot: unknown;
let failNextSave = true;
const originalFetch = window.fetch.bind(window);
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
}));

window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const path = url.startsWith(window.location.origin) ? new URL(url).pathname + new URL(url).search : url;
  const method = init.method || 'GET';
  if (path === '/api/account/session') return json({ user });
  if (path === '/api/projects' && method === 'POST') {
    if (failNextSave) {
      failNextSave = false;
      return json({ error: { code: 'unavailable', message: 'Saving is temporarily unavailable.' } }, 503);
    }
    const request = JSON.parse(String(init.body)) as { scan?: { snapshot?: unknown } };
    savedSnapshot = request.scan?.snapshot;
    return json({ project, scan }, 201);
  }
  if (path === '/api/projects?limit=50') return json({ projects: [project] });
  if (path === `/api/projects/${project.id}?scanLimit=50`) return json({ project, scans: [scan] });
  if (path === `/api/scans/${scan.id}` && method === 'GET') return json({ scan, snapshot: savedSnapshot });
  if (method === 'DELETE' || (path === '/api/account/delete' && method === 'POST')) return json({ ok: true });
  return originalFetch(input, init);
};


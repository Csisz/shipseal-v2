import {
  persistedProjectSchema,
  persistedScanSummarySchema,
  persistedUserSchema,
  scanSnapshotSchema,
  saveProjectRequestSchema,
  type PersistedProject,
  type PersistedScanSnapshot,
  type PersistedScanSummary,
  type PersistedUser,
  type PersistenceApiErrorCode,
  type SaveProjectRequest,
} from './schema';

export class PersistenceClientError extends Error {
  constructor(public readonly code: PersistenceApiErrorCode, message: string, public readonly status: number) {
    super(message);
    this.name = 'PersistenceClientError';
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new PersistenceClientError('unavailable', 'Saved projects are temporarily unavailable.', 503);
  }
  const body = await response.json().catch(() => null) as { error?: { code?: PersistenceApiErrorCode; message?: string } } | null;
  if (!response.ok) throw new PersistenceClientError(body?.error?.code || 'unknown_error', body?.error?.message || 'The request could not be completed.', response.status);
  return body;
}

export async function getCurrentUser(): Promise<PersistedUser | null> {
  const body = await requestJson('/api/account/session') as { user?: unknown };
  return body.user ? persistedUserSchema.parse(body.user) : null;
}

export async function logoutAccount() {
  await requestJson('/api/account/logout', { method: 'POST', body: '{}' });
}

export async function listProjects(): Promise<PersistedProject[]> {
  const body = await requestJson('/api/projects?limit=50') as { projects?: unknown[] };
  return (body.projects || []).map(project => persistedProjectSchema.parse(project));
}

export async function saveProject(request: SaveProjectRequest): Promise<{ project: PersistedProject; scan: PersistedScanSummary }> {
  const safeRequest = saveProjectRequestSchema.parse(request);
  const body = await requestJson('/api/projects', { method: 'POST', body: JSON.stringify(safeRequest) }) as { project: unknown; scan: unknown };
  return { project: persistedProjectSchema.parse(body.project), scan: persistedScanSummarySchema.parse(body.scan) };
}

export async function getProject(projectId: string): Promise<{ project: PersistedProject; scans: PersistedScanSummary[] }> {
  const body = await requestJson(`/api/projects/${encodeURIComponent(projectId)}?scanLimit=50`) as { project: unknown; scans?: unknown[] };
  return { project: persistedProjectSchema.parse(body.project), scans: (body.scans || []).map(scan => persistedScanSummarySchema.parse(scan)) };
}

export async function getScan(scanId: string): Promise<{ scan: PersistedScanSummary; snapshot: PersistedScanSnapshot }> {
  const body = await requestJson(`/api/scans/${encodeURIComponent(scanId)}`) as { scan: unknown; snapshot: unknown };
  return { scan: persistedScanSummarySchema.parse(body.scan), snapshot: scanSnapshotSchema.parse(body.snapshot) };
}

export async function deleteScan(scanId: string) {
  await requestJson(`/api/scans/${encodeURIComponent(scanId)}`, { method: 'DELETE' });
}

export async function deleteProject(projectId: string) {
  await requestJson(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}

export async function deleteAccount(confirmation: string) {
  await requestJson('/api/account/delete', { method: 'POST', body: JSON.stringify({ confirmation }) });
}


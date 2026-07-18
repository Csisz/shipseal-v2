import {
  PERSISTENCE_SCHEMA_VERSION,
  persistedProjectSchema,
  persistedScanSummarySchema,
  scanSnapshotSchema,
  type PersistedProject,
  type PersistedScanSnapshot,
  type PersistedScanSummary,
  type PersistedUser,
  type SaveProjectRequest,
} from '../../src/lib/persistence/schema.js';
import { createPublicId, type AccountPersistenceStore, type OAuthIdentityInput, type SessionRecord } from './accountPersistence.js';

interface MemorySession { id: string; userId: string; tokenHash: string; expiresAt: string; createdAt: string; revoked: boolean }
interface MemoryScan { ownerId: string; summary: PersistedScanSummary; snapshot: PersistedScanSnapshot; idempotencyKey: string }
interface MemoryVerification { ownerId: string; projectId: string; baselineScanId: string; rescanId: string }

export class InMemoryAccountPersistenceStore implements AccountPersistenceStore {
  readonly users = new Map<string, PersistedUser & { providerSubject: string; deleted: boolean }>();
  readonly sessions = new Map<string, MemorySession>();
  readonly projects = new Map<string, PersistedProject & { ownerId: string; identity: string }>();
  readonly scans = new Map<string, MemoryScan>();
  readonly verifications: MemoryVerification[] = [];

  async upsertOAuthUser(input: OAuthIdentityInput) {
    const existing = [...this.users.values()].find(user => user.providerSubject === input.providerSubject && !user.deleted);
    if (existing) {
      Object.assign(existing, { email: input.email, displayName: input.displayName, avatarUrl: input.avatarUrl });
      return this.safeUser(existing);
    }
    const user = { id: createPublicId('usr'), providerSubject: input.providerSubject, email: input.email, displayName: input.displayName, avatarUrl: input.avatarUrl, deleted: false };
    this.users.set(user.id, user);
    return this.safeUser(user);
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: string; createdAt: string }) {
    if (!this.users.get(input.userId) || this.users.get(input.userId)?.deleted) throw new Error('User not found.');
    this.sessions.set(input.tokenHash, { id: createPublicId('ses'), userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt, createdAt: input.createdAt, revoked: false });
  }

  async getSession(tokenHash: string, now: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    const user = session ? this.users.get(session.userId) : null;
    return session && user && !user.deleted && !session.revoked && session.expiresAt > now
      ? { id: session.id, user: this.safeUser(user), expiresAt: session.expiresAt, createdAt: session.createdAt }
      : null;
  }

  async revokeSession(tokenHash: string) { const session = this.sessions.get(tokenHash); if (session) session.revoked = true; }

  async saveProjectAndScan(userId: string, input: SaveProjectRequest) {
    const identity = this.identity(input);
    let project = [...this.projects.values()].find(item => item.ownerId === userId && item.identity === identity);
    const duplicate = project && [...this.scans.values()].find(item => item.ownerId === userId && item.summary.projectId === project?.id && item.idempotencyKey === input.idempotencyKey);
    if (project && duplicate) return { project: this.safeProject(project), scan: duplicate.summary };
    const now = new Date().toISOString();
    if (!project) {
      project = persistedProjectSchema.parse({
        version: PERSISTENCE_SCHEMA_VERSION, id: createPublicId('prj'), ...input.project,
        createdAt: now, updatedAt: now, lastScanAt: input.scan.completedAt, archived: false,
        latestScanStatus: input.scan.status, latestIntelligenceMode: input.scan.intelligenceMode,
        latestVerificationState: input.scan.verificationRelationship?.state || 'not-started',
      }) as PersistedProject & { ownerId: string; identity: string };
      Object.assign(project, { ownerId: userId, identity });
      this.projects.set(project.id, project);
    } else {
      Object.assign(project, {
        displayName: input.project.displayName, defaultBranch: input.project.defaultBranch,
        githubRepositoryId: input.project.githubRepositoryId, githubInstallationId: input.project.githubInstallationId,
        updatedAt: now, lastScanAt: input.scan.completedAt, latestScanStatus: input.scan.status,
        latestIntelligenceMode: input.scan.intelligenceMode,
        latestVerificationState: input.scan.verificationRelationship?.state || 'not-started',
      });
    }
    const scan = persistedScanSummarySchema.parse({
      version: PERSISTENCE_SCHEMA_VERSION, id: createPublicId('scn'), projectId: project.id,
      sourceType: input.scan.sourceType, repositoryOwner: input.scan.repositoryOwner, repositoryName: input.scan.repositoryName,
      branch: input.scan.branch, status: input.scan.status, startedAt: input.scan.startedAt, completedAt: input.scan.completedAt,
      scannerVersion: input.scan.scannerVersion, deterministicRequestFingerprint: input.scan.deterministicRequestFingerprint,
      discoveredFiles: input.scan.discoveredFiles, analyzedFiles: input.scan.analyzedFiles, ignoredFiles: input.scan.ignoredFiles,
      intelligenceMode: input.scan.intelligenceMode, verificationState: input.scan.verificationRelationship?.state || 'not-started',
      baselineScanId: input.scan.verificationRelationship?.baselineScanId || null, safeFailureCategory: input.scan.safeFailureCategory,
    });
    this.scans.set(scan.id, { ownerId: userId, summary: scan, snapshot: scanSnapshotSchema.parse(input.scan.snapshot), idempotencyKey: input.idempotencyKey });
    if (input.scan.verificationRelationship) this.verifications.push({ ownerId: userId, projectId: project.id, baselineScanId: input.scan.verificationRelationship.baselineScanId, rescanId: scan.id });
    return { project: this.safeProject(project), scan };
  }

  async listProjects(userId: string, limit: number, offset: number) {
    return [...this.projects.values()].filter(project => project.ownerId === userId).sort((a, b) => (b.lastScanAt || b.createdAt).localeCompare(a.lastScanAt || a.createdAt) || a.id.localeCompare(b.id)).slice(offset, offset + limit).map(project => this.safeProject(project));
  }

  async getProject(userId: string, projectId: string) { const project = this.projects.get(projectId); return project?.ownerId === userId ? this.safeProject(project) : null; }

  async updateProject(userId: string, projectId: string, input: { displayName?: string; defaultBranch?: string | null; archived?: boolean }) {
    const project = this.projects.get(projectId);
    if (!project || project.ownerId !== userId) return null;
    if (input.displayName !== undefined) project.displayName = input.displayName;
    if (input.defaultBranch !== undefined) project.defaultBranch = input.defaultBranch;
    if (input.archived !== undefined) project.archived = input.archived;
    project.updatedAt = new Date().toISOString();
    return this.safeProject(project);
  }

  async listScans(userId: string, projectId: string, limit: number, offset: number) {
    if (this.projects.get(projectId)?.ownerId !== userId) return [];
    return [...this.scans.values()].filter(scan => scan.ownerId === userId && scan.summary.projectId === projectId).map(scan => scan.summary).sort((a, b) => (b.completedAt || b.startedAt).localeCompare(a.completedAt || a.startedAt) || a.id.localeCompare(b.id)).slice(offset, offset + limit);
  }

  async getScan(userId: string, scanId: string) {
    const scan = this.scans.get(scanId);
    return scan?.ownerId === userId ? { scan: scan.summary, snapshot: scan.snapshot } : null;
  }

  async deleteScan(userId: string, scanId: string) {
    const scan = this.scans.get(scanId);
    if (!scan || scan.ownerId !== userId) return false;
    this.scans.delete(scanId);
    for (let index = this.verifications.length - 1; index >= 0; index -= 1) if (this.verifications[index].ownerId === userId && (this.verifications[index].baselineScanId === scanId || this.verifications[index].rescanId === scanId)) this.verifications.splice(index, 1);
    const project = this.projects.get(scan.summary.projectId);
    if (project) {
      const remaining = await this.listScans(userId, project.id, 1, 0);
      project.lastScanAt = remaining[0]?.completedAt || null;
      project.latestScanStatus = remaining[0]?.status || null;
      project.latestIntelligenceMode = remaining[0]?.intelligenceMode || null;
      project.latestVerificationState = remaining[0]?.verificationState || null;
    }
    return true;
  }

  async deleteProject(userId: string, projectId: string) {
    if (this.projects.get(projectId)?.ownerId !== userId) return false;
    this.projects.delete(projectId);
    for (const [id, scan] of this.scans) if (scan.ownerId === userId && scan.summary.projectId === projectId) this.scans.delete(id);
    for (let index = this.verifications.length - 1; index >= 0; index -= 1) if (this.verifications[index].ownerId === userId && this.verifications[index].projectId === projectId) this.verifications.splice(index, 1);
    return true;
  }

  async deleteAccount(userId: string) {
    const user = this.users.get(userId);
    if (!user || user.deleted) return false;
    for (const project of [...this.projects.values()]) if (project.ownerId === userId) await this.deleteProject(userId, project.id);
    for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash);
    Object.assign(user, { email: null, displayName: null, avatarUrl: null, providerSubject: `deleted:${user.id}`, deleted: true });
    return true;
  }

  private safeUser(user: PersistedUser) { return { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl }; }
  private safeProject(project: PersistedProject & { ownerId?: string; identity?: string }) {
    const { ownerId: _ownerId, identity: _identity, ...safe } = project;
    return persistedProjectSchema.parse(safe);
  }
  private identity(input: SaveProjectRequest) { return input.project.repositoryOwner && input.project.repositoryName ? `github:${input.project.repositoryOwner.toLowerCase()}/${input.project.repositoryName.toLowerCase()}` : `upload:${(input.project.uploadLabel || input.project.displayName).toLowerCase()}`; }
}

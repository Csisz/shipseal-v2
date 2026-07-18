import { randomBytes } from 'node:crypto';
import postgres, { type JSONValue, type Sql } from 'postgres';
import {
  PERSISTENCE_SCHEMA_VERSION,
  SCAN_SNAPSHOT_SCHEMA_VERSION,
  VERIFICATION_RELATIONSHIP_SCHEMA_VERSION,
  persistedProjectSchema,
  persistedScanSummarySchema,
  persistedUserSchema,
  scanSnapshotSchema,
  validateSafeDerivedJson,
  type SafeDerivedJson,
  type PersistedProject,
  type PersistedScanSnapshot,
  type PersistedScanSummary,
  type PersistedUser,
  type SaveProjectRequest,
} from '../../src/lib/persistence/schema.js';

export interface OAuthIdentityInput {
  providerSubject: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface SessionRecord {
  id: string;
  user: PersistedUser;
  expiresAt: string;
  createdAt: string;
}

export interface AccountPersistenceStore {
  upsertOAuthUser(input: OAuthIdentityInput): Promise<PersistedUser>;
  createSession(input: { userId: string; tokenHash: string; expiresAt: string; createdAt: string }): Promise<void>;
  getSession(tokenHash: string, now: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
  saveProjectAndScan(userId: string, input: SaveProjectRequest): Promise<{ project: PersistedProject; scan: PersistedScanSummary }>;
  listProjects(userId: string, limit: number, offset: number): Promise<PersistedProject[]>;
  getProject(userId: string, projectId: string): Promise<PersistedProject | null>;
  updateProject(userId: string, projectId: string, input: { displayName?: string; defaultBranch?: string | null; archived?: boolean }): Promise<PersistedProject | null>;
  listScans(userId: string, projectId: string, limit: number, offset: number): Promise<PersistedScanSummary[]>;
  getScan(userId: string, scanId: string): Promise<{ scan: PersistedScanSummary; snapshot: PersistedScanSnapshot } | null>;
  deleteScan(userId: string, scanId: string): Promise<boolean>;
  deleteProject(userId: string, projectId: string): Promise<boolean>;
  deleteAccount(userId: string): Promise<boolean>;
  close?(): Promise<void>;
}

export class PersistenceUnavailableError extends Error {
  constructor(message = 'Project persistence is unavailable.') {
    super(message);
    this.name = 'PersistenceUnavailableError';
  }
}

export class PersistenceConflictError extends Error {
  constructor(message = 'The persistence request conflicts with an existing record.') {
    super(message);
    this.name = 'PersistenceConflictError';
  }
}

export function createPublicId(prefix: 'usr' | 'ses' | 'prj' | 'scn' | 'ver' | 'idem') {
  return `${prefix}_${randomBytes(18).toString('base64url')}`;
}

function asDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function nullable(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function databaseIdentifier(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{20,80}$/.test(value)) {
    throw new PersistenceConflictError(`Stored ${label} identifier is invalid.`);
  }
  return value;
}

export function serializeSafeDatabaseJson(value: unknown): JSONValue {
  if (!validateSafeDerivedJson(value)) {
    throw new PersistenceConflictError('Persistence snapshot contains a value that cannot be stored safely.');
  }
  return serializeValidatedJson(value);
}

function serializeValidatedJson(value: SafeDerivedJson): JSONValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(serializeValidatedJson);
  const serialized: Record<string, JSONValue> = {};
  for (const [key, item] of Object.entries(value)) serialized[key] = serializeValidatedJson(item);
  return serialized;
}

function mapUser(row: Record<string, unknown>): PersistedUser {
  return persistedUserSchema.parse({ id: row.id, email: nullable(row.email), displayName: nullable(row.display_name), avatarUrl: nullable(row.avatar_url) });
}

function mapProject(row: Record<string, unknown>): PersistedProject {
  return persistedProjectSchema.parse({
    version: PERSISTENCE_SCHEMA_VERSION,
    id: row.id,
    sourceType: row.source_type,
    repositoryOwner: nullable(row.repository_owner),
    repositoryName: nullable(row.repository_name),
    uploadLabel: nullable(row.upload_label),
    defaultBranch: nullable(row.default_branch),
    githubRepositoryId: nullable(row.github_repository_id),
    githubInstallationId: nullable(row.github_installation_id),
    displayName: row.display_name,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    lastScanAt: row.last_scan_at ? asDate(row.last_scan_at) : null,
    archived: row.archived,
    latestScanStatus: nullable(row.latest_scan_status),
    latestIntelligenceMode: nullable(row.latest_intelligence_mode),
    latestVerificationState: nullable(row.latest_verification_state),
  });
}

function mapScan(row: Record<string, unknown>): PersistedScanSummary {
  return persistedScanSummarySchema.parse({
    version: PERSISTENCE_SCHEMA_VERSION,
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    repositoryOwner: nullable(row.repository_owner),
    repositoryName: nullable(row.repository_name),
    branch: nullable(row.branch),
    status: row.status,
    startedAt: asDate(row.started_at),
    completedAt: row.completed_at ? asDate(row.completed_at) : null,
    scannerVersion: row.scanner_version,
    deterministicRequestFingerprint: row.deterministic_request_fingerprint,
    discoveredFiles: Number(row.discovered_files),
    analyzedFiles: Number(row.analyzed_files),
    ignoredFiles: Number(row.ignored_files),
    intelligenceMode: row.intelligence_mode,
    verificationState: row.verification_state,
    baselineScanId: nullable(row.baseline_scan_id),
    safeFailureCategory: nullable(row.safe_failure_category),
  });
}

export class PostgresAccountPersistenceStore implements AccountPersistenceStore {
  constructor(private readonly sql: Sql) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env) {
    const connectionString = (env.DATABASE_URL || '').trim();
    if (!connectionString) throw new PersistenceUnavailableError('DATABASE_URL is not configured.');
    if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new PersistenceUnavailableError('DATABASE_URL must be a PostgreSQL connection string.');
    return new PostgresAccountPersistenceStore(postgres(connectionString, { max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false }));
  }

  async upsertOAuthUser(input: OAuthIdentityInput) {
    const now = new Date().toISOString();
    const id = createPublicId('usr');
    const [row] = await this.sql<Record<string, unknown>[]>`
      insert into shipseal_users (id, auth_provider, provider_subject, email, display_name, avatar_url, created_at, updated_at)
      values (${id}, 'github', ${input.providerSubject}, ${input.email}, ${input.displayName}, ${input.avatarUrl}, ${now}, ${now})
      on conflict (auth_provider, provider_subject) do update set
        email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at
      returning *
    `;
    return mapUser(row);
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: string; createdAt: string }) {
    await this.sql`insert into shipseal_sessions (id, user_id, token_hash, created_at, expires_at)
      values (${createPublicId('ses')}, ${input.userId}, ${input.tokenHash}, ${input.createdAt}, ${input.expiresAt})`;
  }

  async getSession(tokenHash: string, now: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      select s.id as session_id, s.created_at as session_created_at, s.expires_at, u.*
      from shipseal_sessions s join shipseal_users u on u.id = s.user_id
      where s.token_hash = ${tokenHash} and s.revoked_at is null and s.expires_at > ${now} and u.deleted_at is null
      limit 1
    `;
    return row ? { id: String(row.session_id), user: mapUser(row), expiresAt: asDate(row.expires_at), createdAt: asDate(row.session_created_at) } : null;
  }

  async revokeSession(tokenHash: string) {
    await this.sql`update shipseal_sessions set revoked_at = now() where token_hash = ${tokenHash} and revoked_at is null`;
  }

  async saveProjectAndScan(userId: string, input: SaveProjectRequest) {
    return this.sql.begin(async transaction => {
      const existing = await transaction<Record<string, unknown>[]>`
        select p.*, s.id as saved_scan_id from shipseal_projects p
        left join shipseal_scans s on s.project_id = p.id and s.idempotency_key = ${input.idempotencyKey}
        where p.owner_user_id = ${userId}
          and p.deleted_at is null
          and p.repository_identity = ${projectIdentity(input)}
        limit 1
      `;
      if (existing[0]?.saved_scan_id) {
        const savedScanId = databaseIdentifier(existing[0].saved_scan_id, 'scan');
        const saved = await transaction<Record<string, unknown>[]>`select * from shipseal_scans where id = ${savedScanId}`;
        return { project: mapProject(existing[0]), scan: mapScan(saved[0]) };
      }

      const projectId = existing[0] ? databaseIdentifier(existing[0].id, 'project') : createPublicId('prj');
      const now = new Date().toISOString();
      const [projectRow] = await transaction<Record<string, unknown>[]>`
        insert into shipseal_projects (
          id, owner_user_id, schema_version, source_type, repository_identity, repository_owner, repository_name,
          upload_label, default_branch, github_repository_id, github_installation_id, display_name, created_at, updated_at, last_scan_at
        ) values (
          ${projectId}, ${userId}, ${PERSISTENCE_SCHEMA_VERSION}, ${input.project.sourceType}, ${projectIdentity(input)},
          ${input.project.repositoryOwner}, ${input.project.repositoryName}, ${input.project.uploadLabel}, ${input.project.defaultBranch},
          ${input.project.githubRepositoryId}, ${input.project.githubInstallationId}, ${input.project.displayName}, ${now}, ${now}, ${input.scan.completedAt}
        ) on conflict (owner_user_id, repository_identity) where deleted_at is null do update set
          display_name = excluded.display_name,
          default_branch = excluded.default_branch,
          github_repository_id = excluded.github_repository_id,
          github_installation_id = excluded.github_installation_id,
          updated_at = excluded.updated_at,
          last_scan_at = excluded.last_scan_at
        returning *
      `;
      const storedProjectId = databaseIdentifier(projectRow.id, 'project');
      const scanId = createPublicId('scn');
      const verificationState = input.scan.verificationRelationship?.state || 'not-started';
      const [scanRow] = await transaction<Record<string, unknown>[]>`
        insert into shipseal_scans (
          id, project_id, owner_user_id, schema_version, snapshot_schema_version, idempotency_key, source_type,
          repository_owner, repository_name, branch, status, started_at, completed_at, scanner_version,
          deterministic_request_fingerprint, discovered_files, analyzed_files, ignored_files, intelligence_mode,
          verification_state, baseline_scan_id, safe_failure_category, snapshot
        ) values (
          ${scanId}, ${storedProjectId}, ${userId}, ${PERSISTENCE_SCHEMA_VERSION}, ${SCAN_SNAPSHOT_SCHEMA_VERSION}, ${input.idempotencyKey},
          ${input.scan.sourceType}, ${input.scan.repositoryOwner}, ${input.scan.repositoryName}, ${input.scan.branch}, ${input.scan.status},
          ${input.scan.startedAt}, ${input.scan.completedAt}, ${input.scan.scannerVersion}, ${input.scan.deterministicRequestFingerprint},
          ${input.scan.discoveredFiles}, ${input.scan.analyzedFiles}, ${input.scan.ignoredFiles}, ${input.scan.intelligenceMode},
          ${verificationState}, ${input.scan.verificationRelationship?.baselineScanId || null}, ${input.scan.safeFailureCategory},
          ${this.sql.json(serializeSafeDatabaseJson(input.scan.snapshot))}
        ) returning *
      `;
      if (input.scan.verificationRelationship) {
        await transaction`insert into shipseal_verification_relationships (
          id, owner_user_id, project_id, baseline_scan_id, rescan_id, schema_version, algorithm_version,
          state, verified_at, expected_artifact_ids, created_at
        ) values (
          ${createPublicId('ver')}, ${userId}, ${storedProjectId}, ${input.scan.verificationRelationship.baselineScanId}, ${scanId},
          ${VERIFICATION_RELATIONSHIP_SCHEMA_VERSION}, ${input.scan.verificationRelationship.algorithmVersion},
          ${input.scan.verificationRelationship.state}, ${input.scan.verificationRelationship.verifiedAt},
          ${this.sql.json(serializeSafeDatabaseJson(input.scan.verificationRelationship.expectedArtifactIds))}, ${now}
        )`;
      }
      return { project: mapProject({ ...projectRow, last_scan_at: input.scan.completedAt }), scan: mapScan(scanRow) };
    });
  }

  async listProjects(userId: string, limit: number, offset: number) {
    const rows = await this.sql<Record<string, unknown>[]>`
      select p.*,
        latest.status as latest_scan_status,
        latest.intelligence_mode as latest_intelligence_mode,
        latest.verification_state as latest_verification_state
      from shipseal_projects p
      left join lateral (
        select status, intelligence_mode, verification_state from shipseal_scans s
        where s.project_id = p.id order by s.completed_at desc nulls last, s.created_at desc limit 1
      ) latest on true
      where p.owner_user_id = ${userId} and p.deleted_at is null
      order by p.last_scan_at desc nulls last, p.created_at desc, p.id asc
      limit ${limit} offset ${offset}
    `;
    return rows.map(mapProject);
  }

  async getProject(userId: string, projectId: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      select p.* from shipseal_projects p where p.id = ${projectId} and p.owner_user_id = ${userId} and p.deleted_at is null limit 1
    `;
    return row ? mapProject(row) : null;
  }

  async updateProject(userId: string, projectId: string, input: { displayName?: string; defaultBranch?: string | null; archived?: boolean }) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      update shipseal_projects set
        display_name = coalesce(${input.displayName || null}, display_name),
        default_branch = case when ${input.defaultBranch === undefined} then default_branch else ${input.defaultBranch ?? null} end,
        archived = coalesce(${input.archived ?? null}, archived),
        updated_at = now()
      where id = ${projectId} and owner_user_id = ${userId} and deleted_at is null returning *
    `;
    return row ? mapProject(row) : null;
  }

  async listScans(userId: string, projectId: string, limit: number, offset: number) {
    const rows = await this.sql<Record<string, unknown>[]>`
      select s.* from shipseal_scans s join shipseal_projects p on p.id = s.project_id
      where s.owner_user_id = ${userId} and p.owner_user_id = ${userId} and p.id = ${projectId} and p.deleted_at is null
      order by s.completed_at desc nulls last, s.created_at desc, s.id asc limit ${limit} offset ${offset}
    `;
    return rows.map(mapScan);
  }

  async getScan(userId: string, scanId: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      select s.* from shipseal_scans s join shipseal_projects p on p.id = s.project_id
      where s.id = ${scanId} and s.owner_user_id = ${userId} and p.owner_user_id = ${userId} and p.deleted_at is null limit 1
    `;
    if (!row) return null;
    return { scan: mapScan(row), snapshot: scanSnapshotSchema.parse(row.snapshot) };
  }

  async deleteScan(userId: string, scanId: string) {
    return this.sql.begin(async transaction => {
      const rows = await transaction<Record<string, unknown>[]>`
        select s.id, s.project_id from shipseal_scans s join shipseal_projects p on p.id = s.project_id
        where s.id = ${scanId} and s.owner_user_id = ${userId} and p.owner_user_id = ${userId} and p.deleted_at is null for update
      `;
      if (!rows[0]) return false;
      const projectId = databaseIdentifier(rows[0].project_id, 'project');
      await transaction`delete from shipseal_verification_relationships where owner_user_id = ${userId} and (baseline_scan_id = ${scanId} or rescan_id = ${scanId})`;
      await transaction`delete from shipseal_scans where id = ${scanId} and owner_user_id = ${userId}`;
      await transaction`update shipseal_projects set last_scan_at = (
        select max(completed_at) from shipseal_scans where project_id = ${projectId}
      ), updated_at = now() where id = ${projectId} and owner_user_id = ${userId}`;
      return true;
    });
  }

  async deleteProject(userId: string, projectId: string) {
    const rows = await this.sql<Record<string, unknown>[]>`delete from shipseal_projects where id = ${projectId} and owner_user_id = ${userId} returning id`;
    return rows.length === 1;
  }

  async deleteAccount(userId: string) {
    return this.sql.begin(async transaction => {
      const rows = await transaction<Record<string, unknown>[]>`select id from shipseal_users where id = ${userId} and deleted_at is null for update`;
      if (!rows[0]) return false;
      await transaction`delete from shipseal_projects where owner_user_id = ${userId}`;
      await transaction`delete from shipseal_sessions where user_id = ${userId}`;
      await transaction`update shipseal_users set email = null, display_name = null, avatar_url = null, provider_subject = 'deleted:' || id, deleted_at = now(), updated_at = now() where id = ${userId}`;
      return true;
    });
  }

  async close() { await this.sql.end({ timeout: 5 }); }
}

function projectIdentity(input: SaveProjectRequest) {
  if (input.project.repositoryOwner && input.project.repositoryName) return `github:${input.project.repositoryOwner.toLowerCase()}/${input.project.repositoryName.toLowerCase()}`;
  return `upload:${input.project.uploadLabel?.trim().toLowerCase() || input.project.displayName.trim().toLowerCase()}`;
}

let sharedStore: AccountPersistenceStore | null = null;
export function getAccountPersistenceStore(env: NodeJS.ProcessEnv = process.env) {
  sharedStore ||= PostgresAccountPersistenceStore.fromEnvironment(env);
  return sharedStore;
}

export function setAccountPersistenceStoreForTests(store: AccountPersistenceStore | null) {
  sharedStore = store;
}

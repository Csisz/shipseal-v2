import { z } from 'zod';
import type { ReadinessReport } from '../types.js';

export const PERSISTENCE_SCHEMA_VERSION = 'shipseal.persistence.v1' as const;
export const SCAN_SNAPSHOT_SCHEMA_VERSION = 'shipseal.scan-snapshot.v1' as const;
export const VERIFICATION_RELATIONSHIP_SCHEMA_VERSION = 'shipseal.verification-relationship.v1' as const;

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{20,80}$/);
const safeText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const timestampSchema = z.string().datetime({ offset: true });
const repositoryPartSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);

export const projectSourceTypeSchema = z.enum(['zip-upload', 'github-url', 'github-public', 'github-app']);
export const scanStatusSchema = z.enum(['completed', 'failed']);
export const intelligenceModeSchema = z.enum(['deterministic', 'enhanced', 'fallback']);
export const persistedVerificationStateSchema = z.enum([
  'not-started', 'awaiting-repository-change', 'partially-verified', 'verified', 'changes-detected', 'unavailable',
]);

const forbiddenValuePattern = /(?:github_pat_|gh[opusr]_[A-Za-z0-9]{12,}|sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const forbiddenKeyPattern = /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|provider[_-]?raw|raw[_-]?provider[_-]?response|text[_-]?contents|archive[_-]?bytes|zip[_-]?bytes)$/i;

export type SafeDerivedJson = null | boolean | number | string | SafeDerivedJson[] | { [key: string]: SafeDerivedJson };

export function validateSafeDerivedJson(value: unknown, limits = { maxDepth: 18, maxNodes: 80_000, maxString: 250_000 }): value is SafeDerivedJson {
  let nodes = 0;
  const visit = (candidate: unknown, depth: number): candidate is SafeDerivedJson => {
    nodes += 1;
    if (nodes > limits.maxNodes || depth > limits.maxDepth) return false;
    if (candidate === null || typeof candidate === 'boolean') return true;
    if (typeof candidate === 'number') return Number.isFinite(candidate);
    if (typeof candidate === 'string') return candidate.length <= limits.maxString && !forbiddenValuePattern.test(candidate);
    if (Array.isArray(candidate)) return candidate.length <= 20_000 && candidate.every(item => visit(item, depth + 1));
    if (!candidate || typeof candidate !== 'object') return false;
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const entries = Object.entries(candidate as Record<string, unknown>);
    return entries.length <= 20_000 && entries.every(([key, item]) => (
      key.length <= 120 && !forbiddenKeyPattern.test(key) && visit(item, depth + 1)
    ));
  };
  return visit(value, 0);
}

const derivedObjectSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  if (!validateSafeDerivedJson(value)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Stored derived data is unsafe or exceeds persistence limits.' });
});

const reportCoreSchema = z.object({
  repoName: safeText(200),
  fileCount: z.number().int().nonnegative().max(1_000_000),
  totalSizeBytes: z.number().int().nonnegative().max(10_000_000_000),
  scannedAt: timestampSchema,
  source: derivedObjectSchema,
  stack: derivedObjectSchema,
  summary: derivedObjectSchema,
  categories: z.array(derivedObjectSchema).max(100),
  score: z.number().min(0).max(100),
  level: z.enum(['Not Ready', 'Partially Ready', 'Almost Ready', 'AI Coding Ready', 'AgentReady Certified']),
  isReady: z.boolean(),
  blockers: z.array(derivedObjectSchema).max(500),
  improvements: z.array(derivedObjectSchema).max(1_000),
  contextPack: z.string().max(1_000_000),
  repoContextPack: derivedObjectSchema,
  agentPack: z.array(derivedObjectSchema).max(500),
  aiNarrative: derivedObjectSchema,
  aiAgentInstructions: derivedObjectSchema,
  mcpReadiness: derivedObjectSchema,
  repositoryHealth: derivedObjectSchema,
  scanSummary: derivedObjectSchema,
  scanEvidence: derivedObjectSchema,
  analyzedFiles: z.array(derivedObjectSchema).max(100_000).optional(),
  sampleFiles: z.array(derivedObjectSchema).max(5_000),
  recommendedAgentOperatingMode: z.enum(['maximum-reliability', 'balanced-productivity', 'token-saver']).optional(),
}).strict().superRefine((value, context) => {
  if (!validateSafeDerivedJson(value)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Readiness report contains unsafe derived data.' });
});

export function parsePersistedReadinessReport(value: unknown): ReadinessReport {
  const parsed = reportCoreSchema.parse(value);
  if (!isReadinessReport(parsed)) throw new Error('Persisted readiness report does not match the public report contract.');
  return parsed;
}

function isReadinessReport(value: unknown): value is ReadinessReport {
  return reportCoreSchema.safeParse(value).success;
}

export const persistedUserSchema = z.object({
  id: idSchema,
  email: z.string().email().max(320).nullable(),
  displayName: z.string().max(120).nullable(),
  avatarUrl: z.string().url().max(500).nullable(),
}).strict();

export const persistedProjectSchema = z.object({
  version: z.literal(PERSISTENCE_SCHEMA_VERSION),
  id: idSchema,
  sourceType: projectSourceTypeSchema,
  repositoryOwner: repositoryPartSchema.nullable(),
  repositoryName: repositoryPartSchema.nullable(),
  uploadLabel: z.string().max(200).nullable(),
  defaultBranch: z.string().max(250).nullable(),
  githubRepositoryId: z.string().max(80).nullable(),
  githubInstallationId: z.string().max(80).nullable(),
  displayName: safeText(200),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  lastScanAt: timestampSchema.nullable(),
  archived: z.boolean(),
  latestScanStatus: scanStatusSchema.nullable(),
  latestIntelligenceMode: intelligenceModeSchema.nullable(),
  latestVerificationState: persistedVerificationStateSchema.nullable(),
}).strict();

export const persistedScanSummarySchema = z.object({
  version: z.literal(PERSISTENCE_SCHEMA_VERSION),
  id: idSchema,
  projectId: idSchema,
  sourceType: projectSourceTypeSchema,
  repositoryOwner: repositoryPartSchema.nullable(),
  repositoryName: repositoryPartSchema.nullable(),
  branch: z.string().max(250).nullable(),
  status: scanStatusSchema,
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  scannerVersion: safeText(100),
  deterministicRequestFingerprint: z.string().regex(/^[a-z0-9]{12,128}$/i),
  discoveredFiles: z.number().int().nonnegative().max(1_000_000),
  analyzedFiles: z.number().int().nonnegative().max(1_000_000),
  ignoredFiles: z.number().int().nonnegative().max(1_000_000),
  intelligenceMode: intelligenceModeSchema,
  verificationState: persistedVerificationStateSchema,
  baselineScanId: idSchema.nullable(),
  safeFailureCategory: z.string().max(100).nullable(),
}).strict();

export const verificationRelationshipInputSchema = z.object({
  version: z.literal(VERIFICATION_RELATIONSHIP_SCHEMA_VERSION),
  baselineScanId: idSchema,
  state: persistedVerificationStateSchema,
  verifiedAt: timestampSchema.nullable(),
  algorithmVersion: safeText(120),
  expectedArtifactIds: z.array(z.string().max(160)).max(500),
}).strict();

export const scanSnapshotSchema = z.object({
  version: z.literal(SCAN_SNAPSHOT_SCHEMA_VERSION),
  report: reportCoreSchema,
  intelligenceMode: intelligenceModeSchema,
  providerContractVersion: optionalText(120),
  providerModel: optionalText(160),
  providerSafeErrorCategory: optionalText(100),
  deterministicRequestFingerprint: z.string().regex(/^[a-z0-9]{12,128}$/i),
  artifactSelection: z.object({
    artifactIds: z.array(z.string().max(160)).max(500),
    selectionFingerprint: optionalText(160),
  }).strict().optional(),
  verificationSummary: z.object({
    state: persistedVerificationStateSchema,
    baselineFingerprint: optionalText(160),
    verifiedArtifactCount: z.number().int().nonnegative().max(10_000),
    unresolvedArtifactCount: z.number().int().nonnegative().max(10_000),
  }).strict().optional(),
  policyVersions: z.record(z.string().max(100), z.string().max(160)).refine(value => Object.keys(value).length <= 40),
}).strict();

export const saveProjectRequestSchema = z.object({
  version: z.literal(PERSISTENCE_SCHEMA_VERSION),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  project: z.object({
    sourceType: projectSourceTypeSchema,
    repositoryOwner: repositoryPartSchema.nullable(),
    repositoryName: repositoryPartSchema.nullable(),
    uploadLabel: z.string().max(200).nullable(),
    defaultBranch: z.string().max(250).nullable(),
    githubRepositoryId: z.string().max(80).nullable(),
    githubInstallationId: z.string().max(80).nullable(),
    displayName: safeText(200),
  }).strict(),
  scan: z.object({
    sourceType: projectSourceTypeSchema,
    repositoryOwner: repositoryPartSchema.nullable(),
    repositoryName: repositoryPartSchema.nullable(),
    branch: z.string().max(250).nullable(),
    status: scanStatusSchema,
    startedAt: timestampSchema,
    completedAt: timestampSchema.nullable(),
    scannerVersion: safeText(100),
    deterministicRequestFingerprint: z.string().regex(/^[a-z0-9]{12,128}$/i),
    discoveredFiles: z.number().int().nonnegative().max(1_000_000),
    analyzedFiles: z.number().int().nonnegative().max(1_000_000),
    ignoredFiles: z.number().int().nonnegative().max(1_000_000),
    intelligenceMode: intelligenceModeSchema,
    safeFailureCategory: z.string().max(100).nullable(),
    snapshot: scanSnapshotSchema,
    verificationRelationship: verificationRelationshipInputSchema.optional(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (JSON.stringify(value).length > 5_000_000) context.addIssue({ code: z.ZodIssueCode.too_big, maximum: 5_000_000, inclusive: true, type: 'string', message: 'Persistence payload is too large.' });
});

export type PersistedUser = z.infer<typeof persistedUserSchema>;
export type PersistedProject = z.infer<typeof persistedProjectSchema>;
export type PersistedScanSummary = z.infer<typeof persistedScanSummarySchema>;
export type PersistedScanSnapshot = z.infer<typeof scanSnapshotSchema>;
export type SaveProjectRequest = z.infer<typeof saveProjectRequestSchema>;

export type PersistenceApiErrorCode = 'authentication_required' | 'session_expired' | 'invalid_request' | 'not_found' | 'unsupported_version' | 'conflict' | 'unavailable' | 'unknown_error';

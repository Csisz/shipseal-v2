import { randomBytes } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { z } from 'zod';
import { validateAccountDatabaseUrl } from './authConfig.js';
import { PersistenceUnavailableError } from './accountPersistence.js';
import { recordOperationalEvent } from './operationalEvents.js';

export const feedbackSurfaceSchema = z.enum(['global', 'scan_result', 'repository_futures', 'executable_plan', 'agent_handoff', 'delivery', 'projects', 'account']);
export const feedbackUseCaseSchema = z.enum(['understand_repository', 'find_improvements', 'plan_future', 'prepare_agent_work', 'prepare_delivery', 'other']);
export const feedbackOutcomeSchema = z.enum(['yes', 'partly', 'no']);
export const feedbackUseAgainSchema = z.enum(['yes', 'maybe', 'no']);
export const feedbackPricingIntentSchema = z.enum(['yes', 'maybe', 'no']);
export const productSignalSchema = z.enum(['scan_completed', 'future_opened', 'future_generated', 'agent_handoff_prepared', 'agent_handoff_copied', 'delivery_opened', 'delivery_downloaded']);

const safeId = z.string().regex(/^(?:prj|scn)_[A-Za-z0-9_-]{20,80}$/);
export const feedbackSubmissionSchema = z.object({
  kind: z.literal('feedback'),
  surface: feedbackSurfaceSchema,
  useCase: feedbackUseCaseSchema,
  outcome: feedbackOutcomeSchema,
  useAgain: feedbackUseAgainSchema,
  pricingIntent: feedbackPricingIntentSchema.nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
  contactAllowed: z.boolean().optional().default(false),
  projectId: safeId.nullable().optional(),
  scanId: safeId.nullable().optional(),
}).strict();

export const productSignalSubmissionSchema = z.object({
  kind: z.literal('signal'),
  event: productSignalSchema,
  surface: feedbackSurfaceSchema,
  projectId: safeId.nullable().optional(),
  scanId: safeId.nullable().optional(),
}).strict();

export const feedbackRequestSchema = z.discriminatedUnion('kind', [feedbackSubmissionSchema, productSignalSubmissionSchema]);
export interface FeedbackSubmission {
  kind: 'feedback';
  surface: z.infer<typeof feedbackSurfaceSchema>;
  useCase: z.infer<typeof feedbackUseCaseSchema>;
  outcome: z.infer<typeof feedbackOutcomeSchema>;
  useAgain: z.infer<typeof feedbackUseAgainSchema>;
  pricingIntent?: z.infer<typeof feedbackPricingIntentSchema> | null;
  comment?: string | null;
  contactAllowed: boolean;
  projectId?: string | null;
  scanId?: string | null;
}
export interface ProductSignalSubmission {
  kind: 'signal';
  event: z.infer<typeof productSignalSchema>;
  surface: z.infer<typeof feedbackSurfaceSchema>;
  projectId?: string | null;
  scanId?: string | null;
}
export type FeedbackRequest = FeedbackSubmission | ProductSignalSubmission;

export interface ProductFeedbackStore {
  submit(input: FeedbackSubmission, userId: string | null): Promise<void>;
  signal(input: ProductSignalSubmission, userId: string | null): Promise<void>;
  close?(): Promise<void>;
}

async function ownedContext(sql: Sql, userId: string | null, projectId?: string | null, scanId?: string | null) {
  if (!userId) return { projectId: null, scanId: null };
  if (scanId) {
    const [scan] = await sql<{ id: string; project_id: string }[]>`
      select s.id, s.project_id from public.shipseal_scans s
      join public.shipseal_projects p on p.id = s.project_id
      where s.id = ${scanId} and s.owner_user_id = ${userId} and p.owner_user_id = ${userId} and p.deleted_at is null limit 1
    `;
    if (scan) return { projectId: scan.project_id, scanId: scan.id };
  }
  if (projectId) {
    const [project] = await sql<{ id: string }[]>`
      select id from public.shipseal_projects where id = ${projectId} and owner_user_id = ${userId} and deleted_at is null limit 1
    `;
    if (project) return { projectId: project.id, scanId: null };
  }
  return { projectId: null, scanId: null };
}

export class PostgresProductFeedbackStore implements ProductFeedbackStore {
  constructor(private readonly sql: Sql) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env) {
    const connectionString = (env.DATABASE_URL || '').trim();
    if (!connectionString) throw new PersistenceUnavailableError('DATABASE_URL is not configured.');
    try { validateAccountDatabaseUrl(connectionString); } catch { throw new PersistenceUnavailableError('DATABASE_URL must be a valid PostgreSQL connection string.'); }
    return new PostgresProductFeedbackStore(postgres(connectionString, { max: 1, idle_timeout: 10, connect_timeout: 5, prepare: false }));
  }

  async submit(input: FeedbackSubmission, userId: string | null) {
    const context = await ownedContext(this.sql, userId, input.projectId, input.scanId);
    const id = `fb_${randomBytes(18).toString('base64url')}`;
    await this.sql`
      insert into public.shipseal_product_feedback
        (id, user_id, project_id, scan_id, surface, use_case, outcome, use_again, pricing_intent, comment, contact_allowed)
      values
        (${id}, ${userId}, ${context.projectId}, ${context.scanId}, ${input.surface}, ${input.useCase}, ${input.outcome}, ${input.useAgain}, ${input.pricingIntent || null}, ${input.comment || null}, ${Boolean(userId && input.contactAllowed)})
    `;
    await recordOperationalEvent(this.sql, {
      category: 'product', action: 'feedback_submitted', status: 'succeeded', userId: userId || undefined,
      projectId: context.projectId || undefined, scanId: context.scanId || undefined, metadata: { surface: input.surface },
    });
  }

  async signal(input: ProductSignalSubmission, userId: string | null) {
    const context = await ownedContext(this.sql, userId, input.projectId, input.scanId);
    await recordOperationalEvent(this.sql, {
      category: 'product', action: input.event, status: 'succeeded', userId: userId || undefined,
      projectId: context.projectId || undefined, scanId: context.scanId || undefined, metadata: { surface: input.surface },
    });
  }

  async close() { await this.sql.end({ timeout: 2 }); }
}

let sharedStore: ProductFeedbackStore | null = null;
export function getProductFeedbackStore(env: NodeJS.ProcessEnv = process.env) {
  sharedStore ||= PostgresProductFeedbackStore.fromEnvironment(env);
  return sharedStore;
}
export function setProductFeedbackStoreForTests(store: ProductFeedbackStore | null) { sharedStore = store; }

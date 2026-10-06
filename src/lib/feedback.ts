export const FEEDBACK_COMMENT_MAX_LENGTH = 2000;

export type FeedbackSurface = 'global' | 'scan_result' | 'repository_futures' | 'executable_plan' | 'agent_handoff' | 'delivery' | 'projects' | 'account';
export type FeedbackUseCase = 'understand_repository' | 'find_improvements' | 'plan_future' | 'prepare_agent_work' | 'prepare_delivery' | 'other';
export type FeedbackOutcome = 'yes' | 'partly' | 'no';
export type FeedbackUseAgain = 'yes' | 'maybe' | 'no';
export type FeedbackPricingIntent = 'yes' | 'maybe' | 'no';
export type ProductSignal = 'scan_completed' | 'future_opened' | 'future_generated' | 'agent_handoff_prepared' | 'agent_handoff_copied' | 'delivery_opened' | 'delivery_downloaded';

export interface FeedbackContext {
  surface: FeedbackSurface;
  projectId?: string | null;
  scanId?: string | null;
}

export async function submitFeedback(input: FeedbackContext & {
  useCase: FeedbackUseCase;
  outcome: FeedbackOutcome;
  useAgain: FeedbackUseAgain;
  pricingIntent?: FeedbackPricingIntent | null;
  comment?: string | null;
  contactAllowed: boolean;
}) {
  return postFeedback({ kind: 'feedback', ...input });
}

export async function recordProductSignal(event: ProductSignal, context: FeedbackContext) {
  return postFeedback({ kind: 'signal', event, ...context });
}

async function postFeedback(body: Record<string, unknown>) {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Feedback is temporarily unavailable.');
  return response.json() as Promise<{ ok: true }>;
}

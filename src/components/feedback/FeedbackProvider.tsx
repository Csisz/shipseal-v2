import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useOptionalAccount } from '@/components/account/accountContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  recordProductSignal,
  submitFeedback,
  type FeedbackOutcome,
  type FeedbackPricingIntent,
  type FeedbackSurface,
  type FeedbackUseAgain,
  type FeedbackUseCase,
  type ProductSignal,
} from '@/lib/feedback';
import { FeedbackContext, type FeedbackOpenOptions, type FeedbackSignalOptions } from './feedbackContext';

const PROMPTED_KEY = 'shipseal-feedback-prompted-v1';
const PREMIUM_KEY = 'shipseal-feedback-premium-value-v1';
const SUBMITTED_KEY = 'shipseal-feedback-submitted-v1';

const useCases: Array<[FeedbackUseCase, string]> = [
  ['understand_repository', 'Understand a repository'],
  ['find_improvements', 'Find what to improve'],
  ['plan_future', 'Plan a future feature or product direction'],
  ['prepare_agent_work', 'Prepare work for an AI coding agent'],
  ['prepare_delivery', 'Prepare a handoff or delivery'],
  ['other', 'Other'],
];

function sessionHas(key: string) {
  try { return window.sessionStorage.getItem(key) === 'true'; } catch { return false; }
}
function markSession(key: string) {
  try { window.sessionStorage.setItem(key, 'true'); } catch { /* Feedback remains usable without browser storage. */ }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = useOptionalAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [surface, setSurface] = useState<FeedbackSurface>('global');
  const [prefilledOutcome, setPrefilledOutcome] = useState<FeedbackOutcome>();
  const [premiumValue, setPremiumValue] = useState(() => sessionHas(PREMIUM_KEY));
  const [prompt, setPrompt] = useState<{ surface: FeedbackSurface; premiumValue: boolean } | null>(null);

  const routeContext = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/(prj_[A-Za-z0-9_-]{20,80})(?:\/scans\/(scn_[A-Za-z0-9_-]{20,80}))?/);
    return { projectId: match?.[1] || null, scanId: match?.[2] || null };
  }, [location.pathname]);

  const openFeedback = useCallback((options: FeedbackOpenOptions = {}) => {
    const nextPremium = premiumValue || Boolean(options.premiumValue) || sessionHas(PREMIUM_KEY);
    if (nextPremium) { markSession(PREMIUM_KEY); setPremiumValue(true); }
    setSurface(options.surface || surfaceForPath(location.pathname));
    setPrefilledOutcome(options.outcome);
    setPrompt(null);
    setDialogOpen(true);
  }, [location.pathname, premiumValue]);

  const recordOutcome = useCallback((event: ProductSignal, outcomeSurface: FeedbackSurface, options: FeedbackSignalOptions = {}) => {
    if (options.premiumValue) { markSession(PREMIUM_KEY); setPremiumValue(true); }
    void recordProductSignal(event, { surface: outcomeSurface, ...routeContext }).catch(() => undefined);
    if (!options.prompt || sessionHas(PROMPTED_KEY) || sessionHas(SUBMITTED_KEY)) return;
    markSession(PROMPTED_KEY);
    setPrompt({ surface: outcomeSurface, premiumValue: Boolean(options.premiumValue) });
  }, [routeContext]);

  const value = useMemo(() => ({ openFeedback, recordOutcome }), [openFeedback, recordOutcome]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {prompt && <MicroFeedback
        onAnswer={outcome => openFeedback({ surface: prompt.surface, outcome, premiumValue: prompt.premiumValue })}
        onDismiss={() => setPrompt(null)}
      />}
      <FeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        surface={surface}
        prefilledOutcome={prefilledOutcome}
        premiumValue={premiumValue}
        authenticated={Boolean(account.user)}
        routeContext={routeContext}
        onSubmitted={() => markSession(SUBMITTED_KEY)}
      />
    </FeedbackContext.Provider>
  );
}

function MicroFeedback({ onAnswer, onDismiss }: { onAnswer: (outcome: FeedbackOutcome) => void; onDismiss: () => void }) {
  return <section aria-label="Quick feedback" className="fixed bottom-4 left-4 right-4 z-[var(--layer-popover)] mx-auto max-w-sm rounded-2xl border border-border/75 bg-card/95 p-4 shadow-[var(--shadow-floating-panel)] backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-reduce:animate-none">
    <button type="button" onClick={onDismiss} className="absolute right-2 top-2 flex min-h-9 min-w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Dismiss feedback prompt"><X className="h-4 w-4" /></button>
    <div className="flex items-center gap-2 pr-8 text-sm font-semibold"><MessageSquareText className="h-4 w-4 text-primary" /> Was this useful?</div>
    <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Was this useful?">
      {([['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']] as const).map(([value, label]) => <Button key={value} type="button" variant="outline" size="sm" onClick={() => onAnswer(value)}>{label}</Button>)}
    </div>
  </section>;
}

function FeedbackDialog({ open, onOpenChange, surface, prefilledOutcome, premiumValue, authenticated, routeContext, onSubmitted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: FeedbackSurface;
  prefilledOutcome?: FeedbackOutcome;
  premiumValue: boolean;
  authenticated: boolean;
  routeContext: { projectId: string | null; scanId: string | null };
  onSubmitted: () => void;
}) {
  const [useCase, setUseCase] = useState<FeedbackUseCase>();
  const [outcome, setOutcome] = useState<FeedbackOutcome>();
  const [useAgain, setUseAgain] = useState<FeedbackUseAgain>();
  const [pricingIntent, setPricingIntent] = useState<FeedbackPricingIntent>();
  const [comment, setComment] = useState('');
  const [contactAllowed, setContactAllowed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!open) return;
    setUseCase(undefined); setOutcome(prefilledOutcome); setUseAgain(undefined); setPricingIntent(undefined);
    setComment(''); setContactAllowed(false); setStatus('idle');
  }, [open, prefilledOutcome]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!useCase || !outcome || !useAgain || premiumValue && !pricingIntent) return;
    setStatus('sending');
    try {
      await submitFeedback({ surface, useCase, outcome, useAgain, pricingIntent: premiumValue ? pricingIntent : null, comment: comment.trim() || null, contactAllowed: authenticated && contactAllowed, ...routeContext });
      setStatus('sent'); onSubmitted();
    } catch { setStatus('error'); }
  };

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent className="max-w-xl p-4 sm:p-6">
      {status === 'sent' ? <div className="py-6 text-center" role="status"><DialogHeader><DialogTitle>Thank you for the feedback</DialogTitle><DialogDescription>Your feedback was saved and will be used to improve ShipSeal Early Access.</DialogDescription></DialogHeader><Button className="mt-5" onClick={() => onOpenChange(false)}>Done</Button></div> : <form onSubmit={onSubmit} className="grid gap-5">
        <DialogHeader><DialogTitle>Send feedback</DialogTitle><DialogDescription>Help shape ShipSeal Early Access. Repository source is not attached to this feedback.</DialogDescription></DialogHeader>
        <Field label="What were you trying to achieve?">
          <Select value={useCase} onValueChange={value => setUseCase(value as FeedbackUseCase)} required>
            <SelectTrigger aria-label="Use case"><SelectValue placeholder="Select a use case" /></SelectTrigger>
            <SelectContent><SelectGroup>{useCases.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
        <ChoiceField label="Did ShipSeal help?" value={outcome} onChange={value => setOutcome(value as FeedbackOutcome)} choices={[['yes', 'Yes, ShipSeal helped'], ['partly', 'Partly'], ['no', 'No']]} />
        <ChoiceField label="Would you use ShipSeal again?" value={useAgain} onChange={value => setUseAgain(value as FeedbackUseAgain)} choices={[['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']]} />
        {premiumValue && <ChoiceField label="Would you pay $19/month for 10 Deep Analyses if ShipSeal reliably saved you this work?" value={pricingIntent} onChange={value => setPricingIntent(value as FeedbackPricingIntent)} choices={[['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']]} />}
        <Field label="What was missing, confusing, or especially useful? (optional)">
          <Textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={FEEDBACK_COMMENT_MAX_LENGTH} rows={4} className="resize-y" />
          <div className="text-right text-xs text-muted-foreground">{comment.length}/{FEEDBACK_COMMENT_MAX_LENGTH}</div>
        </Field>
        {authenticated && <label className="flex cursor-pointer items-start gap-3 text-sm"><Checkbox checked={contactAllowed} onCheckedChange={checked => setContactAllowed(checked === true)} aria-label="You may contact me about this feedback" /><span>You may contact me about this feedback.</span></label>}
        {status === 'error' && <p role="alert" className="text-sm text-destructive">Feedback could not be saved. Please try again.</p>}
        <DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={status === 'sending' || !useCase || !outcome || !useAgain || premiumValue && !pricingIntent}>{status === 'sending' ? 'Sending…' : 'Send feedback'}</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>;
}
function ChoiceField({ label, value, onChange, choices }: { label: string; value?: string; onChange: (value: string) => void; choices: Array<[string, string]> }) {
  return <fieldset className="grid gap-2"><legend className="text-sm font-medium">{label}</legend><RadioGroup value={value || ''} onValueChange={onChange} className="grid gap-2 sm:grid-cols-3">{choices.map(([choice, text]) => <label key={choice} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border/65 px-3 py-2 text-sm hover:bg-secondary/30"><RadioGroupItem value={choice} />{text}</label>)}</RadioGroup></fieldset>;
}
function surfaceForPath(pathname: string): FeedbackSurface {
  if (pathname.includes('/scans/')) return 'scan_result';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/account')) return 'account';
  return 'global';
}

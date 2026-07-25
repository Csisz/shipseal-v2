import { AlertTriangle, Check, CheckCircle2, Circle, CircleDashed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { workspaceStateLabel } from '@/lib/workspace';
import {
  VERIFY_NORMAL_LIFECYCLE,
  verifyJourneyStepState,
  type VerifyNormalLifecycleState,
  type VerifyPresentation,
} from './verifyPresentation';

interface VerificationJourneyProps {
  presentation: VerifyPresentation;
  primaryActionDisabled?: boolean;
  primaryActionPending?: boolean;
  showArtifactReview: boolean;
  onPrimaryAction: () => void;
  onReviewArtifacts: () => void;
  onViewTechnicalEvidence: () => void;
}

export function VerificationJourney({
  presentation,
  primaryActionDisabled = false,
  primaryActionPending = false,
  showArtifactReview,
  onPrimaryAction,
  onReviewArtifacts,
  onViewTechnicalEvidence,
}: VerificationJourneyProps) {
  return (
    <section
      className="mx-auto mb-4 w-full max-w-5xl rounded-2xl border border-border/55 bg-background/25 p-4 shadow-sm md:p-5"
      aria-labelledby="verify-lifecycle-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Verification journey</div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/55 bg-background/35 px-2.5 py-1 text-xs font-medium text-foreground">
          {presentation.state === 'unresolved'
            ? <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            : <Circle className="h-3.5 w-3.5 text-primary-glow" aria-hidden="true" />}
          {workspaceStateLabel(presentation.state)}
        </div>
      </div>

      <div className="-mx-1 mt-4 max-w-full overflow-x-auto px-1 pb-1" data-testid="verification-journey-scroll">
        <ol className="flex min-w-[36rem] items-start md:min-w-0" aria-label="Verification lifecycle">
          {VERIFY_NORMAL_LIFECYCLE.map((step, index) => (
            <VerificationJourneyStep
              key={step}
              step={step}
              state={verifyJourneyStepState(step, presentation.journeyStage)}
              hasConnector={index < VERIFY_NORMAL_LIFECYCLE.length - 1}
            />
          ))}
        </ol>
      </div>

      {presentation.state === 'unresolved' && (
        <div
          role="status"
          aria-label="Unresolved verification findings"
          className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-warning">Exception state: unresolved findings</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {presentation.unresolvedCount.toLocaleString()} item{presentation.unresolvedCount === 1 ? '' : 's'} require resolution or more evidence.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-primary/20 bg-background/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary-glow">
            Current state
          </span>
          <h3 id="verify-lifecycle-heading" className="font-display text-xl font-semibold text-foreground">{presentation.heading}</h3>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{presentation.explanation}</p>

        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-success/25 bg-success/5 px-3 py-2">
            <dt className="flex items-center gap-1.5 font-semibold text-foreground">
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              Completed
            </dt>
            <dd className="mt-1 leading-relaxed text-muted-foreground">{presentation.completedSummary}</dd>
          </div>
          <div className="rounded-lg border border-border/45 bg-background/25 px-3 py-2">
            <dt className="flex items-center gap-1.5 font-semibold text-foreground">
              <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Not yet
            </dt>
            <dd className="mt-1 leading-relaxed text-muted-foreground">{presentation.pendingSummary}</dd>
          </div>
        </dl>

        <div className="mt-3 border-l-2 border-primary/45 pl-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-primary-glow">Next step</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground/85">{presentation.nextStep}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryActionDisabled}
            className="min-h-10 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {primaryActionPending ? 'Scanning later state…' : presentation.primaryLabel}
          </Button>
          {showArtifactReview && (
            <Button type="button" variant="outline" onClick={onReviewArtifacts} className="min-h-10 border-border/60 bg-background/25">
              Review prepared artifacts
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onViewTechnicalEvidence} className="min-h-10 text-muted-foreground">
            View technical evidence
          </Button>
        </div>
      </div>

      {presentation.metrics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Verification supporting metrics">
          {presentation.metrics.map(metric => (
            <div
              key={metric.label}
              className={`inline-flex items-baseline gap-2 rounded-full border px-3 py-1.5 text-xs ${
                metric.tone === 'warning'
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-border/50 bg-background/30 text-muted-foreground'
              }`}
            >
              <span className="font-display text-base font-semibold text-foreground">{metric.value.toLocaleString()}</span>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VerificationJourneyStep({
  step,
  state,
  hasConnector,
}: {
  step: VerifyNormalLifecycleState;
  state: 'completed' | 'current' | 'future';
  hasConnector: boolean;
}) {
  return (
    <li
      className="flex min-w-0 flex-1 items-center"
      aria-current={state === 'current' ? 'step' : undefined}
      data-step={step}
      data-step-state={state}
    >
      <div className={`flex min-w-[7rem] shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
        state === 'current'
          ? 'border-primary/55 bg-primary/10 font-semibold text-foreground shadow-sm'
          : state === 'completed'
            ? 'border-success/35 bg-success/5 text-foreground'
            : 'border-border/45 bg-background/20 text-muted-foreground'
      }`}>
        {state === 'completed'
          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          : state === 'current'
            ? <Circle className="h-4 w-4 shrink-0 fill-primary/20 text-primary-glow" aria-hidden="true" />
            : <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span>{workspaceStateLabel(step)}</span>
        <span className="sr-only">{state === 'completed' ? 'completed' : state === 'current' ? 'current step' : 'not started'}</span>
      </div>
      {hasConnector && (
        <span
          className={`mx-1 h-px min-w-4 flex-1 ${state === 'completed' ? 'bg-success/45' : 'bg-border/65'}`}
          aria-hidden="true"
        />
      )}
    </li>
  );
}

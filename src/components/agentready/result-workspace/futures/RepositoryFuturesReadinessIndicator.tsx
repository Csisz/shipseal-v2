import { Check, CircleDashed, Sparkles, TriangleAlert } from 'lucide-react';
import type { RepositoryFutureReadiness } from '@/lib/repositoryIntelligence';
import { cn } from '@/lib/utils';

export function RepositoryFuturesReadinessIndicator({
  readiness,
  size = 'large',
}: {
  readiness: RepositoryFutureReadiness;
  size?: 'compact' | 'large';
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - readiness.milestoneProgress);
  const Icon = readiness.state === 'ready'
    ? Check
    : readiness.state === 'failed'
      ? TriangleAlert
      : readiness.busy
        ? Sparkles
        : CircleDashed;

  return (
    <div
      role="img"
      aria-label={`Repository Futures readiness: ${readiness.label}. Progress follows confirmed analysis milestones; no exact percentage is claimed.`}
      data-testid="repository-futures-readiness-indicator"
      data-readiness-state={readiness.state}
      data-progress-basis="confirmed-milestones"
      className={cn('relative grid shrink-0 place-items-center', size === 'large' ? 'size-32 sm:size-36' : 'size-20')}
    >
      <div aria-hidden="true" className={cn(
        'absolute inset-[13%] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.13),transparent_68%)] blur-md',
        readiness.state === 'failed' && 'bg-[radial-gradient(circle,hsl(var(--destructive)/0.12),transparent_68%)]',
      )} />
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90 overflow-visible">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border) / 0.5)" strokeWidth="3" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={readiness.state === 'failed' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
        {readiness.busy && (
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="hsl(var(--primary-glow) / 0.55)"
            strokeWidth="1"
            strokeDasharray="3 12"
            className="origin-center motion-safe:animate-[spin_8s_linear_infinite]"
          />
        )}
      </svg>
      <span aria-hidden="true" className={cn(
        'relative grid rounded-full border border-primary/20 bg-background/70 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.16)] backdrop-blur-sm',
        size === 'large' ? 'size-14 place-items-center' : 'size-9 place-items-center',
        readiness.state === 'failed' && 'border-destructive/25 text-destructive shadow-[0_0_24px_hsl(var(--destructive)/0.12)]',
      )}>
        <Icon className={size === 'large' ? 'size-5' : 'size-4'} />
      </span>
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type SurfaceStateTone = 'loading' | 'empty' | 'error';

interface SurfaceStateProps {
  tone: SurfaceStateTone;
  title: string;
  description: string;
  action?: ReactNode;
  fallback?: ReactNode;
  details?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function SurfaceState({
  tone,
  title,
  description,
  action,
  fallback,
  details,
  icon,
  className = '',
}: SurfaceStateProps) {
  const Icon = icon || (tone === 'loading' ? LoaderCircle : tone === 'error' ? AlertTriangle : Inbox);
  return (
    <section
      className={`rounded-2xl border px-4 py-4 md:px-5 ${
        tone === 'error'
          ? 'border-destructive/35 bg-destructive/10'
          : 'border-border/55 bg-secondary/10'
      } ${className}`}
      aria-live={tone === 'loading' ? 'polite' : undefined}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-busy={tone === 'loading' || undefined}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          tone === 'error'
            ? 'border-destructive/35 bg-destructive/10 text-destructive'
            : 'border-primary/25 bg-primary/10 text-primary-glow'
        }`}>
          <Icon className={`h-4 w-4 ${tone === 'loading' ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          {(action || fallback) && <div className="mt-3 flex flex-wrap gap-2">{action}{fallback}</div>}
          {details && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium hover:text-foreground">Technical details</summary>
              <div className="mt-2 break-words rounded-lg border border-border/45 bg-background/25 p-3 [overflow-wrap:anywhere]">{details}</div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

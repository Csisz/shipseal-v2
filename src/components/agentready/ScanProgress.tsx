import { CheckCircle2, Loader2, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  steps: readonly string[];
  currentStepIndex: number;
  progress: number;
  warnings?: string[];
  onCancel?: () => void;
}

export function ScanProgress({ steps, currentStepIndex, progress, warnings = [], onCancel }: Props) {
  return (
    <div className="glass rounded-2xl p-8 max-w-xl w-full mx-auto animate-scale-in">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="font-display text-lg font-semibold">Scanning repository...</div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancel Scan
          </Button>
        )}
      </div>
      <div className="text-sm text-muted-foreground mb-6">Running deterministic checks. No uploaded or imported code is executed.</div>
      <div className="h-2 rounded-full bg-secondary/70 overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-primary transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="mb-4 text-xs font-mono text-muted-foreground text-right">{Math.min(100, Math.max(0, Math.round(progress)))}%</div>
      <ul className="space-y-3">
        {steps.map((label, i) => {
          const done = i < currentStepIndex;
          const active = i === currentStepIndex;
          return (
            <li key={label} className={cn('flex items-center gap-3 text-sm transition-opacity', !done && !active && 'opacity-50')}>
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : active ? (
                <Loader2 className="h-4 w-4 text-primary-glow animate-spin shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(done && 'text-foreground', active && 'text-foreground font-medium')}>{label}</span>
            </li>
          );
        })}
      </ul>
      {warnings.length > 0 && (
        <ul className="mt-5 space-y-1 text-xs text-warning">
          {warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}

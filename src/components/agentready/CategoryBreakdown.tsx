import { Check, X } from 'lucide-react';
import type { ScoreCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  categories: ScoreCategory[];
}

export function CategoryBreakdown({ categories }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {categories.map((c) => {
        const pct = Math.round((c.earned / c.max) * 100);
        return (
          <div key={c.id} className="glass rounded-2xl p-5 hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-display font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
              </div>
              <div className="shrink-0 font-mono text-sm">
                <span className="text-foreground font-semibold">{c.earned}</span>
                <span className="text-muted-foreground">/{c.max}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-3 mb-4">
              <div
                className={cn('h-full transition-all duration-700 rounded-full',
                  pct >= 85 ? 'bg-gradient-to-r from-success to-accent' :
                  pct >= 60 ? 'bg-gradient-to-r from-accent to-primary' :
                  'bg-gradient-to-r from-warning to-primary')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <ul className="space-y-1.5">
              {c.items.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-xs">
                  {i.passed ? (
                    <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                  )}
                  <span className={cn(i.passed ? 'text-foreground/90' : 'text-muted-foreground/80')}>
                    {i.label}
                  </span>
                  <span className="ml-auto font-mono text-muted-foreground/70">+{i.earned}/{i.points}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

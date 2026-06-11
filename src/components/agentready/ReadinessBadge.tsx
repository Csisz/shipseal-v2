import { cn } from '@/lib/utils';
import type { ReadinessLevel } from '@/lib/types';
import { CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, Loader } from 'lucide-react';
import { displayReadinessLevel } from '@/lib/uiCopy';

const levelStyles: Record<ReadinessLevel, { className: string; icon: typeof CheckCircle2 }> = {
  'Not Ready': { className: 'bg-destructive/15 text-destructive border-destructive/40', icon: ShieldAlert },
  'Partially Ready': { className: 'bg-warning/15 text-warning border-warning/40', icon: AlertTriangle },
  'Almost Ready': { className: 'bg-accent/15 text-accent border-accent/40', icon: Loader },
  'AI Coding Ready': { className: 'bg-success/15 text-success border-success/40', icon: CheckCircle2 },
  'AgentReady Certified': { className: 'bg-gradient-primary text-primary-foreground border-transparent', icon: Sparkles },
};

interface Props {
  level: ReadinessLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ReadinessBadge({ level, className, size = 'md' }: Props) {
  const { className: cls, icon: Icon } = levelStyles[level];
  const label = displayReadinessLevel(level);
  const sizes = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
    lg: 'text-base px-4 py-2 gap-2.5',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border font-medium backdrop-blur-sm', cls, sizes[size], className)}>
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {label}
    </span>
  );
}

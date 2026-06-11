import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

export function ScoreGauge({ score, size = 200, label, className }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const colorStops = clamped >= 85
    ? ['hsl(150 80% 55%)', 'hsl(190 95% 60%)']
    : clamped >= 65
    ? ['hsl(190 95% 60%)', 'hsl(258 90% 70%)']
    : clamped >= 40
    ? ['hsl(38 95% 60%)', 'hsl(270 95% 70%)']
    : ['hsl(0 84% 60%)', 'hsl(270 95% 70%)'];

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorStops[0]} />
            <stop offset="100%" stopColor={colorStops[1]} />
          </linearGradient>
          <filter id={`glow-${size}`}>
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(240 14% 14%)" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#grad-${size})`}
          strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter={`url(#glow-${size})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display font-bold leading-none" style={{ fontSize: size * 0.28 }}>
          <span className="text-gradient">{clamped}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">{label ?? `/ 100`}</div>
      </div>
    </div>
  );
}

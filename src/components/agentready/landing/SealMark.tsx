import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

interface SealMarkProps {
  size?: number;
  className?: string;
  /** Text engraved around the ring. */
  ringText?: string;
}

/**
 * The ShipSeal mark: a slowly rotating circular "customs seal" with engraved
 * ring text. Used as the stamp in the hero and as a recurring brand motif.
 */
export function SealMark({
  size = 120,
  className,
  ringText = 'SHIPSEAL \u00B7 DELIVERY PACK \u00B7 NO CODE EXECUTION \u00B7 DETERMINISTIC \u00B7 ',
}: SealMarkProps) {
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="ss-rotate-slow" aria-hidden="true">
        <defs>
          <path id="ss-seal-ring" d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
          <linearGradient id="ss-seal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(258 90% 70%)" />
            <stop offset="100%" stopColor="hsl(190 95% 60%)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="none" stroke="url(#ss-seal-grad)" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.85" />
        <circle cx="60" cy="60" r="33" fill="none" stroke="url(#ss-seal-grad)" strokeWidth="1" opacity="0.7" />
        <text fontSize="9.2" letterSpacing="1.6" fill="hsl(240 10% 88%)" fontFamily="'JetBrains Mono', monospace">
          <textPath href="#ss-seal-ring" startOffset="0">{ringText}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <ShieldCheck className="text-primary-glow" style={{ width: size * 0.3, height: size * 0.3 }} strokeWidth={1.6} />
      </div>
    </div>
  );
}

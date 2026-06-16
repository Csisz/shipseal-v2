import type { CSSProperties } from 'react';
import { AlertTriangle, FileWarning, FolderClosed, FileJson2 } from 'lucide-react';
import { SHIPSEAL_DELIVERY_PACK_MANIFEST } from '@/lib/deliveryPack';
import { SealMark } from './SealMark';

interface Chip {
  label: string;
  warn?: boolean;
  top: string;
  delay: number;
  duration: number;
  rotate: number;
  distance: number;
}

const CHIPS: Chip[] = [
  { label: 'prompt_v3_FINAL.txt', top: '4%', delay: 0, duration: 7, rotate: -6, distance: 250 },
  { label: 'agent.py \u00B7 no tests', top: '20%', delay: 1.1, duration: 7.6, rotate: 4, distance: 235 },
  { label: '.env committed', warn: true, top: '36%', delay: 2.3, duration: 7.2, rotate: -3, distance: 255 },
  { label: 'demo-hack.js', top: '52%', delay: 0.6, duration: 8, rotate: 7, distance: 230 },
  { label: 'notes/todo.md', top: '68%', delay: 3.1, duration: 7.4, rotate: -8, distance: 248 },
  { label: 'no transparency notice', warn: true, top: '84%', delay: 1.9, duration: 7.8, rotate: 3, distance: 238 },
];

/**
 * The Seal Chamber: a continuously running conveyor where unstructured
 * prototype files drift into the scan beam and dissolve, while the real
 * ShipSeal Delivery Pack structure assembles on the other side and the
 * ShipSeal mark stamps it. Folder names come from the live pack manifest.
 */
export function SealChamberHero() {
  const folders = SHIPSEAL_DELIVERY_PACK_MANIFEST.sections.map(s => s.folder);

  return (
    <div className="relative glass-strong rounded-3xl p-5 md:p-7 shadow-elegant overflow-hidden" aria-label="Animation: unstructured AI project files are scanned and sealed into a structured project package">
      <div className="absolute -inset-10 bg-gradient-primary opacity-15 blur-3xl rounded-full pointer-events-none" />

      {/* Chamber header */}
      <div className="relative flex items-center justify-between gap-3 mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seal chamber {'\u00B7'} local scan</div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-glow-pulse" /> scanning
        </div>
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1.15fr] gap-3 md:gap-5 items-stretch min-h-[300px] md:min-h-[340px]">
        {/* Left: the messy prototype */}
        <div className="relative overflow-hidden" aria-hidden="true">
          {CHIPS.map(chip => (
            <div
              key={chip.label}
              className="ss-chip absolute left-0 inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/70 px-2 py-1 font-mono text-[10px] md:text-[11px] whitespace-nowrap text-foreground/80"
              style={{
                top: chip.top,
                '--chip-delay': `${chip.delay}s`,
                '--chip-dur': `${chip.duration}s`,
                '--chip-rot': `${chip.rotate}deg`,
                '--chip-dist': `min(${chip.distance}px, 34vw)`,
              } as CSSProperties}
            >
              {chip.warn ? <AlertTriangle className="h-3 w-3 text-warning shrink-0" /> : <FileWarning className="h-3 w-3 text-muted-foreground shrink-0" />}
              {chip.label}
            </div>
          ))}
          <div className="absolute bottom-0 left-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">prototype</div>
        </div>

        {/* Center: the scan beam */}
        <div className="relative w-px md:w-[2px] bg-gradient-to-b from-transparent via-accent/60 to-transparent" aria-hidden="true">
          <div className="absolute -inset-x-3 inset-y-0 overflow-hidden">
            <div className="ss-beam-sweep absolute inset-x-0 top-1/2 h-16 bg-gradient-to-b from-transparent via-accent/35 to-transparent blur-sm" />
          </div>
          <div className="absolute -left-[5px] md:-left-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_18px_hsl(190_95%_55%/0.9)]" />
        </div>

        {/* Right: the sealed Delivery Pack */}
        <div className="relative">
          <div className="rounded-2xl border border-border/70 bg-[hsl(240_20%_4%)]/90 p-3 md:p-4 font-mono text-[10.5px] md:text-xs leading-relaxed">
            <div className="ss-row text-muted-foreground mb-1.5" style={{ '--row-delay': '0.2s' } as CSSProperties}>
              shipseal-delivery-pack-[project]/
            </div>
            {folders.map((folder, index) => (
              <div
                key={folder}
                className="ss-row flex items-center gap-1.5 py-[1px] text-foreground/85"
                style={{ '--row-delay': `${0.45 + index * 0.22}s` } as CSSProperties}
              >
                <FolderClosed className="h-3 w-3 text-primary-glow shrink-0" />
                {folder}/
              </div>
            ))}
            <div className="ss-row flex items-center gap-1.5 py-[1px] text-accent" style={{ '--row-delay': `${0.45 + folders.length * 0.22}s` } as CSSProperties}>
              <FileJson2 className="h-3 w-3 shrink-0" />
              score.json
            </div>
          </div>

          {/* The stamp */}
          <div className="ss-stamp absolute -top-4 -right-2 md:-top-6 md:-right-4" style={{ '--stamp-delay': '2.5s' } as CSSProperties}>
            <div className="relative">
              <SealMark size={96} className="drop-shadow-[0_0_24px_hsl(258_90%_66%/0.45)]" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="sr-only">Sealed for handoff</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 right-0 translate-y-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">project package</div>
        </div>
      </div>

      {/* Chamber footer ticks */}
      <div className="relative mt-7 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
        {['structure', 'docs', 'tests', 'security', 'governance'].map((tick, index) => (
          <span key={tick} className="ss-tick inline-flex items-center gap-1.5" style={{ '--tick-delay': `${0.8 + index * 0.35}s` } as CSSProperties}>
            <span className="h-1 w-1 rounded-full bg-success" /> {tick} checked
          </span>
        ))}
      </div>
    </div>
  );
}

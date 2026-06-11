import { useState, type CSSProperties } from 'react';
import { ChevronRight, FileCode2, FileJson2, FileText, FolderClosed, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIPSEAL_DELIVERY_PACK_MANIFEST } from '@/lib/deliveryPack';
import type { DeliveryPackSectionId } from '@/lib/deliveryPack';

const SECTION_COPY: Record<string, { headline: string; body: string }> = {
  'agent-instructions': {
    headline: 'Instructions AI coding agents can actually follow',
    body: 'AGENTS.md and CLAUDE.md describe the repository, its commands, and its guardrails so coding agents work safely. CODEX_PROMPTS.md and REVIEWER_PROMPT.md give your team ready-to-use prompts for implementation and review.',
  },
  skills: {
    headline: 'Reusable SKILL.md packs',
    body: 'Five skill files for recurring delivery tasks: code review, test generation, AI Act readiness, release checks, and client handoff. Drop them into agent workflows that support skills.',
  },
  'mcp-governance': {
    headline: 'A governance starting point for MCP adoption',
    body: 'Readiness notes, a security policy, server recommendations, and a tool allowlist for teams introducing Model Context Protocol integrations. Governance documentation, not a substitute for the readiness rule.',
  },
  testing: {
    headline: 'Evidence the project was actually tested',
    body: '30 eval test cases, 10 red-team prompts, a testing strategy, and a CI quality gate workflow. The part most AI prototypes are missing when the client asks "how do you know it works?"',
  },
  'ai-act-readiness': {
    headline: 'AI Act readiness, organized — not legal advice',
    body: 'A preliminary readiness checklist, a transparency notice draft, and concrete legal review questions to bring to a qualified professional. Technical and product-side preparation only.',
  },
  'client-handoff': {
    headline: 'The report your client actually reads',
    body: 'A white-label client handoff report in Markdown and print-ready HTML, an executive summary, and a 30/60/90-day next steps roadmap. Exportable as PDF from the dashboard.',
  },
  context: {
    headline: 'Sanitized repo context for future work',
    body: 'A structured, sanitized context pack in Markdown and JSON, so the next developer — or the next agent — starts with real project knowledge instead of archaeology.',
  },
};

const FILE_ICONS: Record<string, typeof FileText> = {
  json: FileJson2,
  yaml: FileCode2,
  html: FileCode2,
};

/**
 * Interactive explorer for the ShipSeal Delivery Pack. The folder and file
 * structure is imported directly from the live pack manifest so the landing
 * page can never drift from what the product actually exports.
 */
export function DeliveryPackExplorer() {
  const sections = SHIPSEAL_DELIVERY_PACK_MANIFEST.sections;
  const [activeId, setActiveId] = useState<DeliveryPackSectionId>(sections[0].id);
  const active = sections.find(section => section.id === activeId) ?? sections[0];
  const copy = SECTION_COPY[active.id] ?? { headline: active.label, body: '' };

  return (
    <div className="glass-strong rounded-3xl overflow-hidden shadow-elegant">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5 text-primary-glow" />
        {SHIPSEAL_DELIVERY_PACK_MANIFEST.packNameTemplate}.zip
      </div>
      <div className="grid md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr]">
        {/* Folder tree */}
        <div className="border-b md:border-b-0 md:border-r border-border/60 p-2 font-mono text-xs">
          {sections.map(section => {
            const isActive = section.id === active.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                aria-pressed={isActive}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all',
                  isActive
                    ? 'bg-primary/15 text-foreground border border-primary/40'
                    : 'text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary/60',
                )}
              >
                {isActive
                  ? <FolderOpen className="h-3.5 w-3.5 text-primary-glow shrink-0" />
                  : <FolderClosed className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{section.folder}/</span>
                <ChevronRight className={cn('h-3 w-3 ml-auto shrink-0 transition-transform', isActive && 'rotate-90 text-primary-glow')} />
              </button>
            );
          })}
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-accent">
            <FileJson2 className="h-3.5 w-3.5 shrink-0" />
            score.json
          </div>
        </div>

        {/* Section detail */}
        <div className="p-5 md:p-7 min-h-[300px]">
          <div key={active.id} className="animate-fade-in">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary-glow">{active.label}</div>
            <h3 className="font-display text-lg md:text-xl font-semibold mt-1.5">{copy.headline}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">{copy.body}</p>
            <div className="mt-5 grid sm:grid-cols-2 gap-2">
              {active.files.map((file, index) => {
                const Icon = FILE_ICONS[file.kind] ?? FileText;
                return (
                  <div
                    key={file.path}
                    className="ss-tick flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 font-mono text-[11px] text-foreground/85"
                    style={{ '--tick-delay': `${index * 0.06}s` } as CSSProperties}
                  >
                    <Icon className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="truncate">{file.filename}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ReadinessReport } from '@/lib/types';

export function ScanCoverageDisclosure({
  report,
  compact = false,
  centered = false,
}: {
  report: ReadinessReport;
  compact?: boolean;
  centered?: boolean;
}) {
  const discovered = report.scanSummary.discoveredFiles ?? report.scanSummary.totalFilesFound;
  const analyzed = report.scanSummary.analyzedTextFiles ?? report.scanSummary.filesAnalyzed;
  const excluded = report.scanSummary.filesIgnored;
  const reason = boundedReasonLabel(report.scanSummary.boundedReasons?.[0]);

  return (
    <Collapsible
      className={`${compact ? 'mt-2' : 'mt-3'} max-w-3xl`}
      data-testid="bounded-coverage-disclosure"
    >
      <div className={`flex flex-wrap items-center gap-2 ${centered ? 'justify-center' : ''}`} role="status">
        <Badge variant="secondary">Bounded analysis</Badge>
        <span className="text-xs font-medium text-foreground sm:text-sm">
          {analyzed.toLocaleString()} of {discovered.toLocaleString()} files analyzed
        </span>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
            Why?
            <ChevronDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-1 rounded-xl border border-border/55 bg-secondary/15 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground">
          <p>{reason}</p>
          <p>
            ShipSeal discovered {discovered.toLocaleString()} files, analyzed {analyzed.toLocaleString()} deterministic high-value evidence files, and excluded {excluded.toLocaleString()} files from content analysis. Unanalyzed content is treated as unobserved, not absent.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function boundedReasonLabel(reason?: string) {
  switch (reason) {
    case 'selected-file-budget':
      return 'Large repository - deterministic high-value evidence selection reached the safe file budget.';
    case 'readable-byte-budget':
      return 'Large repository - deterministic high-value evidence selection reached the safe readable-byte budget.';
    case 'repository-discovery-incomplete':
      return 'Repository discovery was incomplete, so conclusions remain scoped to the available evidence.';
    default:
      return 'Large repository - ShipSeal selected a deterministic high-value evidence set within the safe analysis budget.';
  }
}

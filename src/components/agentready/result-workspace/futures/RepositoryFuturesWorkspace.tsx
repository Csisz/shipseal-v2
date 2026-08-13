import type { ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import type { ReadinessReport } from '@/lib/types';
import type {
  RepositoryIntelligenceProviderStatus,
  RepositoryProductIntelligenceResult,
} from '@/lib/repositoryIntelligence';
import type { RepositoryUniverseModel } from '@/lib/workspace';
import { ResultWorkspaceDisclosure } from '../ResultWorkspaceDisclosure';
import RepositoryFuturePathways from './RepositoryFuturePathways';

interface RepositoryFuturesWorkspaceProps {
  report: ReadinessReport;
  repositoryModel: RepositoryUniverseModel;
  productIntelligence?: RepositoryProductIntelligenceResult | null;
  productIntelligenceStatus?: RepositoryIntelligenceProviderStatus;
  secondaryContent?: ReactNode;
  secondaryOpen?: boolean;
}

/**
 * Owns the projected-state product surface. RepositoryUniverseModel is shared
 * intelligence data; no Project Universe renderer is imported or mounted here.
 */
export default function RepositoryFuturesWorkspace({
  report,
  repositoryModel,
  productIntelligence,
  productIntelligenceStatus,
  secondaryContent,
  secondaryOpen = false,
}: RepositoryFuturesWorkspaceProps) {
  return (
    <section
      aria-labelledby="repository-futures-heading"
      data-testid="repository-futures-workspace"
      data-futures-environment="cinematic-field"
      className="relative w-full overflow-hidden bg-workspace pb-10"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_72%_0%,hsl(var(--primary)/0.1),transparent_44%),radial-gradient(circle_at_18%_8%,hsl(var(--accent)/0.055),transparent_38%)]" />
      <div className="relative mx-auto w-full max-w-[1680px] px-3 pb-4 pt-3 sm:px-5 md:px-7 md:pt-5">
        <header className="mb-3 max-w-3xl motion-safe:animate-fade-in-up motion-reduce:animate-none md:mb-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-glow">
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" /> Repository Futures
          </div>
          <h1 id="repository-futures-heading" className="mt-1.5 font-display text-[1.75rem] font-semibold tracking-[-0.035em] sm:text-3xl md:text-[2.15rem]">
            Explore what this project could become.
          </h1>
          <p className="mt-1.5 truncate text-xs text-muted-foreground sm:text-sm">
            {report.repoName} · {productIntelligence?.opportunities.length
              ? `${productIntelligence.opportunities.length} grounded directions`
              : 'grounded directions from the current scan'}
          </p>
        </header>

        <div data-testid="repository-futures-stage" data-primary-surface="neural-canvas" className="min-h-[64dvh]">
          <RepositoryFuturePathways
            report={report}
            universe={repositoryModel}
            productIntelligence={productIntelligence}
            providerStatus={productIntelligenceStatus}
          />
        </div>

        {secondaryContent && (
          <div className="mt-6" data-secondary-surface="other-improvements">
            <ResultWorkspaceDisclosure title="Other improvements" defaultOpen={secondaryOpen} lazyMount>
              {secondaryContent}
            </ResultWorkspaceDisclosure>
          </div>
        )}
      </div>
    </section>
  );
}

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
      data-futures-environment="full-stage"
      className="relative min-h-[calc(100dvh-3rem)] w-full overflow-x-clip bg-workspace pb-10"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_8%,hsl(var(--primary)/0.1),transparent_34%),radial-gradient(circle_at_18%_18%,hsl(var(--accent)/0.055),transparent_32%),linear-gradient(180deg,hsl(var(--workspace)/0.34),transparent_46%)]" />
      <div className="relative mx-auto w-full max-w-[1920px] pb-4 pt-3 md:pt-5">
        <header className="mb-3 max-w-3xl px-4 motion-safe:animate-fade-in-up motion-reduce:animate-none sm:px-6 md:mb-4 lg:px-8">
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

        <div data-testid="repository-futures-stage" data-primary-surface="neural-canvas" data-stage-shell="immersive" className="min-h-[72dvh] w-full">
          <RepositoryFuturePathways
            report={report}
            universe={repositoryModel}
            productIntelligence={productIntelligence}
            providerStatus={productIntelligenceStatus}
          />
        </div>

        {secondaryContent && (
          <div className="mx-auto mt-6 w-full max-w-[1680px] px-4 sm:px-6 lg:px-8" data-secondary-surface="other-improvements">
            <ResultWorkspaceDisclosure title="Other improvements" defaultOpen={secondaryOpen} lazyMount>
              {secondaryContent}
            </ResultWorkspaceDisclosure>
          </div>
        )}
      </div>
    </section>
  );
}

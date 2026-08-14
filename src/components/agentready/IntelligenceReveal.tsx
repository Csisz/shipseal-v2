import { useEffect } from 'react';
import type { ReadinessReport } from '@/lib/types';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { RepositoryFormation } from './RepositoryFormation';

interface Props {
  report: ReadinessReport;
  futuresReady?: boolean;
  statusMessage?: string;
  onComplete: () => void;
}

const READY_TRANSITION_MS = 720;

export function IntelligenceReveal({ report, futuresReady = true, statusMessage, onComplete }: Props) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!futuresReady) return undefined;
    const timer = window.setTimeout(onComplete, reducedMotion ? 0 : READY_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [futuresReady, onComplete, reducedMotion, report.repoName, report.scannedAt]);

  return (
    <main className="relative min-h-screen bg-workspace">
      <ThemeToggle className="absolute left-5 top-5 z-[var(--layer-toolbar)]" />
      <RepositoryFormation
        repositoryName={report.repoName}
        sourceLabel={report.source.sourceType === 'github-app' ? 'Connected GitHub' : report.source.sourceType.startsWith('github') ? 'GitHub repository' : 'Repository scan'}
        stage={futuresReady ? 'ready' : 'projecting'}
        title={futuresReady ? 'Your repository intelligence is ready' : 'Forming future pathways'}
        action={futuresReady ? 'The grounded perspectives are ready to explore.' : statusMessage || 'Connecting repository evidence to grounded future directions.'}
        fullScreen
      />
    </main>
  );
}

function usePrefersReducedMotion() {
  const reduced = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ResultWorkspace } from '@/components/agentready/ResultWorkspace';
import type { RepositoryIntelligenceProviderStatus } from '@/lib/repositoryIntelligence';
import { futuresQaProductIntelligence, futuresQaReport } from './RepositoryFuturesLayoutQa';

const failureStatus: RepositoryIntelligenceProviderStatus = {
  state: 'fallback',
  deepState: 'rejected',
  message: 'ShipSeal couldn’t validate this Future analysis.',
  retryable: true,
  category: 'schema_validation_failed',
  diagnostics: {
    requestId: 'ri-roots-qa-safe-ref',
    requestFingerprint: 'qa-fingerprint',
    productStage: 'roots',
    operationalFailureCategory: 'roots_schema_failed',
    failureBoundary: 'schema-validation',
    compactOpportunityContract: 'roots',
    compactOpportunityShapeRejectedCount: 7,
    compactOpportunityShapeIssueFields: ['evo'],
    costEstimate: 'unavailable',
  },
};

export default function RepositoryFutureRecoveryQa() {
  const [status, setStatus] = useState<RepositoryIntelligenceProviderStatus>(failureStatus);
  const [retryCount, setRetryCount] = useState(0);
  const isReady = status.state === 'enhanced';

  useEffect(() => {
    if (status.state !== 'preparing' || !status.rateLimitRetryAt) return;
    const delayMs = Math.max(0, status.rateLimitRetryAt - Date.now());
    const timer = window.setTimeout(() => setStatus({
      state: 'enhanced', deepState: 'completed', message: 'Future analysis ready.', retryable: false, providerId: 'qa-provider',
      diagnostics: { costEstimate: 'unavailable', rateLimitAttempt: 1, rateLimitRecoveryStatus: 'recovered' },
    }), delayMs);
    return () => window.clearTimeout(timer);
  }, [status]);

  const retry = async () => {
    setRetryCount(count => count + 1);
    setStatus({
      state: 'preparing',
      deepState: 'pending',
      message: 'Building future pathways · 2 of 3 pathway groups complete',
      retryable: false,
      productStage: 'expansion',
      completedBatches: 2,
      totalBatches: 3,
      activeBatchIndexes: [2],
    });
  };

  return (
    <main className="min-h-screen bg-workspace text-foreground" data-testid="repository-future-recovery-qa">
      <div className="fixed bottom-3 left-3 z-[100] flex max-w-[calc(100vw-5rem)] items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <span data-testid="qa-scan-count">Repository scans 1</span>
        <span data-testid="qa-retry-count">Future retries {retryCount}</span>
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1.5"
          onClick={() => setStatus({
            state: 'preparing', deepState: 'pending', retryable: false,
            productStage: 'expansion', completedBatches: 1, totalBatches: 3, activeBatchIndexes: [],
            message: 'Future analysis is waiting for AI capacity. ShipSeal will retry automatically.',
            rateLimitRetryAt: Date.now() + 4_000, rateLimitAttempt: 1,
          })}
        >
          Simulate capacity wait
        </button>
        {status.state === 'preparing' ? (
          <button
            type="button"
            className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
            onClick={() => setStatus({ state: 'enhanced', deepState: 'completed', message: 'Future analysis ready.', retryable: false, providerId: 'qa-provider' })}
          >
            Complete controlled batch
          </button>
        ) : null}
        {isReady ? (
          <button type="button" className="rounded-full border border-border px-3 py-1.5" onClick={() => setStatus(failureStatus)}>
            Reset Future failure
          </button>
        ) : null}
      </div>
      <div className="fixed bottom-3 right-3 z-[100]"><ThemeToggle /></div>
      <ResultWorkspace
        report={futuresQaReport}
        history={[]}
        onReset={() => undefined}
        onClearHistory={() => undefined}
        repositoryProductIntelligence={isReady ? futuresQaProductIntelligence : null}
        repositoryProductIntelligenceStatus={status}
        retryRepositoryProductIntelligence={retry}
      />
    </main>
  );
}

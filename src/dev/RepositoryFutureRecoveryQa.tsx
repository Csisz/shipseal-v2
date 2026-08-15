import { useState } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ResultWorkspace } from '@/components/agentready/ResultWorkspace';
import type { RepositoryIntelligenceProviderStatus } from '@/lib/repositoryIntelligence';
import { futuresQaProductIntelligence, futuresQaReport } from './RepositoryFuturesLayoutQa';

const failureStatus: RepositoryIntelligenceProviderStatus = {
  state: 'fallback',
  deepState: 'failed',
  message: 'Future analysis took longer than expected.',
  retryable: true,
  category: 'request_timeout',
  diagnostics: {
    requestId: 'ri-roots-qa-safe-ref',
    requestFingerprint: 'qa-fingerprint',
    productStage: 'roots',
    operationalFailureCategory: 'provider_timeout',
    failureBoundary: 'provider-generation',
    providerTimedOut: true,
    costEstimate: 'unavailable',
  },
};

export default function RepositoryFutureRecoveryQa() {
  const [status, setStatus] = useState<RepositoryIntelligenceProviderStatus>(failureStatus);
  const [retryCount, setRetryCount] = useState(0);
  const isReady = status.state === 'enhanced';

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

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSampleReport } from '@/lib/readiness';
import type { RepoScanInput } from '@/lib/types';

const lifecycleMocks = vi.hoisted(() => ({
  scan: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@/lib/scanEngine', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/scanEngine')>();
  return { ...actual, localScanEngine: { scan: lifecycleMocks.scan } };
});

vi.mock('@/lib/repositoryIntelligence/deepIntelligenceClient', () => ({
  RepositoryIntelligenceEnhancementSingleFlight: class {
    private active: Promise<void> | null = null;
    run(task: () => Promise<void>) {
      if (this.active) return this.active;
      const active = task().finally(() => {
        if (this.active === active) this.active = null;
      });
      this.active = active;
      return active;
    }
  },
  requestRepositoryIntelligenceEnhancement: lifecycleMocks.request,
  requestRepositoryProductIntelligenceStaged: lifecycleMocks.request,
}));

import { useRepoScan } from '@/hooks/useRepoScan';

const scanInput: RepoScanInput = {
  repoName: 'formation-fixture',
  source: { sourceType: 'zip-upload' },
  files: [
    { path: 'README.md', size: 42 },
    { path: 'package.json', size: 64 },
    { path: 'src/main.ts', size: 28 },
  ],
  textContents: {
    'README.md': '# Formation fixture\nA small product repository.',
    'package.json': JSON.stringify({ scripts: { build: 'vite build', test: 'vitest run' } }),
    'src/main.ts': 'export const ready = true;',
  },
  scanSummary: {
    scanMode: 'full', limited: false, totalFilesFound: 3, filesAnalyzed: 3, filesIgnored: 0,
    generatedVendorFilesIgnored: 0, binaryFilesIgnored: 0, readableTextBytesAnalyzed: 134,
    ignoredGeneratedFolders: [], warnings: [],
    limits: { maxZipSizeBytes: 1_000_000, maxFileCount: 100, maxReadableTextFileSizeBytes: 100_000, maxTotalReadableTextBytes: 1_000_000, maxPathLength: 200, maxGeneratedFolderDepth: 8 },
  },
};

function enhancedResponse() {
  return {
    version: 'shipseal.repository-intelligence-provider.v1',
    state: 'enhanced',
    result: {
      productIntelligence: {
        fingerprint: 'product-intelligence-fixture',
        opportunities: [{ id: 'opportunity-1', title: 'Guided formation recovery' }],
      },
    },
    providerId: 'fixture-provider',
    modelId: 'fixture-model',
    deepState: 'completed',
    diagnostics: { cacheUsed: false },
  };
}

function timeoutResponse() {
  return {
    version: 'shipseal.repository-intelligence-provider.v1',
    state: 'fallback',
    category: 'request_timeout',
    retryable: true,
    message: 'Future analysis is taking longer than expected.',
    deepState: 'timed-out',
  };
}

describe('report-scoped Product Intelligence lifecycle', () => {
  beforeEach(() => {
    lifecycleMocks.scan.mockReset();
    lifecycleMocks.request.mockReset();
    lifecycleMocks.scan.mockImplementation(async (_input, callbacks) => {
      callbacks?.onScanInput?.(scanInput);
      return buildSampleReport();
    });
  });

  it('starts above the selector gate exactly once per report and reaches enhanced', async () => {
    let resolveRequest!: (value: ReturnType<typeof enhancedResponse>) => void;
    lifecycleMocks.request.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
    const { result, rerender } = renderHook(() => useRepoScan());

    await act(async () => { await result.current.startScan(new File(['zip'], 'fixture.zip')); });
    await waitFor(() => expect(lifecycleMocks.request).toHaveBeenCalledTimes(1), { timeout: 10_000 });
    expect(result.current.repositoryProductIntelligenceStatus.state).toBe('preparing');

    rerender();
    act(() => { void result.current.prepareRepositoryProductIntelligence(); });
    expect(lifecycleMocks.request).toHaveBeenCalledTimes(1);

    await act(async () => { resolveRequest(enhancedResponse()); });
    await waitFor(() => expect(result.current.repositoryProductIntelligenceStatus.state).toBe('enhanced'));
    expect(result.current.repositoryProductIntelligence?.opportunities).toHaveLength(1);

    lifecycleMocks.scan.mockImplementationOnce(async (_input, callbacks) => {
      callbacks?.onScanInput?.({ ...scanInput, repoName: 'second-report' });
      return { ...buildSampleReport(), repoName: 'second-report', scannedAt: '2026-08-14T09:00:00.000Z' };
    });
    lifecycleMocks.request.mockResolvedValueOnce(enhancedResponse());
    await act(async () => { await result.current.startScan(new File(['zip'], 'second.zip')); });
    await waitFor(() => expect(lifecycleMocks.request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.repositoryProductIntelligenceStatus.state).toBe('enhanced'));
  });

  it('turns provider exceptions and timeouts into terminal recoverable states', async () => {
    lifecycleMocks.request.mockRejectedValueOnce(new Error('provider exploded'));
    const first = renderHook(() => useRepoScan());
    await act(async () => { await first.result.current.startScan(new File(['zip'], 'exception.zip')); });
    await waitFor(() => expect(first.result.current.repositoryProductIntelligenceStatus.state).toBe('fallback'));
    expect(first.result.current.repositoryProductIntelligenceStatus).toMatchObject({ retryable: true, category: 'provider_unavailable' });
    first.unmount();

    lifecycleMocks.request.mockResolvedValueOnce(timeoutResponse());
    const second = renderHook(() => useRepoScan());
    await act(async () => { await second.result.current.startScan(new File(['zip'], 'timeout.zip')); });
    await waitFor(() => expect(second.result.current.repositoryProductIntelligenceStatus).toMatchObject({ state: 'fallback', category: 'request_timeout' }));
    expect(second.result.current.repositoryProductIntelligenceStatus.message).toBe('Future analysis took longer than expected.');
  });

  it('terminates cancellation and issues a new provider request on retry', async () => {
    lifecycleMocks.request.mockImplementationOnce((_request, options: { signal?: AbortSignal }) => new Promise(resolve => {
      options.signal?.addEventListener('abort', () => resolve(timeoutResponse()), { once: true });
    }));
    lifecycleMocks.request.mockResolvedValueOnce(enhancedResponse());
    const { result } = renderHook(() => useRepoScan());

    await act(async () => { await result.current.startScan(new File(['zip'], 'cancel.zip')); });
    await waitFor(() => expect(result.current.repositoryProductIntelligenceStatus.state).toBe('preparing'));
    act(() => result.current.cancelRepositoryProductIntelligence());
    await waitFor(() => expect(result.current.repositoryProductIntelligenceStatus.state).toBe('cancelled'));

    await act(async () => { await result.current.retryRepositoryProductIntelligence(); });
    await waitFor(() => expect(result.current.repositoryProductIntelligenceStatus.state).toBe('enhanced'));
    expect(lifecycleMocks.request).toHaveBeenCalledTimes(2);
  });
});

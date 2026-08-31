import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScanProgress } from '@/components/agentready/ScanProgress';
import { RepositoryFormation } from '@/components/agentready/RepositoryFormation';
import { resolveRepositoryFormationPhase } from '@/lib/workspace/repositoryFormationPipeline';

const steps = ['Reading archive', 'Building intelligence', 'Preparing workspace'] as const;

describe('unified repository formation experience', () => {
  it('derives one calm formation phase from the real scanner lifecycle', () => {
    const { rerender } = render(<ScanProgress steps={steps} currentStepIndex={1} progress={48} />);
    expect(screen.getByTestId('repository-formation')).toHaveAttribute('data-formation-stage', 'understanding');
    expect(screen.getByRole('heading', { name: 'Forming repository intelligence' })).toBeInTheDocument();
    expect(screen.getByText('Building intelligence')).toBeInTheDocument();
    expect(screen.queryByText('Files found')).not.toBeInTheDocument();

    rerender(<ScanProgress steps={steps} currentStepIndex={2} progress={96} />);
    expect(screen.getByTestId('repository-formation')).toHaveAttribute('data-formation-stage', 'understanding');
    expect(screen.getAllByText('Understanding the project').length).toBeGreaterThan(0);
  });

  it('shows truthful progress without information cards or animation timers', () => {
    const timeout = vi.spyOn(window, 'setTimeout');
    render(<ScanProgress steps={steps} currentStepIndex={1} progress={48.4} discoveredFileCount={120} analyzedFileCount={97} repositoryLabel="acme/repository" sourceLabel="Connected GitHub" />);

    expect(screen.getByRole('progressbar', { name: 'Repository scan progress' })).toHaveAttribute('aria-valuenow', '48');
    expect(screen.getByText('97 of 120 files understood')).toBeInTheDocument();
    expect(screen.getByText('acme/repository')).toBeInTheDocument();
    expect(screen.getByText(/repository code is never executed/i)).toBeInTheDocument();
    expect(timeout).not.toHaveBeenCalled();
  });

  it('maps all five product-facing phases to observable pipeline state', () => {
    const base = {
      scanStatus: 'completed' as const,
      currentScanStep: null,
      repositoryIntelligenceReady: true,
      productStatus: { state: 'enhanced' as const, message: 'ready', retryable: false as const, providerId: 'fixture' },
      productIntelligenceReady: true,
      futurePreparationState: 'ready' as const,
    };
    expect(resolveRepositoryFormationPhase({ ...base, scanStatus: 'scanning', currentScanStep: 'Reading repository' })).toBe('reading');
    expect(resolveRepositoryFormationPhase({ ...base, scanStatus: 'scanning', currentScanStep: 'Building repository intelligence' })).toBe('understanding');
    expect(resolveRepositoryFormationPhase({ ...base, productStatus: { state: 'preparing', message: 'working', retryable: false }, productIntelligenceReady: false })).toBe('directions');
    expect(resolveRepositoryFormationPhase({ ...base, productStatus: { state: 'preparing', productStage: 'expansion', completedBatches: 2, totalBatches: 3, message: '2 of 3 pathway groups complete', retryable: false }, productIntelligenceReady: false })).toBe('pathways');
    expect(resolveRepositoryFormationPhase({ ...base, futurePreparationState: 'building' })).toBe('pathways');
    expect(resolveRepositoryFormationPhase({ ...base, futurePreparationState: 'preparing-workspace' })).toBe('workspace');
    expect(resolveRepositoryFormationPhase(base)).toBe('ready');
  });

  it('uses indeterminate provider activity, exposes a quiet long-running cue, and offers recovery', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    try {
      const { rerender } = render(<RepositoryFormation repositoryName="fixture" stage="directions" title="Forming repository intelligence" action="Analysing product directions." />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
      expect(document.querySelector('.repository-formation-active-trace')).toBeInTheDocument();
      expect(document.querySelector('.repository-formation-orbit')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(8_000));
      expect(screen.getByTestId('formation-long-running')).toHaveTextContent(/Still working on product directions/i);

      rerender(<RepositoryFormation repositoryName="fixture" stage="directions" title="Forming repository intelligence" action="" failure={{ message: 'Future analysis is taking longer than expected.', onRetry }} />);
      expect(document.querySelector('.repository-formation-active-trace')).not.toBeInTheDocument();
      expect(document.querySelector('.repository-formation-orbit')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retry Future analysis' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('repository-formation')).toHaveAttribute('aria-busy', 'false');
    } finally {
      vi.useRealTimers();
    }
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScanProgress } from '@/components/agentready/ScanProgress';

const steps = ['Reading archive', 'Building intelligence', 'Preparing workspace'] as const;

describe('unified repository formation experience', () => {
  it('derives one calm formation phase from the real scanner lifecycle', () => {
    const { rerender } = render(<ScanProgress steps={steps} currentStepIndex={1} progress={48} />);
    expect(screen.getByTestId('repository-formation')).toHaveAttribute('data-formation-stage', 'connecting');
    expect(screen.getByRole('heading', { name: 'Forming repository intelligence' })).toBeInTheDocument();
    expect(screen.getByText('Building intelligence')).toBeInTheDocument();
    expect(screen.queryByText('Files found')).not.toBeInTheDocument();

    rerender(<ScanProgress steps={steps} currentStepIndex={2} progress={96} />);
    expect(screen.getByTestId('repository-formation')).toHaveAttribute('data-formation-stage', 'projecting');
    expect(screen.getAllByText('Project').length).toBeGreaterThan(0);
  });

  it('shows truthful progress without information cards or animation timers', () => {
    const timeout = vi.spyOn(window, 'setTimeout');
    render(<ScanProgress steps={steps} currentStepIndex={1} progress={48.4} discoveredFileCount={120} analyzedFileCount={97} repositoryLabel="acme/repository" sourceLabel="Connected GitHub" />);

    expect(screen.getByRole('progressbar', { name: 'Repository intelligence progress' })).toHaveAttribute('aria-valuenow', '48');
    expect(screen.getByText('97 of 120 files understood')).toBeInTheDocument();
    expect(screen.getByText('acme/repository')).toBeInTheDocument();
    expect(screen.getByText(/repository code is never executed/i)).toBeInTheDocument();
    expect(timeout).not.toHaveBeenCalled();
  });
});

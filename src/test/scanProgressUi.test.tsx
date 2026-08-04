import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScanProgress } from '@/components/agentready/ScanProgress';

const steps = ['Reading archive', 'Building intelligence', 'Preparing workspace'] as const;

describe('truthful repository scan visualization', () => {
  it('derives completed, active, and pending nodes only from the scanner lifecycle', () => {
    const { rerender } = render(<ScanProgress steps={steps} currentStepIndex={1} progress={48} />);
    expect(screen.getAllByLabelText('Reading archive: complete').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Building intelligence: active').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Preparing workspace: pending').length).toBeGreaterThan(0);

    rerender(<ScanProgress steps={steps} currentStepIndex={2} progress={96} />);
    expect(screen.getAllByLabelText('Preparing workspace: complete').length).toBeGreaterThan(0);
  });

  it('shows real progress and file counters without adding animation timers', () => {
    const timeout = vi.spyOn(window, 'setTimeout');
    render(<ScanProgress steps={steps} currentStepIndex={1} progress={48.4} discoveredFileCount={120} analyzedFileCount={97} repositoryLabel="acme/repository" sourceLabel="Connected GitHub" />);

    expect(screen.getByRole('progressbar', { name: 'Repository scan progress' })).toHaveAttribute('aria-valuenow', '48');
    expect(screen.getAllByLabelText('Building intelligence: active').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Preparing workspace: pending').length).toBeGreaterThan(0);
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('97')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(timeout).not.toHaveBeenCalled();
  });
});

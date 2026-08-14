import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntelligenceReveal } from '@/components/agentready/IntelligenceReveal';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { buildIntelligenceRevealModel } from '@/lib/workspace/intelligenceReveal';

describe('Intelligence Reveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a deterministic reveal model from real report evidence', () => {
    const model = buildIntelligenceRevealModel(buildSampleReport());

    expect(model.repositoryName).toBe('sample-nextjs-app');
    expect(model.primaryMessage).toBe('Understanding repository structure');
    expect(model.signals).toHaveLength(6);
    expect(model.signals.find(signal => signal.id === 'documentation')?.evidence).toEqual(expect.arrayContaining(['README.md']));
    expect(model.signals.find(signal => signal.id === 'projectMemory')?.evidence).toEqual(expect.arrayContaining(['AGENTS.md']));
    expect(model.signals.find(signal => signal.id === 'verification')?.evidence.join('\n')).toMatch(/Vitest|Playwright|test/i);
    expect(model.signals.find(signal => signal.id === 'context')?.evidence.join('\n')).toMatch(/\.gitignore|Ignored:/i);
    expect(model.signals.every(signal => signal.evidence.length > 0)).toBe(true);
  });

  it('labels thin or missing evidence as heuristic instead of fabricating files', () => {
    const report = buildReport({
      repoName: 'thin-repo',
      files: [
        { path: 'package.json', size: 120 },
        { path: 'src/main.ts', size: 80 },
      ],
      textContents: {
        'package.json': JSON.stringify({ scripts: { build: 'vite build' } }),
      },
    });

    const model = buildIntelligenceRevealModel(report);
    const projectMemory = model.signals.find(signal => signal.id === 'projectMemory');

    expect(model.signals.length).toBeGreaterThanOrEqual(4);
    expect(projectMemory?.kind).toBe('heuristic');
    expect(projectMemory?.evidence.join('\n')).toMatch(/No root AGENTS\.md|instruction/i);
    expect(projectMemory?.evidence.join('\n')).not.toContain('AGENTS.md found');
  });

  it('uses existing source metadata for public GitHub and GitHub App reveal labels', () => {
    const base = buildSampleReport();

    expect(buildIntelligenceRevealModel({
      ...base,
      source: { sourceType: 'github-public', githubOwner: 'Csisz', githubRepo: 'shipseal' },
      scanEvidence: { ...base.scanEvidence, sourceType: 'public-github' },
    }).sourceLabel).toBe('Public GitHub repository');

    expect(buildIntelligenceRevealModel({
      ...base,
      source: { sourceType: 'github-app', githubOwner: 'Csisz', githubRepo: 'shipseal', githubInstallationId: '123' },
      scanEvidence: { ...base.scanEvidence, sourceType: 'github-app' },
    }).sourceLabel).toBe('Connected GitHub repository');
  });


  it('gates the workspace behind one minimal formation surface until Futures are actually ready', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    try {
      const report = buildSampleReport();
      const { rerender } = render(<IntelligenceReveal report={report} futuresReady={false} statusMessage="Grounding future directions." onComplete={onComplete} />);

      expect(screen.getByRole('heading', { name: /Forming repository intelligence/i })).toBeInTheDocument();
      expect(screen.getByText('sample-nextjs-app')).toBeInTheDocument();
      expect(screen.getByText('Grounding future directions.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Skip to workspace/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('repository-futures-neural-canvas')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(onComplete).not.toHaveBeenCalled();

      rerender(<IntelligenceReveal report={report} futuresReady onComplete={onComplete} />);
      expect(screen.getByRole('heading', { name: /workspace is ready/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(719);
      });
      expect(onComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('respects reduced motion by completing the ready transition immediately', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const onComplete = vi.fn();

    try {
      render(<IntelligenceReveal report={buildSampleReport()} futuresReady onComplete={onComplete} />);
      expect(screen.getByTestId('repository-formation')).toHaveAttribute('data-formation-stage', 'ready');

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntelligenceReveal } from '@/components/agentready/IntelligenceReveal';
import { buildReport, buildSampleReport } from '@/lib/readiness';
import { buildIntelligenceRevealModel, INTELLIGENCE_REVEAL_TOTAL_MS } from '@/lib/workspace/intelligenceReveal';

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


  it('reveals evidence before entering the workspace', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    try {
      render(<IntelligenceReveal report={buildSampleReport()} onComplete={onComplete} />);

      expect(screen.getByRole('heading', { name: /Understanding repository structure/i })).toBeInTheDocument();
      expect(screen.getByText('sample-nextjs-app')).toBeInTheDocument();
      expect(screen.getByText(/ZIP upload - Next\.js/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Skip to workspace/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(950);
      });
      expect(screen.getByRole('heading', { name: /Reading repository evidence/i })).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getAllByText('Evidence').length).toBeGreaterThan(0);

      act(() => {
        vi.advanceTimersByTime(2200);
      });
      expect(screen.getByRole('heading', { name: /Connecting repository signals/i })).toBeInTheDocument();
      expect(screen.getByText(/Documentation becomes the entry point/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(screen.getByRole('heading', { name: /Repository understood/i })).toBeInTheDocument();
      expect(screen.getByText(/Your AI Workspace is ready/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(INTELLIGENCE_REVEAL_TOTAL_MS);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips to the workspace and cleans up pending timers', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    try {
      render(<IntelligenceReveal report={buildSampleReport()} onComplete={onComplete} />);
      fireEvent.click(screen.getByRole('button', { name: /Skip to workspace/i }));

      expect(onComplete).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(INTELLIGENCE_REVEAL_TOTAL_MS + 1000);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('respects reduced motion with a short meaning-first reveal', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const onComplete = vi.fn();

    try {
      render(<IntelligenceReveal report={buildSampleReport()} onComplete={onComplete} />);

      expect(screen.getByRole('heading', { name: /Repository understood/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(950);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

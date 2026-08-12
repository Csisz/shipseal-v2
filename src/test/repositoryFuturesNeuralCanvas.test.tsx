import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryFuturesNeuralCanvas } from '@/components/agentready/result-workspace/futures/RepositoryFuturesNeuralCanvas';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

function overlay(values: Partial<RepositoryFutureStageOverlay> = {}): RepositoryFutureStageOverlay {
  return {
    active: true,
    mode: 'quick',
    phase: 'synthesis',
    graphFingerprint: 'graph:canvas',
    draftFingerprint: 'draft:canvas',
    candidates: [{
      goalId: 'goal:future',
      title: 'Guided repository futures',
      fit: 'Strong fit',
      role: 'primary',
      origin: 'Deterministic evidence',
      capabilityId: 'capability:futures',
      capabilityTitle: 'Future planning',
      confidence: 'high',
      compatibility: 'compatible',
      humanReviewRequired: false,
      evidenceCount: 2,
      mappedEvidenceCount: 1,
      universeNodeIds: ['universe:readme'],
      rationale: 'The repository already contains the bounded planning workflow.',
    }, {
      goalId: 'goal:alternative',
      title: 'Repository evidence assistant',
      fit: 'Supported with review',
      role: 'candidate',
      origin: 'Deterministic evidence',
      capabilityId: 'capability:evidence',
      confidence: 'medium',
      compatibility: 'compatible',
      eligibleAsPrimary: true,
      humanReviewRequired: true,
      evidenceCount: 1,
      mappedEvidenceCount: 1,
      universeNodeIds: ['universe:readme'],
    }],
    dependencies: [{
      id: 'dependency:review',
      title: 'Human review',
      state: 'required',
      dependentCount: 1,
      dependentGoalIds: ['goal:future'],
      executionOrder: 0,
      humanReviewRequired: true,
      rationale: 'The proposed future requires explicit review.',
    }],
    artifactCount: 1,
    gateCount: 1,
    conflictCount: 0,
    limited: false,
    supportCount: 0,
    productIntelligenceState: 'enhanced',
    onModeChange: vi.fn(),
    onCandidateFocus: vi.fn(),
    onCandidateSelect: vi.fn(),
    onCandidateAddSupport: vi.fn(),
    onCandidateRemoveSupport: vi.fn(),
    onCandidateReplaceSupport: vi.fn(),
    onCandidateSave: vi.fn(),
    onCandidateRestore: vi.fn(),
    onDependencyFocus: vi.fn(),
    onTracePreview: vi.fn(),
    onTracePin: vi.fn(),
    onTraceClear: vi.fn(),
    onOpenDomControls: vi.fn(),
    ...values,
  };
}

describe('Omega 18.5-V5 graph-native Repository Futures composer', () => {
  it('renders an accessible real-data topology with role grammar, selected route, and inspector', () => {
    const value = overlay();
    const { container } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);

    expect(screen.getByRole('application', { name: /Neural Repository Futures canvas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current repository: shipseal' })).toHaveAttribute('data-neural-role', 'current');
    const goal = screen.getByRole('button', { name: /Primary future goal: Guided repository futures/i });
    expect(goal).toHaveAttribute('data-future-depth', '3');
    expect(screen.getByRole('button', { name: /Required dependency: Human review/i })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-selected-route="true"]').length).toBeGreaterThan(0);

    fireEvent.click(goal);
    expect(value.onCandidateFocus).toHaveBeenCalledWith('goal:future');
    expect(value.onTracePin).toHaveBeenCalledWith('goal:future');
    expect(screen.getByRole('complementary', { name: 'Neural Futures inspector' })).toHaveTextContent('Proposed, not current');
    expect(goal).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close neural inspector' }));
    expect(value.onTraceClear).toHaveBeenCalled();
  });

  it('supports buttons, wheel, keyboard, fit and pointer-drag camera controls', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    const stage = screen.getByRole('application', { name: /Neural Repository Futures canvas/i });
    const camera = screen.getByTestId('repository-futures-camera');
    const initialZoom = Number(stage.getAttribute('data-camera-zoom'));
    const initialTransform = camera.style.transform;

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(Number(stage.getAttribute('data-camera-zoom'))).toBeGreaterThan(initialZoom);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.wheel(stage, { deltaY: -240, clientX: 500, clientY: 300 });
    expect(Number(stage.getAttribute('data-camera-zoom'))).toBeGreaterThan(initialZoom);
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(camera.style.transform).not.toBe(initialTransform);
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(stage).toHaveClass('cursor-grabbing');
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.click(screen.getByRole('button', { name: 'Fit neural map' }));
    expect(stage).toHaveAttribute('data-camera-lod', 'medium');
  });

  it('clears pinned focus from Escape and empty-field click', () => {
    const value = overlay();
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    const stage = screen.getByRole('application', { name: /Neural Repository Futures canvas/i });
    const goal = screen.getByRole('button', { name: /Primary future goal/i });

    fireEvent.click(goal);
    expect(screen.getByTestId('neural-futures-inspector')).toBeInTheDocument();
    fireEvent.keyDown(stage, { key: 'Escape' });
    expect(screen.queryByTestId('neural-futures-inspector')).not.toBeInTheDocument();
    fireEvent.click(goal);
    fireEvent.click(stage);
    expect(screen.queryByTestId('neural-futures-inspector')).not.toBeInTheDocument();
    expect(value.onTraceClear).toHaveBeenCalledTimes(2);
  });

  it('traces only related routes on hover and changes visible node detail with zoom', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    const primary = screen.getByRole('button', { name: /Primary future goal/i });
    const alternative = screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i });

    fireEvent.mouseEnter(alternative);
    expect(alternative).toHaveAttribute('data-trace-state', 'related');
    expect(primary).toHaveAttribute('data-trace-state', 'dimmed');
    expect(document.querySelector('[data-future-edge-id="grounding:goal:alternative"]')).toHaveAttribute('data-trace-state', 'related');
    expect(document.querySelector('[data-future-edge-id="requirement:dependency:review:goal:future"]')).toHaveAttribute('data-trace-state', 'dimmed');
    fireEvent.mouseLeave(alternative);

    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(stage).toHaveAttribute('data-camera-lod', 'far');
    expect(alternative).toHaveAttribute('data-label-detail', 'anchor');
    for (let index = 0; index < 7; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(stage).toHaveAttribute('data-camera-lod', 'near');
    expect(alternative).toHaveAttribute('data-label-detail', 'near');
    expect(alternative).toHaveTextContent('1 evidence signals');
  });

  it('keeps the current grounded topology visible under a tiny integrated analysis state', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({ productIntelligenceState: 'analysing' })} />);
    expect(screen.getByRole('button', { name: 'Current repository: shipseal' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /future goal/i })).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Future paths are forming');
    expect(screen.getByTestId('repository-futures-neural-canvas')).toHaveAttribute('data-product-intelligence-state', 'analysing');
  });

  it('uses a top-to-bottom world with larger targets on mobile instead of shrinking the desktop layout', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { unmount } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');

    await waitFor(() => expect(stage).toHaveAttribute('data-future-orientation', 'vertical'));
    expect(screen.getByRole('button', { name: /Primary future goal/i })).toHaveClass('min-h-28');
    expect(screen.getByTestId('repository-futures-camera')).toHaveStyle({ width: '820px', height: '1480px' });
    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));
    const inspector = screen.getByRole('complementary', { name: 'Neural Futures inspector' });
    expect(inspector).toHaveClass('inset-x-3');
    expect(within(inspector).getByRole('button', { name: /Replace primary/i })).toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: /Add as support/i })).toBeInTheDocument();

    unmount();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });

  it('renders the full topology immediately without semantic path animation when reduced motion is requested', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const { container, unmount } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    expect(screen.getByTestId('repository-futures-neural-canvas')).toHaveAttribute('data-reduced-motion', 'true');
    expect(screen.getByTestId('repository-futures-neural-canvas')).toHaveAttribute('data-reveal-motion', 'static');
    expect(container.querySelectorAll('[data-future-edge]').length).toBeGreaterThan(0);
    expect(container.querySelector('.future-canvas-node-reveal')).not.toBeInTheDocument();
    expect(container.querySelector('animate')).not.toBeInTheDocument();
    unmount();
    window.matchMedia = original;
  });

  it('keeps node clicks inspection-only and runs primary, support and save mutations only from explicit buttons', () => {
    const value = overlay();
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    const option = screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i });

    fireEvent.click(option);
    expect(value.onCandidateFocus).toHaveBeenCalledWith('goal:alternative');
    expect(value.onCandidateSelect).not.toHaveBeenCalled();
    expect(value.onCandidateAddSupport).not.toHaveBeenCalled();
    expect(value.onCandidateSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Replace primary/i }));
    expect(value.onCandidateSelect).toHaveBeenCalledWith('goal:alternative');
    fireEvent.click(screen.getByRole('button', { name: /Add as support/i }));
    expect(value.onCandidateAddSupport).toHaveBeenCalledWith('goal:alternative');
    fireEvent.click(screen.getByRole('button', { name: 'Save for later' }));
    expect(value.onCandidateSave).toHaveBeenCalledWith('goal:alternative');
  });

  it('offers an explicit primary action, but no support or save action, before a plan exists', () => {
    const value = overlay({
      phase: 'possibility',
      draftFingerprint: undefined,
      supportCount: 0,
      candidates: [{
        ...overlay().candidates[1],
        goalId: 'goal:first',
        title: 'First future',
      }],
      dependencies: [],
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: First future/i }));

    fireEvent.click(screen.getByRole('button', { name: /Make primary/i }));
    expect(value.onCandidateSelect).toHaveBeenCalledWith('goal:first');
    expect(screen.queryByRole('button', { name: /Add as support/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save for later' })).not.toBeInTheDocument();
  });

  it('uses a bounded chooser to replace one of two supports instead of adding a third', () => {
    const base = overlay();
    const value = overlay({
      supportCount: 2,
      candidates: [
        base.candidates[0],
        { ...base.candidates[1], replaceableSupportGoalIds: ['goal:support-a', 'goal:support-b'] },
        { ...base.candidates[1], goalId: 'goal:support-a', title: 'Support A', role: 'supporting' },
        { ...base.candidates[1], goalId: 'goal:support-b', title: 'Support B', role: 'supporting' },
      ],
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));

    expect(screen.queryByRole('button', { name: /Add as support/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Replace a support/i }));
    expect(screen.getByText(/a third support cannot be added/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Choose supporting Future to replace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace Support A' }));
    expect(value.onCandidateReplaceSupport).toHaveBeenCalledWith('goal:alternative', 'goal:support-a');
  });

  it('exposes remove and restore as explicit actions for active and parked nodes', () => {
    const base = overlay();
    const value = overlay({
      candidates: [
        base.candidates[0],
        { ...base.candidates[1], goalId: 'goal:support', title: 'Active support', role: 'supporting' },
        { ...base.candidates[1], goalId: 'goal:saved', title: 'Parked future', role: 'saved', savedForLater: true },
      ],
      supportCount: 1,
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);

    fireEvent.click(screen.getByRole('button', { name: /Supporting future goal: Active support/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove support/i }));
    expect(value.onCandidateRemoveSupport).toHaveBeenCalledWith('goal:support');

    fireEvent.click(screen.getByRole('button', { name: /Saved future goal: Parked future/i }));
    fireEvent.click(screen.getByRole('button', { name: /Return to options/i }));
    expect(value.onCandidateRestore).toHaveBeenCalledWith('goal:saved');
  });

  it('explains incompatible options and dependency causality without exposing invalid mutations', () => {
    const base = overlay();
    const value = overlay({
      candidates: [base.candidates[0], {
        ...base.candidates[1],
        role: 'blocked',
        compatibility: 'incompatible',
        compatibilityReasons: ['Conflicts with the active primary.'],
      }],
      dependencies: [{
        ...base.dependencies[0],
        dependentGoalIds: ['goal:future'],
        evidencePaths: ['README.md'],
        limitations: ['Confirm ownership before implementation.'],
      }],
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);

    fireEvent.click(screen.getByRole('button', { name: /Blocked direction goal: Repository evidence assistant/i }));
    expect(screen.getByText('Cannot join as support')).toBeInTheDocument();
    expect(screen.getByText('Conflicts with the active primary.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add as support/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Required dependency: Human review/i }));
    expect(screen.getByText('Causal chain')).toBeInTheDocument();
    expect(screen.getAllByText(/Guided repository futures/).length).toBeGreaterThan(0);
    expect(screen.getByText('Required capabilities cannot be removed independently.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Make primary|Add as support|Remove support/i })).not.toBeInTheDocument();
  });

  it('traces a shared dependency to every selected Future that requires it', () => {
    const base = overlay();
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({
      candidates: [base.candidates[0], { ...base.candidates[1], role: 'supporting' }],
      supportCount: 1,
      dependencies: [{ ...base.dependencies[0], dependentGoalIds: ['goal:future', 'goal:alternative'], dependentCount: 2 }],
    })} />);
    const primary = screen.getByRole('button', { name: /Primary future goal/i });
    const support = screen.getByRole('button', { name: /Supporting future goal/i });
    fireEvent.click(screen.getByRole('button', { name: /Required dependency: Human review/i }));

    expect(primary).toHaveAttribute('data-trace-state', 'related');
    expect(support).toHaveAttribute('data-trace-state', 'related');
    expect(screen.getByText('2 selected Futures')).toBeInTheDocument();
  });

  it('renders a synchronized compact plan summary and polite mutation notice', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({ notice: 'Future saved for later.' })} />);
    const summary = screen.getByLabelText('Live Future Plan summary');
    expect(summary).toHaveTextContent('Guided repository futures');
    expect(summary).toHaveTextContent('Supports 0/2');
    expect(summary).toHaveTextContent('Requirements 1 automatic');
    expect(screen.getByRole('status')).toHaveTextContent('Future saved for later.');
  });

  it('owns Quick and Deep once inside the canvas and exposes only one emphasized inspector action', () => {
    const { container } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    expect(container.querySelectorAll('[data-futures-mode-owner]')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Quick Path' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Deep Configuration' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));
    const inspector = screen.getByRole('complementary', { name: 'Neural Futures inspector' });
    expect(inspector.querySelectorAll('[data-action-emphasis="primary"]')).toHaveLength(1);
    expect(within(inspector).getByText('Why this fits').closest('details')).not.toHaveAttribute('open');
    expect(within(inspector).getByText('Evidence and compatibility').closest('details')).not.toHaveAttribute('open');
  });
});

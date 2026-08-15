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
      futureDepth: 3,
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

function cameraState() {
  const stage = screen.getByTestId('repository-futures-neural-canvas');
  return {
    x: Number(stage.getAttribute('data-camera-x')),
    y: Number(stage.getAttribute('data-camera-y')),
    zoom: Number(stage.getAttribute('data-camera-zoom')),
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

  it('layers only real relationships into a broader neural field while the selected route remains dominant', () => {
    const value = overlay({ activeTraceId: 'goal:future' });
    const { container } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    const ambientEdges = container.querySelectorAll('[data-edge-layer="ambient"]');
    const semanticEdges = container.querySelectorAll('[data-edge-layer="semantic"]');
    const selectedEdge = container.querySelector('[data-edge-layer="semantic"][data-selected-route="true"]');
    const broaderEdge = container.querySelector('[data-edge-layer="semantic"][data-future-edge-id="grounding:goal:alternative"]');

    expect(stage).toHaveAttribute('data-field-density', 'breathable-layered-neural');
    expect(stage).toHaveAttribute('data-layout-strategy', 'stable-grounded-lattice-with-role-aware-enablers-and-terminal-collision-allocation');
    expect(stage).toHaveAttribute('data-stage-framing', 'immersive-full-stage');
    expect(screen.queryByRole('button', { name: /Arrange/i })).not.toBeInTheDocument();
    expect(container.querySelector('[data-field-layer="structured-rows"]')).toBeInTheDocument();
    expect(container.querySelector('[data-field-layer="prerequisite-rail"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-field-layer="progression-bands"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-field-object-halo]')).toHaveLength(4);
    expect(ambientEdges).toHaveLength(semanticEdges.length);
    expect([...semanticEdges].every(edge => edge.hasAttribute('data-future-edge-id'))).toBe(true);
    expect(selectedEdge).toHaveAttribute('data-trace-state', 'related');
    expect(selectedEdge).toHaveAttribute('opacity', '0.94');
    expect(broaderEdge).toHaveAttribute('data-trace-state', 'dimmed');
    expect(broaderEdge).toHaveAttribute('opacity', '0.22');
    expect(screen.getByRole('button', { name: /Primary future goal/i })).toHaveAttribute('data-neural-role', 'primary');
    expect(screen.getByRole('button', { name: /Required dependency/i })).toHaveAttribute('data-neural-role', 'required');
    expect(screen.getByRole('button', { name: /Required dependency/i })).toHaveAttribute('data-enabler-position', 'downstream-required');
  });

  it('renders one resolved role label for a duplicated semantic candidate id', () => {
    const base = overlay().candidates[0];
    const { container } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({
      candidates: [{ ...base, role: 'candidate' }, { ...base, role: 'primary' }],
      dependencies: [],
    })} />);

    expect(container.querySelectorAll('[data-neural-node="goal"]')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Primary future goal: Guided repository futures/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Candidate future goal: Guided repository futures/i })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Fit all futures' }));
    expect(Number(stage.getAttribute('data-camera-zoom'))).toBeGreaterThanOrEqual(0.44);
  });

  it('keeps camera X, Y, and zoom unchanged when a Future remains comfortably visible beside the inspector', () => {
    const value = overlay({
      candidates: [{
        ...overlay().candidates[1],
        goalId: 'goal:visible',
        title: 'Comfortably visible future',
        futureDepth: 1,
      }],
      dependencies: [],
      draftFingerprint: undefined,
      supportCount: 0,
      phase: 'possibility',
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    for (let index = 0; index < 7; index += 1) fireEvent.keyDown(stage, { key: 'ArrowRight' });
    const before = cameraState();

    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Comfortably visible future/i }));

    expect(screen.getByTestId('neural-futures-inspector')).toBeInTheDocument();
    expect(cameraState()).toEqual(before);
  });

  it('keeps zoom and horizontal context while minimally revealing a selected Future beside the inspector', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to current repository' }));
    const before = cameraState();

    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));
    const after = cameraState();

    expect(after.x).toBe(before.x);
    expect(after.zoom).toBe(before.zoom);
    expect(Math.abs(after.y - before.y)).toBeLessThan(80);
  });

  it('keeps the assisted camera position when the inspector closes', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to current repository' }));
    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));
    const revealed = cameraState();

    fireEvent.click(screen.getByRole('button', { name: 'Close neural inspector' }));

    expect(cameraState()).toEqual(revealed);
  });

  it('exposes accessible explicit navigation and disables plan fitting when no Primary exists', () => {
    const noPlan = overlay({
      phase: 'possibility',
      draftFingerprint: undefined,
      candidates: [{ ...overlay().candidates[1], role: 'candidate' }],
      dependencies: [],
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={noPlan} />);

    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveAttribute('title', 'Zoom out');
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveAttribute('title', 'Zoom in');
    expect(screen.getByRole('button', { name: 'Fit all futures' })).toHaveAttribute('title', 'Fit all futures');
    expect(screen.getByRole('button', { name: 'Back to current repository' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Fit selected plan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fit selected plan' })).toHaveAttribute('title', expect.stringMatching(/Choose a primary/i));
  });

  it('fits the selected plan explicitly and returns directly to the current repository', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    for (let index = 0; index < 8; index += 1) fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    const displaced = cameraState();

    fireEvent.click(screen.getByRole('button', { name: 'Fit selected plan' }));
    expect(cameraState()).not.toEqual(displaced);
    fireEvent.click(screen.getByRole('button', { name: 'Back to current repository' }));
    const origin = cameraState();

    expect(150 * origin.zoom + origin.x).toBeCloseTo(348, 0);
    expect(origin.zoom).toBeCloseTo(0.9, 2);
  });

  it('preserves camera through role, support, save, and restore presentation mutations', () => {
    const base = overlay();
    const { rerender } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={base} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));
    const before = cameraState();
    const mutate = (role: 'primary' | 'supporting' | 'saved' | 'candidate') => overlay({
      candidates: base.candidates.map(candidate => candidate.goalId === 'goal:alternative' ? { ...candidate, role } : candidate),
      supportCount: role === 'supporting' ? 1 : 0,
    });

    rerender(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={mutate('primary')} />);
    expect(cameraState()).toEqual(before);
    rerender(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={mutate('supporting')} />);
    expect(cameraState()).toEqual(before);
    rerender(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={mutate('saved')} />);
    expect(cameraState()).toEqual(before);
    rerender(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={mutate('candidate')} />);
    expect(cameraState()).toEqual(before);
  });

  it('clears pinned focus from Escape and empty-field click', () => {
    const value = overlay();
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    const stage = screen.getByRole('application', { name: /Neural Repository Futures canvas/i });
    const goal = screen.getByRole('button', { name: /Primary future goal/i });

    fireEvent.click(goal);
    expect(screen.getByTestId('neural-futures-inspector')).toBeInTheDocument();
    const beforeEscape = cameraState();
    fireEvent.keyDown(stage, { key: 'Escape' });
    expect(screen.queryByTestId('neural-futures-inspector')).not.toBeInTheDocument();
    expect(cameraState()).toEqual(beforeEscape);
    fireEvent.click(goal);
    const beforeEmptyClick = cameraState();
    fireEvent.click(stage);
    expect(screen.queryByTestId('neural-futures-inspector')).not.toBeInTheDocument();
    expect(cameraState()).toEqual(beforeEmptyClick);
    expect(value.onTraceClear).toHaveBeenCalledTimes(2);
  });

  it('traces only related routes on hover and changes visible node detail with zoom', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    const primary = screen.getByRole('button', { name: /Primary future goal/i });
    const alternative = screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i });

    fireEvent.mouseEnter(alternative);
    const hoverCard = screen.getByRole('tooltip');
    expect(hoverCard).toHaveTextContent('Repository evidence assistant');
    expect(hoverCard).toHaveTextContent(/1 evidence/i);
    expect(hoverCard).toHaveTextContent('Click to inspect');
    expect(screen.queryByTestId('neural-futures-inspector')).not.toBeInTheDocument();
    expect(alternative).toHaveAttribute('data-trace-state', 'related');
    expect(primary).toHaveAttribute('data-trace-state', 'dimmed');
    expect(document.querySelector('[data-future-edge-id="grounding:goal:alternative"]')).toHaveAttribute('data-trace-state', 'related');
    expect(document.querySelector('[data-future-edge-id="requirement:dependency:review:goal:future"]')).toHaveAttribute('data-trace-state', 'dimmed');
    fireEvent.mouseLeave(alternative);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(primary);
    fireEvent.mouseEnter(alternative);
    expect(screen.getByRole('complementary', { name: 'Neural Futures inspector' })).toHaveTextContent('Guided repository futures');
    expect(document.querySelector('[data-future-edge-id="grounding:goal:alternative"]')).toHaveAttribute('data-hover-trace', 'real-relationship');
    expect(document.querySelector('[data-future-edge-id="requirement:dependency:review:goal:future"]')).not.toHaveAttribute('data-hover-trace');
    fireEvent.mouseLeave(alternative);
    fireEvent.click(screen.getByRole('button', { name: 'Close neural inspector' }));

    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(stage).toHaveAttribute('data-camera-lod', 'far');
    expect(alternative).toHaveAttribute('data-label-detail', 'title');
    expect(primary).toHaveAttribute('data-label-detail', 'title');
    expect(screen.getByRole('button', { name: /Current repository: shipseal/i })).toHaveAttribute('data-label-detail', 'near');
    for (let index = 0; index < 7; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(stage).toHaveAttribute('data-camera-lod', 'near');
    expect(alternative).toHaveAttribute('data-label-detail', 'near');
    expect(alternative).toHaveTextContent('1 evidence signals');
  });

  it('keeps first-level Futures readable while progressively quieting selected deeper generations at overview', () => {
    const value = overlay({
      projections: [{
        id: 'evolution:guided-next',
        goalId: 'goal:future',
        kind: 'evolution',
        title: 'Adaptive guidance layer',
        sourceId: 'goal:future',
        order: 0,
        humanReviewRequired: false,
        generation: 2,
        summary: 'Guidance adapts to repository signals.',
      }, {
        id: 'evolution:guided-later',
        goalId: 'goal:future',
        kind: 'evolution',
        title: 'Repository coaching network',
        sourceId: 'evolution:guided-next',
        order: 1,
        humanReviewRequired: false,
        generation: 3,
        summary: 'Coaching connects related repository decisions.',
      }],
    });
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={value} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    const primary = screen.getByRole('button', { name: /Primary future goal: Guided repository futures/i });
    const next = screen.getByRole('button', { name: /Next product evolution: Adaptive guidance layer/i });
    const later = screen.getByRole('button', { name: /Later product possibility: Repository coaching network/i });

    for (let index = 0; index < 4; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(stage).toHaveAttribute('data-camera-lod', 'far');
    expect(primary).toHaveAttribute('data-label-detail', 'title');
    expect(primary).toHaveTextContent('Guided repository futures');
    expect(next).toHaveAttribute('data-label-detail', 'compact');
    expect(next).toHaveTextContent('Adaptive guidance layer');
    expect(later).toHaveAttribute('data-label-detail', 'anchor');
    expect(later).not.toHaveTextContent('Repository coaching network');
    expect(later).toHaveAccessibleName(/Repository coaching network/i);

    fireEvent.mouseEnter(later);
    expect(later).toHaveAttribute('data-label-detail', 'title');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Repository coaching network');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Coaching connects related repository decisions.');
    fireEvent.mouseLeave(later);
    expect(later).toHaveAttribute('data-label-detail', 'anchor');
  });

  it('transitions selected corridors on stable real edge elements without replaying path animation', () => {
    const base = overlay();
    const { container, rerender } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={base} />);
    const edge = container.querySelector('[data-edge-layer="semantic"][data-future-edge-id="grounding:goal:future"]');

    expect(edge).toHaveAttribute('data-selected-route', 'true');
    expect(edge).toHaveAttribute('data-corridor-transition', 'semantic-emphasis');
    expect(container.querySelector('animate')).not.toBeInTheDocument();

    rerender(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({
      candidates: base.candidates.map(candidate => candidate.goalId === 'goal:future' ? { ...candidate, role: 'candidate' } : candidate),
      draftFingerprint: 'draft:changed',
    })} />);
    const updatedEdge = container.querySelector('[data-edge-layer="semantic"][data-future-edge-id="grounding:goal:future"]');
    expect(updatedEdge).toBe(edge);
    expect(updatedEdge).not.toHaveAttribute('data-selected-route');
  });

  it('keeps selected supports and a focused minor node identifiable at overview zoom', () => {
    const base = overlay();
    const minor = {
      ...base.candidates[1],
      goalId: 'goal:minor',
      title: 'Minor future direction',
      futureDepth: 2 as const,
    };
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({
      candidates: [base.candidates[0], { ...base.candidates[1], role: 'supporting' }, minor, {
        ...minor,
        goalId: 'goal:other',
        title: 'Other direction',
      }],
      supportCount: 1,
    })} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');
    for (let index = 0; index < 4; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    const support = screen.getByRole('button', { name: /Supporting future goal: Repository evidence assistant/i });
    const minorNode = screen.getByRole('button', { name: /Candidate future goal: Other direction/i });

    expect(stage).toHaveAttribute('data-camera-lod', 'far');
    expect(support).toHaveAttribute('data-label-detail', 'title');
    expect(minorNode).toHaveAttribute('data-label-detail', 'title');
    fireEvent.click(minorNode);
    expect(minorNode).toHaveAttribute('data-label-detail', 'title');
  });

  it('gates all Future topology while integrated analysis is still forming', () => {
    render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay({ productIntelligenceState: 'analysing' })} />);
    expect(screen.getByRole('button', { name: 'Current repository: shipseal' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /future goal/i })).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Future paths are forming');
    expect(screen.getByTestId('repository-futures-neural-canvas')).toHaveAttribute('data-product-intelligence-state', 'analysing');
  });

  it('uses a top-to-bottom world with larger targets on mobile instead of shrinking the desktop layout', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { unmount } = render(<RepositoryFuturesNeuralCanvas repositoryName="shipseal" overlay={overlay()} />);
    const stage = screen.getByTestId('repository-futures-neural-canvas');

    await waitFor(() => expect(stage).toHaveAttribute('data-future-orientation', 'vertical'));
    expect(screen.queryByRole('button', { name: /Arrange/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Primary future goal/i })).toHaveClass('min-h-[6.25rem]');
    expect(screen.getByTestId('repository-futures-camera')).toHaveStyle({ width: '1040px', height: '1840px' });
    fireEvent.click(screen.getByRole('button', { name: /Candidate future goal: Repository evidence assistant/i }));
    const inspector = screen.getByRole('complementary', { name: 'Neural Futures inspector' });
    expect(inspector).toHaveClass('inset-x-3');
    expect(within(inspector).getByRole('button', { name: /Replace primary/i })).toBeInTheDocument();
    expect(within(inspector).getByRole('button', { name: /Add as support/i })).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Primary future goal/i }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

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
    expect(screen.getByTestId('repository-futures-neural-canvas')).toHaveAttribute('data-corridor-motion', 'static');
    expect(screen.getByRole('button', { name: /Primary future goal/i })).toHaveAttribute('data-primary-alive', 'static');
    expect(container.querySelectorAll('[data-future-edge]').length).toBeGreaterThan(0);
    expect(container.querySelector('.future-canvas-node-reveal')).not.toBeInTheDocument();
    expect(container.querySelector('animate')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fit all futures' }));
    expect(screen.getByTestId('repository-futures-camera')).not.toHaveClass('transition-transform');
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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildReport } from '@/lib/readiness';
import { buildRepositoryUniverseModel } from '@/lib/workspace';
import {
  REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
  REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
  validateRepositoryProductIntelligence,
} from '@/lib/repositoryIntelligence';
import RepositoryFuturePathways from '@/components/agentready/result-workspace/futures/RepositoryFuturePathways';
import type { RepositoryFutureStageOverlay } from '@/components/agentready/result-workspace/futures/futurePathwaysPresentation';

function futureReport() {
  return buildReport({
    repoName: 'future-pathways-ui',
    source: { sourceType: 'github-app', githubOwner: 'shipseal', githubRepo: 'future-pathways-ui', githubBranch: 'main' },
    files: [
      { path: 'README.md', size: 220 },
      { path: 'package.json', size: 280 },
      { path: 'src/App.tsx', size: 520 },
      { path: 'src/App.test.tsx', size: 360 },
      { path: '.github/workflows/ci.yml', size: 180 },
    ],
    textContents: {
      'README.md': '# Future Pathways UI\n\nA repository-grounded product planning workspace.',
      'package.json': JSON.stringify({ scripts: { test: 'vitest run', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
    },
  });
}

function productIntelligence() {
  const evidence = [
    { id: 'evidence:readme', path: 'README.md', confidence: 0.94, validationState: 'validated', assertionState: 'observed' },
    { id: 'evidence:app', path: 'src/App.tsx', confidence: 0.9, validationState: 'validated', assertionState: 'observed' },
  ];
  const insight = (statement: string, inferenceLevel: 'observed' | 'inferred' = 'observed') => ({ statement, inferenceLevel, evidenceIds: ['evidence:readme'] });
  const opportunity = (id: string, title: string, origin: 'evidence-backed' | 'strategic' | 'exploratory' = 'strategic') => ({
    schemaVersion: REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
    id,
    title,
    opportunityStatement: `Add ${title} as a proposed user-facing product capability.`,
    userValue: `${title} extends the current product workflow for repository teams.`,
    whyItFits: 'The product already turns repository evidence into guided decisions, so this direction extends an observed user loop.',
    targetUsers: ['Repository teams'],
    evidenceIds: ['evidence:readme', 'evidence:app'],
    origin,
    inferenceLevel: origin === 'evidence-backed' ? 'evidence-linked' as const : origin === 'strategic' ? 'strategic-inference' as const : 'exploratory-inference' as const,
    strategicRationale: 'Create a continuing product workflow from existing repository intelligence.',
    existingCapabilityIds: ['cap:repository-analysis'],
    requiredNewCapabilities: [{ title: `${title} capability`, rationale: `${title} needs a bounded domain capability.` }],
    optionalSupportingOpportunityIds: [],
    knownConflicts: [],
    expectedImplementationAreas: [{ label: 'Application surface', existingPath: 'src/App.tsx', evidenceIds: ['evidence:app'] }],
    changeWeight: 'moderate' as const,
    impactBreadth: 'workflow' as const,
    verificationConcept: `Verify the ${title} user workflow from repository evidence.`,
    humanReviewRequirements: [],
    limitations: ['Proposed, not current or verified.'],
    providerConfidence: 0.91,
  });
  return validateRepositoryProductIntelligence({
    sourceAnalysisFingerprint: 'analysis:future-pathways-ui',
    rawUnderstanding: {
      schemaVersion: REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
      productSummary: insight('A repository-grounded product planning workspace.'),
      primaryUsers: [insight('Repository teams.', 'inferred')],
      primaryProblem: insight('Teams need to connect product decisions to repository consequences.'),
      currentProductLoop: [insight('Scan repository.'), insight('Review intelligence.'), insight('Choose improvements.')],
      existingCapabilities: [{ id: 'cap:repository-analysis', title: 'Repository analysis', description: 'The product analyses repository evidence.', evidenceIds: ['evidence:readme', 'evidence:app'] }],
      constraints: [insight('Imported code is not executed.')],
      businessModelClues: [],
      missingCapabilityAreas: [insight('User-facing product directions are not yet composed visually.', 'inferred')],
      providerConfidence: 0.93,
      limitations: [],
    },
    rawOpportunities: [
      opportunity('op:guided-futures', 'Guided Product Futures', 'evidence-backed'),
      opportunity('op:team-review', 'Collaborative Future Review'),
      opportunity('op:impact-story', 'Product Impact Stories'),
      opportunity('op:adaptive-planning', 'Adaptive Product Planning'),
      opportunity('op:safety-coach', 'Safety Readiness Coach', 'evidence-backed'),
      opportunity('op:ecosystem-hub', 'Repository Ecosystem Hub', 'exploratory'),
    ],
    evidenceReferences: evidence,
    knownPaths: new Set(['README.md', 'src/App.tsx']),
  });
}

async function renderPathways() {
  let latestOverlay: RepositoryFutureStageOverlay | null = null;
  const onStageOverlayChange = vi.fn((overlay: RepositoryFutureStageOverlay | null) => { latestOverlay = overlay; });
  const report = futureReport();
  const result = render(<RepositoryFuturePathways
    report={report}
    universe={buildRepositoryUniverseModel(report)}
    productIntelligence={productIntelligence()}
    providerStatus={{ state: 'enhanced', deepState: 'completed', message: 'Product opportunities enhanced.', retryable: false, providerId: 'test-provider' }}
    onStageOverlayChange={onStageOverlayChange}
  />);
  await waitFor(() => expect(onStageOverlayChange).toHaveBeenCalled());
  return { ...result, overlay: () => latestOverlay };
}

function chooseFirstPrimary() {
  const buttons = screen.getAllByRole('button', { name: 'Make primary' });
  expect(buttons.length).toBeGreaterThanOrEqual(3);
  fireEvent.click(buttons[0]);
}

describe('Omega 18.5d.6 neural Repository Future Pathways composer', () => {
  it('makes the canvas primary, removes duplicate introduction, and keeps configuration secondary', async () => {
    const { container, overlay } = await renderPathways();
    expect(screen.queryByRole('heading', { name: 'Where should this product go next?' })).not.toBeInTheDocument();
    expect(screen.getByTestId('repository-futures-neural-canvas')).toHaveAttribute('data-reveal-motion', 'topology-one-shot');
    const configure = screen.getByText('Configure path').closest('details');
    expect(configure).toHaveAttribute('data-secondary-surface', 'configure-path');
    expect(configure).not.toHaveAttribute('open');
    expect(container.querySelectorAll('[data-futures-mode-owner]')).toHaveLength(1);
    expect(overlay()?.candidates).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: 'Make primary' })).toHaveLength(5);
    expect(overlay()?.candidates.filter(candidate => candidate.role === 'primary')).toHaveLength(0);
    expect(screen.queryByRole('complementary', { name: 'Future Pathways inspector' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('evidence:readme');
    expect(screen.queryByText(/Prospective artifacts and gates/)).not.toBeInTheDocument();
  });

  it('uses compact horizontal path controls with details disclosed on demand', async () => {
    const { container } = await renderPathways();
    expect(screen.getByTestId('future-path-controls')).toHaveAttribute('data-future-direction', 'left-to-right');

    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    const inspector = await screen.findByTestId('future-context-inspector');
    const grounding = within(inspector).getByText('Technical grounding and caveats').closest('details');
    expect(grounding).not.toHaveAttribute('open');
    expect(within(inspector).getByText(/Proposed direction, not a current capability/i)).toBeInTheDocument();
    fireEvent.click(within(inspector).getByRole('button', { name: 'Close details' }));

    chooseFirstPrimary();
    expect(await screen.findByLabelText('Composed Future Path')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add supporting opportunity' })).toHaveAttribute('aria-expanded', 'false');

    const requirements = screen.getByText(/requirements$/i).closest('details');
    expect(requirements).not.toHaveAttribute('open');
    fireEvent.click(requirements!.querySelector('summary')!);
    expect(requirements).toHaveAttribute('open');
    expect(container.querySelectorAll('[data-future-node="dependency"]').length).toBeGreaterThan(0);

    const draftDetails = screen.getByText('Plan grounding and implementation detail').closest('details');
    expect(draftDetails).not.toHaveAttribute('open');
  });

  it('selects a primary directly on the composer and publishes its proposed Universe projection', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    expect(await screen.findByText('Future Draft crystallized')).toBeInTheDocument();
    await waitFor(() => expect(overlay()?.phase).toBe('synthesis'));
    expect(overlay()?.draftFingerprint).toBeTruthy();
    expect(overlay()?.universeProjection?.sourceDraftFingerprint).toBe(overlay()?.draftFingerprint);
    expect(overlay()?.candidates.filter(candidate => candidate.role === 'primary')).toHaveLength(1);
    expect(overlay()?.universeProjection?.proposedNodes.every(node => node.currentness === 'future')).toBe(true);
  });

  it('adds supports through +, enforces two slots, and offers deterministic replacement', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    fireEvent.click(await screen.findByRole('button', { name: 'Add supporting opportunity' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add support' })[0]);
    await waitFor(() => expect(overlay()?.supportCount).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Add supporting opportunity' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add support' })[0]);
    await waitFor(() => expect(overlay()?.supportCount).toBe(2));
    expect(screen.queryByRole('button', { name: 'Add supporting opportunity' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace a supporting goal' }));
    const replacement = screen.getByRole('region', { name: 'Replace a supporting Product Future' });
    const replacementButtons = within(replacement).getAllByRole('button', { name: /^Replace / });
    expect(replacementButtons.length).toBeGreaterThan(0);
    const before = overlay()?.draftFingerprint;
    fireEvent.click(replacementButtons[0]);
    await waitFor(() => expect(overlay()?.draftFingerprint).not.toBe(before));
    expect(overlay()?.supportCount).toBe(2);
  });

  it('keeps the same broad first-generation roster through primary and support selection', async () => {
    const { overlay } = await renderPathways();
    const initialIds = overlay()!.candidates.map(candidate => candidate.goalId);
    expect(initialIds).toHaveLength(6);

    chooseFirstPrimary();
    await waitFor(() => expect(overlay()?.candidates.some(candidate => candidate.role === 'primary')).toBe(true));
    expect(overlay()!.candidates.map(candidate => candidate.goalId)).toEqual(initialIds);

    fireEvent.click(screen.getByRole('button', { name: 'Add supporting opportunity' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add support' })[0]);
    await waitFor(() => expect(overlay()?.supportCount).toBe(1));
    expect(overlay()!.candidates.map(candidate => candidate.goalId)).toEqual(initialIds);

    fireEvent.click(screen.getByRole('button', { name: 'Add supporting opportunity' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add support' })[0]);
    await waitFor(() => expect(overlay()?.supportCount).toBe(2));
    expect(overlay()!.candidates.map(candidate => candidate.goalId)).toEqual(initialIds);
  });

  it('renders automatic dependency nodes that explain why they cannot be manually removed', async () => {
    const { container } = await renderPathways();
    chooseFirstPrimary();
    const dependency = container.querySelector<HTMLButtonElement>('[data-future-node="dependency"]');
    expect(dependency).toBeTruthy();
    fireEvent.click(dependency!);
    expect(screen.getByText('Required capabilities cannot be removed independently.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove.*capability/i })).not.toBeInTheDocument();
  });

  it('keeps Quick and Deep synchronized to one draft', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    const primaryTitle = overlay()?.candidates.find(candidate => candidate.role === 'primary')?.title;
    fireEvent.click(screen.getByRole('button', { name: 'Deep Configuration' }));
    expect(screen.getByRole('button', { name: 'Deep Configuration' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(primaryTitle!).length).toBeGreaterThan(0);
    const fingerprint = overlay()?.draftFingerprint;
    fireEvent.click(screen.getByRole('button', { name: 'Quick Path' }));
    expect(overlay()?.draftFingerprint).toBe(fingerprint);
  });

  it('keeps Pathways independent from Universe controls and WebGL', async () => {
    await renderPathways();
    const hero = screen.getByTestId('future-pathways-hero-stage');
    expect(within(hero).getByTestId('future-path-controls')).toHaveAttribute('data-future-direction', 'left-to-right');
    expect(within(hero).queryByLabelText(/Search repository atlas or universe/i)).not.toBeInTheDocument();
    expect(within(hero).queryByRole('button', { name: /Universe 3D/i })).not.toBeInTheDocument();
    expect(hero.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('preserves the deterministic repository-evidence fallback in the separated Futures surface', () => {
    const report = futureReport();
    render(<RepositoryFuturePathways
      report={report}
      universe={buildRepositoryUniverseModel(report)}
      providerStatus={{ state: 'fallback', message: 'Using repository evidence fallback.', retryable: true, category: 'provider_unavailable' }}
    />);

    expect(screen.getByText('Repository evidence fallback')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Make primary' }).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Search repository atlas or universe/i)).not.toBeInTheDocument();
  });

  it('composes the authoritative plan from explicit canvas actions while preserving the inspected camera', async () => {
    const { overlay } = await renderPathways();
    const first = overlay()!.candidates.find(candidate => candidate.role === 'candidate')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Candidate future goal: ${first.title}`, 'i') }));
    const inspector = screen.getByRole('complementary', { name: 'Neural Futures inspector' });
    const camera = screen.getByTestId('repository-futures-camera');
    const focusedTransform = camera.style.transform;

    fireEvent.click(within(inspector).getByRole('button', { name: /Make primary/i }));
    await waitFor(() => expect(overlay()?.candidates.find(candidate => candidate.goalId === first.goalId)?.role).toBe('primary'));
    expect(camera.style.transform).toBe(focusedTransform);
    expect(screen.getByLabelText('Live Future Plan summary')).toHaveTextContent(first.title);
  });

  it('keeps canvas and Configure path synchronized through one draft state', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    await waitFor(() => expect(overlay()?.phase).toBe('synthesis'));
    const primary = overlay()!.candidates.find(candidate => candidate.role === 'primary')!;
    expect(screen.getByRole('button', { name: new RegExp(`Primary future goal: ${primary.title}`, 'i') })).toHaveAttribute('data-neural-role', 'primary');

    fireEvent.click(screen.getByText('Configure path'));
    const composer = screen.getByText('Configure path').closest('details')!;
    expect(composer).toHaveAttribute('open');
    expect(within(composer).getByLabelText('Composed Future Path')).toHaveTextContent(primary.title);

    const available = overlay()!.candidates.find(candidate => candidate.role === 'candidate')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Candidate future goal: ${available.title}`, 'i') }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Neural Futures inspector' })).getByRole('button', { name: /Add as support/i }));
    await waitFor(() => expect(overlay()?.candidates.find(candidate => candidate.goalId === available.goalId)?.role).toBe('supporting'));
    expect(within(composer).getByLabelText('Composed Future Path')).toHaveTextContent(available.title);
  });

  it('persists save and restore semantics across canvas and DOM fallback views', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    await waitFor(() => expect(overlay()?.phase).toBe('synthesis'));
    const available = overlay()!.candidates.find(candidate => candidate.role === 'candidate')!;

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Candidate future goal: ${available.title}`, 'i') }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Neural Futures inspector' })).getByRole('button', { name: 'Save for later' }));
    await waitFor(() => expect(overlay()?.candidates.find(candidate => candidate.goalId === available.goalId)?.role).toBe('saved'));
    expect(screen.getByRole('button', { name: new RegExp(`Saved future goal: ${available.title}`, 'i') })).toHaveAttribute('data-neural-role', 'saved');

    fireEvent.click(screen.getByText('Configure path'));
    fireEvent.click(screen.getByRole('button', { name: 'Deep Configuration' }));
    expect(screen.getAllByRole('button', { name: 'Return to options' }).length).toBeGreaterThan(0);

    fireEvent.click(within(screen.getByRole('complementary', { name: 'Neural Futures inspector' })).getByRole('button', { name: /Return to options/i }));
    await waitFor(() => expect(overlay()?.candidates.find(candidate => candidate.goalId === available.goalId)?.role).toBe('candidate'));
  });

  it('clears stale dependency focus when removing its only requiring support', async () => {
    const { overlay } = await renderPathways();
    chooseFirstPrimary();
    fireEvent.click(await screen.findByRole('button', { name: 'Add supporting opportunity' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add support' })[0]);
    await waitFor(() => expect(overlay()?.supportCount).toBe(1));
    const support = overlay()!.candidates.find(candidate => candidate.role === 'supporting')!;
    const supportOnlyDependency = overlay()!.dependencies.find(dependency => dependency.dependentGoalIds.length === 1 && dependency.dependentGoalIds[0] === support.goalId)!;
    expect(supportOnlyDependency).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`(?:Required|Existing) dependency: ${supportOnlyDependency.title}`, 'i') }));
    expect(screen.getByRole('complementary', { name: 'Neural Futures inspector' })).toHaveTextContent(supportOnlyDependency.title);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(overlay()?.dependencies.some(dependency => dependency.id === supportOnlyDependency.id)).toBe(false));
    expect(screen.queryByRole('button', { name: new RegExp(`dependency: ${supportOnlyDependency.title}`, 'i') })).not.toBeInTheDocument();
    const updatedInspector = screen.getByRole('complementary', { name: 'Neural Futures inspector' });
    expect(updatedInspector).toHaveTextContent(support.title);
    expect(updatedInspector).not.toHaveTextContent(supportOnlyDependency.title);
  });

  it('keeps plan creation unavailable until a Primary exists, then opens one deterministic executable plan without a provider call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await renderPathways();
    expect(screen.getByRole('button', { name: 'Build this future' })).toBeDisabled();
    expect(screen.getByText('Choose one Primary Future to create an implementation plan.')).toBeInTheDocument();

    chooseFirstPrimary();
    const buildButton = await screen.findByRole('button', { name: 'Build this future' });
    expect(buildButton).toBeEnabled();
    fireEvent.click(buildButton);

    const plan = screen.getByTestId('executable-future-plan');
    expect(plan).toHaveAttribute('data-review-phase', 'draft');
    expect(within(plan).getByRole('heading', { name: 'From foundation to verification' })).toBeInTheDocument();
    expect(within(plan).getByRole('heading', { name: 'Agent handoff' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reviews, copies both canonical agent handoffs, and downloads Markdown without executing or mutating the repository', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const createObjectURL = vi.fn().mockReturnValue('blob:future-plan');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await renderPathways();
    chooseFirstPrimary();
    fireEvent.click(await screen.findByRole('button', { name: 'Build this future' }));

    fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready for agent' }));
    expect(screen.getByTestId('executable-future-plan')).toHaveAttribute('data-review-phase', 'ready');

    fireEvent.click(screen.getByRole('button', { name: 'Copy for Codex' }));
    const codexDialog = screen.getByRole('dialog');
    const codexPreview = within(codexDialog).getByTestId('agent-prompt-preview');
    expect(codexPreview).toHaveTextContent('Codex — ShipSeal Executable Future Plan');
    expect(codexPreview).toHaveClass('whitespace-pre-wrap', 'break-words');
    fireEvent.click(within(codexDialog).getByRole('button', { name: 'Copy for Codex' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Use repository-native inspection and editing tools.')));
    fireEvent.click(within(codexDialog).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Copy for Claude Code' }));
    const claudeDialog = screen.getByRole('dialog');
    expect(within(claudeDialog).getByTestId('agent-prompt-preview')).toHaveTextContent('Claude Code — ShipSeal Executable Future Plan');
    fireEvent.click(within(claudeDialog).getByRole('button', { name: 'Copy for Claude Code' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Read repository guidance files before editing')));
    fireEvent.click(within(claudeDialog).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Download plan' }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:future-plan');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    anchorClick.mockRestore();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('recomposes instantly after changing Primary and keeps Quick and Deep on the same plan identity', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await renderPathways();
    chooseFirstPrimary();
    fireEvent.click(await screen.findByRole('button', { name: 'Build this future' }));
    const firstFingerprint = screen.getByTestId('executable-future-plan').getAttribute('data-plan-fingerprint');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Futures' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deep Configuration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build this future' }));
    expect(screen.getByTestId('executable-future-plan')).toHaveAttribute('data-plan-fingerprint', firstFingerprint);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Futures' }));
    const replacement = screen.getAllByRole('button', { name: 'Make primary' })[0];
    fireEvent.click(replacement);
    fireEvent.click(screen.getByRole('button', { name: 'Build this future' }));
    expect(screen.getByTestId('executable-future-plan').getAttribute('data-plan-fingerprint')).not.toBe(firstFingerprint);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('uses a single-column-safe document surface and disables convergence motion under reduced-motion preferences', async () => {
    await renderPathways();
    chooseFirstPrimary();
    fireEvent.click(await screen.findByRole('button', { name: 'Build this future' }));
    const plan = screen.getByTestId('executable-future-plan');
    expect(plan).toHaveClass('overflow-hidden', 'motion-reduce:animate-none');
    expect(within(plan).getByRole('button', { name: 'Download plan' })).toHaveClass('w-full');
    expect(plan.querySelectorAll('[data-plan-stage-kind]').length).toBeGreaterThanOrEqual(3);
  });
});

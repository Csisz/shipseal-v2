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

describe('Omega 18.5d.5 focused Repository Future Pathways composer', () => {
  it('does not request Product Strategist again for Future Pathways interactions', async () => {
    const prepareEnhancement = vi.fn(async () => undefined);
    const onStageOverlayChange = vi.fn();
    const report = futureReport();
    const universe = buildRepositoryUniverseModel(report);
    const view = render(<RepositoryFuturePathways
      report={report}
      universe={universe}
      productIntelligence={null}
      providerStatus={{ state: 'deterministic', deepState: 'disabled', message: 'Product analysis is available.', retryable: false }}
      prepareEnhancement={prepareEnhancement}
      onStageOverlayChange={onStageOverlayChange}
    />);
    await waitFor(() => expect(prepareEnhancement).toHaveBeenCalledTimes(1));
    view.rerender(<RepositoryFuturePathways
      report={report}
      universe={universe}
      productIntelligence={productIntelligence()}
      providerStatus={{ state: 'enhanced', deepState: 'completed', message: 'Product opportunities enhanced.', retryable: false, providerId: 'test-provider' }}
      prepareEnhancement={prepareEnhancement}
      onStageOverlayChange={onStageOverlayChange}
    />);

    chooseFirstPrimary();
    fireEvent.click(await screen.findByRole('button', { name: 'Add supporting opportunity' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add support' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Deep Configuration' }));
    expect(prepareEnhancement).toHaveBeenCalledTimes(1);
  });

  it('shows 3–5 Product Futures, selects nothing automatically, and keeps technical detail secondary', async () => {
    const { container, overlay } = await renderPathways();
    expect(screen.getByRole('heading', { name: 'Where should this product go next?' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Make primary' })).toHaveLength(4);
    expect(overlay()?.candidates.filter(candidate => candidate.role === 'primary')).toHaveLength(0);
    expect(screen.queryByRole('complementary', { name: 'Future Pathways inspector' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('evidence:readme');
    expect(screen.queryByText(/Prospective artifacts and gates/)).not.toBeInTheDocument();
  });

  it('uses a compact three-layer composition flow with details disclosed on demand', async () => {
    const { container } = await renderPathways();
    expect(screen.getByRole('heading', { name: 'Strong product directions' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);
    const inspector = await screen.findByTestId('future-context-inspector');
    const grounding = within(inspector).getByText('Technical grounding and caveats').closest('details');
    expect(grounding).not.toHaveAttribute('open');
    expect(within(inspector).getByText(/Proposed direction, not a current capability/i)).toBeInTheDocument();
    fireEvent.click(within(inspector).getByRole('button', { name: 'Close details' }));

    chooseFirstPrimary();
    expect(await screen.findByText(/01 · Primary future/i)).toBeInTheDocument();
    expect(screen.getByText(/02 · Optional supports/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add supporting opportunity' })).toHaveAttribute('aria-expanded', 'false');

    const requirements = screen.getByText(/03 · System-generated/i).closest('details');
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
    expect(screen.getAllByRole('button', { name: 'Replace support 1' }).length).toBeGreaterThan(0);
    const before = overlay()?.draftFingerprint;
    fireEvent.click(screen.getAllByRole('button', { name: 'Replace support 1' })[0]);
    await waitFor(() => expect(overlay()?.draftFingerprint).not.toBe(before));
    expect(overlay()?.supportCount).toBe(2);
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
    expect(within(hero).getByTestId('future-neural-field')).toHaveAttribute('data-future-direction', 'left-to-right');
    expect(within(hero).queryByLabelText(/Search repository atlas or universe/i)).not.toBeInTheDocument();
    expect(within(hero).queryByRole('button', { name: /Universe 3D/i })).not.toBeInTheDocument();
    expect(hero.querySelector('canvas')).not.toBeInTheDocument();
  });
});

import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryIntelligenceReviewSurface } from '@/components/agentready/RepositoryIntelligenceReviewPanel';
import {
  buildRepositoryIntelligenceArtifactReview,
  type BuildRepositoryIntelligenceArtifactReviewResult,
  type RepositoryIntelligenceArtifactReview,
  type RepositoryIntelligenceProviderStatus,
  type RepositoryIntelligenceVerificationBaseline,
} from '@/lib/repositoryIntelligence';
import type { RepoScanInput } from '@/lib/types';

const LONG_PATH = 'src/features/customer-support/knowledge-base/components/AnswerRecommendationPanel.tsx';

function fixture(extra: Record<string, string> = {}): RepoScanInput {
  const textContents = {
    'package.json': JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' }, dependencies: { react: '^18', vite: '^5' } }),
    'README.md': '# UI review fixture',
    'vite.config.ts': "import { defineConfig } from 'vite'; export default defineConfig({});",
    'src/main.tsx': "import App from './App'; export const bootstrap = () => <App />;",
    'src/App.tsx': "import { AnswerRecommendationPanel } from './features/customer-support/knowledge-base/components/AnswerRecommendationPanel'; export function App() { return <AnswerRecommendationPanel />; } export default App;",
    [LONG_PATH]: 'export function AnswerRecommendationPanel() { return <section>Answer</section>; }',
    'src/services/answerService.ts': 'export function loadAnswer() { return null; }',
    'src/App.test.tsx': "import App from './App'; export const subject = App;",
    ...extra,
  };
  return {
    repoName: 'ui-review-fixture',
    source: { sourceType: 'zip-upload' },
    files: Object.entries(textContents).map(([path, content]) => ({ path, size: content.length })),
    textContents,
  };
}

function Harness({ result, providerStatus, prepareEnhancement }: { result: BuildRepositoryIntelligenceArtifactReviewResult; providerStatus?: RepositoryIntelligenceProviderStatus; prepareEnhancement?: () => Promise<void> }) {
  const [review, setReview] = useState<RepositoryIntelligenceArtifactReview>(result.review);
  return <RepositoryIntelligenceReviewSurface artifactSet={result.artifactSet} review={review} onReviewChange={setReview} providerStatus={providerStatus} prepareEnhancement={prepareEnhancement} />;
}

function ConnectedHarness({ result, onVerificationBaseline }: { result: BuildRepositoryIntelligenceArtifactReviewResult; onVerificationBaseline?: (baseline: RepositoryIntelligenceVerificationBaseline) => void }) {
  const [review, setReview] = useState<RepositoryIntelligenceArtifactReview>(result.review);
  return <RepositoryIntelligenceReviewSurface artifactSet={result.artifactSet} review={review} onReviewChange={setReview} onVerificationBaseline={onVerificationBaseline} githubConnection={{ connectionStatus: 'connected', sourceMode: 'github-app', owner: 'acme', repo: 'demo', defaultBranch: 'main', installationId: '123', canCreatePullRequest: true, canListRepositories: true }} />;
}

function openReview(result = buildRepositoryIntelligenceArtifactReview({ scanInput: fixture() })) {
  render(<Harness result={result} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review proposed files' }));
  return result;
}

describe('Repository Intelligence artifact review UI', () => {
  it('renders a concise progressive-disclosure summary and deterministic mode', () => {
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput: fixture() });
    render(<Harness result={result} />);
    expect(screen.getByRole('heading', { name: /Review repository-specific files before any change/i })).toBeInTheDocument();
    expect(screen.getByText('Deterministic repository evidence')).toBeInTheDocument();
    expect(screen.getByText(`${result.review.summary.proposedArtifacts} proposed artifacts`)).toBeInTheDocument();
    const reviewButton = screen.getByRole('button', { name: 'Review proposed files' });
    expect(reviewButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Repository Intelligence artifacts')).not.toBeInTheDocument();
  });

  it('discloses enhanced preparation and deterministic fallback without blocking artifact review', () => {
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput: fixture() });
    const prepareEnhancement = vi.fn(async () => undefined);
    const { rerender } = render(<Harness result={result} providerStatus={{ state: 'deterministic', message: 'Deterministic repository intelligence is ready for review.', retryable: false }} prepareEnhancement={prepareEnhancement} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review proposed files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare enhanced intelligence' }));
    expect(prepareEnhancement).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Repository Intelligence artifacts')).toBeInTheDocument();

    rerender(<Harness result={result} providerStatus={{ state: 'fallback', category: 'rate_limited', retryable: true, message: 'Enhanced intelligence is unavailable. Deterministic repository intelligence remains ready for review.' }} prepareEnhancement={prepareEnhancement} />);
    expect(screen.getByText('Deterministic fallback ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry enhanced intelligence' }));
    expect(prepareEnhancement).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/API key|provider response body/i)).not.toBeInTheDocument();
  });

  it('filters artifacts and opens the correct repository-specific detail', () => {
    const result = openReview();
    const create = result.review.items.find(item => item.operation === 'create' && item.category !== 'evidence-manifest')!;
    fireEvent.change(screen.getByLabelText(/Filter files/i), { target: { value: 'create' } });
    const list = screen.getByLabelText('Repository Intelligence artifacts');
    const row = within(list).getByRole('button', { name: new RegExp(create.targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    fireEvent.click(row);
    expect(screen.getByRole('heading', { name: create.targetPath })).toBeInTheDocument();
    expect(screen.getByText(create.operationReason)).toBeInTheDocument();
    expect(screen.getAllByText(/Repository evidence/i).some(element => element.tagName === 'SUMMARY')).toBe(true);
  });

  it('exposes semantic selection controls, state and future-apply readiness', () => {
    const result = openReview();
    const selected = result.review.items.find(item => item.selected && item.category !== 'evidence-manifest')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(selected.targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    const exclude = screen.getByRole('button', { name: 'Exclude from future PR' });
    expect(exclude.tagName).toBe('BUTTON');
    expect(exclude).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(exclude);
    expect(screen.getByRole('button', { name: 'Include in future PR' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Selected Repository Intelligence plan summary')).toBeInTheDocument();
  });

  it('shows handwritten preservation and per-artifact human-review acknowledgement', () => {
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput: fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture\n\nKeep this section.' }) });
    openReview(result);
    fireEvent.change(screen.getByLabelText(/Filter files/i), { target: { value: 'strengthen' } });
    const architecture = result.review.items.find(item => item.category === 'architecture-memory')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(architecture.targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    expect(screen.getByText(/Existing handwritten content is preserved/i)).toBeInTheDocument();
    expect(screen.getByText(/Explicit human review is required/i)).toBeInTheDocument();
    const acknowledgement = screen.getByRole('checkbox', { name: /I reviewed this artifact's current content/i });
    expect(acknowledgement).not.toBeChecked();
    fireEvent.click(acknowledgement);
    expect(acknowledgement).toBeChecked();
  });

  it('shows blocked reasons and keeps long paths readable without hiding core actions', () => {
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput: fixture({ 'AGENTS.md': '# Rules\n\nDo not add generated ShipSeal instructions.' }) });
    openReview(result);
    fireEvent.change(screen.getByLabelText(/Filter files/i), { target: { value: 'blocked' } });
    const blocked = result.review.items.find(item => item.reviewState === 'blocked')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(blocked.targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    expect(screen.getAllByText(/Blocked or unavailable/i).some(element => element.className.includes('font-medium'))).toBe(true);
    expect(screen.getAllByText(/explicitly block generated instruction additions/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Filter files/i), { target: { value: 'all' } });
    const longTargetPath = result.review.items.find(item => item.targetPath.includes('customer-support'))?.targetPath;
    expect(longTargetPath).toBeTruthy();
    const longPathElements = screen.getAllByText(longTargetPath!);
    expect(longPathElements.some(element => element.className.includes('break-all'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Include all safe' })).toBeEnabled();
  });

  it('previews without mutation and requires explicit final confirmation', async () => {
    const input = fixture();
    input.repoName = 'acme/demo';
    input.source = { sourceType: 'github-app', githubOwner: 'acme', githubRepo: 'demo', githubBranch: 'main', githubDefaultBranch: 'main', githubInstallationId: '123' };
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput: input });
    const selected = result.review.items.filter(item => item.selected);
    const verificationBaseline = {
      schemaVersion: 'shipseal.repository-intelligence-verification-baseline.v1',
      applySchemaVersion: 'shipseal.repository-intelligence-github-apply.v1',
      pathPolicyVersion: 'shipseal.repository-path-policy.v1',
      repository: { owner: 'acme', repo: 'demo' },
      baseBranch: 'main',
      prBranch: 'shipseal/repository-intelligence-plan',
      selectedPlanFingerprint: '12345678',
      artifacts: selected.map((item, index) => ({ artifactId: item.artifactId, category: item.category, artifactFingerprint: `artifact${String(index).padStart(8, '0')}`, targetPath: item.targetPath, operation: item.operation, finalContentFingerprint: `content${String(index).padStart(8, '0')}`, expectedManagedSectionFingerprint: item.operation === 'strengthen' ? `section${String(index).padStart(8, '0')}` : undefined, expectedPreservationFingerprint: item.operation === 'strengthen' ? `preserve${String(index).padStart(8, '0')}` : undefined, preservedLineFingerprints: [], humanReviewRequired: item.humanReviewRequired, statements: item.statementProvenance })),
      prUrl: 'https://github.com/acme/demo/pull/9',
      prNumber: 9,
    };
    const onVerificationBaseline = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: 'preview', plan: { repository: { owner: 'acme', repo: 'demo' }, baseBranch: 'main', baseCommit: 'abcdef123456', proposedBranchName: 'shipseal/repository-intelligence-plan', pullRequestTitle: 'ShipSeal: improve AI repository intelligence', selectedPlanFingerprint: result.review.selectedPlanFingerprint, files: selected.map(item => ({ path: item.targetPath, operation: item.operation, artifactId: item.artifactId, finalContentFingerprint: item.artifactFingerprint, humanReviewAcknowledged: false })), operationCounts: result.review.summary.selectedOperationCounts, warnings: [], applyReady: true, fingerprint: 'preview' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: 'apply', ok: true, existing: false, prUrl: 'https://github.com/acme/demo/pull/9', title: 'ShipSeal: improve AI repository intelligence', repository: 'acme/demo', baseBranch: 'main', branchName: 'shipseal/repository-intelligence-plan', selectedArtifactCount: selected.length, operationCounts: result.review.summary.selectedOperationCounts, baseline: verificationBaseline }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ConnectedHarness result={result} onVerificationBaseline={onVerificationBaseline} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review proposed files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview Repository Intelligence PR' }));
    await screen.findByText('ShipSeal: improve AI repository intelligence');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe('preview');
    const create = screen.getByRole('button', { name: 'Create Pull Request' });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /explicitly confirm creation/i }));
    fireEvent.click(create);
    await screen.findByRole('link', { name: /Open Pull Request/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ mode: 'apply', confirmed: true });
    expect(screen.getByText(/does not mark the repository improved or verified/i)).toBeInTheDocument();
    expect(onVerificationBaseline).toHaveBeenCalledWith(expect.objectContaining({ prNumber: 9, repository: { owner: 'acme', repo: 'demo' } }));
    vi.unstubAllGlobals();
  });
});

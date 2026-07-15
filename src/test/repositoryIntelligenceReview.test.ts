import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_DEEP_INTELLIGENCE_PROMPT_CONTRACT_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION,
  adaptRepositoryIntelligenceArtifactSetForReview,
  buildRepositoryIntelligenceArtifactReview,
  buildRepositoryIntelligenceSelectedArtifactPayload,
  updateRepositoryIntelligenceReviewSelection,
  validateRepositoryIntelligenceReviewSelection,
  type RepositoryIntelligenceArtifactReview,
  type RepositoryDeepIntelligenceValidatedResult,
} from '@/lib/repositoryIntelligence';
import type { RepoFileSummary, RepoScanInput } from '@/lib/types';

function fixture(extra: Record<string, string> = {}): RepoScanInput {
  const textContents: Record<string, string> = {
    'package.json': JSON.stringify({
      scripts: { test: 'vitest', build: 'vite build', lint: 'eslint .' },
      dependencies: { react: '^18', vite: '^5', express: '^5' },
    }),
    'README.md': '# Review fixture\n\nRepository-specific architecture notes.',
    'vite.config.ts': "import { defineConfig } from 'vite'; export default defineConfig({});",
    'vitest.config.ts': "import { defineConfig } from 'vitest/config'; export default defineConfig({});",
    'src/main.tsx': "import App from './App'; export const bootstrap = () => <App />;",
    'src/App.tsx': "import { loadUser } from './services/userService'; export function App() { return String(loadUser()); } export default App;",
    'src/services/userService.ts': "import { findUser } from '../repositories/userRepository'; export function loadUser() { return findUser(); }",
    'src/repositories/userRepository.ts': 'export function findUser() { return null; }',
    'src/routes/users.ts': "import { Router } from 'express'; const router = Router(); router.get('/users', (_req, res) => res.json([])); export default router;",
    'src/App.test.tsx': "import App from './App'; export const subject = App;",
    '.env': 'API_KEY=review-secret-must-never-appear',
    ...extra,
  };
  const generated = ['dist/assets/app.js', 'node_modules/pkg/index.js'];
  const files: RepoFileSummary[] = [...Object.keys(textContents), ...generated].map(path => ({
    path,
    size: textContents[path]?.length || 40,
    ignored: generated.includes(path),
    ignoredReason: generated.includes(path) ? 'generated-vendor' : undefined,
  }));
  return {
    repoName: 'review-fixture',
    source: { sourceType: 'github-url', githubOwner: 'example', githubRepo: 'review-fixture', githubBranch: 'main' },
    files,
    textContents,
  };
}

function build(input = fixture(), selectionState?: RepositoryIntelligenceArtifactReview['selection']) {
  return buildRepositoryIntelligenceArtifactReview({ scanInput: input, selectionState });
}

function item(review: RepositoryIntelligenceArtifactReview, category: RepositoryIntelligenceArtifactReview['items'][number]['category']) {
  return review.items.find(value => value.category === category)!;
}

function dispatch(review: RepositoryIntelligenceArtifactReview, action: Parameters<typeof updateRepositoryIntelligenceReviewSelection>[1]) {
  return updateRepositoryIntelligenceReviewSelection(review, action).review;
}

describe('Repository Intelligence review adapter and identity', () => {
  it('adapts validated artifacts without losing provenance or rendered identity', () => {
    const result = build();
    expect(result.review.items).toHaveLength(result.artifactSet.plan.artifacts.length);
    for (const reviewItem of result.review.items) {
      const planned = result.artifactSet.plan.artifacts.find(value => value.id === reviewItem.artifactId)!;
      const rendered = result.artifactSet.artifacts.find(value => value.artifactId === reviewItem.artifactId)!;
      expect(reviewItem.artifactFingerprint).toBe(rendered.fingerprint);
      expect(reviewItem.evidenceIds).toEqual(planned.requiredEvidenceIds);
      expect(reviewItem.acceptedFindingIds).toEqual(planned.contributingFindingIds);
      expect(reviewItem.statementProvenance.map(value => value.statementId)).toEqual(planned.statements.map(value => value.id));
    }
  });

  it('keeps review IDs, ordering, defaults and fingerprints stable across reordered scanner and artifact input', () => {
    const first = build();
    const reordered = fixture();
    reordered.files.reverse();
    reordered.textContents = Object.fromEntries(Object.entries(reordered.textContents).reverse());
    const stages = build(reordered);
    const adapted = adaptRepositoryIntelligenceArtifactSetForReview({
      scanInput: reordered,
      evidenceResult: { ...stages.evidenceResult, evidence: [...stages.evidenceResult.evidence].reverse(), files: [...stages.evidenceResult.files].reverse(), folders: [...stages.evidenceResult.folders].reverse(), relationships: [...stages.evidenceResult.relationships].reverse() },
      contextBundle: stages.contextBundle,
      artifactSet: { ...stages.artifactSet, plan: { ...stages.artifactSet.plan, artifacts: [...stages.artifactSet.plan.artifacts].reverse() }, artifacts: [...stages.artifactSet.artifacts].reverse() },
      artifactValidation: stages.artifactValidation,
    });
    expect(adapted.items.map(value => value.id)).toEqual(first.review.items.map(value => value.id));
    expect(adapted.items.map(value => value.selected)).toEqual(first.review.items.map(value => value.selected));
    expect(adapted.selectedPlanFingerprint).toBe(first.review.selectedPlanFingerprint);
    expect(adapted.fingerprint).toBe(first.review.fingerprint);
  });

  it('preserves compatible selection and invalidates changed-content selection and acknowledgement', () => {
    const handwritten = build(fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture\n\nKeep this content.' }));
    const architecture = item(handwritten.review, 'architecture-memory');
    let selected = dispatch(handwritten.review, { type: 'include', artifactId: architecture.artifactId });
    selected = dispatch(selected, { type: 'acknowledge-human-review', artifactId: architecture.artifactId, acknowledged: true });
    const equivalent = build(fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture\n\nKeep this content.' }), selected.selection);
    expect(item(equivalent.review, 'architecture-memory').selected).toBe(true);
    expect(item(equivalent.review, 'architecture-memory').humanReviewAcknowledged).toBe(true);

    const staleSelection = structuredClone(selected.selection);
    staleSelection.entries[architecture.artifactId].artifactFingerprint = 'materially-changed-artifact-fingerprint';
    staleSelection.entries[architecture.artifactId].acknowledgementFingerprint = 'materially-changed-artifact-fingerprint';
    const changed = build(fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture\n\nKeep this content.' }), staleSelection);
    const changedArchitecture = item(changed.review, 'architecture-memory');
    expect(changedArchitecture.artifactFingerprint).toBe(architecture.artifactFingerprint);
    expect(changedArchitecture.selected).toBe(false);
    expect(changedArchitecture.humanReviewAcknowledged).toBe(false);
  });
});

describe('safe defaults and selection transitions', () => {
  it('selects safe create and machine-managed update while excluding strengthen, review, blocked, skip and unavailable', () => {
    const missing = build();
    expect(missing.review.items.filter(value => value.operation === 'create' && value.reviewState === 'ready-for-review').every(value => value.selected)).toBe(true);
    expect(missing.review.items.filter(value => ['skip', 'unavailable'].includes(value.operation)).every(value => !value.selectable && !value.selected)).toBe(true);

    const managed = build(fixture({ 'AGENT_MEMORY/COMMAND_MAP.md': '# Command Map\n\nGenerated by ShipSeal.\nOld command.' }));
    const update = item(managed.review, 'command-map');
    expect(update.operation).toBe('update');
    expect(update.selected).toBe(true);

    const handwritten = build(fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture' }));
    const strengthen = item(handwritten.review, 'architecture-memory');
    expect(strengthen.operation).toBe('strengthen');
    expect(strengthen.defaultIncluded).toBe(false);
    expect(strengthen.selected).toBe(false);
    expect(strengthen.defaultSelectionReason).toMatch(/handwritten/i);

    const blocked = build(fixture({ 'AGENTS.md': '# Local rules\n\nDo not add generated ShipSeal instructions.' }));
    const blockedRoot = item(blocked.review, 'root-agent-instructions');
    expect(blockedRoot.reviewState).toBe('blocked');
    expect(blockedRoot.selectable).toBe(false);
  });

  it('supports include, exclude, include-all-safe, exclude-all and safe-default reset', () => {
    const result = build();
    const selected = result.review.items.find(value => value.selected)!;
    let review = dispatch(result.review, { type: 'exclude', artifactId: selected.artifactId });
    expect(review.selection.entries[selected.artifactId].included).toBe(false);
    review = dispatch(review, { type: 'include-all-safe' });
    expect(review.items.filter(value => value.selectable && !value.humanReviewRequired).every(value => value.selected || !value.canSelectNow)).toBe(true);
    review = dispatch(review, { type: 'exclude-all' });
    expect(review.summary.selectedArtifacts).toBe(0);
    review = dispatch(review, { type: 'reset-safe-defaults' });
    expect(review.summary.selectedArtifacts).toBe(result.review.summary.selectedArtifacts);
    expect(review.selectedPlanFingerprint).toBe(result.review.selectedPlanFingerprint);
  });

  it('rejects blocked inclusion and enforces dependencies without recursive loops', () => {
    const blocked = build(fixture({ 'AGENTS.md': '# Local rules\n\nDo not add generated ShipSeal instructions.' }));
    const root = item(blocked.review, 'root-agent-instructions');
    const rejected = updateRepositoryIntelligenceReviewSelection(blocked.review, { type: 'include', artifactId: root.artifactId });
    expect(rejected.accepted).toBe(false);
    expect(rejected.reasons.join(' ')).toMatch(/cannot|block/i);

    const result = build();
    const command = item(result.review, 'command-map');
    const dependentRoot = item(result.review, 'root-agent-instructions');
    const withoutCommand = dispatch(result.review, { type: 'exclude', artifactId: command.artifactId });
    expect(item(withoutCommand, 'root-agent-instructions').selected).toBe(false);
    const includeRoot = updateRepositoryIntelligenceReviewSelection(withoutCommand, { type: 'include', artifactId: dependentRoot.artifactId });
    expect(includeRoot.accepted).toBe(false);
    expect(includeRoot.reasons.join(' ')).toMatch(/dependencies/i);
  });

  it('derives selected statement, operation, review and blocked counts', () => {
    const result = build();
    const selected = result.review.items.filter(value => value.selected);
    expect(result.review.summary.selectedArtifacts).toBe(selected.length);
    expect(result.review.summary.selectedStatements).toBe(selected.reduce((sum, value) => sum + value.statementCount, 0));
    expect(Object.values(result.review.summary.selectedOperationCounts).reduce((sum, value) => sum + value, 0)).toBe(selected.length);
    expect(result.review.summary.blockedOrUnavailable).toBe(result.review.items.filter(value => !value.selectable).length);
  });
});

describe('preservation, apply readiness and future payload', () => {
  it('uses proposed additions for handwritten files and requires fingerprint-bound acknowledgement', () => {
    const result = build(fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture\n\nExisting notes stay.' }));
    const architecture = item(result.review, 'architecture-memory');
    expect(architecture.preservation).toEqual({ mode: 'propose-additions', existingContentPreserved: true });
    expect(architecture.renderedContent).toContain('Proposed evidence-backed additions');
    expect(architecture.renderedContent).not.toContain('Existing notes stay.');

    let review = dispatch(result.review, { type: 'include', artifactId: architecture.artifactId });
    let payloadResult = buildRepositoryIntelligenceSelectedArtifactPayload({ review, artifactSet: result.artifactSet });
    expect(payloadResult.validation.issues.map(value => value.code)).toContain('human-review-acknowledgement-required');
    review = dispatch(review, { type: 'acknowledge-human-review', artifactId: architecture.artifactId, acknowledged: true });
    payloadResult = buildRepositoryIntelligenceSelectedArtifactPayload({ review, artifactSet: result.artifactSet });
    expect(payloadResult.validation.issues.map(value => value.code)).not.toContain('human-review-acknowledgement-required');
    expect(payloadResult.validation.issues).toEqual([]);
    expect(payloadResult.payload?.artifacts.find(value => value.artifactId === architecture.artifactId)?.applyRepresentation).toBe('proposed-addition');
  });

  it('rejects zero selection, stale fingerprints and destructive handwritten replacement', () => {
    const result = build(fixture({ 'docs/ARCHITECTURE.md': '# Handwritten architecture' }));
    const empty = dispatch(result.review, { type: 'exclude-all' });
    expect(validateRepositoryIntelligenceReviewSelection({ review: empty, artifactSet: result.artifactSet }).issues.map(value => value.code)).toContain('no-artifacts-selected');

    const architecture = item(result.review, 'architecture-memory');
    let review = dispatch(result.review, { type: 'include', artifactId: architecture.artifactId });
    review = dispatch(review, { type: 'acknowledge-human-review', artifactId: architecture.artifactId, acknowledged: true });
    const unsafe = structuredClone(review);
    const unsafeArchitecture = item(unsafe, 'architecture-memory');
    unsafeArchitecture.preservation = { mode: 'replace-managed', existingContentPreserved: false };
    unsafeArchitecture.artifactFingerprint = 'changed';
    const validation = validateRepositoryIntelligenceReviewSelection({ review: unsafe, artifactSet: result.artifactSet });
    expect(validation.issues.map(value => value.code)).toEqual(expect.arrayContaining(['destructive-handwritten-replacement', 'artifact-fingerprint-stale']));
  });

  it('builds a stable minimal payload containing only selected validated artifacts', () => {
    const result = build();
    const first = buildRepositoryIntelligenceSelectedArtifactPayload({ review: result.review, artifactSet: result.artifactSet });
    const second = buildRepositoryIntelligenceSelectedArtifactPayload({ review: result.review, artifactSet: result.artifactSet });
    expect(first.validation.issues).toEqual([]);
    expect(first.payload).toEqual(second.payload);
    expect(first.payload?.artifacts).toHaveLength(result.review.summary.selectedArtifacts);
    expect(first.payload?.artifacts.every(value => result.review.items.find(itemValue => itemValue.artifactId === value.artifactId)?.selected)).toBe(true);
    expect(first.payload?.artifacts.every(value => value.statementProvenance.length > 0 || value.targetPath.endsWith('EVIDENCE_MANIFEST.json'))).toBe(true);
    const serialized = JSON.stringify(first.payload);
    expect(serialized).not.toContain('review-secret-must-never-appear');
    expect(serialized).not.toMatch(/[A-Z]:\\|\/Users\/|githubToken|credentials|rawProvider|prompt/i);
  });

  it('keeps evidence paths traceable and rejected/provider-only data absent', () => {
    const scanInput = fixture();
    const rejectedOnlyResult: RepositoryDeepIntelligenceValidatedResult = {
      version: REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
      findings: [],
      rejectedFindings: [{ originalProviderFindingId: 'rejected-provider-secret-claim', state: 'rejected', reasonCodes: ['missing-evidence'], validationMessages: ['Rejected because it has no repository evidence.'] }],
      summary: { receivedFindings: 1, acceptedFindings: 0, acceptedWithLimitations: 0, requiringHumanReview: 0, rejectedFindings: 1, unavailableFindings: 0, duplicateProviderFindingIds: 0, confidenceDowngrades: 0, validationMessages: [] },
      metadata: {
        providerId: 'test-boundary',
        responseSchemaVersion: REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
        requestFingerprint: 'request-fingerprint',
        promptContractVersion: REPOSITORY_DEEP_INTELLIGENCE_PROMPT_CONTRACT_VERSION,
        validatorVersion: REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION,
        requestedCapabilities: [], returnedCapabilities: [], truncated: false, providerWarnings: [],
      },
      limitations: [],
      fingerprint: 'validated-result-fingerprint',
    };
    const result = buildRepositoryIntelligenceArtifactReview({ scanInput, deepIntelligenceResult: rejectedOnlyResult });
    expect(result.review.items.flatMap(value => value.evidence).every(value => result.evidenceResult.evidence.some(evidence => evidence.id === value.id && evidence.repositoryRelativePath === value.path))).toBe(true);
    expect(JSON.stringify(result.review)).not.toContain('rejected-provider-secret-claim');
    expect(JSON.stringify(result.review)).not.toMatch(/rawProvider|system prompt|chain-of-thought/i);
  });

  it('rejects mismatched repository and scan identities before payload preparation', () => {
    const result = build();
    const validation = validateRepositoryIntelligenceReviewSelection({
      review: result.review,
      artifactSet: result.artifactSet,
      expectedRepositoryIdentityFingerprint: 'different-repository',
      expectedScanIdentity: 'different-scan',
    });
    expect(validation.issues.map(value => value.code)).toEqual(expect.arrayContaining(['repository-identity-mismatch', 'scan-identity-mismatch']));
  });

  it('reports deterministic-only eligibility without presenting production LLM analysis', () => {
    const result = build();
    expect(result.review.analysisMode).toBe('deterministic-repository-evidence');
    expect(result.review.eligibility.state).toMatch(/supported|partially/);
    expect(JSON.stringify(result.review)).not.toMatch(/production LLM|provider response/i);
  });
});

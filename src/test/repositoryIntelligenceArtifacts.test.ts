import { describe, expect, it } from 'vitest';
import {
  REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_PROMPT_CONTRACT_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION,
  buildRepositoryIntelligenceEvidence,
  generateRepositoryIntelligenceArtifacts,
  planRepositoryIntelligenceArtifacts,
  prepareRepositoryIntelligenceContext,
  resolveRepositoryIntelligenceArtifactPolicy,
  validateRepositoryIntelligenceArtifactSet,
  type RepositoryDeepIntelligenceValidatedFinding,
  type RepositoryDeepIntelligenceValidatedResult,
  type RepositoryIntelligenceArtifactSet,
  type RepositoryIntelligenceEvidenceModel,
} from '@/lib/repositoryIntelligence';
import type { RepoFileSummary, RepoScanInput } from '@/lib/types';

function artifactFixture(extra: Record<string, string> = {}): RepoScanInput {
  const textContents: Record<string, string> = {
    'package.json': JSON.stringify({
      scripts: { test: 'vitest', build: 'vite build', lint: 'eslint .' },
      dependencies: { react: '^18', vite: '^5', express: '^5', zod: '^3' },
    }),
    'README.md': '# Artifact fixture',
    'docs/OVERVIEW.md': '# Repository overview',
    'vite.config.ts': "import { defineConfig } from 'vite'; export default defineConfig({});",
    'vitest.config.ts': "import { defineConfig } from 'vitest/config'; export default defineConfig({});",
    'src/main.tsx': "import App from './App'; export const bootstrap = () => <App />;",
    'src/App.tsx': "import { Button } from './components/Button'; import { loadUser } from './services/userService'; export function App() { return <Button>{String(loadUser())}</Button>; } export default App;",
    'src/components/Button.tsx': 'export function Button({ children }) { return <button>{children}</button>; }',
    'src/services/userService.ts': "import { findUser } from '../repositories/userRepository'; export function loadUser() { return findUser(); }",
    'src/repositories/userRepository.ts': 'export function findUser() { return null; }',
    'src/validation/userSchema.ts': "import { z } from 'zod'; export const UserSchema = z.object({ id: z.string() });",
    'src/routes/users.ts': "import { Router } from 'express'; const router = Router(); router.get('/users', (_req, res) => res.json([])); export default router;",
    'src/App.test.tsx': "import App from './App'; export const subject = App;",
    'src/misc/largeUnknown.ts': `const payload = '${'x'.repeat(10_000)}';`,
    '.env': 'API_KEY=never-include-artifact-secret',
    ...extra,
  };
  const generated = ['dist/assets/app.js', 'node_modules/pkg/index.js'];
  const files: RepoFileSummary[] = [...Object.keys(textContents), ...generated].map(path => ({
    path,
    size: textContents[path]?.length || 30,
    ignored: generated.includes(path),
    ignoredReason: generated.includes(path) ? 'generated-vendor' : undefined,
  }));
  return {
    repoName: 'artifact-fixture',
    source: { sourceType: 'github-url', githubOwner: 'example', githubRepo: 'artifact-fixture', githubBranch: 'main' },
    files,
    textContents,
  };
}

function inputs(scanInput = artifactFixture(), withDeep = false) {
  const evidenceResult = buildRepositoryIntelligenceEvidence(scanInput);
  const contextBundle = prepareRepositoryIntelligenceContext({
    scanInput,
    evidenceResult,
    policy: { maximumSelectedFiles: 14, maximumSupportingFiles: 3, maximumTotalCharacters: 40_000 },
  });
  const deepIntelligenceResult = withDeep ? deepResult(evidenceResult) : undefined;
  return { scanInput, evidenceResult, contextBundle, deepIntelligenceResult };
}

function deepResult(evidence: RepositoryIntelligenceEvidenceModel): RepositoryDeepIntelligenceValidatedResult {
  const appEvidence = evidence.evidence.find(item => item.repositoryRelativePath === 'src/App.tsx' && item.category === 'responsibility')!;
  const serviceEvidence = evidence.evidence.find(item => item.repositoryRelativePath === 'src/services/userService.ts' && item.category === 'responsibility')!;
  const findings: RepositoryDeepIntelligenceValidatedFinding[] = [
    validatedFinding({
      id: 'deep-finding:architecture',
      originalProviderFindingId: 'architecture-provider',
      category: 'architecture-observation',
      title: 'Application delegates user loading to a service',
      value: 'The application component delegates user loading through the repository service boundary.',
      paths: ['src/App.tsx', 'src/services/userService.ts'],
      evidenceIds: [appEvidence.id, serviceEvidence.id],
      targets: ['architecture', 'agents-instructions'],
    }),
    validatedFinding({
      id: 'deep-finding:risk',
      originalProviderFindingId: 'risk-provider',
      category: 'repository-specific-risk',
      title: 'Authentication behavior requires review',
      value: 'Authentication-related changes near the user service require human review before artifact application.',
      paths: ['src/services/userService.ts'],
      evidenceIds: [serviceEvidence.id],
      targets: ['known-risks'],
      humanReview: true,
    }),
  ];
  return {
    version: REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
    findings,
    rejectedFindings: [{ state: 'rejected', reasonCodes: ['missing-evidence'], validationMessages: ['Rejected fixture finding.'], originalProviderFindingId: 'rejected-risk', category: 'repository-specific-risk' }],
    summary: { receivedFindings: 3, acceptedFindings: 1, acceptedWithLimitations: 0, requiringHumanReview: 1, rejectedFindings: 1, unavailableFindings: 0, duplicateProviderFindingIds: 0, confidenceDowngrades: 0, validationMessages: [] },
    metadata: {
      providerId: 'fixture', responseSchemaVersion: REPOSITORY_DEEP_INTELLIGENCE_RESPONSE_VERSION,
      requestFingerprint: 'request:fingerprint', promptContractVersion: REPOSITORY_DEEP_INTELLIGENCE_PROMPT_CONTRACT_VERSION,
      validatorVersion: REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION,
      requestedCapabilities: ['architecture-analysis'], returnedCapabilities: ['architecture-analysis'], truncated: false, providerWarnings: [],
    },
    limitations: [],
    fingerprint: 'deep-result:fingerprint',
  };
}

function validatedFinding(input: {
  id: string; originalProviderFindingId: string; category: RepositoryDeepIntelligenceValidatedFinding['category'];
  title: string; value: string; paths: string[]; evidenceIds: string[];
  targets: RepositoryDeepIntelligenceValidatedFinding['permittedArtifactTargets']; humanReview?: boolean;
}): RepositoryDeepIntelligenceValidatedFinding {
  return {
    originalProviderFindingId: input.originalProviderFindingId,
    id: input.id,
    category: input.category,
    title: input.title,
    statement: { type: input.category === 'repository-specific-risk' ? 'observation' : 'relationship', subject: input.paths[0], predicate: 'relates to', value: input.value },
    validationState: input.humanReview ? 'requires-human-review' : 'accepted',
    acceptedConfidence: 'medium',
    inferenceType: 'model-inference',
    acceptedPaths: input.paths,
    supportingEvidenceIds: input.evidenceIds,
    referencedSymbols: [],
    relationships: [],
    removedFields: [],
    validationMessages: [],
    limitations: input.humanReview ? ['Human review required for high-impact behavior.'] : [],
    humanReviewState: input.humanReview ? 'required' : 'not-required',
    eligibleForArtifactGeneration: true,
    permittedArtifactTargets: input.targets,
    artifactRelevance: ['create', 'strengthen'],
  };
}

function build(scanInput = artifactFixture(), withDeep = false) {
  const prepared = inputs(scanInput, withDeep);
  const plan = planRepositoryIntelligenceArtifacts(prepared);
  const set = generateRepositoryIntelligenceArtifacts({ artifactPlan: plan, evidenceResult: prepared.evidenceResult, deepIntelligenceResult: prepared.deepIntelligenceResult });
  const validation = validateRepositoryIntelligenceArtifactSet({ artifactSet: set, evidenceResult: prepared.evidenceResult, deepIntelligenceResult: prepared.deepIntelligenceResult, scanInput });
  return { ...prepared, plan, set, validation };
}

function reverseEvidence(evidence: RepositoryIntelligenceEvidenceModel): RepositoryIntelligenceEvidenceModel {
  return { ...evidence, evidence: [...evidence.evidence].reverse(), files: [...evidence.files].reverse(), folders: [...evidence.folders].reverse(), relationships: [...evidence.relationships].reverse() };
}

describe('Repository Intelligence artifact determinism', () => {
  it('keeps plans, IDs, statements, Markdown and manifest stable across reordered inputs', () => {
    const first = inputs(artifactFixture(), true);
    const firstPlan = planRepositoryIntelligenceArtifacts(first);
    const reorderedScan = { ...first.scanInput, files: [...first.scanInput.files].reverse(), textContents: Object.fromEntries(Object.entries(first.scanInput.textContents).reverse()) };
    const secondInput = {
      ...first,
      scanInput: reorderedScan,
      evidenceResult: reverseEvidence(first.evidenceResult),
      deepIntelligenceResult: { ...first.deepIntelligenceResult!, findings: [...first.deepIntelligenceResult!.findings].reverse() },
    };
    const secondPlan = planRepositoryIntelligenceArtifacts(secondInput);
    const firstSet = generateRepositoryIntelligenceArtifacts({ artifactPlan: firstPlan, evidenceResult: first.evidenceResult, deepIntelligenceResult: first.deepIntelligenceResult });
    const secondSet = generateRepositoryIntelligenceArtifacts({ artifactPlan: secondPlan, evidenceResult: secondInput.evidenceResult, deepIntelligenceResult: secondInput.deepIntelligenceResult });
    expect(secondPlan).toEqual(firstPlan);
    expect(secondPlan.artifacts.map(item => item.id)).toEqual(firstPlan.artifacts.map(item => item.id));
    expect(secondPlan.artifacts.flatMap(item => item.statements.map(statement => statement.id))).toEqual(firstPlan.artifacts.flatMap(item => item.statements.map(statement => statement.id)));
    expect(secondSet.fingerprint).toBe(firstSet.fingerprint);
    expect(secondSet.artifacts).toEqual(firstSet.artifacts);
    expect(secondSet.manifest).toEqual(firstSet.manifest);
  });
});

describe('artifact planning and existing-file preservation', () => {
  it('creates meaningful missing artifacts and never creates empty shells', () => {
    const result = build();
    expect(result.plan.artifacts.find(item => item.targetPath === 'AGENTS.md')?.operation).toBe('create');
    expect(result.plan.artifacts.filter(item => item.operation === 'create').every(item => item.category === 'evidence-manifest' || item.statements.some(statement => !['limitation', 'unavailable-information-notice'].includes(statement.type)))).toBe(true);
    expect(result.validation.issues).toEqual([]);
  });

  it('strengthens handwritten root instructions without silently replacing their content', () => {
    const handwritten = '# Team Instructions\n\n- Preserve the customer-specific workflow and review all API changes manually.';
    const result = build(artifactFixture({ 'AGENTS.md': handwritten }));
    const plan = result.plan.artifacts.find(item => item.targetPath === 'AGENTS.md')!;
    const rendered = result.set.artifacts.find(item => item.targetPath === 'AGENTS.md')!;
    expect(plan.operation).toBe('strengthen');
    expect(plan.preservation).toEqual({ mode: 'propose-additions', existingContentPreserved: true });
    expect(plan.reviewState).toBe('requires-human-review');
    expect(rendered.content).toContain('Proposed evidence-backed additions');
    expect(rendered.content).not.toContain('customer-specific workflow');
  });

  it('updates explicit ShipSeal-managed content and skips sufficiently covered content', () => {
    const managed = build(artifactFixture({ 'AGENTS.md': '# Existing\n\nGenerated by ShipSeal.\n' }));
    expect(managed.plan.artifacts.find(item => item.targetPath === 'AGENTS.md')?.operation).toBe('update');

    const first = build();
    const generatedRoot = first.set.artifacts.find(item => item.targetPath === 'AGENTS.md')!.content;
    const covered = build(artifactFixture({ 'AGENTS.md': generatedRoot }));
    expect(covered.plan.artifacts.find(item => item.targetPath === 'AGENTS.md')?.operation).toBe('skip');
  });

  it('blocks an explicit handwritten instruction conflict', () => {
    const result = build(artifactFixture({ 'AGENTS.md': '# Rules\n\nDo not add generated ShipSeal instructions to this file.' }));
    const root = result.plan.artifacts.find(item => item.targetPath === 'AGENTS.md')!;
    expect(root.operation).toBe('unavailable');
    expect(root.reviewState).toBe('blocked');
    expect(root.operationReason).toMatch(/explicitly block/i);
  });

  it('blocks an incompatible existing machine-readable manifest instead of replacing it', () => {
    const result = build(artifactFixture({ 'AGENT_MEMORY/EVIDENCE_MANIFEST.json': '{"custom":"handwritten provenance"}' }));
    const manifest = result.plan.artifacts.find(item => item.category === 'evidence-manifest')!;
    expect(manifest.operation).toBe('unavailable');
    expect(manifest.reviewState).toBe('blocked');
    expect(manifest.preservation.existingContentPreserved).toBe(true);
  });

  it('reuses compatible architecture and router paths instead of creating duplicate concepts', () => {
    const result = build(artifactFixture({
      'docs/ARCHITECTURE.md': '# Existing architecture\n\nHandwritten system boundaries.',
      'TASK_ROUTER.md': '# Existing task router\n\nHandwritten task destinations.',
    }));
    expect(result.plan.artifacts.find(item => item.category === 'architecture-memory')?.targetPath).toBe('docs/ARCHITECTURE.md');
    expect(result.plan.artifacts.find(item => item.category === 'task-router')?.targetPath).toBe('TASK_ROUTER.md');
    expect(result.plan.artifacts.find(item => item.category === 'architecture-memory')?.operation).toBe('strengthen');
  });
});

describe('repository-specific artifact content', () => {
  it('renders actual roots, commands, critical areas and architecture without generic or runtime claims', () => {
    const result = build();
    const root = result.set.artifacts.find(item => item.targetPath === 'AGENTS.md')!.content;
    const architecture = result.set.artifacts.find(item => item.category === 'architecture-memory')!.content;
    expect(root).toContain('src/');
    expect(root).toContain('vitest');
    expect(root).toContain('src/main.tsx');
    expect(root).not.toMatch(/write clean code|follow best practices|test your changes/i);
    expect(architecture).toContain('src/main.tsx');
    expect(architecture).toContain('src/services/userService.ts');
    expect(architecture).not.toMatch(/runtime architecture is|production deployment uses/i);
    expect(architecture).toContain('Runtime call flow');
  });

  it('selects meaningful folder instructions, omits weak folders and enforces the folder cap', () => {
    const prepared = inputs();
    const plan = planRepositoryIntelligenceArtifacts({ ...prepared, policy: { maximumFolderAgentArtifacts: 2 } });
    const folders = plan.artifacts.filter(item => item.category === 'folder-agent-instructions');
    expect(folders).toHaveLength(2);
    expect(folders.every(item => !item.targetPath.includes('src/misc/'))).toBe(true);
    expect(folders.some(item => item.targetPath.includes('src/misc/'))).toBe(false);
  });

  it('includes explainable critical files but not a large unknown file solely for size', () => {
    const result = build();
    const critical = result.plan.artifacts.find(item => item.category === 'critical-files-memory')!;
    expect(critical.statements.some(item => item.referencedPaths.includes('src/main.tsx'))).toBe(true);
    expect(critical.statements.some(item => item.referencedPaths.includes('src/misc/largeUnknown.ts'))).toBe(false);
    expect(critical.statements.every(item => item.supportingEvidenceIds.length > 0)).toBe(true);
  });

  it('includes verified commands and repository-backed task routes without executing commands', () => {
    const result = build();
    const commands = result.plan.artifacts.find(item => item.category === 'command-map')!;
    const routes = result.plan.artifacts.find(item => item.category === 'task-router')!;
    expect(commands.statements.map(item => item.content.text).join(' ')).toMatch(/vitest|vite build|eslint/);
    expect(commands.statements.every(item => item.supportingEvidenceIds.length > 0)).toBe(true);
    expect(routes.statements.some(item => item.content.text.includes('src/routes/users.ts'))).toBe(true);
    expect(routes.statements.some(item => item.content.text.includes('src/repositories/userRepository.ts'))).toBe(true);
  });

  it('uses validated findings only for permitted targets and flags human-review risks', () => {
    const result = build(artifactFixture(), true);
    const risks = result.plan.artifacts.find(item => item.category === 'known-risks-memory')!;
    expect(risks.operation).toBe('create');
    expect(risks.reviewState).toBe('requires-human-review');
    expect(risks.contributingFindingIds).toContain('deep-finding:risk');
    expect(risks.contributingFindingIds).not.toContain('rejected-risk');
    expect(risks.statements[0].humanReviewRequired).toBe(true);
  });

  it('supports deterministic-only generation and marks unsupported risk content unavailable', () => {
    const result = build();
    expect(result.plan.deterministicOnly).toBe(true);
    expect(result.plan.artifacts.find(item => item.category === 'known-risks-memory')?.operation).toBe('unavailable');
    expect(result.set.artifacts.find(item => item.category === 'known-risks-memory')?.content).toBe('');
  });

  it('derives context guidance from selected and generated areas without token-saving claims', () => {
    const result = build();
    const context = result.set.artifacts.find(item => item.category === 'context-guidance')!.content;
    expect(context).toContain('src/main.tsx');
    expect(context).toMatch(/dist|node_modules/);
    expect(context).not.toMatch(/save[s]? \d+ tokens|guaranteed performance/i);
  });
});

describe('artifact manifest, validation and safety', () => {
  it('maps every substantive statement to evidence/findings without source contents or secrets', () => {
    const result = build(artifactFixture(), true);
    const plannedStatements = result.plan.artifacts.filter(item => item.category !== 'evidence-manifest').flatMap(item => item.statements);
    const manifestStatements = result.set.manifest.artifacts.flatMap(item => item.statements);
    expect(new Set(manifestStatements.map(item => item.id))).toEqual(new Set(plannedStatements.map(item => item.id)));
    expect(manifestStatements.filter(item => !['limitation', 'unavailable-information-notice'].includes(item.type)).every(item => item.evidenceIds.length || item.findingIds.length)).toBe(true);
    const serialized = JSON.stringify(result.set.manifest);
    expect(serialized).not.toContain('never-include-artifact-secret');
    expect(serialized).not.toContain("const payload = '");
    expect(serialized).not.toMatch(/[A-Z]:\\|\/Users\/|\/home\//);
    expect(result.validation.issues).toEqual([]);
  });

  it('rejects secrets, absolute paths, execution claims and unsupported certification in rendered drafts', () => {
    const result = build();
    const unsafe = structuredClone(result.set) as RepositoryIntelligenceArtifactSet;
    const root = unsafe.artifacts.find(item => item.targetPath === 'AGENTS.md')!;
    root.content += '\nAPI_KEY=leaked-value\nC:\\Users\\developer\\repo\nShipSeal executed the code and it is certified.\n';
    const validation = validateRepositoryIntelligenceArtifactSet({ artifactSet: unsafe, evidenceResult: result.evidenceResult, scanInput: result.scanInput });
    expect(validation.valid).toBe(false);
    expect(validation.issues.map(item => item.code)).toContain('unsafe-rendered-content');
    expect(JSON.stringify(validation.issues)).not.toContain('leaked-value');
  });

  it('rejects unknown provenance, nonexistent paths and invented generic guidance', () => {
    const result = build();
    const unsafe = structuredClone(result.set) as RepositoryIntelligenceArtifactSet;
    const statement = unsafe.plan.artifacts.find(item => item.category === 'architecture-memory')!.statements[0];
    statement.supportingEvidenceIds = ['evidence:not-real'];
    statement.referencedPaths = ['src/not-real.ts'];
    statement.content.text = 'Follow best practices.';
    const validation = validateRepositoryIntelligenceArtifactSet({ artifactSet: unsafe, evidenceResult: result.evidenceResult, scanInput: result.scanInput });
    expect(validation.valid).toBe(false);
    expect(validation.issues.map(item => item.code)).toEqual(expect.arrayContaining(['unknown-statement-path', 'unknown-statement-evidence', 'generic-statement']));
  });

  it('rejects invalid generation policy values deterministically', () => {
    expect(() => resolveRepositoryIntelligenceArtifactPolicy({ maximumCriticalFiles: -1 })).toThrow(/invalid/i);
    expect(() => resolveRepositoryIntelligenceArtifactPolicy({ maximumArtifactCharacters: 0 })).toThrow(/positive/i);
  });
});

import { normalizeZipPath } from '../scannerLimits';
import { stableContextFingerprint } from './contextSelection';
import type { RepositoryEvidence, RepositoryResponsibility } from './evidence';
import type { RepositoryDeepIntelligenceValidatedFinding } from './deepIntelligenceSchema';
import {
  REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
  resolveRepositoryIntelligenceArtifactPolicy,
  type PlanRepositoryIntelligenceArtifactsInput,
  type RepositoryIntelligenceArtifactCategory,
  type RepositoryIntelligenceArtifactOperation,
  type RepositoryIntelligenceArtifactPlan,
  type RepositoryIntelligenceArtifactStatement,
  type RepositoryIntelligenceArtifactStatementType,
  type RepositoryIntelligenceExistingFileState,
  type RepositoryIntelligencePlannedArtifact,
} from './artifactSchema';

const CATEGORY_ORDER: RepositoryIntelligenceArtifactCategory[] = [
  'root-agent-instructions', 'folder-agent-instructions', 'architecture-memory',
  'critical-files-memory', 'command-map', 'known-risks-memory', 'task-router',
  'context-guidance', 'evidence-manifest',
];

const MEMORY_PATHS: Record<Exclude<RepositoryIntelligenceArtifactCategory, 'root-agent-instructions' | 'folder-agent-instructions' | 'evidence-manifest'>, string> = {
  'architecture-memory': 'AGENT_MEMORY/ARCHITECTURE.md',
  'critical-files-memory': 'AGENT_MEMORY/CRITICAL_FILES.md',
  'command-map': 'AGENT_MEMORY/COMMAND_MAP.md',
  'known-risks-memory': 'AGENT_MEMORY/KNOWN_RISKS.md',
  'task-router': 'AGENT_MEMORY/TASK_ROUTER.md',
  'context-guidance': 'AGENT_MEMORY/CONTEXT_GUIDANCE.md',
};

const ARTIFACT_TARGETS: Partial<Record<RepositoryIntelligenceArtifactCategory, string>> = {
  'root-agent-instructions': 'agents-instructions',
  'folder-agent-instructions': 'agents-instructions',
  'architecture-memory': 'architecture',
  'critical-files-memory': 'critical-files',
  'command-map': 'command-map',
  'known-risks-memory': 'known-risks',
  'task-router': 'task-router',
  'context-guidance': 'context-guide',
};

const ROUTE_RESPONSIBILITIES: Array<{ label: string; responsibilities: RepositoryResponsibility[] }> = [
  { label: 'Application and UI tasks', responsibilities: ['ui-component', 'layout', 'route-or-page', 'application-entry-point'] },
  { label: 'API tasks', responsibilities: ['api-route-or-request-handler'] },
  { label: 'Service and integration tasks', responsibilities: ['service', 'integration'] },
  { label: 'Data tasks', responsibilities: ['repository-or-data-access-layer', 'schema-or-model', 'validation'] },
  { label: 'State tasks', responsibilities: ['state-management', 'hook'] },
  { label: 'Verification tasks', responsibilities: ['test-or-fixture', 'test-configuration'] },
  { label: 'Build and configuration tasks', responsibilities: ['configuration', 'build-configuration'] },
  { label: 'Documentation tasks', responsibilities: ['documentation', 'ai-agent-instruction'] },
];

export function planRepositoryIntelligenceArtifacts(input: PlanRepositoryIntelligenceArtifactsInput): RepositoryIntelligenceArtifactPlan {
  const policy = resolveRepositoryIntelligenceArtifactPolicy(input.policy);
  const evidenceById = new Map(input.evidenceResult.evidence.map(item => [item.id, item]));
  const existing = existingFiles(input);
  const acceptedFindings = [...(input.deepIntelligenceResult?.findings || [])]
    .filter(finding => confidenceRank(finding.acceptedConfidence) >= confidenceRank(policy.minimumAcceptedConfidence))
    .filter(finding => policy.includeHumanReviewFindings || finding.humanReviewState !== 'required')
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!acceptedFindings.length && !policy.deterministicOnlyFallback) {
    throw new Error('Artifact generation requires validated findings when deterministic fallback is disabled.');
  }

  const specs: Array<{ category: RepositoryIntelligenceArtifactCategory; path: string; statements: RepositoryIntelligenceArtifactStatement[]; dependencies?: RepositoryIntelligenceArtifactCategory[] }> = [];
  const rootStatements = rootAgentStatements(input, evidenceById, acceptedFindings);
  specs.push({ category: 'root-agent-instructions', path: 'AGENTS.md', statements: rootStatements, dependencies: ['task-router', 'command-map', 'context-guidance'] });

  const folderSpecs = folderAgentSpecs(input, acceptedFindings).slice(0, policy.maximumFolderAgentArtifacts);
  specs.push(...folderSpecs.map(item => ({ ...item, dependencies: ['root-agent-instructions' as const] })));

  specs.push(
    { category: 'architecture-memory', path: compatiblePath(existing, MEMORY_PATHS['architecture-memory'], ['ARCHITECTURE.md', 'docs/ARCHITECTURE.md']), statements: architectureStatements(input, acceptedFindings) },
    { category: 'critical-files-memory', path: MEMORY_PATHS['critical-files-memory'], statements: criticalFileStatements(input, acceptedFindings).slice(0, policy.maximumCriticalFiles) },
    { category: 'command-map', path: MEMORY_PATHS['command-map'], statements: commandStatements(input, acceptedFindings) },
    { category: 'known-risks-memory', path: MEMORY_PATHS['known-risks-memory'], statements: riskStatements(input, acceptedFindings).slice(0, policy.maximumRisks) },
    { category: 'task-router', path: compatiblePath(existing, MEMORY_PATHS['task-router'], ['TASK_ROUTER.md']), statements: taskRouteStatements(input, acceptedFindings).slice(0, policy.maximumTaskRoutes) },
    { category: 'context-guidance', path: compatiblePath(existing, MEMORY_PATHS['context-guidance'], ['CONTEXT_GUIDANCE.md']), statements: contextStatements(input, acceptedFindings) },
    { category: 'evidence-manifest', path: 'AGENT_MEMORY/EVIDENCE_MANIFEST.json', statements: [] },
  );

  const artifacts = specs
    .map(spec => planArtifact(spec.category, spec.path, spec.statements.slice(0, policy.maximumStatementsPerArtifact), spec.dependencies || [], existing))
    .sort(compareArtifacts);
  const operationCounts = emptyOperationCounts();
  for (const artifact of artifacts) operationCounts[artifact.operation] += 1;
  const limitations = sortedUnique([
    ...input.evidenceResult.limitations,
    ...input.contextBundle.limitations,
    ...(acceptedFindings.length ? [] : ['No validated deep-intelligence findings contributed; artifacts use deterministic evidence only.']),
    ...(folderSpecs.length >= policy.maximumFolderAgentArtifacts && eligibleFolders(input).length > folderSpecs.length
      ? ['Folder-level AGENTS.md planning was bounded by policy.'] : []),
  ]);
  const summary = {
    totalArtifacts: artifacts.length,
    readyForReview: artifacts.filter(item => item.reviewState === 'ready-for-review').length,
    requiringHumanReview: artifacts.filter(item => item.reviewState === 'requires-human-review').length,
    blocked: artifacts.filter(item => item.reviewState === 'blocked').length,
    unavailable: artifacts.filter(item => item.reviewState === 'unavailable').length,
    operationCounts,
    statementCount: artifacts.reduce((total, artifact) => total + artifact.statements.length, 0),
    evidenceReferenceCount: new Set(artifacts.flatMap(artifact => artifact.requiredEvidenceIds)).size,
    findingReferenceCount: new Set(artifacts.flatMap(artifact => artifact.contributingFindingIds)).size,
  };
  const inputFingerprints = {
    contextBundle: input.contextBundle.fingerprint,
    deepIntelligenceResult: input.deepIntelligenceResult?.fingerprint,
  };
  const fingerprint = stableContextFingerprint({
    version: REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
    policy,
    artifacts,
    limitations,
    deterministicOnly: !acceptedFindings.length,
    inputFingerprints,
  });
  return {
    version: REPOSITORY_INTELLIGENCE_ARTIFACT_SCHEMA_VERSION,
    policy,
    artifacts,
    summary,
    limitations,
    deterministicOnly: !acceptedFindings.length,
    inputFingerprints,
    fingerprint,
  };
}

function rootAgentStatements(
  input: PlanRepositoryIntelligenceArtifactsInput,
  evidenceById: Map<string, RepositoryEvidence>,
  findings: RepositoryDeepIntelligenceValidatedFinding[],
) {
  const statements: RepositoryIntelligenceArtifactStatement[] = [];
  for (const folder of eligibleFolders(input).slice(0, 5)) {
    const dominant = folder.dominantResponsibilities[0];
    statements.push(statement('root-agent-instructions', 'Repository areas', 'responsibility-description',
      `${folder.path}/ contains ${displayResponsibility(dominant.responsibility)} responsibilities evidenced across ${dominant.fileCount} file(s).`,
      [folder.path], folder.supportingEvidenceIds, [], confidenceFor(folder.confidence), folder.limitations.length ? 'limited' : 'verified', folder.limitations));
  }
  statements.push(...commandStatements(input, findings).slice(0, 5).map(item => statement(
    'root-agent-instructions', item.section, item.type, item.content.text, item.referencedPaths,
    item.supportingEvidenceIds, item.supportingFindingIds, item.acceptedConfidence, item.validationState,
    item.limitations, item.referencedSymbols, item.humanReviewRequired,
  )));
  for (const item of input.contextBundle.items.filter(item => item.selectionReasons.some(reason => [
    'application-entry-point', 'route-or-api-surface', 'critical-configuration', 'data-access-area',
  ].includes(reason))).slice(0, 6)) {
    statements.push(statement('root-agent-instructions', 'Critical areas', 'instruction',
      `Start repository work involving ${displayResponsibility(item.primaryResponsibility)} at ${item.path}; treat it as a likely starting point, not exclusive ownership.`,
      [item.path], item.supportingEvidenceIds, [], confidenceFor(input.evidenceResult.files.find(file => file.path === item.path)?.confidence || 0.5), 'verified', item.limitations));
  }
  for (const evidence of input.evidenceResult.evidence.filter(item => item.category === 'exclusion')
    .sort((a, b) => `${a.repositoryRelativePath}:${a.id}`.localeCompare(`${b.repositoryRelativePath}:${b.id}`)).slice(0, 4)) {
    statements.push(statement('root-agent-instructions', 'Excluded areas', 'excluded-area-rule', evidence.extractedFact,
      [evidence.repositoryRelativePath], [evidence.id], [], confidenceFor(evidence.confidence), 'verified', evidence.limitations));
  }
  statements.push(...deepStatements('root-agent-instructions', findings));
  return orderStatements(statements, evidenceById);
}

function folderAgentSpecs(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  return eligibleFolders(input).map(folder => {
    const dominant = folder.dominantResponsibilities[0];
    const statements = [
      statement('folder-agent-instructions', 'Scope', 'responsibility-description',
        `${folder.path}/ is primarily associated with ${displayResponsibility(dominant.responsibility)} based on ${dominant.fileCount} analyzed file(s).`,
        [folder.path], folder.supportingEvidenceIds, [], confidenceFor(folder.confidence), folder.limitations.length ? 'limited' : 'verified', folder.limitations),
      ...folder.importantChildFiles.slice(0, 5).map(path => {
        const file = input.evidenceResult.files.find(item => item.path === path);
        return statement('folder-agent-instructions', 'Important local files', 'instruction',
          `Inspect ${path} when the task concerns ${displayResponsibility(file?.primaryResponsibility || dominant.responsibility)}.`,
          [path], file?.supportingEvidenceIds || folder.supportingEvidenceIds, [], confidenceFor(file?.confidence || folder.confidence), 'verified', file?.limitations || []);
      }),
      ...deepStatements('folder-agent-instructions', findings.filter(finding => finding.acceptedPaths.some(path => path === folder.path || path.startsWith(`${folder.path}/`)))),
    ];
    return { category: 'folder-agent-instructions' as const, path: `${folder.path}/AGENTS.md`, statements: orderStatements(statements) };
  });
}

function architectureStatements(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const statements: RepositoryIntelligenceArtifactStatement[] = [];
  for (const file of input.evidenceResult.files
    .filter(item => item.primaryResponsibility !== 'unknown-or-insufficient-evidence' && item.primaryResponsibility !== 'generated-or-vendor-content')
    .sort((a, b) => responsibilityPriority(a.primaryResponsibility) - responsibilityPriority(b.primaryResponsibility) || a.path.localeCompare(b.path)).slice(0, 16)) {
    statements.push(statement('architecture-memory', sectionForResponsibility(file.primaryResponsibility), 'responsibility-description',
      `${file.path} is classified as ${displayResponsibility(file.primaryResponsibility)}.`, [file.path], file.supportingEvidenceIds, [],
      confidenceFor(file.confidence), file.limitations.length ? 'limited' : 'verified', file.limitations));
  }
  for (const relationship of [...input.evidenceResult.relationships]
    .filter(item => item.type !== 'contains' && item.sourcePath !== '.' && item.targetPath !== '.')
    .sort((a, b) => `${a.type}:${a.sourcePath}:${a.targetPath}:${a.id}`.localeCompare(`${b.type}:${b.sourcePath}:${b.targetPath}:${b.id}`)).slice(0, 12)) {
    statements.push(statement('architecture-memory', 'Static relationships', 'relationship',
      `${relationship.sourcePath} ${displayRelationship(relationship.type)} ${relationship.targetPath}.`,
      [relationship.sourcePath, relationship.targetPath], relationship.supportingEvidenceIds, [], confidenceFor(relationship.confidence),
      relationship.validationState === 'validated' ? 'verified' : 'inferred', []));
  }
  statements.push(...deepStatements('architecture-memory', findings));
  statements.push(statement('architecture-memory', 'Static-analysis limitations', 'limitation',
    'Runtime call flow, dynamic imports, unresolved aliases and deployment behavior are not established by this static artifact.', [], [], [], 'low', 'limited', input.evidenceResult.limitations));
  return orderStatements(statements);
}

function criticalFileStatements(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const candidates = input.contextBundle.items.filter(item => item.selectionReasons.some(reason => [
    'application-entry-point', 'framework-bootstrap', 'critical-configuration', 'route-or-api-surface',
    'authentication-or-authorization-area', 'data-access-area', 'test-or-verification-configuration',
    'high-relationship-centrality', 'central-import-dependency',
  ].includes(reason)));
  return orderStatements([
    ...candidates.map(item => statement('critical-files-memory', 'Critical files', 'repository-fact',
      `${item.path} is prioritized because ${item.selectionReasons.join(', ')}; its responsibility is ${displayResponsibility(item.primaryResponsibility)}.`,
      [item.path], item.supportingEvidenceIds, [], confidenceFor(input.evidenceResult.files.find(file => file.path === item.path)?.confidence || 0.5),
      item.limitations.length ? 'limited' : 'verified', item.limitations, item.structuralOutline?.declaredSymbols.map(symbol => ({ path: item.path, name: symbol.name })) || [])),
    ...deepStatements('critical-files-memory', findings),
  ]);
}

function commandStatements(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const deterministic = input.evidenceResult.evidence.filter(item => item.category === 'command')
    .sort((a, b) => `${a.repositoryRelativePath}:${a.id}`.localeCompare(`${b.repositoryRelativePath}:${b.id}`)).map(evidence => statement(
    'command-map', 'Verified commands', 'command', evidence.extractedFact, [evidence.repositoryRelativePath], [evidence.id], [],
    confidenceFor(evidence.confidence), evidence.assertionState === 'verified' ? 'verified' : 'limited', evidence.limitations,
  ));
  return orderStatements([...deterministic, ...deepStatements('command-map', findings.filter(finding => finding.commandState !== 'unsupported'))]);
}

function riskStatements(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const deterministic = input.evidenceResult.evidence.filter(item => item.category === 'risk')
    .sort((a, b) => `${a.repositoryRelativePath}:${a.id}`.localeCompare(`${b.repositoryRelativePath}:${b.id}`)).map(evidence => statement(
    'known-risks-memory', 'Known risks', 'risk', evidence.extractedFact, [evidence.repositoryRelativePath], [evidence.id], [],
    confidenceFor(evidence.confidence), evidence.assertionState === 'verified' ? 'verified' : 'limited', evidence.limitations,
  ));
  return orderStatements([...deterministic, ...deepStatements('known-risks-memory', findings)]);
}

function taskRouteStatements(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const routes: RepositoryIntelligenceArtifactStatement[] = [];
  for (const route of ROUTE_RESPONSIBILITIES) {
    const files = input.evidenceResult.files.filter(file => route.responsibilities.includes(file.primaryResponsibility) && file.safeToPrioritizeForDeepAnalysis)
      .sort((a, b) => a.path.localeCompare(b.path)).slice(0, 5);
    if (!files.length) continue;
    routes.push(statement('task-router', 'Task routes', 'route',
      `${route.label}: likely starting points are ${files.map(file => file.path).join(', ')}.`,
      files.map(file => file.path), files.flatMap(file => file.supportingEvidenceIds), [], confidenceFor(Math.min(...files.map(file => file.confidence))),
      files.some(file => file.limitations.length) ? 'limited' : 'verified', files.flatMap(file => file.limitations)));
  }
  return orderStatements([...routes, ...deepStatements('task-router', findings)]);
}

function contextStatements(input: PlanRepositoryIntelligenceArtifactsInput, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const statements: RepositoryIntelligenceArtifactStatement[] = [];
  for (const item of input.contextBundle.items.slice(0, 10)) {
    statements.push(statement('context-guidance', 'Load first', 'context-loading-rule',
      `Load ${item.path} when work involves ${displayResponsibility(item.primaryResponsibility)}; it was selected for ${item.selectionReasons.join(', ')}.`,
      [item.path], item.supportingEvidenceIds, [], confidenceFor(input.evidenceResult.files.find(file => file.path === item.path)?.confidence || 0.5),
      item.truncation.truncated ? 'limited' : 'verified', item.limitations));
  }
  for (const folder of input.evidenceResult.folders.filter(item => item.generatedOrVendor).sort((a, b) => a.path.localeCompare(b.path)).slice(0, 8)) {
    statements.push(statement('context-guidance', 'Avoid routine loading', 'excluded-area-rule',
      `Do not treat ${folder.path}/ as analyzed handwritten source; it is classified as generated or vendor content.`,
      [folder.path], folder.supportingEvidenceIds, [], confidenceFor(folder.confidence), 'verified', folder.limitations));
  }
  for (const area of input.contextBundle.uncoveredAreas.slice(0, 8)) {
    statements.push(statement('context-guidance', 'Coverage limitations', 'limitation',
      `${area.type} ${area.id} remains ${area.reason}; absence from this context is not evidence that the area does not exist.`,
      area.candidatePaths, [], [], 'low', 'limited', [`Context coverage state: ${area.reason}`]));
  }
  return orderStatements([...statements, ...deepStatements('context-guidance', findings)]);
}

function deepStatements(category: RepositoryIntelligenceArtifactCategory, findings: RepositoryDeepIntelligenceValidatedFinding[]) {
  const target = ARTIFACT_TARGETS[category];
  if (!target) return [];
  return findings.filter(finding => finding.eligibleForArtifactGeneration && finding.permittedArtifactTargets.includes(target as never)).map(finding => statement(
    category,
    sectionForFinding(finding),
    statementTypeForFinding(finding),
    finding.statement.value,
    finding.acceptedPaths,
    finding.supportingEvidenceIds,
    [finding.id],
    finding.acceptedConfidence,
    finding.validationState === 'accepted' && finding.inferenceType === 'verified' ? 'verified' : 'inferred',
    finding.limitations,
    finding.referencedSymbols,
    finding.humanReviewState === 'required',
  ));
}

function planArtifact(
  category: RepositoryIntelligenceArtifactCategory,
  targetPath: string,
  statements: RepositoryIntelligenceArtifactStatement[],
  dependencies: RepositoryIntelligenceArtifactCategory[],
  existing: Map<string, ExistingFile>,
): RepositoryIntelligencePlannedArtifact {
  const normalizedPath = normalizeZipPath(targetPath);
  if (!normalizedPath) throw new Error(`Invalid artifact target path: ${targetPath}`);
  const existingFile = existing.get(normalizedPath);
  const existingFileState = inspectExisting(existingFile);
  const instructionConflict = (category === 'root-agent-instructions' || category === 'folder-agent-instructions')
    && /do not (?:add|merge|use) (?:generated|shipseal).{0,40}(?:instruction|guidance)/i.test(existingFile?.content || '');
  const manifestConflict = category === 'evidence-manifest' && ['handwritten', 'partial'].includes(existingFileState);
  const substantive = statements.filter(item => !['heading', 'limitation', 'unavailable-information-notice'].includes(item.type));
  const eligible = artifactEligible(category, substantive);
  let operation: RepositoryIntelligenceArtifactOperation;
  let operationReason: string;
  if (manifestConflict) {
    operation = 'unavailable';
    operationReason = 'An incompatible existing evidence-manifest file cannot be safely strengthened or replaced.';
  } else if (instructionConflict) {
    operation = 'unavailable';
    operationReason = 'Existing handwritten instructions explicitly block generated instruction additions.';
  } else if (!eligible) {
    operation = 'unavailable';
    operationReason = 'Repository-specific evidence was insufficient; a generic shell artifact was not created.';
  } else if (existingFileState === 'excluded-or-unavailable' || existingFileState === 'uninterpretable') {
    operation = 'unavailable';
    operationReason = 'The existing target could not be safely interpreted from scanner-loaded text.';
  } else if (existingFile && adequatelyCovers(existingFile.content, substantive)) {
    operation = 'skip';
    operationReason = 'The existing artifact already covers the available repository-specific statements.';
  } else if (existingFileState === 'shipseal-managed') {
    operation = 'update';
    operationReason = 'An explicitly ShipSeal-managed artifact can be updated without treating handwritten content as replaceable.';
  } else if (existingFileState === 'handwritten' || existingFileState === 'partial') {
    operation = 'strengthen';
    operationReason = 'Existing handwritten or partial content is preserved; only evidence-backed additions are proposed.';
  } else {
    operation = 'create';
    operationReason = 'The target is missing and sufficient repository-specific evidence supports a meaningful artifact.';
  }
  const humanReview = statements.some(item => item.humanReviewRequired) || operation === 'strengthen';
  const reviewState = instructionConflict || manifestConflict || existingFileState === 'uninterpretable' ? 'blocked' as const
    : operation === 'unavailable' ? 'unavailable' as const
      : humanReview ? 'requires-human-review' as const : 'ready-for-review' as const;
  const preservation = operation === 'strengthen'
    ? { mode: 'propose-additions' as const, existingContentPreserved: true }
    : operation === 'update' ? { mode: 'replace-managed' as const, existingContentPreserved: false }
      : operation === 'create' ? { mode: 'create-new' as const, existingContentPreserved: true }
        : operation === 'skip' ? { mode: 'no-change' as const, existingContentPreserved: true }
          : { mode: 'no-output' as const, existingContentPreserved: true };
  const adjustedStatements = statements.map(item => ({
    ...item,
    existingContentRelationship: operation === 'strengthen' ? 'proposed-addition' as const
      : operation === 'update' ? 'managed-update' as const
        : operation === 'skip' ? 'already-covered' as const : 'new' as const,
  }));
  const id = `ri-artifact:${stableContextFingerprint({ category, targetPath: normalizedPath })}`;
  const requiredEvidenceIds = sortedUnique(adjustedStatements.flatMap(item => item.supportingEvidenceIds));
  const contributingFindingIds = sortedUnique(adjustedStatements.flatMap(item => item.supportingFindingIds));
  const blockingLimitations = operation === 'unavailable' ? [operationReason] : [];
  const fingerprint = stableContextFingerprint({ id, category, targetPath: normalizedPath, operation, statements: adjustedStatements, dependencies, preservation });
  return { id, category, targetPath: normalizedPath, operation, operationReason, reviewState, existingFileState, statements: adjustedStatements,
    requiredEvidenceIds, contributingFindingIds, dependencies: [...dependencies].sort(), blockingLimitations, preservation, fingerprint };
}

function artifactEligible(category: RepositoryIntelligenceArtifactCategory, statements: RepositoryIntelligenceArtifactStatement[]) {
  if (category === 'evidence-manifest') return true;
  if (category === 'architecture-memory') {
    const responsibilityPaths = new Set(statements.filter(item => item.type === 'responsibility-description').flatMap(item => item.referencedPaths));
    return responsibilityPaths.size >= 2 || statements.some(item => item.supportingFindingIds.length > 0);
  }
  if (category === 'command-map') return statements.some(item => item.type === 'command');
  if (category === 'known-risks-memory') return statements.some(item => item.type === 'risk');
  if (category === 'task-router') return statements.some(item => item.type === 'route');
  if (category === 'critical-files-memory') return statements.some(item => item.type === 'repository-fact');
  if (category === 'context-guidance') return statements.some(item => ['context-loading-rule', 'excluded-area-rule'].includes(item.type));
  return statements.length > 0;
}

interface ExistingFile { path: string; content?: string; ignored: boolean }

function existingFiles(input: PlanRepositoryIntelligenceArtifactsInput) {
  const map = new Map<string, ExistingFile>();
  for (const file of [...input.scanInput.files].sort((a, b) => a.path.localeCompare(b.path))) {
    const path = normalizeZipPath(file.path);
    if (!path) continue;
    map.set(path, { path, content: input.scanInput.textContents[path], ignored: !!file.ignored });
  }
  return map;
}

function inspectExisting(file?: ExistingFile): RepositoryIntelligenceExistingFileState {
  if (!file) return 'missing';
  if (file.ignored || file.content === undefined) return 'excluded-or-unavailable';
  const content = file.content.trim();
  if (!content) return 'partial';
  if (hasUnsupportedControlCharacters(content)) return 'uninterpretable';
  if (/Generated by ShipSeal|shipseal\.[a-z-]+\.generator|shipseal\.repository-intelligence-evidence-manifest\.v1/i.test(content)) return 'shipseal-managed';
  if (content.length < 80 || !/(^|\n)#|(^|\n)-\s/m.test(content)) return 'partial';
  return 'handwritten';
}

function adequatelyCovers(content: string | undefined, statements: RepositoryIntelligenceArtifactStatement[]) {
  if (!content || !statements.length) return false;
  const normalized = content.toLowerCase();
  const covered = statements.filter(item => item.referencedPaths.some(path => normalized.includes(path.toLowerCase()))
    || (item.content.value && normalized.includes(item.content.value.toLowerCase()))).length;
  return covered / statements.length >= 0.8;
}

function compatiblePath(existing: Map<string, ExistingFile>, canonical: string, alternatives: string[]) {
  if (existing.has(canonical)) return canonical;
  return alternatives.find(path => existing.has(path)) || canonical;
}

function eligibleFolders(input: PlanRepositoryIntelligenceArtifactsInput) {
  return input.evidenceResult.folders.filter(folder => folder.path !== '.' && !folder.generatedOrVendor && folder.confidence >= 0.6
    && folder.dominantResponsibilities.length > 0
    && folder.dominantResponsibilities[0].responsibility !== 'unknown-or-insufficient-evidence'
    && folder.dominantResponsibilities[0].fileCount >= 1)
    .sort((a, b) => b.dominantResponsibilities[0].fileCount - a.dominantResponsibilities[0].fileCount || a.path.localeCompare(b.path));
}

function statement(
  artifactCategory: RepositoryIntelligenceArtifactCategory,
  section: string,
  type: RepositoryIntelligenceArtifactStatementType,
  text: string,
  referencedPaths: string[],
  evidenceIds: string[],
  findingIds: string[],
  acceptedConfidence: RepositoryDeepIntelligenceValidatedFinding['acceptedConfidence'],
  validationState: RepositoryIntelligenceArtifactStatement['validationState'],
  limitations: string[] = [],
  referencedSymbols: Array<{ path: string; name: string }> = [],
  humanReviewRequired = false,
): RepositoryIntelligenceArtifactStatement {
  const normalizedPaths = sortedUnique(referencedPaths.map(path => normalizeZipPath(path)).filter(Boolean));
  const normalized = {
    type, artifactCategory, section, content: { text: text.trim() }, referencedPaths: normalizedPaths,
    referencedSymbols: [...referencedSymbols].sort((a, b) => `${a.path}:${a.name}`.localeCompare(`${b.path}:${b.name}`)),
    supportingEvidenceIds: sortedUnique(evidenceIds), supportingFindingIds: sortedUnique(findingIds), acceptedConfidence,
    validationState, humanReviewRequired, limitations: sortedUnique(limitations), order: 0,
  };
  return { ...normalized, id: `ri-statement:${stableContextFingerprint(normalized)}` };
}

function orderStatements(statements: RepositoryIntelligenceArtifactStatement[], _evidence?: Map<string, RepositoryEvidence>) {
  const unique = new Map(statements.map(item => [item.id, item]));
  return [...unique.values()].sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section)
    || a.section.localeCompare(b.section) || a.content.text.localeCompare(b.content.text) || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, order: index }));
}

function sectionOrder(section: string) {
  const order = ['Repository areas', 'Scope', 'Application shape', 'Entry points', 'Routing and API', 'Responsibility areas',
    'Important configuration', 'Static relationships', 'Verified commands', 'Critical areas', 'Critical files', 'Known risks',
    'Task routes', 'Load first', 'Avoid routine loading', 'Excluded areas', 'Coverage limitations', 'Static-analysis limitations'];
  const index = order.indexOf(section);
  return index < 0 ? order.length : index;
}

function sectionForResponsibility(responsibility: RepositoryResponsibility) {
  if (responsibility === 'application-entry-point' || responsibility === 'framework-bootstrap') return 'Entry points';
  if (responsibility === 'route-or-page' || responsibility === 'api-route-or-request-handler' || responsibility === 'layout') return 'Routing and API';
  if (responsibility.includes('configuration')) return 'Important configuration';
  return 'Responsibility areas';
}

function sectionForFinding(finding: RepositoryDeepIntelligenceValidatedFinding) {
  if (finding.category === 'repository-specific-risk') return 'Known risks';
  if (finding.category === 'critical-file' || finding.category === 'critical-flow') return 'Critical files';
  if (finding.category === 'task-routing-recommendation') return 'Task routes';
  if (finding.category === 'verification-recommendation') return 'Verified commands';
  return 'Validated findings';
}

function statementTypeForFinding(finding: RepositoryDeepIntelligenceValidatedFinding): RepositoryIntelligenceArtifactStatementType {
  if (finding.category === 'repository-specific-risk') return 'risk';
  if (finding.category === 'task-routing-recommendation') return 'route';
  if (finding.statement.type === 'command') return 'command';
  if (finding.statement.type === 'relationship') return 'relationship';
  if (finding.statement.type === 'responsibility') return 'responsibility-description';
  return 'repository-fact';
}

function displayResponsibility(value: RepositoryResponsibility) { return value.replace(/-/g, ' '); }
function displayRelationship(value: string) { return value.replace(/-/g, ' '); }
function confidenceFor(value: number): RepositoryDeepIntelligenceValidatedFinding['acceptedConfidence'] { return value >= 0.85 ? 'high' : value >= 0.55 ? 'medium' : 'low'; }
function confidenceRank(value: RepositoryDeepIntelligenceValidatedFinding['acceptedConfidence']) { return value === 'high' ? 3 : value === 'medium' ? 2 : 1; }
function hasUnsupportedControlCharacters(value: string) {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13);
  });
}
function responsibilityPriority(value: RepositoryResponsibility) {
  const order: RepositoryResponsibility[] = ['application-entry-point', 'framework-bootstrap', 'layout', 'route-or-page', 'api-route-or-request-handler',
    'authentication-or-authorization-area', 'service', 'repository-or-data-access-layer', 'state-management', 'ui-component', 'test-configuration', 'test-or-fixture'];
  const index = order.indexOf(value); return index < 0 ? order.length : index;
}
function compareArtifacts(a: RepositoryIntelligencePlannedArtifact, b: RepositoryIntelligencePlannedArtifact) {
  return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.targetPath.localeCompare(b.targetPath);
}
function emptyOperationCounts(): Record<RepositoryIntelligenceArtifactOperation, number> { return { create: 0, update: 0, strengthen: 0, skip: 0, unavailable: 0 }; }
function sortedUnique<T extends string>(values: T[]): T[] { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }

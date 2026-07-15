import { normalizeEvidencePath, type RepositoryResponsibility } from './evidence';
import { stableContextFingerprint } from './contextSelection';
import type { RepositoryDeepIntelligenceRequest } from './deepIntelligenceRequest';
import {
  REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
  REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION,
  repositoryDeepIntelligenceProviderResponseSchema,
  resolveRepositoryDeepIntelligenceResultPolicy,
  type RepositoryDeepIntelligenceConfidence,
  type RepositoryDeepIntelligenceNormalizedProviderResponse,
  type RepositoryDeepIntelligenceRawFinding,
  type RepositoryDeepIntelligenceRejectedFinding,
  type RepositoryDeepIntelligenceResultPolicyOverride,
  type RepositoryDeepIntelligenceValidatedFinding,
  type RepositoryDeepIntelligenceValidatedRelationship,
  type RepositoryDeepIntelligenceValidatedResult,
} from './deepIntelligenceSchema';

export interface ValidateRepositoryDeepIntelligenceResponseInput {
  request: RepositoryDeepIntelligenceRequest;
  rawResponse: unknown;
  expectedProviderId?: string;
  policy?: RepositoryDeepIntelligenceResultPolicyOverride;
}

export type RepositoryDeepIntelligenceValidationOutcome =
  | { success: true; normalizedResponse: RepositoryDeepIntelligenceNormalizedProviderResponse; result: RepositoryDeepIntelligenceValidatedResult }
  | { success: false; error: { code: string; message: string } };

const HIGH_REVIEW_RE = /\b(auth(?:entication|orization)?|payments?|billing|secrets?|credentials?|data deletion|production deploy(?:ment)?|destructive migration|security controls?|legal|compliance|ai act|privacy|certification|critical business logic)\b/i;
const SECRET_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}|\b(?:API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET|PASSWORD)\s*[:=]\s*\S+/i;
const ABSOLUTE_PATH_RE = /(?:[A-Za-z]:[\\/](?:Users|Documents|home)[\\/]|file:\/\/\/|\/Users\/[^/]+\/|\/home\/[^/]+\/)/i;
const PROMPT_LEAK_RE = /\b(?:system prompt|hidden reasoning|chain[- ]of[- ]thought|developer message|ignore previous instructions)\b/i;
const EXECUTION_CLAIM_RE = /\b(?:shipseal|we|i)\s+(?:ran|executed|started|deployed|migrated)\b/i;
const CERTIFICATION_RE = /\b(?:certified|guaranteed compliant|fully compliant|legally compliant|security guarantee)\b/i;

export function validateRepositoryDeepIntelligenceResponse({
  request,
  rawResponse,
  expectedProviderId,
  policy: policyOverride,
}: ValidateRepositoryDeepIntelligenceResponseInput): RepositoryDeepIntelligenceValidationOutcome {
  const policy = resolveRepositoryDeepIntelligenceResultPolicy(policyOverride ?? request.resultLimits);
  const rawSize = safeSerializedSize(rawResponse);
  if (rawSize === undefined) return invalid('malformed-response', 'Provider response could not be safely serialized.');
  if (rawSize > policy.maximumRawResponseCharacters) return invalid('response-too-large', 'Provider response exceeded the bounded raw-response limit.');
  const parsed = repositoryDeepIntelligenceProviderResponseSchema.safeParse(rawResponse);
  if (!parsed.success) return invalid('malformed-response', 'Provider response did not match the required structured schema.');
  const response = parsed.data;
  if (!policy.acceptedResponseSchemaVersions.includes(response.schemaVersion)) return invalid('unsupported-schema', 'Provider response schema version is unsupported.');
  if (expectedProviderId && response.providerId !== expectedProviderId) return invalid('provider-mismatch', 'Provider response identity did not match the supplied provider.');
  if (response.returnedCapabilities.some(capability => !request.requestedCapabilities.includes(capability))) {
    return invalid('unsupported-capability', 'Provider returned a capability that was not requested.');
  }
  if (unsafeText(response.providerId) || unsafeText(response.modelId || '') || unsafeText(response.providerVersion || '')) {
    return invalid('unsafe-provider-metadata', 'Provider metadata failed safety validation.');
  }

  const evidenceById = new Map(request.evidenceReferences.map(evidence => [evidence.id, evidence]));
  const fileByPath = new Map(request.responsibilitySummary.map(file => [file.path, file]));
  const folderByPath = new Map(request.folderResponsibilitySummary.map(folder => [folder.path, folder]));
  const knownPaths = new Set([
    ...fileByPath.keys(), ...folderByPath.keys(),
    ...request.relationshipSummary.flatMap(relationship => [relationship.sourcePath, relationship.targetPath]),
  ]);
  const deterministicRelationships = new Map(request.relationshipSummary.map(relationship => [
    relationshipKey(relationship.type, relationship.sourcePath, relationship.targetPath), relationship,
  ]));
  const seenProviderIds = new Set<string>();
  const accepted: RepositoryDeepIntelligenceValidatedFinding[] = [];
  const rejected: RepositoryDeepIntelligenceRejectedFinding[] = [];
  let duplicateProviderFindingIds = 0;
  let confidenceDowngrades = 0;

  const findings = response.findings.slice(0, policy.maximumFindings);
  for (const overflow of response.findings.slice(policy.maximumFindings)) {
    rejected.push(rejection(overflow.id, overflow.category, ['result-limit'], 'Finding exceeded the maximum result count.'));
  }
  for (const finding of findings) {
    if (seenProviderIds.has(finding.id)) {
      duplicateProviderFindingIds += 1;
      rejected.push(rejection(finding.id, finding.category, ['duplicate-provider-id'], 'Duplicate provider finding ID was rejected.'));
      continue;
    }
    seenProviderIds.add(finding.id);
    const result = validateFinding(finding, {
      request,
      evidenceById,
      fileByPath,
      folderByPath,
      knownPaths,
      deterministicRelationships,
      policy,
    });
    if ('state' in result) rejected.push(result);
    else {
      accepted.push(result.finding);
      if (result.confidenceDowngraded) confidenceDowngrades += 1;
    }
  }

  accepted.sort((left, right) => left.id.localeCompare(right.id)
    || left.originalProviderFindingId.localeCompare(right.originalProviderFindingId));
  for (let index = accepted.length - 1; index > 0; index -= 1) {
    if (accepted[index].id !== accepted[index - 1].id) continue;
    const duplicate = accepted.splice(index, 1)[0];
    rejected.push(rejection(
      duplicate.originalProviderFindingId,
      duplicate.category,
      ['duplicate-normalized-finding'],
      'Equivalent normalized provider finding was already accepted.',
    ));
  }
  rejected.sort((left, right) => `${left.originalProviderFindingId || ''}:${left.reasonCodes.join(',')}`
    .localeCompare(`${right.originalProviderFindingId || ''}:${right.reasonCodes.join(',')}`));
  const providerWarnings = (response.warnings || [])
    .slice(0, policy.maximumWarnings)
    .filter(warning => warning.length <= policy.maximumTextLengthPerField && !unsafeText(warning))
    .sort();
  const summary = {
    receivedFindings: response.findings.length,
    acceptedFindings: accepted.filter(finding => finding.validationState === 'accepted').length,
    acceptedWithLimitations: accepted.filter(finding => finding.validationState === 'accepted-with-limitations').length,
    requiringHumanReview: accepted.filter(finding => finding.validationState === 'requires-human-review').length,
    rejectedFindings: rejected.filter(finding => finding.state === 'rejected').length,
    unavailableFindings: rejected.filter(finding => finding.state === 'unavailable').length,
    duplicateProviderFindingIds,
    confidenceDowngrades,
    validationMessages: sortedUnique([
      ...(response.findings.length > policy.maximumFindings ? ['Provider findings were bounded by the result policy.'] : []),
      ...((response.warnings?.length || 0) > policy.maximumWarnings ? ['Provider warnings were bounded by the result policy.'] : []),
    ]),
  };
  const metadata = {
    providerId: response.providerId,
    modelId: response.modelId,
    providerVersion: response.providerVersion,
    responseSchemaVersion: response.schemaVersion,
    requestFingerprint: request.fingerprint,
    promptContractVersion: request.promptContractVersion,
    validatorVersion: REPOSITORY_DEEP_INTELLIGENCE_VALIDATOR_VERSION,
    requestedCapabilities: [...request.requestedCapabilities],
    returnedCapabilities: sortedUnique(response.returnedCapabilities),
    usage: response.usage ? { ...response.usage } : undefined,
    truncated: response.truncated || response.findings.length > policy.maximumFindings,
    providerWarnings,
  };
  const limitations = sortedUnique([
    ...request.knownLimitations,
    ...(metadata.truncated ? ['Provider output or validation intake was truncated by a declared bound.'] : []),
    ...(rejected.length ? ['Rejected provider findings remain unavailable to artifact generation.'] : []),
  ]);
  const fingerprint = stableContextFingerprint({
    version: REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
    findings: accepted,
    rejectedFindings: rejected,
    summary,
    metadata,
    limitations,
  });
  return {
    success: true,
    normalizedResponse: response,
    result: {
      version: REPOSITORY_DEEP_INTELLIGENCE_RESULT_VERSION,
      findings: accepted,
      rejectedFindings: rejected,
      summary,
      metadata,
      limitations,
      fingerprint,
    },
  };
}

function validateFinding(
  finding: RepositoryDeepIntelligenceRawFinding,
  indexes: ValidationIndexes,
): { finding: RepositoryDeepIntelligenceValidatedFinding; confidenceDowngraded: boolean } | RepositoryDeepIntelligenceRejectedFinding {
  if (!finding.id.trim() || finding.id.length > 200) return rejection(undefined, finding.category, ['invalid-provider-id'], 'Provider finding ID is invalid.');
  const textFields = [finding.title, finding.statement.subject, finding.statement.predicate, finding.statement.value, ...finding.limitations];
  if (textFields.some(text => text.length > indexes.policy.maximumTextLengthPerField)) {
    return rejection(finding.id, finding.category, ['text-limit'], 'Finding text exceeded the bounded field limit.');
  }
  if (textFields.some(unsafeText)) return rejection(finding.id, finding.category, ['prohibited-output'], 'Finding contained prohibited or sensitive output.');
  if (finding.referencedPaths.length > indexes.policy.maximumPathsPerFinding
    || finding.referencedEvidenceIds.length > indexes.policy.maximumEvidenceReferencesPerFinding
    || (finding.relationshipClaims?.length || 0) > indexes.policy.maximumRelationshipsPerFinding
    || finding.artifactTargets.length > indexes.policy.maximumArtifactTargets) {
    return rejection(finding.id, finding.category, ['result-limit'], 'Finding exceeded a bounded result-policy limit.');
  }
  if (finding.inferenceType === 'unavailable' || finding.category === 'unsupported-or-unavailable-conclusion') {
    return { originalProviderFindingId: finding.id, category: finding.category, state: 'unavailable', reasonCodes: ['provider-unavailable'], validationMessages: ['Provider marked the conclusion unavailable.'] };
  }
  const paths = normalizeFindingPaths(finding.referencedPaths, indexes.knownPaths);
  if (!paths.success) return rejection(finding.id, finding.category, ['invalid-path'], paths.message);
  const evidenceIds = sortedUnique(finding.referencedEvidenceIds);
  if (!evidenceIds.length) return rejection(finding.id, finding.category, ['missing-evidence'], 'Repository-specific finding did not cite deterministic evidence.');
  if (evidenceIds.some(id => !indexes.evidenceById.has(id))) {
    return rejection(finding.id, finding.category, ['unknown-evidence'], 'Finding cited evidence that was not supplied in the bounded request.');
  }
  if (!paths.paths.length) return rejection(finding.id, finding.category, ['missing-path'], 'Repository-specific finding did not cite a known repository path.');

  const contradiction = detectContradiction(finding, paths.paths, indexes);
  if (contradiction) return rejection(finding.id, finding.category, [contradiction.code], contradiction.message);

  const responsibility = validateResponsibility(finding, paths.paths, indexes);
  if (!responsibility.valid) return rejection(finding.id, finding.category, ['responsibility-contradiction'], responsibility.message);
  const command = validateCommand(finding, evidenceIds, indexes);
  if (command === 'unsupported') return rejection(finding.id, finding.category, ['unsupported-command'], 'Command was not supported by deterministic command evidence.');
  const relationships = validateRelationships(finding, evidenceIds, indexes);
  if (!relationships.valid) return rejection(finding.id, finding.category, ['relationship-contradiction'], relationships.message);

  const evidence = evidenceIds.map(id => indexes.evidenceById.get(id)!);
  const confidence = normalizeConfidence(finding, evidence, paths.paths, indexes);
  const confidenceDowngraded = confidenceRank(confidence) < providerConfidenceRank(finding.providerConfidence);
  const humanReviewRequired = finding.requiresHumanReview === true
    || finding.proposedResponsibility === 'authentication-or-authorization-area'
    || textFields.some(text => HIGH_REVIEW_RE.test(text));
  const validationMessages = sortedUnique([
    ...responsibility.messages,
    ...relationships.messages,
    ...(confidenceDowngraded ? ['Provider confidence was capped by deterministic evidence quality.'] : []),
    ...(command === 'inferred' ? ['Command is inferred and must not be presented as known runnable behavior.'] : []),
    ...(humanReviewRequired ? ['High-impact subject requires human review.'] : []),
  ]);
  const limitations = sortedUnique([
    ...finding.limitations,
    ...evidence.flatMap(item => item.assertionState === 'limited' ? ['Supporting deterministic evidence is limited.'] : []),
    ...paths.paths.flatMap(path => indexes.request.contextItems.find(item => item.path === path)?.truncation.truncated
      ? ['Referenced source context was truncated.'] : []),
  ]);
  const validationState = humanReviewRequired
    ? 'requires-human-review' as const
    : finding.inferenceType === 'model-inference' || limitations.length || confidenceDowngraded || command === 'inferred'
      ? 'accepted-with-limitations' as const
      : 'accepted' as const;
  const referencedSymbols = sortedSymbols(finding.referencedSymbols || [], paths.paths, indexes);
  const removedFields = referencedSymbols.length === (finding.referencedSymbols?.length || 0) ? [] : ['referencedSymbols'];
  if (removedFields.length) validationMessages.push('Uncorroborated symbol references were removed.');
  validationMessages.sort();
  const stableId = stableContextFingerprint({
    category: finding.category,
    statement: normalizeStatement(finding.statement),
    paths: paths.paths,
    evidenceIds,
    proposedResponsibility: finding.proposedResponsibility,
    relationships: relationships.relationships,
  });
  return {
    confidenceDowngraded,
    finding: {
      originalProviderFindingId: finding.id,
      id: `deep-finding:${stableId}`,
      category: finding.category,
      title: finding.title.trim(),
      statement: normalizeStatement(finding.statement),
      validationState,
      acceptedConfidence: confidence,
      inferenceType: finding.inferenceType,
      acceptedPaths: paths.paths,
      supportingEvidenceIds: evidenceIds,
      referencedSymbols,
      proposedResponsibility: finding.proposedResponsibility,
      relationships: relationships.relationships,
      commandState: finding.statement.type === 'command' ? command : undefined,
      removedFields,
      validationMessages,
      limitations,
      humanReviewState: humanReviewRequired ? 'required' : 'not-required',
      eligibleForArtifactGeneration: true,
      permittedArtifactTargets: sortedUnique(finding.artifactTargets),
      artifactRelevance: sortedUnique(finding.artifactRelevance || []),
    },
  };
}

interface ValidationIndexes {
  request: RepositoryDeepIntelligenceRequest;
  evidenceById: Map<string, RepositoryDeepIntelligenceRequest['evidenceReferences'][number]>;
  fileByPath: Map<string, RepositoryDeepIntelligenceRequest['responsibilitySummary'][number]>;
  folderByPath: Map<string, RepositoryDeepIntelligenceRequest['folderResponsibilitySummary'][number]>;
  knownPaths: Set<string>;
  deterministicRelationships: Map<string, RepositoryDeepIntelligenceRequest['relationshipSummary'][number]>;
  policy: ReturnType<typeof resolveRepositoryDeepIntelligenceResultPolicy>;
}

function normalizeFindingPaths(paths: string[], knownPaths: Set<string>): { success: true; paths: string[] } | { success: false; message: string } {
  const normalized: string[] = [];
  try {
    for (const path of paths) {
      const value = normalizeEvidencePath(path);
      if (!knownPaths.has(value)) return { success: false, message: 'Finding referenced a nonexistent or unprovided repository path.' };
      normalized.push(value);
    }
  } catch {
    return { success: false, message: 'Finding referenced an unsafe repository path.' };
  }
  return { success: true, paths: sortedUnique(normalized) };
}

function detectContradiction(finding: RepositoryDeepIntelligenceRawFinding, paths: string[], indexes: ValidationIndexes) {
  const combined = `${finding.title} ${finding.statement.subject} ${finding.statement.predicate} ${finding.statement.value}`;
  if (EXECUTION_CLAIM_RE.test(combined)) return { code: 'code-execution-claim', message: 'Finding claimed repository code execution that ShipSeal did not perform.' };
  if (CERTIFICATION_RE.test(combined)) return { code: 'unsupported-certification', message: 'Finding claimed unsupported legal, compliance, or security certification.' };
  const generated = paths.some(path => indexes.fileByPath.get(path)?.primary === 'generated-or-vendor-content'
    || indexes.folderByPath.get(path)?.generatedOrVendor);
  if (generated && /\b(?:handwritten|analyzed source|business logic)\b/i.test(combined)) {
    return { code: 'generated-content-contradiction', message: 'Finding contradicted deterministic generated/vendor classification.' };
  }
  if (finding.statement.type === 'absence' && /\btests?\b/i.test(combined)
    && indexes.request.evidenceReferences.some(evidence => evidence.category === 'test')) {
    return { code: 'test-absence-contradiction', message: 'Finding claimed tests were absent despite deterministic test evidence.' };
  }
  const frameworkClaim = combined.match(/\b(React|Vite|Next\.js|Express)\b/i)?.[1];
  if (frameworkClaim && finding.inferenceType === 'verified') {
    const detected = indexes.request.frameworkEvidence.map(item => item.framework.toLowerCase());
    if (!detected.includes(frameworkClaim.toLowerCase())) return { code: 'framework-contradiction', message: 'Verified framework claim lacked authoritative framework evidence.' };
  }
  return undefined;
}

function validateResponsibility(finding: RepositoryDeepIntelligenceRawFinding, paths: string[], indexes: ValidationIndexes) {
  if (!finding.proposedResponsibility) return { valid: true, messages: [] as string[] };
  const path = paths[0];
  const file = indexes.fileByPath.get(path);
  const folder = indexes.folderByPath.get(path);
  if (file) {
    if (file.primary === 'generated-or-vendor-content') return { valid: false, message: 'Generated/vendor files cannot receive analyzed source responsibilities.', messages: [] };
    if (file.primary === finding.proposedResponsibility || file.secondary.includes(finding.proposedResponsibility)) {
      return { valid: true, messages: file.primary === finding.proposedResponsibility
        ? []
        : ['Responsibility refinement is compatible with a deterministic secondary responsibility.'] };
    }
    if (file.primary === 'unknown-or-insufficient-evidence') {
      return { valid: true, messages: ['Responsibility refinement remains model-inferred because deterministic responsibility was unknown.'] };
    }
    return { valid: false, message: 'Proposed responsibility contradicted the deterministic primary responsibility.', messages: [] };
  }
  if (folder) {
    if (folder.generatedOrVendor) return { valid: false, message: 'Generated/vendor folders cannot receive handwritten source responsibilities.', messages: [] };
    if (!folder.dominantResponsibilities.length || folder.dominantResponsibilities.some(item => item.responsibility === finding.proposedResponsibility)) {
      return { valid: true, messages: ['Folder responsibility refinement remains model-inferred.'] };
    }
    return { valid: false, message: 'Proposed folder responsibility contradicted deterministic child aggregation.', messages: [] };
  }
  return { valid: false, message: 'Responsibility refinement did not reference a responsibility record.', messages: [] };
}

function validateCommand(finding: RepositoryDeepIntelligenceRawFinding, evidenceIds: string[], indexes: ValidationIndexes) {
  if (finding.statement.type !== 'command') return undefined;
  const commandEvidence = evidenceIds.map(id => indexes.evidenceById.get(id)!).filter(evidence => evidence.category === 'command');
  if (!commandEvidence.length) return 'unsupported' as const;
  const value = finding.statement.value.trim();
  if (commandEvidence.some(evidence => evidence.extractedFact.includes(value))) return 'verified' as const;
  return finding.inferenceType === 'model-inference' ? 'inferred' as const : 'unsupported' as const;
}

function validateRelationships(finding: RepositoryDeepIntelligenceRawFinding, evidenceIds: string[], indexes: ValidationIndexes) {
  const validated: RepositoryDeepIntelligenceValidatedRelationship[] = [];
  const messages: string[] = [];
  for (const claim of finding.relationshipClaims || []) {
    const paths = normalizeFindingPaths([claim.sourcePath, claim.targetPath], indexes.knownPaths);
    if (!paths.success) return { valid: false, message: paths.message, messages, relationships: validated };
    const sourcePath = normalizeEvidencePath(claim.sourcePath);
    const targetPath = normalizeEvidencePath(claim.targetPath);
    const claimEvidence = sortedUnique(claim.evidenceIds);
    if (!claimEvidence.length || claimEvidence.some(id => !evidenceIds.includes(id) || !indexes.evidenceById.has(id))) {
      return { valid: false, message: 'Relationship claim lacked valid cited evidence.', messages, relationships: validated };
    }
    const deterministic = indexes.deterministicRelationships.get(relationshipKey(claim.type, sourcePath, targetPath));
    const inverse = indexes.deterministicRelationships.get(relationshipKey(claim.type, targetPath, sourcePath));
    if (!deterministic && inverse && ['imports', 'exports-through', 'tests', 'entry-point-loads'].includes(claim.type)) {
      return { valid: false, message: 'Relationship direction contradicted deterministic repository relationships.', messages, relationships: validated };
    }
    const directlySupported = !!deterministic && deterministic.supportingEvidenceIds.some(id => claimEvidence.includes(id));
    if (!directlySupported && !claimEvidence.some(id => indexes.evidenceById.get(id)?.category === 'relationship')) {
      return { valid: false, message: 'Relationship claim was not supported by relationship evidence.', messages, relationships: validated };
    }
    if (!directlySupported) messages.push('Relationship is a bounded model inference from static evidence.');
    validated.push({
      type: claim.type,
      sourcePath,
      targetPath,
      supportingEvidenceIds: claimEvidence,
      inferenceType: directlySupported ? 'verified' : 'model-inference',
    });
  }
  validated.sort((a, b) => relationshipKey(a.type, a.sourcePath, a.targetPath).localeCompare(relationshipKey(b.type, b.sourcePath, b.targetPath)));
  return { valid: true, messages: sortedUnique(messages), relationships: validated };
}

function normalizeConfidence(
  finding: RepositoryDeepIntelligenceRawFinding,
  evidence: RepositoryDeepIntelligenceRequest['evidenceReferences'],
  paths: string[],
  indexes: ValidationIndexes,
): RepositoryDeepIntelligenceConfidence {
  const minimumEvidenceConfidence = Math.min(...evidence.map(item => item.confidence));
  const strongValidation = evidence.every(item => ['validated', 'observed'].includes(item.validationState));
  const limited = evidence.some(item => item.assertionState === 'limited' || item.validationState === 'inferred')
    || paths.some(path => indexes.request.contextItems.find(item => item.path === path)?.truncation.truncated);
  if (finding.providerConfidence >= 0.85 && minimumEvidenceConfidence >= 0.85 && strongValidation && !limited
    && finding.inferenceType === 'verified') return 'high';
  if (finding.providerConfidence >= 0.5 && minimumEvidenceConfidence >= 0.5 && !limited) return 'medium';
  return 'low';
}

function sortedSymbols(symbols: Array<{ path: string; name: string }>, paths: string[], indexes: ValidationIndexes) {
  const accepted: Array<{ path: string; name: string }> = [];
  for (const symbol of symbols) {
    if (!paths.includes(symbol.path) || symbol.name.length > 200 || unsafeText(symbol.name)) continue;
    const outline = indexes.request.contextItems.find(item => item.path === symbol.path)?.structuralOutline;
    if (outline?.declaredSymbols.some(item => item.name === symbol.name)) accepted.push({ ...symbol });
  }
  return accepted.sort((a, b) => `${a.path}:${a.name}`.localeCompare(`${b.path}:${b.name}`));
}

function normalizeStatement(statement: RepositoryDeepIntelligenceRawFinding['statement']) {
  return { type: statement.type, subject: statement.subject.trim(), predicate: statement.predicate.trim(), value: statement.value.trim() };
}

function rejection(
  id: string | undefined,
  category: RepositoryDeepIntelligenceRawFinding['category'] | undefined,
  reasonCodes: string[],
  message: string,
): RepositoryDeepIntelligenceRejectedFinding {
  return { originalProviderFindingId: id, category, state: 'rejected', reasonCodes: sortedUnique(reasonCodes), validationMessages: [message] };
}

function invalid(code: string, message: string): RepositoryDeepIntelligenceValidationOutcome {
  return { success: false, error: { code, message } };
}

function unsafeText(value: string) {
  return SECRET_RE.test(value) || ABSOLUTE_PATH_RE.test(value) || PROMPT_LEAK_RE.test(value);
}

function safeSerializedSize(value: unknown) {
  try { return JSON.stringify(value).length; } catch { return undefined; }
}

function relationshipKey(type: string, sourcePath: string, targetPath: string) {
  return `${type}:${sourcePath}:${targetPath}`;
}

function confidenceRank(confidence: RepositoryDeepIntelligenceConfidence) {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}

function providerConfidenceRank(confidence: number) {
  return confidence >= 0.85 ? 3 : confidence >= 0.5 ? 2 : 1;
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function isResponsibilityCompatible(
  deterministic: RepositoryResponsibility,
  proposed: RepositoryResponsibility,
) {
  return deterministic === proposed || deterministic === 'unknown-or-insufficient-evidence';
}

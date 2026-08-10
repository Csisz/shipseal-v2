import { stableContextFingerprint } from '../../src/lib/repositoryIntelligence/contextSelection.js';
import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';

export const PRODUCTION_DEEP_INTELLIGENCE_CONTEXT_VERSION = 'shipseal.deep-intelligence-context.v1' as const;
export const PRODUCTION_DEEP_INTELLIGENCE_REDACTION_VERSION = 'shipseal.deep-intelligence-redaction.v1' as const;

export interface ProductionDeepIntelligenceContextPolicy {
  maximumInputTokens: number;
  maximumSelectedFiles: number;
  maximumExcerptBytesPerFile: number;
  maximumContextBytes: number;
  maximumRequestBytes: number;
}

export interface ProductionDeepIntelligenceBudgetSummary {
  maximumInputTokens: number;
  estimatedInputTokens: number;
  maximumOutputTokens: number;
  maximumSelectedFiles: number;
  selectedFiles: number;
  maximumExcerptBytesPerFile: number;
  maximumContextBytes: number;
  includedContextBytes: number;
  requestBytes: number;
  omittedFiles: number;
  truncatedFiles: number;
  duplicateContentsRemoved: number;
  costEstimate: 'unavailable';
}

export interface ProductionDeepIntelligenceRedactionSummary {
  version: typeof PRODUCTION_DEEP_INTELLIGENCE_REDACTION_VERSION;
  applied: boolean;
  redactedValueCount: number;
  excludedContentCount: number;
  kinds: string[];
  boundary: string;
}

export type ProductionDeepIntelligenceContextResult =
  | {
    state: 'ready';
    request: RepositoryDeepIntelligenceRequest;
    budget: ProductionDeepIntelligenceBudgetSummary;
    redaction: ProductionDeepIntelligenceRedactionSummary;
  }
  | {
    state: 'budget-exceeded' | 'redaction-failed';
    message: string;
    budget: ProductionDeepIntelligenceBudgetSummary;
    redaction: ProductionDeepIntelligenceRedactionSummary;
  };

interface RedactionResult {
  content: string;
  excluded: boolean;
  redactedValueCount: number;
  kinds: string[];
}

const PRIVATE_KEY_RE = /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?(?:-----END [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----|$)/gi;
const SUSPICIOUS_UNTERMINATED_PRIVATE_KEY_RE = /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/i;
const ASSIGNMENT_RE = /((?:^|[\s,{;])(?:export\s+)?(?:const\s+|let\s+|var\s+)?["']?([A-Za-z0-9_.-]*(?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|secret|password|passwd|private[_-]?key|client[_-]?secret|connection[_-]?string)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*)(["'`]?)([^\s,"'`;}]*)\3/gi;
const AUTHORIZATION_RE = /(authorization\s*[:=]\s*["']?(?:bearer|basic)\s+)[A-Za-z0-9._~+/-]+=*/gi;
const CONNECTION_RE = /\b(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqps?):\/\/([^\s/@:]+):([^\s/@]+)@/gi;
const GITHUB_TOKEN_RE = /\b(?:gh[opusr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;
const OPENAI_TOKEN_RE = /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g;
const AWS_ACCESS_RE = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const GOOGLE_API_RE = /\bAIza[A-Za-z0-9_-]{30,}\b/g;
const SLACK_TOKEN_RE = /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g;
const STRIPE_SECRET_RE = /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const WINDOWS_LOCAL_ABSOLUTE_PATH_RE = /\b[A-Za-z]:[\\/](?:Users|Documents|home)[\\/][^\s"'`<>{}(),;]*/gi;
const UNIX_LOCAL_ABSOLUTE_PATH_RE = /(?:file:\/\/\/[^\s"'`<>{}(),;]*|\/(?:Users|home)\/[^/\s"'`<>{}(),;]+(?:\/[^\s"'`<>{}(),;]*)?)/g;

export function prepareProductionDeepIntelligenceContext(input: {
  request: RepositoryDeepIntelligenceRequest;
  policy: ProductionDeepIntelligenceContextPolicy;
  maximumOutputTokens: number;
}): ProductionDeepIntelligenceContextResult {
  const kinds = new Set<string>();
  let redactedValueCount = 0;
  let excludedContentCount = 0;
  let duplicateContentsRemoved = 0;
  let truncatedFiles = 0;
  const seenContent = new Set<string>();
  const redactFreeText = (value: string, redactAllAssignments = false) => {
    const result = redactSensitiveContent(value, redactAllAssignments);
    result.kinds.forEach(kind => kinds.add(kind));
    redactedValueCount += result.redactedValueCount;
    if (result.excluded) excludedContentCount += 1;
    return result.excluded ? '[REDACTED:SENSITIVE_CONTENT]' : result.content;
  };
  const ordered = [...input.request.contextItems].sort((left, right) => (left.selectionOrder ?? Number.MAX_SAFE_INTEGER) - (right.selectionOrder ?? Number.MAX_SAFE_INTEGER)
    || left.path.localeCompare(right.path));
  const selected = ordered.slice(0, input.policy.maximumSelectedFiles);
  const productStrategist = input.request.executionProfile === 'product-strategist';
  const selectedPaths = new Set(selected.map(item => item.path));
  const relationshipSummary = productStrategist
    ? input.request.relationshipSummary.filter(item => selectedPaths.has(item.sourcePath) && selectedPaths.has(item.targetPath))
    : input.request.relationshipSummary;
  const evidencePathById = new Map(input.request.evidenceReferences.map(item => [item.id, item.path]));
  const frameworkEvidence = productStrategist
    ? input.request.frameworkEvidence.map(item => ({
      ...item,
      paths: item.paths.filter(path => selectedPaths.has(path)),
      evidenceIds: item.evidenceIds.filter(id => selectedPaths.has(evidencePathById.get(id) || '')),
    })).filter(item => item.paths.length > 0 && item.evidenceIds.length > 0)
    : input.request.frameworkEvidence;
  const selectedEvidenceIds = productStrategist ? new Set([
    ...selected.flatMap(item => item.supportingEvidenceIds),
    ...relationshipSummary.flatMap(item => item.supportingEvidenceIds),
    ...frameworkEvidence.flatMap(item => item.evidenceIds),
    ...input.request.evidenceReferences.filter(item => selectedPaths.has(item.path)).map(item => item.id),
  ]) : undefined;
  const contextItems: RepositoryDeepIntelligenceRequest['contextItems'] = [];
  let remainingContextBytes = input.policy.maximumContextBytes;

  for (const item of selected) {
    const original = item.content || '';
    const redaction = redactSensitiveContent(original, item.sourceCategory === 'environment-template');
    redaction.kinds.forEach(kind => kinds.add(kind));
    redactedValueCount += redaction.redactedValueCount;
    let content = redaction.excluded ? '' : redaction.content;
    const limitations = [...item.limitations];
    if (redaction.excluded) {
      excludedContentCount += 1;
      limitations.push('Content was excluded by server-side sensitive-data validation before provider transmission.');
    }
    if (content) {
      const contentFingerprint = stableContextFingerprint(content);
      if (seenContent.has(contentFingerprint)) {
        duplicateContentsRemoved += 1;
        content = '';
        limitations.push('Duplicate selected content was omitted from provider transmission.');
      } else {
        seenContent.add(contentFingerprint);
      }
    }
    const allowedBytes = Math.max(0, Math.min(input.policy.maximumExcerptBytesPerFile, remainingContextBytes));
    const clipped = clipUtf8(content, allowedBytes);
    if (clipped.truncated) {
      truncatedFiles += 1;
      limitations.push('Server transmission limits truncated this excerpt deterministically.');
    }
    content = clipped.value;
    const includedBytes = utf8Bytes(content);
    remainingContextBytes -= includedBytes;
    contextItems.push({
      ...item,
      content: content || undefined,
      includedCharacters: content.length,
      truncation: {
        ...item.truncation,
        truncated: item.truncation.truncated || clipped.truncated || redaction.excluded,
        omittedCharacters: item.truncation.omittedCharacters + Math.max(0, original.length - content.length),
        includedLineRanges: content ? [...item.truncation.includedLineRanges] : [],
      },
      structuralOutline: item.structuralOutline ? {
        ...item.structuralOutline,
        limitations: item.structuralOutline.limitations.map(value => redactFreeText(value)),
      } : undefined,
      limitations: sortedUnique(limitations.map(value => redactFreeText(value))),
      ...(redaction.excluded ? { contentAvailability: 'excluded-sensitive' as const } : {}),
    });
  }

  const evidenceReferences = input.request.evidenceReferences
    .filter(item => !selectedEvidenceIds || selectedEvidenceIds.has(item.id))
    .map(item => ({
    ...item,
    extractedFact: redactFreeText(item.extractedFact),
  }));
  const responsibilitySummary = input.request.responsibilitySummary
    .filter(item => !productStrategist || selectedPaths.has(item.path))
    .map(item => ({
    ...item,
    limitations: item.limitations.map(value => redactFreeText(value)),
  }));
  const selectedFolderPaths = productStrategist ? ancestorFolders(selectedPaths) : undefined;
  const folderResponsibilitySummary = input.request.folderResponsibilitySummary
    .filter(item => !selectedFolderPaths || selectedFolderPaths.has(item.path))
    .map(item => ({
    ...item,
    limitations: item.limitations.map(value => redactFreeText(value)),
  }));

  const knownLimitations = sortedUnique([
    ...input.request.knownLimitations.map(value => redactFreeText(value)),
    ...(ordered.length > selected.length ? [`${ordered.length - selected.length} selected context files were omitted by the server transmission file limit.`] : []),
    ...(redactedValueCount ? ['Sensitive-looking values were replaced with stable redaction markers before provider transmission.'] : []),
    ...(excludedContentCount ? ['Suspicious sensitive content was excluded rather than transmitted.'] : []),
    ...(duplicateContentsRemoved ? ['Duplicate selected content was transmitted once.'] : []),
    'Secret redaction is best-effort and is not a substitute for a dedicated secret scanner.',
  ]);
  const transmission = {
    contextVersion: PRODUCTION_DEEP_INTELLIGENCE_CONTEXT_VERSION,
    redactionVersion: PRODUCTION_DEEP_INTELLIGENCE_REDACTION_VERSION,
    preparedServerSide: true as const,
  };
  let prepared = fingerprintRequest({
    ...input.request,
    contextItems,
    evidenceReferences,
    responsibilitySummary,
    folderResponsibilitySummary,
    relationshipSummary,
    frameworkEvidence,
    knownLimitations,
    transmission,
  });
  let requestBytes = utf8Bytes(JSON.stringify(prepared));
  let estimatedInputTokens = estimateTokens(requestBytes);

  for (let index = prepared.contextItems.length - 1; estimatedInputTokens > input.policy.maximumInputTokens && index >= 0; index -= 1) {
    if (!prepared.contextItems[index].content) continue;
    const reduced = prepared.contextItems.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      content: undefined,
      includedCharacters: 0,
      truncation: { ...item.truncation, truncated: true, omittedCharacters: item.truncation.omittedCharacters + (item.content?.length || 0), includedLineRanges: [] },
      limitations: sortedUnique([...item.limitations, 'Content was omitted to satisfy the server input-token budget.']),
    } : item);
    prepared = fingerprintRequest({ ...prepared, contextItems: reduced });
    requestBytes = utf8Bytes(JSON.stringify(prepared));
    estimatedInputTokens = estimateTokens(requestBytes);
  }

  const includedContextBytes = prepared.contextItems.reduce((total, item) => total + utf8Bytes(item.content || ''), 0);
  const budget: ProductionDeepIntelligenceBudgetSummary = {
    maximumInputTokens: input.policy.maximumInputTokens,
    estimatedInputTokens,
    maximumOutputTokens: input.maximumOutputTokens,
    maximumSelectedFiles: input.policy.maximumSelectedFiles,
    selectedFiles: prepared.contextItems.length,
    maximumExcerptBytesPerFile: input.policy.maximumExcerptBytesPerFile,
    maximumContextBytes: input.policy.maximumContextBytes,
    includedContextBytes,
    requestBytes,
    omittedFiles: Math.max(0, ordered.length - prepared.contextItems.length),
    truncatedFiles: prepared.contextItems.filter(item => item.truncation.truncated).length,
    duplicateContentsRemoved,
    costEstimate: 'unavailable',
  };
  const redaction: ProductionDeepIntelligenceRedactionSummary = {
    version: PRODUCTION_DEEP_INTELLIGENCE_REDACTION_VERSION,
    applied: redactedValueCount > 0 || excludedContentCount > 0,
    redactedValueCount,
    excludedContentCount,
    kinds: [...kinds].sort(),
    boundary: 'Best-effort deterministic redaction; ShipSeal is not a secret scanner.',
  };
  if (estimatedInputTokens > input.policy.maximumInputTokens || requestBytes > input.policy.maximumRequestBytes) {
    return { state: 'budget-exceeded', message: 'Bounded repository metadata still exceeds the configured provider input budget.', budget, redaction };
  }
  if (containsSensitiveValue(JSON.stringify(prepared))) {
    return { state: 'redaction-failed', message: 'Provider context still contained suspicious sensitive material after redaction.', budget, redaction };
  }
  return { state: 'ready', request: prepared, budget, redaction };
}

export function redactSensitiveContent(value: string, redactAllAssignments = false): RedactionResult {
  if (!value) return { content: '', excluded: false, redactedValueCount: 0, kinds: [] };
  if (SUSPICIOUS_UNTERMINATED_PRIVATE_KEY_RE.test(value)) {
    return { content: '', excluded: true, redactedValueCount: 1, kinds: ['private-key-material'] };
  }
  const kinds = new Set<string>();
  let count = 0;
  const replace = (kind: string, marker: string) => {
    kinds.add(kind); count += 1; return marker;
  };
  let content = value.replace(PRIVATE_KEY_RE, () => replace('private-key-material', '[REDACTED:PRIVATE_KEY_MATERIAL]'));
  content = content.replace(AUTHORIZATION_RE, (_match, prefix: string) => `${prefix}${replace('authorization-header', '[REDACTED:AUTHORIZATION]')}`);
  content = content.replace(CONNECTION_RE, (_match, scheme: string) => `${scheme}://${replace('connection-string', '[REDACTED:CONNECTION_CREDENTIALS]')}@`);
  content = content.replace(GITHUB_TOKEN_RE, () => replace('github-token', '[REDACTED:GITHUB_TOKEN]'));
  content = content.replace(OPENAI_TOKEN_RE, () => replace('api-token', '[REDACTED:API_TOKEN]'));
  content = content.replace(AWS_ACCESS_RE, () => replace('cloud-credential', '[REDACTED:CLOUD_CREDENTIAL]'));
  content = content.replace(GOOGLE_API_RE, () => replace('cloud-credential', '[REDACTED:CLOUD_CREDENTIAL]'));
  content = content.replace(SLACK_TOKEN_RE, () => replace('service-token', '[REDACTED:SERVICE_TOKEN]'));
  content = content.replace(STRIPE_SECRET_RE, () => replace('service-token', '[REDACTED:SERVICE_TOKEN]'));
  content = content.replace(JWT_RE, () => replace('bearer-token', '[REDACTED:BEARER_TOKEN]'));
  content = content.replace(ASSIGNMENT_RE, (_match, prefix: string) => `${prefix}${replace('credential-assignment', '[REDACTED:CREDENTIAL_VALUE]')}`);
  content = content.replace(WINDOWS_LOCAL_ABSOLUTE_PATH_RE, () => replace('absolute-local-path', '[REDACTED:ABSOLUTE_PATH]'));
  content = content.replace(UNIX_LOCAL_ABSOLUTE_PATH_RE, () => replace('absolute-local-path', '[REDACTED:ABSOLUTE_PATH]'));
  if (redactAllAssignments) {
    content = content.split(/\r?\n/).map(line => line.replace(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=).*$/, (_match, prefix: string) => `${prefix}${replace('environment-value', '[REDACTED:ENVIRONMENT_VALUE]')}`)).join('\n');
  }
  return { content, excluded: false, redactedValueCount: count, kinds: [...kinds].sort() };
}

export function estimateDeepIntelligenceInputTokens(value: string | number) {
  return estimateTokens(typeof value === 'number' ? value : utf8Bytes(value));
}

function fingerprintRequest(value: Omit<RepositoryDeepIntelligenceRequest, 'fingerprint'> & { fingerprint?: string }): RepositoryDeepIntelligenceRequest {
  const { fingerprint: _oldFingerprint, ...withoutFingerprint } = value;
  return { ...withoutFingerprint, fingerprint: stableContextFingerprint(withoutFingerprint) } as RepositoryDeepIntelligenceRequest;
}
function containsSensitiveValue(value: string) {
  return [SUSPICIOUS_UNTERMINATED_PRIVATE_KEY_RE, GITHUB_TOKEN_RE, OPENAI_TOKEN_RE, AWS_ACCESS_RE, GOOGLE_API_RE, SLACK_TOKEN_RE, STRIPE_SECRET_RE, JWT_RE, AUTHORIZATION_RE, CONNECTION_RE]
    .some(pattern => {
      pattern.lastIndex = 0;
      const matched = pattern.test(value);
      pattern.lastIndex = 0;
      return matched;
    });
}
function estimateTokens(bytes: number) { return Math.ceil(bytes / 3); }
function utf8Bytes(value: string) { return Buffer.byteLength(value, 'utf8'); }
function clipUtf8(value: string, maximumBytes: number) {
  if (utf8Bytes(value) <= maximumBytes) return { value, truncated: false };
  if (maximumBytes <= 0) return { value: '', truncated: value.length > 0 };
  const bytes = new TextEncoder().encode(value).slice(0, maximumBytes);
  return { value: new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\uFFFD$/, ''), truncated: true };
}
function sortedUnique(values: string[]) { return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)); }
function ancestorFolders(paths: Set<string>) {
  const folders = new Set<string>(['.']);
  for (const path of paths) {
    const segments = path.split('/');
    segments.pop();
    for (let index = 1; index <= segments.length; index += 1) folders.add(segments.slice(0, index).join('/'));
  }
  return folders;
}

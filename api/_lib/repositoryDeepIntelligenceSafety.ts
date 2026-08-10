import type { RepositoryDeepIntelligenceRequest } from '../../src/lib/repositoryIntelligence/deepIntelligenceRequest.js';

export const REPOSITORY_DEEP_INTELLIGENCE_SECRET_SAFETY_VERSION = 'shipseal.deep-intelligence-secret-safety.v1' as const;

export type RepositorySecretSafetyCategory =
  | 'private-key-material'
  | 'credential-assignment'
  | 'authorization-header'
  | 'connection-credential'
  | 'api-token'
  | 'github-token'
  | 'service-token'
  | 'cloud-credential'
  | 'bearer-token';

export interface RepositorySecretSafetyRedactionResult {
  content: string;
  excluded: boolean;
  redactedValueCount: number;
  categories: RepositorySecretSafetyCategory[];
}

const PRIVATE_KEY_OR_CERTIFICATE_RE = /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/i;
const CREDENTIAL_ASSIGNMENT_RE = /((?:^|[\s,{;])(?:export\s+)?(?:const\s+|let\s+|var\s+)?["']?([A-Za-z0-9_.-]*(?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|secret|password|passwd|private[_-]?key|client[_-]?secret|connection[_-]?string)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*)(["'`]?)([^\s,"'`;}]*)\3/gi;
const AUTHORIZATION_RE = /(authorization\s*[:=]\s*["']?(?:bearer|basic)\s+)([A-Za-z0-9._~+/-]{8,}=*)/gi;
const CONNECTION_CREDENTIAL_RE = /\b(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqps?):\/\/([^\s/@:]+):([^\s/@]+)@/gi;
const GITHUB_TOKEN_RE = /\b(?:gh[opusr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,})\b/g;
const OPENAI_TOKEN_RE = /\bsk-[A-Za-z0-9_-]{12,}\b/g;
const STRIPE_SECRET_RE = /\bsk_(?:live|test)_[A-Za-z0-9_-]{8,}\b/g;
const GENERIC_SK_TOKEN_RE = /\bsk_[A-Za-z0-9_-]{12,}\b/g;
const AWS_ACCESS_RE = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const GOOGLE_API_RE = /\bAIza[A-Za-z0-9_-]{30,}\b/g;
const SLACK_TOKEN_RE = /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const STABLE_REDACTION_MARKER_RE = /^\[REDACTED:[A-Z0-9_]+\]$/;

export function redactRepositoryProviderFreeText(value: string): RepositorySecretSafetyRedactionResult {
  if (!value) return { content: '', excluded: false, redactedValueCount: 0, categories: [] };
  if (PRIVATE_KEY_OR_CERTIFICATE_RE.test(value)) {
    return {
      content: '',
      excluded: true,
      redactedValueCount: 1,
      categories: ['private-key-material'],
    };
  }

  const categories = new Set<RepositorySecretSafetyCategory>();
  let redactedValueCount = 0;
  const marker = (category: RepositorySecretSafetyCategory, label: string) => {
    categories.add(category);
    redactedValueCount += 1;
    return `[REDACTED:${label}]`;
  };

  let content = value.replace(AUTHORIZATION_RE, (_match, prefix: string) => `${prefix}${marker('authorization-header', 'AUTHORIZATION')}`);
  content = content.replace(CONNECTION_CREDENTIAL_RE, (_match, scheme: string) => `${scheme}://${marker('connection-credential', 'CONNECTION_CREDENTIALS')}`);
  content = content.replace(GITHUB_TOKEN_RE, () => marker('github-token', 'GITHUB_TOKEN'));
  content = content.replace(OPENAI_TOKEN_RE, () => marker('api-token', 'API_TOKEN'));
  content = content.replace(STRIPE_SECRET_RE, () => marker('service-token', 'SERVICE_TOKEN'));
  content = content.replace(GENERIC_SK_TOKEN_RE, () => marker('api-token', 'API_TOKEN'));
  content = content.replace(AWS_ACCESS_RE, () => marker('cloud-credential', 'CLOUD_CREDENTIAL'));
  content = content.replace(GOOGLE_API_RE, () => marker('cloud-credential', 'CLOUD_CREDENTIAL'));
  content = content.replace(SLACK_TOKEN_RE, () => marker('service-token', 'SERVICE_TOKEN'));
  content = content.replace(JWT_RE, () => marker('bearer-token', 'BEARER_TOKEN'));
  content = content.replace(CREDENTIAL_ASSIGNMENT_RE, (match, prefix: string, _name: string, quote: string, assignedValue: string) => {
    if (!assignedValue || STABLE_REDACTION_MARKER_RE.test(assignedValue)) return match;
    const replacement = marker('credential-assignment', 'CREDENTIAL_VALUE');
    return `${prefix}${quote}${replacement}${quote}`;
  });

  return {
    content,
    excluded: false,
    redactedValueCount,
    categories: [...categories].sort(),
  };
}

export function containsRepositoryProviderSecret(value: string) {
  const result = redactRepositoryProviderFreeText(value);
  return result.excluded || result.redactedValueCount > 0;
}

export function providerBoundRepositoryFreeText(request: RepositoryDeepIntelligenceRequest) {
  return [
    ...request.contextItems.flatMap(item => [
      item.content,
      ...item.limitations,
      ...(item.structuralOutline?.limitations || []),
    ]),
    ...request.evidenceReferences.map(item => item.extractedFact),
    ...request.responsibilitySummary.flatMap(item => item.limitations),
    ...request.folderResponsibilitySummary.flatMap(item => item.limitations),
    ...request.knownLimitations,
  ].filter((value): value is string => typeof value === 'string');
}

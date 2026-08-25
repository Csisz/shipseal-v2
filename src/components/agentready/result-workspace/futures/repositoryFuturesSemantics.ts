import type { RepositoryFutureStageCandidate } from './futurePathwaysPresentation';

export type RepositoryFutureSemanticDomain =
  | 'experience'
  | 'ai-agent'
  | 'automation'
  | 'security'
  | 'data'
  | 'growth'
  | 'knowledge'
  | 'delivery'
  | 'collaboration'
  | 'quality'
  | 'architecture'
  | 'general';

export type RepositoryFutureSemanticEntity =
  | 'repository'
  | 'future'
  | 'evolution'
  | 'capability'
  | 'dependency'
  | 'artifact';

export type RepositoryFutureSemanticIcon = RepositoryFutureSemanticDomain | 'repository' | 'dependency' | 'artifact';

export interface RepositoryFutureSemanticStyle {
  domain: RepositoryFutureSemanticDomain;
  entity: RepositoryFutureSemanticEntity;
  icon: RepositoryFutureSemanticIcon;
  shortLabel: string;
}

export type RepositoryFuturesSemanticZoomLevel = 'strategy' | 'path' | 'detail' | 'implementation';
export type RepositoryFuturesSemanticLabelDetail = 'near' | 'title' | 'compact' | 'anchor';

interface SemanticInput {
  kind: 'repository' | 'goal' | 'evolution' | 'capability' | 'artifact' | 'dependency';
  title: string;
  candidate?: Pick<RepositoryFutureStageCandidate,
    'title' | 'capabilityId' | 'capabilityTitle' | 'candidateClass' | 'opportunityOrigin' | 'origin'>;
}

const DOMAIN_LABELS: Record<RepositoryFutureSemanticDomain, string> = {
  experience: 'Experience / UX',
  'ai-agent': 'AI / Agent',
  automation: 'Automation / Workflow',
  security: 'Security / Trust',
  data: 'Data / Analytics',
  growth: 'Growth / Engagement',
  knowledge: 'Knowledge / Documentation',
  delivery: 'Delivery / Operations',
  collaboration: 'Collaboration',
  quality: 'Quality / Verification',
  architecture: 'Platform / Architecture',
  general: 'General opportunity',
};

/**
 * Presentation-only semantic identity. The resolver uses trusted titles and
 * capability metadata already present in the Future overlay. Plan role,
 * generation, compatibility, and selection never participate in the domain.
 */
export function repositoryFutureSemanticStyle(input: SemanticInput): RepositoryFutureSemanticStyle {
  if (input.kind === 'repository') {
    return { domain: 'architecture', entity: 'repository', icon: 'repository', shortLabel: 'Current repository' };
  }

  const domain = repositoryFutureSemanticDomain([
    input.title,
    input.candidate?.title,
    input.candidate?.capabilityTitle,
    input.candidate?.capabilityId,
  ].filter(Boolean).join(' '));
  const entity: RepositoryFutureSemanticEntity = input.kind === 'goal' ? 'future' : input.kind;
  const icon: RepositoryFutureSemanticIcon = input.kind === 'dependency'
    ? 'dependency'
    : input.kind === 'artifact'
      ? 'artifact'
      : domain;
  const shortLabel = input.kind === 'dependency'
    ? 'Prerequisite / gate'
    : input.kind === 'artifact'
      ? 'Implementation output'
      : input.kind === 'capability'
        ? `${DOMAIN_LABELS[domain]} capability`
        : DOMAIN_LABELS[domain];
  return { domain, entity, icon, shortLabel };
}

export function repositoryFutureSemanticDomain(value: string): RepositoryFutureSemanticDomain {
  const signal = value.toLowerCase();
  if (/\b(ai|agent|agents|assistant|copilot|llm|prompt|rag|intelligence)\b/.test(signal)) return 'ai-agent';
  if (/\b(security|secure|privacy|trust|auth|authentication|authorization|compliance|governance|risk|policy)\b/.test(signal)) return 'security';
  if (/\b(analytics|analysis|metric|metrics|data|database|insight|reporting|telemetry|tracking)\b/.test(signal)) return 'data';
  if (/\b(experience|ux|ui|interface|visual|preview|navigation|onboarding|accessibility|mobile)\b/.test(signal)) return 'experience';
  if (/\b(automation|automate|workflow|pipeline|orchestration|routing|scheduler|scheduled|trigger)\b/.test(signal)) return 'automation';
  if (/\b(growth|engagement|retention|activation|conversion|adoption|audience|marketing)\b/.test(signal)) return 'growth';
  if (/\b(knowledge|documentation|docs|readme|memory|guide|learning|search|discovery)\b/.test(signal)) return 'knowledge';
  if (/\b(delivery|deploy|deployment|release|operations|ops|rollback|handoff|distribution|package)\b/.test(signal)) return 'delivery';
  if (/\b(collaboration|collaborative|team|teams|shared|sharing|community|partner|multiplayer)\b/.test(signal)) return 'collaboration';
  if (/\b(quality|verification|verify|test|testing|evaluation|eval|reliability|validation)\b/.test(signal)) return 'quality';
  if (/\b(platform|architecture|infrastructure|framework|system|modular|scalable|service|api)\b/.test(signal)) return 'architecture';
  return 'general';
}

export function repositoryFuturesSemanticLabelDetail(input: {
  kind: SemanticInput['kind'];
  depth: 0 | 1 | 2 | 3;
  zoom: RepositoryFuturesSemanticZoomLevel;
  mode: 'quick' | 'deep';
  selected?: boolean;
  hovered?: boolean;
  searched?: boolean;
  traced?: boolean;
  focused?: boolean;
}): RepositoryFuturesSemanticLabelDetail {
  if (input.kind === 'repository') return 'near';
  const directlyFocused = Boolean(input.hovered || input.searched || input.focused);
  const forced = Boolean(input.selected || input.traced || directlyFocused);
  if (input.depth === 1) return input.zoom === 'implementation' || input.zoom === 'detail' ? 'near' : 'title';
  if (directlyFocused) return input.zoom === 'implementation' ? 'near' : 'title';
  if (forced) {
    if (input.zoom === 'implementation') return 'near';
    if (input.zoom === 'detail' || input.zoom === 'path') return 'title';
    return 'compact';
  }
  if (input.zoom === 'implementation') return input.mode === 'deep' ? 'near' : input.depth === 3 ? 'title' : 'near';
  if (input.zoom === 'detail') return input.mode === 'deep' ? input.depth === 3 ? 'title' : 'near' : input.depth === 3 ? 'compact' : 'title';
  if (input.zoom === 'path') return input.mode === 'deep' ? input.depth === 3 ? 'compact' : 'title' : input.depth === 3 ? 'anchor' : 'compact';
  if (input.mode === 'deep') return 'compact';
  return input.depth === 3 ? 'anchor' : 'compact';
}

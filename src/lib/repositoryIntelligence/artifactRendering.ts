import type {
  RepositoryIntelligenceArtifactManifest,
  RepositoryIntelligenceArtifactOperation,
  RepositoryIntelligenceArtifactStatement,
  RepositoryIntelligencePlannedArtifact,
} from './artifactSchema';

const TITLES: Record<RepositoryIntelligencePlannedArtifact['category'], string> = {
  'root-agent-instructions': 'AGENTS.md',
  'folder-agent-instructions': 'Local AGENTS.md Guidance',
  'architecture-memory': 'Repository Architecture',
  'critical-files-memory': 'Critical Files',
  'command-map': 'Command Map',
  'known-risks-memory': 'Known Risks',
  'task-router': 'Task Router',
  'context-guidance': 'Context Guidance',
  'evidence-manifest': 'Repository Intelligence Evidence Manifest',
};

export function renderRepositoryIntelligenceArtifact(artifact: RepositoryIntelligencePlannedArtifact): string {
  if (artifact.category === 'evidence-manifest' || artifact.operation === 'skip' || artifact.operation === 'unavailable') return '';
  const lines = [`# ${TITLES[artifact.category]}`, '', '<!-- shipseal:repository-intelligence:managed -->', ''];
  if (artifact.operation === 'strengthen') {
    lines.push('## Proposed evidence-backed additions', '', 'Existing handwritten content remains authoritative; review and merge only the additions below.', '');
  }
  const sections = groupBySection(artifact.statements);
  for (const [section, statements] of sections) {
    lines.push(`## ${section}`, '');
    for (const statement of statements) lines.push(renderStatement(statement));
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

export function serializeRepositoryIntelligenceArtifactManifest(manifest: RepositoryIntelligenceArtifactManifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function groupBySection(statements: RepositoryIntelligenceArtifactStatement[]) {
  const groups = new Map<string, RepositoryIntelligenceArtifactStatement[]>();
  for (const statement of [...statements].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    groups.set(statement.section, [...(groups.get(statement.section) || []), statement]);
  }
  return [...groups.entries()];
}

function renderStatement(statement: RepositoryIntelligenceArtifactStatement) {
  let text = statement.content.text;
  for (const path of [...statement.referencedPaths].sort((a, b) => b.length - a.length)) {
    text = text.split(path).join(`\`${path}\``);
  }
  const qualifiers = [
    statement.validationState === 'inferred' ? 'inferred' : '',
    statement.validationState === 'limited' ? 'limited evidence' : '',
    statement.humanReviewRequired ? 'human review required' : '',
  ].filter(Boolean);
  return `- ${text}${qualifiers.length ? ` _(${qualifiers.join('; ')})_` : ''}`;
}

export function operationProducesContent(operation: RepositoryIntelligenceArtifactOperation) {
  return operation === 'create' || operation === 'update' || operation === 'strengthen';
}

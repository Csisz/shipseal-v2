import type { RepoScanInput } from './types';

export interface RepositoryContextEvidence {
  readmePath?: string;
  hasReadme: boolean;
  hasProjectPurpose: boolean;
  hasSetupGuidance: boolean;
  documentedCommands: Array<{ label: 'Test'; cmd: string }>;
  hasContextAnchor: boolean;
}

export interface PythonDependencyEvidence {
  packageNames: string[];
  usesPip: boolean;
  usesPipenv: boolean;
  usesPoetry: boolean;
}

export interface RepositoryEvidenceFacts {
  context: RepositoryContextEvidence;
  python: PythonDependencyEvidence;
}

export function deriveRepositoryEvidenceFacts(input: RepoScanInput): RepositoryEvidenceFacts {
  return {
    context: deriveRepositoryContextEvidence(input),
    python: derivePythonDependencyEvidence(input),
  };
}

export function deriveRepositoryContextEvidence(input: RepoScanInput): RepositoryContextEvidence {
  const readmeEntry = textEntries(input).find(([path]) => /(^|\/)readme(?:\.[^/]+)?$/i.test(path));
  const readmePath = readmeEntry?.[0];
  const readme = readmeEntry?.[1] || '';
  const documentedCommands = detectDocumentedTestCommands(readme);
  const hasProjectPurpose = hasMeaningfulReadmeIntroduction(readme)
    || /(^|\n)#{1,4}\s*(overview|purpose|about|features|what is|description)\b/i.test(readme);
  const hasSetupGuidance = /(^|\n)#{1,4}\s*(install|setup|getting started|quickstart|usage|run|development|gyors ind[ií]t[aá]s)\b/i.test(readme)
    || /(?:^|\n)\s*(?:pip(?:3)?\s+install|python(?:3)?\s+[^\n]*|npm\s+(?:install|run)|pnpm\s+(?:install|run)|yarn\s+(?:install|run)|bun\s+(?:install|run))\b/im.test(readme);
  const hasReadme = Boolean(readme.trim());

  return {
    readmePath,
    hasReadme,
    hasProjectPurpose,
    hasSetupGuidance,
    documentedCommands,
    hasContextAnchor: hasReadme && (hasProjectPurpose || hasSetupGuidance || documentedCommands.length > 0),
  };
}

export function derivePythonDependencyEvidence(input: RepoScanInput): PythonDependencyEvidence {
  const packages = new Set<string>();
  let usesPip = false;
  let usesPipenv = false;
  let usesPoetry = false;

  for (const [path, content] of textEntries(input)) {
    const base = path.split('/').pop()?.toLowerCase();
    if (base === 'requirements.txt' || /^requirements[-_.].*\.txt$/i.test(base || '')) {
      usesPip = true;
      for (const line of content.split(/\r?\n/)) {
        const name = normalizePythonRequirement(line);
        if (name) packages.add(name);
      }
    } else if (base === 'pipfile') {
      usesPipenv = true;
      for (const name of parsePipfilePackages(content)) packages.add(name);
    } else if (base === 'pyproject.toml') {
      const pyproject = parsePyprojectPackages(content);
      for (const name of pyproject.packages) packages.add(name);
      usesPoetry ||= pyproject.usesPoetry;
      usesPip ||= pyproject.usesPep621;
    }
  }

  const readme = deriveRepositoryContextEvidence(input);
  const readmeText = readme.readmePath ? input.textContents[readme.readmePath] || '' : '';
  usesPip ||= /(?:^|\n)\s*(?:python(?:3)?\s+-m\s+)?pip(?:3)?\s+install\b/im.test(readmeText);

  return { packageNames: [...packages].sort(), usesPip, usesPipenv, usesPoetry };
}

function textEntries(input: RepoScanInput): Array<[string, string]> {
  return Object.entries(input.textContents).map(([path, content]) => [normalizePath(path), content]);
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasMeaningfulReadmeIntroduction(readme: string) {
  if (!readme.trim()) return false;
  const withoutCode = readme.replace(/```[\s\S]*?```/g, '');
  const lines = withoutCode.split(/\r?\n/);
  const firstHeading = lines.findIndex(line => /^#\s+\S/.test(line.trim()));
  const body = lines.slice(firstHeading >= 0 ? firstHeading + 1 : 0);
  const intro: string[] = [];
  for (const rawLine of body) {
    const line = rawLine.trim();
    if (/^#{1,6}\s+/.test(line)) break;
    if (!line || /^[-*_]{3,}$/.test(line) || /^!\[/.test(line) || /^\[!\[/.test(line)) continue;
    if (/^(?:<[^>]+>|\[[^\]]+\]\([^)]+\))$/.test(line)) continue;
    intro.push(line);
  }
  return intro.join(' ').replace(/\s+/g, ' ').length >= 40;
}

function detectDocumentedTestCommands(readme: string): Array<{ label: 'Test'; cmd: string }> {
  const commands: Array<{ label: 'Test'; cmd: string }> = [];
  const seen = new Set<string>();
  for (const rawLine of readme.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[$>]\s*/, '').replace(/^`|`$/g, '').trim();
    if (!line || /[;&|]|\$\(|`/.test(line)) continue;
    if (!/^(?:(?:python|python3|py)\s+-m\s+pytest|pytest)(?:\s+[\w./:=,-]+)*$/i.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    commands.push({ label: 'Test', cmd: line });
  }
  return commands;
}

function normalizePythonRequirement(rawLine: string) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#') || line.startsWith('-')) return null;
  const withoutMarker = line.split(';', 1)[0].trim();
  const egg = withoutMarker.match(/[#&]egg=([A-Za-z0-9_.-]+)/i)?.[1];
  const name = egg || withoutMarker.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?(?:\s*(?:===|==|~=|!=|<=|>=|<|>).*)?$/)?.[1];
  return name ? name.toLowerCase().replace(/[_.]+/g, '-') : null;
}

function parsePipfilePackages(content: string) {
  const packages = new Set<string>();
  let inPackages = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) {
      inPackages = /^(packages|dev-packages)$/i.test(heading[1]);
      continue;
    }
    if (!inPackages || !line || line.startsWith('#')) continue;
    const name = line.match(/^([A-Za-z0-9_.-]+)\s*=/)?.[1];
    if (name) packages.add(name.toLowerCase().replace(/[_.]+/g, '-'));
  }
  return [...packages];
}

function parsePyprojectPackages(content: string) {
  const packages = new Set<string>();
  const usesPoetry = /^\s*\[tool\.poetry(?:\.|\])/m.test(content);
  const usesPep621 = /^\s*\[project\]\s*$/m.test(content);
  let section = '';
  let inDependencyArray = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) {
      section = heading[1].toLowerCase();
      inDependencyArray = false;
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    if (section === 'tool.poetry.dependencies' || section === 'tool.poetry.group.dev.dependencies') {
      const name = line.match(/^([A-Za-z0-9_.-]+)\s*=/)?.[1];
      if (name && name.toLowerCase() !== 'python') packages.add(name.toLowerCase().replace(/[_.]+/g, '-'));
    }
    if (section === 'project' && /^dependencies\s*=\s*\[/.test(line)) inDependencyArray = true;
    if (section === 'project' && inDependencyArray) {
      for (const match of line.matchAll(/["']([^"']+)["']/g)) {
        const name = normalizePythonRequirement(match[1]);
        if (name) packages.add(name);
      }
      if (line.includes(']')) inDependencyArray = false;
    }
  }
  return { packages: [...packages], usesPoetry, usesPep621 };
}

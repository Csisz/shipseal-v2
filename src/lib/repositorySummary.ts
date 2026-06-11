import type { DetectedStack, RepoScanInput, RepositorySummary } from './types';

const KEY_FOLDERS = ['src', 'app', 'pages', 'components', 'lib', 'api', 'server', 'backend', 'docs', 'tests'];
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', 'README.md', 'CONTRIBUTING.md'];

export function buildRepositorySummary(input: RepoScanInput, stack: DetectedStack): RepositorySummary {
  const paths = new Set(input.files.map(file => file.path.replace(/\\/g, '/')));
  const hasPath = (path: string) => paths.has(path);
  const hasFolder = (folder: string) => input.files.some(file => {
    const path = file.path.replace(/\\/g, '/');
    return path === folder || path.startsWith(`${folder}/`);
  });

  const instructionFiles = INSTRUCTION_FILES.filter(hasPath);
  if (hasFolder('.cursor/rules')) {
    instructionFiles.push('.cursor/rules');
  }

  return {
    repositoryName: input.repoName,
    detectedStack: stack.primary,
    packageManager: stack.packageManagers[0] || 'not detected',
    scripts: stack.scripts,
    keyFolders: KEY_FOLDERS.filter(hasFolder),
    instructionFiles,
  };
}

import type {
  CriticalBlocker,
  DetectedStack,
  Improvement,
  MCPReadinessReport,
  RepoContextPackSummary,
  RepoScanInput,
  RepositorySummary,
  ScanSummary,
} from './types';
import { isSecretFilePath } from './scoring';

interface RepoContextPackMeta {
  summary: RepositorySummary;
  scanSummary: ScanSummary;
  blockers: CriticalBlocker[];
  improvements: Improvement[];
  mcpReadiness: MCPReadinessReport;
}

export function buildRepoContextPack(input: RepoScanInput, stack: DetectedStack, meta: RepoContextPackMeta): RepoContextPackSummary {
  const securityFindings = meta.blockers
    .filter(blocker => blocker.id === 'secrets')
    .map(blocker => blocker.detail);
  const secretPathFindings = input.files
    .filter(file => !file.isDir && isSecretFilePath(file.path))
    .slice(0, 10)
    .map(file => `Secret-like path detected: ${file.path}`);

  return {
    repositoryName: input.repoName,
    detectedStack: stack.primary,
    languages: [...stack.languages],
    frameworks: [...stack.frameworks],
    packageManager: meta.summary.packageManager,
    scripts: { ...stack.scripts },
    runCommands: [...stack.runCommands],
    keyFolders: [...meta.summary.keyFolders],
    existingInstructionFiles: [...meta.summary.instructionFiles],
    scanSummary: {
      totalFilesFound: meta.scanSummary.totalFilesFound,
      filesAnalyzed: meta.scanSummary.filesAnalyzed,
      filesIgnored: meta.scanSummary.filesIgnored,
      readableTextBytesAnalyzed: meta.scanSummary.readableTextBytesAnalyzed,
      warnings: [...meta.scanSummary.warnings],
    },
    blockers: meta.blockers.map(blocker => ({
      id: blocker.id,
      title: blocker.title,
      detail: blocker.detail,
    })),
    improvements: meta.improvements.slice(0, 12).map(improvement => ({
      id: improvement.id,
      title: improvement.title,
      category: improvement.category,
    })),
    ignoredFolders: [...meta.scanSummary.ignoredGeneratedFolders],
    securityFindings: [...securityFindings, ...secretPathFindings],
    mcpSummary: {
      score: meta.mcpReadiness.score,
      status: meta.mcpReadiness.status,
      summary: meta.mcpReadiness.summary,
      riskFindingCount: meta.mcpReadiness.riskFindings.length,
      recommendedServerCategories: meta.mcpReadiness.recommendedServerCategories.map(rec => rec.category),
    },
    contentPolicy: {
      rawFileContentsIncluded: false,
      secretsIncluded: false,
      uploadedCodeExecuted: false,
    },
  };
}

function mdList(values: string[], fallback: string) {
  return values.length ? values.map(value => `- ${value}`).join('\n') : `- ${fallback}`;
}

function mdScriptList(scripts: Record<string, string>) {
  const entries = Object.entries(scripts);
  return entries.length ? entries.map(([name, command]) => `- \`${name}\`: \`${command}\``).join('\n') : '- No scripts detected.';
}

export function renderRepoContextPackMarkdown(pack: RepoContextPackSummary): string {
  return `# REPO_CONTEXT_PACK.md - ${pack.repositoryName}

This is a sanitized Repo Context Pack for ShipSeal. It is designed for future server-side AI providers or coding agents and intentionally excludes raw full file contents and secrets.

## Repository
- Name: ${pack.repositoryName}
- Detected stack: ${pack.detectedStack}
- Languages: ${pack.languages.join(', ') || 'unknown'}
- Frameworks: ${pack.frameworks.join(', ') || 'none detected'}
- Package manager: ${pack.packageManager}

## Scripts
${mdScriptList(pack.scripts)}

## Suggested commands
${pack.runCommands.length ? pack.runCommands.map(command => `- **${command.label}:** \`${command.cmd}\``).join('\n') : '- No safe commands detected.'}

## Key folders
${mdList(pack.keyFolders.map(folder => `${folder}/`), 'No standard key folders detected.')}

## Existing instruction files
${mdList(pack.existingInstructionFiles, 'No existing instruction files detected.')}

## Scan summary
- Total files found: ${pack.scanSummary.totalFilesFound}
- Files analyzed: ${pack.scanSummary.filesAnalyzed}
- Files ignored: ${pack.scanSummary.filesIgnored}
- Readable text bytes analyzed: ${pack.scanSummary.readableTextBytesAnalyzed}
- Warnings: ${pack.scanSummary.warnings.length ? pack.scanSummary.warnings.join('; ') : 'none'}

## Critical blockers
${pack.blockers.length ? pack.blockers.map(blocker => `- **${blocker.title}:** ${blocker.detail}`).join('\n') : '- None'}

## Improvement signals
${pack.improvements.length ? pack.improvements.map(improvement => `- ${improvement.title} (${improvement.category})`).join('\n') : '- None'}

## Ignored folders
${mdList(pack.ignoredFolders, 'No generated/vendor folders ignored.')}

## Security findings
${mdList(pack.securityFindings, 'No secret-path findings in metadata.')}

## MCP summary
- MCP score: ${pack.mcpSummary.score}/100
- MCP status: ${pack.mcpSummary.status}
- MCP risk findings: ${pack.mcpSummary.riskFindingCount}
- Recommended categories: ${pack.mcpSummary.recommendedServerCategories.join(', ') || 'none'}
- Summary: ${pack.mcpSummary.summary}

## Content policy
- Raw full file contents included: ${pack.contentPolicy.rawFileContentsIncluded ? 'yes' : 'no'}
- Secrets included: ${pack.contentPolicy.secretsIncluded ? 'yes' : 'no'}
- Uploaded code executed: ${pack.contentPolicy.uploadedCodeExecuted ? 'yes' : 'no'}
`;
}

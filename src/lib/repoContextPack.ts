import type {
  CriticalBlocker,
  DetectedStack,
  Improvement,
  MCPReadinessReport,
  RepoContextPackSummary,
  RepoScanInput,
  ReadinessReport,
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
  repositoryHealth: ReadinessReport['repositoryHealth'];
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
    sampleFiles: input.files
      .filter(file => !file.isDir && !file.ignored)
      .slice(0, 40)
      .map(file => file.path),
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
    repositoryHealth: {
      modelVersion: meta.repositoryHealth.modelVersion,
      measurementMethod: meta.repositoryHealth.measurementMethod,
      score: meta.repositoryHealth.overall.score,
      status: meta.repositoryHealth.overall.status,
      confidence: meta.repositoryHealth.overall.confidence,
      contextWasteRiskScore: meta.repositoryHealth.dimensions.contextWaste.riskScore,
      contextEfficiencyScore: meta.repositoryHealth.dimensions.contextWaste.contextEfficiencyScore,
      dimensions: {
        repositoryIntelligence: meta.repositoryHealth.dimensions.repositoryIntelligence.score,
        contextWasteRisk: meta.repositoryHealth.dimensions.contextWaste.riskScore,
        aiDevelopmentReadiness: meta.repositoryHealth.dimensions.aiDevelopmentReadiness.score,
        agentRouting: meta.repositoryHealth.dimensions.agentRouting.score,
        deliveryConfidence: meta.repositoryHealth.dimensions.deliveryConfidence.score,
      },
      topActionIds: meta.repositoryHealth.topActions.slice(0, 5).map(action => action.id),
      blockerCount: meta.repositoryHealth.blockers.length,
      topActions: meta.repositoryHealth.topActions.slice(0, 5).map(action => action.title),
      measurementBoundary: [...meta.repositoryHealth.measurementBoundary],
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

## Sampled files
${mdList(pack.sampleFiles, 'No sampled files available.')}

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

## Repository Health summary
- Repository Health score: ${pack.repositoryHealth.score === null ? 'Not available' : `${pack.repositoryHealth.score}/100`}
- Repository Health status: ${pack.repositoryHealth.status}
- Confidence: ${pack.repositoryHealth.confidence}
- Context Waste Risk: ${pack.repositoryHealth.contextWasteRiskScore === null ? 'Not available' : `${pack.repositoryHealth.contextWasteRiskScore}/100`}
- Context efficiency score: ${pack.repositoryHealth.contextEfficiencyScore === null ? 'Not available' : `${pack.repositoryHealth.contextEfficiencyScore}/100`}
- Health blockers: ${pack.repositoryHealth.blockerCount}
- Model: ${pack.repositoryHealth.modelVersion} (${pack.repositoryHealth.measurementMethod})
- Dimension scores: repository intelligence ${scoreText(pack.repositoryHealth.dimensions.repositoryIntelligence)}, context waste risk ${scoreText(pack.repositoryHealth.dimensions.contextWasteRisk)}, AI development readiness ${scoreText(pack.repositoryHealth.dimensions.aiDevelopmentReadiness)}, agent routing ${scoreText(pack.repositoryHealth.dimensions.agentRouting)}, delivery confidence ${scoreText(pack.repositoryHealth.dimensions.deliveryConfidence)}
- Top action IDs: ${pack.repositoryHealth.topActionIds.join(', ') || 'none'}

## Repository Health top actions
${mdList(pack.repositoryHealth.topActions, 'No Repository Health actions available.')}

## Repository Health measurement boundary
${mdList(pack.repositoryHealth.measurementBoundary, 'No Repository Health boundary notes available.')}

## Specialized context files
- General coding work: 07-context/GLOBAL_CONTEXT.md
- QA/test-generation work: 07-context/QA_CONTEXT.md
- Security/data review: 07-context/SECURITY_CONTEXT.md
- Documentation/handoff work: 07-context/DOCS_CONTEXT.md
- MCP/tooling work: 07-context/MCP_CONTEXT.md

## Content policy
- Raw full file contents included: ${pack.contentPolicy.rawFileContentsIncluded ? 'yes' : 'no'}
- Secrets included: ${pack.contentPolicy.secretsIncluded ? 'yes' : 'no'}
- Uploaded code executed: ${pack.contentPolicy.uploadedCodeExecuted ? 'yes' : 'no'}
`;
}

function scoreText(score: number | null) {
  return score === null ? 'not available' : `${score}/100`;
}

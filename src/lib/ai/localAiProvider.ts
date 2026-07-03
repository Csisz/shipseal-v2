import type {
  AgentInstructionsInput,
  AIProvider,
  McpGovernanceNarrativeInput,
  ReadinessNarrativeInput,
} from './types';
import type { GeneratedAgentInstructions, GeneratedMcpNarrative, GeneratedReadinessNarrative, Improvement, ScoreCategory } from '../types';
import { displayReadinessLevel } from '../uiCopy';

const CONFIDENCE_NOTE = 'The score is deterministic. Narrative text is generated from scan metadata and should not override critical blockers.';

function list(values: string[], fallback: string) {
  return values.length ? values.join(', ') : fallback;
}

function commandList(input: ReadinessNarrativeInput | AgentInstructionsInput) {
  if (input.stack.runCommands.length) {
    return input.stack.runCommands.map(command => `${command.label}: ${command.cmd}`).join('; ');
  }

  const scriptNames = Object.keys(input.stack.scripts);
  return scriptNames.length ? `package scripts: ${scriptNames.join(', ')}` : 'no verification commands detected';
}

function strongestCategories(categories: ScoreCategory[]) {
  return [...categories]
    .sort((a, b) => (b.earned / b.max) - (a.earned / a.max))
    .slice(0, 2)
    .map(category => `${category.name} (${category.earned}/${category.max})`);
}

function priorityImprovements(improvements: Improvement[]) {
  return improvements
    .slice(0, 4)
    .map(improvement => `${improvement.title} (${improvement.category})`);
}

function evidenceSignals(input: ReadinessNarrativeInput) {
  const keyFiles = input.scanEvidence?.keyFilesFound;
  const signals = [
    keyFiles?.readme ? 'README found' : '',
    keyFiles?.packageJson ? 'package.json found' : '',
    Object.keys(input.stack.scripts).length ? `package scripts found (${Object.keys(input.stack.scripts).slice(0, 4).join(', ')})` : '',
    keyFiles?.ciConfig ? 'CI workflow found' : '',
    keyFiles?.tests ? 'test files found' : '',
    keyFiles?.envExample ? '.env example found' : '.env example missing',
    keyFiles?.gitignore ? '.gitignore found' : '',
    keyFiles?.agentInstructions ? 'agent instructions found' : '',
    input.scanSummary.ignoredGeneratedFolders.includes('node_modules') || input.scanSummary.ignoredGeneratedFolders.includes('dist') || input.scanSummary.ignoredGeneratedFolders.includes('build')
      ? `.gitignore/generated-folder hygiene signal from ignored folders (${input.scanSummary.ignoredGeneratedFolders.slice(0, 4).join(', ')})`
      : '',
  ].filter(Boolean);

  return signals.length ? signals.join('; ') : 'no concrete key-file signals were found in the readable subset';
}

export class LocalAIProvider implements AIProvider {
  async generateReadinessNarrative(input: ReadinessNarrativeInput): Promise<GeneratedReadinessNarrative> {
    return this.generateReadinessNarrativeSync(input);
  }

  async generateAgentInstructions(input: AgentInstructionsInput): Promise<GeneratedAgentInstructions> {
    return this.generateAgentInstructionsSync(input);
  }

  async generateMcpGovernanceNarrative(input: McpGovernanceNarrativeInput): Promise<GeneratedMcpNarrative> {
    return this.generateMcpGovernanceNarrativeSync(input);
  }

  generateReadinessNarrativeSync(input: ReadinessNarrativeInput): GeneratedReadinessNarrative {
    const stack = input.stack.primary;
    const frameworks = list(input.stack.frameworks, 'no framework');
    const languages = list(input.stack.languages, 'unknown languages');
    const commands = commandList(input);
    const strongSignals = strongestCategories(input.categories);
    const concreteSignals = evidenceSignals(input);
    const topBlockers = input.blockers.slice(0, 3).map(blocker => blocker.title);
    const improvements = priorityImprovements(input.improvements);

    if (input.isReady) {
      return {
        executiveSummary: `${input.repositoryName} is AI Coding Ready at ${input.score}/100. ShipSeal found a usable ${stack} shape, ${languages}, ${frameworks}, and enough verification context for coding agents to work from repository metadata without executing uploaded code.`,
        readinessExplanation: `The ready status comes from deterministic checks: score >= 85 and zero critical blockers. Concrete scan signals: ${concreteSignals}. Strongest scoring areas: ${strongSignals.join('; ') || 'balanced scoring across the readiness categories'}. Suggested commands include ${commands}. MCP Readiness is tracked separately as ${input.mcpReadiness.status} (${input.mcpReadiness.score}/100), so governance work can continue without weakening the main ready state.`,
        blockerExplanation: 'No critical blockers were detected. Remaining work is optional improvement work, not a readiness gate.',
        improvementPriorities: improvements.length ? improvements : ['Keep generated ShipSeal instructions current as the repository changes.'],
        nextBestActions: [
          'Commit the generated Agent Pack and point coding agents at AGENTS.md.',
          'Use the detected verification commands after agent changes.',
          'Treat MCP governance as a separate capability layer before enabling external tools.',
        ],
        confidenceNote: CONFIDENCE_NOTE,
      };
    }

    const blockerText = topBlockers.length ? topBlockers.join('; ') : 'score below the AI Coding Ready threshold';
    const minimumActions = input.blockers.length
      ? [
          ...input.blockers.slice(0, 3).map(blocker => `Resolve ${blocker.title.toLowerCase()}.`),
          'Re-run ShipSeal after remediation and confirm the blockers list is empty.',
        ]
      : [
          'Raise the deterministic score to at least 85 by improving documentation, verification commands, and agent instructions.',
          'Re-run ShipSeal after score-focused improvements and confirm the readiness threshold.',
        ];

    return {
      executiveSummary: input.blockers.length
        ? `${input.repositoryName} is not AI Coding Ready yet (${input.score}/100, ${displayReadinessLevel(input.level)}). The local scan found ${stack} signals, but readiness is blocked by ${blockerText}.`
        : `${input.repositoryName} is not AI Coding Ready yet (${input.score}/100, ${displayReadinessLevel(input.level)}). No critical blocker was detected, but the repository has not reached the readiness threshold.`,
      readinessExplanation: `ShipSeal will only mark the repository ready when the deterministic score is at least 85 and criticalBlockers.length is 0. Detected context: ${languages}; frameworks: ${frameworks}; commands: ${commands}. Concrete scan signals: ${concreteSignals}. Uploaded code was not executed during this scan.`,
      blockerExplanation: input.blockers.length
        ? `Minimum path to readiness: ${input.blockers.map(blocker => `${blocker.title} - ${blocker.detail}`).join(' ')}`
        : 'There are no critical blockers, but the deterministic score is still below the readiness threshold.',
      improvementPriorities: improvements.length ? improvements : ['Add a README, stack manifest, and safe verification commands.'],
      nextBestActions: [
        ...minimumActions,
        'Review MCP Readiness separately before enabling external capability servers.',
      ],
      confidenceNote: CONFIDENCE_NOTE,
    };
  }

  generateAgentInstructionsSync(input: AgentInstructionsInput): GeneratedAgentInstructions {
    const commands = commandList(input);
    const folders = list(input.summary.keyFolders.map(folder => `${folder}/`), 'repository root');
    const blockers = input.blockers.length
      ? input.blockers.map(blocker => blocker.title).join('; ')
      : 'none';
    const readyLine = input.isReady
      ? 'The repo is AI Coding Ready; optional improvements should be handled only when they match the task.'
      : input.blockers.length
        ? 'The repo is not AI Coding Ready; agents should focus first on clearing deterministic blockers.'
        : 'The repo is not AI Coding Ready; no critical blocker was detected, but the score still needs improvement.';

    return {
      agentsMdEnhancement: `## Repository-specific AI guidance
${readyLine}

- Work primarily in ${folders}.
- Use ${commands} as the verification path when those commands exist.
- Never execute uploaded code as part of ShipSeal scanning; only run repository commands during normal development with human intent.
- Critical blockers from the scan: ${blockers}.
- MCP readiness is a separate governance layer. Do not use MCP tools to bypass repository rules, secret handling, or review gates.`,
      claudeMdEnhancement: `## Minimum safe workflow
1. Read AGENTS.md, the task, and the closest source files before editing.
2. Keep changes scoped to ${folders}.
3. Verify with ${commands}.
4. If a critical blocker is present, do not describe the repo as AI Coding Ready until ShipSeal reports zero blockers.`,
      codexPromptEnhancement: `## ShipSeal context prompt
You are working in ${input.repositoryName}, a ${input.stack.primary} repository. Deterministic readiness is ${input.score}/100 (${displayReadinessLevel(input.level)}). ${readyLine} Use the Repo Context Pack for metadata only; it intentionally excludes raw full file contents and secrets.`,
      reviewerPromptEnhancement: `## Repository-specific review focus
- Confirm the change does not weaken the deterministic readiness blockers.
- Check whether verification commands were updated or run: ${commands}.
- Check secret handling, generated/vendor ignores, and MCP governance boundaries.
- Verdict must respect ShipSeal blockers; narrative text cannot override them.`,
      testingStrategyEnhancement: `## Testing strategy enhancement
Prioritize tests around the detected ${input.stack.primary} surface. Start with scripts or commands already present (${commands}), then add missing unit, integration, or e2e coverage for the highest-risk folders: ${folders}.`,
    };
  }

  generateMcpGovernanceNarrativeSync(input: McpGovernanceNarrativeInput): GeneratedMcpNarrative {
    const riskTitles = input.mcpReadiness.riskFindings.slice(0, 4).map(finding => `${finding.severity}: ${finding.title}`);
    const recLabels = input.mcpReadiness.recommendedServerCategories.slice(0, 4).map(rec => rec.label);
    const blockerClause = input.criticalBlockers.length
      ? `Main readiness has ${input.criticalBlockers.length} critical blocker(s), so MCP should remain conservative until they are resolved.`
      : 'Main readiness has no critical blockers, but MCP still needs least-privilege governance.';

    return {
      mcpSummary: `${input.repositoryName} is ${input.mcpReadiness.status} for MCP at ${input.mcpReadiness.score}/100. MCP is a separate governance layer from the main ShipSeal score (${displayReadinessLevel(input.agentLevel)}, ${input.agentScore}/100).`,
      riskNarrative: `${blockerClause} Current MCP risk signals: ${riskTitles.join('; ') || 'no MCP-specific risk findings detected'}. Recommended server categories: ${recLabels.join(', ') || 'none yet'}.`,
      recommendedGovernanceActions: [
        'Default MCP tools to read-only access.',
        'Require human approval for writes, deployments, browser credential flows, production data, and database changes.',
        'Send only a sanitized Repo Context Pack to future AI providers or coding agents.',
      ],
    };
  }
}

export const localAIProvider = new LocalAIProvider();

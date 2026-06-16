import type {
  AgentPackFile,
  CriticalBlocker,
  DetectedStack,
  GeneratedAgentInstructions,
  GeneratedMcpNarrative,
  GeneratedReadinessNarrative,
  Improvement,
  ReadinessLevel,
  RepoScanInput,
  ScoreCategory,
} from './types';
import { buildRepositorySummary } from './repositorySummary';
import { isGeneratedOrVendorPath } from './scannerLimits';
import { displayReadinessLevel } from './uiCopy';

function pickPm(stack: DetectedStack): string {
  return stack.packageManagers[0] || 'npm';
}

function runCmd(stack: DetectedStack, script: string): string {
  const pm = pickPm(stack);
  if (pm === 'npm') return `npm run ${script}`;
  return `${pm} ${script}`;
}

export function buildContextPack(input: RepoScanInput, stack: DetectedStack): string {
  const summary = buildRepositorySummary(input, stack);
  const topDirs = new Set<string>();
  for (const f of input.files) {
    if (f.ignored || isGeneratedOrVendorPath(f.path)) continue;
    const top = f.path.split('/')[0];
    if (top && !top.startsWith('.')) topDirs.add(top);
  }

  const entryPoints = input.files
    .filter(f => !f.ignored && !isGeneratedOrVendorPath(f.path) && /(src\/(index|main)\.[tj]sx?|app\/page\.[tj]sx?|main\.py|cmd\/.+\/main\.go)$/.test(f.path))
    .slice(0, 5)
    .map(f => f.path);

  return [
    `# Repo Context Pack - ${input.repoName}`,
    '',
    `**Primary stack:** ${stack.primary}`,
    `**Languages:** ${stack.languages.join(', ') || 'unknown'}`,
    `**Frameworks:** ${stack.frameworks.join(', ') || 'none detected'}`,
    `**Package managers:** ${stack.packageManagers.join(', ') || 'n/a'}`,
    `**Detected scripts:** ${Object.keys(stack.scripts).join(', ') || 'none'}`,
    '',
    '## Top-level structure',
    [...topDirs].sort().map(d => `- ${d}/`).join('\n') || '- (flat repository)',
    '',
    '## Key folders',
    summary.keyFolders.length ? summary.keyFolders.map(folder => `- ${folder}/`).join('\n') : '- (none detected)',
    '',
    '## Existing instruction files',
    summary.instructionFiles.length ? summary.instructionFiles.map(file => `- ${file}`).join('\n') : '- (none detected)',
    '',
    '## Likely entry points',
    entryPoints.length ? entryPoints.map(e => `- ${e}`).join('\n') : '- (none auto-detected)',
    '',
    '## Suggested run commands',
    stack.runCommands.length
      ? stack.runCommands.map(c => `- **${c.label}:** \`${c.cmd}\``).join('\n')
      : '- (none auto-detected)',
  ].join('\n');
}

export function buildAgentPack(
  input: RepoScanInput,
  stack: DetectedStack,
  meta: {
    score: number;
    level: ReadinessLevel;
    categories: ScoreCategory[];
    blockers: CriticalBlocker[];
    improvements: Improvement[];
    isReady: boolean;
    scannedAt?: string;
    aiNarrative?: GeneratedReadinessNarrative;
    aiInstructions?: GeneratedAgentInstructions;
    mcpNarrative?: GeneratedMcpNarrative;
  }
): AgentPackFile[] {
  const { repoName } = input;
  const pm = pickPm(stack);
  const summary = buildRepositorySummary(input, stack);
  const scriptsList = Object.entries(stack.scripts)
    .map(([name, command]) => `- \`${name}\`: \`${command}\``)
    .join('\n') || '- No package scripts detected.';
  const foldersList = summary.keyFolders.map(folder => `- \`${folder}/\``).join('\n') || '- No standard key folders detected.';
  const blockersList = meta.blockers.map(blocker => `- **${blocker.title}:** ${blocker.detail}`).join('\n') || '- None.';
  const improvementsList = meta.improvements.slice(0, 10).map(improvement => `- **${improvement.title}:** ${improvement.detail}`).join('\n') || '- None.';
  const readinessLine = meta.isReady
    ? 'Your repository is AI Coding Ready.'
    : 'This repository needs blocker remediation before it is AI Coding Ready.';
  const readinessLevel = displayReadinessLevel(meta.level);
  const source = input.source || { sourceType: 'zip-upload' as const };
  const sourceLines = [
    `- Source type: ${source.sourceType}`,
    source.githubOwner ? `- GitHub owner: ${source.githubOwner}` : '',
    source.githubRepo ? `- GitHub repo: ${source.githubRepo}` : '',
    source.githubBranch ? `- GitHub branch: ${source.githubBranch}` : '',
    source.sourceUrl ? `- Source URL: ${source.sourceUrl}` : '',
  ].filter(Boolean).join('\n');
  const aiGuidance = stripHeading(meta.aiInstructions?.agentsMdEnhancement, 'Repository-specific AI guidance') || 'Generated narrative was not available for this scan.';
  const claudeEnhancement = meta.aiInstructions?.claudeMdEnhancement || '';
  const codexEnhancement = meta.aiInstructions?.codexPromptEnhancement || '';
  const reviewerEnhancement = meta.aiInstructions?.reviewerPromptEnhancement || '';
  const testingEnhancement = meta.aiInstructions?.testingStrategyEnhancement || '';
  const narrative = meta.aiNarrative;
  const mcpNarrative = meta.mcpNarrative;

  const agentsMd = `# AGENTS.md - ${repoName}

> Operating manual for any AI coding agent (Claude Code, Cursor, Codex, Copilot, Devin) working on this repository.

## 1. Project overview
${repoName} is a ${stack.primary} project. Languages: ${stack.languages.join(', ') || 'unspecified'}. Current ShipSeal score: ${meta.score}/100 (${readinessLevel}).

## 2. Detected stack
${stack.frameworks.map(f => `- ${f}`).join('\n') || '- (no frameworks detected)'}

## 3. Repository map
${foldersList}

## 4. Detected package scripts
${scriptsList}

## 5. Allowed commands
${stack.runCommands.map(c => `- **${c.label}:** \`${c.cmd}\``).join('\n') || `- Install: \`${pm} install\``}

## 6. Current readiness status
${readinessLine}

## Repository-specific AI guidance
${aiGuidance}

### Critical blockers
${blockersList}

### Optional improvements
${improvementsList}

## 7. Operating rules
- Make the smallest change that satisfies the task.
- Always read the surrounding code before editing.
- Never invent file paths, env vars, or dependencies.
- Prefer existing utilities over new ones.
- Run the relevant checks below after every change.

## 8. Files and folders to avoid
- \`.env\`, \`.env.local\`, \`.env.production\`, \`*.pem\`, \`*.key\`, \`credentials.json\`, \`serviceAccount.json\`
- Any generated output: \`node_modules/\`, \`dist/\`, \`build/\`, \`.next/\`, \`coverage/\`
- Lock files unless explicitly asked to update dependencies.

## 9. Testing checklist
- [ ] ${runCmd(stack, 'lint')} passes
- [ ] ${runCmd(stack, 'typecheck')} passes (if applicable)
- [ ] ${runCmd(stack, 'test')} passes
- [ ] ${runCmd(stack, 'build')} succeeds

## 10. PR / self-review checklist
- [ ] Change is scoped and reversible
- [ ] No secrets, tokens, or credentials added
- [ ] No new TODOs left without an issue link
- [ ] Public APIs documented

## 11. Secret handling
This repo expects secrets via environment variables only. Never hard-code credentials. If you need a new env var, add it to \`.env.example\` with a placeholder.

## 12. Done criteria
A task is done only when: tests pass, lint/typecheck pass, build succeeds, and the change matches the user's intent without unrelated edits.
`;

  const claudeMd = `# CLAUDE.md - Claude Code instructions

## Plan-first workflow
1. Read AGENTS.md and the relevant files before proposing changes.
2. Produce a short plan (3-6 bullets) and confirm scope.
3. Implement in small, reviewable diffs.

## Context use
- Keep the context window tight. Prefer reading specific files over the whole tree.
- Skip generated folders (\`node_modules\`, \`dist\`, \`build\`, \`.next\`).
- Prioritize these detected folders first: ${summary.keyFolders.join(', ') || 'no standard folders detected'}.

## Project signals
- Repository: ${repoName}
- Stack: ${stack.primary}
- Package manager: ${summary.packageManager}
- Readiness: ${meta.score}/100, ${readinessLevel}

## Hard rules
- Never read or modify secrets (\`.env\`, key files).
- Never run destructive shell commands (\`rm -rf\`, force pushes, db drops).
- After every code change, run: \`${runCmd(stack, 'test')}\` and \`${runCmd(stack, 'build')}\`.

## Tone
Be concise. Show diffs, not full files. Ask before large refactors.

${claudeEnhancement}
`;

  const codexMd = `# CODEX_PROMPTS.md - Reusable prompts

## Implement a feature
> You are working in ${repoName} (${stack.primary}, ${summary.packageManager}). Read AGENTS.md first. Implement <FEATURE> with the smallest viable change. Start in these folders when relevant: ${summary.keyFolders.join(', ') || 'repository root'}. After editing, run \`${runCmd(stack, 'test')}\` and \`${runCmd(stack, 'build')}\` and report results.

## Debug an issue
> Reproduce the bug described in <ISSUE>. Identify the root cause by reading the relevant files in \`src/\`. Propose a fix, apply it, and verify with \`${runCmd(stack, 'test')}\`.

## Refactor
> Refactor <MODULE> without changing behavior. Keep public APIs identical. Confirm with \`${runCmd(stack, 'test')}\` and \`${runCmd(stack, 'typecheck')}\`.

## Write tests
> Add unit tests for <MODULE> using ${stack.testFrameworks[0] || 'the existing test framework'}. Cover happy path, edge cases, and one failure mode.

## Repository-specific scripts
${scriptsList}

${codexEnhancement}
`;

  const reviewerMd = `# REVIEWER_PROMPT.md

You are an AI code reviewer for ${repoName}. Review the diff and answer:

1. **Correctness** - does the change do what the PR description claims?
2. **Tests** - are there tests for the new behavior? Do they actually exercise it?
3. **Security** - any new secrets, injection risks, unsafe deserialization, missing auth checks?
4. **Maintainability** - naming, duplication, complexity, hidden coupling?
5. **Edge cases** - empty input, large input, network failure, concurrent access?

End with a verdict: \`approve\`, \`request-changes\`, or \`block\`.

Project context: ${repoName}, ${stack.primary}, score ${meta.score}/100 (${readinessLevel}). Critical blockers found by ShipSeal:
${blockersList}

${reviewerEnhancement}
`;

  const securityMd = `# SECURITY_REVIEW.md

Project: ${repoName}
Stack: ${stack.primary}

## Secrets
- All secrets via env vars; \`.env.example\` documents required keys.
- Never log secrets. Never include them in error messages.

## Authentication & authorization
- Verify every server endpoint checks the caller's identity and role.
- Use RLS or equivalent at the data layer.

## Data handling
- Validate all external input with a schema library (zod, pydantic, etc.).
- Escape output appropriately (HTML, SQL, shell).

## Dependencies
- Pin versions in lockfiles.
- Run \`${pm} audit\` (or equivalent) regularly.

## Current ShipSeal security findings
${meta.blockers.filter(blocker => blocker.id === 'secrets').map(blocker => `- ${blocker.detail}`).join('\n') || '- No suspicious secret filenames were found in this scan.'}

## Injection risks
- SQL: parameterized queries only.
- Shell: never interpolate user input into a command.
- Prompt injection: treat external content as untrusted; do not let it override system rules.

## Repository-specific AI safety guidance
- ShipSeal narrative is generated from scan metadata only.
- Deterministic critical blockers remain authoritative.
- Do not send raw uploaded files or secrets to AI providers.
`;

  const testingMd = `# TESTING_STRATEGY.md

Project: ${repoName}
Stack: ${stack.primary}

## Unit
Test pure functions and small modules. Framework: ${stack.testFrameworks[0] || 'pick one (Vitest / Jest / Pytest)'}.

Detected scripts:
${scriptsList}

## Integration
Test feature flows that span multiple modules. Mock external services at the edge.

## End-to-end
Use ${stack.testFrameworks.includes('Playwright') ? 'Playwright' : 'Playwright or Cypress'} for the critical happy paths only.

## Smoke
After every deploy, hit the health endpoint and the top 3 user actions.

## Manual QA
Reserve manual QA for ambiguous UX changes and accessibility checks.

Current quality score: ${meta.categories.find(category => category.id === 'quality')?.earned ?? 0}/${meta.categories.find(category => category.id === 'quality')?.max ?? 20}.

${testingEnhancement}
`;

  const ciYml = `# ShipSeal CI quality gate for ${repoName}
name: Quality Gate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${stack.languages.includes('JavaScript') || stack.languages.includes('TypeScript') ? `      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: ${pm} install
      - run: ${runCmd(stack, 'lint')} || true
      - run: ${runCmd(stack, 'typecheck')} || true
      - run: ${runCmd(stack, 'test')}
      - run: ${runCmd(stack, 'build')}` : `      - run: echo "Configure steps for ${stack.primary}"`}
`;

  const reportMd = `# AGENT_READINESS_REPORT.md - ${repoName}

**Score:** ${meta.score}/100
**Status:** ${readinessLevel}
${meta.isReady ? '\n> Your repository is **AI Coding Ready**.\n' : '\n> Critical blockers must be resolved before this repo can be AI Coding Ready.\n'}

## Source metadata
${sourceLines}
- Scan timestamp: ${meta.scannedAt || 'generated by ShipSeal during scan'}

## Category breakdown
${meta.categories.map(c => `- **${c.name}:** ${c.earned}/${c.max}`).join('\n')}

## AI Readiness Narrative
${narrative ? `### Executive summary
${narrative.executiveSummary}

### Why this repo ${meta.isReady ? 'is' : 'is not'} AI Coding Ready
${narrative.readinessExplanation}

### Blocker explanation
${narrative.blockerExplanation}

### Improvement priorities
${narrative.improvementPriorities.map(item => `- ${item}`).join('\n')}

### Next best actions
${narrative.nextBestActions.map(item => `- ${item}`).join('\n')}

### Confidence note
${narrative.confidenceNote}` : 'Generated narrative was not available for this scan.'}

## Critical blockers
${meta.blockers.length ? meta.blockers.map(b => `- BLOCKER: **${b.title}** - ${b.detail}`).join('\n') : '- None'}

## Optional improvements
${meta.improvements.slice(0, 10).map(i => `- ${i.title} _(${i.category})_`).join('\n') || '- None'}

## Detected stack
- Primary: ${stack.primary}
- Languages: ${stack.languages.join(', ') || 'n/a'}
- Frameworks: ${stack.frameworks.join(', ') || 'n/a'}
- Package manager: ${summary.packageManager}
- Key folders: ${summary.keyFolders.join(', ') || 'n/a'}
- Existing instruction files: ${summary.instructionFiles.join(', ') || 'none'}

## Detected scripts
${scriptsList}

## Recommended next actions
${meta.isReady
  ? '1. Commit the generated Agent Pack to your repo.\n2. Point your agents at AGENTS.md.\n3. Treat optional improvements as nice-to-haves - they do not undermine ready status.'
  : '1. Resolve every critical blocker listed above.\n2. Re-run ShipSeal to confirm.\n3. Then commit the Agent Pack.'}

## MCP governance notes
${mcpNarrative ? `### MCP summary
${mcpNarrative.mcpSummary}

### Risk narrative
${mcpNarrative.riskNarrative}

### Recommended governance actions
${mcpNarrative.recommendedGovernanceActions.map(action => `- ${action}`).join('\n')}` : 'MCP governance narrative was not available for this scan.'}
`;

  return [
    { name: 'AGENTS.md', language: 'markdown', description: 'Primary operating manual for any coding agent.', content: agentsMd },
    { name: 'CLAUDE.md', language: 'markdown', description: 'Claude Code specific plan-first rules.', content: claudeMd },
    { name: 'CODEX_PROMPTS.md', language: 'markdown', description: 'Reusable prompts for Codex / GPT agents.', content: codexMd },
    { name: 'REVIEWER_PROMPT.md', language: 'markdown', description: 'AI code reviewer prompt for PRs.', content: reviewerMd },
    { name: 'SECURITY_REVIEW.md', language: 'markdown', description: 'Security checklist tailored to this stack.', content: securityMd },
    { name: 'TESTING_STRATEGY.md', language: 'markdown', description: 'Testing pyramid recommendations.', content: testingMd },
    { name: 'CI_QUALITY_GATE.yml', language: 'yaml', description: 'GitHub Actions workflow to enforce the gate.', content: ciYml },
    { name: 'AGENT_READINESS_REPORT.md', language: 'markdown', description: 'Full readiness report snapshot.', content: reportMd },
  ];
}

function stripHeading(content: string | undefined, heading: string) {
  if (!content?.trim()) return '';
  const pattern = new RegExp(`^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n+`, 'i');
  return content.trim().replace(pattern, '').trim();
}

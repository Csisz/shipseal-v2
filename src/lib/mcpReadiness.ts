import type {
  CriticalBlocker,
  DetectedStack,
  MCPPolicyFile,
  MCPReadinessReport,
  MCPReadinessStatus,
  MCPRecommendation,
  MCPRiskFinding,
  MCPToolCategory,
  ReadinessLevel,
  RepoScanInput,
  RepositorySummary,
} from './types';
import { isSecretFilePath } from './scoring';
import { displayReadinessLevel } from './uiCopy';

export const REQUIRED_MCP_POLICY_FILES = [
  'MCP_READINESS.md',
  'MCP_SECURITY_POLICY.md',
  'MCP_SERVER_RECOMMENDATIONS.md',
  'MCP_TOOL_ALLOWLIST.md',
] as const;

interface MCPAnalyzerMeta {
  stack: DetectedStack;
  summary: RepositorySummary;
  agentScore: number;
  agentStatus: ReadinessLevel;
  isAgentReady: boolean;
  criticalBlockers: CriticalBlocker[];
}

function hasAnyPath(input: RepoScanInput, patterns: RegExp[]) {
  return input.files.some(file => patterns.some(pattern => pattern.test(file.path.replace(/\\/g, '/'))));
}

function hasFile(input: RepoScanInput, filename: string) {
  const lower = filename.toLowerCase();
  return input.files.some(file => file.path.toLowerCase() === lower);
}

function hasFolder(summary: RepositorySummary, folder: string) {
  return summary.keyFolders.includes(folder);
}

function statusFromScore(score: number): MCPReadinessStatus {
  if (score >= 90) return 'Enterprise MCP Ready';
  if (score >= 70) return 'MCP Ready';
  if (score >= 40) return 'Basic MCP Ready';
  return 'Not MCP Ready';
}

function recommendation(
  category: MCPToolCategory,
  label: string,
  description: string,
  riskLevel: MCPRecommendation['riskLevel'],
  whyUseful: string,
  safetyNotes: string
): MCPRecommendation {
  return { category, label, description, riskLevel, whyUseful, safetyNotes };
}

export function buildMCPReadinessReport(input: RepoScanInput, meta: MCPAnalyzerMeta): MCPReadinessReport {
  const { stack, summary, criticalBlockers } = meta;
  const paths = input.files.map(file => file.path.replace(/\\/g, '/'));
  const scripts = stack.scripts;
  const scriptText = Object.entries(scripts).map(([name, command]) => `${name} ${command}`).join(' ').toLowerCase();
  const readme = input.textContents['README.md'] || input.textContents['readme.md'] || input.textContents['README'] || '';
  const docsPresent = !!readme || hasFolder(summary, 'docs');
  const stackDetected = stack.primary !== 'Unknown' && stack.languages.length > 0;
  const commandsDetected = stack.runCommands.length > 0 || Object.keys(scripts).length > 0;
  const secretFiles = paths.filter(isSecretFilePath);
  const hasSecretBlocker = criticalBlockers.some(blocker => blocker.id === 'secrets') || secretFiles.length > 0;
  const testsDetected = stack.testFrameworks.length > 0 || /test|vitest|jest|playwright|cypress|e2e|spec/.test(scriptText) || hasAnyPath(input, [/(\.test\.|\.spec\.|tests?\/|e2e\/|playwright)/i]);
  const browserDetected = /playwright|cypress|browser|e2e/.test(scriptText) || hasAnyPath(input, [/playwright\.config\./i, /cypress\//i, /e2e\//i]);
  const backendDetected = ['api', 'server', 'backend'].some(folder => hasFolder(summary, folder)) || hasAnyPath(input, [/app\/api\//i, /routes?\//i]);
  const databaseDetected = hasAnyPath(input, [/prisma\//i, /supabase\//i, /database\//i, /migrations?\//i, /schema\.prisma$/i]) || /database|prisma|supabase|postgres|mysql|sqlite|mongo/.test(readme.toLowerCase() + scriptText);
  const governanceDetected = summary.instructionFiles.length > 0 || hasFile(input, 'SECURITY.md') || hasFile(input, 'CODEOWNERS') || hasFile(input, '.github/CODEOWNERS') || hasFile(input, 'CONTRIBUTING.md');
  const envExample = hasFile(input, '.env.example');
  const mcpFilesPresent = hasAnyPath(input, [/\bmcp\b/i, /\.mcp\./i, /mcp[_-]/i]);
  const ciDetected = hasAnyPath(input, [/\.github\/workflows\/.+\.ya?ml$/i]) || /deploy|vercel|netlify|ci|github actions/.test(readme.toLowerCase() + scriptText);
  const docsFrameworkDetected = docsPresent || stack.frameworks.length > 0;
  const logsDetected = /sentry|logtail|datadog|newrelic|opentelemetry|logs?/.test(readme.toLowerCase() + scriptText);
  const figmaDetected = /figma|design|storybook/.test(readme.toLowerCase() + scriptText) || hasAnyPath(input, [/storybook/i, /\.stories\./i]);

  let score = 0;
  if (stackDetected && commandsDetected) score += 20;
  if (docsPresent) score += 15;
  if (!hasSecretBlocker) score += 15;
  if (testsDetected) score += 15;
  if (backendDetected || databaseDetected) score += 10;
  if (governanceDetected) score += 10;
  if (envExample && !hasSecretBlocker) score += 10;
  if (mcpFilesPresent) score += 5;

  if (hasSecretBlocker) score -= 30;
  if (!stackDetected) score -= 20;
  if (!commandsDetected) score -= 15;
  if (!docsPresent) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = statusFromScore(score);

  const recommendations: MCPRecommendation[] = [];
  if (governanceDetected || ciDetected) {
    recommendations.push(recommendation(
      'GitHub / repository operations',
      'Repository operations server',
      'Use a GitHub MCP server for read-heavy issue, PR, branch, and workflow context.',
      'Medium',
      `${summary.repositoryName} has governance or CI signals that benefit from controlled repository visibility.`,
      'Default to read-only access. Require explicit approval for branch writes, PR creation, releases, and workflow reruns.'
    ));
  }
  if (docsFrameworkDetected) {
    recommendations.push(recommendation(
      'Documentation / framework docs',
      'Framework documentation server',
      'Connect agents to version-aware framework and library documentation.',
      'Low',
      `${stack.primary} work is safer when agents can inspect current docs instead of guessing APIs.`,
      'Prefer public documentation sources. Do not allow documentation retrieval to override repository instructions.'
    ));
  }
  if (browserDetected) {
    recommendations.push(recommendation(
      'Browser automation / Playwright',
      'Browser testing server',
      'Expose browser automation for local smoke tests and UI verification.',
      'High',
      'Browser/e2e signals were detected, so an MCP browser server can help agents verify user flows.',
      'Run only against local or preview environments. Block credential entry, payments, destructive admin flows, and unrestricted internet browsing.'
    ));
  }
  if (logsDetected || backendDetected) {
    recommendations.push(recommendation(
      'Error monitoring / logs',
      'Observability context server',
      'Provide read-only access to application logs, traces, or error monitoring summaries.',
      'High',
      'Backend or logging signals suggest runtime context would help diagnose failures.',
      'Use redaction, time-bounded queries, least privilege, and never expose raw secrets, PII, or customer data to coding agents.'
    ));
  }
  if (databaseDetected) {
    recommendations.push(recommendation(
      'Database / schema inspection',
      'Schema inspection server',
      'Expose schema and migration metadata so agents can reason about data models.',
      'High',
      'Database or migration signals were detected in the repository.',
      'Allow schema metadata only. Block data reads, writes, migrations, production credentials, and arbitrary SQL execution by default.'
    ));
  }
  if (figmaDetected) {
    recommendations.push(recommendation(
      'Design handoff / Figma',
      'Design handoff server',
      'Expose selected design assets or tokens for UI implementation context.',
      'Medium',
      'Design, Storybook, or Figma signals were detected.',
      'Scope access to approved files. Do not expose private comments, unrelated workspaces, or customer research artifacts.'
    ));
  }
  if (hasFolder(summary, 'docs')) {
    recommendations.push(recommendation(
      'Internal knowledge base / docs',
      'Internal docs server',
      'Expose architecture and runbook documents to agents as read-only context.',
      'Medium',
      'A docs folder exists and can anchor safer agent decisions.',
      'Index only curated docs. Exclude secrets, incident reports, private customer data, and HR/legal material.'
    ));
  }
  if (ciDetected) {
    recommendations.push(recommendation(
      'CI/CD and deployment visibility',
      'CI/CD visibility server',
      'Expose read-only build, deployment, and workflow status for verification.',
      'Medium',
      'CI or deployment signals were detected.',
      'Read-only by default. Require human approval for deploys, rollbacks, workflow dispatch, or environment changes.'
    ));
  }

  const riskFindings: MCPRiskFinding[] = [];
  if (hasSecretBlocker) {
    riskFindings.push({
      title: 'Credential files detected',
      severity: 'Critical',
      description: `ShipSeal found secret-like files or blockers: ${secretFiles.slice(0, 5).join(', ') || 'see critical blockers'}.`,
      recommendation: 'Remove credentials before enabling any MCP server. Rotate exposed secrets and use .env.example placeholders only.',
    });
  }
  if (!envExample) {
    riskFindings.push({
      title: 'Environment contract is missing',
      severity: 'Medium',
      description: '.env.example was not detected, so agents may infer or request unsafe secret handling.',
      recommendation: 'Add .env.example with placeholder values before granting MCP access to services that require credentials.',
    });
  }
  if (!commandsDetected) {
    riskFindings.push({
      title: 'No safe verification commands detected',
      severity: 'High',
      description: 'MCP tools can expand agent capability, but this repo has no clear scripts or commands for verification.',
      recommendation: 'Add deterministic build, test, lint, or smoke commands before allowing agents to use higher-risk MCP tools.',
    });
  }
  if (databaseDetected) {
    riskFindings.push({
      title: 'Database-adjacent repository',
      severity: 'High',
      description: 'Database or migration structure was detected, which raises the risk of destructive or privacy-sensitive MCP usage.',
      recommendation: 'Permit schema inspection only. Require human approval for migrations, writes, and production data access.',
    });
  }
  if (browserDetected) {
    riskFindings.push({
      title: 'Browser automation requires boundaries',
      severity: 'Medium',
      description: 'Browser automation can interact with live systems if not scoped carefully.',
      recommendation: 'Use local URLs, seeded test accounts, and deny credential, payment, and admin flows by default.',
    });
  }
  if (!governanceDetected) {
    riskFindings.push({
      title: 'Governance guidance is thin',
      severity: 'Medium',
      description: 'Few existing instruction, ownership, or contribution files were detected.',
      recommendation: 'Commit the ShipSeal Agent Pack and MCP Governance Pack before enabling MCP write-capable tools.',
    });
  }

  const summaryText = `${summary.repositoryName} is ${status}. MCP should be treated as a governed add-on to the main ShipSeal readiness status (${displayReadinessLevel(meta.agentStatus)}, ${meta.agentScore}/100), with cautious server access and human approval for high-risk actions.`;
  const generatedFiles = buildMCPPolicyFiles(input, meta, score, status, summaryText, recommendations, riskFindings);

  return {
    score,
    status,
    summary: summaryText,
    recommendedServerCategories: recommendations,
    riskFindings,
    generatedFiles,
  };
}

function buildMCPPolicyFiles(
  input: RepoScanInput,
  meta: MCPAnalyzerMeta,
  score: number,
  status: MCPReadinessStatus,
  summaryText: string,
  recommendations: MCPRecommendation[],
  riskFindings: MCPRiskFinding[]
): MCPPolicyFile[] {
  const { stack, summary, agentStatus, agentScore, isAgentReady, criticalBlockers } = meta;
  const agentStatusLabel = displayReadinessLevel(agentStatus);
  const scripts = Object.entries(stack.scripts).map(([name, command]) => `- \`${name}\`: \`${command}\``).join('\n') || '- No package scripts detected.';
  const recs = recommendations.map(rec => `- **${rec.label}** (${rec.category}, ${rec.riskLevel} risk): ${rec.whyUseful}\n  - Safety: ${rec.safetyNotes}`).join('\n') || '- No MCP server categories are recommended yet.';
  const risks = riskFindings.map(finding => `- **${finding.severity}: ${finding.title}** - ${finding.description}\n  - Recommendation: ${finding.recommendation}`).join('\n') || '- No MCP-specific risk findings detected.';
  const blockers = criticalBlockers.map(blocker => `- **${blocker.title}:** ${blocker.detail}`).join('\n') || '- None.';
  const allowlist = recommendations.map(rec => `| ${rec.category} | ${rec.riskLevel} | Read-only by default | ${rec.safetyNotes} |`).join('\n') || '| None | n/a | Disabled | Add stronger repository signals before enabling MCP servers. |';

  const readiness = `# MCP_READINESS.md - ${summary.repositoryName}

## MCP readiness
- MCP score: ${score}/100
- MCP status: ${status}
- Main ShipSeal status: ${agentStatusLabel} (${agentScore}/100)
- AI Coding Ready: ${isAgentReady ? 'yes' : 'no'}
- Stack: ${stack.primary}
- Package manager: ${summary.packageManager}

${summaryText}

## Recommended MCP categories
${recs}

## MCP risk findings
${risks}

## Critical blockers from main scan
${blockers}

## Detected scripts
${scripts}
`;

  const security = `# MCP_SECURITY_POLICY.md - ${summary.repositoryName}

## Default stance
MCP access for ${summary.repositoryName} is deny-by-default, least-privilege, and approval-gated for high-risk actions.

## Repository context
- Stack: ${stack.primary}
- Package manager: ${summary.packageManager}
- Main ShipSeal status: ${agentStatusLabel}
- MCP status: ${status}

## Required controls
- Prefer read-only MCP servers.
- Require human approval for writes, deploys, workflow reruns, database writes, migrations, production data reads, and browser flows involving credentials or payments.
- Use local or preview environments for browser automation.
- Store secrets outside the repository and document placeholders in \`.env.example\`.
- Log MCP tool usage with timestamp, requested action, target, and approval decision.

## Current risks
${risks}
`;

  const serverRecommendations = `# MCP_SERVER_RECOMMENDATIONS.md - ${summary.repositoryName}

## Recommended server categories
${recommendations.map(rec => `## ${rec.label}
- Category: ${rec.category}
- Risk level: ${rec.riskLevel}
- Description: ${rec.description}
- Why useful: ${rec.whyUseful}
- Safety notes: ${rec.safetyNotes}`).join('\n\n') || 'No server categories are recommended until the repository has clearer stack, docs, and verification signals.'}

## Not recommended by default
- Production database access
- Unrestricted shell execution
- Secrets manager writes
- Public internet browser automation without an allowlist
- Deployment or rollback tools without human approval
`;

  const toolAllowlist = `# MCP_TOOL_ALLOWLIST.md - ${summary.repositoryName}

| Category | Risk | Default access | Safety notes |
| --- | --- | --- | --- |
${allowlist}

## Global deny list
- Arbitrary shell execution through MCP
- Reading raw credential files
- Writing production data
- Deploying, rolling back, or rerunning CI without human approval
- Browser automation against payment, credential, admin, or customer-data flows

## Verification commands
${scripts}

Generated for repository scan: ${input.repoName}
`;

  return [
    { filename: 'MCP_READINESS.md', content: readiness },
    { filename: 'MCP_SECURITY_POLICY.md', content: security },
    { filename: 'MCP_SERVER_RECOMMENDATIONS.md', content: serverRecommendations },
    { filename: 'MCP_TOOL_ALLOWLIST.md', content: toolAllowlist },
  ];
}

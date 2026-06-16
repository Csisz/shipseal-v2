import type { ReadinessReport, RepoScanInput } from './types';
import { detectStack } from './stack';
import { evaluateReadiness, scoreRepo } from './scoring';
import { buildAgentPack } from './agentPack';
import { buildRepositorySummary } from './repositorySummary';
import { buildMCPReadinessReport } from './mcpReadiness';
import { createEmptyScanSummary, isBinaryLikePath, isGeneratedOrVendorPath } from './scannerLimits';
import { localAIProvider } from './ai';
import { buildRepoContextPack, renderRepoContextPackMarkdown } from './repoContextPack';
import type { MCPPolicyFile } from './types';

function addMcpNarrativeToPolicyFiles(files: MCPPolicyFile[], narrative: NonNullable<ReturnType<typeof localAIProvider.generateMcpGovernanceNarrativeSync>>): MCPPolicyFile[] {
  return files.map(file => {
    if (!['MCP_READINESS.md', 'MCP_SECURITY_POLICY.md'].includes(file.filename)) return file;
    return {
      ...file,
      content: `${file.content}

## Generated MCP governance narrative
${narrative.mcpSummary}

### Risk narrative
${narrative.riskNarrative}

### Recommended governance actions
${narrative.recommendedGovernanceActions.map(action => `- ${action}`).join('\n')}
`,
    };
  });
}

export function buildReport(input: RepoScanInput): ReadinessReport {
  const scannedAt = new Date().toISOString();
  const stack = detectStack(input);
  const scoring = scoreRepo(input, stack);
  if (input.scanSummary?.limited) {
    scoring.score = Math.min(scoring.score, 20);
    if (!scoring.blockers.some(blocker => blocker.id === 'limited-scan')) {
      scoring.blockers.push({
        id: 'limited-scan',
        title: 'Limited scan',
        detail: input.scanSummary.limitationReason || 'Repository parsing failed, so ShipSeal used deterministic fallback data instead of a complete repository scan.',
      });
    }
  }
  const readiness = evaluateReadiness(scoring.score, scoring.blockers);
  const summary = buildRepositorySummary(input, stack);
  const fileCount = input.files.filter(f => !f.isDir).length;
  const totalSizeBytes = input.files.reduce((a, f) => a + (f.size || 0), 0);
  const scanSummary = input.scanSummary || {
    ...createEmptyScanSummary(),
    totalFilesFound: fileCount,
    filesAnalyzed: input.files.filter(f => !f.isDir && !isGeneratedOrVendorPath(f.path) && !isBinaryLikePath(f.path)).length,
    filesIgnored: input.files.filter(f => !f.isDir && (isGeneratedOrVendorPath(f.path) || isBinaryLikePath(f.path))).length,
    generatedVendorFilesIgnored: input.files.filter(f => !f.isDir && isGeneratedOrVendorPath(f.path)).length,
    binaryFilesIgnored: input.files.filter(f => !f.isDir && !isGeneratedOrVendorPath(f.path) && isBinaryLikePath(f.path)).length,
    readableTextBytesAnalyzed: Object.values(input.textContents).reduce((total, text) => total + text.length, 0),
  };
  const baseMcpReadiness = buildMCPReadinessReport(input, {
    stack,
    summary,
    agentScore: scoring.score,
    agentStatus: readiness.level,
    isAgentReady: readiness.isReady,
    criticalBlockers: scoring.blockers,
  });
  const mcpNarrative = localAIProvider.generateMcpGovernanceNarrativeSync({
    repositoryName: input.repoName,
    stack,
    summary,
    agentScore: scoring.score,
    agentLevel: readiness.level,
    isAgentReady: readiness.isReady,
    criticalBlockers: scoring.blockers,
    mcpReadiness: baseMcpReadiness,
  });
  const mcpReadiness = {
    ...baseMcpReadiness,
    aiNarrative: mcpNarrative,
    generatedFiles: addMcpNarrativeToPolicyFiles(baseMcpReadiness.generatedFiles, mcpNarrative),
  };
  const aiNarrative = localAIProvider.generateReadinessNarrativeSync({
    repositoryName: input.repoName,
    score: scoring.score,
    level: readiness.level,
    isReady: readiness.isReady,
    stack,
    summary,
    categories: scoring.categories,
    blockers: scoring.blockers,
    improvements: scoring.improvements,
    scanSummary,
    mcpReadiness,
  });
  const repoContextPack = buildRepoContextPack(input, stack, {
    summary,
    scanSummary,
    blockers: scoring.blockers,
    improvements: scoring.improvements,
    mcpReadiness,
  });
  const contextPack = renderRepoContextPackMarkdown(repoContextPack);
  const aiAgentInstructions = localAIProvider.generateAgentInstructionsSync({
    repositoryName: input.repoName,
    score: scoring.score,
    level: readiness.level,
    isReady: readiness.isReady,
    stack,
    summary,
    categories: scoring.categories,
    blockers: scoring.blockers,
    improvements: scoring.improvements,
    scanSummary,
    mcpReadiness,
    readinessNarrative: aiNarrative,
    mcpNarrative,
    repoContextPack,
  });
  const agentPack = buildAgentPack(input, stack, {
    ...scoring,
    isReady: readiness.isReady,
    scannedAt,
    aiNarrative,
    aiInstructions: aiAgentInstructions,
    mcpNarrative,
  });

  return {
    repoName: input.repoName,
    fileCount,
    totalSizeBytes,
    scannedAt,
    source: input.source || { sourceType: 'zip-upload' },
    stack,
    summary,
    categories: scoring.categories,
    score: scoring.score,
    level: readiness.level,
    isReady: readiness.isReady,
    blockers: scoring.blockers,
    improvements: scoring.improvements,
    contextPack,
    repoContextPack,
    agentPack,
    aiNarrative,
    aiAgentInstructions,
    mcpReadiness,
    scanSummary,
    sampleFiles: input.files.filter(f => !f.isDir && !f.ignored && !isGeneratedOrVendorPath(f.path) && !isBinaryLikePath(f.path)).slice(0, 30),
  };
}

// Sample report for "View sample report" button
export function buildSampleReport(): ReadinessReport {
  const input: RepoScanInput = {
    repoName: 'sample-nextjs-app',
    files: [
      { path: 'README.md', size: 4200 },
      { path: 'package.json', size: 1800 },
      { path: 'tsconfig.json', size: 600 },
      { path: 'next.config.mjs', size: 200 },
      { path: '.gitignore', size: 300 },
      { path: '.env.example', size: 220 },
      { path: 'CONTRIBUTING.md', size: 1100 },
      { path: 'AGENTS.md', size: 2400 },
      { path: 'app/page.tsx', size: 1800 },
      { path: 'app/layout.tsx', size: 900 },
      { path: 'app/api/health/route.ts', size: 320 },
      { path: 'components/Hero.tsx', size: 2100 },
      { path: 'lib/utils.ts', size: 480 },
      { path: 'src/index.test.ts', size: 700 },
      { path: '.github/workflows/ci.yml', size: 800 },
      { path: 'docs/architecture.md', size: 1800 },
      { path: 'tests/home.spec.ts', size: 600 },
      { path: 'playwright.config.ts', size: 600 },
      { path: 'prisma/schema.prisma', size: 900 },
    ],
    textContents: {
      'README.md': `# sample-nextjs-app

## Overview
      A production Next.js app with billing and AI-assisted product features.

## Features
- Server components, RSC streaming
- Stripe checkout
- Postgres with RLS

## Install / Setup
\`\`\`
pnpm install
cp .env.example .env.local
pnpm dev
\`\`\`

## Run tests
\`pnpm test\` — runs Vitest + Playwright smoke.

  ## Deploy
Vercel preview on PRs; production on merge to main. Rollback via Vercel UI.
`,
      'package.json': JSON.stringify({
        name: 'sample-nextjs-app',
        description: 'Production Next.js starter',
        scripts: {
          dev: 'next dev', build: 'next build', start: 'next start',
          test: 'vitest', lint: 'next lint', typecheck: 'tsc --noEmit',
        },
        dependencies: { next: '14.2.0', react: '18.3.0' },
        devDependencies: { typescript: '5.4.0', vitest: '1.6.0', '@playwright/test': '1.44.0' },
      }, null, 2),
      '.gitignore': 'node_modules\ndist\nbuild\n.next\n.env\n.env.local\ncoverage\nlogs\n',
      '.env.example': 'DATABASE_URL=\nSTRIPE_SECRET_KEY=\n',
      'CONTRIBUTING.md': '# Contributing\nUse feature branches; require 1 reviewer; CI must pass.',
    },
  };
  return buildReport(input);
}

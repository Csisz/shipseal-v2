import { buildReport } from '../readiness';
import type { Improvement, ReadinessReport, RepoScanInput } from '../types';

export const SAMPLE_PROJECT_REPO_INPUT: RepoScanInput = {
  repoName: 'customer-support-rag-assistant',
  source: { sourceType: 'zip-upload' },
  files: [
    { path: 'README.md', size: 5200 },
    { path: 'package.json', size: 1900 },
    { path: 'tsconfig.json', size: 640 },
    { path: 'vite.config.ts', size: 420 },
    { path: '.gitignore', size: 260 },
    { path: '.env.example', size: 360 },
    { path: 'CONTRIBUTING.md', size: 900 },
    { path: 'src/main.tsx', size: 800 },
    { path: 'src/App.tsx', size: 1600 },
    { path: 'src/lib/rag/retrieval.ts', size: 2200 },
    { path: 'src/lib/rag/guardrails.ts', size: 1800 },
    { path: 'src/lib/support/escalation.ts', size: 1200 },
    { path: 'src/components/AnswerDraft.tsx', size: 1400 },
    { path: 'src/test/retrieval.test.ts', size: 1100 },
    { path: 'src/test/guardrails.test.ts', size: 950 },
    { path: 'docs/architecture.md', size: 1600 },
    { path: 'docs/privacy-review-notes.md', size: 1000 },
    { path: '.github/workflows/ci.yml', size: 780 },
  ],
  textContents: {
    'README.md': `# Customer Support RAG Assistant

## Overview
Customer Support RAG Assistant helps support agents answer common customer questions using a curated knowledge base. It retrieves relevant articles, drafts a response, and routes uncertain or sensitive cases to human escalation.

## Features
- Knowledge-base retrieval for support answers
- Drafted customer-facing responses
- Human escalation for unclear, billing, account, or privacy-sensitive cases
- Synthetic test fixtures for retrieval quality

## Install
\`\`\`
npm install
cp .env.example .env.local
npm run dev
\`\`\`

## Run tests
\`\`\`
npm run test
npm run build
\`\`\`

## AI delivery notes
The app may be used in the EU and may process customer support context that includes personal data. Responses must be reviewed or escalated before being used for important account decisions.

## Known gaps before production
- Red-team documentation is incomplete.
- Transparency notice still needs legal/privacy review.
- MCP integration is a future option only and should stay disabled until governance is approved.
`,
    'package.json': JSON.stringify({
      name: 'customer-support-rag-assistant',
      description: 'Customer support RAG assistant with human escalation',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'vitest run',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        '@vitejs/plugin-react-swc': '^3.11.0',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        typescript: '^5.8.3',
        vitest: '^3.2.4',
        vite: '^5.4.19',
      },
    }, null, 2),
    '.gitignore': 'node_modules\ndist\nbuild\n.env\n.env.local\ncoverage\n',
    '.env.example': 'AI_PROVIDER=\nAI_MODEL=\nKNOWLEDGE_BASE_URL=\nSUPPORT_ESCALATION_EMAIL=\n',
    'CONTRIBUTING.md': '# Contributing\nUse feature branches, run tests before handoff, and require human review for customer-facing AI changes.',
    'docs/architecture.md': '# Architecture\nRAG retrieval reads approved knowledge-base content, then drafts support answers with escalation for sensitive cases.',
    'docs/privacy-review-notes.md': '# Privacy Review Notes\nCustomer support context may include personal data. Legal and privacy review is recommended before production rollout.',
  },
};

const SAMPLE_DELIVERY_IMPROVEMENTS: Improvement[] = [
  {
    id: 'sample.red_team_docs',
    title: 'Red-team documentation is incomplete',
    detail: 'The repository has basic tests, but it does not yet include a dedicated red-team prompt set for customer-facing AI support scenarios.',
    category: 'AI delivery governance',
  },
  {
    id: 'sample.transparency_notice',
    title: 'Transparency notice needs review',
    detail: 'The product generates user-facing AI answers and is used in the EU, so the transparency notice should be reviewed before client delivery.',
    category: 'AI Act readiness',
  },
  {
    id: 'sample.mcp_future',
    title: 'MCP is a later-stage opportunity',
    detail: 'MCP access should remain disabled until least-privilege tool boundaries and approval flows are agreed.',
    category: 'MCP governance',
  },
  {
    id: 'sample.legal_review',
    title: 'Legal review recommended',
    detail: 'The project may handle personal data and customer-facing AI output, so legal/privacy review is recommended before production use.',
    category: 'Client handoff',
  },
];

export function buildSampleProjectReadinessReport(): ReadinessReport {
  const report = buildReport(SAMPLE_PROJECT_REPO_INPUT);

  return {
    ...report,
    improvements: [
      ...report.improvements,
      ...SAMPLE_DELIVERY_IMPROVEMENTS,
    ],
    mcpReadiness: {
      ...report.mcpReadiness,
      summary: 'MCP is a future opportunity for this support workflow. Keep MCP disabled until governance, allowlists, and human approval are agreed.',
      riskFindings: [
        ...report.mcpReadiness.riskFindings,
        {
          title: 'MCP deferred until governance review',
          severity: 'Medium',
          description: 'The sample support assistant should not receive external tool access before least-privilege rules and approval paths are defined.',
          recommendation: 'Treat MCP as a later-stage enhancement and review MCP_TOOL_ALLOWLIST.md before enabling tools.',
        },
      ],
    },
  };
}

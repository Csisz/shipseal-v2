import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ResultWorkspace } from '@/components/agentready/ResultWorkspace';
import { buildReport } from '@/lib/readiness';
import {
  REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
  REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
  validateRepositoryProductIntelligence,
} from '@/lib/repositoryIntelligence';

const evidence = [
  { id: 'evidence:readme', path: 'README.md', confidence: 0.96, validationState: 'validated', assertionState: 'observed' },
  { id: 'evidence:app', path: 'src/App.tsx', confidence: 0.92, validationState: 'validated', assertionState: 'observed' },
];

// eslint-disable-next-line react-refresh/only-export-components -- shared only by development QA fixtures
export const futuresQaReport = buildReport({
  repoName: 'shipseal/futures-layout-qa',
  source: { sourceType: 'github-app', githubOwner: 'shipseal', githubRepo: 'futures-layout-qa', githubBranch: 'main' },
  files: [
    { path: 'README.md', size: 420 },
    { path: 'package.json', size: 310 },
    { path: 'src/App.tsx', size: 840 },
    { path: 'src/App.test.tsx', size: 460 },
    { path: '.github/workflows/ci.yml', size: 260 },
  ],
  textContents: {
    'README.md': '# Futures layout QA\n\nRepository intelligence and product planning workspace.',
    'package.json': JSON.stringify({ scripts: { test: 'vitest run', build: 'vite build' }, dependencies: { react: '^18.3.1' } }),
  },
});

const insight = (statement: string, inferenceLevel: 'observed' | 'inferred' = 'observed') => ({
  statement,
  inferenceLevel,
  evidenceIds: ['evidence:readme'],
});

function opportunity(id: string, title: string, origin: 'evidence-backed' | 'strategic' | 'exploratory', index: number, spatialStress = false) {
  const shortId = id.replace('op:', '');
  const generationTwo = spatialStress
    ? ['adaptive', 'collaborative', 'guided', 'integrated'].map(suffix => ({
      id: `${shortId}-${suffix}`,
      generation: 2 as const,
      title: `${title} ${suffix}`,
      description: `A parent-local ${suffix} pathway grounded in the selected direction.`,
      userValue: `Teams can inspect ${suffix} progress without losing the parent direction.`,
    }))
    : [
      { id: `${shortId}-adaptive`, generation: 2 as const, title: `${title} guidance`, description: 'Guidance adapts to the repository signals already observed.', userValue: 'Teams receive a more relevant next step.' },
      { id: `${shortId}-collaborative`, generation: 2 as const, title: `${title} collaboration`, description: 'Shared decisions connect this direction to team review.', userValue: 'Teams can coordinate the direction with less manual handoff.' },
    ];
  return {
    schemaVersion: REPOSITORY_PRODUCT_OPPORTUNITY_VERSION,
    id,
    title,
    opportunityStatement: `Extend the current repository workflow with ${title}.`,
    userValue: `${title} turns existing repository evidence into a clearer product decision.`,
    whyItFits: 'The current product already joins repository evidence, guided review, and future planning.',
    targetUsers: ['Repository teams'],
    evidenceIds: ['evidence:readme', 'evidence:app'],
    origin,
    inferenceLevel: origin === 'evidence-backed' ? 'evidence-linked' as const : origin === 'strategic' ? 'strategic-inference' as const : 'exploratory-inference' as const,
    strategicRationale: 'Open a continuing product workflow from the repository intelligence already available.',
    existingCapabilityIds: index % 2 === 0
      ? ['cap:repository-intelligence', 'cap:guided-review']
      : ['cap:repository-intelligence'],
    requiredNewCapabilities: [{ title: `${title} enabler`, rationale: `A bounded ${title.toLowerCase()} capability is required before this route can ship.` }],
    futureEvolutions: [
      ...generationTwo,
      ...generationTwo.flatMap((parent, parentIndex) => Array.from({ length: spatialStress ? 2 : 1 }, (_, childIndex) => ({
        id: `${shortId}-later-${parentIndex}-${childIndex}`,
        parentId: parent.id,
        generation: 3 as const,
        title: `${title} possibility ${parentIndex + 1}.${childIndex + 1}`,
        description: 'The local evolution opens a deeper coordinated product possibility.',
        userValue: 'Teams can inspect a longer horizon without losing its immediate parent.',
      }))),
    ],
    optionalSupportingOpportunityIds: [],
    knownConflicts: index === 5 ? ['Requires an explicit integration trust boundary before activation.'] : [],
    expectedImplementationAreas: [{ label: 'Product workspace', existingPath: 'src/App.tsx', evidenceIds: ['evidence:app'] }],
    changeWeight: index > 3 ? 'broad' as const : 'moderate' as const,
    impactBreadth: index > 2 ? 'cross-product' as const : 'workflow' as const,
    verificationConcept: `Verify the ${title} workflow against repository evidence.`,
    humanReviewRequirements: index === 3
      ? ['Security-sensitive workflow changes require qualified human approval before production verification.']
      : [],
    limitations: ['Proposed direction, not a current capability.'],
    providerConfidence: 0.9 - index * 0.02,
  };
}

// eslint-disable-next-line react-refresh/only-export-components -- shared only by development QA fixtures
export const futuresQaProductIntelligence = validateRepositoryProductIntelligence({
  sourceAnalysisFingerprint: 'analysis:futures-layout-qa',
  rawUnderstanding: {
    schemaVersion: REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
    productSummary: insight('A repository intelligence and product planning workspace.'),
    primaryUsers: [insight('Repository teams.', 'inferred')],
    primaryProblem: insight('Teams need to connect evidence to credible product directions.'),
    currentProductLoop: [insight('Read repository evidence.'), insight('Understand the project.'), insight('Choose future pathways.')],
    existingCapabilities: [
      { id: 'cap:repository-intelligence', title: 'Repository intelligence', description: 'The product turns repository evidence into guided decisions.', evidenceIds: ['evidence:readme', 'evidence:app'] },
      { id: 'cap:guided-review', title: 'Guided review', description: 'The product already supports evidence-backed review decisions.', evidenceIds: ['evidence:app'] },
    ],
    constraints: [insight('Imported code is never executed.')],
    businessModelClues: [],
    missingCapabilityAreas: [insight('Teams need deeper product evolution paths.', 'inferred')],
    providerConfidence: 0.94,
    limitations: [],
  },
  rawOpportunities: [
    opportunity('op:adaptive-guidance', 'Adaptive Repository Guidance', 'strategic', 0),
    opportunity('op:review-rooms', 'Collaborative Review Rooms', 'strategic', 1),
    opportunity('op:delivery-paths', 'Personalized Delivery Paths', 'evidence-backed', 2),
    opportunity('op:safety-coach', 'Safety Readiness Coach', 'evidence-backed', 3),
    opportunity('op:automation-studio', 'Workflow Automation Studio', 'evidence-backed', 4),
    opportunity('op:ecosystem-hub', 'Ecosystem Integration Hub', 'exploratory', 5),
  ],
  evidenceReferences: evidence,
  knownPaths: new Set(['README.md', 'src/App.tsx']),
  generatedLocale: 'en',
});

// eslint-disable-next-line react-refresh/only-export-components -- development-only dense spatial fixture
export const futuresSpatialQaProductIntelligence = validateRepositoryProductIntelligence({
  sourceAnalysisFingerprint: 'analysis:futures-spatial-qa',
  rawUnderstanding: {
    schemaVersion: REPOSITORY_PRODUCT_UNDERSTANDING_VERSION,
    productSummary: insight('A repository intelligence and product planning workspace.'),
    primaryUsers: [insight('Repository teams.', 'inferred')],
    primaryProblem: insight('Teams need to connect evidence to credible product directions.'),
    currentProductLoop: [insight('Read repository evidence.'), insight('Understand the project.'), insight('Choose future pathways.')],
    existingCapabilities: [
      { id: 'cap:repository-intelligence', title: 'Repository intelligence', description: 'The product turns repository evidence into guided decisions.', evidenceIds: ['evidence:readme', 'evidence:app'] },
      { id: 'cap:guided-review', title: 'Guided review', description: 'The product already supports evidence-backed review decisions.', evidenceIds: ['evidence:app'] },
    ],
    constraints: [insight('Imported code is never executed.')],
    businessModelClues: [],
    missingCapabilityAreas: [insight('Teams need deeper product evolution paths.', 'inferred')],
    providerConfidence: 0.94,
    limitations: [],
  },
  rawOpportunities: [
    opportunity('op:adaptive-guidance', 'Adaptive Repository Guidance', 'strategic', 0, true),
    opportunity('op:review-rooms', 'Collaborative Review Rooms', 'strategic', 1),
    opportunity('op:delivery-paths', 'Personalized Delivery Paths', 'evidence-backed', 2),
    opportunity('op:safety-coach', 'Safety Readiness Coach', 'evidence-backed', 3),
    opportunity('op:automation-studio', 'Workflow Automation Studio', 'evidence-backed', 4),
    opportunity('op:quality-radar', 'Repository Quality Radar', 'evidence-backed', 5),
    opportunity('op:ecosystem-hub', 'Ecosystem Integration Hub', 'exploratory', 6),
    opportunity('op:learning-network', 'Repository Learning Network', 'exploratory', 7),
  ],
  evidenceReferences: evidence,
  knownPaths: new Set(['README.md', 'src/App.tsx']),
  generatedLocale: 'en',
});

export default function RepositoryFuturesLayoutQa() {
  const productIntelligence = new URLSearchParams(window.location.search).get('spatialStress') === '1'
    ? futuresSpatialQaProductIntelligence
    : futuresQaProductIntelligence;
  return (
    <main className="min-h-screen bg-workspace text-foreground" data-testid="repository-futures-layout-qa">
      <div className="fixed bottom-3 right-3 z-[100]"><ThemeToggle /></div>
      <ResultWorkspace
        report={futuresQaReport}
        history={[]}
        onReset={() => undefined}
        onClearHistory={() => undefined}
        repositoryProductIntelligence={productIntelligence}
        repositoryProductIntelligenceStatus={{ state: 'enhanced', deepState: 'completed', message: 'Product opportunities enhanced.', retryable: false, providerId: 'qa-provider' }}
      />
    </main>
  );
}

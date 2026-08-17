import { useState } from 'react';
import { RepositoryFormation, type RepositoryFormationStage } from '@/components/agentready/RepositoryFormation';
import { ResultWorkspace } from '@/components/agentready/ResultWorkspace';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { futuresQaProductIntelligence, futuresQaReport } from './RepositoryFuturesLayoutQa';

type Step = { stage: RepositoryFormationStage; action: string };

const steps: Step[] = [
  { stage: 'reading', action: 'Reading repository evidence.' },
  { stage: 'understanding', action: 'Preparing repository and product understanding.' },
  { stage: 'directions', action: 'Validating seven grounded Product Future roots.' },
  { stage: 'pathways', action: 'Building future pathways · 0 of 3 pathway groups complete.' },
  { stage: 'pathways', action: 'Building future pathways · 1 of 3 pathway groups complete.' },
  { stage: 'pathways', action: 'Building future pathways · 2 of 3 pathway groups complete.' },
  { stage: 'pathways', action: 'Building future pathways · 3 of 3 pathway groups complete.' },
  { stage: 'workspace', action: 'Validated roots and expansions are preparing the workspace.' },
];

export default function RepositoryRootContractQa() {
  const [stepIndex, setStepIndex] = useState(0);
  const ready = stepIndex >= steps.length;
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  return (
    <main className="min-h-screen bg-workspace text-foreground" data-testid="repository-root-contract-qa">
      <div className="fixed bottom-3 left-3 z-[100] flex max-w-[calc(100vw-5rem)] items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <span data-testid="qa-root-count">{stepIndex >= 3 ? 'Accepted roots 7' : 'Roots fixture 7'}</span>
        {!ready ? (
          <button type="button" className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground" onClick={() => setStepIndex(index => index + 1)}>
            Advance controlled stage
          </button>
        ) : null}
      </div>
      <div className="fixed bottom-3 right-3 z-[100]"><ThemeToggle /></div>
      {ready ? (
        <ResultWorkspace
          report={futuresQaReport}
          history={[]}
          onReset={() => undefined}
          onClearHistory={() => undefined}
          repositoryProductIntelligence={futuresQaProductIntelligence}
          repositoryProductIntelligenceStatus={{ state: 'enhanced', deepState: 'completed', message: 'Seven roots and three pathway groups validated.', retryable: false, providerId: 'qa-provider' }}
        />
      ) : (
        <RepositoryFormation
          repositoryName="roots-contract-qa"
          stage={step.stage}
          title={step.stage === 'directions' ? 'Finding product directions' : step.stage === 'pathways' ? 'Building future pathways' : step.stage === 'workspace' ? 'Preparing your workspace' : step.stage === 'understanding' ? 'Understanding the project' : 'Reading repository'}
          action={step.action}
          fullScreen
          sourceLabel="Controlled roots contract"
        />
      )}
    </main>
  );
}

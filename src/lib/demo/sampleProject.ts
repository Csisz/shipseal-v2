import type { ProjectIntake } from '../intake';

export const SAMPLE_PROJECT_INTAKE: ProjectIntake = {
  projectName: 'Customer Support RAG Assistant',
  appDescription: 'AI assistant that answers customer support questions from a curated knowledge base and drafts responses for support workflows.',
  targetUsers: 'Customer support agents and end users who need product or account help.',
  aiUseCase: 'Retrieve relevant support knowledge, generate a clear answer, and escalate uncertain or sensitive cases to a human reviewer.',
  usedInEU: true,
  handlesPersonalData: true,
  generatesUserFacingContent: true,
  hasHumanApproval: true,
  aiProvider: 'OpenAI',
  modelName: 'gpt-4.1-mini',
  clientName: 'Acme Support Operations',
  agencyName: 'ShipSeal Demo Studio',
};

export const SAMPLE_PROJECT_PROFILE = {
  slug: 'customer-support-rag-assistant',
  summary: 'A realistic AI support app used to dogfood ShipSeal Delivery Pack quality.',
  strengths: [
    'README and setup instructions are present.',
    '.env.example exists for safe configuration handoff.',
    'Basic unit and retrieval tests are present.',
    'Human escalation is described for uncertain answers.',
  ],
  risks: [
    'Red-team documentation is incomplete.',
    'Transparency notice is not yet in the repository.',
    'MCP is only a future option and should not be enabled by default.',
    'Legal and privacy review is recommended before production use.',
  ],
} as const;

import type { AgentOperatingModeId } from '../types.js';
import { DEFAULT_AGENT_OPERATING_MODE, getAgentOperatingMode } from '../agentOperatingMode.js';
import { presentEvidenceReferences, renderEvidenceReferenceList } from './evidencePresentation.js';
import type {
  ExecutableFutureAgentTarget,
  ExecutableFuturePlan,
  ExecutableFuturePlanArea,
  ExecutableFuturePlanCapability,
} from './executableFuturePlan.js';

interface PromptContext {
  plan: ExecutableFuturePlan;
  modeId: AgentOperatingModeId;
  mode: ReturnType<typeof getAgentOperatingMode>;
  modeLabel: string;
  compact: boolean;
  reliability: boolean;
  existingAreas: ExecutableFuturePlanArea[];
  likelyAreas: ExecutableFuturePlanArea[];
  unresolvedCapabilities: ExecutableFuturePlanCapability[];
  evidenceLabels: string[];
}

interface PromptAdapter {
  label: string;
  render: (context: PromptContext) => string[];
}

const ADAPTERS: Record<ExecutableFutureAgentTarget, PromptAdapter> = {
  chatgpt: { label: 'ChatGPT', render: renderChatGptPrompt },
  codex: { label: 'OpenAI Codex', render: renderCodexPrompt },
  claude: { label: 'Claude', render: renderClaudePrompt },
  'claude-code': { label: 'Claude Code', render: renderClaudeCodePrompt },
  cursor: { label: 'Cursor', render: renderCursorPrompt },
  generic: { label: 'Other / Generic Agent', render: renderGenericPrompt },
};

export function executableFuturePromptAgentLabel(target: ExecutableFutureAgentTarget) {
  return ADAPTERS[target].label;
}

export function renderExecutableFutureAgentPrompt(
  plan: ExecutableFuturePlan,
  target: ExecutableFutureAgentTarget,
  modeId: AgentOperatingModeId = DEFAULT_AGENT_OPERATING_MODE,
) {
  const mode = getAgentOperatingMode(modeId);
  const context: PromptContext = {
    plan,
    modeId,
    mode,
    modeLabel: modeId === 'balanced-productivity' ? 'Balanced Productivity' : modeId === 'token-saver' ? 'Token Saver' : 'Maximum Reliability',
    compact: modeId === 'token-saver',
    reliability: modeId === 'maximum-reliability',
    existingAreas: plan.affectedRepositoryAreas.filter(area => area.kind === 'existing-repository-area'),
    likelyAreas: plan.affectedRepositoryAreas.filter(area => area.kind === 'likely-new-responsibility'),
    unresolvedCapabilities: plan.requiredCapabilities.filter(item => item.state !== 'satisfied'),
    evidenceLabels: unique(presentEvidenceReferences(plan.evidence.map(item => item.id), plan.evidence).map(item => item.label)),
  };
  return normalize(ADAPTERS[target].render(context)).join('\n');
}

function renderChatGptPrompt(context: PromptContext) {
  const { plan } = context;
  return [
    '# ChatGPT collaborative implementation brief',
    '',
    'Act as a planning and patch-authoring partner. No direct repository access is assumed. Use only this brief and attachments actually provided; ask for missing material before asserting exact edits.',
    '',
    ...section('Outcome to deliver', [plan.objective, `Primary Future: ${plan.primaryFuture.title}`, `User value: ${plan.primaryFuture.userValue}`, `Decision rationale: ${plan.primaryFuture.rationale}`, supportingFutureSummary(plan)]),
    ...section('Context packet and required attachments', [
      ...repositoryLines(context, context.reliability),
      ...bullets(context.evidenceLabels.length ? context.evidenceLabels : ['No repository attachment is identified by current evidence.']),
      '- Required attachments: applicable repository instructions plus every referenced source, configuration, and test file needed for the work.',
      '- If an attachment is missing, list it under Questions instead of guessing its contents.',
    ]),
    ...section('Ground truth and confidence boundaries', [...dependencyLines(context), ...areaLines(context), ...riskLines(context)]),
    ...section('Collaborative workflow', [
      '1. Restate the outcome and separate verified facts from assumptions.',
      '2. List only blocking questions or missing attachments.',
      '3. Propose the smallest dependency-ordered implementation approach:',
      ...stageLines(context, 'proposal'),
      '4. When evidence is sufficient, return patch-ready edits; otherwise return a file-by-file change specification.',
    ]),
    ...section('Review, safety, and verification', [...gateLines(context), ...verificationLines(context, !context.compact), ...safetyLines(context), ...modeLines(context)]),
    ...section('Response format', ['Return: Verified context; Assumptions; Questions; Proposed changes; Patch-ready edits or change specification; Verification; Human-review stops.', 'Do not claim code was inspected, changed, tested, or approved unless supplied evidence proves it.']),
  ];
}

function renderCodexPrompt(context: PromptContext) {
  const { plan } = context;
  return [
    '# OpenAI Codex execution task',
    '',
    `Mission: ${plan.objective}`,
    '',
    ...section('Working-tree scope', [...repositoryLines(context, context.reliability), `- Primary: ${plan.primaryFuture.title}`, `- Decision rationale: ${plan.primaryFuture.rationale}`, `- ${supportingFutureSummary(plan)}`, ...areaLines(context)]),
    ...section('Inspect before editing', [
      '- Verify the active repository and branch/ref; the working tree wins if it differs from this scan.',
      '- Read applicable AGENTS.md files and only the guidance, source, tests, and config needed for this task.',
      '- Use repository-native search to confirm every named path and related symbol before editing.',
      ...bullets(context.evidenceLabels),
      ...dependencyLines(context),
    ]),
    ...section('Execute in dependency order', stageLines(context, 'execution')),
    ...section('Acceptance checks', [...verificationLines(context, !context.compact), ...gateLines(context)]),
    ...section('Execution constraints', [...safetyLines(context), ...riskLines(context), ...modeLines(context)]),
    ...section('Final response', ['Report changed files, behavior implemented, commands run with results, skipped checks, review gates reached, and residual risks.', 'Keep progress updates concise and do not commit or push.']),
  ];
}

function renderClaudePrompt(context: PromptContext) {
  const { plan } = context;
  return [
    '# Claude structured implementation analysis',
    '',
    'No direct repository access is assumed. Reason from supplied context, make uncertainty explicit, and request missing files before producing exact code.',
    '',
    ...section('Decision context', [...repositoryLines(context, context.reliability), `- Selected decision: ${plan.primaryFuture.title}`, `- Intended value: ${plan.primaryFuture.userValue}`, `- Decision rationale: ${plan.primaryFuture.rationale}`, `- Objective: ${plan.objective}`, `- ${supportingFutureSummary(plan)}`]),
    ...section('Evidence and assumptions ledger', [...bullets(context.evidenceLabels.length ? context.evidenceLabels : ['No repository evidence attachment is identified.']), ...areaLines(context), ...riskLines(context), '- Classify every implementation claim as verified, inferred, or blocked by missing context.']),
    ...section('Dependency reasoning', [...dependencyLines(context), `- Unresolved sequence: ${context.unresolvedCapabilities.length ? context.unresolvedCapabilities.map(item => item.title).join(' → ') : 'No unresolved prerequisite is represented.'}`]),
    ...section('Implementation proposal', stageLines(context, 'reasoning')),
    ...section('Review decisions', [...gateLines(context), 'For each gate, state what evidence a qualified reviewer needs and stop before the gated action.']),
    ...section('Verification argument', verificationLines(context, true)),
    ...section('Constraints and requested response', [...safetyLines(context), ...modeLines(context), 'Return: assumptions ledger; dependency rationale; implementation proposal; review decisions; verification matrix; requested attachments.']),
  ];
}

function renderClaudeCodePrompt(context: PromptContext) {
  const { plan } = context;
  return [
    '# Claude Code repository task',
    '',
    `Implement ${plan.primaryFuture.title} while keeping the working tree, repository instructions, and review gates authoritative.`,
    '',
    ...section('Repository startup protocol', [
      ...repositoryLines(context, context.reliability),
      '1. Confirm repository access and working-tree state.',
      '2. Read CLAUDE.md and applicable AGENTS.md files before editing. If absent, continue with actual repository guidance.',
      '3. Inspect named areas, direct call sites, and related tests; broaden context only for a concrete dependency.',
      ...bullets(context.evidenceLabels),
    ]),
    ...section('Bounded task', [`- Objective: ${plan.objective}`, `- Primary Future: ${plan.primaryFuture.title} — ${plan.primaryFuture.userValue}`, `- Decision rationale: ${plan.primaryFuture.rationale}`, `- ${supportingFutureSummary(plan)}`, ...areaLines(context), ...dependencyLines(context)]),
    ...section('Checkpointed implementation', checkpointLines(context)),
    ...section('Verification checkpoints', [...verificationLines(context, !context.compact), ...gateLines(context), ...(context.reliability ? ['- Re-read the diff against CLAUDE.md/AGENTS.md and the selected Future before completion.'] : [])]),
    ...section('Stop conditions', [...safetyLines(context), ...riskLines(context), '- Stop if evidence contradicts the plan, a required file is absent, or a human-review gate is reached.']),
    ...section('Completion report', [...modeLines(context), 'Summarize the diff, checks, unresolved assumptions, and approvals still required.']),
  ];
}

function renderCursorPrompt(context: PromptContext) {
  const { plan } = context;
  const paths = context.existingAreas.map(area => area.path).filter((path): path is string => Boolean(path));
  return [
    '# Cursor targeted editing brief',
    '',
    `Workspace goal: ${plan.primaryFuture.title} — ${plan.primaryFuture.userValue}`,
    '',
    ...section('Open and locate', [
      ...repositoryLines(context, context.reliability),
      `- Start with evidence-backed paths: ${paths.length ? paths.join(', ') : 'No validated path supplied; use workspace search before opening an edit set.'}`,
      '- Read workspace rules, then use symbol/reference search to locate the smallest implementation seam and direct tests.',
      '- Do not index the whole repository. Expand from a targeted file only when imports, callers, or tests require it.',
      ...bullets(context.evidenceLabels),
    ]),
    ...section('Edit boundary', [`- Objective: ${plan.objective}`, `- Decision rationale: ${plan.primaryFuture.rationale}`, `- ${supportingFutureSummary(plan)}`, ...areaLines(context), ...dependencyLines(context)]),
    ...section('Incremental edit passes', cursorPassLines(context)),
    ...section('Focused test loop', [...verificationLines(context, !context.compact), '- After each coherent edit, inspect diagnostics and the diff before widening the change.', ...(context.reliability ? ['- Search affected references and run broader checks for shared or high-risk code.'] : [])]),
    ...section('Review and safety', [...gateLines(context), ...safetyLines(context), ...riskLines(context)]),
    ...section('Handoff', [...modeLines(context), 'Return edited files/symbols, check results, and remaining review decisions.']),
  ];
}

function renderGenericPrompt(context: PromptContext) {
  const { plan } = context;
  return [
    '# Portable implementation specification',
    '',
    'This specification is tool-neutral. First declare available capabilities; do not imply repository, shell, editor, network, or mutation access that has not been confirmed.',
    '',
    ...section('Required capabilities and inputs', [
      '- Required capabilities: read supplied context; preserve constraints; report uncertainty; produce a proposal or edits appropriate to confirmed tools.',
      '- Optional capabilities: repository search, file editing, and command execution only when the environment confirms them.',
      ...repositoryLines(context, context.reliability),
      ...bullets(context.evidenceLabels.length ? context.evidenceLabels : ['No repository evidence attachment is identified.']),
    ]),
    ...section('Implementation outcome', [plan.objective, `- Primary Future: ${plan.primaryFuture.title} — ${plan.primaryFuture.userValue}`, `- Decision rationale: ${plan.primaryFuture.rationale}`, `- ${supportingFutureSummary(plan)}`]),
    ...section('Dependency contract', dependencyLines(context)),
    ...section('Repository scope and missing context', [...areaLines(context), ...riskLines(context), '- Ask for any required instruction, source, configuration, or test file that is unavailable.']),
    ...section('Ordered work packages', stageLines(context, 'specification')),
    ...section('Acceptance and review contract', [...verificationLines(context, !context.compact), ...gateLines(context)]),
    ...section('Universal constraints', [...safetyLines(context), ...modeLines(context)]),
    ...section('Required output', ['State confirmed capabilities and missing inputs, then return the implementation result, verification evidence, unresolved assumptions, and human decisions still required.']),
  ];
}

function repositoryLines(context: PromptContext, fingerprints: boolean) {
  const { repository } = context.plan;
  return [
    `- Repository: ${repository.name}`,
    ...(repository.branch ? [`- Branch/ref: ${repository.branch}`] : []),
    `- Detected stack: ${repository.detectedStack}`,
    ...(repository.packageManager ? [`- Package manager: ${repository.packageManager}`] : []),
    `- Canonical plan: ${context.plan.fingerprint}`,
    ...(fingerprints ? [`- Scan evidence: ${repository.sourceScanFingerprint}`, `- Product intelligence: ${repository.sourceIntelligenceFingerprint}`] : []),
    `- Operating mode: ${context.modeLabel}`,
  ];
}

function supportingFutureSummary(plan: ExecutableFuturePlan) {
  return plan.supportingFutures.length
    ? `Supporting Futures: ${plan.supportingFutures.map(goal => `${goal.title} — ${goal.userValue}`).join('; ')}`
    : 'Supporting Futures: none selected; do not add supporting scope without explicit owner direction.';
}

function dependencyLines(context: PromptContext) {
  return context.plan.requiredCapabilities.length
    ? context.plan.requiredCapabilities.map(item => `- [${item.state}] ${item.title}: ${item.rationale}${item.humanReviewRequired ? ' Human review required.' : ''}`)
    : ['- No prerequisite capability is represented; do not infer one.'];
}

function areaLines(context: PromptContext) {
  const lines = [
    ...context.existingAreas.map(area => `- Evidence-backed existing area: ${area.path} (${area.label}).`),
    ...context.likelyAreas.map(area => `- Likely new responsibility: ${area.label}; no validated current path is asserted.`),
  ];
  return lines.length ? unique(lines) : ['- No affected repository path is asserted; locate one before proposing exact edits.'];
}

function riskLines(context: PromptContext) {
  const values = unique([...context.plan.risks.map(risk => risk.statement), ...context.plan.limitations]);
  return values.length ? bullets(values) : ['- No additional grounded risk or limitation is represented; ordinary implementation uncertainty remains.'];
}

function stageLines(context: PromptContext, style: 'proposal' | 'execution' | 'reasoning' | 'specification') {
  return context.plan.implementationStages.flatMap(stage => {
    const core = `${stage.order}. **${stage.title}** — ${stage.changes.join(' ')}`;
    if (context.compact) return [core];
    const lines = [core, `   ${style === 'reasoning' ? 'Dependency rationale' : 'Purpose'}: ${style === 'reasoning' ? stage.whyNow : stage.purpose}`, `   Done when: ${stage.completionCriteria.join(' ')}`];
    if (context.reliability) {
      const ids = new Set(stage.repositoryAreaIds);
      const areas = context.plan.affectedRepositoryAreas.filter(area => ids.has(area.id));
      lines.push(`   Scope: ${areas.length ? areas.map(areaText).join('; ') : 'No repository path asserted.'}`);
      lines.push(`   Evidence: ${renderEvidenceReferenceList(stage.evidenceIds, context.plan.evidence)}`);
    }
    return lines;
  });
}

function checkpointLines(context: PromptContext) {
  if (context.compact) {
    return context.plan.implementationStages.map(stage => `${stage.order}. **${stage.title}** — ${stage.changes.join(' ')}`);
  }
  return context.plan.implementationStages.flatMap(stage => [
    `### Checkpoint ${stage.order}: ${stage.title}`,
    ...bullets(stage.changes),
    `Exit condition: ${stage.completionCriteria.join(' ')}`,
    ...(context.reliability ? [`Evidence to re-check: ${renderEvidenceReferenceList(stage.evidenceIds, context.plan.evidence)}`] : []),
  ]);
}

function cursorPassLines(context: PromptContext) {
  if (context.compact) {
    return context.plan.implementationStages.map(stage => `${stage.order}. ${stage.title}: ${stage.changes.join(' ')}`);
  }
  return context.plan.implementationStages.map(stage => `${stage.order}. ${stage.title}: locate responsible symbols, apply the smallest coherent edit, then confirm ${stage.completionCriteria.join(' ')}`);
}

function gateLines(context: PromptContext) {
  return context.plan.reviewGates.length
    ? unique(context.plan.reviewGates.map(gate => `- STOP — ${gate.title}: ${gate.reason} A qualified reviewer must explicitly approve continuation.`))
    : ['- No explicit sensitive gate is represented; ordinary code review is still required.'];
}

function verificationLines(context: PromptContext, rationale: boolean) {
  return [
    ...context.plan.verificationPlan.checks.map(check => `- ${check.title}${check.command ? ` — \`${check.command}\`` : ''}${rationale ? `: ${check.rationale}` : ''}`),
    `- Completion rule: ${context.plan.verificationPlan.completionStatement}`,
  ];
}

function safetyLines(context: PromptContext) {
  return bullets(unique([
    ...context.plan.agentHandoffs.sharedRules,
    'Do not invent repository paths, capabilities, tests, evidence, or verification outcomes.',
    'Do not create or update branches, commits, pushes, pull requests, merges, releases, or deployments without explicit authorization.',
    'Preserve authentication, security, privacy, billing, compliance, deployment, data-handling, compatibility, scan/scoring, and export boundaries.',
    'Do not expand beyond the Primary Future and selected compatible supporting Futures.',
    'This is not legal advice.',
  ]));
}

function modeLines(context: PromptContext) {
  const rules = context.compact
    ? [...context.mode.rules.slice(0, 3), ...context.mode.verification.slice(0, 2)]
    : [...context.mode.rules, ...context.mode.verification];
  return [`- Agent Cost Optimizer mode: ${context.modeLabel} — ${context.mode.summary}`, ...bullets(unique(rules))];
}

function areaText(area: ExecutableFuturePlanArea) {
  return area.kind === 'existing-repository-area'
    ? `Existing repository area: ${area.path} (${area.label})`
    : `Likely new responsibility: ${area.label} — no validated current path is asserted`;
}

function section(title: string, lines: string[]) {
  return [`## ${title}`, '', ...lines, ''];
}

function bullets(values: string[]) {
  return values.map(value => `- ${value}`);
}

function unique(lines: string[]) {
  return [...new Set(lines.map(line => line.trim()).filter(Boolean))];
}

function normalize(lines: string[]) {
  const output: string[] = [];
  for (const line of lines) {
    const value = line.trimEnd();
    if (!value && !output.at(-1)) continue;
    output.push(value);
  }
  while (output.length && !output.at(-1)) output.pop();
  return [...output, ''];
}

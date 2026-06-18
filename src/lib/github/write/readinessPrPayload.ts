import type { ReadinessReport } from '@/lib/types';
import { buildSuggestedReadinessFixPack } from '@/lib/readinessFixPack';
import type { ReadinessFixPackFile } from '@/lib/readinessFixPack';
import { buildReadinessPrPlan } from '@/lib/readinessPr';
import { resolveDeliveryPackFocus } from '@/lib/deliveryPack/goalMapping';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import type { CreateGitHubAppReadinessPrPayload, CreateReadinessPrFilePayload, CreateReadinessPrPayload } from './types';

export const ACTIVE_CI_WORKFLOW_PATH = '.github/workflows/ci.yml';
export const EXAMPLE_CI_WORKFLOW_PATH = 'docs/shipseal/CI_QUALITY_GATE.example.yml';

export interface ReadinessPrPayloadInput {
  report: ReadinessReport;
  githubToken: string;
  owner?: string;
  repo?: string;
  baseBranch?: string;
  files?: ReadinessFixPackFile[];
  includeActiveWorkflow?: boolean;
  selectedPackages?: string[];
}

export function buildCreateReadinessPrPayload({
  report,
  githubToken,
  owner,
  repo,
  baseBranch,
  files: inputFiles,
  includeActiveWorkflow,
  selectedPackages,
}: ReadinessPrPayloadInput): CreateReadinessPrPayload {
  const repoInfo = inferGitHubRepo(report, owner, repo);
  const plan = buildReadinessPrPlan(selectedPackages);
  const files = readinessPrFiles(report, inputFiles, { includeActiveWorkflow, selectedPackages });

  return {
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    baseBranch: baseBranch || report.source.githubDefaultBranch || report.source.githubBranch || undefined,
    branchName: plan.branchName,
    prTitle: plan.title,
    prBody: buildReadinessPrBody(report, files, selectedPackages),
    files,
    githubToken,
  };
}

export function buildCreateGitHubAppReadinessPrPayload(input: {
  report: ReadinessReport;
  installationId: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  files?: ReadinessFixPackFile[];
  includeActiveWorkflow?: boolean;
  selectedPackages?: string[];
}): CreateGitHubAppReadinessPrPayload {
  const {
    report,
    installationId,
    owner,
    repo,
    baseBranch,
  } = input;
  const plan = buildReadinessPrPlan(input.selectedPackages);
  const files = readinessPrFiles(report, input.files, {
    includeActiveWorkflow: input.includeActiveWorkflow,
    selectedPackages: input.selectedPackages,
  });

  return {
    installationId,
    owner,
    repo,
    baseBranch: baseBranch || report.source.githubDefaultBranch || report.source.githubBranch || undefined,
    branchName: plan.branchName,
    prTitle: plan.title,
    prBody: buildReadinessPrBody(report, files, input.selectedPackages),
    files,
  };
}

export function readinessPrFiles(
  report: ReadinessReport,
  files?: ReadinessFixPackFile[],
  options: { includeActiveWorkflow?: boolean; selectedPackages?: string[] } = {}
): CreateReadinessPrFilePayload[] {
  return readinessPrPreviewFiles(files || buildSuggestedReadinessFixPack(report), options)
    .map<CreateReadinessPrFilePayload>(file => ({ path: file.path, content: file.content }));
}

export function readinessPrPreviewFiles(
  files: ReadinessFixPackFile[],
  options: { includeActiveWorkflow?: boolean; selectedPackages?: string[] } = {}
): ReadinessFixPackFile[] {
  const focus = resolveDeliveryPackFocus(options.selectedPackages);
  const allowedPaths = new Set(focus.readinessPrPaths);
  const order = new Map(focus.readinessPrPaths.map((path, index) => [path, index]));
  return files
    .map(file => mapPrFile(file, options.includeActiveWorkflow === true, allowedPaths))
    .filter((file): file is ReadinessFixPackFile => Boolean(file))
    .sort((a, b) => readinessPrOrder(a.path, order) - readinessPrOrder(b.path, order));
}

export function buildReadinessPrBody(report: ReadinessReport, files: CreateReadinessPrFilePayload[], selectedPackages: string[] = []) {
  const focus = resolveDeliveryPackFocus(selectedPackages);
  const plan = buildReadinessPrPlan(selectedPackages);
  const fileList = files.map(file => `- \`${file.path}\``).join('\n');
  const includesActiveWorkflow = files.some(file => file.path === ACTIVE_CI_WORKFLOW_PATH);
  return [
    plan.summary,
    '',
    `Selected package: ${focus.packageLabel}`,
    `Delivery Pack outputs: ${focus.generatedPaths.length}`,
    `PR safe subset: ${files.length}`,
    `Full package focus: ${focus.packageSummary}`,
    'This PR adds a safe reviewed subset of the selected ShipSeal package. The downloadable Delivery Pack contains the full package outputs.',
    `Readiness score: ${report.score}/100`,
    `Readiness status: ${report.level}`,
    `Repository scanned: ${report.repoName}`,
    '',
    'Files added:',
    fileList,
    '',
    'Why this helps:',
    `- Adds the repository-ready subset for the selected ${focus.packageLabel}.`,
    '- Keeps broader Delivery Pack outputs in the downloadable ZIP/report instead of writing every generated file into the repository.',
    '- Adds reviewable ShipSeal guidance without pushing directly to main.',
    '- Makes future ShipSeal scans more likely to detect readiness evidence for this goal.',
    '',
    'CI quality gate note:',
    includesActiveWorkflow
      ? `- This PR includes an active GitHub Actions workflow at \`${ACTIVE_CI_WORKFLOW_PATH}\` because active workflow inclusion was explicitly selected.`
      : `- ShipSeal provides the CI workflow recommendation as an example at \`${EXAMPLE_CI_WORKFLOW_PATH}\` by default.`,
    includesActiveWorkflow
      ? '- Review the workflow carefully before merging because GitHub Actions will run after it is installed.'
      : '- It is not installed as an active GitHub Actions workflow unless you explicitly choose to include the active workflow file.',
    includesActiveWorkflow
      ? '- If this repository uses different CI commands, adjust the workflow before merge.'
      : '- Review the example before copying it into `.github/workflows/`.',
    '',
    'Safety note:',
    plan.safetyNote,
    '',
    'Recommended manual review:',
    '- Review every generated file before merging.',
    '- Review the CI quality gate example before enabling it as an active workflow.',
    '- Adapt placeholders and ownership notes to the real team.',
    '',
    plan.expectedImpactNote,
  ].join('\n');
}

export function inferGitHubRepo(report: ReadinessReport, owner?: string, repo?: string) {
  if (owner && repo) return { owner, repo };
  if (report.source.githubOwner && report.source.githubRepo) {
    return { owner: report.source.githubOwner, repo: report.source.githubRepo };
  }
  if (report.source.sourceUrl) {
    try {
      const parsed = parseGitHubUrl(report.source.sourceUrl);
      return { owner: parsed.owner, repo: parsed.repo };
    } catch {
      // Fall through to empty values for UI validation.
    }
  }
  const nameParts = report.repoName.trim().split('/');
  if (nameParts.length === 2 && nameParts[0] && nameParts[1]) {
    return { owner: owner || nameParts[0], repo: repo || nameParts[1].replace(/\.git$/i, '') };
  }
  return { owner: owner || '', repo: repo || '' };
}

function isPrFile(path: string) {
  return [
    'AGENTS.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'docs/CRITICAL_FILES_POLICY.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/OWNERSHIP.md',
    'docs/HANDOFF_CHECKLIST.md',
    'docs/AGENT_CHANGE_POLICY.md',
    'docs/AI_ACT_READINESS_NOTES.md',
    EXAMPLE_CI_WORKFLOW_PATH,
    ACTIVE_CI_WORKFLOW_PATH,
  ].includes(path);
}

function mapPrFile(file: ReadinessFixPackFile, includeActiveWorkflow: boolean, allowedPaths: Set<string>): ReadinessFixPackFile | null {
  if (file.path === EXAMPLE_CI_WORKFLOW_PATH) {
    if (!allowedPaths.has(EXAMPLE_CI_WORKFLOW_PATH)) return null;
    if (!includeActiveWorkflow) return file;
    return {
      ...file,
      path: ACTIVE_CI_WORKFLOW_PATH,
      title: 'CI quality gate workflow',
      purpose: 'Install the recommended GitHub Actions quality gate as an active workflow.',
      whyUseful: 'Adds an active CI workflow after explicit human opt-in.',
      content: file.content.replace(
        /^# ShipSeal CI quality gate example\n# Documentation only: review before copying this file into \.github\/workflows\/ci\.yml\.\n\n/,
        ''
      ),
    };
  }
  if (file.path === ACTIVE_CI_WORKFLOW_PATH) {
    if (!allowedPaths.has(EXAMPLE_CI_WORKFLOW_PATH) && !allowedPaths.has(ACTIVE_CI_WORKFLOW_PATH)) return null;
    if (includeActiveWorkflow) return file;
    return {
      ...file,
      path: EXAMPLE_CI_WORKFLOW_PATH,
      title: 'CI quality gate example',
      purpose: 'Provide a recommended CI quality gate as documentation instead of installing an active GitHub Actions workflow by default.',
      whyUseful: 'Gives reviewers a safe workflow template to copy into .github/workflows/ only after human review.',
      content: [
        '# ShipSeal CI quality gate example',
        '# Documentation only: review before copying this file into .github/workflows/ci.yml.',
        '',
        file.content,
      ].join('\n'),
    };
  }
  return isPrFile(file.path) && allowedPaths.has(file.path) ? file : null;
}

function readinessPrOrder(path: string, order: Map<string, number>) {
  if (path === ACTIVE_CI_WORKFLOW_PATH) return order.get(EXAMPLE_CI_WORKFLOW_PATH) ?? Number.MAX_SAFE_INTEGER;
  return order.get(path) ?? Number.MAX_SAFE_INTEGER;
}

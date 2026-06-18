import type { ReadinessReport } from '@/lib/types';
import { buildSuggestedReadinessFixPack } from '@/lib/readinessFixPack';
import type { ReadinessFixPackFile } from '@/lib/readinessFixPack';
import { buildReadinessPrPlan } from '@/lib/readinessPr';
import { parseGitHubUrl } from '@/lib/github/parseGitHubUrl';
import type { CreateGitHubAppReadinessPrPayload, CreateReadinessPrFilePayload, CreateReadinessPrPayload } from './types';

export interface ReadinessPrPayloadInput {
  report: ReadinessReport;
  githubToken: string;
  owner?: string;
  repo?: string;
  baseBranch?: string;
  files?: ReadinessFixPackFile[];
}

export function buildCreateReadinessPrPayload({
  report,
  githubToken,
  owner,
  repo,
  baseBranch,
  files: inputFiles,
}: ReadinessPrPayloadInput): CreateReadinessPrPayload {
  const repoInfo = inferGitHubRepo(report, owner, repo);
  const plan = buildReadinessPrPlan();
  const files = readinessPrFiles(report, inputFiles);

  return {
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    baseBranch: baseBranch || report.source.githubDefaultBranch || report.source.githubBranch || undefined,
    branchName: plan.branchName,
    prTitle: plan.title,
    prBody: buildReadinessPrBody(report, files),
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
}): CreateGitHubAppReadinessPrPayload {
  const {
    report,
    installationId,
    owner,
    repo,
    baseBranch,
  } = input;
  const plan = buildReadinessPrPlan();
  const files = readinessPrFiles(report, input.files);

  return {
    installationId,
    owner,
    repo,
    baseBranch: baseBranch || report.source.githubDefaultBranch || report.source.githubBranch || undefined,
    branchName: plan.branchName,
    prTitle: plan.title,
    prBody: buildReadinessPrBody(report, files),
    files,
  };
}

export function readinessPrFiles(report: ReadinessReport, files?: ReadinessFixPackFile[]): CreateReadinessPrFilePayload[] {
  return (files || buildSuggestedReadinessFixPack(report))
    .filter(file => isPrFile(file.path))
    .map<CreateReadinessPrFilePayload>(file => ({ path: file.path, content: file.content }));
}

export function buildReadinessPrBody(report: ReadinessReport, files: CreateReadinessPrFilePayload[]) {
  const plan = buildReadinessPrPlan();
  const fileList = files.map(file => `- \`${file.path}\``).join('\n');
  return [
    plan.summary,
    '',
    `Readiness score: ${report.score}/100`,
    `Readiness status: ${report.level}`,
    `Repository scanned: ${report.repoName}`,
    '',
    'Files added:',
    fileList,
    '',
    'Why this helps:',
    '- Gives future AI coding agents repository-specific operating instructions.',
    '- Adds review, ownership, security, release, and CI guidance for safer handoff.',
    '- Makes future ShipSeal scans more likely to detect readiness evidence.',
    '',
    'Safety note:',
    plan.safetyNote,
    '',
    'Recommended manual review:',
    '- Review every generated file before merging.',
    '- Confirm CI/workflow changes are acceptable for this repository.',
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
    '.github/workflows/ci.yml',
  ].includes(path);
}

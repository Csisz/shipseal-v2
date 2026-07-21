import type { DeliveryPackFileKind } from '../deliveryPack/types';
import type {
  RepositoryOptimizationAction,
  RepositoryOptimizationConflict,
  RepositoryOptimizationManifest,
  RepositoryOptimizationPlan,
  RepositoryOptimizationPlanItem,
  RepositoryOptimizationReadiness,
} from './repositoryOptimizationPlan';
import { loadJSZip } from '../jszipLoader';

export type OptimizationApplyReadiness = 'ready' | 'review-required' | 'blocked';

export interface OptimizationPackFile {
  id: string;
  zipPath: string;
  prPath: string;
  generatedPath: string;
  destinationPath: string;
  kind: DeliveryPackFileKind | 'unknown';
  action: RepositoryOptimizationAction;
  readiness: RepositoryOptimizationReadiness;
  content: string;
  sourceItemId: string;
  contributingProposalIds: string[];
  conflicts: RepositoryOptimizationConflict[];
  includeInZip: boolean;
  includeInPr: boolean;
}

export interface OptimizationPackManifest {
  schemaVersion: 'shipseal.optimization-pack.v1';
  product: 'ShipSeal';
  repository: RepositoryOptimizationManifest['repository'];
  selectedDomains: RepositoryOptimizationManifest['selectedDomains'];
  selectedProposalIds: string[];
  artifactCount: number;
  filesIncludedInZip: Array<{
    zipPath: string;
    generatedPath: string;
    destinationPath: string;
    action: RepositoryOptimizationAction;
    readiness: RepositoryOptimizationReadiness;
    generatorId: string;
    contributingProposalIds: string[];
    evidenceReferences: string[];
    conflictNotes: string[];
  }>;
  blockedOrUnavailable: Array<{
    generatedPath: string;
    destinationPath: string;
    action: RepositoryOptimizationAction;
    readiness: RepositoryOptimizationReadiness;
    contributingProposalIds: string[];
    conflictNotes: string[];
  }>;
}

export interface OptimizationApplyInstruction {
  id: string;
  title: string;
  body: string;
}

export interface OptimizationPrPreviewFile {
  path: string;
  generatedPath: string;
  destinationPath: string;
  action: RepositoryOptimizationAction;
  readiness: RepositoryOptimizationReadiness;
  content: string;
  excerpt: string;
  conflictNotes: string[];
  contributingProposalIds: string[];
}

export interface OptimizationPrPreview {
  branchName: string;
  title: string;
  body: string;
  files: OptimizationPrPreviewFile[];
  blockedFiles: OptimizationPrPreviewFile[];
  reviewRequiredFiles: OptimizationPrPreviewFile[];
  canUseGitHubApp: boolean;
  unavailableReason?: string;
}

export interface OptimizationApplyPlan {
  id: string;
  modelVersion: 'optimization-apply-plan.v1';
  repositoryName: string;
  readiness: OptimizationApplyReadiness;
  files: OptimizationPackFile[];
  manifest: OptimizationPackManifest;
  applyInstructions: string;
  reviewNotes: string;
  prPreview: OptimizationPrPreview;
  summary: {
    selectedArtifactCount: number;
    zipFileCount: number;
    prFileCount: number;
    readyCount: number;
    reviewRequiredCount: number;
    blockedCount: number;
  };
}

export interface BuildOptimizationApplyPlanInput {
  githubAvailable?: boolean;
  githubUnavailableReason?: string;
}

export interface OptimizationPackZipFile {
  path: string;
  content: string;
}

export function buildOptimizationApplyPlan(
  plan: RepositoryOptimizationPlan,
  input: BuildOptimizationApplyPlanInput = {}
): OptimizationApplyPlan {
  const usedZipPaths = new Map<string, number>();
  const usedPrPaths = new Map<string, number>();
  const files = plan.items
    .map(item => packFileFor(item))
    .map(file => ({
      ...file,
      zipPath: file.includeInZip ? uniquePath(file.zipPath, usedZipPaths, file.generatedPath) : file.zipPath,
      prPath: file.includeInPr ? uniquePath(file.prPath, usedPrPaths, file.generatedPath) : file.prPath,
    }))
    .sort((left, right) => left.zipPath.localeCompare(right.zipPath));
  const manifest = buildOptimizationPackManifest(plan, files);
  const applyInstructions = buildApplyInstructions(plan, files);
  const reviewNotes = buildReviewNotes(plan, files);
  const prPreview = buildOptimizationPrPreview(plan, files, input);
  const blockedCount = plan.items.filter(item => item.readiness === 'blocked').length;
  const reviewRequiredCount = plan.items.filter(item => item.readiness === 'review-required').length;
  const readiness: OptimizationApplyReadiness = blockedCount > 0
    ? 'blocked'
    : reviewRequiredCount > 0
      ? 'review-required'
      : 'ready';

  return {
    id: `optimization-apply-plan:${stableId(plan.id)}`,
    modelVersion: 'optimization-apply-plan.v1',
    repositoryName: plan.repositoryName,
    readiness,
    files,
    manifest,
    applyInstructions,
    reviewNotes,
    prPreview,
    summary: {
      selectedArtifactCount: plan.items.length,
      zipFileCount: optimizationPackZipFiles({ files, manifest, applyInstructions, reviewNotes }).length,
      prFileCount: prPreview.files.length,
      readyCount: plan.items.filter(item => item.readiness === 'ready').length,
      reviewRequiredCount,
      blockedCount,
    },
  };
}

export function optimizationPackZipFiles(input: {
  files: OptimizationPackFile[];
  manifest: OptimizationPackManifest;
  applyInstructions: string;
  reviewNotes: string;
}): OptimizationPackZipFile[] {
  return [
    ...input.files
      .filter(file => file.includeInZip)
      .map(file => ({ path: file.zipPath, content: file.content })),
    { path: 'optimization-manifest.json', content: `${JSON.stringify(input.manifest, null, 2)}\n` },
    { path: 'APPLY_INSTRUCTIONS.md', content: input.applyInstructions },
    { path: 'REVIEW_NOTES.md', content: input.reviewNotes },
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export async function buildOptimizationPackZipBlob(applyPlan: OptimizationApplyPlan): Promise<Blob> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  for (const file of optimizationPackZipFiles(applyPlan)) {
    zip.file(file.path, file.content);
  }
  return zip.generateAsync({ type: 'blob' });
}

export function buildOptimizationPackZipFilename(repositoryName: string) {
  return `shipseal-optimization-pack-${stableId(repositoryName || 'repository')}.zip`;
}

function packFileFor(item: RepositoryOptimizationPlanItem): OptimizationPackFile {
  const includeInZip = item.readiness !== 'blocked' && Boolean(item.artifact.content);
  const zipRoot = item.readiness === 'ready' ? 'ready' : 'review-required';
  return {
    id: `optimization-pack-file:${stableId(item.artifact.path)}`,
    zipPath: `${zipRoot}/${item.artifact.repositoryDestinationPath}`,
    prPath: item.readiness === 'ready'
      ? item.artifact.repositoryDestinationPath
      : `shipseal-review/${item.artifact.repositoryDestinationPath}`,
    generatedPath: item.artifact.path,
    destinationPath: item.artifact.repositoryDestinationPath,
    kind: item.artifact.kind,
    action: item.artifact.action,
    readiness: item.readiness,
    content: item.artifact.content,
    sourceItemId: item.id,
    contributingProposalIds: item.proposalIds,
    conflicts: item.conflicts,
    includeInZip,
    includeInPr: item.readiness !== 'blocked' && Boolean(item.artifact.content),
  };
}

function buildOptimizationPackManifest(plan: RepositoryOptimizationPlan, files: OptimizationPackFile[]): OptimizationPackManifest {
  const itemById = new Map(plan.items.map(item => [item.id, item]));
  return {
    schemaVersion: 'shipseal.optimization-pack.v1',
    product: 'ShipSeal',
    repository: plan.manifest.repository,
    selectedDomains: plan.manifest.selectedDomains,
    selectedProposalIds: plan.manifest.selectedProposalIds,
    artifactCount: plan.items.length,
    filesIncludedInZip: files.filter(file => file.includeInZip).map(file => {
      const item = itemById.get(file.sourceItemId);
      return {
        zipPath: file.zipPath,
        generatedPath: file.generatedPath,
        destinationPath: file.destinationPath,
        action: file.action,
        readiness: file.readiness,
        generatorId: item?.artifact.generatorId || 'shipseal.delivery-pack.generator.v2',
        contributingProposalIds: file.contributingProposalIds,
        evidenceReferences: item?.evidenceReferences.map(evidence => evidence.detail ? `${evidence.label} - ${evidence.detail}` : evidence.label) || [],
        conflictNotes: conflictNotes(file.conflicts),
      };
    }),
    blockedOrUnavailable: files.filter(file => !file.includeInZip || file.readiness === 'blocked').map(file => ({
      generatedPath: file.generatedPath,
      destinationPath: file.destinationPath,
      action: file.action,
      readiness: file.readiness,
      contributingProposalIds: file.contributingProposalIds,
      conflictNotes: conflictNotes(file.conflicts),
    })),
  };
}

function buildApplyInstructions(plan: RepositoryOptimizationPlan, files: OptimizationPackFile[]) {
  const readyFiles = files.filter(file => file.readiness === 'ready');
  const reviewFiles = files.filter(file => file.readiness === 'review-required');
  const blockedFiles = files.filter(file => file.readiness === 'blocked');
  return [
    '# ShipSeal Optimization Pack - Apply Instructions',
    '',
    `Repository: ${plan.repositoryName}`,
    '',
    'Generated by ShipSeal for human review.',
    '',
    '## Safety boundary',
    '- ShipSeal did not execute repository code.',
    '- This ZIP did not change repository files.',
    '- Generated files must be reviewed before copying into the repository.',
    '- Verification requires a rescan after reviewed changes are merged.',
    '',
    '## Package contents',
    `- Ready create candidates: ${readyFiles.length}`,
    `- Review-required files: ${reviewFiles.length}`,
    `- Blocked or unavailable files: ${blockedFiles.length}`,
    '- `optimization-manifest.json` records selected artifacts, evidence and conflicts.',
    '- `REVIEW_NOTES.md` lists review-required and blocked items.',
    '',
    '## Manual git flow',
    '```bash',
    'git checkout -b shipseal/optimization-pack',
    '# copy selected files from this package into the repository after review',
    'git add ...',
    'git commit -m "Add ShipSeal optimization pack"',
    'git push origin shipseal/optimization-pack',
    '# open a Pull Request',
    '```',
    '',
    '## Copy guidance',
    ...readyFiles.map(file => `- Ready for package: copy \`${file.zipPath}\` to \`${file.destinationPath}\` after review.`),
    ...reviewFiles.map(file => `- Review required: inspect \`${file.zipPath}\` before deciding whether to merge into \`${file.destinationPath}\`.`),
    ...blockedFiles.map(file => `- Blocked: \`${file.generatedPath}\` was not included as a normal file. See REVIEW_NOTES.md.`),
    '',
    '## After copying reviewed files',
    '- Run the repository build, lint and test commands that are appropriate for this project.',
    '- Open a Pull Request for human review.',
    '- Rescan with ShipSeal after merge to verify whether repository evidence changed.',
    '',
  ].join('\n');
}

function buildReviewNotes(plan: RepositoryOptimizationPlan, files: OptimizationPackFile[]) {
  const lines = [
    '# ShipSeal Optimization Pack - Review Notes',
    '',
    `Repository: ${plan.repositoryName}`,
    '',
    'These notes explain selected, review-required and blocked Optimization Plan artifacts. No repository files have been changed.',
    '',
  ];

  for (const file of files) {
    lines.push(`## ${file.generatedPath}`, '');
    lines.push(`- Action: ${file.action}`);
    lines.push(`- Destination: ${file.destinationPath}`);
    lines.push(`- Package path: ${file.includeInZip ? file.zipPath : 'not included as a normal file'}`);
    lines.push(`- Readiness: ${file.readiness}`);
    lines.push(`- Contributing proposals: ${file.contributingProposalIds.join(', ')}`);
    const notes = conflictNotes(file.conflicts);
    if (notes.length) {
      lines.push('- Review notes:');
      for (const note of notes) lines.push(`  - ${note}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildOptimizationPrPreview(
  plan: RepositoryOptimizationPlan,
  files: OptimizationPackFile[],
  input: BuildOptimizationApplyPlanInput
): OptimizationPrPreview {
  const prFiles = files.filter(file => file.includeInPr).map(file => ({
    path: file.prPath,
    generatedPath: file.generatedPath,
    destinationPath: file.destinationPath,
    action: file.action,
    readiness: file.readiness,
    content: file.content,
    excerpt: excerptFor(file.content),
    conflictNotes: conflictNotes(file.conflicts),
    contributingProposalIds: file.contributingProposalIds,
  }));
  const blockedFiles = files.filter(file => file.readiness === 'blocked').map(file => ({
    path: file.prPath,
    generatedPath: file.generatedPath,
    destinationPath: file.destinationPath,
    action: file.action,
    readiness: file.readiness,
    content: '',
    excerpt: '',
    conflictNotes: conflictNotes(file.conflicts),
    contributingProposalIds: file.contributingProposalIds,
  }));
  const reviewRequiredFiles = prFiles.filter(file => file.readiness === 'review-required');
  const title = 'Add ShipSeal optimization pack';

  return {
    branchName: 'shipseal/optimization-pack',
    title,
    body: buildPrBody(plan, prFiles, reviewRequiredFiles, blockedFiles),
    files: prFiles,
    blockedFiles,
    reviewRequiredFiles,
    canUseGitHubApp: input.githubAvailable === true && prFiles.length > 0,
    unavailableReason: input.githubAvailable === true
      ? prFiles.length === 0 ? 'No PR-ready files are selected. Remove blocked items or download the ZIP for manual review.' : undefined
      : input.githubUnavailableReason || 'Connect GitHub and scan a selected repository to create this PR through the GitHub App.',
  };
}

function buildPrBody(
  plan: RepositoryOptimizationPlan,
  files: OptimizationPrPreviewFile[],
  reviewRequiredFiles: OptimizationPrPreviewFile[],
  blockedFiles: OptimizationPrPreviewFile[]
) {
  return [
    `ShipSeal prepared an Optimization Pack for ${plan.repositoryName}.`,
    '',
    'This PR contains selected generator-backed artifacts from the Optimization Plan. ShipSeal did not execute repository code and did not verify improvements. Rescan after the PR is merged.',
    '',
    'Files prepared:',
    ...files.map(file => `- \`${file.path}\` (${file.action}, destination: \`${file.destinationPath}\`, readiness: ${file.readiness})`),
    '',
    'Review-required files:',
    ...(reviewRequiredFiles.length ? reviewRequiredFiles.map(file => `- \`${file.path}\`: human review required before merging into \`${file.destinationPath}\`.`) : ['- None']),
    '',
    'Blocked or unavailable files:',
    ...(blockedFiles.length ? blockedFiles.map(file => `- \`${file.generatedPath}\`: ${file.conflictNotes.join('; ') || 'blocked'}`) : ['- None']),
    '',
    'Manual fallback:',
    '- Download the Optimization Pack ZIP.',
    '- Review APPLY_INSTRUCTIONS.md and REVIEW_NOTES.md.',
    '- Copy selected files into a branch and open a Pull Request.',
    '',
    'Safety note: ShipSeal will not push directly to main. Human review is required.',
  ].join('\n');
}

function conflictNotes(conflicts: RepositoryOptimizationConflict[]) {
  return conflicts.map(conflict => conflict.explanation);
}

function excerptFor(content: string) {
  return content.split('\n').slice(0, 18).join('\n').trim().slice(0, 1200);
}

function stableId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    || 'repository';
}

function uniquePath(path: string, used: Map<string, number>, seed: string) {
  const normalized = path.replace(/\\/g, '/');
  const count = used.get(normalized) || 0;
  if (count === 0) {
    used.set(normalized, 1);
    return normalized;
  }

  let candidate = pathWithSuffix(normalized, stablePathSuffix(seed));
  let suffix = count + 1;
  while (used.has(candidate)) {
    candidate = pathWithSuffix(normalized, `${stablePathSuffix(seed)}-${suffix}`);
    suffix += 1;
  }
  used.set(normalized, count + 1);
  used.set(candidate, 1);
  return candidate;
}

function stablePathSuffix(value: string) {
  return stableId(value)
    .replace(/[/.]+/g, '-')
    .replace(/-md$/i, '')
    .replace(/^-+|-+$/g, '')
    || 'duplicate';
}

function pathWithSuffix(path: string, suffix: string) {
  const slashIndex = path.lastIndexOf('/');
  const directory = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : '';
  const filename = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return `${directory}${filename}-${suffix}`;
  return `${directory}${filename.slice(0, dotIndex)}-${suffix}${filename.slice(dotIndex)}`;
}

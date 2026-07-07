import type { ReadinessReport } from '../types';

export type IntelligenceRevealSignalKind = 'evidence' | 'heuristic';

export interface IntelligenceRevealSignal {
  id: 'structure' | 'architecture' | 'documentation' | 'projectMemory' | 'verification' | 'context' | 'developerWorkflow';
  label: string;
  category: string;
  evidence: string[];
  connection: string;
  kind: IntelligenceRevealSignalKind;
}

export interface IntelligenceRevealModel {
  repositoryName: string;
  sourceLabel: string;
  stackLabel: string;
  primaryMessage: string;
  signals: IntelligenceRevealSignal[];
}

export const INTELLIGENCE_REVEAL_TOTAL_MS = 4600;
export const INTELLIGENCE_REVEAL_REDUCED_MOTION_MS = 900;

export function buildIntelligenceRevealModel(report: ReadinessReport): IntelligenceRevealModel {
  const files = normalizedReportFiles(report);
  const keyFolders = uniqueStrings([...(report.summary.keyFolders || []), ...(report.repoContextPack.keyFolders || [])]);
  const instructionFiles = uniqueStrings([...(report.summary.instructionFiles || []), ...(report.repoContextPack.existingInstructionFiles || [])]);
  const documentationFiles = firstMatchingFiles(files, [/(\b|\/)readme(\.md)?$/i, /(^|\/)docs\//i, /architecture/i], 3);
  const architectureFiles = firstMatchingFiles(files, [/architecture/i, /(^|\/)(app|src|lib|components|pages)\//i], 3);
  const testFiles = firstMatchingFiles(files, [/(\.|-)(test|spec)\.[cm]?[jt]sx?$/i, /(^|\/)(tests?|__tests__)\//i, /playwright/i], 3);
  const ciFiles = firstMatchingFiles(files, [/(^|\/)\.github\/workflows\//i, /gitlab-ci/i, /circleci/i], 2);
  const ignoredFolders = uniqueStrings([...(report.scanSummary.ignoredGeneratedFolders || []), ...(report.repoContextPack.ignoredFolders || [])]);
  const runCommands = report.stack.runCommands || [];

  const candidates: IntelligenceRevealSignal[] = [
    {
      id: 'structure',
      label: 'Structure',
      category: 'Repository identity',
      evidence: compactText([
        report.scanEvidence.analyzedFileCount ? `${report.scanEvidence.analyzedFileCount.toLocaleString()} files analyzed` : '',
        ...keyFolders.slice(0, 3).map(folder => `${folder}/`),
      ]),
      connection: keyFolders.length ? 'Key folders became the first repository map.' : 'Scan counts define the first repository boundary.',
      kind: 'evidence',
    },
    {
      id: 'architecture',
      label: 'Architecture',
      category: 'Project shape',
      evidence: compactText([
        report.stack.primary && report.stack.primary !== 'Unknown' ? `Stack: ${report.stack.primary}` : '',
        ...architectureFiles,
        ...keyFolders.slice(0, 2).map(folder => `Folder: ${folder}/`),
      ]),
      connection: 'Stack and source boundaries connect to the repository model.',
      kind: architectureFiles.length || keyFolders.length || report.stack.primary !== 'Unknown' ? 'evidence' : 'heuristic',
    },
    {
      id: 'documentation',
      label: 'Documentation',
      category: 'Onboarding surface',
      evidence: documentationFiles.length
        ? documentationFiles
        : healthSignalEvidence(report, ['readme', 'documentation', 'docs']).slice(0, 2),
      connection: 'Documentation becomes the entry point for understanding.',
      kind: documentationFiles.length || report.scanEvidence.keyFilesFound.readme ? 'evidence' : 'heuristic',
    },
    {
      id: 'projectMemory',
      label: 'Project Memory',
      category: 'AI instructions',
      evidence: instructionFiles.length
        ? instructionFiles.slice(0, 3)
        : healthSignalEvidence(report, ['instruction', 'agent', 'memory']).slice(0, 2),
      connection: instructionFiles.length ? 'Agent instructions connect memory to source work.' : 'Missing memory is carried forward as an improvement signal.',
      kind: instructionFiles.length || report.scanEvidence.keyFilesFound.agentInstructions || report.scanEvidence.keyFilesFound.claudeInstructions ? 'evidence' : 'heuristic',
    },
    {
      id: 'verification',
      label: 'Verification',
      category: 'Tests and confidence',
      evidence: compactText([
        ...testFiles,
        ...report.stack.testFrameworks.map(framework => `Framework: ${framework}`),
        ...runCommands.filter(command => /test|lint|typecheck/i.test(`${command.label} ${command.cmd}`)).slice(0, 2).map(command => `${command.label}: ${command.cmd}`),
      ]),
      connection: 'Verification signals connect source changes to safe checks.',
      kind: testFiles.length || report.stack.testFrameworks.length || report.scanEvidence.keyFilesFound.tests ? 'evidence' : 'heuristic',
    },
    {
      id: 'context',
      label: 'Context',
      category: 'Compression',
      evidence: compactText([
        ...ignoredFolders.slice(0, 3).map(folder => `Ignored: ${folder}`),
        report.scanSummary.generatedVendorFilesIgnored ? `${report.scanSummary.generatedVendorFilesIgnored.toLocaleString()} generated/vendor files ignored` : '',
        report.scanEvidence.keyFilesFound.gitignore ? '.gitignore found' : '',
      ]),
      connection: 'Generated and vendor context is separated from useful workspace memory.',
      kind: ignoredFolders.length || report.scanSummary.generatedVendorFilesIgnored || report.scanEvidence.keyFilesFound.gitignore ? 'evidence' : 'heuristic',
    },
    {
      id: 'developerWorkflow',
      label: 'Developer Workflow',
      category: 'Commands and CI',
      evidence: compactText([
        ...ciFiles,
        ...runCommands.slice(0, 3).map(command => `${command.label}: ${command.cmd}`),
      ]),
      connection: 'Commands and automation become the workspace operating path.',
      kind: ciFiles.length || runCommands.length || report.scanEvidence.keyFilesFound.ciConfig ? 'evidence' : 'heuristic',
    },
  ];

  const signals = candidates
    .filter(signal => signal.evidence.length > 0)
    .slice(0, 6);

  if (signals.length < 4) {
    const fallbackSignals = candidates
      .filter(signal => !signals.some(existing => existing.id === signal.id))
      .map(signal => ({
        ...signal,
        evidence: signal.evidence.length ? signal.evidence : fallbackEvidenceFor(signal.id, report),
        kind: 'heuristic' as const,
      }))
      .filter(signal => signal.evidence.length > 0);
    signals.push(...fallbackSignals.slice(0, 4 - signals.length));
  }

  return {
    repositoryName: report.repoName,
    sourceLabel: sourceLabel(report),
    stackLabel: report.stack.primary && report.stack.primary !== 'Unknown' ? report.stack.primary : report.summary.detectedStack || 'Stack not detected',
    primaryMessage: 'Understanding repository structure',
    signals: signals.slice(0, 6),
  };
}

function normalizedReportFiles(report: ReadinessReport) {
  return uniqueStrings([
    ...report.sampleFiles.map(file => file.path),
    ...report.repoContextPack.sampleFiles,
    ...report.summary.instructionFiles,
    ...report.repoContextPack.existingInstructionFiles,
  ].map(normalizePath));
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function firstMatchingFiles(files: string[], patterns: RegExp[], limit: number) {
  return files.filter(path => patterns.some(pattern => pattern.test(path))).slice(0, limit);
}

function healthSignalEvidence(report: ReadinessReport, terms: string[]) {
  const signals = [
    ...report.repositoryHealth.dimensions.repositoryIntelligence.signals,
    ...report.repositoryHealth.dimensions.aiDevelopmentReadiness.signals,
    ...report.repositoryHealth.dimensions.agentRouting.signals,
    ...report.repositoryHealth.dimensions.contextWaste.signals,
  ];
  return compactText(signals
    .filter(signal => textMatchesTerms(`${signal.id} ${signal.label}`, terms))
    .flatMap(signal => signal.evidence || [])
  );
}

function textMatchesTerms(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some(term => normalized.includes(term.toLowerCase()));
}

function compactText(items: string[]) {
  return uniqueStrings(items.map(item => item.trim()).filter(Boolean));
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items));
}

function fallbackEvidenceFor(id: IntelligenceRevealSignal['id'], report: ReadinessReport) {
  switch (id) {
    case 'structure':
      return [`${report.scanSummary.totalFilesFound.toLocaleString()} files discovered`];
    case 'architecture':
      return report.stack.languages.length ? [`Languages: ${report.stack.languages.slice(0, 3).join(', ')}`] : [];
    case 'documentation':
      return healthSignalEvidence(report, ['readme', 'documentation']).slice(0, 1);
    case 'projectMemory':
      return healthSignalEvidence(report, ['instruction', 'agent']).slice(0, 1);
    case 'verification':
      return healthSignalEvidence(report, ['test', 'build', 'command']).slice(0, 1);
    case 'context':
      return [`${report.scanSummary.filesIgnored.toLocaleString()} files ignored during scan`];
    case 'developerWorkflow':
      return Object.keys(report.stack.scripts || {}).slice(0, 3).map(script => `Script: ${script}`);
    default:
      return [];
  }
}

function sourceLabel(report: ReadinessReport) {
  if (report.scanEvidence.sourceType === 'github-app') return 'Connected GitHub repository';
  if (report.scanEvidence.sourceType === 'public-github') return 'Public GitHub repository';
  if (report.source.sourceType === 'github-app') return 'Connected GitHub repository';
  if (report.source.sourceType === 'github-public' || report.source.sourceType === 'github-url') return 'Public GitHub repository';
  return 'ZIP upload';
}

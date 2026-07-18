import * as ts from 'typescript';
import { classifyRepositoryFile, isDocumentationPath, isInstructionPath } from '../repositoryHealth/classifyFiles';
import { isBinaryLikePath, isGeneratedOrVendorPath, normalizeZipPath } from '../scannerLimits';
import { detectEntryPointClassification } from '../sourceDetection';
import { detectStack } from '../stack';
import type { DetectedStack, RepoFileSummary, RepoScanInput } from '../types';
import {
  REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  REPOSITORY_INTELLIGENCE_EXTRACTOR,
  createRepositoryEvidence,
  createRepositoryRelationshipId,
  parentRepositoryFolder,
  type EvidenceRelationshipReference,
  type FileResponsibilityRecord,
  type FolderResponsibilityRecord,
  type RepositoryEvidence,
  type RepositoryEvidenceDraft,
  type RepositoryEvidenceSourceType,
  type RepositoryIntelligenceEvidenceModel,
  type RepositoryRelationship,
  type RepositoryRelationshipType,
  type RepositoryResponsibility,
  type RepositorySymbol,
  type RepositorySymbolKind,
} from './evidence';

const JS_TS_RE = /\.(?:[cm]?[jt]sx?)$/i;
const TEST_RE = /(^|\/)(?:__tests__|tests?|specs?|e2e)(\/|$)|(?:\.|-)(?:test|spec)\.[cm]?[jt]sx?$/i;
const FIXTURE_RE = /(^|\/)(?:fixtures?|__fixtures__)(\/|$)/i;
const BUILD_CONFIG_RE = /(^|\/)(?:vite|next|webpack|rollup|esbuild|babel|postcss|tailwind)\.config\.[cm]?[jt]s$/i;
const TEST_CONFIG_RE = /(^|\/)(?:vitest|jest|playwright|cypress)\.config\.[cm]?[jt]s$/i;
const CONFIG_RE = /(^|\/)(?:package\.json|tsconfig(?:\.[^/]+)?\.json|jsconfig\.json|eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.[^/]+)?|\.gitignore)$/i;
const ENV_TEMPLATE_RE = /(^|\/)\.env(?:\.[^/]+)?\.(?:example|sample|template)$/i;
const AGENT_INSTRUCTION_RE = /(^|\/)(?:AGENTS\.md|CLAUDE\.md|CODEX\.md|\.cursorrules|\.cursor\/rules(?:\/.*)?)$/i;
const SECRET_ASSIGNMENT_RE = /(?:api[_-]?key|token|secret|password|private[_-]?key)\s*[:=]/i;
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'] as const;

interface ParsedModule {
  symbols: RepositorySymbol[];
  modules: Array<{ specifier: string; reexport: boolean }>;
  hasDefaultExport: boolean;
  hasJsx: boolean;
  expressRouteSignal: boolean;
  externalModules: string[];
  routeExportNames: string[];
  parseFailure?: string;
}

interface MutableFileRecord extends FileResponsibilityRecord {
  pendingModules?: ParsedModule['modules'];
  classificationEvidenceId?: string;
  parsed?: ParsedModule;
}

interface Classification {
  primary: RepositoryResponsibility;
  secondary: RepositoryResponsibility[];
  confidence: number;
  limitations: string[];
  fact: string;
}

export function buildRepositoryIntelligenceEvidence(input: RepoScanInput): RepositoryIntelligenceEvidenceModel {
  const normalizedInput = normalizeInput(input);
  const stack = detectStack(normalizedInput);
  const supportedFrameworks = validateFrameworkSignals(normalizedInput, stack);
  const entryPoints = detectEntryPointClassification(normalizedInput);
  const allPaths = new Set(normalizedInput.files.filter(file => !file.isDir).map(file => file.path));
  const evidence: RepositoryEvidence[] = [];
  const relationships: RepositoryRelationship[] = [];
  const modelLimitations = new Set<string>();
  const files: MutableFileRecord[] = [];

  addManifestEvidence(normalizedInput, evidence, modelLimitations);

  for (const file of normalizedInput.files.filter(file => !file.isDir)) {
    const record = analyzeFile(file, normalizedInput, supportedFrameworks, entryPoints, evidence);
    files.push(record);
  }

  for (const record of files) {
    if (!record.pendingModules?.length) continue;
    for (const pending of record.pendingModules) {
      if (!pending.specifier.startsWith('.')) continue;
      const targetPath = resolveLocalModule(record.path, pending.specifier, allPaths);
      if (!targetPath) {
        record.limitations.push(`Local module target could not be resolved: ${pending.specifier}`);
        continue;
      }

      const baseType: RepositoryRelationshipType = pending.reexport ? 'exports-through' : 'imports';
      addRelationshipEvidence(record, targetPath, baseType, evidence, relationships);
      if (TEST_RE.test(record.path) || FIXTURE_RE.test(record.path)) {
        addRelationshipEvidence(record, targetPath, 'tests', evidence, relationships);
      }
      if (record.primaryResponsibility === 'application-entry-point' || record.secondaryResponsibilities.includes('framework-bootstrap')) {
        addRelationshipEvidence(record, targetPath, 'entry-point-loads', evidence, relationships);
      }
    }
  }

  for (const record of files) {
    if (record.primaryResponsibility === 'ai-agent-instruction') {
      addRelationshipEvidence(record, record.folderPath, 'provides-agent-instructions-for', evidence, relationships);
    } else if (record.primaryResponsibility === 'documentation' && /(^|\/)README(?:\.md)?$/i.test(record.path)) {
      addRelationshipEvidence(record, record.folderPath, 'documents', evidence, relationships);
    } else if (['configuration', 'build-configuration', 'test-configuration'].includes(record.primaryResponsibility)) {
      addRelationshipEvidence(record, record.folderPath, 'configures', evidence, relationships);
    } else if (['route-or-page', 'layout', 'api-route-or-request-handler'].includes(record.primaryResponsibility)) {
      addRelationshipEvidence(record, record.folderPath, 'route-belongs-to', evidence, relationships);
    }
  }

  const folders = aggregateFolders(files, evidence, relationships);
  const evidenceById = new Set(evidence.map(item => item.id));
  const dedupedRelationships = deduplicateRelationships(relationships).map(relationship => ({
    ...relationship,
    supportingEvidenceIds: relationship.supportingEvidenceIds.filter(id => evidenceById.has(id)).sort(),
  }));
  const relationshipsByPath = new Map<string, RepositoryRelationship[]>();
  for (const relationship of dedupedRelationships) {
    if (!relationshipsByPath.has(relationship.sourcePath)) relationshipsByPath.set(relationship.sourcePath, []);
    relationshipsByPath.get(relationship.sourcePath)!.push(relationship);
  }
  for (const record of files) {
    record.relationships = [...(relationshipsByPath.get(record.path) || [])].sort(compareRelationships);
    record.supportingEvidenceIds = sortedUnique(record.supportingEvidenceIds);
    record.limitations = sortedUnique(record.limitations);
    delete record.pendingModules;
    delete record.classificationEvidenceId;
    delete record.parsed;
  }

  if (normalizedInput.scanSummary?.limited) {
    modelLimitations.add(normalizedInput.scanSummary.limitationReason || 'The scan was limited; repository evidence is incomplete.');
  }
  for (const warning of normalizedInput.scanSummary?.warnings || []) modelLimitations.add(warning);
  for (const record of files.filter(item => item.extractionState === 'parse-failed')) {
    modelLimitations.add(`Parser fallback used for ${record.path}.`);
  }

  const finalEvidence = deduplicateEvidence(evidence);
  const finalFiles = files.sort((left, right) => left.path.localeCompare(right.path));
  const finalFolders = folders.sort((left, right) => left.path.localeCompare(right.path));
  const finalRelationships = dedupedRelationships.sort(compareRelationships);
  const limitations = [...modelLimitations].sort();

  return {
    schemaVersion: REPOSITORY_EVIDENCE_SCHEMA_VERSION,
    evidence: finalEvidence,
    files: finalFiles,
    folders: finalFolders,
    relationships: finalRelationships,
    limitations,
    summary: {
      eligibleJsTsFiles: finalFiles.filter(file => JS_TS_RE.test(file.path) && file.extractionState !== 'excluded').length,
      parsedFiles: finalFiles.filter(file => file.extractionState === 'parsed').length,
      conservativelyClassifiedFiles: finalFiles.filter(file => file.primaryResponsibility !== 'unknown-or-insufficient-evidence' && file.extractionState !== 'excluded').length,
      unknownFiles: finalFiles.filter(file => file.primaryResponsibility === 'unknown-or-insufficient-evidence' && file.extractionState !== 'excluded').length,
      parseFailures: finalFiles.filter(file => file.extractionState === 'parse-failed').length,
      excludedGeneratedFiles: finalFiles.filter(file => file.primaryResponsibility === 'generated-or-vendor-content').length,
      excludedBinaryFiles: normalizedInput.files.filter(file => !file.isDir && (file.ignoredReason === 'binary' || isBinaryLikePath(file.path))).length,
      relationshipCount: finalRelationships.length,
      folderResponsibilityCount: finalFolders.length,
      limitations,
    },
  };
}

function normalizeInput(input: RepoScanInput): RepoScanInput {
  const files = input.files
    .map(file => ({ ...file, path: normalizeZipPath(file.path) }))
    .filter(file => !!file.path)
    .sort((left, right) => left.path.localeCompare(right.path));
  const textContents = Object.fromEntries(Object.entries(input.textContents)
    .map(([path, content]) => [normalizeZipPath(path), content] as const)
    .filter(([path]) => !!path)
    .sort(([left], [right]) => left.localeCompare(right)));
  return { ...input, files, textContents };
}

function addManifestEvidence(input: RepoScanInput, evidence: RepositoryEvidence[], limitations: Set<string>) {
  if (!input.files.some(file => file.path === 'package.json')) return;
  const packageText = input.textContents['package.json'];
  let packageJson: { scripts?: Record<string, unknown>; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> } | null = null;
  try {
    packageJson = packageText ? JSON.parse(packageText) : null;
  } catch {
    limitations.add('package.json could not be parsed; dependency and command evidence is limited.');
  }

  const dependencies = new Set([
    ...Object.keys(packageJson?.dependencies || {}),
    ...Object.keys(packageJson?.devDependencies || {}),
  ]);
  const manifestFrameworks = [
    ['react', 'React'],
    ['vite', 'Vite'],
    ['next', 'Next.js'],
    ['express', 'Express'],
  ].filter(([dependency]) => dependencies.has(dependency)).map(([, framework]) => framework);
  for (const framework of manifestFrameworks.sort()) {
    evidence.push(makeEvidence({
      path: 'package.json',
      category: 'stack',
      sourceType: 'manifest',
      fact: `The repository manifest deterministically supports the ${framework} framework signal.`,
      confidence: 0.98,
      metadata: { framework },
    }));
  }

  for (const [name, value] of Object.entries(packageJson?.scripts || {}).sort(([left], [right]) => left.localeCompare(right))) {
    const command = typeof value === 'string' ? value : '';
    const sensitive = SECRET_ASSIGNMENT_RE.test(command);
    evidence.push(makeEvidence({
      path: 'package.json',
      category: 'command',
      sourceType: 'manifest',
      fact: sensitive
        ? `package.json declares the ${name} script; its value was withheld because it resembles a sensitive assignment.`
        : `package.json declares script ${name}: ${command}`,
      confidence: 1,
      limitations: sensitive ? ['Command text was redacted from evidence because it resembles a secret-bearing assignment.'] : [],
      metadata: { scriptName: name, commandRedacted: sensitive },
    }));
  }
}

function analyzeFile(
  file: RepoFileSummary,
  input: RepoScanInput,
  supportedFrameworks: Set<string>,
  entryPoints: ReturnType<typeof detectEntryPointClassification>,
  evidence: RepositoryEvidence[],
): MutableFileRecord {
  const path = file.path;
  const folderPath = parentRepositoryFolder(path);
  const generated = file.ignoredReason === 'generated-vendor' || isGeneratedOrVendorPath(path);
  const binary = file.ignoredReason === 'binary' || isBinaryLikePath(path);
  const tooLarge = file.ignoredReason === 'too-large-text';

  if (generated || binary || tooLarge) {
    const reason = generated ? 'generated or vendor content' : binary ? 'binary content' : 'oversized text content';
    const exclusion = makeEvidence({
      path,
      category: 'exclusion',
      sourceType: 'file-inventory',
      fact: `${path} was excluded from source parsing as ${reason}.`,
      confidence: 1,
      assertionState: 'limited',
      validationState: 'observed',
      limitations: [`ShipSeal did not analyze the excluded ${reason}.`],
      responsibility: generated ? 'generated-or-vendor-content' : 'unknown-or-insufficient-evidence',
    });
    evidence.push(exclusion);
    return {
      path,
      folderPath,
      primaryResponsibility: generated ? 'generated-or-vendor-content' : 'unknown-or-insufficient-evidence',
      secondaryResponsibilities: [],
      confidence: generated ? 1 : 0,
      supportingEvidenceIds: [exclusion.id],
      relationships: [],
      declaredSymbols: [],
      limitations: [`ShipSeal did not analyze the excluded ${reason}.`],
      extractionState: 'excluded',
      safeToPrioritizeForDeepAnalysis: false,
    };
  }

  const content = input.textContents[path];
  const eligible = JS_TS_RE.test(path);
  const parsed = eligible && content !== undefined ? parseJsTsModule(path, content) : undefined;
  const parseFailed = !!parsed?.parseFailure;
  const classification = classifyResponsibility(path, parsed, supportedFrameworks, entryPoints);
  const limitations = [...classification.limitations];
  if (eligible && content === undefined) limitations.push('Source text was unavailable in the bounded scanner-readable subset; only path and repository metadata were used.');
  if (parseFailed) limitations.push(`TypeScript parser could not establish a valid syntax tree: ${parsed?.parseFailure}`);

  const sourceType = sourceTypeFor(path);
  const classificationEvidence = makeEvidence({
    path,
    category: categoryForResponsibility(classification.primary),
    sourceType,
    fact: classification.fact,
    confidence: classification.confidence,
    assertionState: limitations.length ? (classification.confidence > 0 ? 'limited' : 'unavailable') : 'verified',
    validationState: classification.confidence >= 0.85 ? 'validated' : classification.confidence > 0 ? 'inferred' : 'missing-context',
    limitations,
    responsibility: classification.primary,
    metadata: { frameworks: [...supportedFrameworks].sort(), parseSucceeded: !!parsed && !parseFailed },
  });
  evidence.push(classificationEvidence);

  const symbols = parseFailed ? [] : parsed?.symbols || [];
  const symbolEvidenceIds: string[] = [];
  for (const symbol of symbols) {
    const item = makeEvidence({
      path,
      category: 'structure',
      sourceType,
      fact: `${path} declares${symbol.exported ? ' and exports' : ''} ${symbol.kind} ${symbol.name}.`,
      confidence: 1,
      symbol,
      metadata: { defaultExport: symbol.defaultExport },
    });
    evidence.push(item);
    symbolEvidenceIds.push(item.id);
  }

  const extractionState = eligible
    ? parseFailed ? 'parse-failed' : parsed ? 'parsed' : 'path-only'
    : classification.primary === 'unknown-or-insufficient-evidence' ? 'unsupported' : 'path-only';

  return {
    path,
    folderPath,
    primaryResponsibility: classification.primary,
    secondaryResponsibilities: classification.secondary,
    confidence: classification.confidence,
    supportingEvidenceIds: [classificationEvidence.id, ...symbolEvidenceIds],
    relationships: [],
    declaredSymbols: symbols,
    limitations,
    extractionState,
    safeToPrioritizeForDeepAnalysis: classification.primary !== 'generated-or-vendor-content'
      && classification.primary !== 'unknown-or-insufficient-evidence'
      && classification.confidence >= 0.65,
    pendingModules: parseFailed ? [] : parsed?.modules,
    classificationEvidenceId: classificationEvidence.id,
    parsed,
  };
}

function classifyResponsibility(
  path: string,
  parsed: ParsedModule | undefined,
  frameworks: Set<string>,
  entryPoints: ReturnType<typeof detectEntryPointClassification>,
): Classification {
  const lower = path.toLowerCase();
  const base = lower.split('/').pop() || lower;
  const next = frameworks.has('next.js');
  const vite = frameworks.has('vite');
  const react = frameworks.has('react');
  const express = frameworks.has('express');
  const exportedSymbols = parsed?.symbols.filter(symbol => symbol.exported) || [];
  const hasExports = exportedSymbols.length > 0 || !!parsed?.hasDefaultExport;

  if (AGENT_INSTRUCTION_RE.test(path) || isInstructionPath(path)) return classification('ai-agent-instruction', 1, `${path} is an existing AI-agent instruction file.`);
  if (isDocumentationPath(path)) return classification('documentation', 1, `${path} is repository documentation.`);
  if (TEST_RE.test(path) || FIXTURE_RE.test(path)) return classification('test-or-fixture', 1, `${path} matches an explicit test or fixture path convention.`);
  if (TEST_CONFIG_RE.test(path)) return classification('test-configuration', 1, `${path} is a recognized JavaScript/TypeScript test configuration file.`);
  if (BUILD_CONFIG_RE.test(path)) return classification('build-configuration', 1, `${path} is a recognized build or framework configuration file.`);
  if (ENV_TEMPLATE_RE.test(path)) return classification('configuration', 1, `${path} is a placeholder-only environment configuration reference for repository setup.`);
  if (CONFIG_RE.test(path)) return classification('configuration', 1, `${path} is a recognized repository configuration file.`);

  if (next && /(^|\/)app\/api\/.+\/route\.[cm]?[jt]sx?$/.test(lower)) {
    return classification('api-route-or-request-handler', 1, `${path} is a Next.js App Router API route and exposes ${parsed?.routeExportNames.join(', ') || 'route-module'} handling.`);
  }
  if (next && /(^|\/)pages\/api\/.+\.[cm]?[jt]sx?$/.test(lower)) return classification('api-route-or-request-handler', 0.98, `${path} is a Next.js Pages Router API route.`);
  if (next && /(^|\/)app\/(?:.+\/)?page\.[cm]?[jt]sx?$/.test(lower)) return classification('route-or-page', 1, `${path} is a Next.js App Router page.`);
  if (next && /(^|\/)app\/(?:.+\/)?layout\.[cm]?[jt]sx?$/.test(lower)) return classification('layout', 1, `${path} is a Next.js App Router layout.`);
  if (next && /(^|\/)pages\/(?!api\/).+\.[cm]?[jt]sx?$/.test(lower)) return classification('route-or-page', 0.95, `${path} is a Next.js Pages Router page.`);

  if (express && parsed?.expressRouteSignal) return classification('api-route-or-request-handler', 0.95, `${path} registers an Express router or request handler using parsed framework calls.`);
  if (base.match(/^index\.[cm]?[jt]sx?$/) && parsed?.modules.some(item => item.reexport) && parsed.symbols.every(symbol => symbol.kind === 'unknown')) {
    return classification('export-barrel', 0.98, `${path} re-exports local modules as a module boundary.`);
  }
  if (vite && /(^|\/)src\/main\.[cm]?[jt]sx?$/.test(lower)) {
    return classification('application-entry-point', 1, `${path} is a Vite application entry point.`, ['framework-bootstrap']);
  }
  if (entryPoints.runtime.includes(path)) return classification('application-entry-point', 0.85, `${path} matches the scanner's deterministic runtime entry-point classification.`);
  if (exportedSymbols.some(symbol => symbol.kind === 'hook')) return classification('hook', 0.98, `${path} exports a React-style custom hook declared in the syntax tree.`);
  if (react && exportedSymbols.some(symbol => symbol.kind === 'component')) return classification('ui-component', 0.95, `${path} exports a JSX-bearing PascalCase component.`);
  if (/(^|\/)(?:stores?|state)(\/|$)/i.test(path) && hasExports && intersects(parsed?.externalModules || [], ['zustand', 'redux', '@reduxjs/toolkit', 'react'])) {
    return classification('state-management', 0.85, `${path} exports state-related symbols and imports a detected state-management dependency.`);
  }
  if (/(^|\/)(?:schemas?|models?)(\/|$)/i.test(path) && exportedSymbols.some(symbol => ['interface', 'type', 'class', 'variable'].includes(symbol.kind))) {
    return classification('schema-or-model', 0.78, `${path} exports schema/model-shaped declarations from an explicit schema or model area.`, [], ['The domain meaning of the declarations was not inferred.']);
  }
  if ((parsed?.externalModules || []).some(module => ['zod', 'joi', 'yup', 'valibot'].includes(module)) && hasExports) {
    return classification('validation', 0.92, `${path} exports declarations and imports a recognized validation library.`);
  }
  if (/(^|\/)(?:repositories|data-access|dao)(\/|$)/i.test(path) && hasExports) {
    return classification('repository-or-data-access-layer', 0.75, `${path} exports declarations from an explicit repository or data-access area.`, [], ['The backing data store and business entity were not inferred.']);
  }
  if (/(^|\/)auth(?:entication|orization)?(\/|\.|-|$)/i.test(path) && exportedSymbols.some(symbol => /auth|session|permission|role|token/i.test(symbol.name))) {
    return classification('authentication-or-authorization-area', 0.82, `${path} is in an explicit authentication/authorization path and exports matching symbols.`);
  }
  if (/(^|\/)services?(\/|$)/i.test(path) && hasExports) {
    return classification('service', 0.72, `${path} exports declarations from an explicit service module area.`, [], ['A business responsibility was not inferred from the service filename.']);
  }
  if (/(^|\/)integrations?(\/|$)/i.test(path) && hasExports && (parsed?.externalModules.length || 0) > 0) {
    return classification('integration', 0.8, `${path} exports declarations from an integration area and imports an external package.`);
  }
  if (/(^|\/)(?:utils?|helpers?)(\/|$)/i.test(path) && hasExports) {
    return classification('utility', 0.72, `${path} exports declarations from an explicit utility/helper area.`, [], ['The utility behavior was not inferred beyond structural evidence.']);
  }

  return classification(
    'unknown-or-insufficient-evidence',
    0,
    `${path} does not have sufficient deterministic evidence for a repository responsibility.`,
    [],
    parsed ? ['Parsed structure did not support a conservative responsibility classification.'] : ['Only weak path evidence was available.'],
  );
}

function validateFrameworkSignals(input: RepoScanInput, stack: DetectedStack) {
  const detected = new Set(stack.frameworks.map(item => item.toLowerCase()));
  const paths = new Set(input.files.map(file => file.path));
  let packageJson: { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> } = {};
  try {
    packageJson = JSON.parse(input.textContents['package.json'] || '{}');
  } catch {
    // The manifest limitation is recorded by addManifestEvidence.
  }
  const dependencies = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ]);
  const supported = new Set<string>();
  if (detected.has('react') && dependencies.has('react')) supported.add('react');
  if (detected.has('vite') && (dependencies.has('vite') || [...paths].some(path => /^vite\.config\.[cm]?[jt]s$/i.test(path)))) supported.add('vite');
  if (detected.has('next.js') && (dependencies.has('next') || [...paths].some(path => /^next\.config\.[cm]?[jt]s$/i.test(path)))) supported.add('next.js');
  if (detected.has('express') && dependencies.has('express')) supported.add('express');
  return supported;
}

function classification(
  primary: RepositoryResponsibility,
  confidence: number,
  fact: string,
  secondary: RepositoryResponsibility[] = [],
  limitations: string[] = [],
): Classification {
  return { primary, secondary: sortedUnique(secondary), confidence, limitations, fact };
}

function parseJsTsModule(path: string, content: string): ParsedModule {
  const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKindFor(path));
  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics || [];
  if (parseDiagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    const first = parseDiagnostics.find(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)!;
    return {
      symbols: [], modules: [], hasDefaultExport: false, hasJsx: false, expressRouteSignal: false,
      externalModules: [], routeExportNames: [], parseFailure: ts.flattenDiagnosticMessageText(first.messageText, ' '),
    };
  }

  const symbols: RepositorySymbol[] = [];
  const modules: ParsedModule['modules'] = [];
  const externalModules = new Set<string>();
  const routeExportNames = new Set<string>();
  let hasDefaultExport = false;
  let hasJsx = false;
  let importsExpress = false;
  let expressRouteSignal = false;

  const lineRange = (node: ts.Node) => ({
    startLine: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
  });
  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) => ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some(modifier => modifier.kind === kind);
  const exported = (node: ts.Node) => hasModifier(node, ts.SyntaxKind.ExportKeyword) || hasModifier(node, ts.SyntaxKind.DefaultKeyword);
  const defaultExport = (node: ts.Node) => hasModifier(node, ts.SyntaxKind.DefaultKeyword);
  const addSymbol = (name: string, kind: RepositorySymbolKind, node: ts.Node, isExported: boolean, isDefault = false) => {
    if (!name) return;
    const effectiveKind = kind === 'function' && /^use[A-Z0-9]/.test(name)
      ? 'hook'
      : kind === 'function' && /^[A-Z]/.test(name) && containsJsx(node)
        ? 'component'
        : kind;
    if (effectiveKind === 'component') hasJsx = true;
    if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name) && isExported) routeExportNames.add(name);
    symbols.push({ name, kind: effectiveKind, exported: isExported, defaultExport: isDefault, ...lineRange(node) });
  };

  const visitTopLevel = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      modules.push({ specifier, reexport: false });
      if (!specifier.startsWith('.')) externalModules.add(packageName(specifier));
      if (packageName(specifier) === 'express') importsExpress = true;
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        modules.push({ specifier, reexport: true });
        if (!specifier.startsWith('.')) externalModules.add(packageName(specifier));
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) addSymbol(element.name.text, 'unknown', element, true);
      }
    } else if (ts.isExportAssignment(node)) {
      hasDefaultExport = true;
      const name = ts.isIdentifier(node.expression) ? node.expression.text : 'default';
      addSymbol(name, 'default-export', node, true, true);
    } else if (ts.isFunctionDeclaration(node)) {
      const isExported = exported(node);
      const isDefault = defaultExport(node);
      if (isDefault) hasDefaultExport = true;
      addSymbol(node.name?.text || (isDefault ? 'default' : ''), 'function', node, isExported, isDefault);
    } else if (ts.isClassDeclaration(node)) {
      const isExported = exported(node);
      const isDefault = defaultExport(node);
      if (isDefault) hasDefaultExport = true;
      addSymbol(node.name?.text || (isDefault ? 'default' : ''), 'class', node, isExported, isDefault);
    } else if (ts.isInterfaceDeclaration(node)) {
      addSymbol(node.name.text, 'interface', node, exported(node), defaultExport(node));
    } else if (ts.isTypeAliasDeclaration(node)) {
      addSymbol(node.name.text, 'type', node, exported(node), defaultExport(node));
    } else if (ts.isEnumDeclaration(node)) {
      addSymbol(node.name.text, 'enum', node, exported(node), defaultExport(node));
    } else if (ts.isVariableStatement(node)) {
      const isExported = exported(node);
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const kind: RepositorySymbolKind = /^use[A-Z0-9]/.test(declaration.name.text)
          ? 'hook'
          : /^[A-Z]/.test(declaration.name.text) && declaration.initializer && containsJsx(declaration.initializer)
            ? 'component'
            : 'variable';
        addSymbol(declaration.name.text, kind, declaration, isExported);
      }
    }
  };
  sourceFile.statements.forEach(visitTopLevel);

  const visitAll = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) hasJsx = true;
    if (importsExpress && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (['get', 'post', 'put', 'patch', 'delete', 'use', 'route'].includes(method)) expressRouteSignal = true;
    }
    ts.forEachChild(node, visitAll);
  };
  visitAll(sourceFile);

  return {
    symbols: deduplicateSymbols(symbols),
    modules: modules.sort((left, right) => `${left.reexport}:${left.specifier}`.localeCompare(`${right.reexport}:${right.specifier}`)),
    hasDefaultExport,
    hasJsx,
    expressRouteSignal,
    externalModules: [...externalModules].sort(),
    routeExportNames: [...routeExportNames].sort(),
  };
}

function containsJsx(node: ts.Node) {
  let found = false;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function addRelationshipEvidence(
  record: MutableFileRecord,
  targetPath: string,
  type: RepositoryRelationshipType,
  evidence: RepositoryEvidence[],
  relationships: RepositoryRelationship[],
) {
  const reference: EvidenceRelationshipReference = { type, targetPath };
  const item = makeEvidence({
    path: record.path,
    category: 'relationship',
    sourceType: sourceTypeFor(record.path),
    fact: `${record.path} ${relationshipVerb(type)} ${targetPath}.`,
    confidence: 1,
    relationships: [reference],
  });
  evidence.push(item);
  record.supportingEvidenceIds.push(item.id);
  const relationship: RepositoryRelationship = {
    id: createRepositoryRelationshipId({ type, sourcePath: record.path, targetPath }),
    type,
    sourcePath: record.path,
    targetPath,
    supportingEvidenceIds: [item.id],
    confidence: 1,
    validationState: 'validated',
  };
  relationships.push(relationship);
}

function aggregateFolders(
  files: MutableFileRecord[],
  evidence: RepositoryEvidence[],
  relationships: RepositoryRelationship[],
): FolderResponsibilityRecord[] {
  const folderFiles = new Map<string, MutableFileRecord[]>();
  const folderPaths = new Set<string>(['.']);
  for (const file of files) {
    for (const folder of ancestorFolders(file.path)) {
      folderPaths.add(folder);
      if (!folderFiles.has(folder)) folderFiles.set(folder, []);
      folderFiles.get(folder)!.push(file);
    }
  }

  for (const folder of [...folderPaths].sort()) {
    const directChildren = directChildPaths(folder, files.map(file => file.path), folderPaths);
    for (const child of directChildren) {
      const item = makeEvidence({
        path: folder === '.' ? child : folder,
        folderPath: folder,
        category: 'structure',
        sourceType: 'file-inventory',
        fact: `${folder} contains ${child}.`,
        confidence: 1,
        relationships: [{ type: 'contains', targetPath: child }],
      });
      evidence.push(item);
      relationships.push({
        id: createRepositoryRelationshipId({ type: 'contains', sourcePath: folder, targetPath: child }),
        type: 'contains',
        sourcePath: folder,
        targetPath: child,
        supportingEvidenceIds: [item.id],
        confidence: 1,
        validationState: 'observed',
      });
    }
  }

  const relationshipDegreeByPath = new Map<string, number>();
  for (const relationship of relationships) {
    relationshipDegreeByPath.set(relationship.sourcePath, (relationshipDegreeByPath.get(relationship.sourcePath) || 0) + 1);
    relationshipDegreeByPath.set(relationship.targetPath, (relationshipDegreeByPath.get(relationship.targetPath) || 0) + 1);
  }

  return [...folderPaths].sort().map(folder => {
    const children = folderFiles.get(folder) || [];
    const usable = children.filter(file => file.extractionState !== 'excluded' && file.primaryResponsibility !== 'unknown-or-insufficient-evidence');
    const grouped = new Map<RepositoryResponsibility, { fileCount: number; significanceScore: number; confidenceTotal: number }>();
    for (const file of usable) {
      const current = grouped.get(file.primaryResponsibility) || { fileCount: 0, significanceScore: 0, confidenceTotal: 0 };
      const relationshipCount = relationshipDegreeByPath.get(file.path) || 0;
      current.fileCount += 1;
      current.confidenceTotal += file.confidence;
      current.significanceScore += folderResponsibilityWeight(file.primaryResponsibility) * file.confidence + Math.min(12, relationshipCount * 3);
      grouped.set(file.primaryResponsibility, current);
    }
    const dominantResponsibilities = [...grouped.entries()]
      .map(([responsibility, value]) => ({ responsibility, fileCount: value.fileCount, significanceScore: round(value.significanceScore) }))
      .sort((left, right) => right.significanceScore - left.significanceScore || right.fileCount - left.fileCount || left.responsibility.localeCompare(right.responsibility))
      .slice(0, 3);
    const allGenerated = children.length > 0 && children.every(file => file.primaryResponsibility === 'generated-or-vendor-content');
    const limitations: string[] = [];
    if (!children.length) limitations.push('No supported child file evidence was available for this folder.');
    if (children.length && !usable.length && !allGenerated) limitations.push('Child files did not provide sufficient responsibility evidence.');
    const strongest = dominantResponsibilities[0];
    const runnerUp = dominantResponsibilities[1];
    const strongestGroup = strongest ? grouped.get(strongest.responsibility) : undefined;
    const strongestAverageConfidence = strongestGroup ? strongestGroup.confidenceTotal / strongestGroup.fileCount : 0;
    const aggregationState: FolderResponsibilityRecord['aggregationState'] = !strongest || strongestAverageConfidence < 0.75
      ? 'insufficient-evidence'
      : runnerUp && strongest.significanceScore < runnerUp.significanceScore * 1.5
        ? 'mixed'
        : 'dominant';
    if (aggregationState === 'mixed') limitations.push('The folder has mixed materially important responsibilities under the deterministic folder-dominance policy.');
    if (aggregationState === 'insufficient-evidence' && usable.length) limitations.push('Child evidence confidence was insufficient to establish a dominant folder responsibility.');
    const prioritizedChildren = [...usable]
      .filter(file => file.safeToPrioritizeForDeepAnalysis)
      .sort((left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path));
    if (prioritizedChildren.length > 8) limitations.push('Important child files are limited to the eight highest-confidence deterministic candidates.');
    const childPathSet = new Set(children.map(file => file.path));
    const relationshipCount = relationships.filter(item => childPathSet.has(item.sourcePath) || childPathSet.has(item.targetPath)).length;
    const confidence = usable.length ? round(usable.reduce((total, file) => total + file.confidence, 0) / usable.length) : allGenerated ? 1 : 0;
    return {
      path: folder,
      aggregationState,
      dominantResponsibilities,
      importantChildFiles: prioritizedChildren.slice(0, 8).map(file => file.path),
      hasTests: children.some(file => file.primaryResponsibility === 'test-or-fixture'),
      hasDocumentation: children.some(file => file.primaryResponsibility === 'documentation'),
      hasAgentInstructions: children.some(file => file.primaryResponsibility === 'ai-agent-instruction'),
      hasConfiguration: children.some(file => ['configuration', 'build-configuration', 'test-configuration'].includes(file.primaryResponsibility)),
      generatedOrVendor: folder !== '.' && (allGenerated || isGeneratedOrVendorPath(folder)),
      relationshipDensity: children.length ? round(relationshipCount / children.length) : 0,
      confidence,
      supportingEvidenceIds: sortedUnique(children.flatMap(file => file.supportingEvidenceIds)),
      limitations: sortedUnique(limitations),
    };
  });
}

function folderResponsibilityWeight(responsibility: RepositoryResponsibility) {
  const weights: Partial<Record<RepositoryResponsibility, number>> = {
    'application-entry-point': 100,
    'framework-bootstrap': 95,
    'ai-agent-instruction': 90,
    'api-route-or-request-handler': 85,
    'route-or-page': 75,
    layout: 75,
    'authentication-or-authorization-area': 70,
    'build-configuration': 65,
    'test-configuration': 65,
    'state-management': 65,
    'repository-or-data-access-layer': 60,
    configuration: 60,
    service: 55,
    'schema-or-model': 50,
    validation: 50,
    'ui-component': 45,
    hook: 45,
    integration: 45,
    'export-barrel': 40,
    documentation: 40,
    'test-or-fixture': 25,
    utility: 20,
  };
  return weights[responsibility] || 0;
}

function resolveLocalModule(sourcePath: string, specifier: string, paths: Set<string>): string | null {
  const sourceParts = sourcePath.split('/');
  sourceParts.pop();
  for (const part of specifier.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!sourceParts.length) return null;
      sourceParts.pop();
    } else {
      sourceParts.push(part);
    }
  }
  const base = sourceParts.join('/');
  const candidates = [base];
  if (!JS_TS_RE.test(base)) {
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${base}${extension}`);
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${base}/index${extension}`);
  }
  return candidates.find(candidate => paths.has(candidate)) || null;
}

function ancestorFolders(path: string) {
  const parts = path.split('/');
  parts.pop();
  const folders = ['.'];
  for (let index = 1; index <= parts.length; index += 1) folders.push(parts.slice(0, index).join('/'));
  return sortedUnique(folders);
}

function directChildPaths(folder: string, filePaths: string[], folderPaths: Set<string>) {
  const prefix = folder === '.' ? '' : `${folder}/`;
  const children = new Set<string>();
  for (const path of [...filePaths, ...folderPaths].sort()) {
    if (path === '.' || path === folder || !path.startsWith(prefix)) continue;
    const remainder = path.slice(prefix.length);
    if (!remainder || remainder.includes('/')) continue;
    children.add(path);
  }
  return [...children].sort();
}

function makeEvidence({
  path,
  folderPath,
  category,
  sourceType,
  fact,
  confidence,
  assertionState = 'verified',
  validationState = 'observed',
  limitations = [],
  responsibility,
  symbol,
  relationships = [],
  metadata,
}: {
  path: string;
  folderPath?: string;
  category: RepositoryEvidenceDraft['category'];
  sourceType: RepositoryEvidenceSourceType;
  fact: string;
  confidence: number;
  assertionState?: RepositoryEvidenceDraft['assertionState'];
  validationState?: RepositoryEvidenceDraft['validation']['state'];
  limitations?: string[];
  responsibility?: RepositoryResponsibility;
  symbol?: RepositorySymbol;
  relationships?: EvidenceRelationshipReference[];
  metadata?: RepositoryEvidenceDraft['metadata'];
}) {
  return createRepositoryEvidence({
    repositoryRelativePath: path,
    folderPath: folderPath || parentRepositoryFolder(path),
    symbol,
    responsibility,
    category,
    sourceType,
    extractedFact: fact,
    confidence,
    origin: 'deterministic',
    assertionState,
    extractor: { ...REPOSITORY_INTELLIGENCE_EXTRACTOR },
    relatedEvidenceIds: [],
    relationships,
    affectedArtifactCategories: artifactCategoriesFor(category, responsibility),
    validation: {
      state: validationState,
      validatorIds: ['shipseal-path-inventory-v1'],
      reasons: validationState === 'validated' ? ['Fact is supported by parsed source and repository metadata.'] : [],
    },
    limitations,
    metadata,
  });
}

function categoryForResponsibility(responsibility: RepositoryResponsibility): RepositoryEvidenceDraft['category'] {
  if (responsibility === 'application-entry-point' || responsibility === 'framework-bootstrap') return 'entry-point';
  if (responsibility === 'test-or-fixture' || responsibility === 'test-configuration') return 'test';
  if (responsibility === 'documentation') return 'documentation';
  if (responsibility === 'ai-agent-instruction') return 'instruction';
  if (responsibility === 'generated-or-vendor-content') return 'exclusion';
  return 'responsibility';
}

function sourceTypeFor(path: string): RepositoryEvidenceSourceType {
  if (path === 'package.json') return 'manifest';
  if (TEST_RE.test(path) || FIXTURE_RE.test(path)) return 'test-source';
  if (AGENT_INSTRUCTION_RE.test(path) || isDocumentationPath(path)) return 'documentation';
  if (path.includes('.github/workflows/')) return 'ci-config';
  if (BUILD_CONFIG_RE.test(path) || TEST_CONFIG_RE.test(path) || CONFIG_RE.test(path) || ENV_TEMPLATE_RE.test(path)) return 'config';
  if (JS_TS_RE.test(path)) return 'source';
  return 'file-inventory';
}

function artifactCategoriesFor(
  category: RepositoryEvidenceDraft['category'],
  responsibility?: RepositoryResponsibility,
): RepositoryEvidenceDraft['affectedArtifactCategories'] {
  if (category === 'command') return ['command-map', 'agents-instructions', 'repository-intelligence-manifest'];
  if (category === 'risk') return ['known-risks', 'critical-files', 'repository-intelligence-manifest'];
  if (category === 'instruction') return ['agents-instructions', 'task-router', 'repository-intelligence-manifest'];
  if (responsibility === 'application-entry-point' || responsibility === 'api-route-or-request-handler') {
    return ['architecture', 'critical-files', 'task-router', 'repository-intelligence-manifest'];
  }
  return ['architecture', 'task-router', 'repository-intelligence-manifest'];
}

function relationshipVerb(type: RepositoryRelationshipType) {
  const verbs: Record<RepositoryRelationshipType, string> = {
    imports: 'imports',
    'exports-through': 'exports through',
    contains: 'contains',
    configures: 'configures',
    tests: 'tests',
    documents: 'documents',
    'provides-agent-instructions-for': 'provides agent instructions for',
    'route-belongs-to': 'belongs to route area',
    'entry-point-loads': 'loads from the entry point',
  };
  return verbs[type];
}

function scriptKindFor(path: string) {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(path)) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/i.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function packageName(specifier: string) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function intersects(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.some(value => rightSet.has(value));
}

function deduplicateSymbols(symbols: RepositorySymbol[]) {
  const byKey = new Map<string, RepositorySymbol>();
  for (const symbol of symbols) {
    const key = `${symbol.name}:${symbol.kind}:${symbol.exported}:${symbol.defaultExport}:${symbol.startLine || 0}`;
    if (!byKey.has(key)) byKey.set(key, symbol);
  }
  return [...byKey.values()].sort((left, right) => (left.startLine || 0) - (right.startLine || 0) || left.name.localeCompare(right.name));
}

function deduplicateEvidence(evidence: RepositoryEvidence[]) {
  const byId = new Map<string, RepositoryEvidence>();
  for (const item of evidence) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function deduplicateRelationships(relationships: RepositoryRelationship[]) {
  const byId = new Map<string, RepositoryRelationship>();
  for (const relationship of relationships) {
    const existing = byId.get(relationship.id);
    if (existing) existing.supportingEvidenceIds = sortedUnique([...existing.supportingEvidenceIds, ...relationship.supportingEvidenceIds]);
    else byId.set(relationship.id, { ...relationship, supportingEvidenceIds: [...relationship.supportingEvidenceIds] });
  }
  return [...byId.values()];
}

function compareRelationships(left: RepositoryRelationship, right: RepositoryRelationship) {
  return `${left.sourcePath}:${left.type}:${left.targetPath}:${left.sourceSymbol || ''}`.localeCompare(`${right.sourcePath}:${right.type}:${right.targetPath}:${right.sourceSymbol || ''}`);
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

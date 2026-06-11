import { buildDeliveryPackFiles, getDeliveryPackRequiredPaths } from '../deliveryPack';
import { buildRepoContextPackJson, buildScoreJson } from '../exports';
import type { DeliveryPackGeneratedFile } from '../deliveryPack';
import { SAMPLE_PROJECT_INTAKE } from './sampleProject';
import { buildSampleProjectReadinessReport } from './sampleReadiness';

export interface SampleDeliveryPack {
  projectName: string;
  files: DeliveryPackGeneratedFile[];
  requiredPaths: string[];
}

export function buildSampleDeliveryPack(): SampleDeliveryPack {
  const report = buildSampleProjectReadinessReport();
  const scoreJson = buildScoreJson(report);
  const files = buildDeliveryPackFiles({
    agentFiles: report.agentPack,
    mcpFiles: report.mcpReadiness.generatedFiles,
    contextFiles: {
      markdown: report.contextPack,
      json: buildRepoContextPackJson(report),
    },
    repositoryName: report.repoName,
    scoreJson,
    intake: SAMPLE_PROJECT_INTAKE,
  });

  return {
    projectName: SAMPLE_PROJECT_INTAKE.projectName,
    files,
    requiredPaths: getDeliveryPackRequiredPaths(),
  };
}

export function findSampleDeliveryPackFile(path: string, files = buildSampleDeliveryPack().files) {
  return files.find(file => file.path === path);
}

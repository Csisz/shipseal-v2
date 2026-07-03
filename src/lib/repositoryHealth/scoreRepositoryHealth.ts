import type { RepoScanInput } from '../types';
import { extractRepositoryHealthSignals } from './extractSignals';
import { buildRepositoryHealthRecommendations } from './recommendations';
import type {
  ContextWasteDimension,
  HealthConfidence,
  HealthDimension,
  HealthDimensionId,
  HealthSignal,
  RepositoryHealthModel,
  RepositoryHealthStatus,
} from './types';

const MEASUREMENT_BOUNDARY = [
  'This model is a deterministic static repository estimate.',
  'It does not measure actual provider token usage.',
  'It does not measure billing.',
  'It does not measure task completion time.',
  'It does not execute repository code.',
  'Detected commands, tests, and CI files are not proof that they pass.',
];

const OVERALL_WEIGHTS: Record<Exclude<HealthDimensionId, 'contextWaste'> | 'contextEfficiency', number> = {
  repositoryIntelligence: 0.25,
  contextEfficiency: 0.20,
  aiDevelopmentReadiness: 0.25,
  agentRouting: 0.15,
  deliveryConfidence: 0.15,
};

export function scoreRepositoryHealth(input: RepoScanInput): RepositoryHealthModel {
  const extracted = extractRepositoryHealthSignals(input);

  if (input.scanSummary?.limited || input.scanSummary?.scanMode === 'limited-fallback') {
    const limitedSignals = extracted.signals.map(signal => ({
      ...signal,
      status: 'unknown' as const,
      earned: 0,
      evidence: ['Limited fallback scan: synthetic files are not scored as real repository evidence.'],
    }));
    return {
      modelVersion: 'repository-health-v1',
      measurementMethod: 'deterministic-static-scan',
      overall: {
        score: null,
        status: 'Insufficient evidence',
        confidence: 'Low',
      },
      dimensions: {
        repositoryIntelligence: emptyDimension(limitedSignals, 'repositoryIntelligence', 'Low'),
        contextWaste: emptyContextWasteDimension(limitedSignals, 'Low'),
        aiDevelopmentReadiness: emptyDimension(limitedSignals, 'aiDevelopmentReadiness', 'Low'),
        agentRouting: emptyDimension(limitedSignals, 'agentRouting', 'Low'),
        deliveryConfidence: emptyDimension(limitedSignals, 'deliveryConfidence', 'Low'),
      },
      blockers: [{
        id: 'limited-scan',
        title: 'Insufficient repository evidence',
        detail: input.scanSummary.limitationReason || 'Repository scan used deterministic fallback data and must not be scored as real repository evidence.',
        evidence: input.scanSummary.warnings.length ? input.scanSummary.warnings : ['Limited fallback scan was detected.'],
      }],
      topActions: [],
      measurementBoundary: MEASUREMENT_BOUNDARY,
    };
  }

  const repositoryIntelligence = scoreDimension(extracted.signals, 'repositoryIntelligence');
  const contextWaste = scoreContextWaste(extracted.signals);
  const aiDevelopmentReadiness = scoreDimension(extracted.signals, 'aiDevelopmentReadiness');
  const agentRouting = scoreDimension(extracted.signals, 'agentRouting');
  const deliveryConfidence = scoreDimension(extracted.signals, 'deliveryConfidence');
  const blockers = extracted.blockers;
  const overallScore = scoreOverall({
    repositoryIntelligence: repositoryIntelligence.score,
    contextEfficiency: contextWaste.contextEfficiencyScore,
    aiDevelopmentReadiness: aiDevelopmentReadiness.score,
    agentRouting: agentRouting.score,
    deliveryConfidence: deliveryConfidence.score,
  });
  const blocking = blockers.some(blocker => ['secrets'].includes(blocker.id));

  return {
    modelVersion: 'repository-health-v1',
    measurementMethod: 'deterministic-static-scan',
    overall: {
      score: overallScore,
      status: blocking ? 'Blocked' : statusFromScore(overallScore),
      confidence: overallConfidence([
        repositoryIntelligence.confidence,
        contextWaste.confidence,
        aiDevelopmentReadiness.confidence,
        agentRouting.confidence,
        deliveryConfidence.confidence,
      ], input),
    },
    dimensions: {
      repositoryIntelligence,
      contextWaste,
      aiDevelopmentReadiness,
      agentRouting,
      deliveryConfidence,
    },
    blockers,
    topActions: buildRepositoryHealthRecommendations(extracted.signals, 5, input),
    measurementBoundary: MEASUREMENT_BOUNDARY,
  };
}

function scoreDimension(signals: HealthSignal[], dimension: Exclude<HealthDimensionId, 'contextWaste'>): HealthDimension {
  const dimensionSignals = signals.filter(signal => signal.dimension === dimension);
  const applicable = dimensionSignals.filter(signal => signal.status !== 'not-applicable' && signal.status !== 'unknown');
  const totalWeight = sum(applicable.map(signal => signal.weight));
  const earned = sum(applicable.map(signal => signal.earned));

  return {
    score: totalWeight ? Math.round((100 * earned) / totalWeight) : null,
    confidence: confidenceForSignals(dimensionSignals),
    signals: dimensionSignals,
  };
}

function scoreContextWaste(signals: HealthSignal[]): ContextWasteDimension {
  const dimensionSignals = signals.filter(signal => signal.dimension === 'contextWaste');
  const applicable = dimensionSignals.filter(signal => signal.status !== 'not-applicable' && signal.status !== 'unknown');
  const totalWeight = sum(applicable.map(signal => signal.weight));
  const riskEarned = sum(applicable.map(signal => signal.earned));
  const riskScore = totalWeight ? Math.round((100 * riskEarned) / totalWeight) : null;

  return {
    riskScore,
    contextEfficiencyScore: riskScore === null ? null : 100 - riskScore,
    confidence: confidenceForSignals(dimensionSignals),
    signals: dimensionSignals,
  };
}

function scoreOverall(scores: {
  repositoryIntelligence: number | null;
  contextEfficiency: number | null;
  aiDevelopmentReadiness: number | null;
  agentRouting: number | null;
  deliveryConfidence: number | null;
}): number | null {
  const entries = Object.entries(scores) as Array<[keyof typeof scores, number | null]>;
  const applicable = entries.filter(([, score]) => score !== null) as Array<[keyof typeof scores, number]>;
  const totalWeight = applicable.reduce((total, [key]) => total + OVERALL_WEIGHTS[key], 0);
  if (!totalWeight) return null;
  return Math.round(applicable.reduce((total, [key, score]) => total + score * OVERALL_WEIGHTS[key], 0) / totalWeight);
}

function statusFromScore(score: number | null): RepositoryHealthStatus {
  if (score === null) return 'Insufficient evidence';
  if (score >= 85) return 'AI-ready workspace';
  if (score >= 70) return 'Workable with optimization';
  if (score >= 50) return 'Fragmented workspace';
  return 'High agent friction';
}

function confidenceForSignals(signals: HealthSignal[]): HealthConfidence {
  const unknownCount = signals.filter(signal => signal.status === 'unknown').length;
  if (unknownCount >= 2) return 'Low';
  if (unknownCount === 1 || signals.some(signal => signal.status === 'partial')) return 'Medium';
  return 'High';
}

function overallConfidence(confidences: HealthConfidence[], input: RepoScanInput): HealthConfidence {
  if (input.scanSummary?.warnings?.length) return 'Medium';
  if (confidences.includes('Low')) return 'Low';
  if (confidences.includes('Medium')) return 'Medium';
  return 'High';
}

function emptyDimension(signals: HealthSignal[], dimension: Exclude<HealthDimensionId, 'contextWaste'>, confidence: HealthConfidence): HealthDimension {
  return {
    score: null,
    confidence,
    signals: signals.filter(signal => signal.dimension === dimension),
  };
}

function emptyContextWasteDimension(signals: HealthSignal[], confidence: HealthConfidence): ContextWasteDimension {
  return {
    riskScore: null,
    contextEfficiencyScore: null,
    confidence,
    signals: signals.filter(signal => signal.dimension === 'contextWaste'),
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

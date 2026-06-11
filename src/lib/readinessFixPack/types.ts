export interface ReadinessFixPackManifestEntry {
  path: string;
  title: string;
  purpose: string;
  readinessCategory: string;
  expectedImpact: string;
  isSafeToAdd: boolean;
  requiresHumanReview: boolean;
}

export interface ReadinessFixPackFile extends ReadinessFixPackManifestEntry {
  improves: string;
  whyUseful: string;
  content: string;
  alreadyInDeliveryPack: boolean;
}

export type SuggestedReadinessFile = ReadinessFixPackFile;

export const PRODUCT_MODES = ['standard', 'early_access'] as const;
export type ProductMode = typeof PRODUCT_MODES[number];

export interface ProductModeSnapshot {
  mode: ProductMode;
  earlyAccessFree: boolean;
  earlyAccessDeepAnalysisLimit: number | null;
}

export const STANDARD_PRODUCT_MODE: ProductModeSnapshot = {
  mode: 'standard',
  earlyAccessFree: false,
  earlyAccessDeepAnalysisLimit: null,
};

export function isProductModeSnapshot(value: unknown): value is ProductModeSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Partial<ProductModeSnapshot>;
  return PRODUCT_MODES.includes(snapshot.mode as ProductMode)
    && typeof snapshot.earlyAccessFree === 'boolean'
    && (snapshot.earlyAccessDeepAnalysisLimit === null
      || Number.isInteger(snapshot.earlyAccessDeepAnalysisLimit) && Number(snapshot.earlyAccessDeepAnalysisLimit) > 0)
    && (snapshot.mode === 'early_access') === snapshot.earlyAccessFree
    && (snapshot.earlyAccessFree ? snapshot.earlyAccessDeepAnalysisLimit !== null : snapshot.earlyAccessDeepAnalysisLimit === null);
}

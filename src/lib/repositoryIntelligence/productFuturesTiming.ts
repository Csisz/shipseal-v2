export type RepositoryProductTimedStage = 'roots' | 'expansion';

/**
 * One timing contract for the paid Repository Futures pipeline.
 *
 * Provider generation finishes well before the function deadline, leaving time
 * to validate and durably persist the stage. The browser waits beyond the
 * function boundary so it can never abort a healthy server invocation first.
 */
export const REPOSITORY_FUTURES_TIMING = Object.freeze({
  rootProviderTimeoutMs: 80_000,
  expansionProviderTimeoutMs: 70_000,
  functionMaxDurationMs: 120_000,
  functionSafetyMarginMs: 25_000,
  browserStageTimeoutMs: 135_000,
  browserResponseMarginMs: 15_000,
});

export function repositoryProductProviderTimeoutMs(stage: RepositoryProductTimedStage) {
  return stage === 'roots'
    ? REPOSITORY_FUTURES_TIMING.rootProviderTimeoutMs
    : REPOSITORY_FUTURES_TIMING.expansionProviderTimeoutMs;
}

export function repositoryProductClientTimeoutMs() {
  return REPOSITORY_FUTURES_TIMING.browserStageTimeoutMs;
}

export function validateRepositoryFuturesTimingPolicy() {
  const timing = REPOSITORY_FUTURES_TIMING;
  const providerDeadlines = [timing.rootProviderTimeoutMs, timing.expansionProviderTimeoutMs];
  const finitePositive = Object.values(timing).every(value => Number.isSafeInteger(value) && value > 0);
  const providerFitsFunction = providerDeadlines.every(timeoutMs => (
    timeoutMs < timing.functionMaxDurationMs - timing.functionSafetyMarginMs
  ));
  const browserOutlivesFunction = timing.browserStageTimeoutMs
    >= timing.functionMaxDurationMs + timing.browserResponseMarginMs;
  return {
    valid: finitePositive && providerFitsFunction && browserOutlivesFunction,
    finitePositive,
    providerFitsFunction,
    browserOutlivesFunction,
  };
}


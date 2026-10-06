import { createContext, useContext } from 'react';
import type { FeedbackOutcome, FeedbackSurface, ProductSignal } from '@/lib/feedback';

export interface FeedbackOpenOptions {
  surface?: FeedbackSurface;
  outcome?: FeedbackOutcome;
  premiumValue?: boolean;
}

export interface FeedbackSignalOptions {
  premiumValue?: boolean;
  prompt?: boolean;
}

export interface FeedbackContextValue {
  openFeedback: (options?: FeedbackOpenOptions) => void;
  recordOutcome: (event: ProductSignal, surface: FeedbackSurface, options?: FeedbackSignalOptions) => void;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback() {
  const value = useContext(FeedbackContext);
  return value || {
    openFeedback: () => undefined,
    recordOutcome: () => undefined,
  };
}

/** SUTRA AI — calibrate confidence thresholds from thumbs feedback */

import { feedbackStore } from "./FeedbackStore";

export interface CalibrationThresholds {
  autoCorrect: number;
  singleSuggestion: number;
  multipleSuggestions: number;
  confidenceBoost: number;
}

const DEFAULT: CalibrationThresholds = {
  autoCorrect: 0.95,
  singleSuggestion: 0.85,
  multipleSuggestions: 0.7,
  confidenceBoost: 0,
};

export class FeedbackCalibrator {
  private thresholds: CalibrationThresholds = { ...DEFAULT };
  private lastRefresh = 0;
  private static REFRESH_MS = 30_000;

  async refresh(): Promise<CalibrationThresholds> {
    if (Date.now() - this.lastRefresh < FeedbackCalibrator.REFRESH_MS) {
      return this.thresholds;
    }

    const stats = await feedbackStore.getStats();
    this.lastRefresh = Date.now();

    if (stats.total < 5) {
      this.thresholds = { ...DEFAULT };
      return this.thresholds;
    }

    const satisfaction = stats.positive / stats.total;

    if (satisfaction >= 0.9) {
      this.thresholds = {
        autoCorrect: 0.92,
        singleSuggestion: 0.82,
        multipleSuggestions: 0.68,
        confidenceBoost: 0.03,
      };
    } else if (satisfaction >= 0.75) {
      this.thresholds = { ...DEFAULT, confidenceBoost: 0.01 };
    } else if (satisfaction < 0.6) {
      this.thresholds = {
        autoCorrect: 0.97,
        singleSuggestion: 0.9,
        multipleSuggestions: 0.78,
        confidenceBoost: -0.05,
      };
    } else {
      this.thresholds = { ...DEFAULT, confidenceBoost: -0.02 };
    }

    return this.thresholds;
  }

  getThresholds(): CalibrationThresholds {
    return { ...this.thresholds };
  }

  applyBoost(confidence: number): number {
    return Math.min(1, Math.max(0, confidence + this.thresholds.confidenceBoost));
  }

  async onFeedback(): Promise<CalibrationThresholds> {
    this.lastRefresh = 0;
    return this.refresh();
  }
}

export const feedbackCalibrator = new FeedbackCalibrator();

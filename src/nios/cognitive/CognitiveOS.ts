/**
 * Cognitive OS — brainstem layer (Phase 0 stub).
 * Owns uncertainty, confidence, retries, decomposition, attention.
 */

import type { UILDocument } from "../contracts/types";

export interface CognitiveState {
  uncertainty: number;
  confidence: number;
  retryCount: number;
  attentionBudget: number;
  decompositionDepth: number;
}

export interface MetaDecision {
  action:
    | "retrieve"
    | "calculate"
    | "ask_user"
    | "simulate"
    | "debate"
    | "search"
    | "explain"
    | "optimize"
    | "execute_capability"
    | "escalate_model";
  reason: string;
  confidence: number;
}

const DEFAULT_STATE: CognitiveState = {
  uncertainty: 0.5,
  confidence: 0.5,
  retryCount: 0,
  attentionBudget: 4096,
  decompositionDepth: 0,
};

export class CognitiveOS {
  private state: CognitiveState = { ...DEFAULT_STATE };

  reset(): void {
    this.state = { ...DEFAULT_STATE };
  }

  getState(): CognitiveState {
    return { ...this.state };
  }

  updateFromUIL(uil: UILDocument): void {
    this.state.confidence = uil.confidence;
    this.state.uncertainty = Math.max(0, 1 - uil.confidence);
  }

  shouldRetry(maxRetries = 2): boolean {
    return this.state.retryCount < maxRetries && this.state.uncertainty > 0.4;
  }

  recordRetry(): void {
    this.state.retryCount += 1;
  }

  allocateAttention(tokens: number): boolean {
    if (tokens > this.state.attentionBudget) return false;
    this.state.attentionBudget -= tokens;
    return true;
  }

  metaDecide(uil: UILDocument, availableCapabilities: string[]): MetaDecision {
    const text = (uil.source_text || "").toLowerCase();

    if (/\b(balance|bakaya|baki|शेष)\b/.test(text)) {
      return {
        action: "execute_capability",
        reason: "Ledger balance query — use deterministic ERP capability",
        confidence: 0.95,
      };
    }

    if (/\b(vat|tds|tax|कर|भ्याट)\b/.test(text) && /\d/.test(text)) {
      return {
        action: "calculate",
        reason: "Numeric tax query — deterministic engine required",
        confidence: 0.92,
      };
    }

    if (/\b(what if|yadi|bhaye|simulate|optimize|best)\b/.test(text)) {
      return {
        action: "simulate",
        reason: "Counterfactual or optimization intent detected",
        confidence: 0.8,
      };
    }

    if (uil.confidence < 0.6) {
      return {
        action: "ask_user",
        reason: "Low UIL confidence — clarification needed",
        confidence: 0.7,
      };
    }

    if (availableCapabilities.some((c) => c.includes("knowledge"))) {
      return {
        action: "retrieve",
        reason: "Default — retrieve knowledge before reasoning",
        confidence: 0.75,
      };
    }

    return {
      action: "escalate_model",
      reason: "No deterministic path — escalate to reasoner",
      confidence: 0.6,
    };
  }
}

export const cognitiveOS = new CognitiveOS();

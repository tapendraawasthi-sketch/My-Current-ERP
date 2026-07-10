/**
 * NIOS Intelligence Contract v1.0
 *
 * Every capability implements:
 * Observe → Understand → Plan → Execute → Verify → Explain → Learn
 */

import type {
  CapabilityDescriptor,
  ExecutionPlan,
  ExecutionResult,
  ExplanationEnvelope,
  LearningObservation,
  ObserveContext,
  Observation,
  UILDocument,
  VerificationReport,
} from "./types";

export const INTELLIGENCE_CONTRACT_VERSION = "1.0" as const;

export interface ExecuteContext {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  sessionId: string;
  tokenBudget?: number;
}

export interface IntelligenceCapability {
  readonly descriptor: CapabilityDescriptor;

  observe(ctx: ObserveContext): Promise<Observation>;
  understand(obs: Observation): Promise<UILDocument>;
  plan(uil: UILDocument, goal?: string): Promise<ExecutionPlan>;
  execute(plan: ExecutionPlan, ctx: ExecuteContext): Promise<ExecutionResult>;
  verify(result: ExecutionResult): Promise<VerificationReport>;
  explain(verified: VerificationReport): Promise<ExplanationEnvelope>;
  learn(verified: VerificationReport, feedback?: Record<string, unknown>): Promise<LearningObservation>;
}

export abstract class BaseIntelligenceCapability implements IntelligenceCapability {
  abstract readonly descriptor: CapabilityDescriptor;

  abstract observe(ctx: ObserveContext): Promise<Observation>;
  abstract understand(obs: Observation): Promise<UILDocument>;
  abstract execute(plan: ExecutionPlan, ctx: ExecuteContext): Promise<ExecutionResult>;

  async plan(uil: UILDocument, goal?: string): Promise<ExecutionPlan> {
    return {
      id: `plan-${uil.id}`,
      goal: { goal: goal || uil.goals[0] || uil.action },
      steps: [
        {
          id: "step-1",
          capabilityId: this.descriptor.id,
          action: uil.action,
          deps: [],
          inputs: { uil },
        },
      ],
      required_capabilities: [this.descriptor.id],
      confidence: uil.confidence,
    };
  }

  async verify(result: ExecutionResult): Promise<VerificationReport> {
    return {
      ok: result.ok,
      capabilityId: result.capabilityId,
      checks: [{ name: "execution_ok", passed: result.ok, detail: result.error }],
      truthRecords: [],
    };
  }

  async explain(verified: VerificationReport): Promise<ExplanationEnvelope> {
    return {
      summary: verified.ok ? "Completed successfully." : "Execution failed verification.",
      evidence: verified.truthRecords,
      confidence: verified.ok ? 1 : 0,
    };
  }

  async learn(verified: VerificationReport): Promise<LearningObservation> {
    return {
      capabilityId: verified.capabilityId,
      observationType: verified.ok ? "success" : "failure",
      payload: { checks: verified.checks.length },
      timestamp: new Date().toISOString(),
    };
  }
}

export function createObservation(ctx: ObserveContext, rawText?: string): Observation {
  return {
    id: crypto.randomUUID(),
    observedAt: new Date().toISOString(),
    channel: ctx.channel,
    rawText,
    rawPayload:
      typeof ctx.rawInput === "object" && ctx.rawInput !== null
        ? (ctx.rawInput as Record<string, unknown>)
        : undefined,
    tenantId: ctx.tenantId,
    companyId: ctx.companyId,
    sessionId: ctx.sessionId,
  };
}

export function createUILFromText(text: string, action = "query"): UILDocument {
  return {
    id: crypto.randomUUID(),
    version: "1.0",
    source_text: text,
    action,
    confidence: 0.5,
    goals: [action],
    dependencies: [],
    evidence_needed: [],
  };
}

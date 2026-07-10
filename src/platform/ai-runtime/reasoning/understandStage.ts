import type { UnderstandInput, UnderstandOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import type { IntentCategory } from "../types/intent";
import { ACCOUNTING_ENTITY_KEY } from "../types/accounting";
import { getConfidenceEvaluator } from "../confidence";
import { runAccountingIntentExtraction } from "./accountingPipeline";

const QUERY_PATTERNS = [/^(what|how|show|list|get|find|display|report|balance|trial|ledger|stock)/i];
const COMMAND_PATTERNS = [/^(create|post|add|delete|reverse|update|pay|file|bulk|transfer|record)/i];
const SIMULATION_PATTERNS = [/^(simulate|what if|forecast|project)/i];
const PAID_PATTERNS = /\b(paid|payment\s+made|payment\s+gave|tirna\s+diye|bhugtan)\b/i;

function classifyInput(raw: string): { category: IntentCategory; domain: string; action: string } {
  const lower = raw.toLowerCase();

  if (SIMULATION_PATTERNS.some((p) => p.test(lower))) {
    return { category: "simulation", domain: "accounting", action: "simulate" };
  }
  if (PAID_PATTERNS.test(lower) || COMMAND_PATTERNS.some((p) => p.test(lower))) {
    if (/delete|reverse|bulk|payroll|tax filing/i.test(lower)) {
      return { category: "command", domain: "accounting", action: "mutate" };
    }
    return { category: "command", domain: "accounting", action: "post_journal" };
  }
  if (QUERY_PATTERNS.some((p) => p.test(lower)) || lower.includes("?")) {
    if (/stock|inventory|item/i.test(lower)) return { category: "query", domain: "inventory", action: "read" };
    if (/tax|vat|tds/i.test(lower)) return { category: "query", domain: "tax", action: "read" };
    if (/report|trial|ledger|balance|profit|cash/i.test(lower)) {
      return { category: "report", domain: "reports", action: "generate" };
    }
    return { category: "query", domain: "accounting", action: "read" };
  }
  if (/explain|why|because|meaning/i.test(lower)) {
    return { category: "explanation", domain: "knowledge", action: "explain" };
  }
  return { category: "conversation", domain: "general", action: "chat" };
}

export async function runUnderstandStage(input: UnderstandInput): Promise<UnderstandOutput> {
  const { observe } = input;
  const accounting = runAccountingIntentExtraction(observe.rawInput, observe.sessionId);
  const classified = classifyInput(observe.rawInput);

  const isAccounting = accounting.extract && accounting.extract.amount > 0;
  const category = isAccounting ? ("command" as const) : classified.category;
  const action = isAccounting ? accounting.extract!.khataIntent : classified.action;

  const missingEvidence: string[] = [];
  if (accounting.extract?.clarifyingQuestion) {
    missingEvidence.push(accounting.extract.clarifyingQuestion);
  }
  if (classified.category === "conversation" && !isAccounting) {
    missingEvidence.push("specific domain intent");
  }

  const confidence = getConfidenceEvaluator().evaluate({
    score: isAccounting ? accounting.extract!.confidence : classified.category === "conversation" ? 0.45 : 0.75,
    missingEvidence,
    risk: classified.action === "mutate" ? "medium" : isAccounting ? "low" : "none",
  });

  const entities: Record<string, unknown> = {};
  if (accounting.extract) {
    entities[ACCOUNTING_ENTITY_KEY] = accounting.extract;
  }

  const intent = createImmutable({
    id: `intent-${observe.requestId}`,
    rawInput: observe.rawInput,
    category,
    domain: isAccounting ? "accounting" : classified.domain,
    action,
    entities,
    language: /[\u0900-\u097F]/.test(observe.rawInput) ? "ne" : "en",
    confidence,
    timestamp: new Date().toISOString(),
  });

  const ambiguities: string[] = [];
  if (accounting.extract?.clarifyingQuestion) {
    ambiguities.push(accounting.extract.clarifyingQuestion);
  } else if (confidence.level === "low" || confidence.level === "medium") {
    ambiguities.push("Intent classification may be incomplete");
  }

  return createImmutable({ intent, ambiguities, timestamp: new Date().toISOString() });
}

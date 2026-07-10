import type { ReasonInput, ReasonOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { getConfidenceEvaluator } from "../confidence";
import { ACCOUNTING_ENTITY_KEY } from "../types/accounting";
import type { AccountingIntentExtract } from "../types/accounting";
import {
  runAccountingReasoning,
  buildAccountingReasoningText,
} from "./accountingPipeline";

export async function runReasonStage(input: ReasonInput): Promise<ReasonOutput> {
  const { retrieve, understand } = input;
  const intent = understand.intent;
  const evidence = retrieve.evidence;
  const sessionId = input.context?.request.sessionId ?? "default";

  const accountingExtract = intent.entities[ACCOUNTING_ENTITY_KEY] as AccountingIntentExtract | undefined;
  const conclusions: string[] = [];

  let reasoning = "";
  let confidence = getConfidenceEvaluator().combine([retrieve.confidence, intent.confidence]);

  if (accountingExtract && accountingExtract.amount > 0) {
    const { proposal } = runAccountingReasoning(sessionId);
    if (proposal) {
      reasoning = buildAccountingReasoningText(proposal);
      conclusions.push(`Journal proposal: ${proposal.khataIntent}`);
      conclusions.push(`Dr/Cr balanced: ${proposal.balanced}`);
      conclusions.push(`Payment mode: ${proposal.paymentMode}`);
      if (!proposal.balanced) {
        confidence = getConfidenceEvaluator().evaluate({
          score: 0.1,
          missingEvidence: ["Unbalanced journal — cannot post"],
          risk: "high",
        });
      } else {
        confidence = getConfidenceEvaluator().evaluate({
          score: Math.min(0.95, accountingExtract.confidence),
          missingEvidence: [],
          risk: "low",
        });
      }
    } else {
      reasoning = "Accounting intent detected but journal proposal could not be built.";
      conclusions.push("Missing journal proposal");
    }
  } else if (intent.category === "query" || intent.category === "report") {
    conclusions.push(`User seeks ${intent.domain} data via ${intent.action}`);
    if (evidence.items.length > 0) {
      conclusions.push(`Retrieved ${evidence.items.length} evidence item(s)`);
    }
    reasoning = [
      `Intent: ${intent.category}/${intent.domain}/${intent.action}`,
      `Evidence count: ${evidence.items.length}`,
      ...conclusions.map((c) => `- ${c}`),
    ].join("\n");
  } else if (intent.category === "command") {
    conclusions.push(`User requests state mutation in ${intent.domain}`);
    conclusions.push("Execution routes through Command Bus via proposal pipeline");
    reasoning = conclusions.join("\n");
  } else {
    conclusions.push("Conversational or explanatory request");
    reasoning = `Intent: ${intent.category}. Evidence: ${evidence.items.length} items.`;
  }

  return createImmutable({
    reasoning,
    conclusions,
    evidence,
    confidence,
    timestamp: new Date().toISOString(),
  });
}

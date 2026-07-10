import type { FrozenIntent, FrozenPlan, FrozenPlanStep } from "../types";
import type { ReasonOutput } from "../types/pipeline";
import { ACCOUNTING_ENTITY_KEY } from "../types/accounting";
import type { AccountingIntentExtract } from "../types/accounting";
import { getStoredJournalProposal } from "../reasoning/accountingPipeline";
import { getApprovalGate } from "../approval/approvalGate";
import { getToolRouter } from "../tool-router/toolRouter";
import { CommandTypes, AggregateTypes } from "@fios/command-bus";
import { QueryTypes } from "@fios/query-bus";

function resolveQueryType(intent: FrozenIntent): string | undefined {
  const input = intent.rawInput.toLowerCase();
  if (/trial balance/i.test(input)) return QueryTypes.TRIAL_BALANCE;
  if (/ledger/i.test(input)) return QueryTypes.LEDGER;
  if (/profit|p&l|p and l/i.test(input)) return QueryTypes.PROFIT_LOSS;
  if (/balance sheet/i.test(input)) return QueryTypes.BALANCE_SHEET;
  if (/cash book/i.test(input)) return QueryTypes.CASH_BOOK;
  if (/stock summary|inventory/i.test(input)) return QueryTypes.STOCK_SUMMARY;
  if (/tax/i.test(input)) return QueryTypes.TAX_SUMMARY;
  if (/voucher/i.test(input)) return QueryTypes.LIST_VOUCHERS;
  if (/invoice/i.test(input)) return QueryTypes.LIST_INVOICES;
  if (/account/i.test(input)) return QueryTypes.LIST_ACCOUNTS;
  if (/party|customer|supplier/i.test(input)) return QueryTypes.LIST_PARTIES;
  if (/item|product/i.test(input)) return QueryTypes.LIST_ITEMS;
  return undefined;
}

export function buildPlanSteps(intent: FrozenIntent, reason: ReasonOutput, sessionId?: string): FrozenPlanStep[] {
  const steps: FrozenPlanStep[] = [];
  const approvalGate = getApprovalGate();
  const router = getToolRouter();
  let order = 0;

  const accountingExtract = intent.entities[ACCOUNTING_ENTITY_KEY] as AccountingIntentExtract | undefined;
  const journalProposal = sessionId ? getStoredJournalProposal(sessionId) : null;

  const addStep = (step: Omit<FrozenPlanStep, "order" | "id"> & { id?: string }) => {
    order += 1;
    steps.push({
      id: step.id ?? `step-${order}`,
      order,
      kind: step.kind,
      toolId: step.toolId,
      queryType: step.queryType,
      commandType: step.commandType,
      aggregateType: step.aggregateType,
      payload: step.payload,
      description: step.description,
      requiresApproval: step.requiresApproval,
    });
  };

  if (journalProposal && accountingExtract) {
    addStep({
      kind: "tool",
      toolId: "accounting_engine",
      payload: {
        action: "validate_lines",
        lines: journalProposal.lines.map((l) => ({
          accountId: l.accountCode,
          accountName: l.accountName,
          debit: l.debit,
          credit: l.credit,
        })),
      },
      description: "Validate double-entry journal lines",
      requiresApproval: false,
    });

    const commandRisk = approvalGate.classifyStep({
      id: "khata-cmd",
      order: 0,
      kind: "command",
      commandType: CommandTypes.POST_KHATA_ENTRY,
      aggregateType: AggregateTypes.KHATA,
      payload: { card: journalProposal.card },
      description: `Post ${accountingExtract.khataIntent} voucher`,
      requiresApproval: true,
    });

    addStep({
      kind: "command",
      commandType: CommandTypes.POST_KHATA_ENTRY,
      aggregateType: AggregateTypes.KHATA,
      payload: { card: journalProposal.card },
      description: `Post journal: ${journalProposal.explanation.slice(0, 80)}`,
      requiresApproval: commandRisk.requiresApproval,
    });
  } else if (intent.category === "query" || intent.category === "report") {
    const queryType = resolveQueryType(intent);
    const toolId = intent.domain === "inventory" ? "inventory" : intent.domain === "tax" ? "tax" : "reports";
    addStep({
      kind: "tool",
      toolId,
      payload: { queryType, input: intent.rawInput },
      description: `Retrieve ${intent.domain} data`,
      requiresApproval: false,
    });
    if (queryType) {
      addStep({
        kind: "query",
        queryType,
        payload: {},
        description: `Execute query ${queryType}`,
        requiresApproval: false,
      });
    }
  } else if (intent.category === "command") {
    const toolId = router.selectTools(intent)[0] ?? "accounting_engine";
    addStep({
      kind: "tool",
      toolId,
      payload: { action: "prepare_command", input: intent.rawInput },
      description: "Prepare command payload via domain tool",
      requiresApproval: false,
    });
    const commandStep = {
      kind: "command" as const,
      commandType: "AI_PROPOSAL",
      aggregateType: "proposal",
      payload: { intent: intent.rawInput, domain: intent.domain },
      description: "Submit command via proposal pipeline",
      requiresApproval: true,
    };
    const commandRisk = approvalGate.classifyStep({
      id: "pending",
      order: 0,
      kind: "command",
      commandType: "AI_PROPOSAL",
      aggregateType: "proposal",
      payload: { intent: intent.rawInput, domain: intent.domain },
      description: "Submit command via proposal pipeline",
      requiresApproval: true,
    });
    addStep({
      ...commandStep,
      requiresApproval: commandRisk.requiresApproval,
    });
  } else if (intent.category === "simulation") {
    addStep({
      kind: "tool",
      toolId: "simulation",
      payload: { input: intent.rawInput },
      description: "Run accounting simulation",
      requiresApproval: false,
    });
  } else if (intent.category === "explanation") {
    addStep({
      kind: "tool",
      toolId: "knowledge",
      payload: { query: intent.rawInput },
      description: "Retrieve knowledge explanation",
      requiresApproval: false,
    });
  } else {
    addStep({
      kind: "tool",
      toolId: "search",
      payload: { input: intent.rawInput },
      description: "Search business context",
      requiresApproval: false,
    });
  }

  addStep({
    kind: "verify",
    payload: { planId: intent.id },
    description: "Verify execution result",
    requiresApproval: false,
  });

  return steps;
}

export function estimatePlanCost(steps: readonly FrozenPlanStep[]): { cost: number; latencyMs: number } {
  const router = getToolRouter();
  let cost = 0;
  let latencyMs = 0;

  for (const step of steps) {
    if (step.toolId) {
      const tool = router.getTool(step.toolId as import("../contracts").AiToolId);
      if (tool) {
        cost += tool.definition.cost.computeUnits;
        latencyMs += tool.definition.latency.p50Ms;
      }
    } else if (step.kind === "query") {
      cost += 1;
      latencyMs += 50;
    } else if (step.kind === "command") {
      cost += 5;
      latencyMs += 200;
    }
  }

  return { cost, latencyMs };
}

export function buildExecutionPlan(intent: FrozenIntent, reason: ReasonOutput, sessionId?: string): FrozenPlan {
  const steps = buildPlanSteps(intent, reason, sessionId);
  const { cost, latencyMs } = estimatePlanCost(steps);

  return {
    id: `plan-${intent.id}`,
    intentId: intent.id,
    steps,
    estimatedCost: cost,
    estimatedLatencyMs: latencyMs,
    confidence: reason.confidence,
    createdAt: new Date().toISOString(),
  };
}

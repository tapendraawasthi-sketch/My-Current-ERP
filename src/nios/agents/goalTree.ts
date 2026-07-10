/** Goal Tree — Phase 2 TypeScript types */

import type { GoalTreeNode, PlanStep, UILDocument } from "../contracts/types";

export interface GoalTree extends GoalTreeNode {
  id: string;
  steps: PlanStep[];
  required_capabilities: string[];
  confidence: number;
}

export function buildGoalTreeFromUIL(uil: UILDocument): GoalTree {
  const id = crypto.randomUUID();

  if (uil.action === "ledger_query") {
    return {
      id,
      goal: "Fetch accurate ledger balance from ERP",
      objectives: ["Resolve party if named", "Return deterministic balance"],
      constraints: ["Use ERP snapshot only"],
      steps: [
        { id: "s1", capabilityId: "cap.erp.session_snapshot", action: "snapshot", deps: [] },
        { id: "s2", capabilityId: "cap.erp.ledger.balance", action: "balance", deps: ["s1"] },
      ],
      required_capabilities: ["cap.erp.session_snapshot", "cap.erp.ledger.balance"],
      confidence: 0.95,
    };
  }

  if (uil.action === "tax_query") {
    return {
      id,
      goal: "Answer tax question with evidence",
      objectives: ["Retrieve law", "Use engine if numeric"],
      steps: [
        { id: "s1", capabilityId: "cap.knowledge.nepal.search", action: "retrieve", deps: [] },
      ],
      required_capabilities: ["cap.knowledge.nepal.search"],
      confidence: 0.85,
    };
  }

  return {
    id,
    goal: "Answer user question accurately",
    steps: [
      { id: "s1", capabilityId: "cap.knowledge.nepal.search", action: "retrieve", deps: [] },
    ],
    required_capabilities: ["cap.knowledge.nepal.search"],
    confidence: uil.confidence,
  };
}

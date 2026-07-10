import { ApprovalPolicies } from "./approvalPolicies";

export type ApprovalStep = "submit" | "review" | "approve" | "reject" | "revoke" | "execute";

export interface ApprovalWorkflowState {
  proposalId: string;
  currentStep: ApprovalStep;
  requiresHuman: boolean;
  completed: boolean;
}

export function createWorkflowState(proposalId: string): ApprovalWorkflowState {
  return {
    proposalId,
    currentStep: "submit",
    requiresHuman: ApprovalPolicies.humanApprovalMandatory,
    completed: false,
  };
}

export function advanceWorkflow(
  state: ApprovalWorkflowState,
  step: ApprovalStep,
): ApprovalWorkflowState {
  return {
    ...state,
    currentStep: step,
    completed: step === "execute" || step === "reject",
  };
}

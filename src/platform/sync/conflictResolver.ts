import type { DetectedConflict } from "./conflictDetector";
import { ConflictClassification } from "./conflictDetector";
import { resolveWithPolicy, type MergePolicyResult } from "./mergePolicies";

export interface ConflictResolution {
  resolved: boolean;
  strategy: string;
  requiresManual: boolean;
  result?: MergePolicyResult;
}

export function resolveConflict(conflict: DetectedConflict): ConflictResolution {
  if (conflict.classification === ConflictClassification.NONE) {
    return { resolved: true, strategy: "no-conflict", requiresManual: false };
  }

  if (conflict.classification === ConflictClassification.MANUAL_REQUIRED) {
    return { resolved: false, strategy: "manual", requiresManual: true };
  }

  const policyResult = resolveWithPolicy(conflict);
  if (policyResult.applied) {
    return {
      resolved: true,
      strategy: policyResult.policy,
      requiresManual: false,
      result: policyResult,
    };
  }

  return {
    resolved: false,
    strategy: "unresolved",
    requiresManual: conflict.classification === ConflictClassification.CONCURRENT_WRITE,
  };
}

export function resolveConflictManualPlaceholder(
  conflict: DetectedConflict,
): ConflictResolution {
  return {
    resolved: false,
    strategy: "manual-placeholder",
    requiresManual: true,
    result: {
      applied: false,
      policy: "manual",
      winner: "none",
      reason: `Manual resolution required for ${conflict.classification}`,
    },
  };
}

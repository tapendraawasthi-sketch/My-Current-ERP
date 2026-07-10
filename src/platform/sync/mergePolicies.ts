import type { DetectedConflict } from "./conflictDetector";
import { ConflictClassification } from "./conflictDetector";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export type MergeWinner = "local" | "remote" | "none";

export interface MergePolicyResult {
  applied: boolean;
  policy: string;
  winner: MergeWinner;
  reason: string;
}

export interface MergePolicy {
  name: string;
  canApply(conflict: DetectedConflict): boolean;
  apply(conflict: DetectedConflict): MergePolicyResult;
}

const lastWriteWinsPolicy: MergePolicy = {
  name: "last-write-wins",
  canApply(conflict) {
    return conflict.classification === ConflictClassification.VERSION_MISMATCH;
  },
  apply(conflict) {
    const winner =
      conflict.context.remoteVersion > conflict.context.localVersion ? "remote" : "local";
    return {
      applied: true,
      policy: "last-write-wins",
      winner,
      reason: `Higher aggregate version wins (${winner})`,
    };
  },
};

const eventHashPolicy: MergePolicy = {
  name: "hash-integrity",
  canApply(conflict) {
    return conflict.classification === ConflictClassification.HASH_MISMATCH;
  },
  apply() {
    return {
      applied: false,
      policy: "hash-integrity",
      winner: "none",
      reason: "Hash mismatch requires manual review",
    };
  },
};

const POLICIES: MergePolicy[] = [lastWriteWinsPolicy, eventHashPolicy];

export function resolveWithPolicy(conflict: DetectedConflict): MergePolicyResult {
  if (!isMigrationFlagEnabled("MIGRATION_CONFLICT_ENGINE")) {
    return {
      applied: false,
      policy: "disabled",
      winner: "none",
      reason: "Conflict engine disabled",
    };
  }

  for (const policy of POLICIES) {
    if (policy.canApply(conflict)) {
      return policy.apply(conflict);
    }
  }

  return {
    applied: false,
    policy: "none",
    winner: "none",
    reason: `No policy for ${conflict.classification}`,
  };
}

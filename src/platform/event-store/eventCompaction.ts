import type { EntityId } from "@fios/kernel";

/** Compaction policy contract — stub implementation (post-F6). */
export interface ICompactionPolicy {
  readonly name: string;
  shouldCompact(streamKey: string, eventCount: number): boolean;
  retentionDays: number;
}

export interface CompactionPlan {
  streamKey: string;
  fromSequence: number;
  toSequence: number;
  reason: string;
}

export interface ICompactionRunner {
  plan(policy: ICompactionPolicy): Promise<CompactionPlan[]>;
  execute(_plan: CompactionPlan): Promise<void>;
}

export class StubCompactionPolicy implements ICompactionPolicy {
  readonly name = "stub-retention";

  retentionDays = 3650;

  shouldCompact(_streamKey: string, _eventCount: number): boolean {
    return false;
  }
}

export class StubCompactionRunner implements ICompactionRunner {
  async plan(_policy: ICompactionPolicy): Promise<CompactionPlan[]> {
    return [];
  }

  async execute(_plan: CompactionPlan): Promise<void> {
    /* Compaction is not enabled in F4 */
  }
}

export function buildStreamKey(
  tenantId: EntityId,
  aggregateType: string,
  aggregateId: EntityId,
): string {
  return `${tenantId}/${aggregateType}/${aggregateId}`;
}

let compactionPolicyInstance: ICompactionPolicy | null = null;
let compactionRunnerInstance: ICompactionRunner | null = null;

export function getCompactionPolicy(): ICompactionPolicy {
  if (!compactionPolicyInstance) {
    compactionPolicyInstance = new StubCompactionPolicy();
  }
  return compactionPolicyInstance;
}

export function getCompactionRunner(): ICompactionRunner {
  if (!compactionRunnerInstance) {
    compactionRunnerInstance = new StubCompactionRunner();
  }
  return compactionRunnerInstance;
}

import type { JournalLine } from "./accountingAggregate";

export interface CostAllocationInput {
  lines: JournalLine[];
  costCenterId?: string;
  allocationPercent?: number;
}

export function allocateCostCenter(input: CostAllocationInput): JournalLine[] {
  if (!input.costCenterId) return input.lines;
  const pct = input.allocationPercent ?? 100;
  return input.lines.map((line) => ({
    ...line,
    costCenterId: input.costCenterId,
    debit: Math.round(line.debit * (pct / 100) * 100) / 100,
    credit: Math.round(line.credit * (pct / 100) * 100) / 100,
  }));
}

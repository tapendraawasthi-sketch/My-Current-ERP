import type { IDomainEvent } from "@fios/kernel";

export function validateProjectionEvent(event: IDomainEvent): void {
  if (!event.eventId) throw new Error("Projection event missing eventId");
  if (!event.eventType) throw new Error("Projection event missing eventType");
  if (!event.aggregateType) throw new Error("Projection event missing aggregateType");
  if (!event.aggregateId) throw new Error("Projection event missing aggregateId");
}

export function hashProjectionRow(row: Record<string, unknown>): string {
  const keys = Object.keys(row).sort();
  const canonical = keys.map((key) => `${key}:${JSON.stringify(row[key])}`).join("|");
  return canonical;
}

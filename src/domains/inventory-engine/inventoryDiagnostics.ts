export interface InventoryDiagnosticRecord {
  eventId?: string;
  eventType?: string;
  itemId?: string;
  warehouseId?: string;
  stage:
    | "event-received"
    | "applied"
    | "skipped"
    | "parity-pass"
    | "parity-fail"
    | "integrity-fail"
    | "error";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 3000;
const records: InventoryDiagnosticRecord[] = [];

export function recordInventoryDiagnostic(entry: InventoryDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getInventoryDiagnostics(filter?: {
  itemId?: string;
  stage?: InventoryDiagnosticRecord["stage"];
}): InventoryDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.itemId && record.itemId !== filter.itemId) return false;
    if (filter?.stage && record.stage !== filter.stage) return false;
    return true;
  });
}

export function clearInventoryDiagnostics(): void {
  records.length = 0;
}

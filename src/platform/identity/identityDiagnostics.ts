export interface IdentityDiagnosticRecord {
  stage:
    | "auth-success"
    | "auth-failed"
    | "logout"
    | "authz-allow"
    | "authz-deny"
    | "jwt-valid"
    | "jwt-invalid"
    | "tenant-resolved"
    | "bootstrap";
  userId?: string;
  tenantId?: string;
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 2000;
const records: IdentityDiagnosticRecord[] = [];

export function recordIdentityDiagnostic(entry: IdentityDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getIdentityDiagnostics(filter?: {
  stage?: IdentityDiagnosticRecord["stage"];
  userId?: string;
  tenantId?: string;
}): IdentityDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.stage && record.stage !== filter.stage) return false;
    if (filter?.userId && record.userId !== filter.userId) return false;
    if (filter?.tenantId && record.tenantId !== filter.tenantId) return false;
    return true;
  });
}

export function clearIdentityDiagnostics(): void {
  records.length = 0;
}

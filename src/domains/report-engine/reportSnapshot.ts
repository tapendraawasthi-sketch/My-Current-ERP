export interface ReportSnapshot {
  snapshotId: string;
  reportType: string;
  params: Record<string, unknown>;
  data: unknown;
  checkpointSequence: number;
  createdAt: string;
}

const snapshots: ReportSnapshot[] = [];

export function saveReportSnapshot(input: Omit<ReportSnapshot, "snapshotId" | "createdAt">): ReportSnapshot {
  const snapshot: ReportSnapshot = {
    ...input,
    snapshotId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  snapshots.push(snapshot);
  if (snapshots.length > 500) snapshots.splice(0, snapshots.length - 500);
  return snapshot;
}

export function listReportSnapshots(reportType?: string): ReportSnapshot[] {
  if (!reportType) return [...snapshots];
  return snapshots.filter((s) => s.reportType === reportType);
}

export function getLatestSnapshot(reportType: string): ReportSnapshot | null {
  const filtered = listReportSnapshots(reportType);
  return filtered.length > 0 ? filtered[filtered.length - 1] : null;
}

export function clearReportSnapshots(): void {
  snapshots.length = 0;
}

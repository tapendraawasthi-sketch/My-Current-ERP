import { versionReport } from "./reportVersioning";
import { reportMetrics } from "./reportMetrics";

export interface ReportExportOptions {
  format?: "json" | "csv";
  includeMetadata?: boolean;
}

export function exportReport(data: unknown, options: ReportExportOptions = {}): string {
  reportMetrics.incrementExports();
  const format = options.format ?? "json";
  const payload = options.includeMetadata !== false ? versionReport(data) : data;

  if (format === "csv" && Array.isArray(data)) {
    const rows = data as Array<Record<string, unknown>>;
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => String(row[h] ?? "")).join(","));
    }
    return lines.join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

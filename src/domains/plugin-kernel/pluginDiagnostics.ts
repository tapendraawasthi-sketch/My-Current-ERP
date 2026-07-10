export interface PluginDiagnosticRecord {
  pluginId?: string;
  stage:
    | "discovered"
    | "validated"
    | "loaded"
    | "activated"
    | "suspended"
    | "deactivated"
    | "unloaded"
    | "error"
    | "recovery";
  message?: string;
  timestamp: string;
}

const records: PluginDiagnosticRecord[] = [];

export function recordPluginDiagnostic(entry: PluginDiagnosticRecord): void {
  records.push(entry);
  if (records.length > 3000) records.splice(0, records.length - 3000);
}

export function getPluginDiagnostics(pluginId?: string): PluginDiagnosticRecord[] {
  if (!pluginId) return [...records];
  return records.filter((r) => r.pluginId === pluginId);
}

export function clearPluginDiagnostics(): void {
  records.length = 0;
}

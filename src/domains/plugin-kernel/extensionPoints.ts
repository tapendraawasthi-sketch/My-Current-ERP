export const ExtensionPoints = {
  TAX_ENGINE: "tax.engine",
  REPORT_ENGINE: "report.engine",
  INVENTORY_VALUATION: "inventory.valuation",
  DOCUMENT_NUMBERING: "document.numbering",
  POSTING_RULES: "posting.rules",
  AI_CAPABILITY: "ai.capability",
  SYNC_ADAPTER: "sync.adapter",
  IDENTITY_PROVIDER: "identity.provider",
} as const;

export type ExtensionPoint = (typeof ExtensionPoints)[keyof typeof ExtensionPoints];

const registrations = new Map<string, Array<{ pluginId: string; handler: string }>>();

export function registerExtensionPoint(
  extensionPoint: ExtensionPoint,
  pluginId: string,
  handler: string,
): void {
  const list = registrations.get(extensionPoint) ?? [];
  list.push({ pluginId, handler });
  registrations.set(extensionPoint, list);
}

export function listExtensionPointRegistrations(
  extensionPoint?: ExtensionPoint,
): Array<{ extensionPoint: string; pluginId: string; handler: string }> {
  if (extensionPoint) {
    return (registrations.get(extensionPoint) ?? []).map((r) => ({
      extensionPoint,
      ...r,
    }));
  }
  const all: Array<{ extensionPoint: string; pluginId: string; handler: string }> = [];
  for (const [ep, list] of registrations) {
    for (const r of list) all.push({ extensionPoint: ep, ...r });
  }
  return all;
}

export function unregisterPluginExtensionPoints(pluginId: string): void {
  for (const [ep, list] of registrations) {
    registrations.set(
      ep,
      list.filter((r) => r.pluginId !== pluginId),
    );
  }
}

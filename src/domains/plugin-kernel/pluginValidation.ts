import type { PluginManifest } from "./pluginManifest";

export interface ValidationIssue {
  code: string;
  message: string;
}

export function validateManifest(manifest: PluginManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!manifest.id) issues.push({ code: "MISSING_ID", message: "Plugin id required" });
  if (!manifest.name) issues.push({ code: "MISSING_NAME", message: "Plugin name required" });
  if (!manifest.version) issues.push({ code: "MISSING_VERSION", message: "Plugin version required" });
  if (!Array.isArray(manifest.capabilities)) {
    issues.push({ code: "INVALID_CAPABILITIES", message: "capabilities must be array" });
  }
  if (!Array.isArray(manifest.permissions)) {
    issues.push({ code: "INVALID_PERMISSIONS", message: "permissions must be array" });
  }
  return issues;
}

export function validatePluginId(id: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(id);
}

import type { PluginManifest } from "./pluginManifest";
import { isHostCompatible, isCompatibleVersion } from "./pluginVersioning";
import { getPlugin } from "./pluginRegistry";

export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}

export function checkCompatibility(manifest: PluginManifest): CompatibilityResult {
  if (!isHostCompatible(manifest.minHostVersion)) {
    return { compatible: false, reason: `Requires host >= ${manifest.minHostVersion}` };
  }
  const existing = getPlugin(manifest.id);
  if (existing && !isCompatibleVersion(existing.version, manifest.version)) {
    return { compatible: false, reason: "Major version mismatch" };
  }
  return { compatible: true };
}

import type { PluginManifest } from "./pluginManifest";
import { validateManifest } from "./pluginValidation";
import { checkCompatibility } from "./pluginCompatibility";
import { checkCommandAccess, checkQueryAccess, checkProposalAccess } from "./pluginSecurity";

export interface PluginTestResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
}

export function testPluginManifest(manifest: PluginManifest): PluginTestResult {
  const checks: PluginTestResult["checks"] = [];

  const validationIssues = validateManifest(manifest);
  checks.push({
    name: "manifest-validation",
    passed: validationIssues.length === 0,
    message: validationIssues.map((i) => i.message).join("; ") || undefined,
  });

  const compat = checkCompatibility(manifest);
  checks.push({
    name: "compatibility",
    passed: compat.compatible,
    message: compat.reason,
  });

  return { passed: checks.every((c) => c.passed), checks };
}

export function testPluginSecurity(pluginId: string): PluginTestResult {
  const checks = [
    { name: "command-access", ...checkCommandAccess(pluginId), passed: checkCommandAccess(pluginId).allowed },
    { name: "query-access", ...checkQueryAccess(pluginId), passed: checkQueryAccess(pluginId).allowed },
    { name: "proposal-access", ...checkProposalAccess(pluginId), passed: checkProposalAccess(pluginId).allowed },
  ].map((c) => ({ name: c.name, passed: c.passed, message: c.reason }));

  return { passed: checks.every((c) => c.passed), checks };
}

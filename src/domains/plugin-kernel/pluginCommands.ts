import { executeCommand } from "@/platform/command-bus/dispatch";
import type { ExecuteCommandOptions } from "@/platform/command-bus/dispatch";
import { checkCommandAccess } from "./pluginSecurity";
import { pluginMetrics } from "./pluginMetrics";
import { pluginLogger } from "./pluginLogger";

export async function pluginExecuteCommand(
  pluginId: string,
  options: ExecuteCommandOptions,
): Promise<unknown> {
  const check = checkCommandAccess(pluginId);
  if (!check.allowed) {
    pluginMetrics.incrementBlocked();
    throw new Error(check.reason ?? "Command access denied");
  }
  pluginMetrics.incrementCommands();
  pluginLogger.debug("plugin-command-execute", { pluginId, commandType: options.commandType });
  return executeCommand(options);
}

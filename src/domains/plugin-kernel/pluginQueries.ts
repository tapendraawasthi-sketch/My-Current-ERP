import { executeQuery } from "@/platform/query-bus/queryDispatcher";
import type { ExecuteQueryOptions } from "@/platform/query-bus/queryDispatcher";
import { checkQueryAccess } from "./pluginSecurity";
import { pluginMetrics } from "./pluginMetrics";
import { pluginLogger } from "./pluginLogger";

export async function pluginExecuteQuery<T = unknown>(
  pluginId: string,
  options: ExecuteQueryOptions,
): Promise<T> {
  const check = checkQueryAccess(pluginId);
  if (!check.allowed) {
    pluginMetrics.incrementBlocked();
    throw new Error(check.reason ?? "Query access denied");
  }
  pluginMetrics.incrementQueries();
  pluginLogger.debug("plugin-query-execute", { pluginId, queryType: options.queryType });
  return executeQuery<T>(options);
}

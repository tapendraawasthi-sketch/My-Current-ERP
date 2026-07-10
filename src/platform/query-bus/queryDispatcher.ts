import type { JsonObject } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getQueryBus } from "./bootstrap";
import { createQueryEnvelope } from "./queryEnvelope";
import { runShadowCompare } from "./queryShadow";

export interface ExecuteQueryOptions<TPayload extends JsonObject = JsonObject> {
  queryType: string;
  payload: TPayload;
  queryId?: string;
  correlationId?: string;
}

export async function executeQuery<T = unknown>(
  options: ExecuteQueryOptions,
): Promise<T> {
  if (!isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
    throw new Error("MIGRATION_QUERY_BUS is disabled");
  }
  const bus = getQueryBus();
  const envelope = createQueryEnvelope({
    queryType: options.queryType,
    payload: options.payload,
    queryId: options.queryId,
    correlationId: options.correlationId,
  });
  const result = await bus.dispatch(envelope);
  if (result.status === "rejected") {
    const message =
      result.errors?.map((error) => error.message).join("; ") || "Query rejected";
    throw new Error(message);
  }
  if (result.status === "not_found") {
    return null as T;
  }
  const data = result.data as T;
  void runShadowCompare(options.queryType, options.payload as Record<string, unknown>, data);
  return data;
}

export function executeQuerySync<T = unknown>(options: ExecuteQueryOptions): T {
  if (!isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
    throw new Error("MIGRATION_QUERY_BUS is disabled");
  }
  const bus = getQueryBus();
  const envelope = createQueryEnvelope({
    queryType: options.queryType,
    payload: options.payload,
    queryId: options.queryId,
    correlationId: options.correlationId,
  });
  const result = bus.dispatchSync(envelope);
  if (result.status === "rejected") {
    const message =
      result.errors?.map((error) => error.message).join("; ") || "Query rejected";
    throw new Error(message);
  }
  if (result.status === "not_found") {
    return null as T;
  }
  const data = result.data as T;
  void runShadowCompare(options.queryType, options.payload as Record<string, unknown>, data);
  return data;
}

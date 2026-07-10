import type { ExecuteCommandOptions } from "@/platform/command-bus/dispatch";
import type { ExecuteQueryOptions } from "@/platform/query-bus/queryDispatcher";

export interface PluginSDKContracts {
  version: string;
  commandBus: {
    execute(options: ExecuteCommandOptions): Promise<unknown>;
  };
  queryBus: {
    execute<T>(options: ExecuteQueryOptions): Promise<T>;
  };
  proposalGateway: {
    submit(input: {
      sessionId: string;
      commandType: string;
      aggregateType: string;
      payload: Record<string, unknown>;
    }): unknown;
  };
  events: {
    subscribe(pluginId: string, eventType: string, handler: () => void): boolean;
  };
}

export const SDK_CONTRACT_VERSION = "1.0.0";

export const FORBIDDEN_SDK_APIS = [
  "useStore",
  "getDB",
  "Dexie",
  "directRepository",
  "directProjection",
] as const;

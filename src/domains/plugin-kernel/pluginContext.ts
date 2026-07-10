import { executeCommand } from "@/platform/command-bus/dispatch";
import { executeQuery } from "@/platform/query-bus/queryDispatcher";
import { getContextProvider } from "@/platform/context/zustandContextProvider";
import { submitProposal } from "@/domains/ai-proposal/approvalService";
import type { PluginDescriptor } from "./pluginDescriptor";
import { hasPermission } from "./pluginPermissions";

export interface PluginContext {
  pluginId: string;
  tenantId: string;
  permissions: string[];
  executeCommand: typeof executeCommand;
  executeQuery: typeof executeQuery;
  submitProposal: typeof submitProposal;
}

export function createPluginContext(descriptor: PluginDescriptor): PluginContext {
  return {
    pluginId: descriptor.id,
    tenantId: getContextProvider().getContext().tenantId ?? "local",
    permissions: descriptor.permissions,
    executeCommand: async (options) => {
      if (!hasPermission(descriptor.id, "command.execute")) {
        throw new Error("Plugin lacks command.execute permission");
      }
      return executeCommand(options);
    },
    executeQuery: async (options) => {
      if (!hasPermission(descriptor.id, "query.execute")) {
        throw new Error("Plugin lacks query.execute permission");
      }
      return executeQuery(options);
    },
    submitProposal: (input) => {
      if (!hasPermission(descriptor.id, "proposal.submit")) {
        throw new Error("Plugin lacks proposal.submit permission");
      }
      return submitProposal({ ...input, agentId: descriptor.id });
    },
  };
}

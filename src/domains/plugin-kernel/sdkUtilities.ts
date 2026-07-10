import { pluginExecuteCommand } from "./pluginCommands";
import { pluginExecuteQuery } from "./pluginQueries";
import { submitProposal } from "@/domains/ai-proposal/approvalService";
import { subscribePluginToEvents } from "./pluginEvents";
import { SDK_CONTRACT_VERSION } from "./sdkContracts";

export function createSdkForPlugin(pluginId: string) {
  return {
    version: SDK_CONTRACT_VERSION,
    commands: {
      execute: (options: Parameters<typeof pluginExecuteCommand>[1]) =>
        pluginExecuteCommand(pluginId, options),
    },
    queries: {
      execute: <T>(options: Parameters<typeof pluginExecuteQuery>[1]) =>
        pluginExecuteQuery<T>(pluginId, options),
    },
    proposals: {
      submit: (input: Parameters<typeof submitProposal>[0]) => submitProposal(input),
    },
    events: {
      subscribe: (eventType: string, handler: { eventType: string; handle: () => void }) =>
        subscribePluginToEvents(pluginId, handler),
    },
  };
}

export function assertSdkContract(version: string): boolean {
  const [major] = version.split(".").map(Number);
  const [sdkMajor] = SDK_CONTRACT_VERSION.split(".").map(Number);
  return major === sdkMajor;
}

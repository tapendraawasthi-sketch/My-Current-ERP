export {
  PLUGIN_KERNEL_VERSION,
  MIN_HOST_VERSION,
  PluginStates,
  type PluginState,
  type PluginKernelState,
  getPluginKernelState,
  markPluginKernelInitialized,
  updatePluginKernelCounters,
} from "./pluginKernel";
export {
  hostLoadPlugin,
  hostActivatePlugin,
  hostSuspendPlugin,
  hostDeactivatePlugin,
  hostUnloadPlugin,
  hostHotReload,
  isPluginHosted,
} from "./pluginHost";
export {
  registerPluginDescriptor,
  getPlugin,
  listPlugins,
  listPluginsByState,
  unregisterPlugin,
  clearPluginRegistry,
  countActivePlugins,
  countLoadedPlugins,
} from "./pluginRegistry";
export { loadPluginFromManifest, hotLoadPlugin } from "./pluginLoader";
export {
  discoverPlugin,
  validatePlugin,
  loadPlugin,
  activatePlugin,
  suspendPlugin,
  deactivatePlugin,
  unloadPlugin,
} from "./pluginLifecycle";
export { createManifest, type PluginManifest } from "./pluginManifest";
export type { PluginDescriptor } from "./pluginDescriptor";
export {
  registerCapability,
  unregisterPluginCapabilities,
  listCapabilities,
  findPluginForCapability,
  registerCapabilitiesFromManifest,
} from "./pluginCapabilities";
export { createPluginContext, type PluginContext } from "./pluginContext";
export {
  grantPermissions,
  setPluginPermissions,
  hasPermission,
  revokePluginPermissions,
  listPluginPermissions,
  PluginPermissions,
} from "./pluginPermissions";
export { createSandbox, isApiAllowed, type SandboxContext } from "./pluginSandbox";
export { isolatePlugin, releaseIsolation, getPluginNamespace, isIsolated } from "./pluginIsolation";
export {
  checkCommandAccess,
  checkQueryAccess,
  checkProposalAccess,
  checkEventAccess,
  isForbiddenApi,
  FORBIDDEN_APIS,
  type SecurityCheckResult,
} from "./pluginSecurity";
export { validateManifest, validatePluginId, type ValidationIssue } from "./pluginValidation";
export {
  registerDiscoveredPlugin,
  listDiscoveredPlugins,
  discoverBuiltinPlugins,
  type DiscoveredPlugin,
} from "./pluginDiscovery";
export { installPlugin } from "./pluginInstaller";
export { updatePlugin } from "./pluginUpdater";
export { uninstallPlugin, hotUnloadPlugin } from "./pluginUninstaller";
export { parseVersion, isCompatibleVersion, isHostCompatible } from "./pluginVersioning";
export { checkCompatibility, type CompatibilityResult } from "./pluginCompatibility";
export { getConfiguration, setConfiguration, mergeConfiguration } from "./pluginConfiguration";
export { savePluginConfig, getPluginConfig, clearPluginConfig } from "./pluginStorage";
export { subscribePluginToEvents, listPluginEventSubscriptions } from "./pluginEvents";
export { pluginExecuteCommand } from "./pluginCommands";
export { pluginExecuteQuery } from "./pluginQueries";
export { registerHook, unregisterHooks, invokeHooks, listRegisteredHooks } from "./pluginHooks";
export { recordPluginDiagnostic, getPluginDiagnostics, clearPluginDiagnostics } from "./pluginDiagnostics";
export { pluginMetrics } from "./pluginMetrics";
export { pluginLogger } from "./pluginLogger";
export { checkPluginHealth, type PluginHealthStatus } from "./pluginHealth";
export { recoverPluginKernel, type PluginRecoveryResult } from "./pluginRecovery";
export { testPluginManifest, testPluginSecurity, type PluginTestResult } from "./pluginTesting";
export { createPluginSDK, isPluginSdkEnabled, type PluginSDK } from "./pluginSDK";
export {
  ExtensionPoints,
  registerExtensionPoint,
  listExtensionPointRegistrations,
  unregisterPluginExtensionPoints,
  type ExtensionPoint,
} from "./extensionPoints";
export { SDK_CONTRACT_VERSION, FORBIDDEN_SDK_APIS, type PluginSDKContracts } from "./sdkContracts";
export { createSdkForPlugin, assertSdkContract } from "./sdkUtilities";
export { bootstrapPluginKernel, shutdownPluginKernel, isPluginKernelBootstrapped } from "./bootstrap";

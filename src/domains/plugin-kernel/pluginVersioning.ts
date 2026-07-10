import { PLUGIN_KERNEL_VERSION } from "./pluginKernel";

export function parseVersion(version: string): number[] {
  return version.split(".").map((p) => parseInt(p, 10) || 0);
}

export function isCompatibleVersion(current: string, target: string): boolean {
  const [cMaj] = parseVersion(current);
  const [tMaj] = parseVersion(target);
  return tMaj === cMaj;
}

export function isHostCompatible(minHostVersion?: string): boolean {
  if (!minHostVersion) return true;
  const [hMaj] = parseVersion(PLUGIN_KERNEL_VERSION);
  const [mMaj] = parseVersion(minHostVersion);
  return hMaj >= mMaj;
}

export const InventoryPolicies = {
  allowNegativeStock: false,
  shadowModeOnly: true,
  defaultWarehouseId: "default",
  parityTolerance: 0.01,
} as const;

export function isShadowMode(): boolean {
  return InventoryPolicies.shadowModeOnly;
}

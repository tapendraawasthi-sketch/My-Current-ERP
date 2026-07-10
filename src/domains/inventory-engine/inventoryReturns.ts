import type { MovementKind } from "./inventoryAggregate";
import { MovementKinds } from "./inventoryAggregate";

export function classifyReturnKind(originalKind: MovementKind): MovementKind {
  if (originalKind === MovementKinds.SALE) return MovementKinds.SALES_RETURN;
  if (originalKind === MovementKinds.PURCHASE) return MovementKinds.PURCHASE_RETURN;
  return MovementKinds.ADJUSTMENT;
}
